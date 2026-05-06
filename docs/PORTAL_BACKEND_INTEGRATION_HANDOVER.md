# Portal Backend Integration Handover

Target audience: team implementing a portal backend that integrates with GW via `dataspace-client-sdk-node`.

## 1) What this SDK does vs does not do

`dataspace-client-sdk-node` does:
- build GW paths
- submit/poll async DIDComm plain flows
- provide high-level wrappers for common UC5 steps

`dataspace-client-sdk-node` does not do:
- ICA UX orchestration in browser
- wallet UX/signing UX for end-users
- generic OIDC4VP UI flow control

`vp_token` source:
- produced by your identity/wallet flow (usually ICA/OIDC4VP side)
- then passed to backend and used in GW `_activate`

## 2) Responsibility split

1. Portal frontend:
   - UX, contract signature flow, identity/wallet flow
   - obtains `vpToken`
   - sends onboarding payloads to portal backend
2. Portal backend (this integration):
   - uses this SDK to call GW
   - executes end-to-end business order and polling
3. GW backend:
   - validates proofs, processes onboarding, authorization and data access contracts

### Recommended SDK initialization

Initialize once with default context to avoid repeating `tenantId/jurisdiction/sector`:

```ts
const client = new DataspaceNodeClient({
  baseUrl,
  bearerToken,
  ctx: { tenantId, jurisdiction, sector },
});
```

## 3) Legal organization onboarding (complete, numbered)

Canonical order:
`_verify -> _activate -> Offer -> Order -> DCR -> token`

### Step 1. Frontend obtains `vpToken`

Expected backend input:
- `jurisdiction` (required)
- `sector` (required)
- `vpToken` (required)
- `numberOfMembers` (optional, generic; default `2`)

Notes:
- `jurisdiction` is explicit route context. It is not inferred from VAT.
- `sector` is explicit route context. It is not inferred from DID.

Set once in client:

```ts
client.setContextOrg({ tenantId, jurisdiction, sector });
client.setDefaultTimeoutSeconds(120);
client.setDefaultIntervalSeconds(2);
```

### Step 2. Backend activates organization in GW

Preferred SDK method (friendly):
- `activateOrganizationInGatewaySimple(...)`

```ts
const activation = await client.activateOrganizationInGatewaySimple({
  vpToken,
  serviceProviderDidWeb, // or serviceProviderUrl (SDK maps URL -> did:web:<host>)
  controllerEmail, // or controllerTelephone
  controllerRole,  // e.g. ISCO-08|1112
  numberOfMembers,     // optional, default 2
});
```

Advanced equivalent (less friendly, same behavior):
- `activateOrganizationInGatewayFromIcaProof(ctx, input, pollOptions)`

```ts
const activation = await client.activateOrganizationInGatewayFromIcaProof(
  { jurisdiction, sector },
  {
    vpToken,
    numberOfMembers,
  },
  { timeoutMs: 120000, intervalMs: 2000 },
);
```

Default behavior:
- if `numberOfMembers` is not provided, SDK defaults to `2`
  (controller + one operational employee).

### Step 3. Backend extracts `offerId` from `_activate` response

Use SDK helper:
- `client.getOfferIdFromResponse(activation)`

Extract offer preview fields from the first DIDComm entry via:
- `client.getFirstDidcommDataEntryFromResponse(activation)`
- or directly as UI object: `client.getOfferPreviewFromResponse(activation)`

Expected offer claims (GW examples/contracts):
- `org.schema.Offer.identifier`
- `org.schema.Offer.price`
- `org.schema.Offer.priceCurrency`
- `org.schema.Offer.eligibleQuantity.value`
- `org.schema.Offer.itemOffered.name`
- `org.schema.Offer.itemOffered.sku`
- `org.schema.Offer.acceptedPaymentMethod`
- `org.schema.Offer.checkoutPageURLTemplate`

Recommended UI mapping helper:
- `client.getOfferPreviewFromResponse(activation)` ->
  `{ offerId, amount, currency, seats, planName, sku, paymentMethod, checkoutUrl }`

### Step 4. Backend executes legal organization order (always)

Even with `0` amount, Order is still required.

Preferred SDK method (friendly):
- `confirmLegalOrganizationOrderSimple(...)`

```ts
const legalOrgOrder = await client.confirmLegalOrganizationOrderSimple({
  offerId,
});
```

Advanced equivalent (less friendly):
- `hostRegistryOrderBatchPath(...)`
- `hostRegistryOrderPollPath(...)`
- `submitAndPoll(...)`

Example:

```ts
const offerId = client.getOfferIdFromResponse(activation);
if (!offerId) throw new Error('Offer id missing in activation response.');

const legalOrgOrder = await client.submitAndPoll(
  client.hostRegistryOrderBatchPath({ jurisdiction, sector }),
  client.hostRegistryOrderPollPath({ jurisdiction, sector }),
  {
    thid: `order-${Date.now()}`,
    body: {
      data: [{
        type: 'Organization-order-request-v1.0',
        meta: { claims: { 'Order.acceptedOffer.identifier': offerId } },
      }],
    },
  },
);
```

