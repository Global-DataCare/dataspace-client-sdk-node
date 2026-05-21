# Security Tests Runbook (SDK + GW Local)

This runbook standardizes how to run security-focused tests across:
- SDK (`dataspace-client-sdk-node`)
- GW local (`gwtemplate-node-ts`)

Execution context for agents:
- Live GW E2E must run **outside sandbox** (needs local TCP access to `127.0.0.1:3000` and real `gcloud` credentials).
- User performs interactive auth (`gcloud auth login`) in their own terminal first.
- Agent then runs non-interactive commands (`print-identity-token`, GW start, E2E commands).

It covers:
- `insecure` bearer mode (format-only gate)
- `secure` bearer mode (real token verification)
- `compat` and `strict` security modes
- legacy/plain and secure envelope flows (FAPI/JAR/JARM + DIDComm encrypted/signed).

## 1) Token Sources

### A. Google CLI ID token (OIDC): user account vs service account

There are two valid CLI patterns, and they are not interchangeable:

1. **User account login (`gcloud auth login`)**
```bash
gcloud auth print-identity-token
```
- This usually works for local developer sessions.
- `aud` is fixed by Google for that user token shape.
- GW must use that exact `aud` value as `GOOGLE_CLIENT_ID` when `AUTH_TOKEN_VERIFIER=google`.

2. **Service account (or impersonation)**
```bash
gcloud auth print-identity-token --audiences="YOUR_AUDIENCE"
```
or
```bash
gcloud auth print-identity-token \
  --impersonate-service-account="sa-name@project.iam.gserviceaccount.com" \
  --audiences="YOUR_AUDIENCE"
```
- This is the mode that supports explicit `--audiences`.

If you run `--audiences` with a normal user account, you can get:
- `Invalid account Type for --audiences. Requires valid service account.`

Important:
- Google OIDC verification requires `iss`/`aud`/signature to match verifier policy.
- If GW is configured for Firebase verification (`AUTH_TOKEN_VERIFIER=firebase`), use Firebase ID tokens instead.

### B. Firebase ID token (email/password test user)

Use Identity Toolkit REST for test users:

```bash
curl -sS -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$FIREBASE_TEST_EMAIL\",\"password\":\"$FIREBASE_TEST_PASSWORD\",\"returnSecureToken\":true}" \
  | jq -r .idToken
```

This returns an `idToken` typically accepted when GW verifies Firebase Admin tokens.

## 2) Security Mode Matrix

### `SECURITY_MODE=compat`
- Legacy/plain routes can be enabled by flags (`JSON_LEGACY`, `FHIR_LEGACY`, `DIDCOMM_PLAIN`).
- Secure envelope (`application/x-www-form-urlencoded`) is accepted.
- If `DEMO_ALLOW_INSECURE_BEARER=true`, bearer signature validation is bypassed, but header format still must be `Bearer <token>`.

### `SECURITY_MODE=strict`
- Legacy/plain content types are rejected for async `_batch` submissions.
- Secure envelope flow is canonical.
- Bearer verification should be enforced (`DEMO_ALLOW_INSECURE_BEARER=false`).

## 3) GW Local Profiles

### A. Compat + insecure bearer (format gate only)

Set in GW env (`.env.local-demo` or equivalent):

```bash
SECURITY_MODE=compat
DEMO_ALLOW_INSECURE_BEARER=true
JSON_LEGACY=true
FHIR_LEGACY=true
DIDCOMM_PLAIN=true
```

### B. Compat/strict + secure bearer verification

Set:

```bash
SECURITY_MODE=compat   # or strict
DEMO_ALLOW_INSECURE_BEARER=false
```

And configure `AppAuthorizationManager` verifier inputs (issuer/JWKS/audience/provider) to match your token source.

## 4) SDK/GW Test Commands

## Unit/integration baseline (SDK)

```bash
cd $HOME/GITS/gdc-workspace/dataspace-client-sdk-node
npm test
```

Includes bearer normalization unit coverage (`Bearer <token>` single-prefix enforcement).

## Live E2E against local GW (compat + insecure)

```bash
cd $HOME/GITS/gdc-workspace/dataspace-client-sdk-node
RUN_LIVE_GW_E2E=1 \
LIVE_GW_E2E_MODE=dev \
RUN_LIVE_GW_E2E_IPS_INGESTION=1 \
npm run test:e2e:live-use-cases
```

Expected:
- UC5 chain passes.
- Communication IPS ingestion passes.
- Bearer shape test passes (SDK-generated `Authorization` header is valid format).

## Live E2E with secure token verification

1. Obtain token (Google user token, Google service-account token, or Firebase token).
2. Export token:

