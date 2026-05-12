# Backend Node Integration

This guide is backend-only and uses `dataspace-client-sdk-node`.

## Secure communications intent

- `backendWallet` is used for secure API communications in the dataspace.
- User authentication and authorization still apply (for example `client_assertion` for SMART token issuance, scopes, consent).
- Message protection can run in addition to HTTPS:
  - signature (embedded JWS)
  - encryption (JWE with nested JWS)
- Apply by environment policy (`plain` / `strict` / `auto-detect`).
- This is layered security (transport + message), not a literal VPN.

## Credential map (do not mix)

| Credential | Plane | Purpose | Not used for |
|---|---|---|---|
| transport bearer / mTLS / API-gateway credential | Transport | Allow backend HTTP access to GW deployment | User identity, `_exchange`, SMART scopes |
| `vp_token` | Identity/business | Onboarding proof for activation | Catalog discovery auth |
| `idToken` (user session) | Identity/business | User session proof | Transport gateway access policy |
| `_exchange` token flow | Identity/business | Activation code exchange for initial access | Multi-ICA/operator catalog traversal |
| SMART access token | Identity/business | Authorized protected operations via scopes | Infrastructure/operator-plane control |

Recommended initialization:

```ts
import { randomBytes } from 'node:crypto';
import { DataspaceNodeClient, SeedWalletProvider } from 'dataspace-client-sdk-node';

const backendWalletSeedBytes = process.env.WALLET_SEED_BASE64URL
  ? Buffer.from(process.env.WALLET_SEED_BASE64URL, 'base64url')
  : randomBytes(32); // if not provided, generate random 32 bytes for this runtime

const backendWallet = new SeedWalletProvider(
  Buffer.from(backendWalletSeedBytes).toString('base64url'),
);

const client = new DataspaceNodeClient({
  baseUrl,
  wallet: backendWallet,
  ctx: { tenantId, jurisdiction, sector },
});
```

Alternative (mutable context):

```ts
const client = new DataspaceNodeClient({ baseUrl, wallet: backendWallet });
client.setContextOrg({ tenantId, jurisdiction, sector });
client.setDefaultTimeoutSeconds(12);
client.setDefaultIntervalSeconds(2);
```

### Communication mode (integration-level policy)

SDK does not currently expose a single constructor flag for communication mode.
Use an integration policy variable and choose the submit method explicitly:

- `plain`: always `submitBundle(..., { mode: 'plain' })` (or `submitBatch(...)` for legacy compatibility)
- `strict`: always `submitBatchEncrypted(...)`
- `auto-detect` (default): use encrypted when backend wallet + recipient encryption JWK are available, otherwise plaintext

GW compatibility (current):
- supported request envelopes:
  - `application/didcomm-plaintext+json` (demo/compat only)
  - `application/json` (legacy/demo paths only)
  - `application/x-www-form-urlencoded` with `request=<jwe>` (secure/FAPI style)
- no standalone `didcomm-signed+json` HTTP submit mode is currently exposed as a first-class request content type.
  - signed-only JWS exists as an internal layer pattern, but secure mode entrypoint is form-encoded JWE.

```ts
type CommunicationMode = 'plain' | 'strict' | 'auto-detect';
const communicationMode: CommunicationMode = (process.env.GW_COMMUNICATION_MODE as CommunicationMode) || 'auto-detect';

async function submitDidcomm(
  client: DataspaceNodeClient,
  path: string,
  payload: Record<string, unknown>,
  opts: {
    mode: CommunicationMode;
    walletContext: { tenantId: string; jurisdiction: string; sector: string; walletId?: string };
    recipientEncryptionJwk?: any;
  },
) {
  const canEncrypt = !!opts.recipientEncryptionJwk;
  if (opts.mode === 'strict' && !canEncrypt) {
    throw new Error('strict mode requires recipientEncryptionJwk');
  }
  if (opts.mode === 'strict' || (opts.mode === 'auto-detect' && canEncrypt)) {
    return client.submitBatchEncrypted(path, payload as any, opts.recipientEncryptionJwk, opts.walletContext as any);
  }
  return client.submitBundle(path, payload, { mode: 'plain' });
}
```

## Flow A. Legal Organization Onboarding (B2B)

1. Verify legal-organization PDF in ICA and obtain:
   - `OrganizationCredential` VC
   - `LegalRepresentativeCredential` VC
2. Build VP payload with both VCs and prepare `header.payload` for signature.
   - integrator signs with controller key (ES256K / ES384 / ML-DSA depending on environment policy)
3. Receive from frontend/backend session context: `jurisdiction`, `sector`, `tenantId`, signed `vpToken`.
4. Activate in GW:
   - SDK method: `activateOrganizationInGatewaySimple(...)` (recommended)
   - SDK method: `activateOrganizationInGatewayFromIcaProof(...)` (advanced)
5. Complete legal organization order (always; amount may be `0`) using `offerId` returned by activation response.
   - `hostRegistryOrderBatchPath(...)`
   - `hostRegistryOrderPollPath(...)`
   - `submitAndPoll(...)`
6. Run controller DCR/token bootstrap first (`_exchange` then `_dcr`), then employee flows.
7. Run employee DCR/token bootstrap when employee is invited/activated:
   - `activateEmployeeDeviceWithActivationCodeSimple(...)` (recommended)
   - `activateEmployeeDeviceWithActivationCode(...)` (advanced)
   - `requestSmartTokenSimple(...)` (recommended)
   - `requestSmartToken(...)` (advanced)
   - `authenticateBackendPkceAndExchange(...)` or `authenticateBackendSmartStandard(...)`

