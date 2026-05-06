# CONTROLLER_FLOW_STEP_BY_STEP

Strict step-by-step flow for organization onboarding by controller, then controller runtime activation, then employee provisioning.

## Security model (read first)

Security planes:
- Transport plane (deployment-specific): backend ↔ gateway channel protection (optional bearer, mTLS, API gateway policy).
- Identity/business plane (functional flow): controller/member credentials and tokens (`vp_token`, `idToken`, DCR, SMART).
- Operator/hosting plane: infrastructure tenancy and node-operator lifecycle.

Do not mix these planes in implementation or documentation.

Secure communication intent:
- controller/member auth tokens are identity-plane credentials
- in addition, backend P2P messages can be protected with embedded JWS/JWE via backend wallet
- use `plain` / `strict` / `auto-detect` communication policy per deployment

- `initialOrder` = first order linked to onboarding `offerId` from `_activate`.
- `licenseOrder` = later order(s) for additional employee licenses.
- `initialOrder` is authorized by onboarding proof (`vp_token`) + gateway onboarding policy.
- `licenseOrder` is a runtime business operation and must use controller runtime auth (DCR + SMART token).
- DCR for controller and DCR for employee are different operations and different identities.

Current GW behavior for `Employee/_batch` (important):
- if employee license pool exists and has `available` seats: employee is created (`201`) and one seat is consumed
- if employee license pool exists but has no `available` seats: response is `Employee-license-offer-v1.0` (no employee created)
- if employee license pool does not exist: employee is created without license gating (legacy/non-strict mode)

## 0) Runtime context (not all from `.env`)

```ts
// optional transport security context (deployment-specific, not user identity)
const transportSecurity = {
  gwBearerToken: process.env.GW_BEARER_TOKEN, // optional
};
```

```ts
// profile-level runtime context for this authenticated role in this organization
const profileContext = {
  baseUrl: process.env.BASE_URL!,
  jurisdiction: process.env.JURISDICTION!, // REQUIRED
  sector: process.env.SECTOR || 'health-care',
  hostRegistrySector: process.env.HOST_REGISTRY_SECTOR || 'test-network',
  gwDidWeb: process.env.GW_DID_WEB!,
  credentialExpSeconds: Number(process.env.CREDENTIAL_EXP_SECONDS || 300),
};

// user/session context (from authenticated portal user + selected tenant/org)
const sessionContext = {
  tenantId: currentSession.tenantId,
  controllerDidWeb: currentSession.controller.didWeb,
  controllerSignKid: currentSession.controller.signKid, // RFC7638 thumbprint / key id
  controllerIdToken: currentSession.idToken,
  controllerPublicJwk: currentSession.controller.publicJwk,
  controllerEmail: currentSession.controller.email,
  newMemberEmailToInvite: uiFormNewMember.email,
  newMemberRoleCode: uiFormNewMember.hasOccupation || 'ISCO-08|2211',
};

// credentials issued previously by ICA
const onboardingProof = {
  organizationVcJwt: currentSession.ica.organizationVcJwt,
  legalRepresentativeVcJwt: currentSession.ica.legalRepresentativeVcJwt, // optional by policy
};
```

## 1) Build and externally sign `vp_token` (controller identity proof)

```ts
import {
  DataspaceNodeClient,
  createVP, addVC, prepareForSignature, prepareBytesForSignature, buildVpTokenCompact,
  buildEpochWindow, generateUuidLike,
} from 'dataspace-client-sdk-node';
import { ClaimsPersonSchemaorg } from 'gdc-common-utils-ts/constants/schemaorg';

const { iat, exp } = buildEpochWindow(profileContext.credentialExpSeconds);
const header = {
  alg: 'ES256',
  typ: 'JWT',
  kid: `${sessionContext.controllerDidWeb}#${sessionContext.controllerSignKid}`,
};
const uniquePresentationNonce = generateUuidLike();
const vp = createVP({
  iss: sessionContext.controllerDidWeb,
  sub: sessionContext.controllerDidWeb,
  aud: profileContext.gwDidWeb,
  iat,
  exp,
  nonce: uniquePresentationNonce,
});

