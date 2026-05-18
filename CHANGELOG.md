# Changelog

All notable changes to this project will be documented in this file.

## 0.2.8 - 2026-05-18

### Changed
- Updated dependency to `gdc-common-utils-ts@^1.4.16`.
- Documented canonical member DID composition (`owner did:web` + `:member:<member-id>:<role>`) in auth model docs.

## [Unreleased] - 2026-05-04

### Added
- Synced GW canonical `core-flow-examples` fixture to VP-JSON-first activation sample (`ORGANIZATION_ACTIVATION_REQUEST.body.data[].vp`) for auditable onboarding proof modeling.
- VP helper surface is now centralized in `gdc-common-utils-ts` and consumed from SDK re-export (`src/vp-token.ts`).
- Data model alignment guide updated for cross-service namespace consistency:
  - Gateway: `/host/...` (with `auth` security model)
  - ICA: `/ica/...`
  - DataConv: `/publisher/...`
- Explicit integration guidance that SDK consumers should use SDK path helpers instead of manually composing host prefixes/routes.

### Changed
- Live UC5 IPS flow assertions now validate DocumentReference retrieval by canonical hash claim (`DocumentReference.contenthash`) after Communication ingestion.
- Documentation updated to clarify:
  - atomic Communication conversion profile vs native FHIR Communication cardinalities,
  - DocumentReference logical identifier (`identifier`) vs content hash (`contenthash`) responsibilities,
  - hash-based Bundle search examples for both `api` and `r4` path families.

### Changed
- Contact identity contract for onboarding/controller flows is now documented as dual-channel:
  - Email (`org.schema.Person.email`)
  - Additional identity channel claims as profile-defined
- Offer/Order process clarified as part of the onboarding contract even when commercial amount is zero:
  - Offer extraction for UI review/acceptance
  - Explicit Order acceptance using offer identifier
- Activation trust-chain contract aligned with ICA/GW:
  - `_activate` uses `vp_token` in message payload (not as HTTP Bearer),
  - legal representative binding relies on `org.schema.Person.memberOf.taxID` and
    `org.schema.Person.hasCredential.material` for key continuity between `_verify` and `vp_token` signature.

### Documentation
- Updated:
  - `docs/DATA_MODEL_ALIGNMENT.md`
- Clarified:
  - `/host` + `auth` alignment with current gateway model
  - namespace symmetry with ICA (`/ica`) and DataConv (`/publisher`)
