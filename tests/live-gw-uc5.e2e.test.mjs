import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataspaceNodeClient } from '../dist/index.js';
import { buildUnsignedJwt, buildUnsignedVpJwt, loadVpPayloadFixture } from './helpers/vp-token-fixture.mjs';

function env(name, fallback = '') {
  const value = String(process.env[name] ?? fallback).trim();
  return value;
}

const RUN = env('RUN_LIVE_GW_E2E', '0') === '1';
const DEBUG = env('LIVE_GW_E2E_DEBUG', '0') === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function redactForDebug(value) {
  return JSON.parse(JSON.stringify(value, (key, nestedValue) => {
    if (/token|authorization|secret|password/i.test(key)) {
      return '[redacted]';
    }
    return nestedValue;
  }));
}

function createDebugLogger() {
  if (!DEBUG) {
    return { filePath: '', record: () => {} };
  }
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = env(
    'LIVE_GW_E2E_DEBUG_FILE',
    path.join(__dirname, '..', 'test-results', `live-gw-uc5-debug-${runId}.jsonl`),
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '');
  return {
    filePath,
    record(stage, data) {
      fs.appendFileSync(
        filePath,
        `${JSON.stringify({
          ts: new Date().toISOString(),
          stage,
          ...redactForDebug(data),
        })}\n`,
      );
    },
  };
}

function isNoGwConnectivityError(error) {
  const message = String(error?.message || error || '');
  return /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|network error|connect/i.test(message);
}

