# SDK API Table (Complete)

Generated from JSDoc in `src/client.ts`. Methods: **102**.

| Method | What it does | Signature |
|---|---|---|
| `activateEmployeeDeviceWithActivationCode` | Activate employee/member device by activation code exchange + DCR registration. | `activateEmployeeDeviceWithActivationCode(ctx: RouteContext | undefined, input: EmployeeDeviceActivationInput,) : Promise<EmployeeDeviceActivationResult>` |
| `activateEmployeeDeviceWithActivationCodeSimple` | Friendly wrapper for employee/member device activation. | `activateEmployeeDeviceWithActivationCodeSimple(input: EmployeeDeviceActivationSimpleInput,) : Promise<EmployeeDeviceActivationResult>` |
| `activateOrganizationInGatewayFromIcaProof` | Activate tenant organization in GW from ICA-derived proof. | `activateOrganizationInGatewayFromIcaProof(ctx: HostRouteContext | undefined, input: GatewayOrganizationActivationInput, options?: PollOptions,) : Promise<SubmitAndPollResult>` |
| `activateOrganizationInGatewaySimple` | Friendly wrapper for legal organization activation. | `activateOrganizationInGatewaySimple(input: GatewayOrganizationActivationSimpleInput,) : Promise<SubmitAndPollResult>` |
| `assertFirstDidcommEntrySuccess` | Throws when first DIDComm entry contains a business-level error status. | `assertFirstDidcommEntrySuccess(result: SubmitAndPollResult | PollResult | unknown, contextLabel: string,) : void` |
| `authenticateBackendPkceAndExchange` | Orchestrates the full identity-exchange.v1 backend auth flow: | `authenticateBackendPkceAndExchange(options: BackendPkceAuthOptions,) : Promise<BackendPkceAuthResult>` |
| `authenticateBackendSmartStandard` | smart-backend.v1: obtain an OAuth2 backend token using client_credentials + private_key_jwt. | `authenticateBackendSmartStandard(options: BackendSmartAuthOptions,) : Promise<BackendSmartAuthResult>` |
| `bootstrapIndividualOrganizationSimple` | Friendly wrapper (provisional): register + auto-confirm individual order. | `bootstrapIndividualOrganizationSimple(input: IndividualOrganizationBootstrapSimpleInput,) : Promise<IndividualOrganizationBootstrapSimpleResult>` |
| `bootstrapSubjectOrganizationIndex` | UC 5.1 wrapper: bootstrap subject organization context via registration + optional order confirmation. | `bootstrapSubjectOrganizationIndex(ctx: RouteContext | undefined, input: SubjectOrganizationBootstrapInput,) : Promise<SubjectOrganizationBootstrapResult>` |
| `checkMedicationScheduleOverlap` | Pre-create overlap check for medication intake schedules. | `checkMedicationScheduleOverlap(ctx: RouteContext, input: MedicationOverlapCheckInput,) : Promise<SubmitResponse>` |
| `confirmIndividualOrganizationOrderSimple` | Friendly wrapper (recommended step 2): confirm individual/family order from accepted offerId. | `confirmIndividualOrganizationOrderSimple(input: IndividualOrganizationConfirmOrderSimpleInput,) : Promise<SubmitAndPollResult>` |
| `confirmLegalOrganizationOrderSimple` | Friendly wrapper for legal organization Order confirmation. | `confirmLegalOrganizationOrderSimple(input: LegalOrganizationOrderSimpleInput,) : Promise<SubmitAndPollResult>` |
| `conversionUploadPath` | Submit path: DataConversion file upload. | `conversionUploadPath(ctx: RouteContext, softwareId: string, sourceFormat: string) : string` |
| `conversionUploadPollPath` | Poll path: DataConversion upload. Pair with `conversionUploadPath`. | `conversionUploadPollPath(ctx: RouteContext, softwareId: string, sourceFormat: string) : string` |
| `createMedicationReminderTasks` | High-level helper for medication reminder creation. | `createMedicationReminderTasks(ctx: RouteContext, input: MedicationRegistrationInput, options?: PollOptions,) : Promise<SubmitAndPollResult>` |
| `createOrganizationEmployee` | UC 5.3 wrapper: create organization employee in entity Employee batch route. | `createOrganizationEmployee(ctx: RouteContext | undefined, input: OrganizationEmployeeCreationInput, options?: PollOptions,) : Promise<SubmitAndPollResult>` |
| `createPhoneReminderTasks` | Create scheduled phone reminder Task entries through canonical Task `_batch` routes. | `createPhoneReminderTasks(ctx: RouteContext | undefined, input: CreatePhoneReminderTasksInput, options?: PollOptions,) : Promise<SubmitAndPollResult>` |
| `digitalTwinCompositionApiBatchPath` | Submit path: digital twin Composition (FHIR API format, `digitaltwin/org.hl7.fhir.api/Composition/_batch`). | `digitalTwinCompositionApiBatchPath(ctx: RouteContext) : string` |
| `digitalTwinCompositionApiPollPath` | Poll path: digital twin Composition API. Pair with `digitalTwinCompositionApiBatchPath`. | `digitalTwinCompositionApiPollPath(ctx: RouteContext) : string` |
| `digitalTwinCompositionR4BatchPath` | Submit path: digital twin Composition (FHIR R4 format, `digitaltwin/org.hl7.fhir.r4/Composition/_batch`). | `digitalTwinCompositionR4BatchPath(ctx: RouteContext) : string` |
| `digitalTwinCompositionR4PollPath` | Poll path: digital twin Composition R4. Pair with `digitalTwinCompositionR4BatchPath`. | `digitalTwinCompositionR4PollPath(ctx: RouteContext) : string` |
| `employeeBatchPath` | Submit path: entity Employee (`entity/org.schema/Employee/_batch`). | `employeeBatchPath(ctx?: RouteContext) : string` |
| `employeePollPath` | Poll path: entity Employee. Pair with `employeeBatchPath`. | `employeePollPath(ctx?: RouteContext) : string` |
| `generateDigitalTwinFromSubjectData` | UC 5.7 wrapper: generate digital twin composition from subject data. | `generateDigitalTwinFromSubjectData(ctx: RouteContext | undefined, input: DigitalTwinGenerationInput,) : Promise<SubmitAndPollResult>` |
| `getActivationCodeFromResponse` | Extract activation code from response payload or claims. | `getActivationCodeFromResponse(result: SubmitAndPollResult | PollResult | unknown) : string | undefined` |
| `getCachedBearerToken` | Returns the cached SMART bearer for the given endpointId if still valid (>30s remaining). | `getCachedBearerToken(tokenCacheKey: string) : string | undefined` |
| `getDidcommMessageBodyFromResponse` | Normalize GW async response into DIDComm message body. | `getDidcommMessageBodyFromResponse(result: SubmitAndPollResult | PollResult | unknown,) : Record<string, unknown> | undefined` |
| `getEndpointId` | Builds a deterministic endpoint id for token cache and auth/session reuse. | `getEndpointId(selector: EndpointSelector, providerDid?: string) : string` |
| `getFirstDidcommDataEntryFromResponse` | Return first DIDComm business entry from a submit/poll result. | `getFirstDidcommDataEntryFromResponse(result: SubmitAndPollResult | PollResult | unknown,) : Record<string, unknown> | undefined` |
| `getOfferIdFromResponse` | Extract `org.schema.Offer.identifier` from a submit/poll result. | `getOfferIdFromResponse(result: SubmitAndPollResult | PollResult | unknown) : string | undefined` |
| `getOfferInfoFromResponse` | Alias of `getOfferPreviewFromResponse` with business naming. | `getOfferInfoFromResponse(result: SubmitAndPollResult | PollResult | unknown) : OfferInfo` |
| `getOfferPreviewFromResponse` | Extract a UI-ready Offer preview from activation/registration responses. | `getOfferPreviewFromResponse(result: SubmitAndPollResult | PollResult | unknown) : OfferPreview` |
| `getWallet` | Return the currently configured wallet provider (if any). | `getWallet() : WalletProvider | undefined` |
| `grantProfessionalAccessSimple` | UC 5.6 consent helper from minimal frontend fields. | `grantProfessionalAccessSimple(ctx: RouteContext | undefined, input: GrantProfessionalAccessSimpleInput,) : Promise<GrantProfessionalAccessSimpleResult>` |
| `hostRegistryOrderBatchPath` | Submit path: host registry Order batch (controller-level order submission). | `hostRegistryOrderBatchPath(ctx?: HostRouteContext) : string` |
| `hostRegistryOrderPollPath` | Poll path: host registry Order batch. Pair with `hostRegistryOrderBatchPath`. | `hostRegistryOrderPollPath(ctx?: HostRouteContext) : string` |
| `hostRegistryOrganizationActivatePath` | Submit path: activate a tenant Organization in the GW registry using a VC from ICA. | `hostRegistryOrganizationActivatePath(ctx?: HostRouteContext) : string` |
| `hostRegistryOrganizationActivatePollPath` | Poll path: `_activate` response. Pair with `hostRegistryOrganizationActivatePath`. | `hostRegistryOrganizationActivatePollPath(ctx?: HostRouteContext) : string` |
| `hostRegistryOrganizationBatchPath` | Submit path: host registry Organization batch (controller-level org registration). | `hostRegistryOrganizationBatchPath(ctx?: HostRouteContext) : string` |
| `hostRegistryOrganizationPollPath` | Poll path: host registry Organization batch. Pair with `hostRegistryOrganizationBatchPath`. | `hostRegistryOrganizationPollPath(ctx?: HostRouteContext) : string` |
| `hostRegistryPath` | Generic host registry route builder (tenant-agnostic, `host/` prefix). | `hostRegistryPath(ctx: HostRouteContext | undefined, resourceType: string, action: V1Action,) : string` |
| `identityCodePath` | Submit path: identity PKCE code step — sends S256 code_challenge. | `identityCodePath(ctx: RouteContext) : string` |
| `identityCodePollPath` | Poll path: identity PKCE code. Pair with `identityCodePath`. | `identityCodePollPath(ctx: RouteContext) : string` |
| `identityDeviceDcrPath` | Submit path: identity DCR step — binds API key to service public JWK. | `identityDeviceDcrPath(ctx?: RouteContext) : string` |
| `identityDeviceDcrPollPath` | Poll path: identity DCR. Pair with `identityDeviceDcrPath`. | `identityDeviceDcrPollPath(ctx?: RouteContext) : string` |
| `identityFirebaseCustomPath` | Submit path: Firebase custom token exchange (end-user device flow, NOT B2B). | `identityFirebaseCustomPath(ctx: RouteContext) : string` |
| `identityFirebaseCustomPollPath` | Poll path: Firebase custom token. Pair with `identityFirebaseCustomPath`. | `identityFirebaseCustomPollPath(ctx: RouteContext) : string` |
| `identityLicenseIssuePath` | Submit path: identity license issue (`identity/auth/_issue`). | `identityLicenseIssuePath(ctx?: RouteContext) : string` |
| `identityOpenIdSmartTokenPath` | Submit path: SMART OpenID token request (`identity/openid/smart/token`). | `identityOpenIdSmartTokenPath(ctx?: RouteContext) : string` |
| `identityOpenIdSmartTokenPollPath` | Poll path: SMART OpenID token request. Pair with `identityOpenIdSmartTokenPath`. | `identityOpenIdSmartTokenPollPath(ctx?: RouteContext) : string` |
| `identitySmartTokenPath` | Submit path: SMART token step — code + code_verifier → id_token. | `identitySmartTokenPath(ctx: RouteContext) : string` |
| `identitySmartTokenPollPath` | Poll path: SMART token. Pair with `identitySmartTokenPath`. | `identitySmartTokenPollPath(ctx: RouteContext) : string` |
| `identityTokenExchangePath` | Submit path: identity token exchange — id_token → SMART bearer. | `identityTokenExchangePath(ctx?: RouteContext) : string` |
| `identityTokenExchangePollPath` | Poll path: identity token exchange. Pair with `identityTokenExchangePath`. | `identityTokenExchangePollPath(ctx?: RouteContext) : string` |
| `importIpsOrFhirAndUpdateIndex` | UC 5.5 wrapper: import IPS/FHIR composition and update subject index context. | `importIpsOrFhirAndUpdateIndex(ctx: RouteContext | undefined, input: IpsOrFhirImportInput,) : Promise<SubmitAndPollResult>` |
| `individualCommunicationBatchPath` | Submit path: individual Communication (`{format}/Communication/_batch`). | `individualCommunicationBatchPath(ctx: RouteContext, pathFormatSegment: 'org.hl7.fhir.api' | 'org.hl7.fhir.r4' = 'org.hl7.fhir.r4',) : string` |
| `individualCommunicationPollPath` | Poll path: individual Communication. Pair with `individualCommunicationBatchPath`. | `individualCommunicationPollPath(ctx: RouteContext, pathFormatSegment: 'org.hl7.fhir.api' | 'org.hl7.fhir.r4' = 'org.hl7.fhir.r4',) : string` |
| `individualCompositionR4BatchPath` | Submit path: individual Composition (FHIR R4, `org.hl7.fhir.r4/Composition/_batch`). | `individualCompositionR4BatchPath(ctx: RouteContext) : string` |
| `individualCompositionR4PollPath` | Poll path: individual Composition R4. Pair with `individualCompositionR4BatchPath`. | `individualCompositionR4PollPath(ctx: RouteContext) : string` |
| `individualConsentR4BatchPath` | Submit path: individual Consent (FHIR R4, `org.hl7.fhir.r4/Consent/_batch`). | `individualConsentR4BatchPath(ctx: RouteContext) : string` |
| `individualConsentR4PollPath` | Poll path: individual Consent R4. Pair with `individualConsentR4BatchPath`. | `individualConsentR4PollPath(ctx: RouteContext) : string` |
| `individualFamilyOrderBatchPath` | Submit path: individual/family Order batch (`org.schema/Order/_batch`). | `individualFamilyOrderBatchPath(ctx?: RouteContext) : string` |
| `individualFamilyOrderPollPath` | Poll path: individual/family Order. Pair with `individualFamilyOrderBatchPath`. | `individualFamilyOrderPollPath(ctx?: RouteContext) : string` |
| `individualFamilyOrganizationBatchPath` | Submit path: individual/family Organization onboarding (`org.schema/Organization/_batch`). | `individualFamilyOrganizationBatchPath(ctx?: RouteContext) : string` |
| `individualFamilyOrganizationPollPath` | Poll path: individual/family Organization. Pair with `individualFamilyOrganizationBatchPath`. | `individualFamilyOrganizationPollPath(ctx?: RouteContext) : string` |
| `individualFamilyOrganizationSearchPath` | Submit path: individual/family Organization search (`org.schema/Organization/_search`). | `individualFamilyOrganizationSearchPath(ctx?: RouteContext) : string` |
| `individualFamilyOrganizationSearchPollPath` | Poll path: individual/family Organization search. Pair with `individualFamilyOrganizationSearchPath`. | `individualFamilyOrganizationSearchPollPath(ctx?: RouteContext) : string` |
| `individualLegacyPersonBatchPath` | Submit path: individual Person legacy format (`individual/org.schema/Person/_batch`). Use for older flows; prefer Organization for family onboarding. | `individualLegacyPersonBatchPath(ctx: RouteContext) : string` |
| `individualMedicationOverlapCheckPath` | Endpoint path for medication overlap pre-check (planned GW contract). | `individualMedicationOverlapCheckPath(ctx: RouteContext) : string` |
| `individualObservationBatchPath` | Submit path: individual Observation (FHIR R4 API, `org.hl7.fhir.api/Observation/_batch`). | `individualObservationBatchPath(ctx: RouteContext) : string` |
| `individualObservationPollPath` | Poll path: individual Observation. Pair with `individualObservationBatchPath`. | `individualObservationPollPath(ctx: RouteContext) : string` |
| `individualRelatedPersonBatchPath` | Submit path: individual RelatedPerson (FHIR R4 API, `org.hl7.fhir.api/RelatedPerson/_batch`). | `individualRelatedPersonBatchPath(ctx: RouteContext) : string` |
| `individualRelatedPersonPollPath` | Poll path: individual RelatedPerson. Pair with `individualRelatedPersonBatchPath`. | `individualRelatedPersonPollPath(ctx: RouteContext) : string` |
| `individualTaskBatchPath` | Submit path: individual Task (FHIR R4 API, `org.hl7.fhir.api/Task/_batch`). | `individualTaskBatchPath(ctx: RouteContext) : string` |
| `individualTaskPollPath` | Poll path: individual Task. Pair with `individualTaskBatchPath`. | `individualTaskPollPath(ctx: RouteContext) : string` |
| `ingestCommunicationAndUpdateIndex` | Ingestion wrapper: submit Communication payload and let GW process/update index asynchronously. | `ingestCommunicationAndUpdateIndex(ctx: RouteContext | undefined, input: CommunicationIngestionInput,) : Promise<SubmitAndPollResult>` |
| `pollBatchResponse` | Single poll attempt against a `_batch-response` or `_*-response` path. | `pollBatchResponse(path: string, request: AsyncPollRequest,) : Promise<` |
| `pollUntilComplete` | Poll a `_*-response` path repeatedly until the status is no longer 202. | `pollUntilComplete(path: string, request: AsyncPollRequest, options?: PollOptions) : Promise<PollResult>` |
| `postFormData` | POST a multipart/form-data payload. | `postFormData(path: string, formData: FormData) : Promise<SubmitResponse>` |
| `postJson` | POST a plain JSON payload. | `postJson(path: string, payload: unknown) : Promise<SubmitResponse>` |
| `requestSmartToken` | Exchange token payload against gateway token endpoint and cache the result. | `requestSmartToken(input: SmartTokenExchangeInput) : Promise<SmartTokenExchangeResult>` |
| `requestSmartTokenSimple` | Friendly wrapper for SMART token request via GW identity/auth token-exchange route. | `requestSmartTokenSimple(input: SmartTokenRequestSimpleInput,) : Promise<SmartTokenExchangeResult>` |
| `searchFamilyOrganization` | Search for an existing family Organization registration by phone + usualname. | `searchFamilyOrganization(ctx: RouteContext | undefined, filters: { controllerPhone: string; usualname: string; birthDate?: string }, options?: PollOptions,) : Promise<FamilyOrganizationSummary | null>` |
| `setContext` | Set default route context for subsequent calls. | `setContext(ctx: RouteContext) : this` |
| `setContextOrg` | Preferred alias for organization/tenant integration context. | `setContextOrg(ctx: RouteContext) : this` |
| `setDefaultIntervalSeconds` | Set default polling interval (seconds) for simple helper methods. | `setDefaultIntervalSeconds(seconds: number) : this` |
| `setDefaultTimeoutSeconds` | Set default polling timeout (seconds) for simple helper methods. | `setDefaultTimeoutSeconds(seconds: number) : this` |
| `setJurisdiction` | Update only `jurisdiction` in default route context. | `setJurisdiction(jurisdiction: string) : this` |
| `setSector` | Update only `sector` in default route context. | `setSector(sector: string) : this` |
| `setTenantId` | Update only `tenantId` in default route context. | `setTenantId(tenantId: string) : this` |
| `startIndividualOrganizationSimple` | Friendly wrapper (recommended step 1): register individual organization and return Offer. | `startIndividualOrganizationSimple(input: IndividualOrganizationBootstrapSimpleInput,) : Promise<IndividualOrganizationStartSimpleResult>` |
| `submitAndPoll` | Submit a DIDComm batch payload and poll until the async job completes. | `submitAndPoll(submitPath: string, pollPath: string, payload: { thid?: string } & Record<string, unknown>, options?: PollOptions,) : Promise<SubmitAndPollResult>` |
| `submitBatch` | POST a DIDComm plaintext payload to a batch submit path. | `submitBatch(path: string, payload: unknown) : Promise<SubmitResponse>` |
| `submitBatchEncrypted` | Sign and encrypt a DIDComm payload (nested JWS-in-JWE) and POST to the given path. | `submitBatchEncrypted(path: string, payload: { thid?: string } & Record<string, unknown>, recipientEncryptionJwk: PublicJwk, walletContext: WalletContext,) : Promise<SubmitResponse>` |
| `submitBundle` | POST a DIDComm bundle payload. | `submitBundle(path: string, payload: { thid?: string } & Record<string, unknown>, options?: { mode?: 'plain' | 'strict'; recipientEncryptionJwk?: PublicJwk; walletContext?: WalletContext; },) : Promise<SubmitResponse>` |
| `submitLegacyJson` | Legacy JSON submit for non-bundle payloads (openid/token/resource JSON bodies). | `submitLegacyJson(path: string, payload: unknown) : Promise<SubmitResponse>` |
| `taskDebugCallStartPath` | Submit path: UHC debug task call-start (`individual/{format}/Task/_call-start`). For telephony integration testing. | `taskDebugCallStartPath(ctx: RouteContext, format = 'org.hl7.fhir.api') : string` |
| `taskDebugLogsPath` | Path: UHC debug task logs (`individual/{format}/Task/_logs`). Retrieve async task execution logs. | `taskDebugLogsPath(ctx: RouteContext, format = 'org.hl7.fhir.api') : string` |
| `tenantIdentityPath` | Generic tenant-scoped identity route builder. | `tenantIdentityPath(ctx: RouteContext | undefined, prefix: string, action: string) : string` |
| `uploadConversionFile` | Upload a file to a DataConversion endpoint. | `uploadConversionFile(params: { path: string; fileName: string; fileContent: Blob | Buffer | Uint8Array | ArrayBuffer; fileFieldName?: string; fields?: Record<string, string>; }) : Promise<SubmitResponse>` |
| `upsertRelatedPersonAndPoll` | RelatedPerson wrapper: submit contact payload and poll until completion. | `upsertRelatedPersonAndPoll(ctx: RouteContext | undefined, input: RelatedPersonUpsertInput,) : Promise<SubmitAndPollResult>` |
| `v1Path` | Generic GW v1 tenant route builder. | `v1Path(ctx: RouteContext | undefined, section: V1Section, format: string, resourceType: string, action: V1Action,) : string` |
