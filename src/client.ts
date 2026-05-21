import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  activateEmployeeDeviceWithActivationCodeSimpleWithDeps,
  activateEmployeeDeviceWithActivationCodeWithDeps,
  createOrganizationEmployeeWithDeps,
  confirmLegalOrganizationOrderSimpleWithDeps,
  confirmIndividualOrganizationOrderSimpleWithDeps,
  generateDigitalTwinFromSubjectDataWithDeps,
  grantProfessionalAccessSimpleWithDeps,
  importIpsOrFhirAndUpdateIndexWithDeps,
  ingestCommunicationAndUpdateIndexWithDeps,
  pollUntilCompleteWithMethod,
  requestSmartTokenSimpleWithDeps,
  resolveSimplePollOptions,
  startIndividualOrganizationSimpleWithDeps,
  submitAndPollWithMethods,
  upsertRelatedPersonAndPollWithDeps,
} from '../../gdc-sdk-node-ts/dist/index.js';
import { DataspaceNodePathBuilder } from './client-paths.js';
import { DataspaceNodeHttpRuntime } from './client-http-runtime.js';
import { DataspaceNodeAuthRuntime } from './client-auth-runtime.js';
import { DataspaceNodeResponseHelpers } from './client-response-helpers.js';
import { createDidcommPlainMessage } from './builders.js';
import { transformCommunicationClaimsToResourceFhirR4 } from './communication-transform.js';
import { buildConsentClaimsSimpleWithCid } from 'gdc-common-utils-ts/utils/consent';
import { generateServiceId } from 'gdc-common-utils-ts/utils/did';
import { ClaimsPersonSchemaorg } from 'gdc-common-utils-ts/constants/schemaorg';
import {
  MedicationStatementClaimsFhirApi,
  MedicationStatementClaimsFhirApiExtended,
} from 'gdc-common-utils-ts/models/interoperable-claims/medication-statement-claims';
import type {
  AsyncPollRequest,
  BackendPkceAuthOptions,
  BackendPkceAuthResult,
  BackendSmartAuthOptions,
  BackendSmartAuthResult,
  ClientOptions,
  CommunicationIngestionInput,
  CreatePhoneReminderTasksInput,
  GrantProfessionalAccessSimpleInput,
  GrantProfessionalAccessSimpleResult,
  DigitalTwinGenerationInput,
  EmployeeDeviceActivationInput,
  EndpointSelector,
  EmployeeDeviceActivationSimpleInput,
  EmployeeDeviceActivationResult,
  FamilyOrganizationSummary,
  FamilyRegistrationStatus,
  GatewayOrganizationActivationInput,
  GatewayOrganizationActivationSimpleInput,
  HostRouteContext,
  IpsOrFhirImportInput,
  MedicationOverlapCheckInput,
  MedicationRegistrationInput,
  OrganizationEmployeeCreationInput,
  PollOptions,
  PollResult,
  RelatedPersonUpsertInput,
  OfferPreview,
  OfferInfo,
  RouteContext,
  SmartTokenExchangeInput,
  SmartTokenExchangeResult,
  SmartTokenRequestSimpleInput,
  LegalOrganizationOrderSimpleInput,
  SubjectOrganizationBootstrapInput,
  SubjectOrganizationBootstrapResult,
  IndividualOrganizationBootstrapSimpleInput,
  IndividualOrganizationBootstrapSimpleResult,
  IndividualOrganizationStartSimpleResult,
  IndividualOrganizationConfirmOrderSimpleInput,
  SubmitAndPollResult,
  SubmitResponse,
  V1Action,
  V1Section,
} from './types.js';
import type { WalletProvider } from './sdk/dataspace-wallet-sdk-node/provider.js';
import type { PublicJwk, WalletContext } from './sdk/dataspace-wallet-sdk-node/types.js';
import {
  isDemoMode,
  isRetryableTransportError,
  normalizeBearerToken,
  normalizeCommunicationPathFormatSegment,
  redactSensitive,
  sleep,
  toDidWebFromUrlOrHost,
  trimTrailingSlash,
} from './client-runtime-utils.js';

function maybeConvertCommunicationClaimsToFhirR4Payload(
  payload: Record<string, unknown>,
  enabled: boolean,
): Record<string, unknown> {
  if (!enabled) return payload;
  const body = payload['body'];
  if (!body || typeof body !== 'object') return payload;
  const data = (body as Record<string, unknown>)['data'];
  if (!Array.isArray(data) || !data.length) return payload;

  const transformed = data.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const entryObj = entry as Record<string, unknown>;
    if (entryObj['resource']) return entryObj;
    const meta = entryObj['meta'];
    if (!meta || typeof meta !== 'object') return entryObj;
    const claims = (meta as Record<string, unknown>)['claims'];
    if (!claims || typeof claims !== 'object') return entryObj;

    const converted = transformCommunicationClaimsToResourceFhirR4([claims as Record<string, unknown>], { mode: 'normalize' });
    const resource = converted.resources[0];
    return {
      ...entryObj,
      resource,
    };
  });

  return {
    ...payload,
    body: {
      ...(body as Record<string, unknown>),
      data: transformed,
    },
  };
}

type CachedToken = {
  accessToken: string;
  tokenType: string;
  scopes: string[];
  expiresAt: number; // unix ms
};

export class DataspaceNodeClient {
  private readonly baseUrl: string;
  private readonly bearerToken?: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly wallet?: WalletProvider;
  private readonly runtimeMode: 'demo' | 'development' | 'strict';
  private readonly requestTimeoutMs: number;
  private readonly requestRetries: number;
  private readonly allowDemoFallback: boolean;
  private readonly httpTraceFile?: string;
  private defaultCtx?: RouteContext;
  private defaultTimeoutMs?: number;
  private defaultIntervalMs?: number;
  private readonly _tokenCache = new Map<string, CachedToken>();
  private readonly _demoJobs = new Map<string, { kind: string; payload: Record<string, unknown>; path: string }>();
  private readonly paths: DataspaceNodePathBuilder;
  private readonly httpRuntime: DataspaceNodeHttpRuntime;
  private readonly authRuntime: DataspaceNodeAuthRuntime;
  private readonly responseHelpers = new DataspaceNodeResponseHelpers();

