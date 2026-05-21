# SDK API Complete Reference

Generated from JSDoc in `src/client.ts`. Methods: **102**.

## Method Index

| Method | What it does |
|---|---|
| [`activateEmployeeDeviceWithActivationCode`](#activateemployeedevicewithactivationcode) | Activate employee/member device by activation code exchange + DCR registration. |
| [`activateEmployeeDeviceWithActivationCodeSimple`](#activateemployeedevicewithactivationcodesimple) | Friendly wrapper for employee/member device activation. |
| [`activateOrganizationInGatewayFromIcaProof`](#activateorganizationingatewayfromicaproof) | Activate tenant organization in GW from ICA-derived proof. |
| [`activateOrganizationInGatewaySimple`](#activateorganizationingatewaysimple) | Friendly wrapper for legal organization activation. |
| [`assertFirstDidcommEntrySuccess`](#assertfirstdidcommentrysuccess) | Throws when first DIDComm entry contains a business-level error status. |
| [`authenticateBackendPkceAndExchange`](#authenticatebackendpkceandexchange) | Orchestrates the full identity-exchange.v1 backend auth flow: |
| [`authenticateBackendSmartStandard`](#authenticatebackendsmartstandard) | smart-backend.v1: obtain an OAuth2 backend token using client_credentials + private_key_jwt. |
| [`bootstrapIndividualOrganizationSimple`](#bootstrapindividualorganizationsimple) | Friendly wrapper (provisional): register + auto-confirm individual order. |
| [`bootstrapSubjectOrganizationIndex`](#bootstrapsubjectorganizationindex) | UC 5.1 wrapper: bootstrap subject organization context via registration + optional order confirmation. |
| [`checkMedicationScheduleOverlap`](#checkmedicationscheduleoverlap) | Pre-create overlap check for medication intake schedules. |
| [`confirmIndividualOrganizationOrderSimple`](#confirmindividualorganizationordersimple) | Friendly wrapper (recommended step 2): confirm individual/family order from accepted offerId. |
| [`confirmLegalOrganizationOrderSimple`](#confirmlegalorganizationordersimple) | Friendly wrapper for legal organization Order confirmation. |
| [`conversionUploadPath`](#conversionuploadpath) | Submit path: DataConversion file upload. |
| [`conversionUploadPollPath`](#conversionuploadpollpath) | Poll path: DataConversion upload. Pair with `conversionUploadPath`. |
| [`createMedicationReminderTasks`](#createmedicationremindertasks) | High-level helper for medication reminder creation. |
| [`createOrganizationEmployee`](#createorganizationemployee) | UC 5.3 wrapper: create organization employee in entity Employee batch route. |
| [`createPhoneReminderTasks`](#createphoneremindertasks) | Create scheduled phone reminder Task entries through canonical Task `_batch` routes. |
| [`digitalTwinCompositionApiBatchPath`](#digitaltwincompositionapibatchpath) | Submit path: digital twin Composition (FHIR API format, `digitaltwin/org.hl7.fhir.api/Composition/_batch`). |
| [`digitalTwinCompositionApiPollPath`](#digitaltwincompositionapipollpath) | Poll path: digital twin Composition API. Pair with `digitalTwinCompositionApiBatchPath`. |
| [`digitalTwinCompositionR4BatchPath`](#digitaltwincompositionr4batchpath) | Submit path: digital twin Composition (FHIR R4 format, `digitaltwin/org.hl7.fhir.r4/Composition/_batch`). |
| [`digitalTwinCompositionR4PollPath`](#digitaltwincompositionr4pollpath) | Poll path: digital twin Composition R4. Pair with `digitalTwinCompositionR4BatchPath`. |
| [`employeeBatchPath`](#employeebatchpath) | Submit path: entity Employee (`entity/org.schema/Employee/_batch`). |
| [`employeePollPath`](#employeepollpath) | Poll path: entity Employee. Pair with `employeeBatchPath`. |
| [`generateDigitalTwinFromSubjectData`](#generatedigitaltwinfromsubjectdata) | UC 5.7 wrapper: generate digital twin composition from subject data. |
| [`getActivationCodeFromResponse`](#getactivationcodefromresponse) | Extract activation code from response payload or claims. |
| [`getCachedBearerToken`](#getcachedbearertoken) | Returns the cached SMART bearer for the given endpointId if still valid (>30s remaining). |
| [`getDidcommMessageBodyFromResponse`](#getdidcommmessagebodyfromresponse) | Normalize GW async response into DIDComm message body. |
| [`getEndpointId`](#getendpointid) | Builds a deterministic endpoint id for token cache and auth/session reuse. |
| [`getFirstDidcommDataEntryFromResponse`](#getfirstdidcommdataentryfromresponse) | Return first DIDComm business entry from a submit/poll result. |
| [`getOfferIdFromResponse`](#getofferidfromresponse) | Extract `org.schema.Offer.identifier` from a submit/poll result. |
| [`getOfferInfoFromResponse`](#getofferinfofromresponse) | Alias of `getOfferPreviewFromResponse` with business naming. |
| [`getOfferPreviewFromResponse`](#getofferpreviewfromresponse) | Extract a UI-ready Offer preview from activation/registration responses. |
| [`getWallet`](#getwallet) | Return the currently configured wallet provider (if any). |
| [`grantProfessionalAccessSimple`](#grantprofessionalaccesssimple) | UC 5.6 consent helper from minimal frontend fields. |
| [`hostRegistryOrderBatchPath`](#hostregistryorderbatchpath) | Submit path: host registry Order batch (controller-level order submission). |
| [`hostRegistryOrderPollPath`](#hostregistryorderpollpath) | Poll path: host registry Order batch. Pair with `hostRegistryOrderBatchPath`. |
| [`hostRegistryOrganizationActivatePath`](#hostregistryorganizationactivatepath) | Submit path: activate a tenant Organization in the GW registry using a VC from ICA. |
| [`hostRegistryOrganizationActivatePollPath`](#hostregistryorganizationactivatepollpath) | Poll path: `_activate` response. Pair with `hostRegistryOrganizationActivatePath`. |
| [`hostRegistryOrganizationBatchPath`](#hostregistryorganizationbatchpath) | Submit path: host registry Organization batch (controller-level org registration). |
| [`hostRegistryOrganizationPollPath`](#hostregistryorganizationpollpath) | Poll path: host registry Organization batch. Pair with `hostRegistryOrganizationBatchPath`. |
| [`hostRegistryPath`](#hostregistrypath) | Generic host registry route builder (tenant-agnostic, `host/` prefix). |
| [`identityCodePath`](#identitycodepath) | Submit path: identity PKCE code step — sends S256 code_challenge. |
| [`identityCodePollPath`](#identitycodepollpath) | Poll path: identity PKCE code. Pair with `identityCodePath`. |
| [`identityDeviceDcrPath`](#identitydevicedcrpath) | Submit path: identity DCR step — binds API key to service public JWK. |
| [`identityDeviceDcrPollPath`](#identitydevicedcrpollpath) | Poll path: identity DCR. Pair with `identityDeviceDcrPath`. |
| [`identityFirebaseCustomPath`](#identityfirebasecustompath) | Submit path: Firebase custom token exchange (end-user device flow, NOT B2B). |
| [`identityFirebaseCustomPollPath`](#identityfirebasecustompollpath) | Poll path: Firebase custom token. Pair with `identityFirebaseCustomPath`. |
| [`identityLicenseIssuePath`](#identitylicenseissuepath) | Submit path: identity license issue (`identity/auth/_issue`). |
| [`identityOpenIdSmartTokenPath`](#identityopenidsmarttokenpath) | Submit path: SMART OpenID token request (`identity/openid/smart/token`). |
| [`identityOpenIdSmartTokenPollPath`](#identityopenidsmarttokenpollpath) | Poll path: SMART OpenID token request. Pair with `identityOpenIdSmartTokenPath`. |
| [`identitySmartTokenPath`](#identitysmarttokenpath) | Submit path: SMART token step — code + code_verifier → id_token. |
| [`identitySmartTokenPollPath`](#identitysmarttokenpollpath) | Poll path: SMART token. Pair with `identitySmartTokenPath`. |
| [`identityTokenExchangePath`](#identitytokenexchangepath) | Submit path: identity token exchange — id_token → SMART bearer. |
| [`identityTokenExchangePollPath`](#identitytokenexchangepollpath) | Poll path: identity token exchange. Pair with `identityTokenExchangePath`. |
| [`importIpsOrFhirAndUpdateIndex`](#importipsorfhirandupdateindex) | UC 5.5 wrapper: import IPS/FHIR composition and update subject index context. |
| [`individualCommunicationBatchPath`](#individualcommunicationbatchpath) | Submit path: individual Communication (`{format}/Communication/_batch`). |
| [`individualCommunicationPollPath`](#individualcommunicationpollpath) | Poll path: individual Communication. Pair with `individualCommunicationBatchPath`. |
| [`individualCompositionR4BatchPath`](#individualcompositionr4batchpath) | Submit path: individual Composition (FHIR R4, `org.hl7.fhir.r4/Composition/_batch`). |
| [`individualCompositionR4PollPath`](#individualcompositionr4pollpath) | Poll path: individual Composition R4. Pair with `individualCompositionR4BatchPath`. |
| [`individualConsentR4BatchPath`](#individualconsentr4batchpath) | Submit path: individual Consent (FHIR R4, `org.hl7.fhir.r4/Consent/_batch`). |
| [`individualConsentR4PollPath`](#individualconsentr4pollpath) | Poll path: individual Consent R4. Pair with `individualConsentR4BatchPath`. |
| [`individualFamilyOrderBatchPath`](#individualfamilyorderbatchpath) | Submit path: individual/family Order batch (`org.schema/Order/_batch`). |
| [`individualFamilyOrderPollPath`](#individualfamilyorderpollpath) | Poll path: individual/family Order. Pair with `individualFamilyOrderBatchPath`. |
| [`individualFamilyOrganizationBatchPath`](#individualfamilyorganizationbatchpath) | Submit path: individual/family Organization onboarding (`org.schema/Organization/_batch`). |
| [`individualFamilyOrganizationPollPath`](#individualfamilyorganizationpollpath) | Poll path: individual/family Organization. Pair with `individualFamilyOrganizationBatchPath`. |
| [`individualFamilyOrganizationSearchPath`](#individualfamilyorganizationsearchpath) | Submit path: individual/family Organization search (`org.schema/Organization/_search`). |
| [`individualFamilyOrganizationSearchPollPath`](#individualfamilyorganizationsearchpollpath) | Poll path: individual/family Organization search. Pair with `individualFamilyOrganizationSearchPath`. |
| [`individualLegacyPersonBatchPath`](#individuallegacypersonbatchpath) | Submit path: individual Person legacy format (`individual/org.schema/Person/_batch`). Use for older flows; prefer Organization for family onboarding. |
| [`individualMedicationOverlapCheckPath`](#individualmedicationoverlapcheckpath) | Endpoint path for medication overlap pre-check (planned GW contract). |
| [`individualObservationBatchPath`](#individualobservationbatchpath) | Submit path: individual Observation (FHIR R4 API, `org.hl7.fhir.api/Observation/_batch`). |
| [`individualObservationPollPath`](#individualobservationpollpath) | Poll path: individual Observation. Pair with `individualObservationBatchPath`. |
| [`individualRelatedPersonBatchPath`](#individualrelatedpersonbatchpath) | Submit path: individual RelatedPerson (FHIR R4 API, `org.hl7.fhir.api/RelatedPerson/_batch`). |
| [`individualRelatedPersonPollPath`](#individualrelatedpersonpollpath) | Poll path: individual RelatedPerson. Pair with `individualRelatedPersonBatchPath`. |
| [`individualTaskBatchPath`](#individualtaskbatchpath) | Submit path: individual Task (FHIR R4 API, `org.hl7.fhir.api/Task/_batch`). |
| [`individualTaskPollPath`](#individualtaskpollpath) | Poll path: individual Task. Pair with `individualTaskBatchPath`. |
| [`ingestCommunicationAndUpdateIndex`](#ingestcommunicationandupdateindex) | Ingestion wrapper: submit Communication payload and let GW process/update index asynchronously. |
| [`pollBatchResponse`](#pollbatchresponse) | Single poll attempt against a `_batch-response` or `_*-response` path. |
| [`pollUntilComplete`](#polluntilcomplete) | Poll a `_*-response` path repeatedly until the status is no longer 202. |
| [`postFormData`](#postformdata) | POST a multipart/form-data payload. |
| [`postJson`](#postjson) | POST a plain JSON payload. |
| [`requestSmartToken`](#requestsmarttoken) | Exchange token payload against gateway token endpoint and cache the result. |
| [`requestSmartTokenSimple`](#requestsmarttokensimple) | Friendly wrapper for SMART token request via GW identity/auth token-exchange route. |
| [`searchFamilyOrganization`](#searchfamilyorganization) | Search for an existing family Organization registration by phone + usualname. |
| [`setContext`](#setcontext) | Set default route context for subsequent calls. |
| [`setContextOrg`](#setcontextorg) | Preferred alias for organization/tenant integration context. |
| [`setDefaultIntervalSeconds`](#setdefaultintervalseconds) | Set default polling interval (seconds) for simple helper methods. |
| [`setDefaultTimeoutSeconds`](#setdefaulttimeoutseconds) | Set default polling timeout (seconds) for simple helper methods. |
| [`setJurisdiction`](#setjurisdiction) | Update only `jurisdiction` in default route context. |
| [`setSector`](#setsector) | Update only `sector` in default route context. |
| [`setTenantId`](#settenantid) | Update only `tenantId` in default route context. |
| [`startIndividualOrganizationSimple`](#startindividualorganizationsimple) | Friendly wrapper (recommended step 1): register individual organization and return Offer. |
| [`submitAndPoll`](#submitandpoll) | Submit a DIDComm batch payload and poll until the async job completes. |
| [`submitBatch`](#submitbatch) | POST a DIDComm plaintext payload to a batch submit path. |
| [`submitBatchEncrypted`](#submitbatchencrypted) | Sign and encrypt a DIDComm payload (nested JWS-in-JWE) and POST to the given path. |
| [`submitBundle`](#submitbundle) | POST a DIDComm bundle payload. |
| [`submitLegacyJson`](#submitlegacyjson) | Legacy JSON submit for non-bundle payloads (openid/token/resource JSON bodies). |
| [`taskDebugCallStartPath`](#taskdebugcallstartpath) | Submit path: UHC debug task call-start (`individual/{format}/Task/_call-start`). For telephony integration testing. |
| [`taskDebugLogsPath`](#taskdebuglogspath) | Path: UHC debug task logs (`individual/{format}/Task/_logs`). Retrieve async task execution logs. |
| [`tenantIdentityPath`](#tenantidentitypath) | Generic tenant-scoped identity route builder. |
| [`uploadConversionFile`](#uploadconversionfile) | Upload a file to a DataConversion endpoint. |
| [`upsertRelatedPersonAndPoll`](#upsertrelatedpersonandpoll) | RelatedPerson wrapper: submit contact payload and poll until completion. |
| [`v1Path`](#v1path) | Generic GW v1 tenant route builder. |

## `activateEmployeeDeviceWithActivationCode`

**What it does:** Activate employee/member device by activation code exchange + DCR registration.

**Why/when:** Step 1. Exchange activation code using user id_token to obtain an initial access token. Step 2. Register device keys through Device/_dcr authorized by that initial token.

**Signature**

```ts
activateEmployeeDeviceWithActivationCode(ctx: RouteContext | undefined, input: EmployeeDeviceActivationInput,) : Promise<EmployeeDeviceActivationResult>
```

## `activateEmployeeDeviceWithActivationCodeSimple`

**What it does:** Friendly wrapper for employee/member device activation.

**Why/when:** Uses one object, seconds-based polling, and constructor ctx fallback.

**Signature**

```ts
activateEmployeeDeviceWithActivationCodeSimple(input: EmployeeDeviceActivationSimpleInput,) : Promise<EmployeeDeviceActivationResult>
```

## `activateOrganizationInGatewayFromIcaProof`

**What it does:** Activate tenant organization in GW from ICA-derived proof.

**Signature**

```ts
activateOrganizationInGatewayFromIcaProof(ctx: HostRouteContext | undefined, input: GatewayOrganizationActivationInput, options?: PollOptions,) : Promise<SubmitAndPollResult>
```

## `activateOrganizationInGatewaySimple`

**What it does:** Friendly wrapper for legal organization activation.

**Why/when:** Accepts one object and seconds-based polling options for integrator ergonomics.

**Signature**

```ts
activateOrganizationInGatewaySimple(input: GatewayOrganizationActivationSimpleInput,) : Promise<SubmitAndPollResult>
```

## `assertFirstDidcommEntrySuccess`

**What it does:** Throws when first DIDComm entry contains a business-level error status.

**Signature**

```ts
assertFirstDidcommEntrySuccess(result: SubmitAndPollResult | PollResult | unknown, contextLabel: string,) : void
```

## `authenticateBackendPkceAndExchange`

**What it does:** Orchestrates the full identity-exchange.v1 backend auth flow:

**Why/when:** DCR binding → PKCE code → token → SMART bearer exchange. Equivalent to Python connector_sdk `authenticate_backend_pkce_and_exchange`. Results are cached in memory; re-runs automatically on expiry.

**Signature**

```ts
authenticateBackendPkceAndExchange(options: BackendPkceAuthOptions,) : Promise<BackendPkceAuthResult>
```

## `authenticateBackendSmartStandard`

**What it does:** smart-backend.v1: obtain an OAuth2 backend token using client_credentials + private_key_jwt.

**Signature**

```ts
authenticateBackendSmartStandard(options: BackendSmartAuthOptions,) : Promise<BackendSmartAuthResult>
```

## `bootstrapIndividualOrganizationSimple`

**What it does:** Friendly wrapper (provisional): register + auto-confirm individual order.

**Why/when:** Prefer `startIndividualOrganizationSimple` + `confirmIndividualOrganizationOrderSimple`.

**Signature**

```ts
bootstrapIndividualOrganizationSimple(input: IndividualOrganizationBootstrapSimpleInput,) : Promise<IndividualOrganizationBootstrapSimpleResult>
```

## `bootstrapSubjectOrganizationIndex`

**What it does:** UC 5.1 wrapper: bootstrap subject organization context via registration + optional order confirmation.

**Signature**

```ts
bootstrapSubjectOrganizationIndex(ctx: RouteContext | undefined, input: SubjectOrganizationBootstrapInput,) : Promise<SubjectOrganizationBootstrapResult>
```

## `checkMedicationScheduleOverlap`

**What it does:** Pre-create overlap check for medication intake schedules.

**Why/when:** TODO: Requires GW endpoint implementation (`MedicationStatement/_overlap-check`).

**Signature**

```ts
checkMedicationScheduleOverlap(ctx: RouteContext, input: MedicationOverlapCheckInput,) : Promise<SubmitResponse>
```

## `confirmIndividualOrganizationOrderSimple`

**What it does:** Friendly wrapper (recommended step 2): confirm individual/family order from accepted offerId.

**Signature**

```ts
confirmIndividualOrganizationOrderSimple(input: IndividualOrganizationConfirmOrderSimpleInput,) : Promise<SubmitAndPollResult>
```

## `confirmLegalOrganizationOrderSimple`

**What it does:** Friendly wrapper for legal organization Order confirmation.

**Why/when:** Accepts one object and builds payload/paths internally.

**Signature**

```ts
confirmLegalOrganizationOrderSimple(input: LegalOrganizationOrderSimpleInput,) : Promise<SubmitAndPollResult>
```

## `conversionUploadPath`

**What it does:** Submit path: DataConversion file upload.

**Why/when:** Pattern: `/{tenantId}/cds-{jurisdiction}/v1/{sector}/conversion/{softwareId}/{sourceFormat}/_upload` Use with `uploadConversionFile` to send a file (e.g. XLSX) for async processing.

**Signature**

```ts
conversionUploadPath(ctx: RouteContext, softwareId: string, sourceFormat: string) : string
```

## `conversionUploadPollPath`

**What it does:** Poll path: DataConversion upload. Pair with `conversionUploadPath`.

**Signature**

```ts
conversionUploadPollPath(ctx: RouteContext, softwareId: string, sourceFormat: string) : string
```

## `createMedicationReminderTasks`

**What it does:** High-level helper for medication reminder creation.

**Why/when:** This creates one Task per explicit intake time and delegates reminder execution to GW daemon. TODO: recurring interval expansion + overlap policy should be finalized in GW endpoint contract.

**Signature**

```ts
createMedicationReminderTasks(ctx: RouteContext, input: MedicationRegistrationInput, options?: PollOptions,) : Promise<SubmitAndPollResult>
```

## `createOrganizationEmployee`

**What it does:** UC 5.3 wrapper: create organization employee in entity Employee batch route.

**Signature**

```ts
createOrganizationEmployee(ctx: RouteContext | undefined, input: OrganizationEmployeeCreationInput, options?: PollOptions,) : Promise<SubmitAndPollResult>
```

## `createPhoneReminderTasks`

**What it does:** Create scheduled phone reminder Task entries through canonical Task `_batch` routes.

**Why/when:** This high-level helper accepts business parameters and internally builds flat FHIR-style claims under `resource.meta.claims`. `description` is the Task title.

**Signature**

```ts
createPhoneReminderTasks(ctx: RouteContext | undefined, input: CreatePhoneReminderTasksInput, options?: PollOptions,) : Promise<SubmitAndPollResult>
```

## `digitalTwinCompositionApiBatchPath`

**What it does:** Submit path: digital twin Composition (FHIR API format, `digitaltwin/org.hl7.fhir.api/Composition/_batch`).

**Signature**

```ts
digitalTwinCompositionApiBatchPath(ctx: RouteContext) : string
```

## `digitalTwinCompositionApiPollPath`

**What it does:** Poll path: digital twin Composition API. Pair with `digitalTwinCompositionApiBatchPath`.

**Signature**

```ts
digitalTwinCompositionApiPollPath(ctx: RouteContext) : string
```

## `digitalTwinCompositionR4BatchPath`

**What it does:** Submit path: digital twin Composition (FHIR R4 format, `digitaltwin/org.hl7.fhir.r4/Composition/_batch`).

**Signature**

```ts
digitalTwinCompositionR4BatchPath(ctx: RouteContext) : string
```

## `digitalTwinCompositionR4PollPath`

**What it does:** Poll path: digital twin Composition R4. Pair with `digitalTwinCompositionR4BatchPath`.

**Signature**

```ts
digitalTwinCompositionR4PollPath(ctx: RouteContext) : string
```

## `employeeBatchPath`

**What it does:** Submit path: entity Employee (`entity/org.schema/Employee/_batch`).

**Signature**

```ts
employeeBatchPath(ctx?: RouteContext) : string
```

## `employeePollPath`

**What it does:** Poll path: entity Employee. Pair with `employeeBatchPath`.

**Signature**

```ts
employeePollPath(ctx?: RouteContext) : string
```

## `generateDigitalTwinFromSubjectData`

**What it does:** UC 5.7 wrapper: generate digital twin composition from subject data.

**Signature**

```ts
generateDigitalTwinFromSubjectData(ctx: RouteContext | undefined, input: DigitalTwinGenerationInput,) : Promise<SubmitAndPollResult>
```

## `getActivationCodeFromResponse`

**What it does:** Extract activation code from response payload or claims.

**Why/when:** Supports common response shapes used in onboarding and license issuance flows.

**Signature**

```ts
getActivationCodeFromResponse(result: SubmitAndPollResult | PollResult | unknown) : string | undefined
```

## `getCachedBearerToken`

**What it does:** Returns the cached SMART bearer for the given endpointId if still valid (>30s remaining).

**Why/when:** Returns `undefined` if not cached or expired.

**Signature**

```ts
getCachedBearerToken(tokenCacheKey: string) : string | undefined
```

## `getDidcommMessageBodyFromResponse`

**What it does:** Normalize GW async response into DIDComm message body.

**Why/when:** Transport note: - GW poll responses are HTTP JSON envelopes - business payload lives inside DIDComm `body`

**Signature**

```ts
getDidcommMessageBodyFromResponse(result: SubmitAndPollResult | PollResult | unknown,) : Record<string, unknown> | undefined
```

## `getEndpointId`

**What it does:** Builds a deterministic endpoint id for token cache and auth/session reuse.

**Why/when:** If `providerDid` is provided, returns a full DID service id: did:web:...#section:format:resourceType:action Otherwise returns the canonical fragment without '#':

**Signature**

```ts
getEndpointId(selector: EndpointSelector, providerDid?: string) : string
```

## `getFirstDidcommDataEntryFromResponse`

**What it does:** Return first DIDComm business entry from a submit/poll result.

**Signature**

```ts
getFirstDidcommDataEntryFromResponse(result: SubmitAndPollResult | PollResult | unknown,) : Record<string, unknown> | undefined
```

## `getOfferIdFromResponse`

**What it does:** Extract `org.schema.Offer.identifier` from a submit/poll result.

**Why/when:** This helper normalizes canonical and legacy claim locations.

**Signature**

```ts
getOfferIdFromResponse(result: SubmitAndPollResult | PollResult | unknown) : string | undefined
```

## `getOfferInfoFromResponse`

**What it does:** Alias of `getOfferPreviewFromResponse` with business naming.

**Signature**

```ts
getOfferInfoFromResponse(result: SubmitAndPollResult | PollResult | unknown) : OfferInfo
```

## `getOfferPreviewFromResponse`

**What it does:** Extract a UI-ready Offer preview from activation/registration responses.

**Signature**

```ts
getOfferPreviewFromResponse(result: SubmitAndPollResult | PollResult | unknown) : OfferPreview
```

## `getWallet`

**What it does:** Return the currently configured wallet provider (if any).

**Signature**

```ts
getWallet() : WalletProvider | undefined
```

## `grantProfessionalAccessSimple`

**What it does:** UC 5.6 consent helper from minimal frontend fields.

**Why/when:** Builds canonical Consent claims and submits/polls the Consent batch.

**Signature**

```ts
grantProfessionalAccessSimple(ctx: RouteContext | undefined, input: GrantProfessionalAccessSimpleInput,) : Promise<GrantProfessionalAccessSimpleResult>
```

## `hostRegistryOrderBatchPath`

**What it does:** Submit path: host registry Order batch (controller-level order submission).

**Signature**

```ts
hostRegistryOrderBatchPath(ctx?: HostRouteContext) : string
```

## `hostRegistryOrderPollPath`

**What it does:** Poll path: host registry Order batch. Pair with `hostRegistryOrderBatchPath`.

**Signature**

```ts
hostRegistryOrderPollPath(ctx?: HostRouteContext) : string
```

## `hostRegistryOrganizationActivatePath`

**What it does:** Submit path: activate a tenant Organization in the GW registry using a VC from ICA.

**Signature**

```ts
hostRegistryOrganizationActivatePath(ctx?: HostRouteContext) : string
```

## `hostRegistryOrganizationActivatePollPath`

**What it does:** Poll path: `_activate` response. Pair with `hostRegistryOrganizationActivatePath`.

**Signature**

```ts
hostRegistryOrganizationActivatePollPath(ctx?: HostRouteContext) : string
```

## `hostRegistryOrganizationBatchPath`

**What it does:** Submit path: host registry Organization batch (controller-level org registration).

**Signature**

```ts
hostRegistryOrganizationBatchPath(ctx?: HostRouteContext) : string
```

## `hostRegistryOrganizationPollPath`

**What it does:** Poll path: host registry Organization batch. Pair with `hostRegistryOrganizationBatchPath`.

**Signature**

```ts
hostRegistryOrganizationPollPath(ctx?: HostRouteContext) : string
```

## `hostRegistryPath`

**What it does:** Generic host registry route builder (tenant-agnostic, `host/` prefix).

**Why/when:** Use for controller-level registry operations (Organization activate, Order, etc.). Pattern: `/host/cds-{jurisdiction}/v1/{sector}/registry/org.schema/{resourceType}/{action}`

**Signature**

```ts
hostRegistryPath(ctx: HostRouteContext | undefined, resourceType: string, action: V1Action,) : string
```

## `identityCodePath`

**What it does:** Submit path: identity PKCE code step — sends S256 code_challenge.

**Why/when:** Used internally by `authenticateBackendPkceAndExchange` (step 2 of identity-exchange.v1).

**Signature**

```ts
identityCodePath(ctx: RouteContext) : string
```

## `identityCodePollPath`

**What it does:** Poll path: identity PKCE code. Pair with `identityCodePath`.

**Signature**

```ts
identityCodePollPath(ctx: RouteContext) : string
```

## `identityDeviceDcrPath`

**What it does:** Submit path: identity DCR step — binds API key to service public JWK.

**Why/when:** Used internally by `authenticateBackendPkceAndExchange` (step 1 of identity-exchange.v1).

**Signature**

```ts
identityDeviceDcrPath(ctx?: RouteContext) : string
```

## `identityDeviceDcrPollPath`

**What it does:** Poll path: identity DCR. Pair with `identityDeviceDcrPath`.

**Signature**

```ts
identityDeviceDcrPollPath(ctx?: RouteContext) : string
```

## `identityFirebaseCustomPath`

**What it does:** Submit path: Firebase custom token exchange (end-user device flow, NOT B2B).

**Signature**

```ts
identityFirebaseCustomPath(ctx: RouteContext) : string
```

## `identityFirebaseCustomPollPath`

**What it does:** Poll path: Firebase custom token. Pair with `identityFirebaseCustomPath`.

**Signature**

```ts
identityFirebaseCustomPollPath(ctx: RouteContext) : string
```

## `identityLicenseIssuePath`

**What it does:** Submit path: identity license issue (`identity/auth/_issue`).

**Signature**

```ts
identityLicenseIssuePath(ctx?: RouteContext) : string
```

## `identityOpenIdSmartTokenPath`

**What it does:** Submit path: SMART OpenID token request (`identity/openid/smart/token`).

**Signature**

```ts
identityOpenIdSmartTokenPath(ctx?: RouteContext) : string
```

## `identityOpenIdSmartTokenPollPath`

**What it does:** Poll path: SMART OpenID token request. Pair with `identityOpenIdSmartTokenPath`.

**Signature**

```ts
identityOpenIdSmartTokenPollPath(ctx?: RouteContext) : string
```

## `identitySmartTokenPath`

**What it does:** Submit path: SMART token step — code + code_verifier → id_token.

**Why/when:** Used internally by `authenticateBackendPkceAndExchange` (step 3 of identity-exchange.v1).

**Signature**

```ts
identitySmartTokenPath(ctx: RouteContext) : string
```

## `identitySmartTokenPollPath`

**What it does:** Poll path: SMART token. Pair with `identitySmartTokenPath`.

**Signature**

```ts
identitySmartTokenPollPath(ctx: RouteContext) : string
```

## `identityTokenExchangePath`

**What it does:** Submit path: identity token exchange — id_token → SMART bearer.

**Why/when:** Used internally by `authenticateBackendPkceAndExchange` (step 4 of identity-exchange.v1).

**Signature**

```ts
identityTokenExchangePath(ctx?: RouteContext) : string
```

## `identityTokenExchangePollPath`

**What it does:** Poll path: identity token exchange. Pair with `identityTokenExchangePath`.

**Signature**

```ts
identityTokenExchangePollPath(ctx?: RouteContext) : string
```

## `importIpsOrFhirAndUpdateIndex`

**What it does:** UC 5.5 wrapper: import IPS/FHIR composition and update subject index context.

**Signature**

```ts
importIpsOrFhirAndUpdateIndex(ctx: RouteContext | undefined, input: IpsOrFhirImportInput,) : Promise<SubmitAndPollResult>
```

## `individualCommunicationBatchPath`

**What it does:** Submit path: individual Communication (`{format}/Communication/_batch`).

**Signature**

```ts
individualCommunicationBatchPath(ctx: RouteContext, pathFormatSegment: 'org.hl7.fhir.api' | 'org.hl7.fhir.r4' = 'org.hl7.fhir.r4',) : string
```

## `individualCommunicationPollPath`

**What it does:** Poll path: individual Communication. Pair with `individualCommunicationBatchPath`.

**Signature**

```ts
individualCommunicationPollPath(ctx: RouteContext, pathFormatSegment: 'org.hl7.fhir.api' | 'org.hl7.fhir.r4' = 'org.hl7.fhir.r4',) : string
```

## `individualCompositionR4BatchPath`

**What it does:** Submit path: individual Composition (FHIR R4, `org.hl7.fhir.r4/Composition/_batch`).

**Signature**

```ts
individualCompositionR4BatchPath(ctx: RouteContext) : string
```

## `individualCompositionR4PollPath`

**What it does:** Poll path: individual Composition R4. Pair with `individualCompositionR4BatchPath`.

**Signature**

```ts
individualCompositionR4PollPath(ctx: RouteContext) : string
```

## `individualConsentR4BatchPath`

**What it does:** Submit path: individual Consent (FHIR R4, `org.hl7.fhir.r4/Consent/_batch`).

**Signature**

```ts
individualConsentR4BatchPath(ctx: RouteContext) : string
```

## `individualConsentR4PollPath`

**What it does:** Poll path: individual Consent R4. Pair with `individualConsentR4BatchPath`.

**Signature**

```ts
individualConsentR4PollPath(ctx: RouteContext) : string
```

## `individualFamilyOrderBatchPath`

**What it does:** Submit path: individual/family Order batch (`org.schema/Order/_batch`).

**Signature**

```ts
individualFamilyOrderBatchPath(ctx?: RouteContext) : string
```

## `individualFamilyOrderPollPath`

**What it does:** Poll path: individual/family Order. Pair with `individualFamilyOrderBatchPath`.

**Signature**

```ts
individualFamilyOrderPollPath(ctx?: RouteContext) : string
```

## `individualFamilyOrganizationBatchPath`

**What it does:** Submit path: individual/family Organization onboarding (`org.schema/Organization/_batch`).

**Why/when:** Use for `family-registration/_create-or-resume` DIDComm payloads.

**Signature**

```ts
individualFamilyOrganizationBatchPath(ctx?: RouteContext) : string
```

## `individualFamilyOrganizationPollPath`

**What it does:** Poll path: individual/family Organization. Pair with `individualFamilyOrganizationBatchPath`.

**Signature**

```ts
individualFamilyOrganizationPollPath(ctx?: RouteContext) : string
```

## `individualFamilyOrganizationSearchPath`

**What it does:** Submit path: individual/family Organization search (`org.schema/Organization/_search`).

**Signature**

```ts
individualFamilyOrganizationSearchPath(ctx?: RouteContext) : string
```

## `individualFamilyOrganizationSearchPollPath`

**What it does:** Poll path: individual/family Organization search. Pair with `individualFamilyOrganizationSearchPath`.

**Signature**

```ts
individualFamilyOrganizationSearchPollPath(ctx?: RouteContext) : string
```

## `individualLegacyPersonBatchPath`

**What it does:** Submit path: individual Person legacy format (`individual/org.schema/Person/_batch`). Use for older flows; prefer Organization for family onboarding.

**Signature**

```ts
individualLegacyPersonBatchPath(ctx: RouteContext) : string
```

## `individualMedicationOverlapCheckPath`

**What it does:** Endpoint path for medication overlap pre-check (planned GW contract).

**Signature**

```ts
individualMedicationOverlapCheckPath(ctx: RouteContext) : string
```

## `individualObservationBatchPath`

**What it does:** Submit path: individual Observation (FHIR R4 API, `org.hl7.fhir.api/Observation/_batch`).

**Signature**

```ts
individualObservationBatchPath(ctx: RouteContext) : string
```

## `individualObservationPollPath`

**What it does:** Poll path: individual Observation. Pair with `individualObservationBatchPath`.

**Signature**

```ts
individualObservationPollPath(ctx: RouteContext) : string
```

## `individualRelatedPersonBatchPath`

**What it does:** Submit path: individual RelatedPerson (FHIR R4 API, `org.hl7.fhir.api/RelatedPerson/_batch`).

**Signature**

```ts
individualRelatedPersonBatchPath(ctx: RouteContext) : string
```

## `individualRelatedPersonPollPath`

**What it does:** Poll path: individual RelatedPerson. Pair with `individualRelatedPersonBatchPath`.

**Signature**

```ts
individualRelatedPersonPollPath(ctx: RouteContext) : string
```

## `individualTaskBatchPath`

**What it does:** Submit path: individual Task (FHIR R4 API, `org.hl7.fhir.api/Task/_batch`).

**Signature**

```ts
individualTaskBatchPath(ctx: RouteContext) : string
```

## `individualTaskPollPath`

**What it does:** Poll path: individual Task. Pair with `individualTaskBatchPath`.

**Signature**

```ts
individualTaskPollPath(ctx: RouteContext) : string
```

## `ingestCommunicationAndUpdateIndex`

**What it does:** Ingestion wrapper: submit Communication payload and let GW process/update index asynchronously.

**Why/when:** Use `pathFormatSegment` to select target format path. Defaults to `org.hl7.fhir.api`.

**Signature**

```ts
ingestCommunicationAndUpdateIndex(ctx: RouteContext | undefined, input: CommunicationIngestionInput,) : Promise<SubmitAndPollResult>
```

## `pollBatchResponse`

**What it does:** Single poll attempt against a `_batch-response` or `_*-response` path.

**Why/when:** Returns HTTP 202 while the job is still processing, 200 (or other) when done. Prefer `pollUntilComplete` for automatic retry loops.

**Signature**

```ts
pollBatchResponse(path: string, request: AsyncPollRequest,) : Promise<
```

## `pollUntilComplete`

**What it does:** Poll a `_*-response` path repeatedly until the status is no longer 202.

**Why/when:** Default: 60s timeout, 2s interval. Throws if timeout is exceeded.

**Signature**

```ts
pollUntilComplete(path: string, request: AsyncPollRequest, options?: PollOptions) : Promise<PollResult>
```

## `postFormData`

**What it does:** POST a multipart/form-data payload.

**Why/when:** Use for file upload endpoints. Prefer `uploadConversionFile` for DataConversion uploads.

**Signature**

```ts
postFormData(path: string, formData: FormData) : Promise<SubmitResponse>
```

## `postJson`

**What it does:** POST a plain JSON payload.

**Why/when:** Use for non-DIDComm routes (e.g. token exchange body, API key management). Content-Type: `application/json`.

**Signature**

```ts
postJson(path: string, payload: unknown) : Promise<SubmitResponse>
```

## `requestSmartToken`

**What it does:** Exchange token payload against gateway token endpoint and cache the result.

**Signature**

```ts
requestSmartToken(input: SmartTokenExchangeInput) : Promise<SmartTokenExchangeResult>
```

## `requestSmartTokenSimple`

**What it does:** Friendly wrapper for SMART token request via GW identity/auth token-exchange route.

**Why/when:** Uses one object, seconds-based polling, and constructor ctx fallback.

**Signature**

```ts
requestSmartTokenSimple(input: SmartTokenRequestSimpleInput,) : Promise<SmartTokenExchangeResult>
```

## `searchFamilyOrganization`

**What it does:** Search for an existing family Organization registration by phone + usualname.

**Why/when:** Submits to `individual/org.schema/Organization/_search`, polls for the result, and parses the bundle entry into a `FamilyOrganizationSummary`. Returns `null` when no matching registration exists.

**Signature**

```ts
searchFamilyOrganization(ctx: RouteContext | undefined, filters: { controllerPhone: string; usualname: string; birthDate?: string }, options?: PollOptions,) : Promise<FamilyOrganizationSummary | null>
```

## `setContext`

**What it does:** Set default route context for subsequent calls.

**Signature**

```ts
setContext(ctx: RouteContext) : this
```

## `setContextOrg`

**What it does:** Preferred alias for organization/tenant integration context.

**Signature**

```ts
setContextOrg(ctx: RouteContext) : this
```

## `setDefaultIntervalSeconds`

**What it does:** Set default polling interval (seconds) for simple helper methods.

**Signature**

```ts
setDefaultIntervalSeconds(seconds: number) : this
```

## `setDefaultTimeoutSeconds`

**What it does:** Set default polling timeout (seconds) for simple helper methods.

**Signature**

```ts
setDefaultTimeoutSeconds(seconds: number) : this
```

## `setJurisdiction`

**What it does:** Update only `jurisdiction` in default route context.

**Signature**

```ts
setJurisdiction(jurisdiction: string) : this
```

## `setSector`

**What it does:** Update only `sector` in default route context.

**Signature**

```ts
setSector(sector: string) : this
```

## `setTenantId`

**What it does:** Update only `tenantId` in default route context.

**Signature**

```ts
setTenantId(tenantId: string) : this
```

## `startIndividualOrganizationSimple`

**What it does:** Friendly wrapper (recommended step 1): register individual organization and return Offer.

**Signature**

```ts
startIndividualOrganizationSimple(input: IndividualOrganizationBootstrapSimpleInput,) : Promise<IndividualOrganizationStartSimpleResult>
```

## `submitAndPoll`

**What it does:** Submit a DIDComm batch payload and poll until the async job completes.

**Why/when:** Convenience wrapper around `submitBatch` + `pollUntilComplete`. Requires `payload.thid` to be set (used as the poll correlation key). Use `createDidcommPlainMessage` from `builders.ts` to build the payload with a `thid`.

**Signature**

```ts
submitAndPoll(submitPath: string, pollPath: string, payload: { thid?: string } & Record<string, unknown>, options?: PollOptions,) : Promise<SubmitAndPollResult>
```

## `submitBatch`

**What it does:** POST a DIDComm plaintext payload to a batch submit path.

**Why/when:** Use this for all `_batch` routes (family registration, observations, tasks, etc.). Content-Type: `application/didcomm-plaintext+json`. Returns immediately with the HTTP response — pair with `pollUntilComplete` or use `submitAndPoll`.

**Signature**

```ts
submitBatch(path: string, payload: unknown) : Promise<SubmitResponse>
```

## `submitBatchEncrypted`

**What it does:** Sign and encrypt a DIDComm payload (nested JWS-in-JWE) and POST to the given path.

**Why/when:** Content-Type: `application/didcomm-encrypted+json`. Flow: `payload JSON → ES384 compact JWS → RSA-OAEP-256/A256GCM compact JWE → POST` Requires a wallet provider and the recipient's RSA encryption JWK

**Signature**

```ts
submitBatchEncrypted(path: string, payload: { thid?: string } & Record<string, unknown>, recipientEncryptionJwk: PublicJwk, walletContext: WalletContext,) : Promise<SubmitResponse>
```

## `submitBundle`

**What it does:** POST a DIDComm bundle payload.

**Why/when:** This is the preferred high-level method for DIDComm submission of FHIR/API bundles (batch, transaction, message, etc.). Returns immediately with the HTTP response — pair with `pollUntilComplete` or use `submitAndPoll`.

**Signature**

```ts
submitBundle(path: string, payload: { thid?: string } & Record<string, unknown>, options?: { mode?: 'plain' | 'strict'; recipientEncryptionJwk?: PublicJwk; walletContext?: WalletContext; },) : Promise<SubmitResponse>
```

## `submitLegacyJson`

**What it does:** Legacy JSON submit for non-bundle payloads (openid/token/resource JSON bodies).

**Why/when:** Keeps JSON flows explicit and semantically separated from DIDComm bundle flows.

**Signature**

```ts
submitLegacyJson(path: string, payload: unknown) : Promise<SubmitResponse>
```

## `taskDebugCallStartPath`

**What it does:** Submit path: UHC debug task call-start (`individual/{format}/Task/_call-start`). For telephony integration testing.

**Signature**

```ts
taskDebugCallStartPath(ctx: RouteContext, format = 'org.hl7.fhir.api') : string
```

## `taskDebugLogsPath`

**What it does:** Path: UHC debug task logs (`individual/{format}/Task/_logs`). Retrieve async task execution logs.

**Signature**

```ts
taskDebugLogsPath(ctx: RouteContext, format = 'org.hl7.fhir.api') : string
```

## `tenantIdentityPath`

**What it does:** Generic tenant-scoped identity route builder.

**Why/when:** Pattern: `/{prefix}/cds-{jurisdiction}/v1/{sector}/{tenantId}/identity/auth/{action}` The `prefix` is service-specific: `host` for GW, `publisher` for DataConv, `ica` for ICA. Dedicated path methods in this SDK use `host` (GW convention).

**Signature**

```ts
tenantIdentityPath(ctx: RouteContext | undefined, prefix: string, action: string) : string
```

## `uploadConversionFile`

**What it does:** Upload a file to a DataConversion endpoint.

**Why/when:** Wraps `postFormData` with sensible defaults for file field naming and multipart encoding.

**Signature**

```ts
uploadConversionFile(params: { path: string; fileName: string; fileContent: Blob | Buffer | Uint8Array | ArrayBuffer; fileFieldName?: string; fields?: Record<string, string>; }) : Promise<SubmitResponse>
```

## `upsertRelatedPersonAndPoll`

**What it does:** RelatedPerson wrapper: submit contact payload and poll until completion.

**Signature**

```ts
upsertRelatedPersonAndPoll(ctx: RouteContext | undefined, input: RelatedPersonUpsertInput,) : Promise<SubmitAndPollResult>
```

## `v1Path`

**What it does:** Generic GW v1 tenant route builder.

**Why/when:** Use this for any section/format/resourceType/action combination not covered by a dedicated convenience method. Pattern: `/{tenantId}/cds-{jurisdiction}/v1/{sector}/{section}/{format}/{resourceType}/{action}`

**Signature**

```ts
v1Path(ctx: RouteContext | undefined, section: V1Section, format: string, resourceType: string, action: V1Action,) : string
```
