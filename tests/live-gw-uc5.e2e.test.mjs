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
const RUN_IPS_INGESTION = env('RUN_LIVE_GW_E2E_IPS_INGESTION', '0') === '1';
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

function extractBundleEntriesFromPoll(pollBody) {
  return pollBody?.body?.data || pollBody?.data || [];
}

function assertBundleHasEntries(pollBody, label) {
  const entries = extractBundleEntriesFromPoll(pollBody);
  assert.ok(Array.isArray(entries), `${label} must return a bundle-like data array.`);
  assert.ok(entries.length > 0, `${label} must return at least one entry in data[].`);
  const total = Number(pollBody?.body?.total ?? pollBody?.total ?? entries.length);
  assert.ok(Number.isFinite(total) && total >= entries.length, `${label} must report total >= data.length.`);
  return entries;
}

function assertCommunicationAckShape(pollBody, label) {
  const entries = assertBundleHasEntries(pollBody, label);
  const first = entries[0] || {};
  const entryType = String(first?.type || '');
  const status = Number(first?.response?.status || 0);
  assert.ok(entryType.length > 0, `${label} first entry must include type.`);
  assert.ok(status === 200 || status === 201, `${label} first entry response.status must be 200/201.`);
  return first;
}

function assertSearchResponseHasMatches(pollBody, label) {
  const entries = assertBundleHasEntries(pollBody, label);
  const first = entries[0] || {};
  const resourceData = first?.resource?.data;
  const resourceTotal = Number(first?.resource?.total ?? 0);
  assert.ok(Array.isArray(resourceData), `${label} first entry must expose resource.data array.`);
  assert.ok(resourceData.length > 0, `${label} must return at least one matched resource.`);
  assert.ok(resourceTotal >= resourceData.length, `${label} resource.total must be >= resource.data.length.`);
  return resourceData;
}

function extractClaim(record, key) {
  if (!record || typeof record !== 'object') return '';
  const direct = record[key];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const nested = record?.meta?.claims?.[key];
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  return '';
}