  constructor(options: ClientOptions) {
    this.baseUrl = trimTrailingSlash(options.baseUrl);
    this.bearerToken = normalizeBearerToken(options.bearerToken);
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.wallet = options.wallet;
    this.defaultCtx = options.ctx;
    this.runtimeMode = options.runtimeMode ?? 'strict';
    this.requestTimeoutMs = Math.max(
      1,
      Math.floor(
        options.requestTimeoutMs ?? (isDemoMode(this.runtimeMode) ? 1000 : this.runtimeMode === 'development' ? 10_000 : 20_000),
      ),
    );
    this.requestRetries = Math.max(
      0,
      Math.floor(options.requestRetries ?? (isDemoMode(this.runtimeMode) || this.runtimeMode === 'development' ? 2 : 0)),
    );
    this.allowDemoFallback = options.allowDemoFallback ?? isDemoMode(this.runtimeMode);
    this.httpTraceFile = String(process.env.SDK_HTTP_TRACE_FILE || '').trim() || undefined;
    if (this.httpTraceFile) {
      mkdirSync(dirname(this.httpTraceFile), { recursive: true });
    }
    this.paths = new DataspaceNodePathBuilder(
      this.requireRouteContext.bind(this),
      this.requireHostRouteContext.bind(this),
    );
    this.httpRuntime = new DataspaceNodeHttpRuntime({
      baseUrl: this.baseUrl,
      bearerToken: this.bearerToken,
      defaultHeaders: this.defaultHeaders,
      wallet: this.wallet,
      requestTimeoutMs: this.requestTimeoutMs,
      requestRetries: this.requestRetries,
      allowDemoFallback: this.allowDemoFallback,
      traceHttp: this.traceHttp.bind(this),
      demoJobs: this._demoJobs,
    });
    this.authRuntime = new DataspaceNodeAuthRuntime({
      baseUrl: this.baseUrl,
      wallet: this.wallet,
      tokenCache: this._tokenCache,
      defaultTimeoutMs: this.defaultTimeoutMs,
      defaultIntervalMs: this.defaultIntervalMs,
      submitBatch: this.submitBatch.bind(this),
      pollUntilComplete: this.pollUntilComplete.bind(this),
      postJson: this.postJson.bind(this),
      identityDeviceDcrPath: (ctx?: RouteContext) => this.identityDeviceDcrPath(ctx),
      identityDeviceDcrPollPath: (ctx?: RouteContext) => this.identityDeviceDcrPollPath(ctx),
      identityCodePath: (ctx: RouteContext) => this.identityCodePath(ctx),
      identityCodePollPath: (ctx: RouteContext) => this.identityCodePollPath(ctx),
      identitySmartTokenPath: (ctx: RouteContext) => this.identitySmartTokenPath(ctx),
      identitySmartTokenPollPath: (ctx: RouteContext) => this.identitySmartTokenPollPath(ctx),
      identityTokenExchangePath: (ctx?: RouteContext) => this.identityTokenExchangePath(ctx),
      identityTokenExchangePollPath: (ctx?: RouteContext) => this.identityTokenExchangePollPath(ctx),
      identityOpenIdSmartTokenPath: (ctx?: RouteContext) => this.identityOpenIdSmartTokenPath(ctx),
      identityOpenIdSmartTokenPollPath: (ctx?: RouteContext) => this.identityOpenIdSmartTokenPollPath(ctx),
      submitAndPoll: this.submitAndPoll.bind(this),
    } as any);
  }

