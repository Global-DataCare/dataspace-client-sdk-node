# E2E Local GW UC5 (Reproducible, No Mocks)

This test runs a real UC5 chain against a locally running GW in demo mode:

1. Legal entity controller activates tenant (`Organization/_activate`).
2. Individual controller bootstraps personal/individual organization (`Organization/_batch` + `Order/_batch`).
3. Consent is created (`Consent/_batch`) with `organization/Composition.rs`.
4. Professional requests SMART token and receives scoped token.

Test file:
- [live-gw-uc5.e2e.test.mjs](/Users/fernando/GITS/gdc-workspace/dataspace-client-sdk-node/tests/live-gw-uc5.e2e.test.mjs)

## Prerequisites

1. Start GW local in demo mode:
```bash
npm -C /Users/fernando/GITS/gdc-workspace/gwtemplate-node-ts run api:local-demo
```

2. Provide ICA proof as either:
- `VP_TOKEN` (preferred, real signed VP), or
- `VP_TOKEN_FILE` pointing to a minimal fixture payload.

Default fixture included:
- [ica-vp-minimal.json](/Users/fernando/GITS/gdc-workspace/dataspace-client-sdk-node/tests/fixtures/ica-vp-minimal.json)
- Built at runtime into unsigned compact JWT only for local demo reproducibility.

3. Use a tenant id aligned with your activation proof (`TENANT_ID`).

## Run

```bash
cd /Users/fernando/GITS/gdc-workspace/dataspace-client-sdk-node
BASE_URL=http://127.0.0.1:3000 \
VP_TOKEN_FILE=./tests/fixtures/ica-vp-minimal.json \
TENANT_ID=VATES-B00000000 \
JURISDICTION=ES \
SECTOR=health-care \
HOST_REGISTRY_SECTOR=test \
PROFESSIONAL_ID_TOKEN='eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJwcm9mZXNzaW9uYWwifQ.demo' \
npm run test:e2e:live-gw-uc5
```

## Notes

- This is a real integration test (no `fetch` mocks).
- `_activate` in this E2E uses `vp_token` in payload (no Bearer header required by the test).
- If `TENANT_ID` does not match activation proof context, downstream tenant-scoped steps can return `404`.
- The scripted scope assertion verifies `organization/Composition.rs` is granted in SMART token response.
