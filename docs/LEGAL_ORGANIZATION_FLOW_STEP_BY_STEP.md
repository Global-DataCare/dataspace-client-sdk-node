# LEGAL_ORGANIZATION_FLOW_STEP_BY_STEP

Canonical legal-organization flow index.
This file avoids duplicating controller/practitioner details and points to the source guides.

## Mandatory rules for integrators

Security planes:
- Transport plane: backend ↔ gateway channel protection (deployment-specific).
- Identity/business plane: user/controller/member authentication and authorization.
- Operator/hosting plane: infrastructure/operator lifecycle.

Keep these planes separated; do not treat transport credentials as user identity tokens.

Secure messaging note:
- Authentication for controller/member actions is identity-plane (`vp_token`, `idToken`, SMART/client_assertion).
- Backend-to-service P2P messages can additionally be signed/encrypted (embedded JWS/JWE) according to deployment communication mode.

Wallet profile:
- deterministic key derivation/profile rules are centralized in `BACKEND_NODE_INTEGRATION.md` ("Deterministic Wallet Profile").
- communication mode (`plain` / `strict` / `auto-detect`) is centralized in `BACKEND_NODE_INTEGRATION.md`.

- `jurisdiction` (country) is required in every step.
- Professional tenants are registered in one jurisdiction and all routes resolve against it.
- Identity auth routes and business/entity routes are different:
  - identity: `/host/cds-{jurisdiction}/v1/{sector}/{tenantId}/identity/auth/...`
  - business: `/{tenantId}/cds-{jurisdiction}/v1/{sector}/...`
- `vp_token` is for onboarding proof (`_activate`), not for runtime calls.
- Controller DCR/token and practitioner DCR/token are distinct flows.

## Runtime context pattern (high-level)

```ts
const profileContext = {
  baseUrl: process.env.BASE_URL!,
  jurisdiction: process.env.JURISDICTION!, // REQUIRED
  sector: process.env.SECTOR || 'health-care',
};

const sessionContext = {
  tenantId: currentSession.tenantId,
  controller: currentSession.controller,
  practitioner: currentSession.practitioner,
};
```

Use `profileContext` for role/organization runtime context and `sessionContext` for logged-in user/session data.

## Phase A: controller flow (authoritative)

1. Build/sign VP token (`nonce`, no `jti` in VP for this flow).
2. `_activate` organization in host registry.
3. Read offer and explicit user acceptance.
4. Submit `initialOrder`.
5. Controller DCR bootstrap (`_exchange` then `_dcr`).
6. Request controller runtime token (`_token`).
7. Create employee/member in entity route.
8. Extract activation code for practitioner.
9. If license seats are exhausted: receive `Employee-license-offer-v1.0`, accept, submit `licenseOrder`, retry employee create.

Detailed guide (single source of truth):
- `CONTROLLER_FLOW_STEP_BY_STEP.md`

## Phase B: practitioner flow (authoritative)

1. Receive practitioner activation code from controller flow.
2. Practitioner DCR bootstrap (`_exchange` then `_dcr`).
3. Request practitioner SMART/runtime token (`_token`) with required scopes.
4. Call protected organization/business endpoints.

Detailed guide (single source of truth):
- `PRACTITIONER_FLOW_STEP_BY_STEP.md`

## Scope of this file

- Keep this file as top-level legal organization map.
- Put implementation details in:
  - `CONTROLLER_FLOW_STEP_BY_STEP.md`
  - `PRACTITIONER_FLOW_STEP_BY_STEP.md`
  - `BACKEND_NODE_INTEGRATION.md`

Related references:
- `ENDPOINT_ID_CATALOG.md`
- `DATA_MODEL_ALIGNMENT.md`
