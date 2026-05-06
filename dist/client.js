import { createHash, randomUUID } from 'node:crypto';
import { createDidcommPlainMessage } from './builders.js';
import { buildConsentClaimsSimpleWithCid } from 'gdc-common-utils-ts/utils/consent';
import { generateServiceId } from 'gdc-common-utils-ts/utils/did';
import { submitDidcomm } from 'gdc-common-utils-ts/utils/didcomm-submit';
import { ClaimsOfferSchemaorg, ClaimsPersonSchemaorg } from 'gdc-common-utils-ts/constants/schemaorg';
import { MedicationStatementClaimsFhirApi, MedicationStatementClaimsFhirApiExtended, } from 'gdc-common-utils-ts/models/interoperable-claims/medication-statement-claims';
function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}
function encode(value) {
    return encodeURIComponent(value);
}
function toDidWebFromUrlOrHost(raw) {
    const v = String(raw || '').trim();
    if (!v)
        return undefined;
    if (v.startsWith('did:web:'))
        return v;
    const host = v
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .trim()
        .toLowerCase();
    if (!host)
        return undefined;
    return `did:web:${host}`;
}
function parseRetryAfterMs(header) {
    if (!header)
        return undefined;
    const raw = header.trim();
    if (!raw)
        return undefined;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.floor(seconds * 1000);
    }
    const epochMs = Date.parse(raw);
    if (Number.isFinite(epochMs)) {
        const delta = epochMs - Date.now();
        return delta > 0 ? delta : 0;
    }
    return undefined;
}
export class DataspaceNodeClient {
    baseUrl;
    bearerToken;
    defaultHeaders;
    wallet;
    defaultCtx;
    defaultTimeoutMs;
    defaultIntervalMs;
    _tokenCache = new Map();
    constructor(options) {
        this.baseUrl = trimTrailingSlash(options.baseUrl);
        this.bearerToken = options.bearerToken;
        this.defaultHeaders = options.defaultHeaders ?? {};
        this.wallet = options.wallet;
        this.defaultCtx = options.ctx;
    }
    getWallet() {
        return this.wallet;
    }
    /**
     * Set default route context for subsequent calls.
     */
    setContext(ctx) {
        this.defaultCtx = { ...ctx };
        return this;
    }
    /**
     * Preferred alias for organization/tenant integration context.
     */
    setContextOrg(ctx) {
        return this.setContext(ctx);
    }
    setTenantId(tenantId) {
        const current = this.defaultCtx ?? { tenantId: '', jurisdiction: '', sector: '' };
        this.defaultCtx = { ...current, tenantId };
        return this;
    }
    setJurisdiction(jurisdiction) {
        const current = this.defaultCtx ?? { tenantId: '', jurisdiction: '', sector: '' };
        this.defaultCtx = { ...current, jurisdiction };
        return this;
    }
    setSector(sector) {
        const current = this.defaultCtx ?? { tenantId: '', jurisdiction: '', sector: '' };
        this.defaultCtx = { ...current, sector };
        return this;
    }
    setDefaultTimeoutSeconds(seconds) {
        if (Number.isFinite(Number(seconds))) {
            this.defaultTimeoutMs = Math.max(1, Math.floor(Number(seconds) * 1000));
        }
        return this;
    }
    setDefaultIntervalSeconds(seconds) {
        if (Number.isFinite(Number(seconds))) {
            this.defaultIntervalMs = Math.max(1, Math.floor(Number(seconds) * 1000));
        }
        return this;
    }
    /**
     * Builds a deterministic endpoint id for token cache and auth/session reuse.
     * If `providerDid` is provided, returns a full DID service id:
     *   did:web:...#section:format:resourceType:action
     * Otherwise returns the canonical fragment without '#':
     *   section:format:resourceType:action
     */
    getEndpointId(selector, providerDid) {
        const fragment = generateServiceId(selector); // #section:format:resourceType:action
        if (providerDid)
            return `${providerDid}${fragment}`;
        return fragment.replace(/^#/, '');
    }
    resolveSimplePollOptions(timeoutSeconds, intervalSeconds) {
        const pollOptions = {};
        if (Number.isFinite(Number(timeoutSeconds))) {
            pollOptions.timeoutMs = Math.max(1, Math.floor(Number(timeoutSeconds) * 1000));
        }
        else if (this.defaultTimeoutMs) {
            pollOptions.timeoutMs = this.defaultTimeoutMs;
        }
        if (Number.isFinite(Number(intervalSeconds))) {
            pollOptions.intervalMs = Math.max(1, Math.floor(Number(intervalSeconds) * 1000));
        }
        else if (this.defaultIntervalMs) {
            pollOptions.intervalMs = this.defaultIntervalMs;
        }
        return Object.keys(pollOptions).length ? pollOptions : undefined;
    }
    requireRouteContext(ctx) {
        const resolved = ctx ?? this.defaultCtx;
        const tenantId = String(resolved?.tenantId || '').trim();
        const jurisdiction = String(resolved?.jurisdiction || '').trim();
        const sector = String(resolved?.sector || '').trim();
        if (!tenantId || !jurisdiction || !sector) {
            throw new Error('Route context is required. Provide `ctx` in method call or constructor options.');
        }
        return { tenantId, jurisdiction, sector };
    }
    requireHostRouteContext(ctx) {
        const jurisdiction = String(ctx?.jurisdiction || this.defaultCtx?.jurisdiction || '').trim();
        const sector = String(ctx?.sector || this.defaultCtx?.sector || '').trim();
        if (jurisdiction && sector) {
            return { jurisdiction, sector };
        }
        throw new Error('Host route context is required. Provide `ctx` in method call or constructor options.ctx.');
    }
    // ---- Path helpers -------------------------------------------------------
    /**
     * Generic GW v1 tenant route builder.
     * Use this for any section/format/resourceType/action combination not covered
     * by a dedicated convenience method.
     *
     * Pattern: `/{tenantId}/cds-{jurisdiction}/v1/{sector}/{section}/{format}/{resourceType}/{action}`
     *
     * @example
     * client.v1Path(ctx, 'individual', 'org.schema', 'Organization', '_batch')
     * // → /acme/cds-ES/v1/health-care/individual/org.schema/Organization/_batch
     */
    v1Path(ctx, section, format, resourceType, action) {
        const routeCtx = this.requireRouteContext(ctx);
        return `/${encode(routeCtx.tenantId)}/cds-${encode(routeCtx.jurisdiction)}/v1/${encode(routeCtx.sector)}/${encode(section)}/${encode(format)}/${encode(resourceType)}/${encode(action)}`;
    }
    /**
     * Generic tenant-scoped identity route builder.
     * Pattern: `/{prefix}/cds-{jurisdiction}/v1/{sector}/{tenantId}/identity/auth/{action}`
     *
     * The `prefix` is service-specific: `host` for GW, `publisher` for DataConv, `ica` for ICA.
     * Dedicated path methods in this SDK use `host` (GW convention).
     */
    tenantIdentityPath(ctx, prefix, action) {
        const routeCtx = this.requireRouteContext(ctx);
        return `/${encode(prefix)}/cds-${encode(routeCtx.jurisdiction)}/v1/${encode(routeCtx.sector)}/${encode(routeCtx.tenantId)}/identity/auth/${encode(action)}`;
    }
    /**
     * Generic host registry route builder (tenant-agnostic, `host/` prefix).
     * Use for controller-level registry operations (Organization activate, Order, etc.).
     *
     * Pattern: `/host/cds-{jurisdiction}/v1/{sector}/registry/org.schema/{resourceType}/{action}`
     */
    hostRegistryPath(ctx, resourceType, action) {
        const hostCtx = this.requireHostRouteContext(ctx);
        return `/host/cds-${encode(hostCtx.jurisdiction)}/v1/${encode(hostCtx.sector)}/registry/org.schema/${encode(resourceType)}/${encode(action)}`;
    }
    /** Submit path: host registry Organization batch (controller-level org registration). */
    hostRegistryOrganizationBatchPath(ctx) {
        return this.hostRegistryPath(ctx, 'Organization', '_batch');
    }
    /** Poll path: host registry Organization batch. Pair with `hostRegistryOrganizationBatchPath`. */
    hostRegistryOrganizationPollPath(ctx) {
        return this.hostRegistryPath(ctx, 'Organization', '_batch-response');
    }
    /** Submit path: activate a tenant Organization in the GW registry using a VC from ICA. */
    hostRegistryOrganizationActivatePath(ctx) {
        return this.hostRegistryPath(ctx, 'Organization', '_activate');
    }
    /** Poll path: `_activate` response. Pair with `hostRegistryOrganizationActivatePath`. */
    hostRegistryOrganizationActivatePollPath(ctx) {
        return this.hostRegistryPath(ctx, 'Organization', '_activate-response');
    }
    /** Submit path: host registry Order batch (controller-level order submission). */
    hostRegistryOrderBatchPath(ctx) {
        return this.hostRegistryPath(ctx, 'Order', '_batch');
    }
    /** Poll path: host registry Order batch. Pair with `hostRegistryOrderBatchPath`. */
    hostRegistryOrderPollPath(ctx) {
        return this.hostRegistryPath(ctx, 'Order', '_batch-response');
    }
    /**
     * Submit path: individual/family Organization onboarding (`org.schema/Organization/_batch`).
     * Use for `family-registration/_create-or-resume` DIDComm payloads.
     */
    individualFamilyOrganizationBatchPath(ctx) {
        const routeCtx = this.requireRouteContext(ctx);
        return `/${encode(routeCtx.tenantId)}/cds-${encode(routeCtx.jurisdiction)}/v1/${encode(routeCtx.sector)}/individual/org.schema/Organization/_batch`;
    }
    /** Poll path: individual/family Organization. Pair with `individualFamilyOrganizationBatchPath`. */
    individualFamilyOrganizationPollPath(ctx) {
        const routeCtx = this.requireRouteContext(ctx);
        return `/${encode(routeCtx.tenantId)}/cds-${encode(routeCtx.jurisdiction)}/v1/${encode(routeCtx.sector)}/individual/org.schema/Organization/_batch-response`;
    }
    /** Submit path: individual/family Organization search (`org.schema/Organization/_search`). */
    individualFamilyOrganizationSearchPath(ctx) {
        return this.v1Path(ctx, 'individual', 'org.schema', 'Organization', '_search');
    }
    /** Poll path: individual/family Organization search. Pair with `individualFamilyOrganizationSearchPath`. */
    individualFamilyOrganizationSearchPollPath(ctx) {
        return this.v1Path(ctx, 'individual', 'org.schema', 'Organization', '_search-response');
    }
    /** Submit path: individual/family Order batch (`org.schema/Order/_batch`). */
    individualFamilyOrderBatchPath(ctx) {
        const routeCtx = this.requireRouteContext(ctx);
        return `/${encode(routeCtx.tenantId)}/cds-${encode(routeCtx.jurisdiction)}/v1/${encode(routeCtx.sector)}/individual/org.schema/Order/_batch`;
    }
    /** Poll path: individual/family Order. Pair with `individualFamilyOrderBatchPath`. */
    individualFamilyOrderPollPath(ctx) {
        const routeCtx = this.requireRouteContext(ctx);
        return `/${encode(routeCtx.tenantId)}/cds-${encode(routeCtx.jurisdiction)}/v1/${encode(routeCtx.sector)}/individual/org.schema/Order/_batch-response`;
    }
    /** Submit path: individual RelatedPerson (FHIR R4 API, `org.hl7.fhir.api/RelatedPerson/_batch`). */
    individualRelatedPersonBatchPath(ctx) {
        return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.api/RelatedPerson/_batch`;
    }
    /** Poll path: individual RelatedPerson. Pair with `individualRelatedPersonBatchPath`. */
    individualRelatedPersonPollPath(ctx) {
        return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.api/RelatedPerson/_batch-response`;
    }
    /** Submit path: individual Observation (FHIR R4 API, `org.hl7.fhir.api/Observation/_batch`). */
    individualObservationBatchPath(ctx) {
        return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.api/Observation/_batch`;
    }
    /** Poll path: individual Observation. Pair with `individualObservationBatchPath`. */
    individualObservationPollPath(ctx) {
        return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.api/Observation/_batch-response`;
    }
    /** Submit path: individual Communication (FHIR R4, `org.hl7.fhir.r4/Communication/_batch`). */
    individualCommunicationBatchPath(ctx) {
        return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.r4/Communication/_batch`;
    }
    /** Poll path: individual Communication. Pair with `individualCommunicationBatchPath`. */
    individualCommunicationPollPath(ctx) {
        return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.r4/Communication/_batch-response`;
    }
    /** Submit path: individual Task (FHIR R4 API, `org.hl7.fhir.api/Task/_batch`). */
    individualTaskBatchPath(ctx) {
        return this.v1Path(ctx, 'individual', 'org.hl7.fhir.api', 'Task', '_batch');
    }
    /** Poll path: individual Task. Pair with `individualTaskBatchPath`. */
    individualTaskPollPath(ctx) {
        return this.v1Path(ctx, 'individual', 'org.hl7.fhir.api', 'Task', '_batch-response');
    }
    /** Submit path: entity Employee (`entity/org.schema/Employee/_batch`). */
    employeeBatchPath(ctx) {
        return this.v1Path(ctx, 'entity', 'org.schema', 'Employee', '_batch');
    }
    /** Poll path: entity Employee. Pair with `employeeBatchPath`. */
    employeePollPath(ctx) {
        return this.v1Path(ctx, 'entity', 'org.schema', 'Employee', '_batch-response');
    }
    /** Submit path: individual Person legacy format (`individual/org.schema/Person/_batch`). Use for older flows; prefer Organization for family onboarding. */
    individualLegacyPersonBatchPath(ctx) {
        return this.v1Path(ctx, 'individual', 'org.schema', 'Person', '_batch');
    }
    /** Submit path: individual Consent (FHIR R4, `org.hl7.fhir.r4/Consent/_batch`). */
    individualConsentR4BatchPath(ctx) {
        return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Consent', '_batch');
    }
    /** Poll path: individual Consent R4. Pair with `individualConsentR4BatchPath`. */
    individualConsentR4PollPath(ctx) {
        return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Consent', '_batch-response');
    }
    /** Submit path: individual Composition (FHIR R4, `org.hl7.fhir.r4/Composition/_batch`). */
    individualCompositionR4BatchPath(ctx) {
        return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Composition', '_batch');
    }
    /** Poll path: individual Composition R4. Pair with `individualCompositionR4BatchPath`. */
    individualCompositionR4PollPath(ctx) {
        return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Composition', '_batch-response');
    }
    /** Submit path: digital twin Composition (FHIR API format, `digitaltwin/org.hl7.fhir.api/Composition/_batch`). */
    digitalTwinCompositionApiBatchPath(ctx) {
        return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.api', 'Composition', '_batch');
    }
    /** Poll path: digital twin Composition API. Pair with `digitalTwinCompositionApiBatchPath`. */
    digitalTwinCompositionApiPollPath(ctx) {
        return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.api', 'Composition', '_batch-response');
    }
    /** Submit path: digital twin Composition (FHIR R4 format, `digitaltwin/org.hl7.fhir.r4/Composition/_batch`). */
    digitalTwinCompositionR4BatchPath(ctx) {
        return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.r4', 'Composition', '_batch');
    }
    /** Poll path: digital twin Composition R4. Pair with `digitalTwinCompositionR4BatchPath`. */
    digitalTwinCompositionR4PollPath(ctx) {
        return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.r4', 'Composition', '_batch-response');
    }
    /**
     * Submit path: identity DCR step — binds API key to service public JWK.
     * Used internally by `authenticateBackendPkceAndExchange` (step 1 of identity-exchange.v1).
     */
    identityDeviceDcrPath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_dcr');
    }
    /** Poll path: identity DCR. Pair with `identityDeviceDcrPath`. */
    identityDeviceDcrPollPath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_dcr-response');
    }
    /**
     * Submit path: identity token exchange — id_token → SMART bearer.
     * Used internally by `authenticateBackendPkceAndExchange` (step 4 of identity-exchange.v1).
     */
    identityTokenExchangePath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_exchange');
    }
    /** Poll path: identity token exchange. Pair with `identityTokenExchangePath`. */
    identityTokenExchangePollPath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_exchange-response');
    }
    /** Submit path: identity license issue (`identity/auth/_issue`). */
    identityLicenseIssuePath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_issue');
    }
    /**
     * Submit path: SMART token step — code + code_verifier → id_token.
     * Used internally by `authenticateBackendPkceAndExchange` (step 3 of identity-exchange.v1).
     */
    identitySmartTokenPath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_token');
    }
    /** Poll path: SMART token. Pair with `identitySmartTokenPath`. */
    identitySmartTokenPollPath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_token-response');
    }
    /** Submit path: Firebase custom token exchange (end-user device flow, NOT B2B). */
    identityFirebaseCustomPath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_custom');
    }
    /** Poll path: Firebase custom token. Pair with `identityFirebaseCustomPath`. */
    identityFirebaseCustomPollPath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_custom-response');
    }
    /**
     * Submit path: identity PKCE code step — sends S256 code_challenge.
     * Used internally by `authenticateBackendPkceAndExchange` (step 2 of identity-exchange.v1).
     */
    identityCodePath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_code');
    }
    /** Poll path: identity PKCE code. Pair with `identityCodePath`. */
    identityCodePollPath(ctx) {
        return this.tenantIdentityPath(ctx, 'host', '_code-response');
    }
    /** Submit path: UHC debug task call-start (`individual/{format}/Task/_call-start`). For telephony integration testing. */
    taskDebugCallStartPath(ctx, format = 'org.hl7.fhir.api') {
        return this.v1Path(ctx, 'individual', format, 'Task', '_call-start');
    }
    /** Path: UHC debug task logs (`individual/{format}/Task/_logs`). Retrieve async task execution logs. */
    taskDebugLogsPath(ctx, format = 'org.hl7.fhir.api') {
        return this.v1Path(ctx, 'individual', format, 'Task', '_logs');
    }
    /**
     * Submit path: DataConversion file upload.
     * Pattern: `/{tenantId}/cds-{jurisdiction}/v1/{sector}/conversion/{softwareId}/{sourceFormat}/_upload`
     * Use with `uploadConversionFile` to send a file (e.g. XLSX) for async processing.
     */
    conversionUploadPath(ctx, softwareId, sourceFormat) {
        return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/conversion/${encode(softwareId)}/${encode(sourceFormat)}/_upload`;
    }
    /** Poll path: DataConversion upload. Pair with `conversionUploadPath`. */
    conversionUploadPollPath(ctx, softwareId, sourceFormat) {
        return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/conversion/${encode(softwareId)}/${encode(sourceFormat)}/_upload-response`;
    }
    // ---- Backend PKCE auth (identity-exchange.v1) -------------------------
    /**
     * Orchestrates the full identity-exchange.v1 backend auth flow:
     * DCR binding → PKCE code → token → SMART bearer exchange.
     *
     * Equivalent to Python connector_sdk `authenticate_backend_pkce_and_exchange`.
     * Results are cached in memory; re-runs automatically on expiry.
     */
    async authenticateBackendPkceAndExchange(options) {
        const { ctx, apiKey, scopes, tokenCacheKey = `pkce:${apiKey.slice(0, 8)}`, endpointId, codeVerifier = randomUUID(), pollOptions, } = options;
        const cacheKey = String(tokenCacheKey || endpointId || '').trim() || `pkce:${apiKey.slice(0, 8)}`;
        const cached = this._tokenCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now() + 30_000) {
            return { status: 'cached', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: cached.accessToken, tokenType: cached.tokenType, scopes: cached.scopes };
        }
        const controllerPublicJwk = await this.resolveControllerPublicJwk(options);
        // Step 1: DCR – bind API key to service public key
        const dcrPayload = this._buildAuthDIDCommRequest({
            thid: `dcr-${randomUUID()}`,
            clientId: apiKey,
            body: {},
            controllerPublicJwk,
        });
        await this.submitBatch(this.identityDeviceDcrPath(ctx), dcrPayload);
        const dcrPoll = await this.pollUntilComplete(this.identityDeviceDcrPollPath(ctx), { thid: String(dcrPayload['thid']) }, pollOptions);
        if (dcrPoll.status !== 200) {
            return { status: 'failed', step: '_dcr', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: '', tokenType: 'Bearer', scopes };
        }
        // Step 2: Code – PKCE S256 challenge
        const codeChallenge = this._pkceS256Challenge(codeVerifier);
        const codePayload = this._buildAuthDIDCommRequest({
            thid: `code-${randomUUID()}`,
            clientId: apiKey,
            body: {},
            controllerPublicJwk,
            extra: { code_challenge: codeChallenge, code_challenge_method: 'S256' },
        });
        await this.submitBatch(this.identityCodePath(ctx), codePayload);
        const codePoll = await this.pollUntilComplete(this.identityCodePollPath(ctx), { thid: String(codePayload['thid']) }, pollOptions);
        const codeBody = codePoll.body ?? {};
        const code = String(codeBody['code'] ?? '').trim();
        if (codePoll.status !== 200 || !code) {
            return { status: 'failed', step: '_code', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: '', tokenType: 'Bearer', scopes };
        }
        // Step 3: Token – exchange code + verifier for id_token
        const tokenPayload = this._buildAuthDIDCommRequest({
            thid: `token-${randomUUID()}`,
            clientId: apiKey,
            body: {},
            controllerPublicJwk,
            extra: { code, code_verifier: codeVerifier },
        });
        await this.submitBatch(this.identitySmartTokenPath(ctx), tokenPayload);
        const tokenPoll = await this.pollUntilComplete(this.identitySmartTokenPollPath(ctx), { thid: String(tokenPayload['thid']) }, pollOptions);
        const tokenBody = tokenPoll.body ?? {};
        const idToken = String(tokenBody['id_token'] ?? '').trim();
        if (tokenPoll.status !== 200 || !idToken) {
            return { status: 'failed', step: '_token', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: '', tokenType: 'Bearer', scopes };
        }
        // Step 4: Exchange – id_token → SMART bearer
        const exchangeThid = `exchange-${randomUUID()}`;
        const exchangePayload = {
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
            subject_token: idToken,
            scope: scopes.join(' '),
            api_key: apiKey,
            organization: ctx.tenantId,
            thid: exchangeThid,
        };
        await this.submitBatch(this.identityTokenExchangePath(ctx), exchangePayload);
        const exchangePoll = await this.pollUntilComplete(this.identityTokenExchangePollPath(ctx), { thid: exchangeThid }, pollOptions);
        const exchangeBody = exchangePoll.body ?? {};
        const accessToken = String(exchangeBody['access_token'] ?? '').trim();
        if (exchangePoll.status !== 200 || !accessToken) {
            return { status: 'failed', step: '_exchange', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken: '', tokenType: 'Bearer', scopes };
        }
        const tokenType = String(exchangeBody['token_type'] ?? 'Bearer');
        const grantedScope = String(exchangeBody['scope'] ?? '').trim();
        const grantedScopes = grantedScope ? grantedScope.split(' ').filter(Boolean) : scopes;
        const expiresIn = Number(exchangeBody['expires_in'] ?? 0);
        this._tokenCache.set(cacheKey, {
            accessToken,
            tokenType,
            scopes: grantedScopes,
            expiresAt: Date.now() + expiresIn * 1000,
        });
        return { status: 'fetched', tokenCacheKey: cacheKey, endpointId: cacheKey, accessToken, tokenType, scopes: grantedScopes };
    }
    /**
     * Returns the cached SMART bearer for the given endpointId if still valid (>30s remaining).
     * Returns `undefined` if not cached or expired.
     */
    getCachedBearerToken(tokenCacheKey) {
        const cached = this._tokenCache.get(tokenCacheKey);
        if (cached && cached.expiresAt > Date.now() + 30_000) {
            return cached.accessToken;
        }
        return undefined;
    }
    /**
     * smart-backend.v1: obtain an OAuth2 backend token using client_credentials + private_key_jwt.
     */
    async authenticateBackendSmartStandard(options) {
        const { clientId, scopes, tokenCacheKey = `smart-backend:${clientId}`, endpointId, tokenUrl, tokenPath = '/token', audience, assertionTtlSeconds = 300, additionalTokenFields, } = options;
        const cacheKey = String(tokenCacheKey || endpointId || '').trim() || `smart-backend:${clientId}`;
        const cached = this._tokenCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now() + 30_000) {
            return {
                status: 'cached',
                profile: 'smart-backend.v1',
                tokenCacheKey: cacheKey,
                endpointId: cacheKey,
                accessToken: cached.accessToken,
                tokenType: cached.tokenType,
                scopes: cached.scopes,
                expiresAt: new Date(cached.expiresAt).toISOString(),
            };
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
        const tokenRequest = {
            grant_type: 'client_credentials',
            client_id: clientId,
            scope: scopes.join(' '),
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: clientAssertion,
            ...(additionalTokenFields ?? {}),
        };
        const response = await this.postJson(tokenUrl ?? tokenPath, tokenRequest);
        const body = response.body ?? {};
        const accessToken = String(body.access_token ?? '').trim();
        if (response.status >= 400 || !accessToken) {
            return {
                status: 'failed',
                profile: 'smart-backend.v1',
                tokenCacheKey: cacheKey,
                endpointId: cacheKey,
                statusCode: response.status,
                response,
            };
        }
        const tokenType = String(body.token_type ?? 'Bearer');
        const grantedScope = String(body.scope ?? '').trim();
        const grantedScopes = grantedScope ? grantedScope.split(' ').filter(Boolean) : scopes;
        const expiresIn = Number(body.expires_in ?? 0);
        const expiresAt = Date.now() + expiresIn * 1000;
        this._tokenCache.set(cacheKey, {
            accessToken,
            tokenType,
            scopes: grantedScopes,
            expiresAt,
        });
        return {
            status: 'fetched',
            profile: 'smart-backend.v1',
            tokenCacheKey: cacheKey,
            endpointId: cacheKey,
            statusCode: response.status,
            accessToken,
            tokenType,
            scopes: grantedScopes,
            expiresAt: new Date(expiresAt).toISOString(),
            response,
        };
    }
    /**
     * Exchange token payload against gateway token endpoint and cache the result.
     */
    async requestSmartToken(input) {
        const tokenCacheKey = String(input.tokenCacheKey || input.endpointId || '').trim();
        if (!tokenCacheKey) {
            throw new Error('requestSmartToken requires tokenCacheKey.');
        }
        const normalizedScopes = Array.from(new Set((input.scopes || []).filter(Boolean))).sort();
        const cached = this._tokenCache.get(tokenCacheKey);
        if (cached && cached.expiresAt > Date.now() + 30_000) {
            return {
                status: 'cached',
                accessToken: cached.accessToken,
                tokenType: cached.tokenType,
                scopes: cached.scopes,
            };
        }
        const response = await this.postJson(input.path || '/token', input.exchangePayload || {});
        const body = response.body ?? {};
        const accessToken = String(body.access_token ?? '').trim();
        if (response.status >= 400 || !accessToken) {
            return {
                status: 'failed',
                statusCode: response.status,
                response,
            };
        }
        const tokenType = String(body.token_type ?? 'Bearer');
        const grantedScopes = Array.isArray(body.granted_scopes)
            ? body.granted_scopes
            : String(body.scope ?? '').trim().split(' ').filter(Boolean);
        const resolvedScopes = grantedScopes.length ? grantedScopes : normalizedScopes;
        const expiresIn = Number(body.expires_in ?? 0);
        this._tokenCache.set(tokenCacheKey, {
            accessToken,
            tokenType,
            scopes: resolvedScopes,
            expiresAt: Date.now() + expiresIn * 1000,
        });
        return {
            status: 'fetched',
            accessToken,
            tokenType,
            scopes: resolvedScopes,
            statusCode: response.status,
            response,
        };
    }
    /**
     * Friendly wrapper for SMART token request via GW identity/auth token-exchange route.
     * Uses one object, seconds-based polling, and constructor ctx fallback.
     */
    async requestSmartTokenSimple(input) {
        const routeCtx = this.requireRouteContext(input.tenantId && input.jurisdiction && input.sector
            ? { tenantId: input.tenantId, jurisdiction: input.jurisdiction, sector: input.sector }
            : undefined);
        const normalizedScopes = Array.from(new Set((input.scopes || []).filter(Boolean))).sort();
        const tokenCacheKey = String(input.tokenCacheKey || input.endpointId || `smart:${routeCtx.tenantId}:${normalizedScopes.join(',')}`).trim();
        if (!tokenCacheKey) {
            throw new Error('requestSmartTokenSimple requires tokenCacheKey (or non-empty scopes).');
        }
        const pollOptions = this.resolveSimplePollOptions(input.timeoutSeconds, input.intervalSeconds);
        const payload = {
            thid: `exchange-${randomUUID()}`,
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
            subject_token: input.idToken,
            scope: normalizedScopes.join(' '),
            organization: routeCtx.tenantId,
            ...(input.additionalClaims || {}),
        };
        const exchange = await this.submitAndPoll(this.identityTokenExchangePath(routeCtx), this.identityTokenExchangePollPath(routeCtx), payload, pollOptions);
        const exchangeBody = exchange.poll.body ?? {};
        const accessToken = String(exchangeBody.access_token || '').trim();
        if (exchange.poll.status >= 400 || !accessToken) {
            return {
                status: 'failed',
                statusCode: exchange.poll.status,
                response: exchange.poll.body,
            };
        }
        const tokenType = String(exchangeBody.token_type || 'Bearer');
        const grantedScopes = String(exchangeBody.scope || '').trim().split(' ').filter(Boolean);
        const resolvedScopes = grantedScopes.length ? grantedScopes : normalizedScopes;
        const expiresIn = Number(exchangeBody.expires_in ?? 0);
        this._tokenCache.set(tokenCacheKey, {
            accessToken,
            tokenType,
            scopes: resolvedScopes,
            expiresAt: Date.now() + expiresIn * 1000,
        });
        return {
            status: 'fetched',
            accessToken,
            tokenType,
            scopes: resolvedScopes,
            statusCode: exchange.poll.status,
            response: exchange.poll.body,
        };
    }
    // ---- Private auth helpers ----------------------------------------------
    _pkceS256Challenge(verifier) {
        return createHash('sha256').update(verifier).digest().toString('base64url');
    }
    _buildAuthDIDCommRequest(params) {
        const now = Math.floor(Date.now() / 1000);
        return {
            thid: params.thid,
            type: 'application/bundle-api+json',
            iat: now,
            exp: now + 300,
            client_id: params.clientId,
            body: params.body,
            meta: {
                jws: {
                    protected: {
                        alg: 'ES384',
                        jwk: params.controllerPublicJwk,
                    },
                },
            },
            ...(params.extra ?? {}),
        };
    }
    async resolveControllerPublicJwk(options) {
        if (options.controllerPublicJwk) {
            return options.controllerPublicJwk;
        }
        if (!this.wallet) {
            throw new Error('authenticateBackendPkceAndExchange requires controllerPublicJwk or a configured wallet provider.');
        }
        const walletContext = options.walletContext ?? {
            tenantId: options.ctx.tenantId,
            jurisdiction: options.ctx.jurisdiction,
            sector: options.ctx.sector,
        };
        const publicJwks = await this.wallet.getPublicJwks(walletContext);
        const controllerPublicJwk = publicJwks.find((jwk) => jwk.use === 'sig' || jwk.alg === 'ES384') ?? publicJwks[0];
        if (!controllerPublicJwk) {
            throw new Error('Wallet provider returned no public JWKs for the requested context.');
        }
        return controllerPublicJwk;
    }
    resolveStandardTokenUrl(tokenUrl, tokenPath) {
        if (tokenUrl && tokenUrl.trim()) {
            return tokenUrl.trim();
        }
        return `${this.baseUrl}${tokenPath.startsWith('/') ? tokenPath : `/${tokenPath}`}`;
    }
    async resolveSmartAuthPublicJwk(options) {
        if (options.publicJwk) {
            return options.publicJwk;
        }
        if (!this.wallet) {
            throw new Error('authenticateBackendSmartStandard requires publicJwk or a configured wallet provider.');
        }
        const walletContext = options.walletContext ?? {
            tenantId: options.clientId,
            jurisdiction: 'global',
            sector: 'backend',
        };
        const publicJwks = await this.wallet.getPublicJwks(walletContext);
        const signingJwk = publicJwks.find((jwk) => jwk.use === 'sig' || jwk.alg === 'ES384') ?? publicJwks[0];
        if (!signingJwk) {
            throw new Error('Wallet provider returned no public JWKs for smart-backend.v1.');
        }
        return signingJwk;
    }
    async signSmartBackendClientAssertion(params) {
        if (!this.wallet) {
            throw new Error('smart-backend.v1 signing requires a configured wallet provider.');
        }
        const now = Math.floor(Date.now() / 1000);
        const walletContext = params.walletContext ?? {
            tenantId: params.clientId,
            jurisdiction: 'global',
            sector: 'backend',
        };
        const kid = String(params.publicJwk.kid ?? '').trim();
        return this.wallet.signCompactJws(walletContext, {
            header: {
                typ: 'JWT',
                alg: this.preferredJwtAlg(params.publicJwk),
                ...(kid ? { kid } : {}),
            },
            claims: {
                iss: params.clientId,
                sub: params.clientId,
                aud: params.audience,
                iat: now,
                exp: now + Math.max(params.ttlSeconds, 1),
                jti: `jwt-${randomUUID()}`,
            },
        });
    }
    preferredJwtAlg(publicJwk) {
        const jwk = publicJwk;
        const alg = String(jwk.alg ?? '').trim();
        if (alg) {
            return alg;
        }
        const kty = String(jwk.kty ?? '').toUpperCase();
        const crv = String(jwk.crv ?? '').toUpperCase();
        if (kty === 'EC' && crv === 'P-256') {
            return 'ES256';
        }
        if (kty === 'EC' && crv === 'P-384') {
            return 'ES384';
        }
        if (kty === 'RSA') {
            return 'RS384';
        }
        return 'ES384';
    }
    // ---- Generic batch API --------------------------------------------------
    /**
     * POST a DIDComm bundle payload.
     * This is the preferred high-level method for DIDComm submission of
     * FHIR/API bundles (batch, transaction, message, etc.).
     *
     * Returns immediately with the HTTP response — pair with `pollUntilComplete` or use `submitAndPoll`.
     */
    async submitBundle(path, payload, options) {
        const mode = options?.mode ?? 'plain';
        if (mode === 'strict') {
            if (!options?.recipientEncryptionJwk || !options?.walletContext) {
                throw new Error('submitBundle strict mode requires recipientEncryptionJwk and walletContext.');
            }
            return this.submitBatchEncrypted(path, payload, options.recipientEncryptionJwk, options.walletContext);
        }
        return this.submitBatch(path, payload);
    }
    /**
     * @deprecated Use `submitBundle` instead.
     *
     * POST a DIDComm plaintext payload to a batch submit path.
     * Use this for all `_batch` routes (family registration, observations, tasks, etc.).
     * Content-Type: `application/didcomm-plaintext+json`.
     *
     * Returns immediately with the HTTP response — pair with `pollUntilComplete` or use `submitAndPoll`.
     */
    async submitBatch(path, payload) {
        const url = /^https?:\/\//.test(path)
            ? path
            : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
        const result = await submitDidcomm({
            mode: 'plain',
            url,
            payload: payload,
            defaultHeaders: this.defaultHeaders,
            bearerToken: this.bearerToken,
            fetcher: (requestUrl, init) => fetch(requestUrl, init),
        });
        return { status: result.status, location: result.location, body: result.body };
    }
    /**
     * Sign and encrypt a DIDComm payload (nested JWS-in-JWE) and POST to the given path.
     * Content-Type: `application/didcomm-encrypted+json`.
     *
     * Flow: `payload JSON → ES384 compact JWS → RSA-OAEP-256/A256GCM compact JWE → POST`
     *
     * Requires a wallet provider and the recipient's RSA encryption JWK
     * (e.g. from GW `.well-known/jwks.json` where `use === 'enc'`).
     */
    async submitBatchEncrypted(path, payload, recipientEncryptionJwk, walletContext) {
        if (!this.wallet) {
            throw new Error('submitBatchEncrypted requires a configured wallet provider.');
        }
        const publicJwks = await this.wallet.getPublicJwks(walletContext);
        const signingJwk = publicJwks.find((jwk) => jwk.use === 'sig' || jwk.alg === 'ES384') ?? publicJwks[0];
        const url = /^https?:\/\//.test(path)
            ? path
            : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
        const result = await submitDidcomm({
            mode: 'strict',
            url,
            payload,
            defaultHeaders: this.defaultHeaders,
            bearerToken: this.bearerToken,
            recipientEncryptionJwk,
            signCompactJws: async (claims) => this.wallet.signCompactJws(walletContext, {
                header: {
                    typ: 'application/didcomm-signed+json',
                    alg: 'ES384',
                    ...(signingJwk?.kid ? { kid: signingJwk.kid } : {}),
                },
                claims,
            }),
            encryptCompactJwe: async (compactJws, recipientJwk) => this.wallet.buildCompactJwe(walletContext, {
                plaintext: compactJws,
                recipientJwk: recipientJwk,
                contentType: 'JWS',
            }),
            fetcher: (requestUrl, init) => fetch(requestUrl, init),
        });
        return { status: result.status, location: result.location, body: result.body };
    }
    /**
     * POST a plain JSON payload.
     * Use for non-DIDComm routes (e.g. token exchange body, API key management).
     * Content-Type: `application/json`.
     */
    async postJson(path, payload) {
        const response = await this.doPost(path, payload, 'application/json');
        const body = await this.parseResponseBody(response);
        return {
            status: response.status,
            location: response.headers.get('location') ?? undefined,
            body,
        };
    }
    /**
     * Legacy JSON submit for non-bundle payloads (openid/token/resource JSON bodies).
     * Keeps JSON flows explicit and semantically separated from DIDComm bundle flows.
     */
    async submitLegacyJson(path, payload) {
        return this.postJson(path, payload);
    }
    /**
     * POST a multipart/form-data payload.
     * Use for file upload endpoints. Prefer `uploadConversionFile` for DataConversion uploads.
     */
    async postFormData(path, formData) {
        const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
        const headers = {
            ...this.defaultHeaders,
            Accept: 'application/json, application/didcomm-plaintext+json, application/x-www-form-urlencoded, */*',
        };
        if (this.bearerToken) {
            headers.Authorization = `Bearer ${this.bearerToken}`;
        }
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
        });
        const body = await this.parseResponseBody(response);
        return {
            status: response.status,
            location: response.headers.get('location') ?? undefined,
            body,
        };
    }
    /**
     * Upload a file to a DataConversion endpoint.
     * Wraps `postFormData` with sensible defaults for file field naming and multipart encoding.
     *
     * @param params.path - Use `conversionUploadPath(ctx, softwareId, sourceFormat)`.
     * @param params.fileName - File name including extension (e.g. `data.xlsx`).
     * @param params.fileContent - File bytes (Blob, Buffer, Uint8Array, or ArrayBuffer).
     * @param params.fileFieldName - Form field name for the file. Defaults to `'file'`.
     * @param params.fields - Additional form string fields to include.
     */
    async uploadConversionFile(params) {
        const form = new FormData();
        const fileFieldName = params.fileFieldName ?? 'file';
        const content = params.fileContent instanceof Blob
            ? params.fileContent
            : new Blob([params.fileContent]);
        form.append(fileFieldName, content, params.fileName);
        for (const [key, value] of Object.entries(params.fields ?? {})) {
            form.append(key, value);
        }
        return this.postFormData(params.path, form);
    }
    /**
     * Single poll attempt against a `_batch-response` or `_*-response` path.
     * Returns HTTP 202 while the job is still processing, 200 (or other) when done.
     * Prefer `pollUntilComplete` for automatic retry loops.
     */
    async pollBatchResponse(path, request) {
        const response = await this.doPost(path, request, 'application/json');
        return {
            status: response.status,
            body: await this.parseResponseBody(response),
            retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')),
        };
    }
    /**
     * Submit a DIDComm batch payload and poll until the async job completes.
     * Convenience wrapper around `submitBatch` + `pollUntilComplete`.
     *
     * Requires `payload.thid` to be set (used as the poll correlation key).
     * Use `createDidcommPlainMessage` from `builders.ts` to build the payload with a `thid`.
     *
     * @example
     * const result = await client.submitAndPoll(
     *   client.individualFamilyOrganizationBatchPath(ctx),
     *   client.individualFamilyOrganizationPollPath(ctx),
     *   payload,
     *   { timeoutMs: 30_000, intervalMs: 2_000 },
     * );
     * // result.poll.status === 200 on success
     */
    async submitAndPoll(submitPath, pollPath, payload, options) {
        const submit = await this.submitBatch(submitPath, payload);
        const thid = String(payload.thid || '').trim();
        if (!thid) {
            throw new Error('submitAndPoll requires payload.thid.');
        }
        const poll = await this.pollUntilComplete(pollPath, { thid }, options);
        return { submit, poll };
    }
    /**
     * Create scheduled phone reminder Task entries through canonical Task `_batch` routes.
     * This high-level helper accepts business parameters and internally builds flat
     * FHIR-style claims under `resource.meta.claims`.
     *
     * `description` is the Task title.
     * `reminderSummary` is the contextual summary of what the reminder refers to
     * (appointment, medication schedule, or another event), mapped to `based-on-display`.
     */
    async createPhoneReminderTasks(ctx, input, options) {
        const routeCtx = this.requireRouteContext(ctx);
        const windows = Array.isArray(input.windows) ? input.windows : [];
        if (!windows.length) {
            throw new Error('createPhoneReminderTasks requires at least one reminder window.');
        }
        if (!input.subjectRef || !input.ownerRef || !input.focusRef) {
            throw new Error('createPhoneReminderTasks requires subjectRef, ownerRef and focusRef.');
        }
        const thid = `task-reminder-${randomUUID()}`;
        const maxAttempts = Number.isFinite(input.maxAttempts) ? Math.max(1, Math.floor(Number(input.maxAttempts))) : 3;
        const description = String(input.description || 'Reminder phone call').trim() || 'Reminder phone call';
        const reminderSummary = String(input.reminderSummary || input.appointmentSummary || '').trim();
        const dataType = String(input.dataType || 'Task').trim() || 'Task';
        const data = windows.map((window) => {
            const offsetMinutes = Math.max(0, Math.floor(Number(window.offsetMinutes)));
            const remindAt = String(window.remindAt || '').trim();
            if (!remindAt) {
                throw new Error('createPhoneReminderTasks requires remindAt in every window.');
            }
            const taskIdSeed = [
                routeCtx.tenantId,
                routeCtx.jurisdiction,
                routeCtx.sector,
                input.subjectRef,
                input.ownerRef,
                input.focusRef,
                remindAt,
                String(offsetMinutes),
            ].join('|');
            const taskId = `task-${createHash('sha256').update(taskIdSeed).digest('hex').slice(0, 24)}`;
            const claims = {
                '@context': 'org.hl7.fhir.api',
                id: taskId,
                status: 'scheduled',
                subject: input.subjectRef,
                owner: input.ownerRef,
                focus: input.focusRef,
                'execution-period-start': remindAt,
                channel: 'phone',
                'trigger-type': 'phone-call',
                'timing-repeat-offset': String(offsetMinutes),
                'max-attempts': String(maxAttempts),
            };
            if (input.locale)
                claims.language = String(input.locale);
            if (input.subjectDisplay)
                claims['subject-display'] = String(input.subjectDisplay);
            if (reminderSummary)
                claims['based-on-display'] = reminderSummary;
            if (input.notificationPhone)
                claims['subject-phone'] = String(input.notificationPhone);
            if (input.controllerPhone)
                claims['owner-phone'] = String(input.controllerPhone);
            if (input.callSid)
                claims['communication-request'] = String(input.callSid);
            return {
                type: dataType,
                request: { method: 'POST' },
                resource: {
                    resourceType: 'Task',
                    id: taskId,
                    description,
                    meta: { claims },
                },
            };
        });
        const payload = createDidcommPlainMessage({
            iss: routeCtx.tenantId,
            aud: routeCtx.tenantId,
            thid,
            body: { data },
        });
        return this.submitAndPoll(this.individualTaskBatchPath(routeCtx), this.individualTaskPollPath(routeCtx), payload, options ?? { timeoutMs: 20_000, intervalMs: 1_000 });
    }
    /** Endpoint path for medication overlap pre-check (planned GW contract). */
    individualMedicationOverlapCheckPath(ctx) {
        return this.v1Path(ctx, 'individual', 'org.hl7.fhir.api', 'MedicationStatement', '_overlap-check');
    }
    /**
     * Pre-create overlap check for medication intake schedules.
     * TODO: Requires GW endpoint implementation (`MedicationStatement/_overlap-check`).
     */
    async checkMedicationScheduleOverlap(ctx, input) {
        const payload = createDidcommPlainMessage({
            iss: ctx.tenantId,
            aud: ctx.tenantId,
            thid: `med-overlap-${randomUUID()}`,
            body: input,
        });
        return this.submitBatch(this.individualMedicationOverlapCheckPath(ctx), payload);
    }
    /**
     * High-level helper for medication reminder creation.
     * This creates one Task per explicit intake time and delegates reminder execution to GW daemon.
     * TODO: recurring interval expansion + overlap policy should be finalized in GW endpoint contract.
     */
    async createMedicationReminderTasks(ctx, input, options) {
        const claims = (input.claims || {});
        const claimStart = String(claims[MedicationStatementClaimsFhirApiExtended.TimingBoundsPeriodStart] ||
            claims['MedicationStatement.timing-bounds-period-start'] ||
            claims[MedicationStatementClaimsFhirApi.Effective] ||
            claims['MedicationStatement.effective'] ||
            claims['DosageDetails.start'] ||
            claims['MedicationDetails.start'] ||
            '').trim();
        const claimTimeOfDay = claims[MedicationStatementClaimsFhirApiExtended.TimingTimeOfDay] ??
            claims['MedicationStatement.timing-timeofday'] ??
            claims['Timing.repeat.timeOfDay'] ??
            claims['Timing.repeat.time-of-day'];
        const claimTimes = Array.isArray(claimTimeOfDay)
            ? claimTimeOfDay
            : typeof claimTimeOfDay === 'string'
                ? claimTimeOfDay.split(',').map((v) => v.trim()).filter(Boolean)
                : [];
        const times = (Array.isArray(input.intakeTimes) ? input.intakeTimes : [])
            .concat(claimTimes.map((hhmm) => ({ hhmm: String(hhmm) })));
        if (!times.length) {
            throw new Error('createMedicationReminderTasks requires at least one intake time.');
        }
        const startDate = String(input.startDate || claimStart || '').trim();
        if (!startDate) {
            throw new Error('createMedicationReminderTasks requires startDate.');
        }
        const windows = times.map((t) => {
            const hhmm = String(t.hhmm || '').trim();
            const remindAt = `${startDate}T${hhmm}:00.000Z`;
            return { offsetMinutes: 0, remindAt };
        });
        const medicationDescription = String(input.medicationDescription ||
            claims[MedicationStatementClaimsFhirApi.Medication] ||
            claims['MedicationStatement.medication'] ||
            claims['MedicationStatement.medication-display'] ||
            'Medication').trim();
        const doseValue = String(input.doseValue ||
            claims[MedicationStatementClaimsFhirApiExtended.DoseQuantityValue] ||
            claims['MedicationStatement.dose-quantity-value'] ||
            claims['Dosage.quantity-value'] ||
            '').trim();
        const doseUnitOrFormCode = String(input.doseUnitOrFormCode ||
            claims[MedicationStatementClaimsFhirApiExtended.DoseQuantityUnit] ||
            claims['MedicationStatement.dose-quantity-unit'] ||
            claims[MedicationStatementClaimsFhirApiExtended.DoseType] ||
            claims['MedicationStatement.dose-type'] ||
            claims['Dosage.quantity-unit'] ||
            claims['Dosage.form'] ||
            '').trim();
        const summary = `${medicationDescription} ${doseValue}${doseUnitOrFormCode ? ` ${doseUnitOrFormCode}` : ''}`.trim();
        return this.createPhoneReminderTasks(ctx, {
            windows,
            locale: input.locale,
            subjectRef: input.subjectRef,
            ownerRef: input.ownerRef,
            focusRef: `MedicationStatement/${createHash('sha256').update(summary + startDate).digest('hex').slice(0, 24)}`,
            subjectDisplay: medicationDescription,
            reminderSummary: summary,
            notificationPhone: input.notificationPhone,
            controllerPhone: input.controllerPhone,
            description: 'Medication reminder',
            maxAttempts: input.maxAttempts,
        }, options);
    }
    /**
     * Search for an existing family Organization registration by phone + usualname.
     * Submits to `individual/org.schema/Organization/_search`, polls for the result, and
     * parses the bundle entry into a `FamilyOrganizationSummary`.
     *
     * Returns `null` when no matching registration exists.
     */
    async searchFamilyOrganization(ctx, filters, options) {
        const routeCtx = this.requireRouteContext(ctx);
        const thid = `search-${randomUUID()}`;
        const claims = {
            'org.schema.Organization.owner.telephone': filters.controllerPhone,
            'org.schema.Organization.alternateName': filters.usualname,
            'org.schema.Service.category': routeCtx.sector,
        };
        if (filters.birthDate) {
            claims['org.schema.Organization.foundingDate'] = filters.birthDate;
        }
        const payload = {
            jti: randomUUID(),
            thid,
            iss: routeCtx.tenantId,
            aud: routeCtx.tenantId,
            type: 'application/api+json',
            body: {
                data: [{
                        type: 'Family-search-v1.0',
                        meta: { claims }, // legacy compatibility
                        resource: { meta: { claims } },
                    }],
            },
        };
        const result = await this.submitAndPoll(this.individualFamilyOrganizationSearchPath(routeCtx), this.individualFamilyOrganizationSearchPollPath(routeCtx), payload, options ?? { timeoutMs: 20_000, intervalMs: 1_000 });
        if (result.poll.status !== 200)
            return null;
        const entry = result.poll.body?.body?.data?.[0];
        if (!entry)
            return null;
        const status = entry.meta?.claims?.['org.schema.FamilyRegistration.status'];
        if (!status || status === 'not_found')
            return null;
        const subjectInfo = {
            identifierType: entry.meta?.claims?.['org.schema.Organization.identifier.additionalType'],
            identifierValue: entry.meta?.claims?.['org.schema.Organization.identifier.value'],
            nickname: entry.meta?.claims?.['org.schema.Organization.alternateName'],
            birthDate: entry.meta?.claims?.['org.schema.Organization.foundingDate'],
            telephone: entry.meta?.claims?.['org.schema.Organization.owner.telephone'],
        };
        return {
            status,
            offerId: entry.meta?.claims?.['org.schema.Offer.identifier'],
            organizationId: entry.resource?.id,
            subjectInfo,
        };
    }
    /**
     * Activate tenant organization in GW from ICA-derived proof.
     */
    async activateOrganizationInGatewayFromIcaProof(ctx, input, options) {
        if (!input?.vpToken) {
            throw new Error('activateOrganizationInGatewayFromIcaProof requires vpToken.');
        }
        const claims = {
            '@context': 'org.schema',
            vp_token: input.vpToken,
            ...(input.additionalClaims || {}),
        };
        const requestedMembers = Number.isFinite(Number(input.numberOfMembers))
            ? Math.max(1, Math.floor(Number(input.numberOfMembers)))
            : 2;
        // Keep gateway-facing claim stable while exposing a generic SDK input.
        claims['org.schema.Organization.numberOfEmployees'] = requestedMembers;
        if (input.organizationVc)
            claims['org.schema.OrganizationCredential.jwt'] = input.organizationVc;
        if (input.legalRepresentativeVc) {
            claims['org.schema.LegalRepresentativeCredential.jwt'] = input.legalRepresentativeVc;
        }
        if (input.regulatoryEvidence)
            claims['org.schema.Organization.regulatoryEvidence'] = input.regulatoryEvidence;
        const payload = createDidcommPlainMessage({
            iss: 'did:web:controller.example.com',
            aud: 'did:web:host.example.com',
            body: {
                // GW activation parser expects proof material at top-level DIDComm body.
                vp_token: input.vpToken,
                ...(input.organizationVc ? { organizationCredential: input.organizationVc } : {}),
                ...(input.legalRepresentativeVc ? { representativeCredential: input.legalRepresentativeVc } : {}),
                data: [
                    {
                        type: 'Organization-activation-request-v1.0',
                        meta: { claims }, // legacy compatibility
                        resource: { meta: { claims } },
                    },
                ],
            },
        });
        return this.submitAndPoll(this.hostRegistryOrganizationActivatePath(ctx), this.hostRegistryOrganizationActivatePollPath(ctx), payload, options);
    }
    /**
     * Friendly wrapper for legal organization activation.
     * Accepts one object and seconds-based polling options for integrator ergonomics.
     */
    async activateOrganizationInGatewaySimple(input) {
        const serviceProviderDidWeb = String(input.serviceProviderDidWeb || '').trim();
        const serviceProviderUrl = String(input.serviceProviderUrl || '').trim();
        const controllerEmail = String(input.controllerEmail || '').trim();
        const controllerTelephone = String(input.controllerTelephone || '').trim();
        const controllerRole = String(input.controllerRole || '').trim();
        const resolvedServiceDid = toDidWebFromUrlOrHost(serviceProviderDidWeb || serviceProviderUrl);
        if (!resolvedServiceDid) {
            throw new Error('activateOrganizationInGatewaySimple requires serviceProviderDidWeb or serviceProviderUrl.');
        }
        if (!controllerEmail && !controllerTelephone) {
            throw new Error('activateOrganizationInGatewaySimple requires controllerEmail or controllerTelephone.');
        }
        if (!controllerRole) {
            throw new Error('activateOrganizationInGatewaySimple requires controllerRole.');
        }
        const pollOptions = this.resolveSimplePollOptions(input.timeoutSeconds, input.intervalSeconds);
        const hostCtx = this.requireHostRouteContext(input.jurisdiction && input.sector
            ? { jurisdiction: input.jurisdiction, sector: input.sector }
            : undefined);
        const implicitClaims = {
            'org.schema.Service.category': hostCtx.sector,
            'org.schema.Service.identifier': resolvedServiceDid,
            ...(serviceProviderUrl ? { 'org.schema.Service.url': serviceProviderUrl } : {}),
            [ClaimsPersonSchemaorg.hasOccupation]: controllerRole,
            ...(controllerEmail ? { [ClaimsPersonSchemaorg.email]: controllerEmail } : {}),
            ...(controllerTelephone ? { [ClaimsPersonSchemaorg.telephone]: controllerTelephone } : {}),
        };
        const activation = await this.activateOrganizationInGatewayFromIcaProof(hostCtx, {
            vpToken: input.vpToken,
            numberOfMembers: input.numberOfMembers,
            organizationVc: input.organizationVc,
            legalRepresentativeVc: input.legalRepresentativeVc,
            regulatoryEvidence: input.regulatoryEvidence,
            additionalClaims: { ...implicitClaims, ...(input.additionalClaims || {}) },
        }, pollOptions);
        this.assertFirstDidcommEntrySuccess(activation, 'activateOrganizationInGatewaySimple');
        return activation;
    }
    /**
     * Friendly wrapper for legal organization Order confirmation.
     * Accepts one object and builds payload/paths internally.
     */
    async confirmLegalOrganizationOrderSimple(input) {
        if (!String(input.offerId || '').trim()) {
            throw new Error('confirmLegalOrganizationOrderSimple requires offerId.');
        }
        const pollOptions = this.resolveSimplePollOptions(input.timeoutSeconds, input.intervalSeconds);
        const hostCtx = this.requireHostRouteContext(input.jurisdiction && input.sector
            ? { jurisdiction: input.jurisdiction, sector: input.sector }
            : undefined);
        const claims = {
            '@context': 'org.schema',
            'Order.acceptedOffer.identifier': input.offerId,
            ...(input.additionalClaims || {}),
        };
        const payload = createDidcommPlainMessage({
            iss: 'did:web:controller.example.com',
            aud: 'did:web:host.example.com',
            thid: `order-${randomUUID()}`,
            body: {
                data: [{
                        type: input.dataType || 'Organization-order-request-v1.0',
                        meta: { claims }, // legacy compatibility
                        resource: { meta: { claims } },
                    }],
            },
        });
        const order = await this.submitAndPoll(this.hostRegistryOrderBatchPath(hostCtx), this.hostRegistryOrderPollPath(hostCtx), payload, pollOptions);
        this.assertFirstDidcommEntrySuccess(order, 'confirmLegalOrganizationOrderSimple');
        return order;
    }
    /**
     * Normalize GW async response into DIDComm message body.
     *
     * Transport note:
     * - GW poll responses are HTTP JSON envelopes
     * - business payload lives inside DIDComm `body`
     *
     * This helper abstracts envelope differences so consumers do not depend on
     * raw `poll.body.body` paths.
     */
    getDidcommMessageBodyFromResponse(result) {
        const pollBody = result?.poll?.body ?? result?.body ?? result;
        const didcommBody = pollBody?.body;
        if (didcommBody && typeof didcommBody === 'object')
            return didcommBody;
        if (pollBody && typeof pollBody === 'object' && Array.isArray(pollBody?.data)) {
            return pollBody;
        }
        return undefined;
    }
    /**
     * Return first DIDComm business entry from a submit/poll result.
     */
    getFirstDidcommDataEntryFromResponse(result) {
        const body = this.getDidcommMessageBodyFromResponse(result);
        const entry = body?.data?.[0];
        return entry && typeof entry === 'object' ? entry : undefined;
    }
    /**
     * Extract `org.schema.Offer.identifier` from a submit/poll result.
     *
     * This helper normalizes canonical and legacy claim locations.
     */
    getOfferIdFromResponse(result) {
        const entry = this.getFirstDidcommDataEntryFromResponse(result);
        const offerId = String(entry?.meta?.claims?.[ClaimsOfferSchemaorg.identifier]
            || entry?.resource?.meta?.claims?.[ClaimsOfferSchemaorg.identifier]
            || '').trim();
        return offerId || undefined;
    }
    /**
     * Extract a UI-ready Offer preview from activation/registration responses.
     */
    getOfferPreviewFromResponse(result) {
        const entry = this.getFirstDidcommDataEntryFromResponse(result);
        const claims = entry?.meta?.claims || entry?.resource?.meta?.claims || {};
        const seatsRaw = claims[ClaimsOfferSchemaorg.eligibleQuantityValue];
        const seats = typeof seatsRaw === 'number'
            ? seatsRaw
            : (typeof seatsRaw === 'string' && seatsRaw.trim() ? Number(seatsRaw) : undefined);
        return {
            offerId: this.getOfferIdFromResponse(result),
            amount: claims[ClaimsOfferSchemaorg.price],
            currency: claims[ClaimsOfferSchemaorg.priceCurrency],
            seats: Number.isFinite(seats) ? seats : undefined,
            planName: claims[ClaimsOfferSchemaorg.itemOfferedName],
            sku: claims[ClaimsOfferSchemaorg.itemOfferedSku],
            paymentMethod: claims[ClaimsOfferSchemaorg.acceptedPaymentMethod],
            checkoutUrl: claims[ClaimsOfferSchemaorg.checkoutPageURLTemplate],
        };
    }
    /**
     * Alias of `getOfferPreviewFromResponse` with business naming.
     */
    getOfferInfoFromResponse(result) {
        return this.getOfferPreviewFromResponse(result);
    }
    /**
     * Extract activation code from response payload or claims.
     * Supports common response shapes used in onboarding and license issuance flows.
     */
    getActivationCodeFromResponse(result) {
        const root = result?.poll?.body || result?.body || {};
        const byBody = String(root?.activationCode || root?.body?.activationCode || '').trim();
        if (byBody)
            return byBody;
        const entry = this.getFirstDidcommDataEntryFromResponse(result);
        const claims = entry?.meta?.claims || entry?.resource?.meta?.claims || {};
        const byClaims = String(claims['org.schema.IndividualProduct.serialNumber']
            || claims['org.schema.Offer.serialNumber']
            || claims['activationCode']
            || '').trim();
        return byClaims || undefined;
    }
    /**
     * Throws when first DIDComm entry contains a business-level error status.
     */
    assertFirstDidcommEntrySuccess(result, contextLabel) {
        const entry = this.getFirstDidcommDataEntryFromResponse(result);
        const responseStatusRaw = entry?.response?.status;
        const responseStatus = Number(responseStatusRaw);
        if (!Number.isFinite(responseStatus) || responseStatus < 400)
            return;
        const diagnostics = String(entry?.response?.outcome?.issue?.[0]?.diagnostics
            || entry?.response?.outcome?.issue?.[0]?.details?.text
            || '').trim();
        throw new Error(`${contextLabel} failed (business status=${responseStatus})${diagnostics ? `: ${diagnostics}` : ''}`);
    }
    /**
     * Activate employee/member device by activation code exchange + DCR registration.
     *
     * Step 1. Exchange activation code using user id_token to obtain an initial access token.
     * Step 2. Register device keys through Device/_dcr authorized by that initial token.
     */
    async activateEmployeeDeviceWithActivationCode(ctx, input) {
        const exchangePayload = {
            thid: `exchange-${randomUUID()}`,
            subject_token: input.activationCode,
        };
        const exchangeClient = new DataspaceNodeClient({
            baseUrl: this.baseUrl,
            bearerToken: input.idToken,
            defaultHeaders: this.defaultHeaders,
            wallet: this.wallet,
        });
        const exchange = await exchangeClient.submitAndPoll(this.identityTokenExchangePath(ctx), this.identityTokenExchangePollPath(ctx), exchangePayload, input.pollOptions);
        const exchangeBody = exchange.poll.body?.body || exchange.poll.body || {};
        const initialAccessToken = String(exchangeBody.initial_access_token || exchangeBody.access_token || '').trim();
        if (!initialAccessToken) {
            throw new Error('activateEmployeeDeviceWithActivationCode: missing initial_access_token in exchange response.');
        }
        const dcrPayload = {
            thid: `dcr-${randomUUID()}`,
            ...input.dcrPayload,
        };
        const dcrClient = new DataspaceNodeClient({
            baseUrl: this.baseUrl,
            bearerToken: initialAccessToken,
            defaultHeaders: this.defaultHeaders,
            wallet: this.wallet,
        });
        const dcr = await dcrClient.submitAndPoll(this.identityDeviceDcrPath(ctx), this.identityDeviceDcrPollPath(ctx), dcrPayload, input.pollOptions);
        return {
            initialAccessToken,
            exchange,
            dcr,
        };
    }
    /**
     * Friendly wrapper for employee/member device activation.
     * Uses one object, seconds-based polling, and constructor ctx fallback.
     */
    async activateEmployeeDeviceWithActivationCodeSimple(input) {
        const routeCtx = this.requireRouteContext(input.tenantId && input.jurisdiction && input.sector
            ? { tenantId: input.tenantId, jurisdiction: input.jurisdiction, sector: input.sector }
            : undefined);
        const pollOptions = this.resolveSimplePollOptions(input.timeoutSeconds, input.intervalSeconds);
        return this.activateEmployeeDeviceWithActivationCode(routeCtx, {
            activationCode: input.activationCode,
            idToken: input.idToken,
            dcrPayload: input.dcrPayload,
            pollOptions,
        });
    }
    /**
     * UC 5.3 wrapper: create organization employee in entity Employee batch route.
     */
    async createOrganizationEmployee(ctx, input, options) {
        const routeCtx = this.requireRouteContext(ctx);
        const payload = createDidcommPlainMessage({
            iss: routeCtx.tenantId,
            aud: routeCtx.tenantId,
            thid: `employee-${randomUUID()}`,
            body: {
                data: [
                    {
                        type: input.dataType || 'Employee-create-request-v1.0',
                        meta: { claims: input.employeeClaims || {} }, // legacy compatibility
                        resource: { meta: { claims: input.employeeClaims || {} } },
                    },
                ],
            },
        });
        return this.submitAndPoll(this.employeeBatchPath(routeCtx), this.employeePollPath(routeCtx), payload, options);
    }
    /**
     * UC 5.1 wrapper: bootstrap subject organization context via registration + optional order confirmation.
     */
    async bootstrapSubjectOrganizationIndex(ctx, input) {
        const registrationPayload = {
            thid: input.registrationPayload.thid || `family-org-${randomUUID()}`,
            ...input.registrationPayload,
        };
        const registration = await this.submitAndPoll(this.individualFamilyOrganizationBatchPath(ctx), this.individualFamilyOrganizationPollPath(ctx), registrationPayload, input.pollOptions);
        if (!input.confirmationPayload) {
            return { registration };
        }
        const confirmationPayload = {
            thid: input.confirmationPayload.thid || `family-order-${randomUUID()}`,
            ...input.confirmationPayload,
        };
        const confirmation = await this.submitAndPoll(this.individualFamilyOrderBatchPath(ctx), this.individualFamilyOrderPollPath(ctx), confirmationPayload, input.pollOptions);
        return { registration, confirmation };
    }
    /**
     * Friendly wrapper (recommended step 1): register individual organization and return Offer.
     */
    async startIndividualOrganizationSimple(input) {
        const routeCtx = this.requireRouteContext(input.tenantId && input.jurisdiction && input.sector
            ? { tenantId: input.tenantId, jurisdiction: input.jurisdiction, sector: input.sector }
            : undefined);
        const alternateName = String(input.alternateName || '').trim();
        if (!alternateName) {
            throw new Error('bootstrapIndividualOrganizationSimple requires alternateName.');
        }
        const controllerEmail = String(input.controllerEmail || '').trim();
        const controllerTelephone = String(input.controllerTelephone || '').trim();
        if (!controllerEmail && !controllerTelephone) {
            throw new Error('bootstrapIndividualOrganizationSimple requires controllerEmail or controllerTelephone.');
        }
        const controllerRole = String(input.controllerRole || 'org.hl7.v3.RoleCode|RESPRSN').trim();
        const claims = {
            '@context': 'org.schema',
            'org.schema.Organization.alternateName': alternateName,
            'org.schema.Service.category': routeCtx.sector,
            [ClaimsPersonSchemaorg.hasOccupation]: controllerRole,
            ...(controllerEmail ? { [ClaimsPersonSchemaorg.email]: controllerEmail } : {}),
            ...(controllerTelephone ? { [ClaimsPersonSchemaorg.telephone]: controllerTelephone } : {}),
            ...(input.additionalClaims || {}),
        };
        const pollOptions = this.resolveSimplePollOptions(input.timeoutSeconds, input.intervalSeconds);
        const registrationPayload = createDidcommPlainMessage({
            iss: routeCtx.tenantId,
            aud: routeCtx.tenantId,
            thid: `family-org-${randomUUID()}`,
            body: {
                data: [{
                        type: 'SubjectOrg-registration-form-v1.0',
                        meta: { claims },
                        resource: { meta: { claims } },
                    }],
            },
        });
        const registration = await this.submitAndPoll(this.individualFamilyOrganizationBatchPath(routeCtx), this.individualFamilyOrganizationPollPath(routeCtx), registrationPayload, pollOptions);
        this.assertFirstDidcommEntrySuccess(registration, 'startIndividualOrganizationSimple.registration');
        const offerId = this.getOfferIdFromResponse(registration);
        if (!offerId) {
            throw new Error('startIndividualOrganizationSimple failed: missing offerId in registration response.');
        }
        return { registration, offerId, offerPreview: this.getOfferPreviewFromResponse(registration) };
    }
    /**
     * Friendly wrapper (recommended step 2): confirm individual/family order from accepted offerId.
     */
    async confirmIndividualOrganizationOrderSimple(input) {
        const routeCtx = this.requireRouteContext(input.tenantId && input.jurisdiction && input.sector
            ? { tenantId: input.tenantId, jurisdiction: input.jurisdiction, sector: input.sector }
            : undefined);
        const offerId = String(input.offerId || '').trim();
        if (!offerId) {
            throw new Error('confirmIndividualOrganizationOrderSimple requires offerId.');
        }
        const pollOptions = this.resolveSimplePollOptions(input.timeoutSeconds, input.intervalSeconds);
        const orderClaims = {
            '@context': 'org.schema',
            'Order.acceptedOffer.identifier': offerId,
        };
        const confirmationPayload = createDidcommPlainMessage({
            iss: routeCtx.tenantId,
            aud: routeCtx.tenantId,
            thid: `family-order-${randomUUID()}`,
            body: {
                data: [{
                        type: 'Family-order-request-v1.0',
                        meta: { claims: orderClaims },
                        resource: { meta: { claims: orderClaims } },
                    }],
            },
        });
        const confirmation = await this.submitAndPoll(this.individualFamilyOrderBatchPath(routeCtx), this.individualFamilyOrderPollPath(routeCtx), confirmationPayload, pollOptions);
        this.assertFirstDidcommEntrySuccess(confirmation, 'confirmIndividualOrganizationOrderSimple');
        return confirmation;
    }
    /**
     * Friendly wrapper (provisional): register + auto-confirm individual order.
     * Prefer `startIndividualOrganizationSimple` + `confirmIndividualOrganizationOrderSimple`.
     */
    async bootstrapIndividualOrganizationSimple(input) {
        const started = await this.startIndividualOrganizationSimple(input);
        const confirmation = await this.confirmIndividualOrganizationOrderSimple({
            tenantId: input.tenantId,
            jurisdiction: input.jurisdiction,
            sector: input.sector,
            offerId: started.offerId,
            timeoutSeconds: input.timeoutSeconds,
            intervalSeconds: input.intervalSeconds,
        });
        return {
            registration: started.registration,
            offerId: started.offerId,
            confirmation,
        };
    }
    /**
     * UC 5.5 wrapper: import IPS/FHIR composition and update subject index context.
     */
    async importIpsOrFhirAndUpdateIndex(ctx, input) {
        const routeCtx = this.requireRouteContext(ctx);
        const payload = {
            thid: input.compositionPayload.thid || `composition-${randomUUID()}`,
            ...input.compositionPayload,
        };
        const submitPath = (input.format || 'r4') === 'api'
            ? this.individualCompositionR4BatchPath(routeCtx).replace('/org.hl7.fhir.r4/', '/org.hl7.fhir.api/')
            : this.individualCompositionR4BatchPath(routeCtx);
        const pollPath = (input.format || 'r4') === 'api'
            ? this.individualCompositionR4PollPath(routeCtx).replace('/org.hl7.fhir.r4/', '/org.hl7.fhir.api/')
            : this.individualCompositionR4PollPath(routeCtx);
        return this.submitAndPoll(submitPath, pollPath, payload, input.pollOptions);
    }
    /**
     * UC 5.6 consent helper from minimal frontend fields.
     * Builds canonical Consent claims and submits/polls the Consent batch.
     */
    async grantProfessionalAccessSimple(ctx, input) {
        const routeCtx = this.requireRouteContext(ctx);
        const built = buildConsentClaimsSimpleWithCid({
            subjectDid: input.subjectDid,
            subjectPhone: input.subjectPhone,
            subjectGivenName: input.subjectGivenName,
            actor: input.actor || {},
            actorRole: input.actorRole,
            purpose: input.purpose,
            actions: input.actions,
            consentIdentifier: input.consentIdentifier,
            consentDate: input.consentDate,
            decision: input.decision,
            attachmentContentType: input.attachmentContentType,
            attachmentBase64: input.attachmentBase64,
        }, {
            consentIdentifierFactory: () => `urn:uuid:${randomUUID()}`,
        });
        const thid = `consent-${randomUUID()}`;
        const consentPayload = {
            thid,
            body: {
                data: [
                    {
                        type: input.dataType || 'Consent-grant-request-v1.0',
                        meta: { claims: built.consentClaims }, // legacy compatibility
                        resource: { meta: { claims: built.consentClaims } },
                    },
                ],
            },
        };
        const consent = await this.submitAndPoll(this.individualConsentR4BatchPath(routeCtx), this.individualConsentR4PollPath(routeCtx), consentPayload, input.pollOptions);
        return {
            thid,
            consent,
            actorIdentifier: built.actorIdentifier,
            subjectIdentifier: built.subjectIdentifier,
            consentClaims: built.consentClaims,
            claimsCid: built.claimsCid,
        };
    }
    /**
     * UC 5.7 wrapper: generate digital twin composition from subject data.
     */
    async generateDigitalTwinFromSubjectData(ctx, input) {
        const routeCtx = this.requireRouteContext(ctx);
        const payload = {
            thid: input.compositionPayload.thid || `digital-twin-${randomUUID()}`,
            ...input.compositionPayload,
        };
        const submitPath = (input.format || 'r4') === 'api'
            ? this.digitalTwinCompositionApiBatchPath(routeCtx)
            : this.digitalTwinCompositionR4BatchPath(routeCtx);
        const pollPath = (input.format || 'r4') === 'api'
            ? this.digitalTwinCompositionApiPollPath(routeCtx)
            : this.digitalTwinCompositionR4PollPath(routeCtx);
        return this.submitAndPoll(submitPath, pollPath, payload, input.pollOptions);
    }
    /**
     * Poll a `_*-response` path repeatedly until the status is no longer 202.
     * Default: 60s timeout, 2s interval.
     * Throws if timeout is exceeded.
     *
     * @param path - Poll path (e.g. `individualFamilyOrganizationPollPath(ctx)`).
     * @param request - Must include `thid` matching the original submit payload.
     * @param options - `timeoutMs` (default 60000) and `intervalMs` (default 2000).
     */
    async pollUntilComplete(path, request, options) {
        const timeoutMs = options?.timeoutMs ?? 60_000;
        const intervalMs = options?.intervalMs ?? 2_000;
        const startedAt = Date.now();
        let attempts = 0;
        while (true) {
            attempts += 1;
            const result = await this.pollBatchResponse(path, request);
            if (result.status !== 202) {
                return {
                    status: result.status,
                    body: result.body,
                    attempts,
                };
            }
            if (Date.now() - startedAt > timeoutMs) {
                throw new Error(`Polling timeout after ${attempts} attempts (${timeoutMs}ms).`);
            }
            const waitMs = options?.intervalMs ?? result.retryAfterMs ?? intervalMs;
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
    }
    // ---- Internal HTTP helpers ---------------------------------------------
    async doPost(path, payload, contentType) {
        const url = /^https?:\/\//.test(path)
            ? path
            : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
        const headers = {
            ...this.defaultHeaders,
            'Content-Type': contentType,
            Accept: 'application/json, application/didcomm-plaintext+json, application/x-www-form-urlencoded, */*',
        };
        if (this.bearerToken) {
            headers.Authorization = `Bearer ${this.bearerToken}`;
        }
        return fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
    }
    async parseResponseBody(response) {
        const contentType = response.headers.get('content-type') || '';
        const raw = await response.text();
        if (!raw)
            return {};
        if (contentType.includes('application/json') || contentType.includes('application/didcomm-plaintext+json')) {
            try {
                return JSON.parse(raw);
            }
            catch {
                return {};
            }
        }
        return raw;
    }
}
