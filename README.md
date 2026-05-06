# dataspace-client-sdk-node

Node.js SDK to consume GW/UNID async DIDComm plain endpoints.

**[→ Full API Reference](docs/API.md)**
**[→ Data Model Alignment (GW + Chat + SDK)](docs/DATA_MODEL_ALIGNMENT.md)**
**[→ Frontend/Backend SDK Ownership Matrix](../docs/SDK_AUTH_OWNERSHIP.md)**
**[→ Developer Use-Case Cookbook (UC5 + additional patterns)](docs/DEVELOPER_USE_CASES.md)**
**[→ Live Local GW UC5 E2E (no mocks)](docs/E2E_LOCAL_GW_UC5.md)**
**[→ React Web Integration Guide](docs/REACT_WEB_INTEGRATION.md)**
**[→ Backend Node Integration Guide](docs/BACKEND_NODE_INTEGRATION.md)**
**[→ Portal Backend Integration Handover](docs/PORTAL_BACKEND_INTEGRATION_HANDOVER.md)**

## Onboarding flows (split by business case)

Do not mix these two flows in the same narrative:

1. Legal Organization Onboarding (B2B/tenant/controller)
2. Personal Organization Onboarding (individual/family/subject)

### 1) Legal Organization Onboarding (B2B/tenant/controller)

Canonical order when ICA proof is involved:

1. ICA proof/verification (`_verify`, external to this SDK).
2. GW activation in host registry: `Organization/_activate`.
3. Offer/Order phase for legal organization onboarding (always; if amount is 0, no payment step).
4. Device onboarding (DCR): `identity/openid/Device/_dcr`.
5. Post-DCR token exchange / SMART authorization for protected API calls.

Node SDK helpers:
- `activateOrganizationInGatewayFromIcaProof(...)` (UC5.2)
- `activateEmployeeDeviceWithActivationCode(...)` (UC5.4)
- `authenticateBackendPkceAndExchange(...)` or `authenticateBackendSmartStandard(...)`

### 2) Personal Organization Onboarding (individual/family/subject)

Canonical order:

1. Personal/family registration: `individual/org.schema/Organization/_batch`.
2. Offer acceptance/order confirmation: `individual/org.schema/Order/_batch`.
3. Continue with consent + subject data workflows.

Node SDK helper:
- `bootstrapSubjectOrganizationIndex(...)` (UC5.1: registration + optional order confirmation)

See:
- `docs/DEVELOPER_USE_CASES.md` (UC5.1..UC5.7)
- `docs/E2E_BOOTSTRAP.md` (host activation bootstrap)

## Scope
- Generic async batch client (`_batch` + `_batch-response`) and JSON POST helper.
- Route builders that cover Swagger v1 route families:
  - `host/registry`: `Organization _batch/_activate`, `Order`,
  - `entity`: `Employee`,
  - `identity`: `Device/_dcr`, `Token/_exchange`, `License/_issue`, SMART token, Firebase custom token,
  - `individual`: `Organization`, `Order`, `Person (legacy)`, `Consent`, `Composition`, `Communication`, `RelatedPerson`, `Observation`, `Task`,
  - `digitaltwin`: `Composition` (`org.hl7.fhir.api` and `org.hl7.fhir.r4`),
  - debug UHC task endpoints: `_call-start`, `_logs`.

## Claims Placement Contract
- Canonical batch-entry claims location: `entry.resource.meta.claims`.
- Legacy compatibility location: `entry.meta.claims`.
- This SDK now emits both during migration; new consumers should read/write `resource.meta.claims`.

## Install (local workspace)

```bash
cd tools/dataspace-client-sdk-node
npm install
npm run type-check
npm run build
```

## Tests (mocked, no network)

The SDK includes mocked tests (Python-SDK style) for:
- route/path building,
- async `submit + poll`,
- multipart conversion upload.

Run:
```bash
cd sdk/dataspace-client-sdk-node

npm test

```