addVC(vp, onboardingProof.organizationVcJwt);
if (onboardingProof.legalRepresentativeVcJwt) addVC(vp, onboardingProof.legalRepresentativeVcJwt);

const { encodedHeader, encodedPayload } = prepareForSignature(header, vp);
const bytesToSign = prepareBytesForSignature(header, vp);
const signatureBase64Url = await externalSigner(bytesToSign); // wallet/HSM
const vpToken = buildVpTokenCompact(encodedHeader, encodedPayload, signatureBase64Url);
```

Signing responsibility (integrator):
- SDK provides `prepareForSignature(...)` and `prepareBytesForSignature(...)` to produce the JWT signing input.
- Signing input is exactly: `base64url(header) + "." + base64url(payload)`.
- The integrator signs that input with the current user's key material (wallet, secure storage, KMS, HSM, etc.).
- SDK does not require local custody of private keys.

## 2) Activate organization in GW (`_activate`)

```ts
const client = new DataspaceNodeClient({
  baseUrl: profileContext.baseUrl,
  ...(transportSecurity.gwBearerToken ? { bearerToken: transportSecurity.gwBearerToken } : {}),
  ctx: { tenantId: sessionContext.tenantId, jurisdiction: profileContext.jurisdiction, sector: profileContext.sector },
});

const activation = await client.activateOrganizationInGatewayFromIcaProof(
  { jurisdiction: profileContext.jurisdiction, sector: profileContext.hostRegistrySector },
  {
    vpToken,
    organizationVc: onboardingProof.organizationVcJwt,
    legalRepresentativeVc: onboardingProof.legalRepresentativeVcJwt,
    numberOfMembers: 2,
  },
);
```

Jurisdiction is mandatory in all flows:
- Professional: the organization/tenant is registered in one jurisdiction (country) and routes/scopes resolve against it.
- Personal: user selects jurisdiction first, then service providers are filtered for that jurisdiction.
- Integrator rule: reject onboarding/session setup when `jurisdiction` is missing.

Auth model note:
- user auth tokens (`idToken`, SMART access token) belong to the identity/business plane (authenticated user session).
- `transportSecurity.gwBearerToken` belongs to the transport plane only and is optional by deployment.
- `transportSecurity.gwBearerToken` is not an ICA exchange token and not a controller API key.

## 3) Read Offer and show explicit acceptance UI

```ts
const offerId = client.getOfferIdFromResponse(activation);
const offer = client.getOfferInfoFromResponse(activation);
if (!offerId) throw new Error('Offer id missing in activation response');
// show offer in UI and wait for user acceptance
```

## 4) Send Order (always, even if amount is 0)

```ts
// This is the INITIAL ORDER (onboarding order).
const initialOrder = await client.confirmLegalOrganizationOrderSimple({ offerId });
```

## 5) Controller runtime activation (DCR) to operate organization's APIs

This is separate from onboarding proof. It creates controller device runtime identity.

```ts
const controllerActivationCode =
  client.getActivationCodeFromResponse(initialOrder) ||
  client.getActivationCodeFromResponse(activation);
if (!controllerActivationCode) throw new Error('Controller activation code not found');

