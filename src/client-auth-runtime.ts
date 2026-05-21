import { createHash, randomUUID } from 'node:crypto';
import type {
  BackendPkceAuthOptions,
  BackendPkceAuthResult,
  BackendSmartAuthOptions,
  BackendSmartAuthResult,
  PollOptions,
  RouteContext,
  SmartTokenExchangeInput,
  SmartTokenExchangeResult,
  SmartTokenRequestSimpleInput,
} from './types.js';
import type { PublicJwk, WalletContext } from './sdk/dataspace-wallet-sdk-node/types.js';
import type { WalletProvider } from './sdk/dataspace-wallet-sdk-node/provider.js';
import { requestSmartTokenSimpleWithDeps } from '../../gdc-sdk-node-ts/dist/index.js';

type CachedToken = {
  accessToken: string;
  tokenType: string;
  scopes: string[];
  expiresAt: number;
};

export class DataspaceNodeAuthRuntime {
  constructor(
    private readonly options: {
      baseUrl: string;
      wallet?: WalletProvider;
      tokenCache: Map<string, CachedToken>;
      defaultTimeoutMs?: number;
      defaultIntervalMs?: number;
      submitBatch: (path: string, payload: unknown) => Promise<any>;
      pollUntilComplete: (path: string, request: { thid: string }, options?: PollOptions) => Promise<any>;
      postJson: (path: string, payload: unknown) => Promise<any>;
      identityDeviceDcrPath: (ctx?: RouteContext) => string;
      identityDeviceDcrPollPath: (ctx?: RouteContext) => string;
      identityCodePath: (ctx: RouteContext) => string;
      identityCodePollPath: (ctx: RouteContext) => string;
      identitySmartTokenPath: (ctx: RouteContext) => string;
      identitySmartTokenPollPath: (ctx: RouteContext) => string;
      identityTokenExchangePath: (ctx?: RouteContext) => string;
      identityTokenExchangePollPath: (ctx?: RouteContext) => string;
      identityOpenIdSmartTokenPath: (ctx?: RouteContext) => string;
      identityOpenIdSmartTokenPollPath: (ctx?: RouteContext) => string;
    },
  ) {}

  public async authenticateBackendPkceAndExchange(options: BackendPkceAuthOptions): Promise<BackendPkceAuthResult> {
    const { ctx, apiKey, scopes, tokenCacheKey = `pkce:${apiKey.slice(0, 8)}`, endpointId, codeVerifier = randomUUID(), pollOptions } = options;
    const cacheKey = String(tokenCacheKey || endpointId || '').trim() || `pkce:${apiKey.slice(0, 8)}`;
    const cached = this.options.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 30_000) {
      return { status: 'cached', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: cached.accessToken, tokenType: cached.tokenType, scopes: cached.scopes };
    }

    const controllerPublicJwk = await this.resolveControllerPublicJwk(options);
    const dcrPayload = this.buildAuthDIDCommRequest({ thid: `dcr-${randomUUID()}`, clientId: apiKey, body: {}, controllerPublicJwk });
    await this.options.submitBatch(this.options.identityDeviceDcrPath(ctx), dcrPayload);
    const dcrPoll = await this.options.pollUntilComplete(this.options.identityDeviceDcrPollPath(ctx), { thid: String(dcrPayload.thid) }, pollOptions);
    if (dcrPoll.status !== 200) return { status: 'failed', step: '_dcr', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: '', tokenType: 'Bearer', scopes };

    const codePayload = this.buildAuthDIDCommRequest({
      thid: `code-${randomUUID()}`,
      clientId: apiKey,
      body: {},
      controllerPublicJwk,
      extra: { code_challenge: this.pkceS256Challenge(codeVerifier), code_challenge_method: 'S256' },
    });
    await this.options.submitBatch(this.options.identityCodePath(ctx), codePayload);
    const codePoll = await this.options.pollUntilComplete(this.options.identityCodePollPath(ctx), { thid: String(codePayload.thid) }, pollOptions);
    const code = String(((codePoll.body as Record<string, unknown>) ?? {}).code ?? '').trim();
    if (codePoll.status !== 200 || !code) return { status: 'failed', step: '_code', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: '', tokenType: 'Bearer', scopes };

