# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-05-04

### Added
- Data model alignment guide updated for cross-service namespace consistency:
  - Gateway: `/host/...` (with `auth` security model)
  - ICA: `/ica/...`
  - DataConv: `/publisher/...`
- Explicit integration guidance that SDK consumers should use SDK path helpers instead of manually composing host prefixes/routes.

### Changed
- Contact identity contract for onboarding/controller flows is now documented as dual-channel:
  - Email (`org.schema.Person.email`)
  - Telephone (`org.schema.Person.telephone`
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
