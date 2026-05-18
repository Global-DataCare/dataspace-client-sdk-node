# Developer Use-Case Cookbook (Node SDK)

This guide provides exact method calls for real integration flows.

Normative scope/resource placement matrix:
- [../../03-integrator-internal/platform/DATA_PLANES_SCOPE_MATRIX.md](../../03-integrator-internal/platform/DATA_PLANES_SCOPE_MATRIX.md)

SDK: `dataspace-client-sdk-node` (`DataspaceNodeClient`)

## Base Setup

```ts
import { DataspaceNodeClient } from 'dataspace-client-sdk-node';
import { ClaimsPersonSchemaorg } from 'gdc-common-utils-ts/constants/schemaorg';

const client = new DataspaceNodeClient({
  baseUrl: process.env.GW_BASE_URL!,
  bearerToken: process.env.GW_BEARER_TOKEN, // controller/professional token depending on step
});

const ctx = {
  tenantId: 'VATES-B00112233',
  jurisdiction: 'ES',
  sector: 'health-care',
};
```

## UC5.1 Subject bootstrap (individual indexing service provider tenant)

Terminology note: `subject` names in methods/claims refer to the member (person/patient) orchestrated by the tenant's personal indexing service provider flow.

Method: `bootstrapSubjectOrganizationIndex(ctx, input)`
Test: [tests/client.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/client.test.mjs), [tests/uc5-subject-data.flow.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/uc5-subject-data.flow.test.mjs)

```ts
const result = await client.bootstrapSubjectOrganizationIndex(ctx, {
  registrationPayload: {
    body: {
      data: [{ type: 'Individual-registration-form-v1.0', meta: { claims: { '@context': 'org.schema' } } }],
    },
  },
  confirmationPayload: {
    body: {
      data: [{ type: 'Individual-order-request-v1.0', meta: { claims: { 'Order.acceptedOffer.identifier': 'urn:offer:123' } } }],
    },
  },
});
```

## UC5.2 Legal organization activation in GW (from ICA proof)

Method: `activateOrganizationInGatewayFromIcaProof(hostCtx, input)`
Test: [tests/client.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/client.test.mjs), [tests/uc5-org-onboarding.flow.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/uc5-org-onboarding.flow.test.mjs)

```ts
const activation = await client.activateOrganizationInGatewayFromIcaProof(
  { jurisdiction: 'ES', sector: 'health-care' },
  {
    vpToken: process.env.ICA_VP_TOKEN!,
    regulatoryEvidence: { sanitaryRegister: 'REG-123' },
  },
);
```

## UC5.3 Create employee / professional license

Method: `createOrganizationEmployee(ctx, input)`
Test: [tests/client.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/client.test.mjs), [tests/uc5-org-onboarding.flow.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/uc5-org-onboarding.flow.test.mjs)

```ts
await client.createOrganizationEmployee(ctx, {
  employeeClaims: {
    '@context': 'org.schema',
    [ClaimsPersonSchemaorg.email]: 'doctor@example.com',
    [ClaimsPersonSchemaorg.hasOccupation]: 'ISCO-08|2211',
  },
});
```

## UC5.4 Activate employee device

Method: `activateEmployeeDeviceWithActivationCode(ctx, input)`
Test: [tests/client.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/client.test.mjs), [tests/uc5-org-onboarding.flow.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/uc5-org-onboarding.flow.test.mjs)

```ts
const device = await client.activateEmployeeDeviceWithActivationCode(ctx, {
  activationCode: 'ACT-123456',
  idToken: process.env.USER_ID_TOKEN!,
  dcrPayload: {
    application_type: 'web',
    token_endpoint_auth_method: 'private_key_jwt',
    jwks: { keys: [] },
  },
});
```

## UC5.5 Import IPS/FHIR and update index

Method: `importIpsOrFhirAndUpdateIndex(ctx, input)`
Test: [tests/client.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/client.test.mjs), [tests/uc5-subject-data.flow.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/uc5-subject-data.flow.test.mjs)

```ts
await client.importIpsOrFhirAndUpdateIndex(ctx, {
  format: 'r4',
  compositionPayload: {
    body: {
      data: [{ type: 'Composition-import-request-v1.0', meta: { claims: { subject: 'did:web:subject.example.com' } } }],
    },
  },
});
```

## UC5.6 Consent then SMART token (real decoupled flow)

Step 1 method: `grantProfessionalAccessSimple(ctx, input)`  
Step 2 method: `requestSmartToken(input)`
Test: [tests/client.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/client.test.mjs), [tests/uc5-subject-data.flow.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/uc5-subject-data.flow.test.mjs)

Domain note: the protected context is modeled as organization (including personal organizations with controller + subject/person/patient members).