    const tokenPayload = this.buildAuthDIDCommRequest({
      thid: `token-${randomUUID()}`,
      clientId: apiKey,
      body: {},
      controllerPublicJwk,
      extra: { code, code_verifier: codeVerifier },
    });
    await this.options.submitBatch(this.options.identitySmartTokenPath(ctx), tokenPayload);
    const tokenPoll = await this.options.pollUntilComplete(this.options.identitySmartTokenPollPath(ctx), { thid: String(tokenPayload.thid) }, pollOptions);
    const idToken = String((((tokenPoll.body as Record<string, unknown>) ?? {}).id_token) ?? '').trim();
    if (tokenPoll.status !== 200 || !idToken) return { status: 'failed', step: '_token', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: '', tokenType: 'Bearer', scopes };

    const exchangeThid = `exchange-${randomUUID()}`;
    await this.options.submitBatch(this.options.identityTokenExchangePath(ctx), {
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      subject_token: idToken,
      scope: scopes.join(' '),
      api_key: apiKey,
      organization: ctx.tenantId,
      thid: exchangeThid,
    });
    const exchangePoll = await this.options.pollUntilComplete(this.options.identityTokenExchangePollPath(ctx), { thid: exchangeThid }, pollOptions);
    const exchangeBody = (exchangePoll.body as Record<string, unknown>) ?? {};
    const accessToken = String(exchangeBody.access_token ?? '').trim();
    if (exchangePoll.status !== 200 || !accessToken) return { status: 'failed', step: '_exchange', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: '', tokenType: 'Bearer', scopes };

