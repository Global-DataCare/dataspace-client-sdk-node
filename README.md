# dataspace-client-sdk-node-ts (skeleton)

Node.js SDK skeleton to consume documented GW/UNID async DIDComm plain endpoints.

Status: bootstrap scaffold for integration services.

## Scope
- Generic async batch client (`_batch` + `_batch-response`) and JSON POST helper.
- Route builders that cover Swagger v1 route families:
  - `host/registry`: `Organization _batch/_activate`, `Order`,
  - `entity`: `Employee`,
  - `identity`: `Device/_dcr`, `Token/_exchange`, `License/_issue`, SMART token, Firebase custom token,
  - `individual`: `Organization`, `Order`, `Person (legacy)`, `Consent`, `Composition`, `Communication`, `RelatedPerson`, `Observation`, `Task`,
  - `digitaltwin`: `Composition` (`org.hl7.fhir.api` and `org.hl7.fhir.r4`),
  - debug UHC task endpoints: `_call-start`, `_logs`.

## Install (local workspace)

```bash
cd tools/dataspace-client-sdk-node-ts
npm install
npm run type-check
npm run build
```

## Quick usage

```ts
import { DataspaceNodeClient, createDidcommPlainMessage } from './dist/index.js';

const client = new DataspaceNodeClient({
  baseUrl: 'http://localhost:3000',
  bearerToken: 'demo-token',
});

const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };

const payload = createDidcommPlainMessage({
  iss: 'adult1@example.com',
  aud: 'did:web:api.acme.org',
  body: {
    data: [
      {
        type: 'Family-registration-form-v1.0',
        meta: {
          claims: {
            '@context': 'org.schema',
            '@type': 'template',
            'org.schema.Organization.address.addressCountry': 'ES',
            'org.schema.Organization.identifier.additionalType': 'UUID',
            'org.schema.Organization.identifier.value': 'f0d4b66d-7e28-4fa2-91b7-7041e57f4f90',
            'org.schema.Person.email': 'adult1@example.com',
            'org.schema.Service.category': 'health-care',
            'org.schema.Service.identifier': 'did:web:api-provider.example.com',
            'org.schema.Service.serviceType': 'http://terminology.hl7.org/CodeSystem/v3-ActReason|SRVC',
            'org.schema.Service.termsOfService': 'https://provider.example.com/terms',
          },
        },
      },
    ],
  },
});

const submitPath = client.individualFamilyOrganizationBatchPath(ctx);
const pollPath = client.individualFamilyOrganizationPollPath(ctx);
const result = await client.submitAndPoll(submitPath, pollPath, payload);
console.log(result.poll.status, result.poll.body);
```

## Swagger parity strategy
- For any v1 route exposed in Swagger, use:
  - `client.v1Path(ctx, section, format, resourceType, action)` for tenant routes.
  - `client.hostRegistryPath(ctx, resourceType, action)` for host registry routes.
- Then call one of:
  - `submitBatch(path, didcommPayload)` for DIDComm plain submit routes,
  - `pollBatchResponse(path, { thid })` / `pollUntilComplete(...)`,
  - `postJson(path, payload)` for non-batch JSON routes.

This avoids hardcoding curl scripts per endpoint.

## Notes for telephony tests
- Keep GW/UHC unit/integration tests direct (service/router level).
- Use this SDK for consumer-style E2E tests and external Node.js service integrations.
- If individual onboarding moves to a separate service, telephony tests should consume that service and only use GW/UHC for reminders/calls.

## DataConversion / Excel note
- Excel attachment upload/preconversion ingestion (as used in `dataspace-client-sdk-py`) is not implemented in this SDK skeleton yet.
- Current gateway-side coverage here focuses on documented GW/UNID HTTP routes.
- Next step: add multipart/file adapters that call DataConversion API endpoints and then chain ingestion into GW `digitaltwin`/`individual` flows.

## Next planned additions
- Secure envelope mode (`application/x-www-form-urlencoded`, request/response JWE).
- Typed payload builders per flow (`family`, `relatedPerson`, `observation`, `task`).
- Claims mappers (`ClaimName` <-> SQL internal name with `_`).
- Retry/backoff + richer error mapping.
