import { randomUUID } from 'node:crypto';
import type { DidcommFetchInit } from 'gdc-common-utils-ts/utils/didcomm-submit';
import { submitDidcomm } from 'gdc-common-utils-ts/utils/didcomm-submit';
import { buildLoincToken } from './canonical.js';
import {
  isRetryableTransportError,
  jsonResponse,
  parseRetryAfterMs,
  sleep,
} from './client-runtime-utils.js';
import type {
  AsyncPollRequest,
  PollOptions,
  PollResult,
  RouteContext,
  SubmitAndPollResult,
  SubmitResponse,
} from './types.js';
import type { PublicJwk, WalletContext } from './sdk/dataspace-wallet-sdk-node/types.js';
import type { WalletProvider } from './sdk/dataspace-wallet-sdk-node/provider.js';
import { submitAndPollWithMethods, pollUntilCompleteWithMethod } from '../../gdc-sdk-node-ts/dist/index.js';

type DemoJob = { kind: string; payload: Record<string, unknown>; path: string };

export class DataspaceNodeHttpRuntime {
  constructor(
    private readonly options: {
      baseUrl: string;
      bearerToken?: string;
      defaultHeaders: Record<string, string>;
      wallet?: WalletProvider;
      requestTimeoutMs: number;
      requestRetries: number;
      allowDemoFallback: boolean;
      traceHttp: (stage: string, data: Record<string, unknown>) => void;
      demoJobs: Map<string, DemoJob>;
    },
  ) {}

  public async submitBundle(
    path: string,
    payload: { thid?: string } & Record<string, unknown>,
    submitBatch: (path: string, payload: unknown) => Promise<SubmitResponse>,
    submitBatchEncrypted: (
      path: string,
      payload: { thid?: string } & Record<string, unknown>,
      recipientEncryptionJwk: PublicJwk,
      walletContext: WalletContext,
    ) => Promise<SubmitResponse>,
    options?: {
      mode?: 'plain' | 'strict';
      recipientEncryptionJwk?: PublicJwk;
      walletContext?: WalletContext;
    },
  ): Promise<SubmitResponse> {
    const mode = options?.mode ?? 'plain';
    if (mode === 'strict') {
      if (!options?.recipientEncryptionJwk || !options?.walletContext) {
        throw new Error('submitBundle strict mode requires recipientEncryptionJwk and walletContext.');
      }
      return submitBatchEncrypted(path, payload, options.recipientEncryptionJwk, options.walletContext);
    }
    return submitBatch(path, payload);
  }