### Step 4.1 UX requirement: show offer summary before order

Portal UX should present:
1. Offer identifier
2. Total amount and currency (if provided)
3. Product/license summary
4. Acceptance action (user confirms, then backend sends Order)

Even if amount is `0`, user acceptance and Order submission still happen.

### Step 5. Backend creates doctor employee

SDK method:
- `createOrganizationEmployee(...)`

Use claim constants:
- `ClaimsPersonSchemaorg` from `gdc-common-utils-ts/constants/schemaorg`

```ts
const employee = await client.createOrganizationEmployee(
  { tenantId, jurisdiction, sector },
  {
    employeeClaims: {
      '@context': 'org.schema',
      [ClaimsPersonSchemaorg.email]: 'doctor@example.com',
      [ClaimsPersonSchemaorg.hasOccupation]: 'ISCO-08|2211',
    },
  },
);
```

### Step 6. Backend activates doctor device (DCR path)

SDK method:
- `activateEmployeeDeviceWithActivationCodeSimple(...)` (recommended)
- `activateEmployeeDeviceWithActivationCode(...)` (advanced)

```ts
const device = await client.activateEmployeeDeviceWithActivationCodeSimple({
  activationCode,
  idToken: doctorUserIdToken,
  dcrPayload: {
    application_type: 'web',
    token_endpoint_auth_method: 'private_key_jwt',
    jwks: { keys: [doctorPublicJwk] },
  },
});
```

### Step 7. Backend obtains SMART token for authorized access

SDK method:
- `requestSmartTokenSimple(...)` (recommended)
- `requestSmartToken(...)` (advanced)

```ts
const smart = await client.requestSmartTokenSimple({
  idToken: doctorUserIdToken,
  targetEndpoint: client.getEndpointId({
    section: 'organization',
    format: 'org.hl7.fhir.r4',
    resourceType: 'Composition',
    action: '_search',
  }, doctorDidWeb),
  scopes: ['organization/Composition.rs'],
});
```

## 4) Individual subject onboarding + access grant (doctor reads index)

### Step 8. Register personal organization + family order

SDK method:
- `bootstrapSubjectOrganizationIndex(...)`

```ts
const subjectBootstrap = await client.bootstrapSubjectOrganizationIndex(
  { tenantId, jurisdiction, sector },
  {
    registrationPayload,
    confirmationPayload, // include accepted offer id
  },
);
```

### Step 9. Grant doctor consent to read subject index/data

SDK method:
- `grantProfessionalAccessSimple(...)`

```ts
await client.grantProfessionalAccessSimple(
  { tenantId, jurisdiction, sector },
  {
    subjectDid: subjectDidWeb,
    actor: { identifier: doctorDidWeb },
    actorRole: 'Practitioner',
    purpose: 'TREAT',
    actions: ['organization/Composition.rs'],
  },
);
```

### Step 10. Doctor uses SMART token to read permitted resources

Use bearer returned by step 7 in subsequent resource calls.

## 5) Minimal backend request contracts from frontend

Legal activate request:

```json
{
  "jurisdiction": "ES",
  "sector": "health-care",
  "vpToken": "<vp_token>"
}
```

Personal register request:

```json
{
  "tenantId": "acme",
  "jurisdiction": "ES",
  "sector": "health-care",
  "registrationPayload": {},
  "confirmationPayload": {}
}
```

## 6) Primary SDK methods checklist

1. `activateOrganizationInGatewayFromIcaProof`
2. extract `offerId` from activation response
3. `submitAndPoll` + `hostRegistryOrderBatchPath` / `hostRegistryOrderPollPath`
4. `createOrganizationEmployee`
5. `activateEmployeeDeviceWithActivationCodeSimple`
6. `requestSmartTokenSimple`
7. `bootstrapSubjectOrganizationIndex`
8. `grantProfessionalAccessSimple`

## 7) Async/poll UX pattern (important)

All onboarding operations are async (`submit` + `poll`).

Recommended backend pattern per step:
1. Emit status `submitted` after POST returns `202`.
2. Poll until completion.
3. Emit status `completed` or `failed` with diagnostics.

Polling interval behavior:
- if caller sets `intervalMs`, that value is forced.
- if caller does not set `intervalMs`, SDK uses backend `Retry-After` when present.
- fallback default is `2000ms`.

Recommended portal UX states:
1. `Verifying identity proof`
2. `Activating organization`
3. `Offer available` (show price/summary)
4. `Waiting for acceptance`
5. `Submitting order`
6. `Creating employee`
7. `Activating device`
8. `Token ready`

Implementation note:
- If you need real-time UX updates, expose backend progress via SSE/WebSocket.
- If not, frontend can poll your backend orchestration endpoint for step status.

## 8) References

- `docs/BACKEND_NODE_INTEGRATION.md`
- `docs/REACT_WEB_INTEGRATION.md`
- `docs/DEVELOPER_USE_CASES.md`
- `docs/API.md`
- `examples/e2e-bootstrap-tenant.mjs`
- `tests/uc5-org-onboarding.flow.test.mjs`
- `tests/uc5-subject-data.flow.test.mjs`
