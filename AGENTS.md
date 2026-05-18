# AGENTS.md - dataspace-client-sdk-node

## Purpose
Node SDK for secure submit/poll orchestration and UC flow composition against GW APIs.

Primary references:
- `README.md`
- `docs/01-globaldatacare-gw/01_SDK_CANONICAL_GUIDE.md`
- `docs/01-globaldatacare-gw/testing/01_E2E_LOCAL_GW_UC5.md`
- `docs/01-globaldatacare-gw/security/01_SECURITY_TESTS.md`
- `docs/sdk-api/00_README.md`
- `docs/04-reference/catalogs/SDK_API_TABLE.md`

## Scope Rules
1. Core scope docs/methods must remain separated from extension scope docs:
- Core: `docs/01-globaldatacare-gw`
- Extensions: `docs/02-unid-extensions`
- Integrator-internal: `docs/03-integrator-internal`
2. Do not remove non-core features blindly; move/de-scope with explicit docs note.
3. SDK API docs and JSDoc must match real behavior and tests.

## Hard Behavior Rules
1. Atomic communication profile must be documented as profile constraint, not FHIR redefinition.
2. For DocumentReference retrieval semantics used by SDK tests:
- `DocumentReference.identifier` = logical identifier (UUID/URN)
- `DocumentReference.contenthash` = CID/hash for integrity and hash-based retrieval.
3. For live E2E in core flows, avoid silent soft-pass on critical assertions.

## TDD Policy
1. Add failing unit/integration/E2E assertion first.
2. Implement minimum behavior.
3. Re-run full impacted test set.

Required when flow changes:
- unit tests in `tests/*.test.mjs`
- live flow checks in `tests/live-gw-uc5.e2e.test.mjs` (when route is core)

## Quality Gates
- `npm run build`
- `npm test`
- `npm run docs:validate`
- Live E2E when changing core UC flow:
  - `RUN_LIVE_GW_E2E=1 npm run test:e2e:live-use-cases`

## Release Discipline
- Update `CHANGELOG.md` under `Unreleased` with concrete API/flow changes.
- Keep docs table + per-method docs synchronized.

## Documentation Requirements for New Methods
For every public method:
1. JSDoc in source.
2. Entry in API table.
3. Dedicated method doc in `docs/sdk-api/methods` (or explicit exception).
4. UC placement (when/why used) documented in step-by-step flow docs.
