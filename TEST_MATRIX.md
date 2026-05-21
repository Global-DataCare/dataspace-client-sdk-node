# TEST_MATRIX - dataspace-client-sdk-node

Core live coverage summary lives in `TEST_CORE.md`.

## Goal
Validate SDK contracts, orchestration behavior, and GW live interoperability.

## Levels
1. Unit / contract tests (required)
- Path builders
- payload normalization
- submit/poll behavior
- method-level wrappers

2. Docs/API consistency (required)
- JSDoc coverage
- generated API tables
- doc link integrity

3. Live E2E against running GW (required for core flow changes)
- legal/controller/personal baseline
- communication ingestion and indexed retrieval
- bearer shape/security mode expectations

4. Live E2E for extensions (required only when extension path changes)
- extension flows are validated in extension repositories/matrices

## Commands
- Build: `npm run build`
- Unit/contract: `npm test`
- Docs validation: `npm run docs:validate`
- Live E2E core chain:
  - `RUN_LIVE_GW_E2E=1 npm run test:e2e:live-use-cases`
- Live E2E with IPS ingestion branch:
  - `RUN_LIVE_GW_E2E=1 RUN_LIVE_GW_E2E_IPS_INGESTION=1 npm run test:e2e:live-use-cases`
- Live E2E extension suites:
  - Run from the corresponding extension repository/test matrix.

## Core Files Under Test
- `tests/client.test.mjs`
- `tests/communication-transform.test.mjs`
- `tests/live-gw-uc5.e2e.test.mjs`
- `tests/orchestration-classes.test.mjs`

## Extension Files Under Test
- Maintained in extension repositories (outside core GW UC matrix).

## Exit Criteria
- Core tests green
- No regression in flow docs vs test behavior
- Live E2E green for modified core path
