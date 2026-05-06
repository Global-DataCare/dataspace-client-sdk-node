/**
 * Example: identity-exchange.v1 backend PKCE auth (Node SDK)
 *
 * Demonstrates authenticateBackendPkceAndExchange — the full B2B auth flow:
 *   1. ICA DCR: bind API key to service public JWK
 *   2. PKCE code: S256 challenge
 *   3. PKCE token: code + verifier → id_token
 *   4. Exchange: id_token → SMART bearer
 *
 * Node.js equivalent of Python connector_sdk `authenticate_backend_pkce_and_exchange`.
 *
 * Prerequisites:
 *   - Tenant org activated in the GW (registry/org.schema/Organization/_activate with ICA VC)
 *   - API key issued by ICA with required scopes
 *   - Service key pair (EC P-384 recommended); only the public JWK is sent to the GW
 *
 * Environment variables:
 *   BASE_URL        GW base URL (e.g. http://localhost:3000)
 *   GW_API_KEY      API key issued by ICA for this service
 *   GW_PUBLIC_JWK   JSON-serialised service public JWK (EC P-384)
 *   TENANT_ID       Tenant org id (e.g. acme)
 *   JURISDICTION    Jurisdiction code (e.g. ES)
 *   SECTOR          Sector code (e.g. health-care)
 *   GW_AUTH_BEARER  (optional) Static bearer for SECURITY_MODE=demo — skips the full flow
 *
 * Run (production flow):
 *   BASE_URL="https://gw.example.com" \
 *   GW_API_KEY="<api-key>" \
 *   GW_PUBLIC_JWK='{"kty":"EC","crv":"P-384","x":"...","y":"..."}' \
 *   TENANT_ID="acme" JURISDICTION="ES" SECTOR="health-care" \
 *   node examples/backend-pkce-auth.mjs
 *
 * Run (demo/local bypass — SECURITY_MODE=demo):
 *   BASE_URL="http://localhost:3000" GW_AUTH_BEARER="demo-token" \
 *   node examples/backend-pkce-auth.mjs
 */

import { DataspaceNodeClient } from '../dist/index.js';

// ---- Demo bypass --------------------------------------------------------
// If GW_AUTH_BEARER is set (SECURITY_MODE=demo), skip the full PKCE flow.
const staticBearer = process.env.GW_AUTH_BEARER;
if (staticBearer) {
  console.log('[demo] Using static GW_AUTH_BEARER — skipping identity-exchange.v1 flow.');
  const client = new DataspaceNodeClient({
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    bearerToken: staticBearer,
  });
  console.log('[demo] Client ready. bearerToken set from env.');
  // eslint-disable-next-line no-process-exit
  process.exit(0);
}

// ---- Production flow ----------------------------------------------------
const baseUrl = process.env.BASE_URL;
const apiKey = process.env.GW_API_KEY;
const publicJwkRaw = process.env.GW_PUBLIC_JWK;

if (!baseUrl || !apiKey || !publicJwkRaw) {
  console.error('Required env vars: BASE_URL, GW_API_KEY, GW_PUBLIC_JWK');
  console.error('Or set GW_AUTH_BEARER for demo/local bypass.');
  process.exit(1);
}

const controllerPublicJwk = JSON.parse(publicJwkRaw);

const ctx = {
  tenantId: process.env.TENANT_ID || 'acme',
  jurisdiction: process.env.JURISDICTION || 'ES',
  sector: process.env.SECTOR || 'health-care',
};

// Client without bearer — auth flow will obtain it.
const client = new DataspaceNodeClient({ baseUrl });

console.log('[auth] Starting identity-exchange.v1 backend PKCE flow...');
console.log('[auth] ctx:', ctx);
console.log('[auth] apiKey prefix:', apiKey.slice(0, 8) + '...');

const auth = await client.authenticateBackendPkceAndExchange({
  ctx,
  apiKey,
  controllerPublicJwk,
  scopes: ['onboarding', 'family-registration', 'license-order'],
  endpointId: 'chatbot-main',
  // codeVerifier: optional — auto-generated as randomUUID() if not provided
  pollOptions: { timeoutMs: 60_000, intervalMs: 2_000 },
});

if (auth.status === 'failed') {
  console.error(`[auth] FAILED at step: ${auth.step}`);
  process.exit(1);
}

console.log(`[auth] Status: ${auth.status}`);  // 'fetched' or 'cached'
console.log(`[auth] Token type: ${auth.tokenType}`);
console.log(`[auth] Scopes granted: ${auth.scopes.join(' ')}`);
console.log(`[auth] Bearer (truncated): ${auth.accessToken.slice(0, 20)}...`);

// ---- Use the bearer for subsequent SDK calls ----------------------------
const authedClient = new DataspaceNodeClient({
  baseUrl,
  bearerToken: auth.accessToken,
});

// Example: submit a family registration draft (DIDComm plain)
// import { createDidcommPlainMessage } from '../dist/index.js';
// const payload = createDidcommPlainMessage({ iss: ..., aud: ..., body: { data: [...] } });
// const result = await authedClient.submitAndPoll(
//   authedClient.individualFamilyOrganizationBatchPath(ctx),
//   authedClient.individualFamilyOrganizationPollPath(ctx),
//   payload,
// );
// console.log(result.poll.status, result.poll.body);

// ---- Cache check --------------------------------------------------------
// On subsequent calls, getCachedBearerToken avoids re-running the flow:
const cached = client.getCachedBearerToken('chatbot-main');
console.log(`[cache] Cached bearer available: ${cached !== undefined}`);