  public async submitBatch(path: string, payload: unknown): Promise<SubmitResponse> {
    const url = /^https?:\/\//.test(path)
      ? path
      : `${this.options.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const result = await submitDidcomm({
      mode: 'plain',
      url,
      payload: payload as Record<string, unknown>,
      defaultHeaders: this.options.defaultHeaders,
      bearerToken: this.options.bearerToken,
      fetcher: (requestUrl: string, init: DidcommFetchInit) => this.fetchWithPolicy(requestUrl, init, payload),
    });
    return { status: result.status, location: result.location, body: result.body };
  }

  public async submitBatchEncrypted(
    path: string,
    payload: { thid?: string } & Record<string, unknown>,
    recipientEncryptionJwk: PublicJwk,
    walletContext: WalletContext,
  ): Promise<SubmitResponse> {
    if (!this.options.wallet) {
      throw new Error('submitBatchEncrypted requires a configured wallet provider.');
    }

    const publicJwks = await this.options.wallet.getPublicJwks(walletContext);
    const signingJwk = publicJwks.find((jwk) => jwk.use === 'sig' || jwk.alg === 'ES384') ?? publicJwks[0];
    const url = /^https?:\/\//.test(path)
      ? path
      : `${this.options.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const result = await submitDidcomm({
      mode: 'strict',
      url,
      payload,
      defaultHeaders: this.options.defaultHeaders,
      bearerToken: this.options.bearerToken,
      recipientEncryptionJwk,
      signCompactJws: async (claims: Record<string, unknown>) =>
        this.options.wallet!.signCompactJws(walletContext, {
          header: {
            typ: 'application/didcomm-signed+json',
            alg: 'ES384',
            ...(signingJwk?.kid ? { kid: signingJwk.kid } : {}),
          },
          claims,
        }),
      encryptCompactJwe: async (compactJws: string, recipientJwk: unknown) =>
        this.options.wallet!.buildCompactJwe(walletContext, {
          plaintext: compactJws,
          recipientJwk: recipientJwk as PublicJwk,
          contentType: 'JWS',
        }),
      fetcher: (requestUrl: string, init: DidcommFetchInit) => this.fetchWithPolicy(requestUrl, init, payload),
    });

    return { status: result.status, location: result.location, body: result.body };
  }

  public async postJson(path: string, payload: unknown): Promise<SubmitResponse> {
    const response = await this.doPost(path, payload, 'application/json');
    const body = await this.parseResponseBody(response);
    return { status: response.status, location: response.headers.get('location') ?? undefined, body };
  }

  public async submitLegacyJson(path: string, payload: unknown): Promise<SubmitResponse> {
    return this.postJson(path, payload);
  }

  public async postFormData(path: string, formData: FormData): Promise<SubmitResponse> {
    const url = `${this.options.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      ...this.options.defaultHeaders,
      Accept: 'application/json, application/didcomm-plaintext+json, application/x-www-form-urlencoded, */*',
    };
    if (this.options.bearerToken) headers.Authorization = `Bearer ${this.options.bearerToken}`;
    const response = await fetch(url, { method: 'POST', headers, body: formData });
    const body = await this.parseResponseBody(response);
    return { status: response.status, location: response.headers.get('location') ?? undefined, body };
  }

  public async uploadConversionFile(params: {
    path: string;
    fileName: string;
    fileContent: Blob | Buffer | Uint8Array | ArrayBuffer;
    fileFieldName?: string;
    fields?: Record<string, string>;
  }): Promise<SubmitResponse> {
    const form = new FormData();
    const fileFieldName = params.fileFieldName ?? 'file';
    const content =
      params.fileContent instanceof Blob
        ? params.fileContent
        : new Blob([params.fileContent as BlobPart]);
    form.append(fileFieldName, content, params.fileName);
    for (const [key, value] of Object.entries(params.fields ?? {})) form.append(key, value);
    return this.postFormData(params.path, form);
  }

  public async pollBatchResponse(
    path: string,
    request: AsyncPollRequest,
  ): Promise<{ status: number; body: unknown; retryAfterMs?: number }> {
    const response = await this.doPost(path, request, 'application/json');
    return {
      status: response.status,
      body: await this.parseResponseBody(response),
      retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')),
    };
  }

  public async submitAndPoll(
    submitPath: string,
    pollPath: string,
    payload: { thid?: string } & Record<string, unknown>,
    options?: PollOptions,
  ): Promise<SubmitAndPollResult> {
    return submitAndPollWithMethods({
      submitBatch: this.submitBatch.bind(this),
      pollUntilComplete: this.pollUntilComplete.bind(this),
    }, submitPath, pollPath, payload, options);
  }

  public async pollUntilComplete(path: string, request: AsyncPollRequest, options?: PollOptions): Promise<PollResult> {
    return pollUntilCompleteWithMethod(this.pollBatchResponse.bind(this), path, request, options);
  }

  private async fetchWithPolicy(url: string, init: RequestInit, payload?: unknown): Promise<Response> {
    const attempts = Math.max(1, this.options.requestRetries + 1);
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.requestTimeoutMs);
      try {
        this.options.traceHttp('request', { attempt, method: String(init.method || 'GET').toUpperCase(), url, headers: init.headers, payload });
        const response = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeout);
        const responseBodyRaw = await response.clone().text();
        this.options.traceHttp('response', { attempt, method: String(init.method || 'GET').toUpperCase(), url, status: response.status, ok: response.ok, bodyRaw: responseBodyRaw });
        if (response.status >= 500 && attempt < attempts) {
          this.options.traceHttp('retry', { attempt, reason: `http_${response.status}`, url });
          await sleep(50);
          continue;
        }
        return response;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        this.options.traceHttp('error', { attempt, method: String(init.method || 'GET').toUpperCase(), url, error: error instanceof Error ? error.message : String(error) });
        if (attempt < attempts && isRetryableTransportError(error)) {
          this.options.traceHttp('retry', { attempt, reason: 'transport_error', url });
          await sleep(50);
          continue;
        }
        break;
      }
    }

    if (this.options.allowDemoFallback && isRetryableTransportError(lastError)) {
      const fallback = this.buildDemoFallbackResponse(url, init, payload);
      console.warn(`[dataspace-client-sdk-node] demo fallback for ${url}: backend unavailable, returning synthetic example data.`);
      return fallback;
    }

    throw lastError instanceof Error ? lastError : new Error(`Request failed for ${url}`);
  }

  private buildDemoFallbackResponse(url: string, init: RequestInit, payload?: unknown): Response {
    const pathname = new URL(url).pathname;
    const body = this.buildDemoFallbackBody(pathname, payload);
    return jsonResponse(body, this.buildDemoFallbackStatus(pathname, init));
  }

  private buildDemoFallbackStatus(pathname: string, init: RequestInit): number {
    if (pathname.endsWith('/_batch') || pathname.endsWith('/_activate') || pathname.endsWith('/_exchange') || pathname.endsWith('/_dcr') || pathname.endsWith('/_code') || pathname.endsWith('/_token') || pathname.endsWith('/token')) {
      return 202;
    }
    if (pathname.endsWith('/_batch-response') || pathname.endsWith('/_activate-response') || pathname.endsWith('/_exchange-response') || pathname.endsWith('/_dcr-response') || pathname.endsWith('/_code-response') || pathname.endsWith('/_token-response') || pathname.endsWith('/token-response')) {
      return 200;
    }
    return String(init.method || 'POST').toUpperCase() === 'POST' ? 200 : 200;
  }

  private buildDemoFallbackBody(pathname: string, payload?: unknown): unknown {
    if (pathname.endsWith('/_batch-response') || pathname.endsWith('/_activate-response') || pathname.endsWith('/_exchange-response') || pathname.endsWith('/_dcr-response') || pathname.endsWith('/_code-response') || pathname.endsWith('/_token-response')) {
      return this.buildDemoPollBody(pathname, payload);
    }

    const request = (payload ?? {}) as Record<string, unknown>;
    const thid = String(request.thid || request['thid'] || '').trim();

    if (pathname.endsWith('/_batch')) {
      if (pathname.includes('/registry/org.schema/Organization/_batch')) {
        this.options.demoJobs.set(thid || pathname, { kind: 'organization-batch', payload: request, path: pathname });
      } else if (pathname.includes('/registry/org.schema/Order/_batch')) {
        this.options.demoJobs.set(thid || pathname, { kind: 'order-batch', payload: request, path: pathname });
      } else if (pathname.includes('/individual/org.schema/Consent/_batch') || pathname.includes('/individual/org.hl7.fhir.r4/Consent/_batch')) {
        this.options.demoJobs.set(thid || pathname, { kind: 'consent-batch', payload: request, path: pathname });
      } else if (pathname.includes('/organization/org.hl7.fhir.r4/Composition/_batch') || pathname.includes('/digitaltwin/org.hl7.fhir.r4/Composition/_batch')) {
        this.options.demoJobs.set(thid || pathname, { kind: 'composition-batch', payload: request, path: pathname });
      } else if (pathname.includes('/individual/org.schema/Organization/_batch')) {
        this.options.demoJobs.set(thid || pathname, { kind: 'individual-organization-batch', payload: request, path: pathname });
      }
      return { accepted: true, demo: true, thid, path: pathname };
    }

    if (pathname.endsWith('/token')) {
      this.options.demoJobs.set(thid || pathname, { kind: 'identity-openid-smart-token', payload: request, path: pathname });
      return { accepted: true, demo: true, thid, path: pathname };
    }
    if (pathname.endsWith('/_activate')) {
      this.options.demoJobs.set(thid || pathname, { kind: 'organization-activate', payload: request, path: pathname });
      return { accepted: true, demo: true, thid, path: pathname };
    }
    if (pathname.endsWith('/_dcr')) {
      this.options.demoJobs.set(thid || pathname, { kind: 'identity-dcr', payload: request, path: pathname });
      return { accepted: true, demo: true, thid, path: pathname };
    }
    if (pathname.endsWith('/_code')) {
      this.options.demoJobs.set(thid || pathname, { kind: 'identity-code', payload: request, path: pathname });
      return { accepted: true, demo: true, thid, path: pathname };
    }
    if (pathname.endsWith('/_token')) {
      this.options.demoJobs.set(thid || pathname, { kind: 'identity-smart-token', payload: request, path: pathname });
      return { accepted: true, demo: true, thid, path: pathname };
    }
    if (pathname.endsWith('/_exchange')) {
      this.options.demoJobs.set(thid || pathname, { kind: 'identity-exchange', payload: request, path: pathname });
      return { accepted: true, demo: true, thid, path: pathname };
    }

    return { accepted: true, demo: true, thid, path: pathname };
  }

  private buildDemoPollBody(pathname: string, payload?: unknown): unknown {
    const request = (payload ?? {}) as Record<string, unknown>;
    const thid = String(request.thid || '').trim();
    const job = this.options.demoJobs.get(thid) ?? Array.from(this.options.demoJobs.values()).reverse().find((entry) => entry.path.endsWith(pathname.replace(/.*\//, '')) || entry.path === pathname);

    if (pathname.endsWith('/token-response') || pathname.endsWith('/_token-response')) {
      if (pathname.endsWith('/token-response')) {
        return {
          status: 'COMPLETED',
          access_token: 'demo-access-token-001',
          token_type: 'Bearer',
          scope: String((job?.payload as Record<string, unknown> | undefined)?.scope || `organization/Composition.rs?subject=did:web:demo:individual:001&section=${buildLoincToken('48765-2')}`).trim(),
          expires_in: 3600,
          demo: true,
          thid,
        };
      }
      return { status: 'COMPLETED', id_token: 'demo-id-token-001', demo: true, thid };
    }

    if (pathname.endsWith('/_code-response')) return { status: 'COMPLETED', code: 'demo-pkce-code-001', demo: true, thid };
    if (pathname.endsWith('/_dcr-response')) return { status: 'COMPLETED', client_id: 'did:web:demo-device.example.com', demo: true, thid };
    if (pathname.endsWith('/_exchange-response')) {
      return { status: 'COMPLETED', access_token: 'demo-access-token-001', token_type: 'Bearer', scope: 'organization/Composition.rs', expires_in: 3600, demo: true, thid };
    }
    if (pathname.endsWith('/_activate-response')) {
      const data = [{ response: { status: 201 }, resource: { resourceType: 'Organization', id: 'demo-org-001' } }];
      return { status: 'COMPLETED', body: { body: { data }, data, demo: true, thid } };
    }
    if (pathname.endsWith('/_batch-response')) {
      const fallbackKind = pathname.includes('/Order/_batch-response')
        ? 'order-batch'
        : pathname.includes('/Consent/_batch-response')
          ? 'consent-batch'
          : pathname.includes('/Composition/_batch-response')
            ? 'composition-batch'
            : pathname.includes('/Organization/_batch-response')
              ? 'organization-batch'
              : undefined;
      const effectiveKind = job?.kind || fallbackKind;
      if (effectiveKind === 'organization-batch' || effectiveKind === 'individual-organization-batch') {
        const data: any[] = [{ response: { status: 201 }, resource: { resourceType: 'Organization', id: 'demo-org-001' } }];
        const claims = { 'org.schema.Offer.identifier': 'demo-offer-001', 'org.schema.FamilyRegistration.status': 'already_exists' };
        data[0].resource.meta = { claims };
        data[0].meta = { claims };
        return { status: 'COMPLETED', body: { body: { data }, data, demo: true, thid } };
      }
      if (effectiveKind === 'order-batch') {
        const data = [{ response: { status: 201 }, resource: { resourceType: 'Order', id: 'demo-order-001' } }];
        return { status: 'COMPLETED', body: { body: { data }, data, demo: true, thid } };
      }
      if (effectiveKind === 'consent-batch') {
        const data = [{ response: { status: 201 }, resource: { resourceType: 'Consent', id: 'demo-consent-001' } }];
        return { status: 'COMPLETED', body: { body: { data }, data, demo: true, thid } };
      }
      if (effectiveKind === 'composition-batch') {
        const data = [{ response: { status: 201 }, resource: { resourceType: 'Composition', id: 'demo-composition-001' } }];
        return { status: 'COMPLETED', body: { body: { data }, data, demo: true, thid } };
      }
    }

    return { status: 'COMPLETED', body: { demo: true, thid } };
  }

  private async doPost(path: string, payload: unknown, contentType: string): Promise<Response> {
    const url = /^https?:\/\//.test(path)
      ? path
      : `${this.options.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      ...this.options.defaultHeaders,
      'Content-Type': contentType,
      Accept: 'application/json, application/didcomm-plaintext+json, application/x-www-form-urlencoded, */*',
    };
    if (this.options.bearerToken) headers.Authorization = `Bearer ${this.options.bearerToken}`;
    return this.fetchWithPolicy(url, { method: 'POST', headers, body: JSON.stringify(payload) }, payload);
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    if (!raw) return {};
    if (contentType.includes('application/json') || contentType.includes('application/didcomm-plaintext+json')) {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw;
  }
}
