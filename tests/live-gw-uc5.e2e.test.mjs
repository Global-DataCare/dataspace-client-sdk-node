import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataspaceNodeClient } from '../dist/index.js';
import { buildUnsignedVpJwt, loadVpPayloadFixture } from './helpers/vp-token-fixture.mjs';

function env(name, fallback = '') {
  const value = String(process.env[name] ?? fallback).trim();
  return value;
}

const RUN = env('RUN_LIVE_GW_E2E', '0') === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('LIVE UC5 chain on local GW (legal -> individual -> consent -> professional token)', { skip: !RUN }, async () => {
  const baseUrl = env('BASE_URL', 'http://127.0.0.1:3000');
  const vpTokenEnv = env('VP_TOKEN');
  const vpTokenFile = env('VP_TOKEN_FILE', path.join(__dirname, 'fixtures', 'ica-vp-minimal.json'));
  const tenantId = env('TENANT_ID', 'VATES-B00000000');
  const jurisdiction = env('JURISDICTION', 'ES');
  const sector = env('SECTOR', 'health-care');
  const hostSector = env('HOST_REGISTRY_SECTOR', 'test');
  const professionalIdToken = env(
    'PROFESSIONAL_ID_TOKEN',
    'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJwcm9mZXNzaW9uYWwifQ.demo',
  );

  const vpToken = vpTokenEnv || buildUnsignedVpJwt(loadVpPayloadFixture(vpTokenFile));
  assert.ok(vpToken, 'VP_TOKEN or VP_TOKEN_FILE fixture is required for live activation test.');

  const hostCtx = { jurisdiction, sector: hostSector };
  const ctx = { tenantId, jurisdiction, sector };
  const pollOptions = { timeoutMs: 120000, intervalMs: 1500 };

  const ping = await fetch(`${baseUrl}/host/.well-known/ping`);
  assert.equal(ping.status, 200, 'GW ping must be healthy before running live UC5 chain.');

  const legalClient = new DataspaceNodeClient({ baseUrl, ctx });

  const activation = await legalClient.activateOrganizationInGatewayFromIcaProof(
    hostCtx,
    { vpToken },
    pollOptions,
  );
  assert.equal(activation.poll.status, 200, 'Legal organization activation must complete (200).');

  const individual = await legalClient.bootstrapSubjectOrganizationIndex(ctx, {
    registrationPayload: {
      body: {
        data: [
          {
            type: 'Family-registration-form-v1.0',
            meta: {
              claims: {
                '@context': 'org.schema',
                'org.schema.Organization.alternateName': env('INDIVIDUAL_ALTERNATE_NAME', `family-${Date.now()}`),
                'org.schema.Person.telephone': env('INDIVIDUAL_CONTROLLER_PHONE', 'tel:+34600111222'),
              },
            },
          },
        ],
      },
    },
    pollOptions,
  });
  assert.equal(
    individual.registration.poll.status,
    200,
    `Individual organization registration must complete (tenantId='${tenantId}' must exist and be resolvable in GW).`,
  );

  const consent = await legalClient.grantProfessionalAccessSimple(ctx, {
    subjectPhone: env('SUBJECT_PHONE', '+34600111222'),
    subjectGivenName: env('SUBJECT_GIVEN_NAME', 'Ana'),
    actor: { identifier: env('PROFESSIONAL_DID', 'did:web:professional.example.com') },
    actorRole: env('PROFESSIONAL_ROLE', 'Practitioner'),
    purpose: env('CONSENT_PURPOSE', 'TREAT'),
    actions: ['organization/Composition.rs'],
    pollOptions,
  });
  assert.equal(consent.poll.status, 200, 'Consent grant must complete.');

  const smart = await legalClient.requestSmartTokenSimple({
    tenantId,
    jurisdiction,
    sector,
    idToken: professionalIdToken,
    targetEndpoint: legalClient.getEndpointId(
      {
        section: 'organization',
        format: 'org.hl7.fhir.r4',
        resourceType: 'Composition',
        action: '_search',
      },
      env('PROFESSIONAL_DID', 'did:web:professional.example.com'),
    ),
    scopes: ['organization/Composition.rs'],
    timeoutSeconds: 60,
    intervalSeconds: 2,
  });

  assert.ok(smart.accessToken, 'Professional SMART token must be issued.');
  assert.ok(
    Array.isArray(smart.scopes) && smart.scopes.includes('organization/Composition.rs'),
    'SMART token must include organization/Composition.rs scope.',
  );
});
