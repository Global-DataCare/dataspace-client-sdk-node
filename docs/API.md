# dataspace-client-sdk-node — API Reference

All methods belong to the `DataspaceNodeClient` class unless stated otherwise.

## Contents

- [Setup](#setup)
- [Types](#types)
- [Constructor](#constructor)
- [Path helpers](#path-helpers)
  - [Generic builders](#generic-builders)
  - [Host registry (controller-level)](#host-registry-controller-level)
  - [Individual — Family Organization](#individual--family-organization)
  - [Individual — FHIR resources](#individual--fhir-resources)
  - [Entity — Employee](#entity--employee)
  - [Identity / Auth](#identity--auth)
  - [DataConversion upload](#dataconversion-upload)
  - [Task debug](#task-debug)
- [Auth methods](#auth-methods)
  - [authenticateBackendPkceAndExchange](#authenticatebackendpkceandexchange)
  - [authenticateBackendSmartStandard](#authenticatebackendsmartstandard)
  - [getCachedBearerToken](#getcachedbearertoken)
- [Transport methods](#transport-methods)
  - [submitBatch](#submitbatch)
  - [submitBatchEncrypted](#submitbatchencrypted)
  - [postJson](#postjson)
  - [postFormData](#postformdata)
  - [uploadConversionFile](#uploadconversionfile)
  - [pollBatchResponse](#pollbatchresponse)
  - [submitAndPoll](#submitandpoll)
  - [pollUntilComplete](#polluntilcomplete)
- [High-level helpers](#high-level-helpers)
  - [createPhoneReminderTasks](#createphoneremiindertasks)
  - [searchFamilyOrganization](#searchfamilyorganization)
- [Standalone exports](#standalone-exports)

---

## Setup

```bash
npm install
npm run build
```

```ts
import { DataspaceNodeClient, createDidcommPlainMessage } from 'dataspace-client-sdk-node';
```

---

## Types

### `RouteContext`

Tenant-scoped routing context required by most path helpers and high-level methods.

```ts
type RouteContext = {
  tenantId: string;    // e.g. 'acme'
  jurisdiction: string; // ISO-3166 alpha-2, e.g. 'ES'
  sector: string;       // e.g. 'health-care', 'animal-care'
};
```

### `HostRouteContext`

Used for host/controller-level registry paths (no `tenantId`).

```ts
type HostRouteContext = {
  jurisdiction: string;
  sector: string;
};
```

### `SubmitResponse`

```ts
type SubmitResponse = {
  status: number;
  location?: string; // async poll URL from Location header
  body: unknown;
};
```

### `PollResult`

```ts
type PollResult = {
  status: number;
  body: unknown;
  attempts: number;
};
```

### `SubmitAndPollResult`

```ts
type SubmitAndPollResult = {
  submit: SubmitResponse;
  poll: PollResult;
};
```

### `PollOptions`

```ts
type PollOptions = {
  timeoutMs?: number;  // default 20000
  intervalMs?: number; // default 1000
};
```

### `FamilyRegistrationStatus`

```ts
type FamilyRegistrationStatus = 'new_created' | 'resume_required' | 'already_exists' | 'not_found';
```

### `FamilyOrganizationSummary`

```ts
type FamilyOrganizationSummary = {
  organizationId: string;
  status: FamilyRegistrationStatus;
  controllerPhone?: string;
  nickname?: string;
  notificationPhone?: string;
  sector?: string;
  jurisdiction?: string;
};
```

### `CreatePhoneReminderTasksInput`

```ts
type CreatePhoneReminderTasksInput = {
  windows: Array<{ offsetMinutes: number; remindAt: string }>; // remindAt = ISO-8601
  locale?: string;
  callSid?: string;
  notificationPhone?: string; // optional legacy/fallback only
  controllerPhone?: string;   // optional legacy/fallback only
  subjectRef: string;   // e.g. 'Person/subject-uuid' or 'Person/mailto:subject@example.com'
  ownerRef: string;     // e.g. 'RelatedPerson/controller-uuid' or 'RelatedPerson/mailto:controller@example.com'
  focusRef: string;     // e.g. 'Appointment/2026-05-10T10:00:00.000Z'
  reminderSummary?: string;
  description?: string;
  maxAttempts?: number;
  dataType?: string;
};
```

---

## Constructor

```ts
new DataspaceNodeClient(options: ClientOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `baseUrl` | `string` | ✅ | Base URL of the GW/UNID API, e.g. `http://localhost:3000` |
| `bearerToken` | `string` | | Static bearer token for `Authorization` header |
| `defaultHeaders` | `Record<string, string>` | | Extra headers added to every request |
| `wallet` | `WalletProvider` | | Required only for `submitBatchEncrypted` and `authenticateBackendPkceAndExchange` with JWK provisioning |

```ts
const client = new DataspaceNodeClient({
  baseUrl: 'http://localhost:3000',
  bearerToken: 'my-api-key',
});
```

---

## Path helpers

Path helpers return URL strings. They do **not** make network requests.  
Every path has a submit path (`_batch` / `_search`) and a matching poll path (`_batch-response` / `_search-response`).

### Generic builders

#### `v1Path(ctx, section, format, resourceType, action): string`

Builds any GW v1 route. Use when no dedicated helper exists.

```
/{tenantId}/cds-{jurisdiction}/v1/{sector}/{section}/{format}/{resourceType}/{action}
```

```ts
client.v1Path(ctx, 'individual', 'org.schema', 'Organization', '_batch')
// → /acme/cds-ES/v1/health-care/individual/org.schema/Organization/_batch
```

#### `tenantIdentityPath(ctx, prefix, action): string`

Builds identity/auth routes scoped to a service prefix (`host`, `publisher`, `ica`).

```
/{prefix}/cds-{jurisdiction}/v1/{sector}/{tenantId}/identity/auth/{action}
```

#### `hostRegistryPath(ctx, resourceType, action): string`

Builds host-level registry routes (no `tenantId`).

```
/host/cds-{jurisdiction}/v1/{sector}/registry/org.schema/{resourceType}/{action}
```

---

### Host registry (controller-level)

| Method | Returns | Route |
|---|---|---|
| `hostRegistryOrganizationBatchPath(ctx)` | submit path | `/host/.../registry/org.schema/Organization/_batch` |
| `hostRegistryOrganizationPollPath(ctx)` | poll path | `.../_batch-response` |
| `hostRegistryOrganizationActivatePath(ctx)` | submit path | `.../_activate` |
| `hostRegistryOrganizationActivatePollPath(ctx)` | poll path | `.../_activate-response` |
| `hostRegistryOrderBatchPath(ctx)` | submit path | `.../Order/_batch` |
| `hostRegistryOrderPollPath(ctx)` | poll path | `.../Order/_batch-response` |

```ts
const ctx: HostRouteContext = { jurisdiction: 'ES', sector: 'health-care' };

const result = await client.submitAndPoll(
  client.hostRegistryOrganizationBatchPath(ctx),
  client.hostRegistryOrganizationPollPath(ctx),
  payload,
);
```

---

### Individual — Family Organization

| Method | Returns | Route |
|---|---|---|
| `individualFamilyOrganizationBatchPath(ctx)` | submit | `.../individual/org.schema/Organization/_batch` |
| `individualFamilyOrganizationPollPath(ctx)` | poll | `.../_batch-response` |
| `individualFamilyOrganizationSearchPath(ctx)` | submit | `.../Organization/_search` |
| `individualFamilyOrganizationSearchPollPath(ctx)` | poll | `.../Organization/_search-response` |
| `individualFamilyOrderBatchPath(ctx)` | submit | `.../org.schema/Order/_batch` |
| `individualFamilyOrderPollPath(ctx)` | poll | `.../Order/_batch-response` |

```ts
const ctx: RouteContext = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };

// Register or resume a family organization
const payload = createDidcommPlainMessage({
  iss: 'mailto:controller@example.com',
  aud: 'did:web:api.acme.org',
  body: {
    data: [{
      type: 'Family-registration-form-v1.0',
      meta: {
        claims: {
          '@context': 'org.schema',
          'org.schema.Organization.email': 'subject@example.com', // subject contact (primary)
          'org.schema.Organization.creator': 'mailto:controller@example.com', // controller (primary)
          'org.schema.Organization.owner.email': 'controller@example.com', // controller (indexed)
          'org.schema.Organization.alternateName': 'Maria',          // usualname (indexed)
          'org.schema.Service.category': 'health-care',
          'org.schema.Organization.addressCountry': 'ES',
          'org.schema.Organization.identifierValue': 'f0d4b66d-7e28-4fa2-91b7-7041e57f4f90',
          '@type': 'receipt',
        },
      },
    }],
  },
});

const result = await client.submitAndPoll(
  client.individualFamilyOrganizationBatchPath(ctx),
  client.individualFamilyOrganizationPollPath(ctx),
  payload,
);
// result.poll.body contains 'org.schema.FamilyRegistration.status': 'new_created' | 'already_exists' | 'resume_required'
```

> Prefer the high-level [`searchFamilyOrganization`](#searchfamilyorganization) instead of calling the search path manually.

---

### Individual — FHIR resources

| Method | Returns | Route |
|---|---|---|
| `individualRelatedPersonBatchPath(ctx)` | submit | `.../individual/org.hl7.fhir.api/RelatedPerson/_batch` |
| `individualRelatedPersonPollPath(ctx)` | poll | `.../_batch-response` |
| `individualObservationBatchPath(ctx)` | submit | `.../org.hl7.fhir.api/Observation/_batch` |
| `individualObservationPollPath(ctx)` | poll | `.../_batch-response` |
| `individualCommunicationBatchPath(ctx)` | submit | `.../org.hl7.fhir.r4/Communication/_batch` |
| `individualCommunicationPollPath(ctx)` | poll | `.../_batch-response` |
| `individualTaskBatchPath(ctx)` | submit | `.../org.hl7.fhir.api/Task/_batch` |
| `individualTaskPollPath(ctx)` | poll | `.../_batch-response` |
| `individualConsentR4BatchPath(ctx)` | submit | `.../org.hl7.fhir.r4/Consent/_batch` |
| `individualConsentR4PollPath(ctx)` | poll | `.../_batch-response` |
| `individualCompositionR4BatchPath(ctx)` | submit | `.../org.hl7.fhir.r4/Composition/_batch` |
| `individualCompositionR4PollPath(ctx)` | poll | `.../_batch-response` |
| `individualLegacyPersonBatchPath(ctx)` | submit | `.../org.schema/Person/_batch` (legacy) |
| `digitalTwinCompositionApiBatchPath(ctx)` | submit | `.../digitaltwin/org.hl7.fhir.api/Composition/_batch` |
| `digitalTwinCompositionApiPollPath(ctx)` | poll | `.../_batch-response` |
| `digitalTwinCompositionR4BatchPath(ctx)` | submit | `.../digitaltwin/org.hl7.fhir.r4/Composition/_batch` |
| `digitalTwinCompositionR4PollPath(ctx)` | poll | `.../_batch-response` |

```ts
// Submit a FHIR Task
const taskPayload = createDidcommPlainMessage({
  iss: ctx.tenantId,
  aud: ctx.tenantId,
  body: {
    data: [{
      type: 'Task',
      request: { method: 'POST' },
      resource: {
        resourceType: 'Task',
        id: 'task-abc',
        description: 'Medication reminder',
        meta: {
          claims: {
            status: 'scheduled',
            subject: 'Person/+34600000001',
            channel: 'phone',
            'trigger-type': 'phone-call',
            'execution-period-start': '2026-05-10T09:00:00.000Z',
          },
        },
      },
    }],
  },
});

const result = await client.submitAndPoll(
  client.individualTaskBatchPath(ctx),
  client.individualTaskPollPath(ctx),
  taskPayload,
);
```

---

### Entity — Employee

| Method | Returns | Route |
|---|---|---|
| `employeeBatchPath(ctx)` | submit | `.../entity/org.schema/Employee/_batch` |
| `employeePollPath(ctx)` | poll | `.../_batch-response` |

```ts
const result = await client.submitAndPoll(
  client.employeeBatchPath(ctx),
  client.employeePollPath(ctx),
  employeePayload,
);
```

---

### Identity / Auth

These are used internally by [`authenticateBackendPkceAndExchange`](#authenticatebackendpkceandexchange). Exposed for custom flows.

| Method | Route |
|---|---|
| `identityDeviceDcrPath(ctx)` | `host/.../identity/auth/_dcr` |
| `identityDeviceDcrPollPath(ctx)` | `.../_dcr-response` |
| `identityCodePath(ctx)` | `.../_code` |
| `identityCodePollPath(ctx)` | `.../_code-response` |
| `identitySmartTokenPath(ctx)` | `.../_token` |
| `identitySmartTokenPollPath(ctx)` | `.../_token-response` |
| `identityTokenExchangePath(ctx)` | `.../_exchange` |
| `identityTokenExchangePollPath(ctx)` | `.../_exchange-response` |
| `identityLicenseIssuePath(ctx)` | `.../_issue` |
| `identityFirebaseCustomPath(ctx)` | `.../_custom` |
| `identityFirebaseCustomPollPath(ctx)` | `.../_custom-response` |

---

### DataConversion upload

| Method | Route |
|---|---|
| `conversionUploadPath(ctx, softwareId, sourceFormat)` | `.../conversion/{softwareId}/{sourceFormat}/_upload` |
| `conversionUploadPollPath(ctx, softwareId, sourceFormat)` | `.../_upload-response` |

```ts
const path = client.conversionUploadPath(ctx, 'qvet', 'xlsx');
// → /acme/cds-ES/v1/health-care/conversion/qvet/xlsx/_upload
```

---

### Task debug

| Method | Route |
|---|---|
| `taskDebugCallStartPath(ctx, format?)` | `.../individual/{format}/Task/_call-start` |
| `taskDebugLogsPath(ctx, format?)` | `.../individual/{format}/Task/_logs` |

`format` defaults to `'org.hl7.fhir.api'`.

```ts
// Trigger a debug voice call for a scheduled task
await client.postJson(client.taskDebugCallStartPath(ctx), { thid: 'task-abc123' });

// Poll logs
const logs = await client.postJson(client.taskDebugLogsPath(ctx), { thid: 'task-abc123' });
```

---

## Auth methods

### `authenticateBackendPkceAndExchange`

Orchestrates the full identity-exchange.v1 backend auth flow:
**DCR → PKCE code → SMART token → bearer exchange**.

Tokens are cached in memory. Automatically refreshes on expiry.

```ts
const result = await client.authenticateBackendPkceAndExchange({
  ctx: { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' },
  apiKey: 'my-api-key',
  scopes: ['organization/Task.cruds', 'organization/Observation.rs'],
  // Optional: provide your own wallet for JWK signing
  // walletContext: { ... },
});

if (result.status === 'fetched' || result.status === 'cached') {
  console.log(result.accessToken); // use as Bearer
}
```

**Returns** `BackendPkceAuthResult`:

```ts
type BackendPkceAuthResult =
  | { status: 'fetched' | 'cached'; endpointId: string; accessToken: string; tokenType: string; scopes: string[] }
  | { status: 'failed'; step: '_dcr' | '_code' | '_token' | '_exchange'; endpointId: string; accessToken: ''; tokenType: 'Bearer'; scopes: string[] };
```

---

### `authenticateBackendSmartStandard`

OAuth2 `client_credentials` flow using `private_key_jwt` assertion (SMART Backend Services profile).

```ts
const result = await client.authenticateBackendSmartStandard({
  ctx: { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' },
  clientId: 'backend-service-client-id',
  scopes: ['system/Task.rs'],
  tokenUrl: 'https://auth.acme.org/token',
});

if (result.status === 'fetched' || result.status === 'cached') {
  console.log(result.accessToken);
}
```

---

### `getCachedBearerToken`

Returns the cached bearer token for an `endpointId` if valid (>30s remaining), or `undefined`.

```ts
const token = client.getCachedBearerToken('pkce:my-api-key');
```

---

## Transport methods

### `submitBundle`

POST a DIDComm bundle payload. Preferred API for FHIR/API bundle operations.

```ts
submitBundle(
  path: string,
  payload: { thid?: string } & Record<string, unknown>,
  options?: {
    mode?: 'plain' | 'strict';
    recipientEncryptionJwk?: PublicJwk;
    walletContext?: WalletContext;
  },
): Promise<SubmitResponse>
```

```ts
const { status, location } = await client.submitBundle(
  client.individualTaskBatchPath(ctx),
  payload,
  { mode: 'plain' },
);
// location header contains the poll URL
```

`submitBatch(...)` remains available as a legacy alias for compatibility.

---

### `submitBatchEncrypted`

Sign and encrypt a DIDComm payload as JWS-in-JWE, then POST it with `Content-Type: application/didcomm-encrypted+json`.

Requires a configured `WalletProvider` in the client constructor.

```ts
submitBatchEncrypted(
  path: string,
  payload: Record<string, unknown>,
  recipientEncryptionJwk: PublicJwk,
  walletContext: WalletContext,
): Promise<SubmitResponse>
```

```ts
// recipientEncryptionJwk from GW /.well-known/jwks.json where use === 'enc'
const response = await client.submitBatchEncrypted(
  client.individualFamilyOrganizationBatchPath(ctx),
  payload,
  recipientJwk,
  walletCtx,
);
```

---

### `postJson`

POST a plain JSON body (`application/json`). Use for token endpoints and API key management.

```ts
postJson(path: string, payload: unknown): Promise<SubmitResponse>
```

### `submitLegacyJson`

Alias of `postJson(...)` for explicit non-bundle JSON submits (openid/token/resource payloads).

```ts
const response = await client.postJson('/host/admin/api-keys', {
  agent: { email: 'service@example.com' },
  scope: ['organization/Task.cruds'],
});
```

---

### `postFormData`

POST a `multipart/form-data` payload. Prefer `uploadConversionFile` for file uploads.

```ts
postFormData(path: string, formData: FormData): Promise<SubmitResponse>
```

---

### `uploadConversionFile`

Upload a file to a DataConversion endpoint. Wraps `postFormData`.

```ts
uploadConversionFile(params: {
  path: string;
  fileName: string;
  fileContent: Blob | Buffer | Uint8Array | ArrayBuffer;
  fileFieldName?: string;  // default 'file'
  fields?: Record<string, string>;
}): Promise<SubmitResponse>
```

```ts
import { readFileSync } from 'node:fs';

const fileBytes = readFileSync('patients.xlsx');
const response = await client.uploadConversionFile({
  path: client.conversionUploadPath(ctx, 'qvet', 'xlsx'),
  fileName: 'patients.xlsx',
  fileContent: fileBytes,
});
```

---

### `pollBatchResponse`

Poll a `_batch-response` / `_search-response` path with a `thid`. Returns raw status + body.

```ts
pollBatchResponse(path: string, request: AsyncPollRequest): Promise<{ status: number; body: unknown }>
```

```ts
const { status, body } = await client.pollBatchResponse(
  client.individualTaskPollPath(ctx),
  { thid: 'task-abc123' },
);
```

---

### `submitAndPoll`

Combines `submitBatch` + `pollUntilComplete` in a single call. The most common transport pattern.

```ts
submitAndPoll(
  submitPath: string,
  pollPath: string,
  payload: unknown,
  options?: PollOptions,
): Promise<SubmitAndPollResult>
```

Default poll options: `timeoutMs: 20_000`, `intervalMs: 1_000`.

```ts
const result = await client.submitAndPoll(
  client.individualFamilyOrganizationBatchPath(ctx),
  client.individualFamilyOrganizationPollPath(ctx),
  payload,
  { timeoutMs: 30_000, intervalMs: 500 },
);

console.log(result.submit.status); // 202
console.log(result.poll.status);   // 200
console.log(result.poll.body);
```

---

### `pollUntilComplete`

Polls a path until the server returns a non-202 status, or timeout is reached.

```ts
pollUntilComplete(
  path: string,
  request: AsyncPollRequest,
  options?: PollOptions,
): Promise<PollResult>
```

```ts
const poll = await client.pollUntilComplete(
  client.individualTaskPollPath(ctx),
  { thid: 'task-abc123' },
  { timeoutMs: 15_000 },
);
console.log(poll.status, poll.attempts);
```

---

## High-level helpers

### `createPhoneReminderTasks`

Creates one reminder `Task` per reminder window via `individual/Task/_batch`.
Primary identity channels are `subjectRef` and `ownerRef` (UUID/email/DID references).
`notificationPhone` and `controllerPhone` are optional compatibility fields.

Each window maps to one deterministic task ID (SHA-256 of routing context + refs + `remindAt`).

```ts
createPhoneReminderTasks(
  ctx: RouteContext,
  input: CreatePhoneReminderTasksInput,
  options?: PollOptions,
): Promise<SubmitAndPollResult>
```

```ts
const result = await client.createPhoneReminderTasks(ctx, {
  windows: [
    { offsetMinutes: 10080, remindAt: '2026-05-03T10:00:00.000Z' }, // 1 week before
    { offsetMinutes: 1440,  remindAt: '2026-05-09T10:00:00.000Z' }, // 1 day before
    { offsetMinutes: 60,    remindAt: '2026-05-10T09:00:00.000Z' }, // 1 hour before
  ],
  locale: 'es-ES',
  subjectRef: 'Person/subject-uuid',
  ownerRef: 'RelatedPerson/controller-uuid',
  focusRef: 'Appointment/2026-05-10T10:00:00.000Z',
  reminderSummary: '10/05 10:00 | Hospital San Juan | Consulta cardiología',
  maxAttempts: 3,
});

console.log(result.poll.status); // 200 if all tasks created
```

---

### `searchFamilyOrganization`

Legacy helper: search an existing family organization by controller phone + usualname.
For portal onboarding, use email-based registration flow docs (`PERSONAL_FLOW_STEP_BY_STEP.md`).

```ts
searchFamilyOrganization(
  ctx: RouteContext,
  filters: { controllerPhone: string; usualname: string; birthDate?: string },
  options?: PollOptions,
): Promise<FamilyOrganizationSummary | null>
```

```ts
const org = await client.searchFamilyOrganization(ctx, {
  controllerPhone: '+34600000001',
  usualname: 'Maria',
});

if (org === null) {
  // not found → proceed with registration
} else if (org.status === 'already_exists') {
  console.log(org.organizationId); // UUID of the existing org
} else if (org.status === 'resume_required') {
  // pending → re-submit Order to activate
}
```

---

## Standalone exports

### `createDidcommPlainMessage`

Builds a DIDComm plaintext message object with a random `jti` and `thid`.

```ts
import { createDidcommPlainMessage } from 'dataspace-client-sdk-node';

const payload = createDidcommPlainMessage({
  iss: 'acme',
  aud: 'did:web:api.acme.org',
  body: {
    data: [{ type: 'Task', resource: { ... } }],
  },
});
// payload.jti, payload.thid are set automatically
```

```ts
createDidcommPlainMessage(params: {
  iss: string;
  aud: string;
  type?: string;    // default 'didcomm-plain'
  thid?: string;   // auto-generated UUID if omitted
  body: Record<string, unknown>;
  meta?: Record<string, unknown>;
}): DidcommPlainMessage
```
