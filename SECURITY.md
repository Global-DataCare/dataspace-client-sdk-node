# Security

## Scope

`dataspace-client-sdk-node` is now a legacy migration source.

It still contains the main concrete HTTP, DIDComm, wallet and polling implementation used in production-oriented Node flows, but new actor-scoped runtime ownership is being moved into `gdc-sdk-node-ts`.

## Security principles

### 1. Legacy package, not final authority

This package should not regain ownership of:

- actor/capability contracts
- actor-scoped session modeling
- role facade separation

Those concerns now belong to:

- `gdc-sdk-core-ts`
- `gdc-sdk-node-ts`

### 2. Actor surfaces must stay separated

Backend consumers must not collapse capabilities into a single broad client surface.

Controller/member/professional surfaces remain distinct even when a composite descriptor is used upstream.

### 3. Public clients should not call ICA directly

Recommended production posture remains:

- mobile/web/public clients call a backend, BFF or Cloud Functions layer
- that backend talks to ICA and GW
- ICA `_verify` and GW `_activate` are not exposed as direct public-client integrations

### 4. Trust is operator-configured

Firebase or other OIDC issuers must be explicitly trusted by backend/operator policy.

Possession of a frontend token is not enough by itself to authorize privileged onboarding or controller flows.

### 5. Async orchestration ownership is migrating out

`submitAndPoll` and `pollUntilComplete` behavior must converge toward `gdc-sdk-node-ts` helpers.

This reduces the risk of:

- divergent polling semantics
- inconsistent timeout behavior
- hidden behavior drift between legacy and target packages

### 6. Operational safety

Release and live-execution actions remain privileged operations:

- `git push`
- `npm publish`
- live E2E with real credentials
- scripts that start listeners or services

They must run only in the correct host context, not as casual sandbox actions.
