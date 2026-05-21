# TODO - dataspace-client-sdk-node

Planning references:
- `docs/04-reference/planning/SDK_MISSING_IMPLEMENTATION_PLAN.md`
- `docs/04-reference/planning/SDK_EXCEL_GAP_ANALYSIS.md`
- `docs/04-reference/planning/TODO_SMART_EHR_COMPAT.md`
- `docs/04-reference/planning/TODO_ICA_SDK_ALIGNMENT.md`

## NOW
1. Keep Communication -> DocumentReference retrieval assertions aligned with canonical claims (`contenthash`, logical `identifier`).
2. Keep docs/JSDoc/API table synchronized for all public methods.
3. Stabilize live E2E traceability docs and scripts for out-of-sandbox execution.
4. Expand live E2E to validate multi-document index update (section accumulation) and section-filtered retrieval with consent/scope constraints.

## NEXT
1. Expand per-method docs coverage to all public methods with concrete UC placement.
2. Strengthen live E2E negative cases (operation outcomes / empty search behavior).
3. Add stricter security-mode test permutations in docs and scripts.

## LATER
1. Extension-only methods remain documented under `docs/02-unid-extensions` (not core scope).
2. Potential split of higher-level orchestration classes by actor profile depth.