```ts
import { DataspaceNodeClient, createDidcommPlainMessage } from './dist/index.js';
const client = new DataspaceNodeClient({
  baseUrl: 'http://localhost:3000',
  bearerToken: 'demo-token',
});

const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
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

## Backend auth: identity-exchange.v1 (B2B PKCE flow)

For server-to-server integration (e.g. `uhc-unid-chat-node` calling the GW), the SDK implements the
full `identity-exchange.v1` flow: DCR binding → PKCE code → token → SMART bearer exchange.

This is the Node equivalent of Python's `authenticate_backend_pkce_and_exchange` in `connector-sdk-py`.

**Prerequisites:**
1. Your tenant org is activated in the GW (`registry/org.schema/Organization/_activate` with ICA VC).
2. An API key with the required scopes has been issued by ICA (`identity/api-key/_create`).
3. You have your service's public JWK (EC P-384 recommended).

**Usage:**

```ts
import { DataspaceNodeClient } from './dist/index.js';

const client = new DataspaceNodeClient({ baseUrl: 'https://gw.example.com' });

const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };

// Run once per key pair; result is cached automatically.
const auth = await client.authenticateBackendPkceAndExchange({
  ctx,
  apiKey: process.env.GW_API_KEY!,
  controllerPublicJwk: JSON.parse(process.env.GW_PUBLIC_JWK!),
  scopes: ['onboarding', 'family-registration', 'license-order'],
  endpointId: 'chatbot-main', // cache key; re-auth on expiry is automatic
});

if (auth.status === 'failed') {
  throw new Error(`Backend auth failed at step: ${auth.step}`);
}

// Use the bearer for subsequent requests:
const authedClient = new DataspaceNodeClient({
  baseUrl: 'https://gw.example.com',
  bearerToken: auth.accessToken,
});
```

**Demo / local bypass (never for production):**

```ts
// .env: SECURITY_MODE=demo  GW_AUTH_BEARER=static-demo-token
const client = new DataspaceNodeClient({
  baseUrl: process.env.BASE_URL!,
  bearerToken: process.env.GW_AUTH_BEARER, // skip identity-exchange.v1 entirely
});
```

## Backend auth: smart-backend.v1 (client_credentials + private_key_jwt)

For direct OAuth2 machine-to-machine flows (bypassing the PKCE device flow), use the
`smart-backend.v1` profile. The SDK signs the `client_assertion` JWT locally using an
in-memory ES384 wallet.

This is the Node equivalent of Python's `authenticate_backend_smart_standard` in
`connector-sdk-py`.

**Usage:**

```ts
import { DataspaceNodeClient, MemoryWalletProvider } from './dist/index.js';

const wallet = new MemoryWalletProvider();

// walletContext scopes the key pair. Use the service's logical identity.
const walletContext = { tenantId: 'service-a', jurisdiction: 'ES', sector: 'health-care' };

const client = new DataspaceNodeClient({
  baseUrl: 'https://gw.example.com',
  wallet,
});

// On first call, authenticates. On subsequent calls within token TTL, returns cached.
const result = await client.authenticateBackendSmartStandard({
  clientId: 'service-a',
  scopes: ['system/*.read', 'system/*.write'],
  walletContext,
  // tokenUrl: optional absolute URL; defaults to `${baseUrl}/token`
  // audience: optional; defaults to the resolved tokenUrl
  // assertionTtlSeconds: optional; defaults to 300
});

if (result.status === 'failed') {
  throw new Error(`smart-backend.v1 auth failed: HTTP ${result.statusCode}`);
}

const authedClient = new DataspaceNodeClient({
  baseUrl: 'https://gw.example.com',
  bearerToken: result.accessToken,
});
```

**How it works internally:**
1. `MemoryWalletProvider` generates a dedicated EC P-384 key (`use: sig`, `alg: ES384`).
2. `signCompactJws(...)` produces the `client_assertion` JWT signed with that key.
3. A single `client_credentials` POST to the token endpoint returns the bearer.
4. The token is cached until 30s before expiry; subsequent calls return `status: 'cached'`.

## DIDComm encrypted (nested JWS-in-JWE)

For GW endpoints that require `application/didcomm-encrypted+json`, use `submitBatchEncrypted`.
This implements the nested JOSE pattern expected by the backend: sign first (ES384 compact JWS),
then encrypt (ML-KEM-768 + A256GCM compact JWE with `cty: JWS`).

Requires a wallet provider and the recipient's ML-KEM-768 encryption JWK (from GW
`.well-known/jwks.json`, `use: enc`). The `MemoryWalletProvider` generates ML-KEM-768 keys
automatically — no RSA setup required.

### ML-KEM-768 JWK format

Encryption keys use the OKP JWK type with `crv: "ML-KEM-768"`:

```json
{
  "kty": "OKP",
  "crv": "ML-KEM-768",
  "use": "enc",
  "alg": "ML-KEM-768",
  "x": "<base64url-encoded 1184-byte public key>",
  "kid": "wallet:acme:ES:health-care:abc123"
}
```

The `encrypted_key` slot in the compact JWE is the 1088-byte ML-KEM ciphertext (base64url).
The 32-byte shared secret derived by KEM encapsulation is used directly as the AES-256-GCM CEK.

```ts
import { DataspaceNodeClient, MemoryWalletProvider } from './dist/index.js';

