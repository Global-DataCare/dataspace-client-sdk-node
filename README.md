# dataspace-client-sdk-node

Legacy archive (effective 2026-05-19). Target packages are `gdc-sdk-core-ts` and `gdc-sdk-node-ts`. See [LEGACY_STATUS.md](LEGACY_STATUS.md).

Key docs:

- [CHANGELOG.md](CHANGELOG.md)
- [SECURITY.md](SECURITY.md)
- [TEST_CORE.md](TEST_CORE.md)

Node.js SDK to consume async endpoints and to implement distinct use cases.

## Non-Negotiable Conventions

- FHIR SearchParameter names are always canonical FHIR names: lowercase and `-` when defined by FHIR.
- Do not invent camelCase parameter names for claims/search (example: use `Communication.part-of`, never `Communication.partOf`).
- Only propose custom names when a parameter is not defined by FHIR.
- `resource.meta.claims` is mandatory as the canonical interoperable claims carrier and must always travel with the resource.

## Documentation Index

1. [Documentation Navigation (ordered entry point)](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/00-navigation/README.md)
2. [GlobalDataCare GW UC scope docs](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/01-globaldatacare-gw/README.md)
3. [Integrator/internal docs](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/03-integrator-internal/README.md)
4. [UNID extension docs](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/02-unid-extensions/README.md)
5. [Full reference docs](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/04-reference/README.md)

## Testing

### Quick start (anyone can clone and run)

1. Clone both repos side by side:

```bash
git clone <GW_REPO_URL> $HOME/GITS/gdc-workspace/gwtemplate-node-ts
git clone <SDK_REPO_URL> $HOME/GITS/gdc-workspace/dataspace-client-sdk-node
```

2. Prepare GW local demo environment file:

```bash
cd $HOME/GITS/gdc-workspace/gwtemplate-node-ts
# If .env.local-demo does not exist yet:
cp .env.local .env.local-demo
# or:
cp .env.local.txt .env.local-demo
```

3. Start GW local demo in a separate terminal:

```bash
cd $HOME/GITS/gdc-workspace/gwtemplate-node-ts
npm run api:local-demo
```

4. Install and run SDK tests:

```bash
cd $HOME/GITS/gdc-workspace/dataspace-client-sdk-node
npm install
npm test
```

### Live E2E tests (real GW, no mocks)

- Live Use Cases E2E: `npm run test:e2e:live-use-cases`
- Backward-compatible alias: `npm run test:e2e:live-gw-uc5`
- Core coverage summary for memory/thesis justification: [TEST_CORE.md](TEST_CORE.md)
- The live tests skip by default in `npm test`; use env flags to enable them.
- Full command details: [docs/01-globaldatacare-gw/testing/01_E2E_LOCAL_GW_UC5.md](docs/01-globaldatacare-gw/testing/01_E2E_LOCAL_GW_UC5.md)
- Optional debug log: `LIVE_GW_E2E_DEBUG=1` writes sanitized traces to `test-results/`.

Run baseline live UC5 only:

```bash
RUN_LIVE_GW_E2E=1 npm run test:e2e:live-use-cases
```

Run baseline + IPS-through-Communication ingestion E2E:

```bash
RUN_LIVE_GW_E2E=1 RUN_LIVE_GW_E2E_IPS_INGESTION=1 npm run test:e2e:live-use-cases
```

Run extension live checks:

```bash
# Run from the corresponding extension repository/test matrix.
```

Run with debug output:

```bash
RUN_LIVE_GW_E2E=1 RUN_LIVE_GW_E2E_IPS_INGESTION=1 LIVE_GW_E2E_DEBUG=1 npm run test:e2e:live-use-cases
```

### Secure Bearer E2E (Google OIDC) in `compat` mode

This setup validates real Bearer token verification (no insecure bypass) while still allowing compatibility content types.

1. Configure GW (`gwtemplate-node-ts`) to verify Google OIDC ID tokens:

```bash
# gwtemplate-node-ts/.env.local-demo (or your active env file)
AUTH_TOKEN_VERIFIER=google
GOOGLE_CLIENT_ID=<your_google_oauth_client_id>
SECURITY_MODE=compat
DEMO_ALLOW_INSECURE_BEARER=false
JSON_LEGACY=true
FHIR_LEGACY=true
DIDCOMM_PLAIN=true
```

2. Start GW:

```bash
cd $HOME/GITS/gdc-workspace/gwtemplate-node-ts
npm run api:local-demo
```

3. Login with Google CLI (opens browser once) and mint ID token:

```bash
gcloud auth login
export AUTH_BEARER="$(gcloud auth print-identity-token)"
```

4. Decode token audience and use it as `GOOGLE_CLIENT_ID` in GW:

```bash
echo "$AUTH_BEARER" | awk -F. '{print $2}' | base64 --decode 2>/dev/null | jq -r .aud
```

5. Run live E2E from SDK:

```bash
cd $HOME/GITS/gdc-workspace/dataspace-client-sdk-node
RUN_LIVE_GW_E2E=1 \
LIVE_GW_E2E_MODE=dev \
RUN_LIVE_GW_E2E_IPS_INGESTION=1 \
npm run test:e2e:live-use-cases
```

6. One-command helper script (recommended for agents):

```bash
# Prerequisite in user terminal (interactive):
gcloud auth login

cd $HOME/GITS/gdc-workspace/dataspace-client-sdk-node
./scripts/run-secure-e2e-google-user.sh
```

If port `3000` is already in use, set behavior explicitly:

```bash
GW_EXISTING_POLICY=restart ./scripts/run-secure-e2e-google-user.sh   # default
GW_EXISTING_POLICY=reuse   ./scripts/run-secure-e2e-google-user.sh
GW_EXISTING_POLICY=abort   ./scripts/run-secure-e2e-google-user.sh
```

Notes:
- If you use a normal Google user account, prefer `gcloud auth print-identity-token` (without `--audiences`).
- `--audiences` is typically for service-account flows and may fail for user accounts with:
  `Invalid account Type for --audiences. Requires valid service account.`
- In user-token mode, set GW `GOOGLE_CLIENT_ID` to the token `aud` value from step 4.
- If `aud`/`iss`/signature validation fails, GW returns `401 Invalid Bearer token`.
- The SDK normalizes bearer input and always sends `Authorization: Bearer <token>` with a single prefix.
- The helper script starts GW in secure compat mode, waits for ping, runs live E2E, and writes:
  - `test-results/gw-secure-e2e-<timestamp>.log` (GW runtime log)
  - `test-results/live-gw-http-trace-<timestamp>.jsonl` (SDK HTTP request/response trace: method/url/status/error/body)
  - `test-results/live-gw-uc5-debug-<timestamp>.jsonl` (flow-level decoded payloads and poll results)

## TODO and Roadmap

1. [Prompt Next Steps TODO](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/TODO_PROMPT_NEXT_STEPS.md)
2. [SMART EHR Compatibility TODO](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/TODO_SMART_EHR_COMPAT.md)
