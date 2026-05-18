# SDK Missing Implementation Plan (Immediate, TDD)

Goal: complete full-flow coverage per resource:
1. create/activate/ingest
2. search/read/list
3. update/add/revoke/deactivate

## Phase 1 (next)

| Priority | Namespace | Methods to add | Why |
|---|---|---|---|
| P0 | `consent` | `addRule`, `list`, `scopeCheck`, `updateRule`, `revokeRule`, `accessRequest` | central for authorization flow and missing update/revoke stage |
| P0 | `relatedPerson` | `create`, `list`, `search`, `update` | contacts are required for emergency/continuity flows |
| P0 | `message` | `send`, `poll`, `list` | explicit messaging API instead of generic submit/poll calls |
| P1 | `composition` / `index` | `search`, `references.upsert`, `updateSections` | explicit read/list/update API for indexed artifacts |
| P1 | `tenant` / `licenses` | `updateLicenses`, `listAvailable` | required by onboarding/admin tasks |
| P1 | `audit` / `evidence` | `events`, `register` | traceability and compliance |

## TDD Definition per method

For each new method:
1. Unit test in SDK: verifies payload shape, endpoint path, submit+poll behavior, and error mapping.
2. GW integration test: verifies manager/route behavior and persistence contract.
3. Live E2E: verifies end-to-end behavior against running GW with real async polling.

No method is marked complete until all three pass.

## Naming and compatibility rules

- Prefer explicit namespace methods over ad-hoc wrappers.
- Keep canonical flat claims in SDK input.
- Keep resource + `meta.claims` together when submitting FHIR payloads.
- Provide FHIR-version conversion helpers where required.

## Acceptance checkpoint

A namespace is considered complete only when it has:
- create method(s),
- at least one list/search/read method,
- at least one update/add/revoke/deactivate method,
- unit + integration + live E2E coverage.

