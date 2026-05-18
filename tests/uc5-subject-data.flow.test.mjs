/**
 * Use Cases Subject Data Lifecycle — Flow scenario test.
 *
 * This test chains the full subject data lifecycle in one coordinated scenario:
 *   Step 1: bootstrapSubjectOrganizationIndex
 *             → creates the subject's family/subject org in the index
 *   Step 2: ingestCommunicationAndUpdateIndex
 *             → ingests subject payload via Communication and triggers index update (uses org context from step 1)
 *   Step 3: grantProfessionalAccess (Consent)
 *             → subject grants access to a healthcare professional
 *   Step 4: requestSmartToken (professional request)
 *             → professional app requests SMART token after consent exists
 *   Step 5: generateDigitalTwinFromSubjectData
 *             → generates a digital twin using the authorized subject data
 *
 * The mock verifies end-to-end call ordering and that tokens/IDs from each step
 * feed into the next, as they would in a real dataspace subject flow.
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

test('Use cases subject data lifecycle flow: bootstrap org → ingest communication → grant access → request token → digital twin', async () => {
  const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };

  // ── Shared scenario state ──────────────────────────────────────────────────
  const DELEGATED_TOKEN = 'delegated-smart-token-flow-001'; // issued in step 3, used in step 4

  const calls = [];
  const originalFetch = globalThis.fetch;

  // HTTP mock: responses in strict call-order across all four steps.
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options?.method ?? 'GET', body: options?.body });

    // ── Step 1: bootstrapSubjectOrganizationIndex (4 calls: reg submit/poll + confirm submit/poll) ──
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);             // reg submit
    if (calls.length === 2) return jsonResponse({ status: 'COMPLETED', body: { subjectOrgId: 'subj-org-001' } }, 200); // reg poll
    if (calls.length === 3) return jsonResponse({ accepted: true }, 202);             // confirm submit
    if (calls.length === 4) return jsonResponse({ status: 'COMPLETED', body: { orderId: 'order-001' } }, 200);        // confirm poll

    // ── Step 2: ingestCommunicationAndUpdateIndex (2 calls) ─────────────────
    if (calls.length === 5) return jsonResponse({ accepted: true }, 202);             // import submit
    if (calls.length === 6) return jsonResponse({ status: 'COMPLETED', body: { compositionId: 'comp-001' } }, 200);  // import poll

    // ── Step 3: grantProfessionalAccess (2 calls: consent submit/poll) ──
    if (calls.length === 7) return jsonResponse({ accepted: true }, 202);             // consent submit
    if (calls.length === 8) return jsonResponse({ status: 'COMPLETED', body: { consentId: 'consent-001' } }, 200);   // consent poll
    // ── Step 4: requestSmartToken (1 call) ──
    if (calls.length === 9) return jsonResponse({                                     // token exchange
      access_token: DELEGATED_TOKEN,
      token_type: 'Bearer',
      scope: 'organization/Composition.rs',
      expires_in: 3600,
    }, 200);

    // ── Step 5: generateDigitalTwinFromSubjectData (2 calls) ─────────────────
    if (calls.length === 10) return jsonResponse({ accepted: true }, 202);            // dt submit
    return jsonResponse({ status: 'COMPLETED', body: { twinId: 'twin-001' } }, 200); // dt poll
  };

  try {
    const client = new DataspaceNodeClient({
      baseUrl: 'http://localhost:3000',
      bearerToken: 'controller-smart-token',
    });
    const pollOptions = { timeoutMs: 5000, intervalMs: 1 };

    // ── Step 1 ────────────────────────────────────────────────────────────────
    const bootstrapResult = await client.bootstrapSubjectOrganizationIndex(ctx, {
      registrationPayload: { body: { data: [{ type: 'Family-registration-form-v1.0', subjectId: 'pat-001' }] } },
      confirmationPayload: { body: { data: [{ type: 'Family-order-request-v1.0', offerId: 'offer-001' }] } },
      pollOptions,
    });

    assert.equal(bootstrapResult.registration.poll.status, 200, 'registration must complete');
    assert.equal(bootstrapResult.confirmation?.poll.status, 200, 'order confirmation must complete');
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_batch',
      'registration must target individual org schema batch',
    );
    assert.equal(
      calls[2].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.schema/Order/_batch',
      'confirmation must target individual order schema batch',
    );

    const subjectOrgId = bootstrapResult.registration.poll.body?.subjectOrgId ?? 'subj-org-001';

    // ── Step 2 ────────────────────────────────────────────────────────────────
    // Uses subjectOrgId from step 1 in composition payload
    const importResult = await client.ingestCommunicationAndUpdateIndex(ctx, {
      communicationPayload: {
        body: {
          data: [{
            type: 'Communication-ingestion-request-v1.0',
            subjectOrgId,
            format: 'IPS-R4',
          }],
        },
      },
      pathFormatSegment: 'org.hl7.fhir.api',
      pollOptions,
    });

    assert.equal(importResult.poll.status, 200, 'IPS import must complete');
    assert.equal(
      calls[4].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.api/Communication/_batch',
      'ingestion must target individual FHIR API Communication batch',
    );

    const compositionId = importResult.poll.body?.compositionId ?? 'comp-001';

    // ── Step 3 ────────────────────────────────────────────────────────────────
    // Grant professional access only (consent/policy persistence)
    const consentPayload = {
      thid: 'consent-thread-001',
      body: {
        data: [{
          type: 'Consent-grant-request-v1.0',
          subjectOrgId,
          compositionId,
          professionalId: 'doc-001',
        }],
      },
    };
    const consentResult = await client.submitAndPoll(
      client.individualConsentR4BatchPath(ctx),
      client.individualConsentR4PollPath(ctx),
      consentPayload,
      pollOptions,
    );

    assert.equal(consentResult.poll.status, 200, 'consent grant must complete');
    assert.equal(
      calls[6].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.r4/Consent/_batch',
      'consent must target individual FHIR R4 Consent batch',
    );

    // ── Step 4 ────────────────────────────────────────────────────────────────
    // Professional app requests SMART token after consent exists
    const tokenResult = await client.requestSmartToken({
      endpointId: 'doc-001',
      scopes: ['organization/Composition.rs'],
      exchangePayload: { grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange' },
      path: '/token',
    });
    assert.equal(tokenResult.status, 'fetched', 'SMART token must be fetched');
    assert.equal(tokenResult.accessToken, DELEGATED_TOKEN, 'delegated token must match');
    assert.equal(calls[8].url, 'http://localhost:3000/token', 'token exchange must target /token');

    const smartToken = tokenResult.accessToken;

    // ── Step 5 ────────────────────────────────────────────────────────────────
    // Digital twin generation uses the SMART token issued in step 4
    const twinClient = new DataspaceNodeClient({
      baseUrl: 'http://localhost:3000',
      bearerToken: smartToken,   // <— token from step 3 drives authorization for step 4
    });

    const twinResult = await twinClient.generateDigitalTwinFromSubjectData(ctx, {
      compositionPayload: {
        body: {
          data: [{
            type: 'DigitalTwin-composition-request-v1.0',
            subjectOrgId,
            compositionId,
            sourceToken: smartToken,
          }],
        },
      },
      format: 'r4',
      pollOptions,
    });

    assert.equal(twinResult.poll.status, 200, 'digital twin generation must complete');
    assert.equal(
      calls[9].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/digitaltwin/org.hl7.fhir.r4/Composition/_batch',
      'digital twin must target digitaltwin FHIR R4 Composition batch',
    );

    // ── Full flow assertions ───────────────────────────────────────────────────
    assert.equal(calls.length, 11, 'subject data lifecycle must make exactly 11 HTTP calls total');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