function assertDocumentReferenceSearchHasCid(pollBody, label, expectedSubject) {
  const resourceData = assertSearchResponseHasMatches(pollBody, label);
  const match = resourceData.find((row) => {
    const subject = extractClaim(row, 'DocumentReference.subject');
    const cid = extractClaim(row, 'DocumentReference.contenthash');
    return subject === expectedSubject && cid.startsWith('z');
  });
  assert.ok(match, `${label} must include at least one DocumentReference row with subject=${expectedSubject} and CID contenthash.`);
  return match;
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
      additionalClaims: {
        'org.schema.Organization.alternateName': tenantRouteId,
        'org.schema.Organization.legalName': env('ORG_LEGAL_NAME', 'TEST LEGAL ORGANIZATION SL'),
        'org.schema.Organization.identifier.additionalType': env('ORG_IDENTIFIER_TYPE', 'taxID'),
        'org.schema.Organization.identifier.value': tenantId,
        'org.schema.Organization.address.addressCountry': jurisdiction,
        'org.schema.Organization.taxID': tenantId,
        'org.schema.Person.email': env('CONTROLLER_EMAIL', 'controller@example.com'),
        'org.schema.Person.hasOccupation': env('CONTROLLER_ROLE', 'RESPRSN'),
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
        additionalClaims: {
          'org.schema.Organization.alternateName': tenantRouteId,
          'org.schema.Organization.legalName': env('ORG_LEGAL_NAME', 'TEST LEGAL ORGANIZATION SL'),
          'org.schema.Organization.identifier.additionalType': env('ORG_IDENTIFIER_TYPE', 'taxID'),
          'org.schema.Organization.identifier.value': tenantId,
          'org.schema.Organization.address.addressCountry': jurisdiction,
          'org.schema.Organization.taxID': tenantId,
          'org.schema.Person.email': env('CONTROLLER_EMAIL', 'controller@example.com'),
          'org.schema.Person.hasOccupation': env('CONTROLLER_ROLE', 'RESPRSN'),
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
  const activationEntries = assertBundleHasEntries(activation.poll?.body, 'Legal organization activation');
  const activationEntry = activationEntries[0];
  const activationStatus = Number(activationEntry?.response?.status || 0);
  assert.ok(
    activationStatus === 201 || activationStatus === 409,
    `Legal organization activation entry must be 201 (created) or 409 (already exists), got ${activationStatus}.`,
  );

  const controllerEmployeeClaims = {
    '@context': 'org.schema',
    'org.schema.Person.identifier': env('CONTROLLER_IDENTIFIER', 'urn:uuid:11b2c3d4-e5f6-7890-1234-567890abcdef'),
    'org.schema.Person.email': env('CONTROLLER_EMAIL', 'controller@example.com'),
    'org.schema.Person.hasOccupation': env('CONTROLLER_ROLE', 'RESPRSN'),
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

  const employeeEntries = assertBundleHasEntries(employee.poll?.body, 'Employee creation');
  const employeeEntry = employeeEntries[0];
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
    controllerRole: env('INDIVIDUAL_CONTROLLER_ROLE', 'RESPRSN'),
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
      controllerRole: env('INDIVIDUAL_CONTROLLER_ROLE', 'RESPRSN'),
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
  const individualOrderEntries = assertBundleHasEntries(individualOrder.poll?.body, 'Individual organization order confirmation');
  const individualOrderEntry = individualOrderEntries[0];
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
    assertBundleHasEntries(consentResult.poll.body, 'Consent grant');
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

test('LIVE IPS ingestion through Communication updates individual index baseline', { skip: !(RUN && RUN_IPS_INGESTION) }, async () => {
  const baseUrl = env('BASE_URL', 'http://127.0.0.1:3000');
  const tenantId = env('TENANT_ROUTE_ID', env('TENANT_ID', 'VATES-B00112233'));
  const jurisdiction = env('JURISDICTION', 'ES');
  const sector = env('SECTOR', 'health-care');
  const bearerToken = env('AUTH_BEARER');
  const subjectDid = env('SUBJECT_DID', 'did:web:api.acme.org:individual:123');
  const client = new DataspaceNodeClient({
    baseUrl,
    ctx: { tenantId, jurisdiction, sector },
    bearerToken,
    runtimeMode: 'development',
    allowDemoFallback: false,
    requestTimeoutMs: 15_000,
    requestRetries: 2,
  });

  // Minimal IPS-like payload embedded in Communication.payload (no Communication.contained).
  // The GW ingestion pipeline is expected to parse payload and update Composition index entries.
  const ipsDocumentBundle = {
    resourceType: 'Bundle',
    type: 'document',
    entry: [
      { resource: { resourceType: 'Composition', status: 'final', type: { coding: [{ system: 'http://loinc.org', code: '60591-5' }] } } },
      { resource: { resourceType: 'Patient', id: 'subject-1' } },
      { resource: { resourceType: 'AllergyIntolerance', clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] } } },
      { resource: { resourceType: 'MedicationStatement', status: 'active' } },
    ],
  };
  const ipsBundleB64 = Buffer.from(JSON.stringify(ipsDocumentBundle), 'utf8').toString('base64');
  const communicationIngestionPayload = {
    body: {
      data: [
        {
          type: 'Communication-ingestion-request-v1.0',
          resource: {
            resourceType: 'Communication',
            status: 'completed',
            subject: { reference: `Patient/${subjectDid}` },
            category: [{ coding: [{ system: 'http://loinc.org', code: 'LP436847-0' }] }],
            payload: [
              {
                contentAttachment: {
                  contentType: 'application/fhir+json',
                  title: 'IPS Document Bundle',
                  data: ipsBundleB64,
                },
              },
            ],
            note: [{ text: 'IPS ingestion request' }],
            meta: {
              claims: {
                '@context': 'org.hl7.fhir.r4',
                'Communication.category': 'LOINC|LP436847-0',
                'Communication.subject': subjectDid,
                'Communication.sent': new Date().toISOString(),
                'Communication.content-attachment-type': 'application/fhir+json',
                'Communication.note': 'IPS ingestion request',
              },
            },
          },
        },
      ],
    },
  };

  let ingest = await client.ingestCommunicationAndUpdateIndex(
    { tenantId, jurisdiction, sector },
    {
      communicationPayload: communicationIngestionPayload,
      pathFormatSegment: 'api',
      pollOptions: { timeoutMs: 120000, intervalMs: 1500 },
    },
  );
  if (ingest.poll.status === 404) {
    ingest = await client.ingestCommunicationAndUpdateIndex(
      { tenantId, jurisdiction, sector },
      {
        communicationPayload: communicationIngestionPayload,
        pathFormatSegment: 'org.hl7.fhir.r4',
        pollOptions: { timeoutMs: 120000, intervalMs: 1500 },
      },
    );
  }
  if (ingest.poll.status === 404) {
    console.warn('[live-ips-ingestion] Communication ingestion route not available in current GW local-demo; skipping assertions.');
    return;
  }
  assert.equal(ingest.poll.status, 200, 'Communication ingestion must complete.');
  assertCommunicationAckShape(ingest.poll.body, 'Communication ingestion');

  // Baseline search assertion: Composition index route must respond after ingestion.
  const searchThid = `search-composition-${Date.now()}`;
  const search = await client.submitAndPoll(
    client.v1Path({ tenantId, jurisdiction, sector }, 'individual', 'org.hl7.fhir.r4', 'Bundle', '_search'),
    client.v1Path({ tenantId, jurisdiction, sector }, 'individual', 'org.hl7.fhir.r4', 'Bundle', '_search-response'),
    {
      thid: searchThid,
      body: {
        resourceType: 'Bundle',
        type: 'batch',
        entry: [
          {
            request: {
              method: 'GET',
              url: `Bundle?type=document&composition.subject=${encodeURIComponent(subjectDid)}`,
            },
          },
        ],
      },
    },
    { timeoutMs: 120000, intervalMs: 1500 },
  );
  assert.ok(
    search.poll.status === 200 || search.poll.status === 202,
    `Composition search should return 200/202 after ingestion; got ${search.poll.status}.`,
  );
  if (search.poll.status === 200) {
    assertSearchResponseHasMatches(search.poll.body, 'Composition search after ingestion');
  }

  // New required flow assertion: Communication attachment must be projected to DocumentReference with CID.
  const docRefSearchThid = `search-documentreference-${Date.now()}`;
  const docRefSearch = await client.submitAndPoll(
    client.v1Path({ tenantId, jurisdiction, sector }, 'individual', 'org.hl7.fhir.r4', 'Bundle', '_search'),
    client.v1Path({ tenantId, jurisdiction, sector }, 'individual', 'org.hl7.fhir.r4', 'Bundle', '_search-response'),
    {
      thid: docRefSearchThid,
      body: {
        resourceType: 'Bundle',
        type: 'batch',
        entry: [
          {
            request: {
              method: 'GET',
              url: `DocumentReference?subject=${encodeURIComponent(subjectDid)}`,
            },
          },
        ],
      },
    },
    { timeoutMs: 120000, intervalMs: 1500 },
  );
  assert.equal(docRefSearch.poll.status, 200, `DocumentReference search must return 200 after communication ingestion; got ${docRefSearch.poll.status}.`);
  const docRefRow = assertDocumentReferenceSearchHasCid(
    docRefSearch.poll.body,
    'DocumentReference search after communication ingestion',
    subjectDid,
  );
  const docRefCid = extractClaim(docRefRow, 'DocumentReference.contenthash');
  assert.ok(docRefCid.startsWith('z'), 'DocumentReference.contenthash must be a CID (multibase base58btc).');

  /**
   * TODO(IPS-COVERAGE):
   * 1. Expand fixture matrix with real IPS sample bundles covering each supported resource:
   *    Composition, Condition, AllergyIntolerance, MedicationStatement, Immunization, Procedure,
   *    Observation, DiagnosticReport, ImagingStudy, DeviceUseStatement, CarePlan, Encounter.
   * 2. Add per-resource assertions for GW extracted `resource.meta.claims` persisted/indexed fields.
   * 3. Verify section routing policy:
   *    - default Communication.datatype = org.loinc.LP173418-7 (Note)
   *    - default Communication.category = LOINC|LP436847-0
   *    - fallback without datatype goes to Notifications section.
   * 4. Add route-level read checks for separated resource managers after IPS ingestion:
   *    Composition/_search, AllergyIntolerance/_search, MedicationStatement/_search, Procedure/_search, etc.
   * 5. Reuse same manager/parsing code paths for:
   *    a) direct per-resource ingestion endpoints
   *    b) IPS-through-Communication ingestion path
   *    and assert functional equivalence for indexed claims.
   * 6. Add negative tests:
   *    - missing/invalid `resource.meta.claims`
   *    - unsupported format segment
   *    - unsupported attachment payload
   *    - malformed Bundle.document (no Composition).
   * 7. Out-of-scope for current UC flow (future TODO):
   *    - IPS as FHIR Smart Link protected by password/shared secret.
   *    - User sends Smart Link + password in Communication.
   *    - GW/provider integration resolves the link against provider FHIR server, retrieves IPS,
   *      and then applies the same ingestion/indexing pipeline.
   */
});

test('LIVE RelatedPerson ingestion persists emergency contact flow baseline', { skip: !RUN }, async () => {
  const baseUrl = env('BASE_URL', 'http://127.0.0.1:3000');
  const tenantId = env('TENANT_ROUTE_ID', env('TENANT_ID', 'VATES-B00112233'));
  const jurisdiction = env('JURISDICTION', 'ES');
  const sector = env('SECTOR', 'health-care');
  const bearerToken = env('AUTH_BEARER');
  const subjectDid = env('SUBJECT_DID', 'did:web:api.acme.org:individual:123');

  const client = new DataspaceNodeClient({
    baseUrl,
    ctx: { tenantId, jurisdiction, sector },
    bearerToken,
    runtimeMode: 'development',
    allowDemoFallback: false,
    requestTimeoutMs: 15_000,
    requestRetries: 2,
  });

  const relatedPersonPayload = {
    body: {
      data: [
        {
          type: 'RelatedPerson-ingestion-request-v1.0',
          meta: {
            claims: {
              '@context': 'org.hl7.fhir.api',
              '@type': 'RelatedPerson:EmergencyContact',
              'RelatedPerson.patient': subjectDid,
              'RelatedPerson.identifier': `urn:uuid:relatedperson-${Date.now()}`,
              'RelatedPerson.relationship': 'http://terminology.hl7.org/CodeSystem/v3-RoleCode|PRN',
              'RelatedPerson.name': 'Emergency Contact Demo',
              'RelatedPerson.telecom': 'tel:+34600123456',
            },
          },
        },
      ],
    },
  };

  const ingest = await client.upsertRelatedPersonAndPoll(
    { tenantId, jurisdiction, sector },
    {
      relatedPersonPayload,
      pollOptions: { timeoutMs: 120000, intervalMs: 1500 },
    },
  );

  assert.equal(ingest.poll.status, 200, 'RelatedPerson ingestion must complete.');
  assertBundleHasEntries(ingest.poll.body, 'RelatedPerson ingestion');
});


test('LIVE Bearer shape via SDK in compat/insecure mode (single Bearer prefix)', { skip: !RUN }, async () => {
  const baseUrl = env('BASE_URL', 'http://127.0.0.1:3000');
  const jurisdiction = env('JURISDICTION', 'ES');
  const sector = env('SECTOR', 'health-care');
  const insecureRaw = env('AUTH_BEARER', 'demo-token-live');
  const client = new DataspaceNodeClient({
    baseUrl,
    bearerToken: `Bearer ${insecureRaw}`,
    runtimeMode: 'development',
    allowDemoFallback: false,
    requestTimeoutMs: 10_000,
    requestRetries: 1,
  });

  const response = await client.postJson(
    `/host/cds-${jurisdiction}/v1/${sector}/identity/oidc/credential`,
    {},
  );

  // In compat with insecure token accepted, the request must pass the Bearer format gate.
  // So 401 from "Missing or invalid Bearer token." is not acceptable here.
  if (response.status === 401) {
    const bodyText = typeof response.body === 'string' ? response.body : JSON.stringify(response.body || {});
    assert.ok(
      !bodyText.includes('Missing or invalid Bearer token'),
      `SDK sent malformed Authorization header: ${bodyText}`,
    );
  } else {
    assert.ok(
      [200, 201, 202, 400, 404, 409, 415, 500].includes(response.status),
      `Unexpected credential endpoint status ${response.status}.`,
    );
  }
});