    const tokenType = String(exchangeBody.token_type ?? 'Bearer');
    const grantedScope = String(exchangeBody.scope ?? '').trim();
    const grantedScopes = grantedScope ? grantedScope.split(' ').filter(Boolean) : scopes;
    const expiresIn = Number(exchangeBody.expires_in ?? 0);
    this.options.tokenCache.set(cacheKey, { accessToken, tokenType, scopes: grantedScopes, expiresAt: Date.now() + expiresIn * 1000 });
    return { status: 'fetched', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken, tokenType, scopes: grantedScopes };
  }

  public getCachedBearerToken(tokenCacheKey: string): string | undefined {
    const cached = this.options.tokenCache.get(tokenCacheKey);
    return cached && cached.expiresAt > Date.now() + 30_000 ? cached.accessToken : undefined;
  }

  public async authenticateBackendSmartStandard(options: BackendSmartAuthOptions): Promise<BackendSmartAuthResult> {
    const { clientId, scopes, tokenCacheKey = `smart-backend:${clientId}`, endpointId, tokenUrl, tokenPath = '/token', audience, assertionTtlSeconds = 300, additionalTokenFields } = options;
    const cacheKey = String(tokenCacheKey || endpointId || '').trim() || `smart-backend:${clientId}`;
    const cached = this.options.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 30_000) {
      return { status: 'cached', profile: 'smart-backend.v1', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: cached.accessToken, tokenType: cached.tokenType, scopes: cached.scopes, expiresAt: new Date(cached.expiresAt).toISOString() };
    }

    const resolvedTokenUrl = this.resolveStandardTokenUrl(tokenUrl, tokenPath);
    const publicJwk = await this.resolveSmartAuthPublicJwk(options);
    const clientAssertion = await this.signSmartBackendClientAssertion({
      clientId,
      audience: audience ?? resolvedTokenUrl,
      publicJwk,
      ttlSeconds: assertionTtlSeconds,
      walletContext: options.walletContext,
    });

    const response = await this.options.postJson(tokenUrl ?? tokenPath, {
      grant_type: 'client_credentials',
      client_id: clientId,
      scope: scopes.join(' '),
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: clientAssertion,
      ...(additionalTokenFields ?? {}),
    });
    const body = (response.body as Record<string, unknown>) ?? {};
    const accessToken = String(body.access_token ?? '').trim();
    if (response.status >= 400 || !accessToken) {
      return { status: 'failed', profile: 'smart-backend.v1', tokenCacheKey: cacheKey, endpointId: cacheKey, statusCode: response.status, response };
    }

    const tokenType = String(body.token_type ?? 'Bearer');
    const grantedScope = String(body.scope ?? '').trim();
    const grantedScopes = grantedScope ? grantedScope.split(' ').filter(Boolean) : scopes;
    const expiresIn = Number(body.expires_in ?? 0);
    const expiresAt = Date.now() + expiresIn * 1000;
    this.options.tokenCache.set(cacheKey, { accessToken, tokenType, scopes: grantedScopes, expiresAt });
    return { status: 'fetched', profile: 'smart-backend.v1', tokenCacheKey: cacheKey, endpointId: cacheKey, statusCode: response.status, accessToken, tokenType, scopes: grantedScopes, expiresAt: new Date(expiresAt).toISOString(), response };
  }

  public async requestSmartToken(input: SmartTokenExchangeInput): Promise<SmartTokenExchangeResult> {
    const tokenCacheKey = String(input.tokenCacheKey || input.endpointId || '').trim();
    if (!tokenCacheKey) throw new Error('requestSmartToken requires tokenCacheKey.');
    const normalizedScopes = Array.from(new Set((input.scopes || []).filter(Boolean))).sort();
    const cached = this.options.tokenCache.get(tokenCacheKey);
    if (cached && cached.expiresAt > Date.now() + 30_000) {
      return { status: 'cached', accessToken: cached.accessToken, tokenType: cached.tokenType, scopes: cached.scopes };
    }
    const response = await this.options.postJson(input.path || '/token', input.exchangePayload || {});
    const body = (response.body as Record<string, unknown>) ?? {};
    const accessToken = String(body.access_token ?? '').trim();
    if (response.status >= 400 || !accessToken) return { status: 'failed', statusCode: response.status, response };
    const tokenType = String(body.token_type ?? 'Bearer');
    const grantedScopes = Array.isArray(body.granted_scopes) ? (body.granted_scopes as string[]) : String(body.scope ?? '').trim().split(' ').filter(Boolean);
    const resolvedScopes = grantedScopes.length ? grantedScopes : normalizedScopes;
    const expiresIn = Number(body.expires_in ?? 0);
    this.options.tokenCache.set(tokenCacheKey, { accessToken, tokenType, scopes: resolvedScopes, expiresAt: Date.now() + expiresIn * 1000 });
    return { status: 'fetched', accessToken, tokenType, scopes: resolvedScopes, statusCode: response.status, response };
  }

  public async requestSmartTokenSimple(input: SmartTokenRequestSimpleInput, routeCtx: RouteContext): Promise<SmartTokenExchangeResult> {
    return requestSmartTokenSimpleWithDeps({
      input,
      routeCtx,
      baseUrl: this.options.baseUrl,
      defaultTimeoutMs: this.options.defaultTimeoutMs,
      defaultIntervalMs: this.options.defaultIntervalMs,
      identityTokenExchangePath: this.options.identityTokenExchangePath,
      identityTokenExchangePollPath: this.options.identityTokenExchangePollPath,
      identityOpenIdSmartTokenPath: this.options.identityOpenIdSmartTokenPath,
      identityOpenIdSmartTokenPollPath: this.options.identityOpenIdSmartTokenPollPath,
      submitAndPoll: (this.options as any).submitAndPoll,
      setTokenCache: (tokenCacheKey, token) => {
        this.options.tokenCache.set(tokenCacheKey, token);
      },
    });
  }

  private pkceS256Challenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest().toString('base64url');
  }

  private buildAuthDIDCommRequest(params: {
    thid: string;
    clientId: string;
    body: Record<string, unknown>;
    controllerPublicJwk: PublicJwk | Record<string, unknown>;
    extra?: Record<string, unknown>;
  }): Record<string, unknown> {
    const now = Math.floor(Date.now() / 1000);
    return {
      thid: params.thid,
      type: 'application/bundle-api+json',
      iat: now,
      exp: now + 300,
      client_id: params.clientId,
      body: params.body,
      meta: { jws: { protected: { alg: 'ES384', jwk: params.controllerPublicJwk } } },
      ...(params.extra ?? {}),
    };
  }

  private async resolveControllerPublicJwk(options: BackendPkceAuthOptions): Promise<PublicJwk | Record<string, unknown>> {
    if (options.controllerPublicJwk) return options.controllerPublicJwk;
    if (!this.options.wallet) throw new Error('authenticateBackendPkceAndExchange requires controllerPublicJwk or a configured wallet provider.');
    const walletContext: WalletContext = options.walletContext ?? { tenantId: options.ctx.tenantId, jurisdiction: options.ctx.jurisdiction, sector: options.ctx.sector };
    const publicJwks = await this.options.wallet.getPublicJwks(walletContext);
    const controllerPublicJwk = publicJwks.find((jwk) => jwk.use === 'sig' || jwk.alg === 'ES384') ?? publicJwks[0];
    if (!controllerPublicJwk) throw new Error('Wallet provider returned no public JWKs for the requested context.');
    return controllerPublicJwk;
  }

  private resolveStandardTokenUrl(tokenUrl: string | undefined, tokenPath: string): string {
    if (tokenUrl && tokenUrl.trim()) return tokenUrl.trim();
    return `${this.options.baseUrl}${tokenPath.startsWith('/') ? tokenPath : `/${tokenPath}`}`;
  }

  private async resolveSmartAuthPublicJwk(options: BackendSmartAuthOptions): Promise<PublicJwk | Record<string, unknown>> {
    if (options.publicJwk) return options.publicJwk;
    if (!this.options.wallet) throw new Error('authenticateBackendSmartStandard requires publicJwk or a configured wallet provider.');
    const walletContext: WalletContext = options.walletContext ?? { tenantId: options.clientId, jurisdiction: 'global', sector: 'backend' };
    const publicJwks = await this.options.wallet.getPublicJwks(walletContext);
    const signingJwk = publicJwks.find((jwk) => jwk.use === 'sig' || jwk.alg === 'ES384') ?? publicJwks[0];
    if (!signingJwk) throw new Error('Wallet provider returned no public JWKs for smart-backend.v1.');
    return signingJwk;
  }

  private async signSmartBackendClientAssertion(params: {
    clientId: string;
    audience: string;
    publicJwk: PublicJwk | Record<string, unknown>;
    ttlSeconds: number;
    walletContext?: WalletContext;
  }): Promise<string> {
    if (!this.options.wallet) throw new Error('smart-backend.v1 signing requires a configured wallet provider.');
    const now = Math.floor(Date.now() / 1000);
    const walletContext: WalletContext = params.walletContext ?? { tenantId: params.clientId, jurisdiction: 'global', sector: 'backend' };
    const kid = String((params.publicJwk as { kid?: string }).kid ?? '').trim();
    return this.options.wallet.signCompactJws(walletContext, {
      header: { typ: 'JWT', alg: this.preferredJwtAlg(params.publicJwk), ...(kid ? { kid } : {}) },
      claims: { iss: params.clientId, sub: params.clientId, aud: params.audience, iat: now, exp: now + Math.max(params.ttlSeconds, 1), jti: `jwt-${randomUUID()}` },
    });
  }

  private preferredJwtAlg(publicJwk: PublicJwk | Record<string, unknown>): string {
    const jwk = publicJwk as Record<string, unknown>;
    const alg = String(jwk.alg ?? '').trim();
    if (alg) return alg;
    const kty = String(jwk.kty ?? '').toUpperCase();
    const crv = String(jwk.crv ?? '').toUpperCase();
    if (kty === 'EC' && crv === 'P-256') return 'ES256';
    if (kty === 'EC' && crv === 'P-384') return 'ES384';
    if (kty === 'RSA') return 'RS384';
    return 'ES384';
  }
}
