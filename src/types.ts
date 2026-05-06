import type { WalletProvider } from './sdk/dataspace-wallet-sdk-node/provider.js';
import type { PublicJwk, WalletContext } from './sdk/dataspace-wallet-sdk-node/types.js';

export type DidcommPlainMessage = {
  jti: string;
  thid: string;
  iss: string;
  aud: string;
  type: string;
  body: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export type AsyncPollRequest = {
  thid: string;
};

export type RouteContext = {
  tenantId: string;
  jurisdiction: string;
  sector: string;
};

export type V1Section = 'registry' | 'entity' | 'identity' | 'individual' | 'digitaltwin' | string;

export type V1Action =
  | '_batch'
  | '_search'
  | '_search-response'
  | '_batch-response'
  | '_activate'
  | '_activate-response'
  | '_dcr'
  | '_dcr-response'
  | '_exchange'
  | '_exchange-response'
  | '_issue'
  | 'token'
  | 'token-response'
  | '_custom'
  | '_custom-response'
  | string;

export type HostRouteContext = {
  jurisdiction: string;
  sector: string;
};

export type SubmitResponse = {
  status: number;
  location?: string;
  body: unknown;
};

export type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

export type PollResult = {
  status: number;
  body: unknown;
  attempts: number;
};

export type SubmitAndPollResult = {
  submit: SubmitResponse;
  poll: PollResult;
};

/** Status of a family-organization registration lookup or create attempt. */
export type FamilyRegistrationStatus = 'new_created' | 'resume_required' | 'already_exists' | 'not_found';

/**
 * Minimal reference to a SubjectOrganization — the identity root for a subject.
 * Any field can serve as a resolution key. `organizationId` and `did` are canonical;
 * `telephone` + `nickname` are composite lookup keys used during onboarding.
 */
export type SubjectOrganizationRef = {
  /** Vault UUID of the org.schema/Organization resource. */
  organizationId?: string;
  /** Decentralized identifier: did:web:...individual:<id> */
  did?: string;
  /** E.164 phone — used as resolution key during registration (`org.schema.Organization.owner.telephone`). */
  telephone?: string;
  /** `org.schema.Organization.alternateName` (nickname / usualname). */
  nickname?: string;
  /** Optional ISO-8601 date (`org.schema.Organization.foundingDate`) — used as tiebreaker during lookup. */
  birthDate?: string;
};

/**
 * Granular access domain for a SubjectOrganization.
 *
 * Health sub-domains map to FHIR Level 4 Record-keeping and Data Exchange categories:
 *   health.clinical     — Condition, Procedure, AllergyIntolerance, FamilyMemberHistory, …
 *   health.diagnostics  — Observation, DiagnosticReport, ImagingStudy, Specimen, …
 *   health.genomics     — MolecularSequence, GenomicStudy, …
 *   health.medications  — MedicationRequest, MedicationStatement, MedicationDispense, …
 *   health.workflow     — Appointment, Task, ServiceRequest, CarePlan, …
 *   health.financial    — Claim, Coverage, ExplanationOfBenefit, …
 *
 * TODO: Clinical and diagnostics sub-domain must define LOINC codes for specific health sections:
 * - Document section codes (LOINC codes used in CCDA sections).
 * - See https://hl7.org/fhir/valueset-doc-section-codes.html
 *  10154-3 	Chief complaint Narrative - Reported
 *  10157-6 	History of family member diseases Narrative
 *  10160-0 	History of Medication use Narrative
 *  10164-2 	History of Present illness Narrative
 *  10183-2 	Hospital discharge medications Narrative
 *  10184-0 	Hospital discharge physical findings Narrative
 *  10187-3 	Review of systems Narrative - Reported
 *  10210-3 	Physical findings of General status Narrative
 *  10216-0 	Surgical operation note fluids Narrative
 *  10218-6 	Surgical operation note postoperative diagnosis Narrative
 *  10223-6 	Surgical operation note surgical procedure Narrative
 *  10222-8 	Surgical operation note surgical complications [Interpretation] Narrative
 *  11329-0 	History general Narrative - Reported
 *  11348-0 	History of Past illness Narrative
 *  11369-6 	History of Immunization Narrative
 *  57852-6 	Problem list Narrative - Reported
 *  11493-4 	Hospital discharge studies summary Narrative
 *  11535-2 	Hospital discharge Dx Narrative
 *  11537-8 	Surgical drains Narrative
 *  18776-5 	Plan of care note
 *  18841-7 	Hospital consultations Document
 *  29299-5 	Reason for visit Narrative
 *  29545-1 	Physical findings Narrative
 *  29549-3 	Medication administered Narrative
 *  29554-3 	Procedure Narrative
 *  29762-2 	Social history Narrative
 *  30954-2 	Relevant diagnostic tests/laboratory data Narrative
 *  42344-2 	Discharge diet (narrative)
 *  42346-7 	Medications on admission (narrative)
 *  42348-3 	Advance directives
 *  42349-1 	Reason for referral (narrative)
 *  46240-8 	History of Hospitalizations+Outpatient visits Narrative
 *  46241-6 	Hospital admission diagnosis Narrative - Reported
 *  46264-8 	History of medical device use
 *  47420-5 	Functional status assessment note
 *  47519-4 	History of Procedures Document
 *  48765-2 	Allergies and adverse reactions Document
 *  48768-6 	Payment sources Document
 *  51848-0 	Evaluation note
 *  55109-3 	Complications Document
 *  55122-6 	Surgical operation note implants Narrative
 *  59768-2 	Procedure indications [Interpretation] Narrative
 *  59769-0 	Postprocedure diagnosis Narrative
 *  59770-8 	Procedure estimated blood loss Narrative
 *  59771-6 	Procedure implants Narrative
 *  59772-4 	Planned procedure Narrative
 *  59773-2 	Procedure specimens taken Narrative
 *  59775-7 	Procedure disposition Narrative
 *  59776-5 	Procedure findings Narrative
 *  61149-1 	Objective Narrative
 *  61150-9 	Subjective Narrative
 *  69730-0 	Instructions
 *  8648-8  	Hospital course Narrative
 *  8653-8  	Hospital Discharge instructions
 *  8716-3  	Vital signs
 */
export type AccessDomain =
  | 'health.clinical'
  | 'health.diagnostics'
  | 'health.genomics'
  | 'health.medications'
  | 'health.workflow'
  | 'health.financial';
/**
 * Resolved access context for an actor operating on a SubjectOrganization.
 * Controller has default access to all domains; this can be restricted per consent.
 */
export type SubjectOrganizationAccessContext = {
  subjectOrganization: SubjectOrganizationRef;
  /** DID or phone of the actor (controller, caregiver, self, professional). */
  controllerActorRef?: string;
  /** Domains the actor is currently authorized to access. */
  grantedDomains: AccessDomain[];
  /** SMART bearer token (issued when backend supports subject-scoped organization tokens). */
  accessToken?: string;
  /** ID of the default consent rule bootstrapped for this controller. */
  consentId?: string;
  /** Lifecycle state of the access context. */
  status?: 'ready' | 'consent_pending' | 'token_pending';
};

/** Summary returned by `searchFamilyOrganization` or parsed from a family `_batch` response. */
export type FamilyOrganizationSummary = {
  status: FamilyRegistrationStatus;
  offerId?: string;
  organizationId?: string;
  /** Subject identity snapshot. Shares the same shape as SubjectOrganizationRef. */
  subjectInfo?: SubjectOrganizationRef;
  missingFields?: string[];
  updatedAt?: string;
};

export type OfferPreview = {
  offerId?: string;
  amount?: string;
  currency?: string;
  seats?: number;
  planName?: string;
  sku?: string;
  paymentMethod?: string;
  checkoutUrl?: string;
};

export type OfferInfo = OfferPreview;

export type EndpointSelector = {
  section: string;
  format: string;
  resourceType: string;
  action: string;
};

/**
 * Input for organization activation in GW using ICA-derived proof material.
 *
 * `vpToken` is required because GW activation validates the VP proof.
 * VC and regulatory evidence are optional enrichments used by policy/business checks.
 */
export type GatewayOrganizationActivationInput = {
  vpToken: string;
  /** Generic requested seats/members for initial offer sizing. Defaults to 2. */
  numberOfMembers?: number;
  organizationVc?: string;
  legalRepresentativeVc?: string;
  regulatoryEvidence?: Record<string, unknown>;
  /** @deprecated Prefer `numberOfMembers` and explicit input fields. */
  additionalClaims?: Record<string, unknown>;
};

export type GatewayOrganizationActivationSimpleInput = {
  jurisdiction?: string;
  sector?: string;
  vpToken: string;
  serviceProviderDidWeb?: string;
  serviceProviderUrl?: string;
  controllerEmail?: string;
  controllerTelephone?: string;
  controllerRole: string;
  numberOfMembers?: number;
  timeoutSeconds?: number;
  intervalSeconds?: number;
  organizationVc?: string;
  legalRepresentativeVc?: string;
  regulatoryEvidence?: Record<string, unknown>;
  additionalClaims?: Record<string, unknown>;
};

export type LegalOrganizationOrderSimpleInput = {
  jurisdiction?: string;
  sector?: string;
  offerId: string;
  timeoutSeconds?: number;
  intervalSeconds?: number;
  dataType?: string;
  additionalClaims?: Record<string, unknown>;
};

/**
 * Input for device activation based on activation code exchange + DCR.
 */
export type EmployeeDeviceActivationInput = {
  activationCode: string;
  idToken: string;
  dcrPayload: Record<string, unknown>;
  pollOptions?: PollOptions;
};

export type EmployeeDeviceActivationSimpleInput = {
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  activationCode: string;
  idToken: string;
  dcrPayload: Record<string, unknown>;
  timeoutSeconds?: number;
  intervalSeconds?: number;
};

/**
 * Result of device activation flow.
 *
 * - `exchange` is the Token/_exchange submit+poll result.
 * - `dcr` is the Device/_dcr submit+poll result.
 */
export type EmployeeDeviceActivationResult = {
  initialAccessToken: string;
  exchange: SubmitAndPollResult;
  dcr: SubmitAndPollResult;
};

/**
 * Input for UC 5.3 organization employee creation.
 */
export type OrganizationEmployeeCreationInput = {
  employeeClaims: Record<string, unknown>;
  dataType?: string;
};

/**
 * Input for UC 5.1 subject organization bootstrap.
 */
export type SubjectOrganizationBootstrapInput = {
  registrationPayload: { thid?: string } & Record<string, unknown>;
  confirmationPayload?: { thid?: string } & Record<string, unknown>;
  pollOptions?: PollOptions;
};

/**
 * Result for UC 5.1 subject organization bootstrap.
 */
export type SubjectOrganizationBootstrapResult = {
  registration: SubmitAndPollResult;
  confirmation?: SubmitAndPollResult;
};

export type IndividualOrganizationBootstrapSimpleInput = {
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  alternateName: string;
  controllerEmail?: string;
  controllerTelephone?: string;
  controllerRole?: string; // default org.hl7.v3.RoleCode|RESPRSN
  timeoutSeconds?: number;
  intervalSeconds?: number;
  additionalClaims?: Record<string, unknown>;
};

export type IndividualOrganizationBootstrapSimpleResult = {
  registration: SubmitAndPollResult;
  offerId: string;
  confirmation: SubmitAndPollResult;
};

export type IndividualOrganizationStartSimpleResult = {
  registration: SubmitAndPollResult;
  offerId: string;
  offerPreview: OfferPreview;
};

export type IndividualOrganizationConfirmOrderSimpleInput = {
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  offerId: string;
  timeoutSeconds?: number;
  intervalSeconds?: number;
};

/**
 * Input for UC 5.5 IPS/FHIR import and index update.
 */
export type IpsOrFhirImportInput = {
  compositionPayload: { thid?: string } & Record<string, unknown>;
  format?: 'api' | 'r4';
  pollOptions?: PollOptions;
};

export type ConsentActorTargetInput = {
  /** Canonical actor identifier (did:web:..., urn:taxid:..., urn:tel:..., email, etc.). */
  identifier?: string;
  /** Preferred URL/domain alias resolved to did:web:<host>. */
  url?: string;
  /** Legacy alias kept for backwards compatibility. */
  didWeb?: string;
  /** Legacy alias kept for backwards compatibility. */
  organizationUrl?: string;
  organizationTaxId?: string;
  email?: string;
  phone?: string;
};

/**
 * Input for UC 5.6 consent submission from minimal frontend fields.
 */
export type GrantProfessionalAccessSimpleInput = {
  subjectDid?: string;
  subjectPhone?: string;
  subjectGivenName?: string;
  actor: ConsentActorTargetInput;
  actorRole: string;
  purpose: string;
  actions: string[];
  consentIdentifier?: string;
  consentDate?: string;
  decision?: 'permit' | 'deny';
  attachmentContentType?: string;
  attachmentBase64?: string;
  dataType?: string;
  pollOptions?: PollOptions;
};

export type GrantProfessionalAccessSimpleResult = {
  thid: string;
  consent: SubmitAndPollResult;
  subjectIdentifier: string;
  actorIdentifier: string;
  consentClaims: Record<string, unknown>;
  claimsCid?: string;
};

/**
 * Input for UC 5.7 digital twin generation from subject data.
 */
export type DigitalTwinGenerationInput = {
  compositionPayload: { thid?: string } & Record<string, unknown>;
  format?: 'api' | 'r4';
  pollOptions?: PollOptions;
};

export type PhoneReminderWindowInput = {
  offsetMinutes: number;
  remindAt: string;
};

export type CreatePhoneReminderTasksInput = {
  windows: PhoneReminderWindowInput[];
  locale?: string;
  /**
   * Optional snapshot/fallback phone for the subject.
   *
   * Canonical resolution should come from `subjectRef` (UUID/resource reference)
   * in backend task execution. Provide this only when you explicitly want to
   * persist a denormalized value for audit/fallback or to avoid lookup at runtime.
   */
  notificationPhone?: string;
  /**
   * Optional snapshot/fallback phone for the controller/owner.
   *
   * Canonical resolution should come from `ownerRef` (e.g. did:web / RelatedPerson ref)
   * in backend task execution. Provide this only for audit/fallback/optimization.
   */
  controllerPhone?: string;
  subjectRef: string;
  ownerRef: string;
  focusRef: string;
  subjectDisplay?: string;
  /**
   * Context summary for what this reminder is based on
   * (appointment, medication schedule, or another domain event).
   * Mapped to Task claim `based-on-display`.
   */
  reminderSummary?: string;
  /**
   * @deprecated Use `reminderSummary` instead.
   */
  appointmentSummary?: string;
  callSid?: string;
  dataType?: string;
  /**
   * Short task title (e.g. "Reminder phone call", "Medication reminder").
   * Mapped to Task resource `description`.
   */
  description?: string;
  maxAttempts?: number;
};

export type MedicationIntakeTimeInput = {
  /** HH:mm (24h), example: 08:00 */
  hhmm: string;
};

/** Canonical flat claim shape: `<ResourceType>.<concrete-param>` */
export type FlatInteroperableClaims = Record<`${string}.${string}`, unknown>;

export type MedicationOverlapCheckInput = {
  subjectRef: string;
  /** Canonical flat claims (FHIR-style, lowercase/hyphen params). */
  claims?: FlatInteroperableClaims;
  startDate: string;
  endDate?: string;
  intakeTimes: MedicationIntakeTimeInput[];
  repeatIntervalHhmm?: string;
  maxDailyIntakes?: number;
  /**
   * Optional tolerance in minutes for "same-time" collision.
   * If omitted, backend default policy applies.
   */
  overlapToleranceMinutes?: number;
};

export type MedicationRegistrationInput = {
  locale?: string;
  subjectRef: string;
  ownerRef: string;
  notificationPhone?: string;
  controllerPhone?: string;
  /** Canonical flat claims (FHIR-style, lowercase/hyphen params). */
  claims?: FlatInteroperableClaims;
  medicationDescription?: string;
  doseValue?: string;
  doseUnitOrFormCode?: string;
  intakeTimes?: MedicationIntakeTimeInput[];
  repeatIntervalHhmm?: string;
  maxDailyIntakes?: number;
  startDate?: string;
  durationDays?: number;
  endDate?: string;
  maxAttempts?: number;
};

export type ClientOptions = {
  baseUrl: string;
  bearerToken?: string;
  defaultHeaders?: Record<string, string>;
  wallet?: WalletProvider;
  /** Optional default tenant context so calls can omit ctx repeatedly. */
  ctx?: RouteContext;
};

/**
 * Options for identity-exchange.v1 backend PKCE + token exchange flow.
 * Equivalent to Python connector_sdk `authenticate_backend_pkce_and_exchange`.
 */
export type BackendPkceAuthOptions = {
  /** Route context providing tenantId, jurisdiction, sector. */
  ctx: RouteContext;
  /** API key issued by ICA for this service (used as client_id in DCR). */
  apiKey: string;
  /**
   * Service public JWK bound to the API key via DCR.
   * Optional when the client was constructed with a wallet provider.
   */
  controllerPublicJwk?: PublicJwk | Record<string, unknown>;
  /**
   * Optional wallet resolution context when it differs from `ctx`.
   * Defaults to the route context values.
   */
  walletContext?: WalletContext;
  /** Requested scopes for the SMART bearer token. */
  scopes: string[];
  /** Cache key for the resulting bearer token. Defaults to `pkce:<apiKey prefix>`. */
  tokenCacheKey?: string;
  /** @deprecated Use `tokenCacheKey`. */
  endpointId?: string;
  /** PKCE code verifier. Auto-generated with randomUUID if not provided. */
  codeVerifier?: string;
  /** Polling options for each async step. */
  pollOptions?: PollOptions;
};

export type BackendPkceAuthResult = {
  /** `fetched`: new token obtained. `cached`: valid token already in cache. `failed`: flow error. */
  status: 'fetched' | 'cached' | 'failed';
  tokenCacheKey: string;
  /** @deprecated Use `tokenCacheKey`. */
  endpointId: string;
  accessToken: string;
  tokenType: string;
  scopes: string[];
  /** Present on failure: name of the step that failed (`_dcr`, `_code`, `_token`, `_exchange`). */
  step?: string;
};

export type BackendSmartAuthOptions = {
  clientId: string;
  scopes: string[];
  tokenCacheKey?: string;
  /** @deprecated Use `tokenCacheKey`. */
  endpointId?: string;
  tokenUrl?: string;
  tokenPath?: string;
  audience?: string;
  assertionTtlSeconds?: number;
  additionalTokenFields?: Record<string, string>;
  publicJwk?: PublicJwk | Record<string, unknown>;
  walletContext?: WalletContext;
};

export type BackendSmartAuthResult = {
  status: 'fetched' | 'cached' | 'failed';
  profile: 'smart-backend.v1';
  tokenCacheKey: string;
  /** @deprecated Use `tokenCacheKey`. */
  endpointId: string;
  accessToken?: string;
  tokenType?: string;
  scopes?: string[];
  expiresAt?: string;
  statusCode?: number;
  response?: unknown;
};

export type SmartTokenExchangeInput = {
  tokenCacheKey: string;
  /** @deprecated Use `tokenCacheKey`. */
  endpointId?: string;
  scopes: string[];
  exchangePayload: Record<string, unknown>;
  path?: string;
};

export type SmartTokenRequestSimpleInput = {
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  idToken: string;
  scopes: string[];
  tokenCacheKey?: string;
  /** @deprecated Use `tokenCacheKey`. */
  endpointId?: string;
  timeoutSeconds?: number;
  intervalSeconds?: number;
  additionalClaims?: Record<string, unknown>;
};

export type SmartTokenExchangeResult = {
  status: 'fetched' | 'cached' | 'failed';
  accessToken?: string;
  tokenType?: string;
  scopes?: string[];
  statusCode?: number;
  response?: unknown;
};