test('LIVE use-cases chain on local GW (legal -> individual -> consent -> professional token)', { skip: !RUN }, async () => {
  const debug = createDebugLogger();
  const baseUrl = env('BASE_URL', 'http://127.0.0.1:3000');
  const vpTokenEnv = env('VP_TOKEN');
  const vpTokenFile = env('VP_TOKEN_FILE', path.join(__dirname, 'fixtures', 'ica-vp-minimal.json'));
  const tenantId = env('TENANT_ID', 'VATES-B00112233');
  const tenantRouteId = env('TENANT_ROUTE_ID', tenantId);
  const jurisdiction = env('JURISDICTION', 'ES');
  const sector = env('SECTOR', 'health-care');
  const hostSector = env('HOST_REGISTRY_SECTOR', 'test');
  const individualTermsPdfFile = env('INDIVIDUAL_TERMS_PDF_FILE', '');
  const professionalIdToken = env(
    'PROFESSIONAL_ID_TOKEN',
    buildUnsignedJwt({
      sub: env('PROFESSIONAL_SUB', 'professional'),
      tenant_id: tenantId,
      email: env('PROFESSIONAL_EMAIL', 'professional@example.com'),
    }),
  );
  const professionalDid = env('PROFESSIONAL_DID', 'did:web:api.acme.org');
  const bearerToken = env('AUTH_BEARER', professionalIdToken);

  const vpPayload = loadVpPayloadFixture(vpTokenFile);
  const vpToken = vpTokenEnv || buildUnsignedVpJwt(vpPayload);
  const vcList = Array.isArray(vpPayload?.vp?.verifiableCredential) ? vpPayload.vp.verifiableCredential : [];
  const organizationVc = vcList.find(vc => Array.isArray(vc?.type) && vc.type.includes('OrganizationCredential'));
  const representativeVc = vcList.find(vc => Array.isArray(vc?.type) && vc.type.includes('LegalRepresentativeCredential'));
  assert.ok(vpToken, 'VP_TOKEN or VP_TOKEN_FILE fixture is required for live activation test.');

  const hostCtx = { jurisdiction, sector: hostSector };
  const ctx = { tenantId: tenantRouteId, jurisdiction, sector };
  const requestedMode = env('LIVE_GW_E2E_MODE', 'auto').toLowerCase();
  const forceDemo = requestedMode === 'demo';
  const forceDev = requestedMode === 'dev';
  let demoFallback = false;
  if (forceDemo || forceDev) {
    try {
      const ping = await fetch(`${baseUrl}/host/.well-known/ping`);
      debug.record('ping', { request: { url: `${baseUrl}/host/.well-known/ping`, method: 'GET' }, response: { status: ping.status } });
      if (ping.status !== 200) {
        throw new Error(`GW ping returned ${ping.status}`);
      }
    } catch (error) {
      if (!isNoGwConnectivityError(error)) {
        throw error;
      }
      if (forceDemo) {
        throw error;
      }
      if (forceDev) {
        throw error;
      }
    }
  } else {
    try {
      const ping = await fetch(`${baseUrl}/host/.well-known/ping`);
      debug.record('ping', { request: { url: `${baseUrl}/host/.well-known/ping`, method: 'GET' }, response: { status: ping.status } });
      if (ping.status !== 200) {
        throw new Error(`GW ping returned ${ping.status}`);
      }
    } catch (error) {
      if (!isNoGwConnectivityError(error)) {
        throw error;
      }
      demoFallback = true;
      console.warn(`[live-use-cases] GW unavailable at ${baseUrl}; running in demo fallback mode with synthetic responses.`);
      debug.record('ping-fallback', { error: String(error?.message || error), baseUrl });
    }
  }

  const pollOptions = demoFallback ? { timeoutMs: 3000, intervalMs: 1000 } : { timeoutMs: 120000, intervalMs: 1500 };
  const legalClient = new DataspaceNodeClient({
    baseUrl,
    ctx,
    bearerToken,
    runtimeMode: demoFallback || forceDemo ? 'demo' : 'development',
    allowDemoFallback: demoFallback,
    requestTimeoutMs: demoFallback ? 1000 : 10_000,
    requestRetries: 2,
  });

  const activation = await legalClient.activateOrganizationInGatewayFromIcaProof(
    hostCtx,
    {
      vpToken,
      organizationVc,
      legalRepresentativeVc: representativeVc,
      additionalClaims: {
        'org.schema.Organization.alternateName': tenantRouteId,
        'org.schema.Organization.legalName': env('ORG_LEGAL_NAME', 'TEST LEGAL ORGANIZATION SL'),
        'org.schema.Organization.identifier.additionalType': env('ORG_IDENTIFIER_TYPE', 'taxID'),
        'org.schema.Organization.identifier.value': tenantId,
        'org.schema.Organization.address.addressCountry': jurisdiction,
        'org.schema.Organization.taxID': tenantId,
        'org.schema.Person.email': env('CONTROLLER_EMAIL', 'controller@example.com'),
        'org.schema.Person.hasOccupation': env('CONTROLLER_ROLE', '|RESPRSN'),
        'org.schema.Service.category': sector,
        'org.schema.Service.identifier': env('SERVICE_IDENTIFIER_DID', 'did:web:provider.example.org'),
        'org.schema.Service.url': env('SERVICE_URL', 'https://provider.example.org'),
      },
    },
    pollOptions,
  );
  debug.record('legal-activation', {
    request: {
      hostCtx,
      payload: {
        vpToken,
        organizationVc,
        legalRepresentativeVc: representativeVc,
        additionalClaims: {
          'org.schema.Organization.alternateName': tenantRouteId,
          'org.schema.Organization.legalName': env('ORG_LEGAL_NAME', 'TEST LEGAL ORGANIZATION SL'),
          'org.schema.Organization.identifier.additionalType': env('ORG_IDENTIFIER_TYPE', 'taxID'),
          'org.schema.Organization.identifier.value': tenantId,
          'org.schema.Organization.address.addressCountry': jurisdiction,
          'org.schema.Organization.taxID': tenantId,
          'org.schema.Person.email': env('CONTROLLER_EMAIL', 'controller@example.com'),
          'org.schema.Person.hasOccupation': env('CONTROLLER_ROLE', '|RESPRSN'),
          'org.schema.Service.category': sector,
          'org.schema.Service.identifier': env('SERVICE_IDENTIFIER_DID', 'did:web:provider.example.org'),
          'org.schema.Service.url': env('SERVICE_URL', 'https://provider.example.org'),
        },
      },
      pollOptions,
    },
    response: activation,
  });
  assert.equal(activation.poll.status, 200, 'Legal organization activation must complete (200).');
  const activationEntry = activation.poll?.body?.body?.data?.[0] || activation.poll?.body?.data?.[0];
  const activationStatus = Number(activationEntry?.response?.status || 0);
  assert.ok(
    activationStatus === 201 || activationStatus === 409,
    `Legal organization activation entry must be 201 (created) or 409 (already exists), got ${activationStatus}.`,
  );

  const controllerEmployeeClaims = {
    '@context': 'org.schema',
    'org.schema.Person.identifier': env('CONTROLLER_IDENTIFIER', 'urn:uuid:11b2c3d4-e5f6-7890-1234-567890abcdef'),
    'org.schema.Person.email': env('CONTROLLER_EMAIL', 'controller@example.com'),
    'org.schema.Person.hasOccupation': env('CONTROLLER_ROLE', '|RESPRSN'),
  };
  let employee = await legalClient.createOrganizationEmployee(
    ctx,
    { employeeClaims: controllerEmployeeClaims },
    pollOptions,
  );
  debug.record('employee-create', {
    request: {
      tenantId: tenantRouteId,
      jurisdiction,
      sector,
      employeeClaims: controllerEmployeeClaims,
      pollOptions,
    },
    response: employee,
  });

  const employeeEntry = employee.poll?.body?.body?.data?.[0] || employee.poll?.body?.data?.[0];
  assert.ok(employeeEntry, 'Employee creation must return a DIDComm entry.');
  assert.ok(
    Number(employeeEntry?.response?.status || 0) === 201 || Number(employeeEntry?.response?.status || 0) === 409,
    `Employee creation entry must be 201 (created) or 409 (already exists), got ${Number(employeeEntry?.response?.status || 0)}.`,
  );

  const individualAltName = env('INDIVIDUAL_ALTERNATE_NAME', `family-${Date.now()}`);
  const individualControllerEmail = env('INDIVIDUAL_CONTROLLER_EMAIL', 'controller@example.com');
  const patientSubjectDid = env('SUBJECT_DID', 'did:web:api.acme.org:individual:123');
  const smartProfessionalDid = env('SMART_SUBJECT_DID', 'did:web:api.acme.org:employee:doctor1@acme.org:ISCO-08|2211');
  const smartClientId = env('SMART_CLIENT_ID', 'did:web:api.acme.org:employee:admin1@acme.org:device:demo');
  const pdfBase64 = individualTermsPdfFile
    ? fs.readFileSync(individualTermsPdfFile).toString('base64')
    : Buffer.from('Demo individual terms placeholder PDF bytes').toString('base64');
  const individualStart = await legalClient.startIndividualOrganizationSimple({
    tenantId: tenantRouteId,
    jurisdiction,
    sector,
    alternateName: individualAltName,
    controllerEmail: individualControllerEmail,
    controllerRole: env('INDIVIDUAL_CONTROLLER_ROLE', '|RESPRSN'),
    additionalClaims: {
      'org.schema.Person.email': individualControllerEmail,
      'org.schema.Service.category': sector,
    },
    timeoutSeconds: Math.round(pollOptions.timeoutMs / 1000),
    intervalSeconds: pollOptions.intervalMs / 1000,
  });
  const individualRegistration = individualStart.registration;
  debug.record('individual-registration', {
    request: {
      tenantId: tenantRouteId,
      jurisdiction,
      sector,
      alternateName: individualAltName,
      controllerEmail: individualControllerEmail,
      controllerRole: env('INDIVIDUAL_CONTROLLER_ROLE', '|RESPRSN'),
      pollOptions,
    },
    response: individualRegistration,
  });
  assert.equal(
    individualRegistration.poll.status,
    200,
    `Individual organization registration must complete (tenantRouteId='${tenantRouteId}' must exist and be resolvable in GW).`,
  );
  const individualOrder = await legalClient.confirmIndividualOrganizationOrderSimple({
    tenantId: tenantRouteId,
    jurisdiction,
    sector,
    offerId: individualStart.offerId,
    timeoutSeconds: Math.round(pollOptions.timeoutMs / 1000),
    intervalSeconds: pollOptions.intervalMs / 1000,
  });
  debug.record('individual-order', {
    request: {
      tenantId: tenantRouteId,
      jurisdiction,
      sector,
      offerId: individualStart.offerId,
      pollOptions,
    },
    response: individualOrder,
  });
  assert.equal(individualOrder.poll.status, 200, 'Individual organization order confirmation must complete (200).');
  const individualOrderEntry = individualOrder.poll?.body?.body?.data?.[0] || individualOrder.poll?.body?.data?.[0];
  assert.equal(
    Number(individualOrderEntry?.response?.status || 0),
    201,
    'Individual organization order entry must be successful (201).',
  );
  if (DEBUG && debug.filePath) {
    console.log(`[live-use-cases] debug log written to ${debug.filePath}`);
  }

  const consent = await legalClient.grantProfessionalAccessSimple(ctx, {
    subjectDid: patientSubjectDid,
    subjectPhone: env('SUBJECT_PHONE', '+34600111222'),
    subjectGivenName: env('SUBJECT_GIVEN_NAME', 'Ana'),
    actor: { identifier: professionalDid },
    actorRole: env('PROFESSIONAL_ROLE', 'ISCO-08|2211'),
    purpose: env('CONSENT_PURPOSE', 'TREAT'),
    actions: ['LOINC|48765-2'],
    pollOptions,
  });
  debug.record('consent', {
    request: {
      subjectDid: patientSubjectDid,
      subjectPhone: env('SUBJECT_PHONE', '+34600111222'),
      subjectGivenName: env('SUBJECT_GIVEN_NAME', 'Ana'),
      actor: { identifier: professionalDid },
      actorRole: env('PROFESSIONAL_ROLE', 'ISCO-08|2211'),
      purpose: env('CONSENT_PURPOSE', 'TREAT'),
      actions: ['LOINC|48765-2'],
      pollOptions,
    },
    response: consent,
  });
  const consentResult = consent.consent || consent;
  if (consentResult?.poll) {
    assert.equal(consentResult.poll.status, 200, 'Consent grant must complete.');
  } else {
    assert.fail('Consent grant response did not include a poll result.');
  }

  const smartScope = `organization/Composition.rs?subject=${env('SMART_SCOPE_SUBJECT_DID', patientSubjectDid)}&section=LOINC|48765-2 organization/Consent.cruds`;
  const smartVpToken = env(
    'SMART_VP_TOKEN',
    buildUnsignedVpJwt({
      vp: {
        holder: smartClientId,
        verifiableCredential: [
          {
            type: ['VerifiableCredential', 'EmployeeCredential'],
            credentialSubject: {
              id: smartProfessionalDid,
              hasOccupation: env('SMART_SUBJECT_OCCUPATION', 'ISCO-08|2211'),
            },
          },
        ],
      },
    }),
  );

  const smart = await legalClient.requestSmartTokenSimple({
    tenantId: tenantRouteId,
    jurisdiction,
    sector,
    idToken: professionalIdToken,
    subjectDid: smartProfessionalDid,
    clientId: smartClientId,
    issuer: env('SMART_ISSUER', smartClientId),
    audience: env('SMART_AUDIENCE', 'did:web:api.acme.org'),
    redirectUri: env('SMART_REDIRECT_URI', 'https://app.acme.org/callback'),
    acrValues: env('SMART_ACR_VALUES', 'urn:antifraud:acr:openid4vp:employee'),
    codeChallenge: env('SMART_CODE_CHALLENGE', 'b2MtY2hhbGxlbmdlLWJhc2U2NA'),
    codeChallengeMethod: 'S256',
    vpToken: smartVpToken,
    presentationSubmission: {
      id: 'ps-001',
      definition_id: 'pd-001',
      descriptor_map: [{ id: 'vp-credential', format: 'jwt_vp', path: '$.vp_token' }],
    },
    scopes: [smartScope],
    smartTokenKind: 'openid-smart',
    timeoutSeconds: demoFallback ? 1 : 60,
    intervalSeconds: demoFallback ? 1 : 2,
  });
  debug.record('smart-token', {
    request: {
      tenantId: tenantRouteId,
      jurisdiction,
      sector,
      idToken: professionalIdToken,
      subjectDid: smartProfessionalDid,
      clientId: smartClientId,
      issuer: env('SMART_ISSUER', smartClientId),
      audience: env('SMART_AUDIENCE', 'did:web:api.acme.org'),
      redirectUri: env('SMART_REDIRECT_URI', 'https://app.acme.org/callback'),
      acrValues: env('SMART_ACR_VALUES', 'urn:antifraud:acr:openid4vp:employee'),
      codeChallenge: env('SMART_CODE_CHALLENGE', 'b2MtY2hhbGxlbmdlLWJhc2U2NA'),
      codeChallengeMethod: 'S256',
      vpToken: smartVpToken,
      presentationSubmission: {
        id: 'ps-001',
        definition_id: 'pd-001',
        descriptor_map: [{ id: 'vp-credential', format: 'jwt_vp', path: '$.vp_token' }],
      },
      scopes: [smartScope],
      smartTokenKind: 'openid-smart',
      timeoutSeconds: demoFallback ? 1 : 60,
      intervalSeconds: demoFallback ? 1 : 2,
    },
    response: smart,
  });

  if (smart.statusCode && smart.statusCode >= 400) {
    assert.fail(`SMART token request failed with status ${smart.statusCode}.`);
  }
  assert.ok(smart.accessToken, 'Professional SMART token must be issued.');
  assert.ok(
    Array.isArray(smart.scopes) && smart.scopes.some(scope => scope.startsWith('organization/Composition.rs?subject=')),
    'SMART token must include the pinned organization/Composition.rs scope.',
  );
});