### Custom backend code example: activate endpoint

```ts
app.post('/api/onboarding/legal/activate', async (req, res) => {
  const client = new DataspaceNodeClient({ baseUrl });
  client.setContextOrg({
    tenantId: req.body.tenantId,
    jurisdiction: req.body.jurisdiction,
    sector: req.body.sector,
  });
  const activation = await client.activateOrganizationInGatewaySimple({
    vpToken: req.body.vpToken,
    serviceProviderDidWeb: req.body.serviceProviderDidWeb, // or serviceProviderUrl
    serviceProviderUrl: req.body.serviceProviderUrl,
    controllerEmail: req.body.controllerEmail,
    controllerTelephone: req.body.controllerTelephone, // optional alternative to email
    controllerRole: req.body.controllerRole,
    numberOfMembers: req.body.numberOfMembers ?? 2,
  });
  const offerId = client.getOfferIdFromResponse(activation);
  if (!offerId) throw new Error('Offer id missing in activation response');
  const offer = client.getOfferPreviewFromResponse(activation);
  // Use `offer` to render amount/currency/description to user before acceptance.
  const order = await client.confirmLegalOrganizationOrderSimple({
    offerId,
  });
  res.json({ activation, offerId, order });
});
```

Async UX note:
- `submitAndPoll` is convenient but returns final state.
- If you need progress updates, call lower-level `submitBatch` + `pollUntilComplete`
  and stream step transitions to frontend.

## Flow B. Personal Organization Onboarding (individual/family)

1. Receive registration payload from frontend.
2. Start registration and extract offer:
   - SDK method: `startIndividualOrganizationSimple(...)` (recommended)
3. Frontend shows offer and user accepts.
4. Confirm order:
   - SDK method: `confirmIndividualOrganizationOrderSimple(...)` (recommended)
5. Provisional one-shot helper (auto-order, for legacy/fork scenarios):
   - SDK method: `bootstrapIndividualOrganizationSimple(...)` (provisional)
3. Continue consent/clinical lifecycle as needed:
   - `grantProfessionalAccessSimple(...)`
   - `importIpsOrFhirAndUpdateIndex(...)`
   - `requestSmartTokenSimple(...)` (recommended)
   - `requestSmartToken(...)` (advanced)
   - `generateDigitalTwinFromSubjectData(...)`

### Custom backend code example: personal register endpoint

```ts
app.post('/api/onboarding/personal/register', async (req, res) => {
  const client = new DataspaceNodeClient({ baseUrl });
  const ctx = {
    tenantId: req.body.tenantId,
    jurisdiction: req.body.jurisdiction,
    sector: req.body.sector,
  };

  const started = await client.startIndividualOrganizationSimple({
    alternateName: req.body.alternateName,
    controllerEmail: req.body.controllerEmail,
    controllerTelephone: req.body.controllerTelephone,
    controllerRole: req.body.controllerRole || '|RESPRSN', // "RESPRSN" = Responsible Party (ver https://terminology.hl7.org/CodeSystem-v3-RoleCode.html)
  });
  // Return offer to frontend for explicit acceptance UX.
  // Later, call confirmIndividualOrganizationOrderSimple({ offerId: started.offerId }).
  res.json(started);
});
```

## References

- `examples/e2e-bootstrap-tenant.mjs`
- `examples/host-activate-and-employee.mjs`
- `examples/e2e-individual-flow.mjs`
- `tests/uc5-org-onboarding.flow.test.mjs`
- `tests/uc5-subject-data.flow.test.mjs`

## Deterministic Wallet Profile (seed-based, integrator-managed)

Use this section for all flows (controller/professional/personal) when the backend signs/encrypts DIDComm messages without external per-operation KMS signing.

Core rule:
- key custody and seed storage are integrator responsibility
- SDK requires signing/encryption capability, not local private-key assumptions

Recommended derivation contract:

```ts
type DeriveKeyMaterialInput = {
  seed: Uint8Array;               // decrypted by integrator runtime
  tenantId: string;
  jurisdiction: string;
  sector: string;
  walletId?: string;
  purpose: 'signing' | 'encryption';
  algorithm: 'ES384' | 'ES256K' | 'ML-DSA-65' | 'ML-KEM-768';
  kdfVersion: 'v1';
};
```

Domain separation (mandatory):
- derive per `purpose` and `algorithm`
- never reuse derived bytes across different purposes or algorithms

Canonical context string:
- `tenantId|jurisdiction|sector|walletId|purpose|algorithm|kdfVersion`

KDF profile (example):
- `scrypt(seed, salt=context, N=2^15, r=8, p=1, dkLen=64)`
- split derived bytes by algorithm requirements
- keep parameters versioned and immutable per `kdfVersion`

Why:
- deterministic reproducibility across runs/devices
- safe algorithm migration (ES384 now, ML-DSA later) without collisions
- portable across Node backend and mobile/web SDK profiles

Strict DIDComm mode:
- sign payload as embedded JWS
- encrypt as JWE for recipient
- use the derived keypair for the active `purpose+algorithm`

Flow links:
- `CONTROLLER_FLOW_STEP_BY_STEP.md`
- `LEGAL_ORGANIZATION_FLOW_STEP_BY_STEP.md`
- `PRACTITIONER_FLOW_STEP_BY_STEP.md`
- `PERSONAL_FLOW_STEP_BY_STEP.md`
