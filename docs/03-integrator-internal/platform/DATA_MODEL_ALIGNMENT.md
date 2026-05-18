# Data Model Alignment (GW + ICA + DataConv + SDK)

Reference alignment for SDK consumers and backend integrators.

## API Namespace Alignment

- Gateway onboarding and operational flows use `/host/...` with `auth`-based security (OIDC + smart token post-DCR).
- ICA flows use `/ica/...` namespace.
- DataConv flows use `/publisher/...` namespace.
- SDK helpers should abstract these prefixes so integrators do not rebuild paths manually.

## Claims Envelope

- Canonical claim carrier is `resource.meta.claims`.
- `meta.claims` remains accepted only as deprecated compatibility for older payloads.
- New SDK examples and integrator docs should use `resource.meta.claims` when constructing messages.

## Business Sector vs Host Registry Sector

- Host onboarding/routing can use infrastructure/network sector (`HOST_REGISTRY_SECTOR`).
- Tenant runtime model uses business sector (`SECTOR`).
- Canonical tenant vault ID format:
  - `<SECTOR>_<tenantId>`
  - Example: `health-care_acme`

## Legal Organization Activation Inputs

- `vp_token` is the primary proof artifact.
- Organization VC can be extracted from the VP (`LegalOrganizationCredential` / `OrganizationCredential`).
- Representative VC is optional depending on policy, but contact/role claims are still required for controller bootstrap.
- Controller contact supports both:
  - `org.schema.Person.email`
  - `org.schema.Person.telephone`
- Do not document phone-only assumptions as general contract.

## Offer/Order Commercial Contract

- Offer/Order remains part of the onboarding business flow even when amount is `0`.
- SDK should expose helpers to:
  - extract offer identifier from activation/orderable claims
  - expose offer preview fields (amount, currency, description) for UI confirmation
- Backend should send Order acceptance explicitly using `Order.acceptedOffer.identifier`.

## Individual Organization Model

- Section naming: `<prefix>_individual`.
- Canonical individual org identifier: `org.schema.Organization.identifier.value` (UUID).
- Contact model is the same as legal org onboarding: email or telephone.

## Search Contract (`searchFamilyOrganization`)

- Input mapping:
  - `controllerPhone` -> `org.schema.Organization.owner.telephone`
  - `controllerEmail` -> `org.schema.Organization.owner.email`
  - `usualname` -> `org.schema.Organization.alternateName`
  - `birthDate` -> `org.schema.Organization.foundingDate` (optional)

## Voice/Phone Use Case Notes

- Voice agents may prioritize `telephone` for call target resolution.
- Generic portal/web integrations must support both email and telephone identity channels.