const wallet = new MemoryWalletProvider();
const walletContext = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
const client = new DataspaceNodeClient({ baseUrl: 'https://gw.example.com', wallet });

// Wallet's own ML-KEM enc JWK (share with backend so it can encrypt to you):
const [, encJwk] = await wallet.getPublicJwks(walletContext);

// Fetch GW encryption JWK from well-known endpoint for outbound encryption:
// const { keys } = await (await fetch('https://gw.example.com/.well-known/jwks.json')).json();
// const recipientEncJwk = keys.find(k => k.use === 'enc' && k.crv === 'ML-KEM-768');

// For local roundtrip test, use wallet's own enc key as recipient:
const recipientEncJwk = encJwk;

const payload = { thid: 'my-thid', body: { data: [] } };
const result = await client.submitBatchEncrypted(
  client.individualFamilyOrganizationBatchPath(ctx),
  payload,
  recipientEncJwk,
  walletContext,
);
```

**Cache helper** — if you need the current bearer without re-running the flow:

```ts
const bearer = client.getCachedBearerToken('chatbot-main');
// Returns undefined if not cached or expired (>30s remaining).
```

Full runnable example: `examples/backend-pkce-auth.mjs`

## Swagger parity strategy
- For any v1 route exposed in Swagger, use:
  - `client.v1Path(ctx, section, format, resourceType, action)` for tenant routes.
  - `client.hostRegistryPath(ctx, resourceType, action)` for host registry routes.
- Then call one of:
  - `submitBundle(path, didcommPayload)` for DIDComm bundle submit routes (preferred),
  - `submitBatch(path, didcommPayload)` (legacy alias, kept for compatibility),
  - `submitLegacyJson(path, payload)` for non-DIDComm JSON routes,
  - `pollBatchResponse(path, { thid })` / `pollUntilComplete(...)`,
  - `postJson(path, payload)` for non-batch JSON routes.

This avoids hardcoding curl scripts per endpoint.

## Notes for telephony tests
- Keep GW/UHC unit/integration tests direct (service/router level).
- Use this SDK for consumer-style E2E tests and external Node.js service integrations.
- If individual onboarding moves to a separate service, telephony tests should consume that service and only use GW/UHC for reminders/calls.

## DataConversion / Excel

This SDK now includes conversion helpers:
- `conversionUploadPath(ctx, softwareId, sourceFormat)`
- `conversionUploadPollPath(ctx, softwareId, sourceFormat)`
- `uploadConversionFile({ path, fileName, fileContent, fields })`

Example:
- `examples/conversion-upload.mjs`

Run:
```bash
cd sdk/dataspace-client-sdk-node
npm run build
BASE_URL="http://localhost:3000" \
AUTH_BEARER="demo-token" \
TENANT_ID="acme" \
JURISDICTION="ES" \
SECTOR="animal-care" \
SOFTWARE_ID="excel-adapter" \
SOURCE_FORMAT="xlsx" \
SOURCE_FILE="/absolute/path/to/input.xlsx" \
node examples/conversion-upload.mjs
```

Notes:
- Exact multipart field names may vary by DataConversion deployment.
- If your conversion API is synchronous, polling is optional.
- If it is async, provide/resolve `thid` and poll `.../_upload-response`.

## Next planned additions
- Typed payload builders per flow (`family`, `relatedPerson`, `observation`, `task`).
- Claims mappers (`ClaimName` <-> SQL internal name with `_`).
- Retry/backoff + richer error mapping.

## Planning and Parity Docs

- TODO / execution prompt: `TODO_PROMPT_NEXT_STEPS.md`
- Node/Python API parity map: `SDK_PARITY_MAP.md`

## Pending Compatibility TODO
- See [SMART EHR compatibility TODO](docs/TODO_SMART_EHR_COMPAT.md).
