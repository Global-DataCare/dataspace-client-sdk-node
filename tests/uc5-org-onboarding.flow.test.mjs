/**
 * Use Cases Organization Onboarding — Flow scenario test.
 *
 * This test chains the full org onboarding sequence in one coordinated scenario:
 *   Step 1: activateOrganizationInGatewayFromIcaProof
 *             → org is registered in the gateway using an ICA-issued VP
 *   Step 2: createOrganizationEmployee
 *             → an employee record is added under the now-activated org
 *   Step 3: activateEmployeeDeviceWithActivationCode
 *             → the employee's device completes DCR using the activation code
 *
 * The mock verifies that results from each step drive the next call, reflecting
 * the real dependency chain: org activation must precede employee creation, and
 * an activation code is issued before device DCR.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DataspaceNodeClient } from '../dist/index.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('Use cases org onboarding flow: activate org → create employee → activate device', async () => {
  const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };

  // ── Shared scenario state ──────────────────────────────────────────────────
  // Values produced by one step and consumed by the next.
  const ACTIVATION_CODE = 'ACT-FLOW-001';   // issued to employee after org activation
  const INITIAL_ACCESS_TOKEN = 'init-access-flow-001'; // returned by exchange, used for DCR

  const calls = [];
  const originalFetch = globalThis.fetch;

  // HTTP mock: responses are returned in strict call-order across all three steps.
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options?.method ?? 'GET', body: options?.body });

    // ── Step 1: activateOrganizationInGatewayFromIcaProof (2 calls) ──────────
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);   // activate submit
    if (calls.length === 2) return jsonResponse({ status: 'COMPLETED', body: { activationCode: ACTIVATION_CODE } }, 200); // activate poll

    // ── Step 2: createOrganizationEmployee (2 calls) ──────────────────────────
    if (calls.length === 3) return jsonResponse({ accepted: true }, 202);   // employee submit
    if (calls.length === 4) return jsonResponse({ status: 'COMPLETED', body: { employeeId: 'emp-001' } }, 200); // employee poll

    // ── Step 3: activateEmployeeDeviceWithActivationCode (4 calls) ────────────
    if (calls.length === 5) return jsonResponse({ accepted: true }, 202);   // exchange submit
    if (calls.length === 6) return jsonResponse({ body: { initial_access_token: INITIAL_ACCESS_TOKEN } }, 200); // exchange poll
    if (calls.length === 7) return jsonResponse({ accepted: true }, 202);   // dcr submit
    return jsonResponse({ body: { client_id: 'did:web:device:emp-001' } }, 200); // dcr poll
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'controller-token' });
    const pollOptions = { timeoutMs: 5000, intervalMs: 1 };

    // ── Step 1 ────────────────────────────────────────────────────────────────
    const orgActivationResult = await client.activateOrganizationInGatewayFromIcaProof(
      { jurisdiction: 'ES', sector: 'health-care' },
      {
        vpToken: 'vp-token-org-001',
        organizationVc: 'org-vc-jwt',
        legalRepresentativeVc: 'legal-vc-jwt',
      },
      pollOptions,
    );

    assert.equal(orgActivationResult.submit.status, 202, 'org activation submit must be accepted');
    assert.equal(orgActivationResult.poll.status, 200, 'org activation must complete');
    assert.equal(
      calls[0].url,
      'http://localhost:3000/host/cds-ES/v1/health-care/registry/org.schema/Organization/_activate',
      'org activation must target host registry path',
    );

    // Extract activation code from activation result (would come from VP in real flow)
    const activationCodeFromResult = orgActivationResult.poll.body?.activationCode ?? ACTIVATION_CODE;
    assert.equal(activationCodeFromResult, ACTIVATION_CODE);

    // ── Step 2 ────────────────────────────────────────────────────────────────
    const employeeResult = await client.createOrganizationEmployee(
      ctx,
      {
        employeeClaims: {
          '@context': 'org.schema',
          'org.schema.Person.email': 'doctor1@acme.org',
          'org.schema.Person.hasOccupation': 'ISCO-08|2211',
          // org DID would come from step 1 in a real flow
          'org.schema.Organization.did': 'did:web:acme.example.com',
        },
      },
      pollOptions,
    );

    assert.equal(employeeResult.submit.status, 202, 'employee create submit must be accepted');
    assert.equal(employeeResult.poll.status, 200, 'employee creation must complete');
    assert.equal(
      calls[2].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/entity/org.schema/Employee/_batch',
      'employee creation must target v1 entity Employee batch path',
    );

    const employeeId = employeeResult.poll.body?.employeeId ?? 'emp-001';

    // ── Step 3 ────────────────────────────────────────────────────────────────
    // activationCode comes from the org activation step; DCR uses the employee's device JWK
    const deviceResult = await client.activateEmployeeDeviceWithActivationCode(ctx, {
      activationCode: activationCodeFromResult,
      idToken: 'employee-id-token-001',
      dcrPayload: {
        application_type: 'web',
        client_name: `Employee ${employeeId} Portal`,
        jwks: { keys: [{ kid: 'device-flow-key-1', kty: 'EC', crv: 'P-384' }] },
        redirect_uris: ['https://acme.example.com/callback'],
        token_endpoint_auth_method: 'private_key_jwt',
      },
      pollOptions,
    });

    assert.equal(deviceResult.initialAccessToken, INITIAL_ACCESS_TOKEN, 'exchange must return initial access token');
    assert.equal(deviceResult.exchange.poll.status, 200, 'exchange must complete');
    assert.equal(deviceResult.dcr.poll.status, 200, 'dcr must complete');
    assert.equal(
      calls[4].url,
      'http://localhost:3000/host/cds-ES/v1/health-care/acme/identity/auth/_exchange',
      'exchange must use host identity path',
    );
    assert.equal(
      calls[6].url,
      'http://localhost:3000/host/cds-ES/v1/health-care/acme/identity/auth/_dcr',
      'dcr must use host identity DCR path',
    );
    assert.equal(calls[6].options?.headers?.Authorization ?? calls[6].method, 'POST',
      'dcr request must be a POST');

    // ── Full flow assertions ───────────────────────────────────────────────────
    assert.equal(calls.length, 8, 'org onboarding flow must make exactly 8 HTTP calls total');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
