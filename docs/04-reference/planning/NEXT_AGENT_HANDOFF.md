# NEXT AGENT HANDOFF - dataspace-client-sdk-node

## Objective
Keep SDK docs/code/tests synchronized while extending IPS/index-update E2E flows.

## Mandatory Documentation Rule
SDK method docs must be generated/maintained from JSDoc and include examples.

## Required Work Streams
1. E2E expansion (live GW):
- ingest document A (medications)
- ingest document B (allergy/condition/device)
- verify section accumulation via search
- verify section-filtered retrieval
- verify scope/consent constraints reflected in results

2. Method docs completeness:
- Ensure public methods have JSDoc + example usage.
- Regenerate API tables/reference docs.

3. Traceability docs:
- Keep explicit instructions for reading:
  - GW logs (`gw-secure-e2e-*.log`)
  - SDK HTTP traces (`live-gw-http-trace-*.jsonl`)
  - SDK debug flow files (`live-gw-uc5-debug-*.jsonl`)

## Commands
- `npm run build`
- `npm test`
- `npm run docs:validate`
- `RUN_LIVE_GW_E2E=1 RUN_LIVE_GW_E2E_IPS_INGESTION=1 npm run test:e2e:live-use-cases`

## Acceptance Criteria
- E2E assertions cover multi-document index update and section filters.
- Docs generated and link-checked.
- No mismatch between JSDoc, method docs, and runtime behavior.
