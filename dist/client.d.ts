import type { AsyncPollRequest, BackendPkceAuthOptions, BackendPkceAuthResult, BackendSmartAuthOptions, BackendSmartAuthResult, ClientOptions, CreatePhoneReminderTasksInput, GrantProfessionalAccessSimpleInput, GrantProfessionalAccessSimpleResult, DigitalTwinGenerationInput, EmployeeDeviceActivationInput, EndpointSelector, EmployeeDeviceActivationSimpleInput, EmployeeDeviceActivationResult, FamilyOrganizationSummary, GatewayOrganizationActivationInput, GatewayOrganizationActivationSimpleInput, HostRouteContext, IpsOrFhirImportInput, MedicationOverlapCheckInput, MedicationRegistrationInput, OrganizationEmployeeCreationInput, PollOptions, PollResult, OfferPreview, OfferInfo, RouteContext, SmartTokenExchangeInput, SmartTokenExchangeResult, SmartTokenRequestSimpleInput, LegalOrganizationOrderSimpleInput, SubjectOrganizationBootstrapInput, SubjectOrganizationBootstrapResult, IndividualOrganizationBootstrapSimpleInput, IndividualOrganizationBootstrapSimpleResult, IndividualOrganizationStartSimpleResult, IndividualOrganizationConfirmOrderSimpleInput, SubmitAndPollResult, SubmitResponse, V1Action, V1Section } from './types.js';
import type { WalletProvider } from './sdk/dataspace-wallet-sdk-node/provider.js';
import type { PublicJwk, WalletContext } from './sdk/dataspace-wallet-sdk-node/types.js';
export declare class DataspaceNodeClient {
    private readonly baseUrl;
    private readonly bearerToken?;
    private readonly defaultHeaders;
    private readonly wallet?;
    private defaultCtx?;
    private defaultTimeoutMs?;
    private defaultIntervalMs?;
    private readonly _tokenCache;
    constructor(options: ClientOptions);
    getWallet(): WalletProvider | undefined;
    /**
     * Set default route context for subsequent calls.
     */
    setContext(ctx: RouteContext): this;
    /**
     * Preferred alias for organization/tenant integration context.
     */
    setContextOrg(ctx: RouteContext): this;
    setTenantId(tenantId: string): this;
    setJurisdiction(jurisdiction: string): this;
    setSector(sector: string): this;
    setDefaultTimeoutSeconds(seconds: number): this;
    setDefaultIntervalSeconds(seconds: number): this;
    /**
     * Builds a deterministic endpoint id for token cache and auth/session reuse.
     * If `providerDid` is provided, returns a full DID service id:
     *   did:web:...#section:format:resourceType:action
     * Otherwise returns the canonical fragment without '#':
     *   section:format:resourceType:action
     */
    getEndpointId(selector: EndpointSelector, providerDid?: string): string;
    private resolveSimplePollOptions;
    private requireRouteContext;
    private requireHostRouteContext;
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
    v1Path(ctx: RouteContext | undefined, section: V1Section, format: string, resourceType: string, action: V1Action): string;
    /**
     * Generic tenant-scoped identity route builder.
     * Pattern: `/{prefix}/cds-{jurisdiction}/v1/{sector}/{tenantId}/identity/auth/{action}`
     *
     * The `prefix` is service-specific: `host` for GW, `publisher` for DataConv, `ica` for ICA.
     * Dedicated path methods in this SDK use `host` (GW convention).
     */
    tenantIdentityPath(ctx: RouteContext | undefined, prefix: string, action: string): string;
    /**
     * Generic host registry route builder (tenant-agnostic, `host/` prefix).
     * Use for controller-level registry operations (Organization activate, Order, etc.).
     *
     * Pattern: `/host/cds-{jurisdiction}/v1/{sector}/registry/org.schema/{resourceType}/{action}`
     */
    hostRegistryPath(ctx: HostRouteContext | undefined, resourceType: string, action: V1Action): string;
    /** Submit path: host registry Organization batch (controller-level org registration). */
    hostRegistryOrganizationBatchPath(ctx?: HostRouteContext): string;
    /** Poll path: host registry Organization batch. Pair with `hostRegistryOrganizationBatchPath`. */
    hostRegistryOrganizationPollPath(ctx?: HostRouteContext): string;
    /** Submit path: activate a tenant Organization in the GW registry using a VC from ICA. */
    hostRegistryOrganizationActivatePath(ctx?: HostRouteContext): string;
    /** Poll path: `_activate` response. Pair with `hostRegistryOrganizationActivatePath`. */
    hostRegistryOrganizationActivatePollPath(ctx?: HostRouteContext): string;
    /** Submit path: host registry Order batch (controller-level order submission). */
    hostRegistryOrderBatchPath(ctx?: HostRouteContext): string;
    /** Poll path: host registry Order batch. Pair with `hostRegistryOrderBatchPath`. */
    hostRegistryOrderPollPath(ctx?: HostRouteContext): string;
    /**
     * Submit path: individual/family Organization onboarding (`org.schema/Organization/_batch`).
     * Use for `family-registration/_create-or-resume` DIDComm payloads.
     */
    individualFamilyOrganizationBatchPath(ctx?: RouteContext): string;
    /** Poll path: individual/family Organization. Pair with `individualFamilyOrganizationBatchPath`. */
    individualFamilyOrganizationPollPath(ctx?: RouteContext): string;
    /** Submit path: individual/family Organization search (`org.schema/Organization/_search`). */
    individualFamilyOrganizationSearchPath(ctx?: RouteContext): string;
    /** Poll path: individual/family Organization search. Pair with `individualFamilyOrganizationSearchPath`. */
    individualFamilyOrganizationSearchPollPath(ctx?: RouteContext): string;
    /** Submit path: individual/family Order batch (`org.schema/Order/_batch`). */
    individualFamilyOrderBatchPath(ctx?: RouteContext): string;
    /** Poll path: individual/family Order. Pair with `individualFamilyOrderBatchPath`. */
    individualFamilyOrderPollPath(ctx?: RouteContext): string;
    /** Submit path: individual RelatedPerson (FHIR R4 API, `org.hl7.fhir.api/RelatedPerson/_batch`). */
    individualRelatedPersonBatchPath(ctx: RouteContext): string;
    /** Poll path: individual RelatedPerson. Pair with `individualRelatedPersonBatchPath`. */
    individualRelatedPersonPollPath(ctx: RouteContext): string;
    /** Submit path: individual Observation (FHIR R4 API, `org.hl7.fhir.api/Observation/_batch`). */
    individualObservationBatchPath(ctx: RouteContext): string;
    /** Poll path: individual Observation. Pair with `individualObservationBatchPath`. */
    individualObservationPollPath(ctx: RouteContext): string;
    /** Submit path: individual Communication (FHIR R4, `org.hl7.fhir.r4/Communication/_batch`). */
    individualCommunicationBatchPath(ctx: RouteContext): string;
    /** Poll path: individual Communication. Pair with `individualCommunicationBatchPath`. */
    individualCommunicationPollPath(ctx: RouteContext): string;
    /** Submit path: individual Task (FHIR R4 API, `org.hl7.fhir.api/Task/_batch`). */
    individualTaskBatchPath(ctx: RouteContext): string;
    /** Poll path: individual Task. Pair with `individualTaskBatchPath`. */
    individualTaskPollPath(ctx: RouteContext): string;
    /** Submit path: entity Employee (`entity/org.schema/Employee/_batch`). */
    employeeBatchPath(ctx?: RouteContext): string;
    /** Poll path: entity Employee. Pair with `employeeBatchPath`. */
    employeePollPath(ctx?: RouteContext): string;
    /** Submit path: individual Person legacy format (`individual/org.schema/Person/_batch`). Use for older flows; prefer Organization for family onboarding. */
    individualLegacyPersonBatchPath(ctx: RouteContext): string;
    /** Submit path: individual Consent (FHIR R4, `org.hl7.fhir.r4/Consent/_batch`). */
    individualConsentR4BatchPath(ctx: RouteContext): string;
    /** Poll path: individual Consent R4. Pair with `individualConsentR4BatchPath`. */
    individualConsentR4PollPath(ctx: RouteContext): string;
    /** Submit path: individual Composition (FHIR R4, `org.hl7.fhir.r4/Composition/_batch`). */
    individualCompositionR4BatchPath(ctx: RouteContext): string;
    /** Poll path: individual Composition R4. Pair with `individualCompositionR4BatchPath`. */
    individualCompositionR4PollPath(ctx: RouteContext): string;
    /** Submit path: digital twin Composition (FHIR API format, `digitaltwin/org.hl7.fhir.api/Composition/_batch`). */
    digitalTwinCompositionApiBatchPath(ctx: RouteContext): string;
    /** Poll path: digital twin Composition API. Pair with `digitalTwinCompositionApiBatchPath`. */
    digitalTwinCompositionApiPollPath(ctx: RouteContext): string;
    /** Submit path: digital twin Composition (FHIR R4 format, `digitaltwin/org.hl7.fhir.r4/Composition/_batch`). */
    digitalTwinCompositionR4BatchPath(ctx: RouteContext): string;
    /** Poll path: digital twin Composition R4. Pair with `digitalTwinCompositionR4BatchPath`. */
    digitalTwinCompositionR4PollPath(ctx: RouteContext): string;
    /**
     * Submit path: identity DCR step — binds API key to service public JWK.
     * Used internally by `authenticateBackendPkceAndExchange` (step 1 of identity-exchange.v1).
     */
    identityDeviceDcrPath(ctx?: RouteContext): string;
    /** Poll path: identity DCR. Pair with `identityDeviceDcrPath`. */
    identityDeviceDcrPollPath(ctx?: RouteContext): string;
    /**
     * Submit path: identity token exchange — id_token → SMART bearer.
     * Used internally by `authenticateBackendPkceAndExchange` (step 4 of identity-exchange.v1).
     */
    identityTokenExchangePath(ctx?: RouteContext): string;
    /** Poll path: identity token exchange. Pair with `identityTokenExchangePath`. */
    identityTokenExchangePollPath(ctx?: RouteContext): string;
    /** Submit path: identity license issue (`identity/auth/_issue`). */
    identityLicenseIssuePath(ctx?: RouteContext): string;
    /**
     * Submit path: SMART token step — code + code_verifier → id_token.
     * Used internally by `authenticateBackendPkceAndExchange` (step 3 of identity-exchange.v1).
     */
    identitySmartTokenPath(ctx: RouteContext): string;
    /** Poll path: SMART token. Pair with `identitySmartTokenPath`. */
    identitySmartTokenPollPath(ctx: RouteContext): string;
    /** Submit path: Firebase custom token exchange (end-user device flow, NOT B2B). */
    identityFirebaseCustomPath(ctx: RouteContext): string;
    /** Poll path: Firebase custom token. Pair with `identityFirebaseCustomPath`. */
    identityFirebaseCustomPollPath(ctx: RouteContext): string;
    /**
     * Submit path: identity PKCE code step — sends S256 code_challenge.
     * Used internally by `authenticateBackendPkceAndExchange` (step 2 of identity-exchange.v1).
     */
    identityCodePath(ctx: RouteContext): string;
    /** Poll path: identity PKCE code. Pair with `identityCodePath`. */
    identityCodePollPath(ctx: RouteContext): string;
    /** Submit path: UHC debug task call-start (`individual/{format}/Task/_call-start`). For telephony integration testing. */
    taskDebugCallStartPath(ctx: RouteContext, format?: string): string;
    /** Path: UHC debug task logs (`individual/{format}/Task/_logs`). Retrieve async task execution logs. */
    taskDebugLogsPath(ctx: RouteContext, format?: string): string;
    /**
     * Submit path: DataConversion file upload.
     * Pattern: `/{tenantId}/cds-{jurisdiction}/v1/{sector}/conversion/{softwareId}/{sourceFormat}/_upload`
     * Use with `uploadConversionFile` to send a file (e.g. XLSX) for async processing.
     */
    conversionUploadPath(ctx: RouteContext, softwareId: string, sourceFormat: string): string;
    /** Poll path: DataConversion upload. Pair with `conversionUploadPath`. */
    conversionUploadPollPath(ctx: RouteContext, softwareId: string, sourceFormat: string): string;
    /**
     * Orchestrates the full identity-exchange.v1 backend auth flow:
     * DCR binding → PKCE code → token → SMART bearer exchange.
     *
     * Equivalent to Python connector_sdk `authenticate_backend_pkce_and_exchange`.
     * Results are cached in memory; re-runs automatically on expiry.
     */
    authenticateBackendPkceAndExchange(options: BackendPkceAuthOptions): Promise<BackendPkceAuthResult>;
    /**
     * Returns the cached SMART bearer for the given endpointId if still valid (>30s remaining).
     * Returns `undefined` if not cached or expired.
     */
    getCachedBearerToken(tokenCacheKey: string): string | undefined;
    /**
     * smart-backend.v1: obtain an OAuth2 backend token using client_credentials + private_key_jwt.
     */
    authenticateBackendSmartStandard(options: BackendSmartAuthOptions): Promise<BackendSmartAuthResult>;
    /**
     * Exchange token payload against gateway token endpoint and cache the result.
     */
    requestSmartToken(input: SmartTokenExchangeInput): Promise<SmartTokenExchangeResult>;
    /**
     * Friendly wrapper for SMART token request via GW identity/auth token-exchange route.
     * Uses one object, seconds-based polling, and constructor ctx fallback.
     */
    requestSmartTokenSimple(input: SmartTokenRequestSimpleInput): Promise<SmartTokenExchangeResult>;
    private _pkceS256Challenge;
    private _buildAuthDIDCommRequest;
    private resolveControllerPublicJwk;
    private resolveStandardTokenUrl;
    private resolveSmartAuthPublicJwk;
    private signSmartBackendClientAssertion;
    private preferredJwtAlg;
    /**
     * POST a DIDComm bundle payload.
     * This is the preferred high-level method for DIDComm submission of
     * FHIR/API bundles (batch, transaction, message, etc.).
     *
     * Returns immediately with the HTTP response — pair with `pollUntilComplete` or use `submitAndPoll`.
     */
    submitBundle(path: string, payload: {
        thid?: string;
    } & Record<string, unknown>, options?: {
        mode?: 'plain' | 'strict';
        recipientEncryptionJwk?: PublicJwk;
        walletContext?: WalletContext;
    }): Promise<SubmitResponse>;
    /**
     * @deprecated Use `submitBundle` instead.
     *
     * POST a DIDComm plaintext payload to a batch submit path.
     * Use this for all `_batch` routes (family registration, observations, tasks, etc.).
     * Content-Type: `application/didcomm-plaintext+json`.
     *
     * Returns immediately with the HTTP response — pair with `pollUntilComplete` or use `submitAndPoll`.
     */
    submitBatch(path: string, payload: unknown): Promise<SubmitResponse>;
    /**
     * Sign and encrypt a DIDComm payload (nested JWS-in-JWE) and POST to the given path.
     * Content-Type: `application/didcomm-encrypted+json`.
     *
     * Flow: `payload JSON → ES384 compact JWS → RSA-OAEP-256/A256GCM compact JWE → POST`
     *
     * Requires a wallet provider and the recipient's RSA encryption JWK
     * (e.g. from GW `.well-known/jwks.json` where `use === 'enc'`).
     */
    submitBatchEncrypted(path: string, payload: {
        thid?: string;
    } & Record<string, unknown>, recipientEncryptionJwk: PublicJwk, walletContext: WalletContext): Promise<SubmitResponse>;
    /**
     * POST a plain JSON payload.
     * Use for non-DIDComm routes (e.g. token exchange body, API key management).
     * Content-Type: `application/json`.
     */
    postJson(path: string, payload: unknown): Promise<SubmitResponse>;
    /**
     * Legacy JSON submit for non-bundle payloads (openid/token/resource JSON bodies).
     * Keeps JSON flows explicit and semantically separated from DIDComm bundle flows.
     */
    submitLegacyJson(path: string, payload: unknown): Promise<SubmitResponse>;
    /**
     * POST a multipart/form-data payload.
     * Use for file upload endpoints. Prefer `uploadConversionFile` for DataConversion uploads.
     */
    postFormData(path: string, formData: FormData): Promise<SubmitResponse>;
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
    uploadConversionFile(params: {
        path: string;
        fileName: string;
        fileContent: Blob | Buffer | Uint8Array | ArrayBuffer;
        fileFieldName?: string;
        fields?: Record<string, string>;
    }): Promise<SubmitResponse>;
    /**
     * Single poll attempt against a `_batch-response` or `_*-response` path.
     * Returns HTTP 202 while the job is still processing, 200 (or other) when done.
     * Prefer `pollUntilComplete` for automatic retry loops.
     */
    pollBatchResponse(path: string, request: AsyncPollRequest): Promise<{
        status: number;
        body: unknown;
        retryAfterMs?: number;
    }>;
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
    submitAndPoll(submitPath: string, pollPath: string, payload: {
        thid?: string;
    } & Record<string, unknown>, options?: PollOptions): Promise<SubmitAndPollResult>;
    /**
     * Create scheduled phone reminder Task entries through canonical Task `_batch` routes.
     * This high-level helper accepts business parameters and internally builds flat
     * FHIR-style claims under `resource.meta.claims`.
     *
     * `description` is the Task title.
     * `reminderSummary` is the contextual summary of what the reminder refers to
     * (appointment, medication schedule, or another event), mapped to `based-on-display`.
     */
    createPhoneReminderTasks(ctx: RouteContext | undefined, input: CreatePhoneReminderTasksInput, options?: PollOptions): Promise<SubmitAndPollResult>;
    /** Endpoint path for medication overlap pre-check (planned GW contract). */
    individualMedicationOverlapCheckPath(ctx: RouteContext): string;
    /**
     * Pre-create overlap check for medication intake schedules.
     * TODO: Requires GW endpoint implementation (`MedicationStatement/_overlap-check`).
     */
    checkMedicationScheduleOverlap(ctx: RouteContext, input: MedicationOverlapCheckInput): Promise<SubmitResponse>;
    /**
     * High-level helper for medication reminder creation.
     * This creates one Task per explicit intake time and delegates reminder execution to GW daemon.
     * TODO: recurring interval expansion + overlap policy should be finalized in GW endpoint contract.
     */
    createMedicationReminderTasks(ctx: RouteContext, input: MedicationRegistrationInput, options?: PollOptions): Promise<SubmitAndPollResult>;
    /**
     * Search for an existing family Organization registration by phone + usualname.
     * Submits to `individual/org.schema/Organization/_search`, polls for the result, and
     * parses the bundle entry into a `FamilyOrganizationSummary`.
     *
     * Returns `null` when no matching registration exists.
     */
    searchFamilyOrganization(ctx: RouteContext | undefined, filters: {
        controllerPhone: string;
        usualname: string;
        birthDate?: string;
    }, options?: PollOptions): Promise<FamilyOrganizationSummary | null>;
    /**
     * Activate tenant organization in GW from ICA-derived proof.
     */
    activateOrganizationInGatewayFromIcaProof(ctx: HostRouteContext | undefined, input: GatewayOrganizationActivationInput, options?: PollOptions): Promise<SubmitAndPollResult>;
    /**
     * Friendly wrapper for legal organization activation.
     * Accepts one object and seconds-based polling options for integrator ergonomics.
     */
    activateOrganizationInGatewaySimple(input: GatewayOrganizationActivationSimpleInput): Promise<SubmitAndPollResult>;
    /**
     * Friendly wrapper for legal organization Order confirmation.
     * Accepts one object and builds payload/paths internally.
     */
    confirmLegalOrganizationOrderSimple(input: LegalOrganizationOrderSimpleInput): Promise<SubmitAndPollResult>;
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
    getDidcommMessageBodyFromResponse(result: SubmitAndPollResult | PollResult | unknown): Record<string, unknown> | undefined;
    /**
     * Return first DIDComm business entry from a submit/poll result.
     */
    getFirstDidcommDataEntryFromResponse(result: SubmitAndPollResult | PollResult | unknown): Record<string, unknown> | undefined;
    /**
     * Extract `org.schema.Offer.identifier` from a submit/poll result.
     *
     * This helper normalizes canonical and legacy claim locations.
     */
    getOfferIdFromResponse(result: SubmitAndPollResult | PollResult | unknown): string | undefined;
    /**
     * Extract a UI-ready Offer preview from activation/registration responses.
     */
    getOfferPreviewFromResponse(result: SubmitAndPollResult | PollResult | unknown): OfferPreview;
    /**
     * Alias of `getOfferPreviewFromResponse` with business naming.
     */
    getOfferInfoFromResponse(result: SubmitAndPollResult | PollResult | unknown): OfferInfo;
    /**
     * Extract activation code from response payload or claims.
     * Supports common response shapes used in onboarding and license issuance flows.
     */
    getActivationCodeFromResponse(result: SubmitAndPollResult | PollResult | unknown): string | undefined;
    /**
     * Throws when first DIDComm entry contains a business-level error status.
     */
    assertFirstDidcommEntrySuccess(result: SubmitAndPollResult | PollResult | unknown, contextLabel: string): void;
    /**
     * Activate employee/member device by activation code exchange + DCR registration.
     *
     * Step 1. Exchange activation code using user id_token to obtain an initial access token.
     * Step 2. Register device keys through Device/_dcr authorized by that initial token.
     */
    activateEmployeeDeviceWithActivationCode(ctx: RouteContext | undefined, input: EmployeeDeviceActivationInput): Promise<EmployeeDeviceActivationResult>;
    /**
     * Friendly wrapper for employee/member device activation.
     * Uses one object, seconds-based polling, and constructor ctx fallback.
     */
    activateEmployeeDeviceWithActivationCodeSimple(input: EmployeeDeviceActivationSimpleInput): Promise<EmployeeDeviceActivationResult>;
    /**
     * UC 5.3 wrapper: create organization employee in entity Employee batch route.
     */
    createOrganizationEmployee(ctx: RouteContext | undefined, input: OrganizationEmployeeCreationInput, options?: PollOptions): Promise<SubmitAndPollResult>;
    /**
     * UC 5.1 wrapper: bootstrap subject organization context via registration + optional order confirmation.
     */
    bootstrapSubjectOrganizationIndex(ctx: RouteContext | undefined, input: SubjectOrganizationBootstrapInput): Promise<SubjectOrganizationBootstrapResult>;
    /**
     * Friendly wrapper (recommended step 1): register individual organization and return Offer.
     */
    startIndividualOrganizationSimple(input: IndividualOrganizationBootstrapSimpleInput): Promise<IndividualOrganizationStartSimpleResult>;
    /**
     * Friendly wrapper (recommended step 2): confirm individual/family order from accepted offerId.
     */
    confirmIndividualOrganizationOrderSimple(input: IndividualOrganizationConfirmOrderSimpleInput): Promise<SubmitAndPollResult>;
    /**
     * Friendly wrapper (provisional): register + auto-confirm individual order.
     * Prefer `startIndividualOrganizationSimple` + `confirmIndividualOrganizationOrderSimple`.
     */
    bootstrapIndividualOrganizationSimple(input: IndividualOrganizationBootstrapSimpleInput): Promise<IndividualOrganizationBootstrapSimpleResult>;
    /**
     * UC 5.5 wrapper: import IPS/FHIR composition and update subject index context.
     */
    importIpsOrFhirAndUpdateIndex(ctx: RouteContext | undefined, input: IpsOrFhirImportInput): Promise<SubmitAndPollResult>;
    /**
     * UC 5.6 consent helper from minimal frontend fields.
     * Builds canonical Consent claims and submits/polls the Consent batch.
     */
    grantProfessionalAccessSimple(ctx: RouteContext | undefined, input: GrantProfessionalAccessSimpleInput): Promise<GrantProfessionalAccessSimpleResult>;
    /**
     * UC 5.7 wrapper: generate digital twin composition from subject data.
     */
    generateDigitalTwinFromSubjectData(ctx: RouteContext | undefined, input: DigitalTwinGenerationInput): Promise<SubmitAndPollResult>;
    /**
     * Poll a `_*-response` path repeatedly until the status is no longer 202.
     * Default: 60s timeout, 2s interval.
     * Throws if timeout is exceeded.
     *
     * @param path - Poll path (e.g. `individualFamilyOrganizationPollPath(ctx)`).
     * @param request - Must include `thid` matching the original submit payload.
     * @param options - `timeoutMs` (default 60000) and `intervalMs` (default 2000).
     */
    pollUntilComplete(path: string, request: AsyncPollRequest, options?: PollOptions): Promise<PollResult>;
    private doPost;
    private parseResponseBody;
}