```bash
export AUTH_BEARER="<real_id_token>"
```

3. Run live E2E:

```bash
cd $HOME/GITS/gdc-workspace/dataspace-client-sdk-node
RUN_LIVE_GW_E2E=1 \
LIVE_GW_E2E_MODE=dev \
RUN_LIVE_GW_E2E_IPS_INGESTION=1 \
npm run test:e2e:live-use-cases
```

Expected secure behavior:
- Valid token: protected routes proceed.
- Invalid token/signature/audience/issuer: `401 Invalid Bearer token`.

## 4.1) Canonical Google OIDC secure flow used in local tests

This is the exact reproducible flow used by agents in local GW runs:

1. **User performs login once (interactive, outside agent):**
```bash
gcloud auth login
```

2. **Agent/user prints token and inspects `aud`:**
```bash
TOKEN="$(gcloud auth print-identity-token)"
echo "$TOKEN" | awk -F. '{print $2}' | base64 --decode 2>/dev/null | jq -r .aud
```

3. **Start GW with Google verifier and matching audience:**
```bash
AUTH_TOKEN_VERIFIER=google \
GOOGLE_CLIENT_ID="<aud-from-step-2>" \
SECURITY_MODE=compat \
DEMO_ALLOW_INSECURE_BEARER=false \
JSON_LEGACY=true \
FHIR_LEGACY=true \
DIDCOMM_PLAIN=true \
npm -C $HOME/GITS/gdc-workspace/gwtemplate-node-ts run api:local-demo
```

4. **Run SDK live E2E with the same token:**
```bash
AUTH_BEARER="$TOKEN" \
RUN_LIVE_GW_E2E=1 \
LIVE_GW_E2E_MODE=dev \
RUN_LIVE_GW_E2E_IPS_INGESTION=1 \
npm -C $HOME/GITS/gdc-workspace/dataspace-client-sdk-node run test:e2e:live-use-cases
```

Pass criteria:
- `LIVE use-cases chain...` PASS
- `LIVE IPS ingestion through Communication...` PASS

### 4.2) One-command script for agents (recommended)

After the user has already authenticated with:

```bash
gcloud auth login
```

Agents can run:

```bash
cd $HOME/GITS/gdc-workspace/dataspace-client-sdk-node
./scripts/run-secure-e2e-google-user.sh
```

If port `3000` is already in use, choose policy with `GW_EXISTING_POLICY`:

```bash
# default: restart existing GW and relaunch with secure settings
GW_EXISTING_POLICY=restart ./scripts/run-secure-e2e-google-user.sh

# reuse currently running GW
GW_EXISTING_POLICY=reuse ./scripts/run-secure-e2e-google-user.sh

# abort if GW is already running
GW_EXISTING_POLICY=abort ./scripts/run-secure-e2e-google-user.sh
```

What this script does:
1. Prints Google user ID token (`gcloud auth print-identity-token`).
2. Decodes `aud` from the token.
3. Starts GW with:
   - `AUTH_TOKEN_VERIFIER=google`
   - `GOOGLE_CLIENT_ID=<decoded aud>`
   - `SECURITY_MODE=compat`
   - `DEMO_ALLOW_INSECURE_BEARER=false`
4. Waits for `GET /host/.well-known/ping`.
5. Runs SDK live E2E with `AUTH_BEARER=<same token>`.
6. Stores trace artifacts:
   - `test-results/gw-secure-e2e-<timestamp>.log` (GW runtime/server log)
   - `test-results/live-gw-http-trace-<timestamp>.jsonl` (SDK transport trace by endpoint)
   - `test-results/live-gw-uc5-debug-<timestamp>.jsonl` (use-case decoded payloads and poll/auth responses)

How to read trace quickly:
- Endpoint-level success/failure:
  - open `live-gw-http-trace-<timestamp>.jsonl`
  - inspect `stage=request|response|error|retry`, `url`, `method`, `status`
- Business-flow decoded payloads:
  - open `live-gw-uc5-debug-<timestamp>.jsonl`
  - inspect `stage` entries (`legal-activation`, `employee-create`, `consent`, `smart-token`, etc.)

## 5) FAPI/JAR/JARM and DIDComm encrypted/signed

For production-like security posture:
- Prefer secure envelope flow (`application/x-www-form-urlencoded`) with nested JOSE.
- Use DIDComm encrypted payloads and detached signatures where applicable.
- Keep `strict` mode for gateways where legacy/plain compatibility is not required.

Practical policy:
- Use `compat` only for migration windows.
- Keep explicit tests for both success and expected `401/415` failures.