const controllerDevice = await client.activateEmployeeDeviceWithActivationCodeSimple({
  tenantId: sessionContext.tenantId,
  jurisdiction: profileContext.jurisdiction,
  sector: profileContext.sector,
  activationCode: controllerActivationCode,
  idToken: sessionContext.controllerIdToken,
  dcrPayload: {
    application_type: 'web',
    token_endpoint_auth_method: 'private_key_jwt',
    jwks: { keys: [sessionContext.controllerPublicJwk] },
  },
});
```

## 6) Controller identity token vs entity token (separate concerns)

- Identity token request endpoint is tenant-scoped auth route:
  `/host/cds-{jurisdiction}/v1/{sector}/{tenantId}/identity/auth/_token`
- The returned access token is then used to call entity/business endpoints like:
  `/{tenantId}/cds-{jurisdiction}/v1/{sector}/entity/org.schema/Employee/_batch`

Use explicit cache keys by intent to avoid confusion:
- `controller_identity_token:*` for auth/token operations
- `controller_entity_token:*` for entity/business operations

```ts
const controllerSmart = await client.requestSmartTokenSimple({
  tenantId: sessionContext.tenantId,
  jurisdiction: profileContext.jurisdiction,
  sector: profileContext.sector,
  idToken: sessionContext.controllerIdToken,
  targetEndpoint: client.getEndpointId(
    { section: 'organization', format: 'org.hl7.fhir.r4', resourceType: 'Person', action: '_batch' },
    sessionContext.controllerDidWeb,
  ),
  scopes: [
    'organization/Person.cruds',
    'organization/Organization.cruds',
    'organization/Consent.cruds',
  ],
});
```

## 7) Create newMember/practitioner employee (runtime, uses controller token)

```ts
const employee = await client.createOrganizationEmployee(
  { tenantId: sessionContext.tenantId, jurisdiction: profileContext.jurisdiction, sector: profileContext.sector },
  {
    employeeClaims: {
      '@context': 'org.schema',
      [ClaimsPersonSchemaorg.email]: sessionContext.newMemberEmailToInvite,
      [ClaimsPersonSchemaorg.hasOccupation]: sessionContext.newMemberRoleCode,
    },
  },
);
```

## 8) Extract newMember activation code and hand off to practitioner flow

```ts
const newMemberActivationCode = client.getActivationCodeFromResponse(employee);
if (!newMemberActivationCode) throw new Error('newMember activation code not found');
```

## 9) If no license is available: create `licenseOrder` (separate from `initialOrder`)

When employee creation returns license-offer/gating instead of activation code:

1. Extract `licenseOfferId` from employee response (same `getOfferIdFromResponse(...)` helper).
2. Show offer in UI and request explicit user acceptance.
3. Submit a new order as `licenseOrder`.
4. Retry employee creation after successful `licenseOrder`.

```ts
const licenseOfferId = client.getOfferIdFromResponse(employee);
if (!licenseOfferId) throw new Error('License offer id missing');

// This is a LICENSE ORDER (runtime order), not the onboarding order.
const licenseOrder = await client.confirmLegalOrganizationOrderSimple({
  offerId: licenseOfferId,
});
```

Authentication rules for this step:
- never reuse onboarding `vp_token` for runtime ordering
- use controller runtime identity (DCR already completed)
- use controller SMART token for protected runtime routes

Route intent:
- controller's onboarding activation and onboarding order for the legal organization: `/host/.../registry/...`
- controller's identity DCR/token flows are tenant-scoped for the legal organization but exposed as `/host/.../{tenantId}/identity/auth/...`
- employee business operations use tenant-scoped data routes: `/{tenantId}/.../entity/...` (or corresponding section)

Complete path examples:
(using `test-network` but `test` can be used for local development)
- activate organization:
  `/host/cds-ES/v1/test-network/registry/org.schema/Organization/_activate`
- poll activate:
  `/host/cds-ES/v1/test-network/registry/org.schema/Organization/_activate-response`
- initial onboarding order:
  `/host/cds-ES/v1/test-network/registry/org.schema/Order/_batch`
- poll onboarding order:
  `/host/cds-ES/v1/test-network/registry/org.schema/Order/_batch-response`
- controller/employee identity exchange (activation code -> initial token):
  `/host/cds-ES/v1/health-care/{tenantId}/identity/auth/_exchange`
- controller's DCR (consumes the initial access token with scope 'dcr' as per OpenID DCR):
  `/host/cds-ES/v1/health-care/{tenantId}/identity/auth/_dcr`
- controller's smart token for entity management:
  `/host/cds-ES/v1/health-care/{tenantId}/identity/auth/_token`
- employee creation:
  `/{tenantId}/cds-ES/v1/health-care/entity/org.schema/Employee/_batch`

Continue with:
- `PRACTITIONER_FLOW_STEP_BY_STEP.md`

Shared wallet derivation profile:
- `BACKEND_NODE_INTEGRATION.md` ("Deterministic Wallet Profile")