  private traceHttp(stage: string, data: Record<string, unknown>): void {
    if (!this.httpTraceFile) return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      stage,
      ...redactSensitive(data),
    });
    appendFileSync(this.httpTraceFile, `${line}\n`);
  }

  /**
   * Return the currently configured wallet provider (if any).
   */
  public getWallet(): WalletProvider | undefined {
    return this.wallet;
  }

  /**
   * Set default route context for subsequent calls.
   */
  public setContext(ctx: RouteContext): this {
    this.defaultCtx = { ...ctx };
    return this;
  }

  /**
   * Preferred alias for organization/tenant integration context.
   */
  public setContextOrg(ctx: RouteContext): this {
    return this.setContext(ctx);
  }

  /**
   * Update only `tenantId` in default route context.
   */
  public setTenantId(tenantId: string): this {
    const current = this.defaultCtx ?? { tenantId: '', jurisdiction: '', sector: '' };
    this.defaultCtx = { ...current, tenantId };
    return this;
  }

  /**
   * Update only `jurisdiction` in default route context.
   */
  public setJurisdiction(jurisdiction: string): this {
    const current = this.defaultCtx ?? { tenantId: '', jurisdiction: '', sector: '' };
    this.defaultCtx = { ...current, jurisdiction };
    return this;
  }

  /**
   * Update only `sector` in default route context.
   */
  public setSector(sector: string): this {
    const current = this.defaultCtx ?? { tenantId: '', jurisdiction: '', sector: '' };
    this.defaultCtx = { ...current, sector };
    return this;
  }

  /**
   * Set default polling timeout (seconds) for simple helper methods.
   */
  public setDefaultTimeoutSeconds(seconds: number): this {
    if (Number.isFinite(Number(seconds))) {
      this.defaultTimeoutMs = Math.max(1, Math.floor(Number(seconds) * 1000));
    }
    return this;
  }

  /**
   * Set default polling interval (seconds) for simple helper methods.
   */
  public setDefaultIntervalSeconds(seconds: number): this {
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
  public getEndpointId(selector: EndpointSelector, providerDid?: string): string {
    const fragment = generateServiceId(selector); // #section:format:resourceType:action
    if (providerDid) return `${providerDid}${fragment}`;
    return fragment.replace(/^#/, '');
  }

  private resolveSimplePollOptions(timeoutSeconds?: number, intervalSeconds?: number): PollOptions | undefined {
    return resolveSimplePollOptions(timeoutSeconds, intervalSeconds, {
      timeoutMs: this.defaultTimeoutMs,
      intervalMs: this.defaultIntervalMs,
    });
  }

  private requireRouteContext(ctx?: RouteContext): RouteContext {
    const resolved = ctx ?? this.defaultCtx;
    const tenantId = String(resolved?.tenantId || '').trim();
    const jurisdiction = String(resolved?.jurisdiction || '').trim();
    const sector = String(resolved?.sector || '').trim();
    if (!tenantId || !jurisdiction || !sector) {
      throw new Error('Route context is required. Provide `ctx` in method call or constructor options.');
    }
    return { tenantId, jurisdiction, sector };
  }

  private requireHostRouteContext(ctx?: HostRouteContext): HostRouteContext {
    const jurisdiction = String(ctx?.jurisdiction || this.defaultCtx?.jurisdiction || '').trim();
    const sector = String(ctx?.sector || this.defaultCtx?.sector || '').trim();
    if (jurisdiction && sector) {
      return { jurisdiction, sector };
    }
    throw new Error('Host route context is required. Provide `ctx` in method call or constructor options.ctx.');
  }

  // ---- Path helpers -------------------------------------------------------
  public v1Path(ctx: RouteContext | undefined, section: V1Section, format: string, resourceType: string, action: V1Action): string { return this.paths.v1Path(ctx, section, format, resourceType, action); }
  public tenantIdentityPath(ctx: RouteContext | undefined, prefix: string, action: string): string { return this.paths.tenantIdentityPath(ctx, prefix, action); }
  public hostRegistryPath(ctx: HostRouteContext | undefined, resourceType: string, action: V1Action): string { return this.paths.hostRegistryPath(ctx, resourceType, action); }
  public hostRegistryOrganizationBatchPath(ctx?: HostRouteContext): string { return this.paths.hostRegistryOrganizationBatchPath(ctx); }
  public hostRegistryOrganizationPollPath(ctx?: HostRouteContext): string { return this.paths.hostRegistryOrganizationPollPath(ctx); }
  public hostRegistryOrganizationActivatePath(ctx?: HostRouteContext): string { return this.paths.hostRegistryOrganizationActivatePath(ctx); }
  public hostRegistryOrganizationActivatePollPath(ctx?: HostRouteContext): string { return this.paths.hostRegistryOrganizationActivatePollPath(ctx); }
  public hostRegistryOrderBatchPath(ctx?: HostRouteContext): string { return this.paths.hostRegistryOrderBatchPath(ctx); }
  public hostRegistryOrderPollPath(ctx?: HostRouteContext): string { return this.paths.hostRegistryOrderPollPath(ctx); }
  public individualFamilyOrganizationBatchPath(ctx?: RouteContext): string { return this.paths.individualFamilyOrganizationBatchPath(ctx); }
  public individualFamilyOrganizationPollPath(ctx?: RouteContext): string { return this.paths.individualFamilyOrganizationPollPath(ctx); }
  public individualFamilyOrganizationSearchPath(ctx?: RouteContext): string { return this.paths.individualFamilyOrganizationSearchPath(ctx); }
  public individualFamilyOrganizationSearchPollPath(ctx?: RouteContext): string { return this.paths.individualFamilyOrganizationSearchPollPath(ctx); }
  public individualFamilyOrderBatchPath(ctx?: RouteContext): string { return this.paths.individualFamilyOrderBatchPath(ctx); }
  public individualFamilyOrderPollPath(ctx?: RouteContext): string { return this.paths.individualFamilyOrderPollPath(ctx); }
  public individualRelatedPersonBatchPath(ctx: RouteContext): string { return this.paths.individualRelatedPersonBatchPath(ctx); }
  public individualRelatedPersonPollPath(ctx: RouteContext): string { return this.paths.individualRelatedPersonPollPath(ctx); }
  public individualObservationBatchPath(ctx: RouteContext): string { return this.paths.individualObservationBatchPath(ctx); }
  public individualObservationPollPath(ctx: RouteContext): string { return this.paths.individualObservationPollPath(ctx); }
  public individualCommunicationBatchPath(ctx: RouteContext, pathFormatSegment: 'org.hl7.fhir.api' | 'org.hl7.fhir.r4' = 'org.hl7.fhir.r4'): string { return this.paths.individualCommunicationBatchPath(ctx, pathFormatSegment); }
  public individualCommunicationPollPath(ctx: RouteContext, pathFormatSegment: 'org.hl7.fhir.api' | 'org.hl7.fhir.r4' = 'org.hl7.fhir.r4'): string { return this.paths.individualCommunicationPollPath(ctx, pathFormatSegment); }
  public individualTaskBatchPath(ctx: RouteContext): string { return this.paths.individualTaskBatchPath(ctx); }
  public individualTaskPollPath(ctx: RouteContext): string { return this.paths.individualTaskPollPath(ctx); }
  public employeeBatchPath(ctx?: RouteContext): string { return this.paths.employeeBatchPath(ctx); }
  public employeePollPath(ctx?: RouteContext): string { return this.paths.employeePollPath(ctx); }
  public individualLegacyPersonBatchPath(ctx: RouteContext): string { return this.paths.individualLegacyPersonBatchPath(ctx); }
  public individualConsentR4BatchPath(ctx: RouteContext): string { return this.paths.individualConsentR4BatchPath(ctx); }
  public individualConsentR4PollPath(ctx: RouteContext): string { return this.paths.individualConsentR4PollPath(ctx); }
  public individualCompositionR4BatchPath(ctx: RouteContext): string { return this.paths.individualCompositionR4BatchPath(ctx); }
  public individualCompositionR4PollPath(ctx: RouteContext): string { return this.paths.individualCompositionR4PollPath(ctx); }
  public digitalTwinCompositionApiBatchPath(ctx: RouteContext): string { return this.paths.digitalTwinCompositionApiBatchPath(ctx); }
  public digitalTwinCompositionApiPollPath(ctx: RouteContext): string { return this.paths.digitalTwinCompositionApiPollPath(ctx); }
  public digitalTwinCompositionR4BatchPath(ctx: RouteContext): string { return this.paths.digitalTwinCompositionR4BatchPath(ctx); }
  public digitalTwinCompositionR4PollPath(ctx: RouteContext): string { return this.paths.digitalTwinCompositionR4PollPath(ctx); }
  public identityDeviceDcrPath(ctx?: RouteContext): string { return this.paths.identityDeviceDcrPath(ctx); }
  public identityDeviceDcrPollPath(ctx?: RouteContext): string { return this.paths.identityDeviceDcrPollPath(ctx); }
  public identityTokenExchangePath(ctx?: RouteContext): string { return this.paths.identityTokenExchangePath(ctx); }
  public identityTokenExchangePollPath(ctx?: RouteContext): string { return this.paths.identityTokenExchangePollPath(ctx); }
  public identityOpenIdSmartTokenPath(ctx?: RouteContext): string { return this.paths.identityOpenIdSmartTokenPath(ctx); }
  public identityOpenIdSmartTokenPollPath(ctx?: RouteContext): string { return this.paths.identityOpenIdSmartTokenPollPath(ctx); }
  public identityLicenseIssuePath(ctx?: RouteContext): string { return this.paths.identityLicenseIssuePath(ctx); }
  public identitySmartTokenPath(ctx: RouteContext): string { return this.paths.identitySmartTokenPath(ctx); }
  public identitySmartTokenPollPath(ctx: RouteContext): string { return this.paths.identitySmartTokenPollPath(ctx); }
  public identityFirebaseCustomPath(ctx: RouteContext): string { return this.paths.identityFirebaseCustomPath(ctx); }
  public identityFirebaseCustomPollPath(ctx: RouteContext): string { return this.paths.identityFirebaseCustomPollPath(ctx); }
  public identityCodePath(ctx: RouteContext): string { return this.paths.identityCodePath(ctx); }
  public identityCodePollPath(ctx: RouteContext): string { return this.paths.identityCodePollPath(ctx); }
  public taskDebugCallStartPath(ctx: RouteContext, format = 'org.hl7.fhir.api'): string { return this.paths.taskDebugCallStartPath(ctx, format); }
  public taskDebugLogsPath(ctx: RouteContext, format = 'org.hl7.fhir.api'): string { return this.paths.taskDebugLogsPath(ctx, format); }
  public conversionUploadPath(ctx: RouteContext, softwareId: string, sourceFormat: string): string { return this.paths.conversionUploadPath(ctx, softwareId, sourceFormat); }
  public conversionUploadPollPath(ctx: RouteContext, softwareId: string, sourceFormat: string): string { return this.paths.conversionUploadPollPath(ctx, softwareId, sourceFormat); }

  // ---- Backend PKCE auth (identity-exchange.v1) -------------------------

  /**
   * Orchestrates the full identity-exchange.v1 backend auth flow:
   * DCR binding → PKCE code → token → SMART bearer exchange.
   *
   * Equivalent to Python connector_sdk `authenticate_backend_pkce_and_exchange`.
   * Results are cached in memory; re-runs automatically on expiry.
   */
  public async authenticateBackendPkceAndExchange(
    options: BackendPkceAuthOptions,
  ): Promise<BackendPkceAuthResult> {
    return this.authRuntime.authenticateBackendPkceAndExchange(options);
  }

  /**
   * Returns the cached SMART bearer for the given endpointId if still valid (>30s remaining).
   * Returns `undefined` if not cached or expired.
   */
  public getCachedBearerToken(tokenCacheKey: string): string | undefined {
    return this.authRuntime.getCachedBearerToken(tokenCacheKey);
  }

  /**
   * smart-backend.v1: obtain an OAuth2 backend token using client_credentials + private_key_jwt.
   */
  public async authenticateBackendSmartStandard(
    options: BackendSmartAuthOptions,
  ): Promise<BackendSmartAuthResult> {
    return this.authRuntime.authenticateBackendSmartStandard(options);
  }

  /**
   * Exchange token payload against gateway token endpoint and cache the result.
   */
  public async requestSmartToken(input: SmartTokenExchangeInput): Promise<SmartTokenExchangeResult> {
    return this.authRuntime.requestSmartToken(input);
  }

  /**
   * Friendly wrapper for SMART token request via GW identity/auth token-exchange route.
   * Uses one object, seconds-based polling, and constructor ctx fallback.
   */
  public async requestSmartTokenSimple(
    input: SmartTokenRequestSimpleInput,
  ): Promise<SmartTokenExchangeResult> {
    const routeCtx = this.requireRouteContext(
      input.tenantId && input.jurisdiction && input.sector
        ? { tenantId: input.tenantId, jurisdiction: input.jurisdiction, sector: input.sector }
        : undefined,
    );
    return this.authRuntime.requestSmartTokenSimple(input, routeCtx);
  }

  // ---- Generic batch API --------------------------------------------------

  /**
   * POST a DIDComm bundle payload.
   * This is the preferred high-level method for DIDComm submission of
   * FHIR/API bundles (batch, transaction, message, etc.).
   *
   * Returns immediately with the HTTP response — pair with `pollUntilComplete` or use `submitAndPoll`.
   */
  public async submitBundle(
    path: string,
    payload: { thid?: string } & Record<string, unknown>,
    options?: {
      mode?: 'plain' | 'strict';
      recipientEncryptionJwk?: PublicJwk;
      walletContext?: WalletContext;
    },
  ): Promise<SubmitResponse> {
    return this.httpRuntime.submitBundle(
      path,
      payload,
      this.submitBatch.bind(this),
      this.submitBatchEncrypted.bind(this),
      options,
    );
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
  public async submitBatch(path: string, payload: unknown): Promise<SubmitResponse> {
    return this.httpRuntime.submitBatch(path, payload);
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
  public async submitBatchEncrypted(
    path: string,
    payload: { thid?: string } & Record<string, unknown>,
    recipientEncryptionJwk: PublicJwk,
    walletContext: WalletContext,
  ): Promise<SubmitResponse> {
    return this.httpRuntime.submitBatchEncrypted(path, payload, recipientEncryptionJwk, walletContext);
  }

  /**
   * POST a plain JSON payload.
   * Use for non-DIDComm routes (e.g. token exchange body, API key management).
   * Content-Type: `application/json`.
   */
  public async postJson(path: string, payload: unknown): Promise<SubmitResponse> {
    return this.httpRuntime.postJson(path, payload);
  }

  /**
   * Legacy JSON submit for non-bundle payloads (openid/token/resource JSON bodies).
   * Keeps JSON flows explicit and semantically separated from DIDComm bundle flows.
   */
  public async submitLegacyJson(path: string, payload: unknown): Promise<SubmitResponse> {
    return this.httpRuntime.submitLegacyJson(path, payload);
  }

  /**
   * POST a multipart/form-data payload.
   * Use for file upload endpoints. Prefer `uploadConversionFile` for DataConversion uploads.
   */
  public async postFormData(path: string, formData: FormData): Promise<SubmitResponse> {
    return this.httpRuntime.postFormData(path, formData);
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
  public async uploadConversionFile(params: {
    path: string;
    fileName: string;
    fileContent: Blob | Buffer | Uint8Array | ArrayBuffer;
    fileFieldName?: string;
    fields?: Record<string, string>;
  }): Promise<SubmitResponse> {
    return this.httpRuntime.uploadConversionFile(params);
  }

  /**
   * Single poll attempt against a `_batch-response` or `_*-response` path.
   * Returns HTTP 202 while the job is still processing, 200 (or other) when done.
   * Prefer `pollUntilComplete` for automatic retry loops.
   */
  public async pollBatchResponse(
    path: string,
    request: AsyncPollRequest,
  ): Promise<{ status: number; body: unknown; retryAfterMs?: number }> {
    return this.httpRuntime.pollBatchResponse(path, request);
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
  public async submitAndPoll(
    submitPath: string,
    pollPath: string,
    payload: { thid?: string } & Record<string, unknown>,
    options?: PollOptions,
  ): Promise<SubmitAndPollResult> {
    return this.httpRuntime.submitAndPoll(submitPath, pollPath, payload, options);
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
  public async createPhoneReminderTasks(
    ctx: RouteContext | undefined,
    input: CreatePhoneReminderTasksInput,
    options?: PollOptions,
  ): Promise<SubmitAndPollResult> {
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

      const claims: Record<string, string> = {
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

      if (input.locale) claims.language = String(input.locale);
      if (input.subjectDisplay) claims['subject-display'] = String(input.subjectDisplay);
      if (reminderSummary) claims['based-on-display'] = reminderSummary;
      if (input.notificationPhone) claims['subject-phone'] = String(input.notificationPhone);
      if (input.controllerPhone) claims['owner-phone'] = String(input.controllerPhone);
      if (input.callSid) claims['communication-request'] = String(input.callSid);

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

    return this.submitAndPoll(
      this.individualTaskBatchPath(routeCtx),
      this.individualTaskPollPath(routeCtx),
      payload,
      options ?? { timeoutMs: 20_000, intervalMs: 1_000 },
    );
  }

  /** Endpoint path for medication overlap pre-check (planned GW contract). */
  public individualMedicationOverlapCheckPath(ctx: RouteContext): string { return this.paths.individualMedicationOverlapCheckPath(ctx); }

  /**
   * Pre-create overlap check for medication intake schedules.
   * TODO: Requires GW endpoint implementation (`MedicationStatement/_overlap-check`).
   */
  public async checkMedicationScheduleOverlap(
    ctx: RouteContext,
    input: MedicationOverlapCheckInput,
  ): Promise<SubmitResponse> {
    const payload = createDidcommPlainMessage({
      iss: ctx.tenantId,
      aud: ctx.tenantId,
      thid: `med-overlap-${randomUUID()}`,
      body: input as unknown as Record<string, unknown>,
    });
    return this.submitBatch(this.individualMedicationOverlapCheckPath(ctx), payload);
  }

  /**
   * High-level helper for medication reminder creation.
   * This creates one Task per explicit intake time and delegates reminder execution to GW daemon.
   * TODO: recurring interval expansion + overlap policy should be finalized in GW endpoint contract.
   */
  public async createMedicationReminderTasks(
    ctx: RouteContext,
    input: MedicationRegistrationInput,
    options?: PollOptions,
  ): Promise<SubmitAndPollResult> {
    const claims = (input.claims || {}) as Record<string, unknown>;
    const claimStart = String(
      claims[MedicationStatementClaimsFhirApiExtended.TimingBoundsPeriodStart] ||
      claims['MedicationStatement.timing-bounds-period-start'] ||
      claims[MedicationStatementClaimsFhirApi.Effective] ||
      claims['MedicationStatement.effective'] ||
      claims['DosageDetails.start'] ||
      claims['MedicationDetails.start'] ||
      '',
    ).trim();
    const claimTimeOfDay =
      claims[MedicationStatementClaimsFhirApiExtended.TimingTimeOfDay] ??
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

    const medicationDescription = String(
      input.medicationDescription ||
      claims[MedicationStatementClaimsFhirApi.Medication] ||
      claims['MedicationStatement.medication'] ||
      claims['MedicationStatement.medication-display'] ||
      'Medication',
    ).trim();
    const doseValue = String(
      input.doseValue ||
      claims[MedicationStatementClaimsFhirApiExtended.DoseQuantityValue] ||
      claims['MedicationStatement.dose-quantity-value'] ||
      claims['Dosage.quantity-value'] ||
      '',
    ).trim();
    const doseUnitOrFormCode = String(
      input.doseUnitOrFormCode ||
      claims[MedicationStatementClaimsFhirApiExtended.DoseQuantityUnit] ||
      claims['MedicationStatement.dose-quantity-unit'] ||
      claims[MedicationStatementClaimsFhirApiExtended.DoseType] ||
      claims['MedicationStatement.dose-type'] ||
      claims['Dosage.quantity-unit'] ||
      claims['Dosage.form'] ||
      '',
    ).trim();

    const summary = `${medicationDescription} ${doseValue}${doseUnitOrFormCode ? ` ${doseUnitOrFormCode}` : ''}`.trim();
    return this.createPhoneReminderTasks(
      ctx,
      {
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
      },
      options,
    );
  }

  /**
   * Search for an existing family Organization registration by phone + usualname.
   * Submits to `individual/org.schema/Organization/_search`, polls for the result, and
   * parses the bundle entry into a `FamilyOrganizationSummary`.
   *
   * Returns `null` when no matching registration exists.
   */
  public async searchFamilyOrganization(
    ctx: RouteContext | undefined,
    filters: { controllerPhone: string; usualname: string; birthDate?: string },
    options?: PollOptions,
  ): Promise<FamilyOrganizationSummary | null> {
    const routeCtx = this.requireRouteContext(ctx);
    const thid = `search-${randomUUID()}`;
    const claims: Record<string, unknown> = {
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
          meta: { claims }, // deprecated compatibility
          resource: { meta: { claims } },
        }],
      },
    };

    const result = await this.submitAndPoll(
      this.individualFamilyOrganizationSearchPath(routeCtx),
      this.individualFamilyOrganizationSearchPollPath(routeCtx),
      payload,
      options ?? { timeoutMs: 20_000, intervalMs: 1_000 },
    );

    if (result.poll.status !== 200) return null;
    const entry = (result.poll.body as any)?.body?.data?.[0];
    if (!entry) return null;

    const entryClaims = entry.resource?.meta?.claims || entry.meta?.claims || {};
    const status = entryClaims['org.schema.FamilyRegistration.status'] as FamilyRegistrationStatus | undefined;
    if (!status || status === 'not_found') return null;

    const subjectInfo: any = {
      identifierType: entryClaims['org.schema.Organization.identifier.additionalType'] as string | undefined,
      identifierValue: entryClaims['org.schema.Organization.identifier.value'] as string | undefined,
      nickname: entryClaims['org.schema.Organization.alternateName'] as string | undefined,
      birthDate: entryClaims['org.schema.Organization.foundingDate'] as string | undefined,
      telephone: entryClaims['org.schema.Organization.owner.telephone'] as string | undefined,
    };

    return {
      status,
      offerId: entryClaims['org.schema.Offer.identifier'] as string | undefined,
      organizationId: entry.resource?.id as string | undefined,
      subjectInfo,
    };
  }

  /**
   * Activate tenant organization in GW from ICA-derived proof.
   */
  public async activateOrganizationInGatewayFromIcaProof(
    ctx: HostRouteContext | undefined,
    input: GatewayOrganizationActivationInput,
    options?: PollOptions,
  ): Promise<SubmitAndPollResult> {
    if (!input?.vpToken && !input?.vp) {
      throw new Error('activateOrganizationInGatewayFromIcaProof requires vpToken or vp.');
    }

    const claims: Record<string, unknown> = {
      '@context': 'org.schema',
      ...(input.additionalClaims || {}),
    };
    const requestedMembers = Number.isFinite(Number(input.numberOfMembers))
      ? Math.max(1, Math.floor(Number(input.numberOfMembers)))
      : 2;
    // Keep gateway-facing claim stable while exposing a generic SDK input.
    claims['org.schema.Organization.numberOfEmployees'] = requestedMembers;
    // Credentials are expected inside VP proof (vp_token / vp), not duplicated as side-fields.
    if (input.regulatoryEvidence) claims['org.schema.Organization.regulatoryEvidence'] = input.regulatoryEvidence;

    const payload = createDidcommPlainMessage({
      iss: 'did:web:controller.example.com',
      aud: 'did:web:host.example.com',
      body: {
        data: [
          {
            type: 'Organization-activation-request-v1.0',
            ...(input.vpToken ? { vp_token: input.vpToken } : {}),
            ...(input.vp ? { vp: input.vp } : {}),
            meta: { claims }, // deprecated compatibility
            resource: { meta: { claims } },
          },
        ],
      },
    });

    return this.submitAndPoll(
      this.hostRegistryOrganizationActivatePath(ctx),
      this.hostRegistryOrganizationActivatePollPath(ctx),
      payload,
      options,
    );
  }

  /**
   * Friendly wrapper for legal organization activation.
   * Accepts one object and seconds-based polling options for integrator ergonomics.
   */
  public async activateOrganizationInGatewaySimple(
    input: GatewayOrganizationActivationSimpleInput,
  ): Promise<SubmitAndPollResult> {
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

    const hostCtx = this.requireHostRouteContext(
      input.jurisdiction && input.sector
        ? { jurisdiction: input.jurisdiction, sector: input.sector }
        : undefined,
    );
    const implicitClaims: Record<string, unknown> = {
      'org.schema.Service.category': hostCtx.sector,
      'org.schema.Service.identifier': resolvedServiceDid,
      ...(serviceProviderUrl ? { 'org.schema.Service.url': serviceProviderUrl } : {}),
      [ClaimsPersonSchemaorg.hasOccupation]: controllerRole,
      ...(controllerEmail ? { [ClaimsPersonSchemaorg.email]: controllerEmail } : {}),
      ...(controllerTelephone ? { [ClaimsPersonSchemaorg.telephone]: controllerTelephone } : {}),
    };

    const activation = await this.activateOrganizationInGatewayFromIcaProof(
      hostCtx,
      {
        vpToken: input.vpToken,
        vp: input.vp,
        numberOfMembers: input.numberOfMembers,
        regulatoryEvidence: input.regulatoryEvidence,
        additionalClaims: { ...implicitClaims, ...(input.additionalClaims || {}) },
      },
      pollOptions,
    );
    this.assertFirstDidcommEntrySuccess(activation, 'activateOrganizationInGatewaySimple');
    return activation;
  }

  /**
   * Friendly wrapper for legal organization Order confirmation.
   * Accepts one object and builds payload/paths internally.
   */
  public async confirmLegalOrganizationOrderSimple(
    input: LegalOrganizationOrderSimpleInput,
  ): Promise<SubmitAndPollResult> {
    const hostCtx = this.requireHostRouteContext(
      input.jurisdiction && input.sector
        ? { jurisdiction: input.jurisdiction, sector: input.sector }
        : undefined,
    );
    const order = await confirmLegalOrganizationOrderSimpleWithDeps({
      input,
      hostCtx,
      defaultTimeoutMs: this.defaultTimeoutMs,
      defaultIntervalMs: this.defaultIntervalMs,
      hostRegistryOrderBatchPath: (ctx) => this.hostRegistryOrderBatchPath(ctx),
      hostRegistryOrderPollPath: (ctx) => this.hostRegistryOrderPollPath(ctx),
      submitAndPoll: this.submitAndPoll.bind(this),
    });
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
  public getDidcommMessageBodyFromResponse(
    result: SubmitAndPollResult | PollResult | unknown,
  ): Record<string, unknown> | undefined {
    return this.responseHelpers.getDidcommMessageBodyFromResponse(result);
  }

  /**
   * Return first DIDComm business entry from a submit/poll result.
   */
  public getFirstDidcommDataEntryFromResponse(
    result: SubmitAndPollResult | PollResult | unknown,
  ): Record<string, unknown> | undefined {
    return this.responseHelpers.getFirstDidcommDataEntryFromResponse(result);
  }

  /**
   * Extract `org.schema.Offer.identifier` from a submit/poll result.
   *
   * This helper normalizes canonical and legacy claim locations.
   */
  public getOfferIdFromResponse(result: SubmitAndPollResult | PollResult | unknown): string | undefined {
    return this.responseHelpers.getOfferIdFromResponse(result);
  }

  /**
   * Extract a UI-ready Offer preview from activation/registration responses.
   */
  public getOfferPreviewFromResponse(result: SubmitAndPollResult | PollResult | unknown): OfferPreview {
    return this.responseHelpers.getOfferPreviewFromResponse(result);
  }

  /**
   * Alias of `getOfferPreviewFromResponse` with business naming.
   */
  public getOfferInfoFromResponse(result: SubmitAndPollResult | PollResult | unknown): OfferInfo {
    return this.responseHelpers.getOfferInfoFromResponse(result);
  }

  /**
   * Extract activation code from response payload or claims.
   * Supports common response shapes used in onboarding and license issuance flows.
   */
  public getActivationCodeFromResponse(result: SubmitAndPollResult | PollResult | unknown): string | undefined {
    return this.responseHelpers.getActivationCodeFromResponse(result);
  }

  /**
   * Throws when first DIDComm entry contains a business-level error status.
   */
  public assertFirstDidcommEntrySuccess(
    result: SubmitAndPollResult | PollResult | unknown,
    contextLabel: string,
  ): void {
    return this.responseHelpers.assertFirstDidcommEntrySuccess(result, contextLabel);
  }

  /**
   * Activate employee/member device by activation code exchange + DCR registration.
   *
   * Step 1. Exchange activation code using user id_token to obtain an initial access token.
   * Step 2. Register device keys through Device/_dcr authorized by that initial token.
   */
  public async activateEmployeeDeviceWithActivationCode(
    ctx: RouteContext | undefined,
    input: EmployeeDeviceActivationInput,
  ): Promise<EmployeeDeviceActivationResult> {
    const routeCtx = this.requireRouteContext(ctx);
    return activateEmployeeDeviceWithActivationCodeWithDeps({
      routeCtx,
      input,
      identityTokenExchangePath: (resolvedCtx) => this.identityTokenExchangePath(resolvedCtx),
      identityTokenExchangePollPath: (resolvedCtx) => this.identityTokenExchangePollPath(resolvedCtx),
      identityDeviceDcrPath: (resolvedCtx) => this.identityDeviceDcrPath(resolvedCtx),
      identityDeviceDcrPollPath: (resolvedCtx) => this.identityDeviceDcrPollPath(resolvedCtx),
      submitAndPollWithBearerToken: (bearerToken, submitPath, pollPath, payload, pollOptions) => {
        const scopedClient = new DataspaceNodeClient({
          baseUrl: this.baseUrl,
          bearerToken,
          defaultHeaders: this.defaultHeaders,
          wallet: this.wallet,
        });
        return scopedClient.submitAndPoll(submitPath, pollPath, payload, pollOptions);
      },
    });
  }

  /**
   * Friendly wrapper for employee/member device activation.
   * Uses one object, seconds-based polling, and constructor ctx fallback.
   */
  public async activateEmployeeDeviceWithActivationCodeSimple(
    input: EmployeeDeviceActivationSimpleInput,
  ): Promise<EmployeeDeviceActivationResult> {
    const routeCtx = this.requireRouteContext(
      input.tenantId && input.jurisdiction && input.sector
        ? { tenantId: input.tenantId, jurisdiction: input.jurisdiction, sector: input.sector }
        : undefined,
    );
    return activateEmployeeDeviceWithActivationCodeSimpleWithDeps({
      routeCtx,
      input,
      defaultTimeoutMs: this.defaultTimeoutMs,
      defaultIntervalMs: this.defaultIntervalMs,
      activateEmployeeDeviceWithActivationCode: this.activateEmployeeDeviceWithActivationCode.bind(this),
    });
  }

  /**
   * UC 5.3 wrapper: create organization employee in entity Employee batch route.
   */
  public async createOrganizationEmployee(
    ctx: RouteContext | undefined,
    input: OrganizationEmployeeCreationInput,
    options?: PollOptions,
  ): Promise<SubmitAndPollResult> {
    const routeCtx = this.requireRouteContext(ctx);
    return createOrganizationEmployeeWithDeps(routeCtx, input, options, {
      employeeBatchPath: (resolvedCtx) => this.employeeBatchPath(resolvedCtx),
      employeePollPath: (resolvedCtx) => this.employeePollPath(resolvedCtx),
      submitAndPoll: this.submitAndPoll.bind(this),
    });
  }

  /**
   * Legacy generic helper: bootstrap subject organization context via registration + optional order confirmation.
   * This is not the canonical production E2E contract; prefer explicit step-by-step runtime flows.
   */
  public async bootstrapSubjectOrganizationIndex(
    ctx: RouteContext | undefined,
    input: SubjectOrganizationBootstrapInput,
  ): Promise<SubjectOrganizationBootstrapResult> {
    const registrationPayload = {
      thid: input.registrationPayload.thid || `family-org-${randomUUID()}`,
      ...input.registrationPayload,
    };

    const registration = await this.submitAndPoll(
      this.individualFamilyOrganizationBatchPath(ctx),
      this.individualFamilyOrganizationPollPath(ctx),
      registrationPayload,
      input.pollOptions,
    );

    if (!input.confirmationPayload) {
      return { registration };
    }

    const confirmationPayload = {
      thid: input.confirmationPayload.thid || `family-order-${randomUUID()}`,
      ...input.confirmationPayload,
    };

    const confirmation = await this.submitAndPoll(
      this.individualFamilyOrderBatchPath(ctx),
      this.individualFamilyOrderPollPath(ctx),
      confirmationPayload,
      input.pollOptions,
    );

    return { registration, confirmation };
  }

  /**
   * Friendly wrapper (recommended step 1): register individual organization and return Offer.
   */
  public async startIndividualOrganizationSimple(
    input: IndividualOrganizationBootstrapSimpleInput,
  ): Promise<IndividualOrganizationStartSimpleResult> {
    const routeCtx = this.requireRouteContext(
      input.tenantId && input.jurisdiction && input.sector
        ? { tenantId: input.tenantId, jurisdiction: input.jurisdiction, sector: input.sector }
        : undefined,
    );
    return startIndividualOrganizationSimpleWithDeps({
      input,
      routeCtx,
      defaultTimeoutMs: this.defaultTimeoutMs,
      defaultIntervalMs: this.defaultIntervalMs,
      individualFamilyOrganizationBatchPath: (ctx) => this.individualFamilyOrganizationBatchPath(ctx),
      individualFamilyOrganizationPollPath: (ctx) => this.individualFamilyOrganizationPollPath(ctx),
      submitAndPoll: this.submitAndPoll.bind(this),
      assertFirstDidcommEntrySuccess: this.assertFirstDidcommEntrySuccess.bind(this),
      getOfferIdFromResponse: this.getOfferIdFromResponse.bind(this),
      getOfferPreviewFromResponse: this.getOfferPreviewFromResponse.bind(this),
    });
  }

  /**
   * Friendly wrapper (recommended step 2): confirm individual/family order from accepted offerId.
   */
  public async confirmIndividualOrganizationOrderSimple(
    input: IndividualOrganizationConfirmOrderSimpleInput,
  ): Promise<SubmitAndPollResult> {
    const routeCtx = this.requireRouteContext(
      input.tenantId && input.jurisdiction && input.sector
        ? { tenantId: input.tenantId, jurisdiction: input.jurisdiction, sector: input.sector }
        : undefined,
    );
    const confirmation = await confirmIndividualOrganizationOrderSimpleWithDeps({
      input,
      routeCtx,
      defaultTimeoutMs: this.defaultTimeoutMs,
      defaultIntervalMs: this.defaultIntervalMs,
      individualFamilyOrderBatchPath: (ctx) => this.individualFamilyOrderBatchPath(ctx),
      individualFamilyOrderPollPath: (ctx) => this.individualFamilyOrderPollPath(ctx),
      submitAndPoll: this.submitAndPoll.bind(this),
    });
    this.assertFirstDidcommEntrySuccess(confirmation, 'confirmIndividualOrganizationOrderSimple');
    return confirmation;
  }

  /**
   * @deprecated Legacy compatibility helper for zero-price/demo/test composition only.
   * Not a real production onboarding contract.
   * Prefer explicit `startIndividualOrganizationSimple` + user-visible offer acceptance
   * + `confirmIndividualOrganizationOrderSimple`.
   */
  public async bootstrapIndividualOrganizationSimple(
    input: IndividualOrganizationBootstrapSimpleInput,
  ): Promise<IndividualOrganizationBootstrapSimpleResult> {
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
  public async importIpsOrFhirAndUpdateIndex(
    ctx: RouteContext | undefined,
    input: IpsOrFhirImportInput,
  ): Promise<SubmitAndPollResult> {
    const routeCtx = this.requireRouteContext(ctx);
    return importIpsOrFhirAndUpdateIndexWithDeps(routeCtx, input, {
      individualCompositionR4BatchPath: (resolvedCtx) => this.individualCompositionR4BatchPath(resolvedCtx),
      individualCompositionR4PollPath: (resolvedCtx) => this.individualCompositionR4PollPath(resolvedCtx),
      submitAndPoll: this.submitAndPoll.bind(this),
    });
  }

  /**
   * RelatedPerson wrapper: submit contact payload and poll until completion.
   */
  public async upsertRelatedPersonAndPoll(
    ctx: RouteContext | undefined,
    input: RelatedPersonUpsertInput,
  ): Promise<SubmitAndPollResult> {
    const routeCtx = this.requireRouteContext(ctx);
    return upsertRelatedPersonAndPollWithDeps(routeCtx, input, {
      individualRelatedPersonBatchPath: (resolvedCtx) => this.individualRelatedPersonBatchPath(resolvedCtx),
      individualRelatedPersonPollPath: (resolvedCtx) => this.individualRelatedPersonPollPath(resolvedCtx),
      submitAndPoll: this.submitAndPoll.bind(this),
    });
  }

  /**
   * Ingestion wrapper: submit Communication payload and let GW process/update index asynchronously.
   * Use `pathFormatSegment` to select target format path.
   * Defaults to `org.hl7.fhir.api`.
   */
  public async ingestCommunicationAndUpdateIndex(
    ctx: RouteContext | undefined,
    input: CommunicationIngestionInput,
  ): Promise<SubmitAndPollResult> {
    const routeCtx = this.requireRouteContext(ctx);
    return ingestCommunicationAndUpdateIndexWithDeps(routeCtx, input, {
      individualCommunicationBatchPath: (resolvedCtx, pathFormatSegment) => this.individualCommunicationBatchPath(resolvedCtx, pathFormatSegment),
      individualCommunicationPollPath: (resolvedCtx, pathFormatSegment) => this.individualCommunicationPollPath(resolvedCtx, pathFormatSegment),
      transformPayloadForFhirR4: maybeConvertCommunicationClaimsToFhirR4Payload,
      submitAndPoll: this.submitAndPoll.bind(this),
    });
  }

  /**
   * UC 5.6 consent helper from minimal frontend fields.
   * Builds canonical Consent claims and submits/polls the Consent batch.
   */
  public async grantProfessionalAccessSimple(
    ctx: RouteContext | undefined,
    input: GrantProfessionalAccessSimpleInput,
  ): Promise<GrantProfessionalAccessSimpleResult> {
    const routeCtx = this.requireRouteContext(ctx);
    return grantProfessionalAccessSimpleWithDeps(routeCtx, input, {
      buildConsentClaimsSimpleWithCid: buildConsentClaimsSimpleWithCid as any,
      individualConsentR4BatchPath: (resolvedCtx) => this.individualConsentR4BatchPath(resolvedCtx),
      individualConsentR4PollPath: (resolvedCtx) => this.individualConsentR4PollPath(resolvedCtx),
      submitAndPoll: this.submitAndPoll.bind(this),
    });
  }

  /**
   * UC 5.7 wrapper: generate digital twin composition from subject data.
   */
  public async generateDigitalTwinFromSubjectData(
    ctx: RouteContext | undefined,
    input: DigitalTwinGenerationInput,
  ): Promise<SubmitAndPollResult> {
    const routeCtx = this.requireRouteContext(ctx);
    return generateDigitalTwinFromSubjectDataWithDeps(routeCtx, input, {
      digitalTwinCompositionApiBatchPath: (resolvedCtx) => this.digitalTwinCompositionApiBatchPath(resolvedCtx),
      digitalTwinCompositionApiPollPath: (resolvedCtx) => this.digitalTwinCompositionApiPollPath(resolvedCtx),
      digitalTwinCompositionR4BatchPath: (resolvedCtx) => this.digitalTwinCompositionR4BatchPath(resolvedCtx),
      digitalTwinCompositionR4PollPath: (resolvedCtx) => this.digitalTwinCompositionR4PollPath(resolvedCtx),
      submitAndPoll: this.submitAndPoll.bind(this),
    });
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
  public async pollUntilComplete(path: string, request: AsyncPollRequest, options?: PollOptions): Promise<PollResult> {
    return this.httpRuntime.pollUntilComplete(path, request, options);
  }

}