Scope namespace note:
- Organization administration (non-FHIR): `org.schema/Organization.<cruds>`, `org.schema/Person.<cruds>`
- Subject/personal-organization data (FHIR): `organization/<ResourceType>.<cruds|rs>` with optional `?subject=<did:web:...>`

```ts
const consent = await client.grantProfessionalAccessSimple(ctx, {
  subjectDid: 'did:web:subject.example.com',
  subjectGivenName: 'Ana',
  actor: { identifier: 'did:web:hospital.example.com' },
  actorRole: 'Practitioner',
  purpose: 'TREAT',
  actions: ['organization/Composition.rs'],
});

const token = await client.requestSmartToken({
  endpointId: 'professional-app',
  scopes: ['organization/Composition.rs'],
  exchangePayload: { grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange' },
  path: '/token',
});
```

## UC5.7 Generate digital twin

Method: `generateDigitalTwinFromSubjectData(ctx, input)`
Test: [tests/client.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/client.test.mjs), [tests/uc5-subject-data.flow.test.mjs]($HOME/GITS/gdc-workspace/dataspace-client-sdk-node/tests/uc5-subject-data.flow.test.mjs)

```ts
await client.generateDigitalTwinFromSubjectData(ctx, {
  format: 'r4',
  compositionPayload: {
    body: {
      data: [{ type: 'DigitalTwin-composition-request-v1.0', meta: { claims: { source: 'subject-index' } } }],
    },
  },
});
```

## Additional consent actor patterns

Important: canonical claim key is `Consent.actor-identifier`.
`grantProfessionalAccessSimple` accepts convenience aliases and resolves them into that canonical identifier.

Action semantics note:
- Avoid generic actions like `access` or `read`.
- Use canonical operation strings aligned with protected resource contracts/scopes (for example `organization/Composition.rs`, `organization/Appointment.cruds`).

### A) Actor by canonical `identifier` + role (recommended)

```ts
await client.grantProfessionalAccessSimple(ctx, {
  subjectDid: 'did:web:subject.example.com',
  actor: { identifier: 'did:web:org.example.com' },
  actorRole: 'Practitioner',
  purpose: 'TREAT',
  actions: ['organization/Composition.rs'],
});
```

### B) Actor by organization URL/domain or NIF + role

```ts
await client.grantProfessionalAccessSimple(ctx, {
  subjectDid: 'did:web:subject.example.com',
  actor: { url: 'org.example.com' }, // accepts bare domain or full URL; resolves to did:web:org.example.com
  actorRole: 'Practitioner',
  purpose: 'CARE',
  actions: ['organization/Appointment.cruds'],
});
```

```ts
await client.grantProfessionalAccessSimple(ctx, {
  subjectDid: 'did:web:subject.example.com',
  actor: { organizationTaxId: 'B12345678' }, // maps to urn:taxid:B12345678
  actorRole: 'Practitioner',
  purpose: 'CARE',
  actions: ['organization/RelatedPerson.cruds'],
});
```

### C) Actor by email + role (portal-first)

```ts
await client.grantProfessionalAccessSimple(ctx, {
  subjectDid: 'did:web:subject.example.com',
  actor: { email: 'doctor@example.com' },
  actorRole: 'Practitioner',
  purpose: 'TREAT',
  actions: ['organization/Composition.rs'],
});
```

Phone-based actor identifiers are supported for compatibility flows, but email/DID are the primary portal channels.

### D) Jurisdiction + role (explicit claims)

`grantProfessionalAccessSimple` does not currently expose a `jurisdiction` field.  
For jurisdiction-based actor identifiers, submit explicit claims:

```ts
await client.submitAndPoll(
  client.individualConsentR4BatchPath(ctx),
  client.individualConsentR4PollPath(ctx),
  {
    thid: 'consent-jurisdiction-001',
    body: {
      data: [{
        type: 'Consent-grant-request-v1.0',
        meta: {
          claims: {
            '@context': 'org.hl7.fhir.api',
            'Consent.decision': 'permit',
            'Consent.subject': 'did:web:subject.example.com',
            'Consent.actor-identifier': 'urn:jurisdiction:ES',
            'Consent.actor-role': 'Practitioner',
            'Consent.purpose': 'TREAT',
            'Consent.action': 'LOINC|48765-2,LOINC|10160-0',
          },
        },
      }],
    },
  },
);
```

## Traceability contract (FHIR + claims)

- FHIR resource identity: `resource.id` remains UUID.
- FHIR version traceability: `resource.meta.versionId` stores CID of canonical FHIR resource version.
- Claims traceability: `grantProfessionalAccessSimple(...)` now emits `resource.meta.claims["@id"]` as CID of canonical claims (excluding `@context`, `@type`, `@id`).
- Claim payloads should be authored under `resource.meta.claims`; `meta.claims` is kept only as deprecated compatibility during migration.
