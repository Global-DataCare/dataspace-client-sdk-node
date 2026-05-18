#!/usr/bin/env bash
set -euo pipefail

# Secure live E2E using Google user OIDC token (no --audiences).
# Prerequisite (interactive, run once in user terminal):
#   gcloud auth login

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$(cd "$ROOT_DIR/.." && pwd)"
GW_DIR="${GW_DIR:-$WORKSPACE_DIR/gwtemplate-node-ts}"
SDK_DIR="${SDK_DIR:-$ROOT_DIR}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
GW_LOG_FILE="$SDK_DIR/test-results/gw-secure-e2e-${RUN_ID}.log"
SDK_DEBUG_FILE="$SDK_DIR/test-results/live-gw-uc5-debug-${RUN_ID}.jsonl"
SDK_HTTP_TRACE_FILE="$SDK_DIR/test-results/live-gw-http-trace-${RUN_ID}.jsonl"
GW_EXISTING_POLICY="${GW_EXISTING_POLICY:-restart}" # abort | reuse | restart

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud is required." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required." >&2
  exit 1
fi

TOKEN="${AUTH_BEARER:-$(gcloud auth print-identity-token)}"
if [[ -z "${TOKEN// }" ]]; then
  echo "ERROR: could not obtain ID token from gcloud." >&2
  exit 1
fi

AUD="$(TOKEN="$TOKEN" node -e "const t=process.env.TOKEN||''; const p=t.split('.')[1]||''; const b=p.replace(/-/g,'+').replace(/_/g,'/'); const pad=(4-(b.length%4))%4; const s=b+'='.repeat(pad); try { const j=JSON.parse(Buffer.from(s,'base64').toString('utf8')); process.stdout.write(String(j.aud||'')); } catch { process.stdout.write(''); }")"
if [[ -z "${AUD// }" ]]; then
  echo "ERROR: could not decode token audience (aud)." >&2
  exit 1
fi

echo "[secure-e2e] Using Google token aud: $AUD"
echo "[secure-e2e] Starting GW in compat + secure mode on $BASE_URL"
echo "[secure-e2e] GW log file: $GW_LOG_FILE"
echo "[secure-e2e] SDK flow debug file: $SDK_DEBUG_FILE"
echo "[secure-e2e] SDK HTTP trace file: $SDK_HTTP_TRACE_FILE"
echo "[secure-e2e] Existing GW policy: $GW_EXISTING_POLICY"

cleanup() {
  if [[ -n "${GW_PID:-}" ]] && kill -0 "$GW_PID" >/dev/null 2>&1; then
    kill "$GW_PID" >/dev/null 2>&1 || true
    wait "$GW_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if curl -fsS "$BASE_URL/host/.well-known/ping" >/dev/null 2>&1; then
  case "$GW_EXISTING_POLICY" in
    abort)
      echo "ERROR: GW already running at $BASE_URL. Set GW_EXISTING_POLICY=reuse or GW_EXISTING_POLICY=restart." >&2
      exit 1
      ;;
    reuse)
      echo "[secure-e2e] Reusing already-running GW at $BASE_URL"
      ;;
    restart)
      echo "[secure-e2e] Restart policy selected: stopping existing GW processes"
      pkill -f "gwtemplate-node-ts.*src/main.ts" >/dev/null 2>&1 || true
      pkill -f "npm run api:local-demo" >/dev/null 2>&1 || true
      sleep 1
      ;;
    *)
      echo "ERROR: invalid GW_EXISTING_POLICY='$GW_EXISTING_POLICY'. Allowed: abort|reuse|restart" >&2
      exit 1
      ;;
  esac
fi

if ! curl -fsS "$BASE_URL/host/.well-known/ping" >/dev/null 2>&1; then
  (
    cd "$GW_DIR"
    AUTH_TOKEN_VERIFIER=google \
    GOOGLE_CLIENT_ID="$AUD" \
    SECURITY_MODE=compat \
    DEMO_ALLOW_INSECURE_BEARER=false \
    JSON_LEGACY=true \
    FHIR_LEGACY=true \
    DIDCOMM_PLAIN=true \
    npm run api:local-demo
  ) >"$GW_LOG_FILE" 2>&1 &
  GW_PID=$!
fi

for _ in $(seq 1 60); do
  if curl -fsS "$BASE_URL/host/.well-known/ping" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "$BASE_URL/host/.well-known/ping" >/dev/null 2>&1; then
  echo "ERROR: GW did not become ready. Check $GW_LOG_FILE" >&2
  exit 1
fi

echo "[secure-e2e] GW is ready. Running SDK live E2E core..."
(
  cd "$SDK_DIR"
  AUTH_BEARER="$TOKEN" \
  BASE_URL="$BASE_URL" \
  LIVE_GW_E2E_DEBUG=1 \
  LIVE_GW_E2E_DEBUG_FILE="$SDK_DEBUG_FILE" \
  SDK_HTTP_TRACE_FILE="$SDK_HTTP_TRACE_FILE" \
  RUN_LIVE_GW_E2E=1 \
  LIVE_GW_E2E_MODE=dev \
  RUN_LIVE_GW_E2E_IPS_INGESTION=1 \
  npm run test:e2e:live-use-cases
)

echo "[secure-e2e] Done."
echo "[secure-e2e] GW log: $GW_LOG_FILE"
echo "[secure-e2e] SDK flow debug: $SDK_DEBUG_FILE"
echo "[secure-e2e] SDK HTTP trace: $SDK_HTTP_TRACE_FILE"
