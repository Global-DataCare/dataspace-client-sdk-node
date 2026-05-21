import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DataspaceNodeClient,
  MemoryWalletProvider,
  MultiWalletClient,
  createDidcommPlainMessage,
} from '../dist/index.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('builds canonical v1 and host registry paths', () => {
  const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000' });
  const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };

  assert.equal(
    client.v1Path(ctx, 'individual', 'org.hl7.fhir.api', 'Task', '_batch'),
    '/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.api/Task/_batch',
  );
  assert.equal(
    client.hostRegistryPath({ jurisdiction: 'ES', sector: 'test-network' }, 'Organization', '_activate'),
    '/host/cds-ES/v1/test-network/registry/org.schema/Organization/_activate',
  );
  assert.equal(
    client.identityDeviceDcrPath(ctx),
    '/host/cds-ES/v1/health-care/acme/identity/auth/_dcr',
  );
  assert.equal(
    client.conversionUploadPath(ctx, 'excel-adapter', 'xlsx'),
    '/acme/cds-ES/v1/health-care/conversion/excel-adapter/xlsx/_upload',
  );
});

test('accepts an optional wallet provider without breaking client construction', () => {
  const wallet = new MemoryWalletProvider();
  const client = new DataspaceNodeClient({
    baseUrl: 'http://localhost:3000',
    wallet,
  });

  assert.equal(client.getWallet(), wallet);
});

test('wallet provider supports ES384 sign/verify, compact JWS, and ML-KEM-768 encrypt/decrypt roundtrips', async () => {
  const provider = new MemoryWalletProvider();
  const wallets = new MultiWalletClient(provider);
  const context = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
  const wallet = wallets.forContext(context);
  const publicJwks = await wallet.getPublicJwks();
  const signingJwk = publicJwks.find((jwk) => jwk.use === 'sig');
  const encryptionJwk = publicJwks.find((jwk) => jwk.use === 'enc');

  assert.ok(signingJwk);
  assert.ok(encryptionJwk);
  assert.equal(encryptionJwk.kty, 'OKP', 'encryption JWK must be OKP (ML-KEM)');
  assert.equal(encryptionJwk.crv, 'ML-KEM-768');
  assert.equal(encryptionJwk.alg, 'ML-KEM-768');

  const signature = await wallet.sign('hello-wallet');
  assert.equal(await wallet.verify('hello-wallet', signature, signingJwk), true);
  assert.equal(await wallet.verify('tampered', signature, signingJwk), false);

  const compactJws = await wallet.signCompactJws({
    header: { typ: 'JWT', alg: 'ES384' },
    claims: { sub: 'acme-service', aud: 'https://gw.example.com/token' },
  });
  const [encodedHeader, encodedClaims, encodedSignature] = compactJws.split('.');
  assert.ok(encodedHeader);
  assert.ok(encodedClaims);
  assert.ok(encodedSignature);
  assert.equal(
    await wallet.verify(`${encodedHeader}.${encodedClaims}`, encodedSignature, signingJwk),
    true,
  );

  const ciphertext = await wallet.encrypt('secret-payload', encryptionJwk);
  const plaintext = await wallet.decrypt(ciphertext);
  assert.equal(Buffer.from(plaintext).toString('utf8'), 'secret-payload');
});

test('authenticateBackendPkceAndExchange resolves controller JWK from wallet when omitted', async () => {
  const provider = new MemoryWalletProvider();
  const client = new DataspaceNodeClient({
    baseUrl: 'http://localhost:3000',
    wallet: provider,
  });
  const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
  const [walletJwk] = await provider.getPublicJwks(ctx);
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });

    switch (calls.length) {
      case 1:
        return jsonResponse({ accepted: true }, 202);
      case 2:
        return jsonResponse({ status: 'COMPLETED' }, 200);
      case 3:
        return jsonResponse({ accepted: true }, 202);
      case 4:
        return jsonResponse({ code: 'pkce-code-001' }, 200);
      case 5:
        return jsonResponse({ accepted: true }, 202);
      case 6:
        return jsonResponse({ id_token: 'id-token-001' }, 200);
      case 7:
        return jsonResponse({ accepted: true }, 202);
      default:
        return jsonResponse({
          access_token: 'access-token-001',
          token_type: 'Bearer',
          scope: 'onboarding family-registration',
          expires_in: 3600,
        }, 200);
    }
  };

  try {
    const auth = await client.authenticateBackendPkceAndExchange({
      ctx,
      apiKey: 'api-key-001',
      scopes: ['onboarding', 'family-registration'],
      endpointId: 'wallet-backed-auth',
      codeVerifier: 'verifier-001',
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    assert.equal(auth.status, 'fetched');
    assert.equal(auth.accessToken, 'access-token-001');
    assert.equal(calls[0].url, 'http://localhost:3000/host/cds-ES/v1/health-care/acme/identity/auth/_dcr');

    const dcrPayload = JSON.parse(calls[0].options.body);
    assert.deepEqual(dcrPayload.meta.jws.protected.jwk, walletJwk);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('authenticateBackendSmartStandard signs a private_key_jwt assertion with wallet ES384 key', async () => {
  const provider = new MemoryWalletProvider();
  const walletContext = { tenantId: 'service-a', jurisdiction: 'ES', sector: 'health-care' };
  const [walletJwk] = await provider.getPublicJwks(walletContext);
  const client = new DataspaceNodeClient({
    baseUrl: 'http://localhost:3000',
    wallet: provider,
  });
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return jsonResponse({
      access_token: 'smart-token-001',
      token_type: 'Bearer',
      scope: 'system/*.read system/*.write',
      expires_in: 3600,
    }, 200);
  };

  try {
    const result = await client.authenticateBackendSmartStandard({
      clientId: 'service-a',
      scopes: ['system/*.read', 'system/*.write'],
      walletContext,
    });

    assert.equal(result.status, 'fetched');
    assert.equal(result.profile, 'smart-backend.v1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://localhost:3000/token');

    const tokenRequest = JSON.parse(calls[0].options.body);
    assert.equal(tokenRequest.client_id, 'service-a');
    assert.equal(tokenRequest.grant_type, 'client_credentials');
    assert.ok(typeof tokenRequest.client_assertion === 'string');

    const [encodedHeader, encodedClaims, encodedSignature] = tokenRequest.client_assertion.split('.');
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8'));
    assert.equal(header.alg, 'ES384');
    assert.equal(header.kid, walletJwk.kid);
    assert.equal(claims.iss, 'service-a');
    assert.equal(claims.sub, 'service-a');
    assert.equal(claims.aud, 'http://localhost:3000/token');
    assert.equal(await provider.verify(`${encodedHeader}.${encodedClaims}`, encodedSignature, walletJwk), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('submitAndPoll uses DIDComm plain submit and async poll until non-202', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return jsonResponse({ accepted: true }, 202);
    }
    if (calls.length === 2) {
      return jsonResponse({ thid: 'thid-001', status: 'PENDING' }, 202);
    }
    return jsonResponse({ thid: 'thid-001', status: 'COMPLETED', body: { ok: true } }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'demo-token' });
    const payload = createDidcommPlainMessage({
      iss: 'issuer',
      aud: 'audience',
      thid: 'thid-001',
      body: { data: [] },
    });

    const result = await client.submitAndPoll(
      '/host/cds-ES/v1/test-network/registry/org.schema/Organization/_batch',
      '/host/cds-ES/v1/test-network/registry/org.schema/Organization/_batch-response',
      payload,
      { timeoutMs: 5000, intervalMs: 1 },
    );

    assert.equal(result.submit.status, 202);
    assert.equal(result.poll.status, 200);
    assert.equal(result.poll.attempts, 2);

    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['Content-Type'], 'application/didcomm-plaintext+json');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer demo-token');

    assert.equal(calls[1].options.headers['Content-Type'], 'application/json');
    assert.equal(calls[2].options.headers['Content-Type'], 'application/json');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('normalizes bearer token input and always sends a single Bearer prefix', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ accepted: true }, 202);
  };

  try {
    const client = new DataspaceNodeClient({
      baseUrl: 'http://localhost:3000',
      bearerToken: 'Bearer    token-from-sdk',
    });
    await client.postJson('/host/cds-ES/v1/health-care/identity/oidc/credential', {});
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers.Authorization, 'Bearer token-from-sdk');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('activateOrganizationInGatewayFromIcaProof submits activation and polls to completion', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return jsonResponse({ accepted: true }, 202);
    }
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'id-token-001' });
    const result = await client.activateOrganizationInGatewayFromIcaProof(
      { jurisdiction: 'ES', sector: 'test' },
      {
        vpToken: 'vp-token-001',
      },
      { timeoutMs: 5000, intervalMs: 1 },
    );

    assert.equal(result.submit.status, 202);
    assert.equal(result.poll.status, 200);
    assert.equal(calls[0].url, 'http://localhost:3000/host/cds-ES/v1/test/registry/org.schema/Organization/_activate');
    const submitPayload = JSON.parse(calls[0].options.body);
    assert.equal(submitPayload.body?.data?.[0]?.vp_token, 'vp-token-001');
    assert.equal(submitPayload.body.organizationCredential, undefined);
    assert.equal(submitPayload.body.representativeCredential, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('activateEmployeeDeviceWithActivationCode performs exchange then DCR', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    switch (calls.length) {
      case 1:
        return jsonResponse({ accepted: true }, 202); // exchange submit
      case 2:
        return jsonResponse({ body: { initial_access_token: 'initial-access-001' } }, 200); // exchange poll
      case 3:
        return jsonResponse({ accepted: true }, 202); // dcr submit
      default:
        return jsonResponse({ body: { client_id: 'did:web:device-001' } }, 200); // dcr poll
    }
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.activateEmployeeDeviceWithActivationCode(ctx, {
      activationCode: 'ACT-001',
      idToken: 'user-id-token-001',
      dcrPayload: {
        application_type: 'web',
        client_name: 'Acme Portal',
        jwks: { keys: [{ kid: 'dev-1', kty: 'EC' }] },
        redirect_uris: ['https://app.example.com/callback'],
        token_endpoint_auth_method: 'private_key_jwt',
      },
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    assert.equal(result.initialAccessToken, 'initial-access-001');
    assert.equal(result.exchange.poll.status, 200);
    assert.equal(result.dcr.poll.status, 200);
    assert.equal(calls[0].url, 'http://localhost:3000/host/cds-ES/v1/health-care/acme/identity/auth/_exchange');
    assert.equal(calls[2].url, 'http://localhost:3000/host/cds-ES/v1/health-care/acme/identity/auth/_dcr');
    assert.equal(calls[2].options.headers.Authorization, 'Bearer initial-access-001');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createOrganizationEmployee submits entity Employee batch and polls', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'admin-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.createOrganizationEmployee(
      ctx,
      {
        employeeClaims: {
          '@context': 'org.schema',
          'org.schema.Person.email': 'doctor1@acme.org',
          'org.schema.Person.hasOccupation': 'ISCO-08|2211',
        },
      },
      { timeoutMs: 5000, intervalMs: 1 },
    );

    assert.equal(result.submit.status, 202);
    assert.equal(result.poll.status, 200);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/entity/org.schema/Employee/_batch',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('bootstrapSubjectOrganizationIndex runs registration and confirmation flow', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1 || calls.length === 3) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'controller-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.bootstrapSubjectOrganizationIndex(ctx, {
      registrationPayload: { body: { data: [{ type: 'Family-registration-form-v1.0' }] } },
      confirmationPayload: { body: { data: [{ type: 'Family-order-request-v1.0' }] } },
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    assert.equal(result.registration.poll.status, 200);
    assert.equal(result.confirmation?.poll.status, 200);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_batch',
    );
    assert.equal(
      calls[2].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.schema/Order/_batch',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('bootstrapIndividualOrganizationSimple registers individual org and confirms family order', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options, body: options?.body ? JSON.parse(options.body) : undefined });
    if (calls.length === 1 || calls.length === 3) return jsonResponse({ accepted: true }, 202);
    if (calls.length === 2) {
      return jsonResponse({
        body: { data: [{ meta: { claims: { 'org.schema.Offer.identifier': 'urn:offer:family-001' } } }] },
      }, 200);
    }
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({
      baseUrl: 'http://localhost:3000',
      bearerToken: 'controller-token',
      ctx: { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' },
    });
    const result = await client.bootstrapIndividualOrganizationSimple({
      alternateName: 'ana',
      controllerTelephone: 'tel:+34600111222',
    });

    assert.equal(result.offerId, 'urn:offer:family-001');
    assert.equal(result.registration.poll.status, 200);
    assert.equal(result.confirmation.poll.status, 200);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_batch',
    );
    assert.equal(
      calls[2].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.schema/Order/_batch',
    );
    const registrationClaims = calls[0].body?.body?.data?.[0]?.meta?.claims || {};
    assert.equal(registrationClaims['org.schema.Organization.alternateName'], 'ana');
    assert.equal(registrationClaims['org.schema.Service.category'], 'health-care');
    assert.equal(registrationClaims['org.schema.Person.telephone'], 'tel:+34600111222');
    assert.equal(registrationClaims['org.schema.Person.hasOccupation'], 'RESPRSN');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('bootstrapIndividualOrganizationSimple is only explicit composition of start + confirm helpers', async () => {
  const client = new DataspaceNodeClient({
    baseUrl: 'http://localhost:3000',
    ctx: { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' },
  });

  const calls = [];
  client.startIndividualOrganizationSimple = async (input) => {
    calls.push(['start', input]);
    return {
      registration: { submit: { status: 202, body: {} }, poll: { status: 200, body: {}, attempts: 1 } },
      offerId: 'urn:offer:family-compose-001',
      offerPreview: {},
    };
  };
  client.confirmIndividualOrganizationOrderSimple = async (input) => {
    calls.push(['confirm', input]);
    return { submit: { status: 202, body: {} }, poll: { status: 200, body: {}, attempts: 1 } };
  };

  const result = await client.bootstrapIndividualOrganizationSimple({
    alternateName: 'ana',
    controllerTelephone: 'tel:+34600111222',
    timeoutSeconds: 9,
    intervalSeconds: 2,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'start');
  assert.equal(calls[1][0], 'confirm');
  assert.equal(calls[1][1].offerId, 'urn:offer:family-compose-001');
  assert.equal(calls[1][1].timeoutSeconds, 9);
  assert.equal(calls[1][1].intervalSeconds, 2);
  assert.equal(result.offerId, 'urn:offer:family-compose-001');
});

test('startIndividualOrganizationSimple + confirmIndividualOrganizationOrderSimple support explicit offer acceptance UX', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options, body: options?.body ? JSON.parse(options.body) : undefined });
    if (calls.length === 1 || calls.length === 3) return jsonResponse({ accepted: true }, 202);
    if (calls.length === 2) {
      return jsonResponse({
        body: { data: [{ meta: { claims: { 'org.schema.Offer.identifier': 'urn:offer:family-002', 'org.schema.Offer.price': '0.00' } } }] },
      }, 200);
    }
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({
      baseUrl: 'http://localhost:3000',
      bearerToken: 'controller-token',
      ctx: { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' },
    });
    const started = await client.startIndividualOrganizationSimple({
      alternateName: 'maria',
      controllerEmail: 'maria@example.com',
    });
    assert.equal(started.offerId, 'urn:offer:family-002');
    assert.equal(started.offerPreview.amount, '0.00');

    const confirmed = await client.confirmIndividualOrganizationOrderSimple({
      offerId: started.offerId,
    });
    assert.equal(confirmed.poll.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('importIpsOrFhirAndUpdateIndex submits Composition in individual section', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'smart-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.importIpsOrFhirAndUpdateIndex(ctx, {
      compositionPayload: { body: { data: [{ type: 'Composition-import-request-v1.0' }] } },
      format: 'r4',
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    assert.equal(result.poll.status, 200);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.r4/Composition/_batch',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ingestCommunicationAndUpdateIndex submits Communication in API mode by default', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'smart-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.ingestCommunicationAndUpdateIndex(ctx, {
      communicationPayload: { body: { data: [{ type: 'Communication-ingestion-request-v1.0' }] } },
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    assert.equal(result.poll.status, 200);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.api/Communication/_batch',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ingestCommunicationAndUpdateIndex supports explicit pathFormatSegment', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'smart-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.ingestCommunicationAndUpdateIndex(ctx, {
      communicationPayload: { body: { data: [{ type: 'Communication-ingestion-request-v1.0' }] } },
      pathFormatSegment: 'org.hl7.fhir.r4',
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    assert.equal(result.poll.status, 200);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.r4/Communication/_batch',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ingestCommunicationAndUpdateIndex auto-converts meta.claims to resource for fhir.r4 and preserves resource.meta.claims', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options, body: options?.body ? JSON.parse(options.body) : undefined });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'smart-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    await client.ingestCommunicationAndUpdateIndex(ctx, {
      pathFormatSegment: 'fhir.r4',
      communicationPayload: {
        body: {
          data: [{
            type: 'Communication-ingestion-request-v1.0',
            meta: {
              claims: {
                '@context': 'org.hl7.fhir.r4',
                'Communication.subject': 'did:web:subject.example',
                'Communication.recipient': 'did:web:recipient.example',
                'Communication.sender': 'did:web:sender.example',
                'Communication.text': 'Appointment reminder',
                'Communication.content-reference': 'Appointment/appt-001',
              },
            },
          }],
        },
      },
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    const entry = calls[0].body?.body?.data?.[0];
    assert.equal(entry.resource?.resourceType, 'Communication');
    assert.equal(entry.resource?.payload?.[0]?.contentReference?.reference, 'Appointment/appt-001');
    assert.equal(entry.resource?.meta?.claims?.['Communication.text'], 'Appointment reminder');
    assert.equal(entry.resource?.meta?.claims?.['Communication.sender'], 'did:web:sender.example');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ingestCommunicationAndUpdateIndex accepts r4/api aliases in pathFormatSegment', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'smart-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const resultR4 = await client.ingestCommunicationAndUpdateIndex(ctx, {
      communicationPayload: { body: { data: [{ type: 'Communication-ingestion-request-v1.0' }] } },
      pathFormatSegment: 'fhir.r4',
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });
    const resultApi = await client.ingestCommunicationAndUpdateIndex(ctx, {
      communicationPayload: { body: { data: [{ type: 'Communication-ingestion-request-v1.0' }] } },
      pathFormatSegment: 'api',
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    assert.equal(resultR4.poll.status, 200);
    assert.equal(resultApi.poll.status, 200);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.r4/Communication/_batch',
    );
    assert.equal(
      calls[2].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.api/Communication/_batch',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('upsertRelatedPersonAndPoll submits to RelatedPerson batch/poll endpoints', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'controller-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.upsertRelatedPersonAndPoll(ctx, {
      relatedPersonPayload: {
        body: {
          data: [
            {
              type: 'RelatedPerson-ingestion-request-v1.0',
              meta: {
                claims: {
                  '@context': 'org.hl7.fhir.api',
                  'RelatedPerson.patient': 'did:web:api.acme.org:individual:123',
                  'RelatedPerson.identifier': 'urn:uuid:rel-001',
                  'RelatedPerson.relationship': 'http://terminology.hl7.org/CodeSystem/v3-RoleCode|PRN',
                  'RelatedPerson.name': 'Jane Doe',
                },
              },
            },
          ],
        },
      },
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    assert.equal(result.poll.status, 200);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.api/RelatedPerson/_batch',
    );
    assert.equal(
      calls[1].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.api/RelatedPerson/_batch-response',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('grant professional access submits consent via Consent batch path', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'controller-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.submitAndPoll(
      client.individualConsentR4BatchPath(ctx),
      client.individualConsentR4PollPath(ctx),
      { thid: 'consent-thread-001', body: { data: [{ type: 'Consent-grant-request-v1.0' }] } },
      { timeoutMs: 5000, intervalMs: 1 },
    );

    assert.equal(result.poll.status, 200);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.r4/Consent/_batch',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('grantProfessionalAccessSimple builds canonical consent claims from basic input', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'controller-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.grantProfessionalAccessSimple(ctx, {
      subjectPhone: '+34 600 111 222',
      subjectGivenName: 'Ana Maria',
      actor: { organizationUrl: 'https://hospital.example.com/staff' },
      actorRole: 'Practitioner',
      purpose: 'TREAT',
      actions: ['access', 'read'],
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    assert.equal(result.consent.poll.status, 200);
    assert.equal(result.actorIdentifier, 'did:web:hospital.example.com');
    assert.equal(result.subjectIdentifier, 'urn:person:phone:+34600111222:given:ana-maria');
    assert.equal(result.consentClaims['Consent.actor-role'], 'Practitioner');
    assert.equal(result.consentClaims['Consent.action'], 'access,read');
    assert.equal(typeof result.consentClaims['@id'], 'string');
    assert.equal(result.claimsCid, result.consentClaims['@id']);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.r4/Consent/_batch',
    );

    const submitPayload = JSON.parse(calls[0].options.body);
    assert.equal(submitPayload.body.data[0].type, 'Consent-grant-request-v1.0');
    assert.equal(
      submitPayload.body.data[0].meta.claims['Consent.actor-identifier'],
      'did:web:hospital.example.com',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('requestSmartToken exchanges token in separate step', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return jsonResponse({
      access_token: 'delegated-token-001',
      token_type: 'Bearer',
      scope: 'employee.healthcare.getIndexComposition',
    }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'professional-id-token' });
    const result = await client.requestSmartToken({
      endpointId: 'doctor-1',
      scopes: ['employee.healthcare.getIndexComposition'],
      exchangePayload: { grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange' },
      path: '/token',
    });

    assert.equal(result.status, 'fetched');
    assert.equal(result.accessToken, 'delegated-token-001');
    assert.equal(calls[0].url, 'http://localhost:3000/token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('requestSmartTokenSimple uses identity auth exchange async flow with default ctx', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({
      access_token: 'smart-token-ctx-001',
      token_type: 'Bearer',
      scope: 'employee.healthcare.getIndexComposition',
      expires_in: 3600,
    }, 200);
  };

  try {
    const client = new DataspaceNodeClient({
      baseUrl: 'http://localhost:3000',
      ctx: { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' },
    });

    const result = await client.requestSmartTokenSimple({
      idToken: 'employee-id-token-001',
      scopes: ['employee.healthcare.getIndexComposition'],
      timeoutSeconds: 5,
      intervalSeconds: 0.001,
    });

    assert.equal(result.status, 'fetched');
    assert.equal(result.accessToken, 'smart-token-ctx-001');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'http://localhost:3000/host/cds-ES/v1/health-care/acme/identity/auth/_exchange');
    assert.equal(calls[1].url, 'http://localhost:3000/host/cds-ES/v1/health-care/acme/identity/auth/_exchange-response');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('activateEmployeeDeviceWithActivationCodeSimple uses one-object input and default ctx', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    switch (calls.length) {
      case 1:
        return jsonResponse({ accepted: true }, 202); // exchange submit
      case 2:
        return jsonResponse({ body: { initial_access_token: 'initial-access-simple-001' } }, 200); // exchange poll
      case 3:
        return jsonResponse({ accepted: true }, 202); // dcr submit
      default:
        return jsonResponse({ body: { client_id: 'did:web:device-simple-001' } }, 200); // dcr poll
    }
  };

  try {
    const client = new DataspaceNodeClient({
      baseUrl: 'http://localhost:3000',
      ctx: { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' },
    });
    const result = await client.activateEmployeeDeviceWithActivationCodeSimple({
      activationCode: 'ACT-SIMPLE-001',
      idToken: 'user-id-token-001',
      dcrPayload: {
        application_type: 'web',
        client_name: 'Acme Portal',
        token_endpoint_auth_method: 'private_key_jwt',
      },
      timeoutSeconds: 5,
      intervalSeconds: 0.001,
    });

    assert.equal(result.initialAccessToken, 'initial-access-simple-001');
    assert.equal(calls.length, 4);
    assert.equal(calls[0].url, 'http://localhost:3000/host/cds-ES/v1/health-care/acme/identity/auth/_exchange');
    assert.equal(calls[2].url, 'http://localhost:3000/host/cds-ES/v1/health-care/acme/identity/auth/_dcr');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateDigitalTwinFromSubjectData submits digital twin Composition', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'smart-token' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.generateDigitalTwinFromSubjectData(ctx, {
      compositionPayload: { body: { data: [{ type: 'DigitalTwin-composition-request-v1.0' }] } },
      format: 'r4',
      pollOptions: { timeoutMs: 5000, intervalMs: 1 },
    });

    assert.equal(result.poll.status, 200);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/digitaltwin/org.hl7.fhir.r4/Composition/_batch',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createPhoneReminderTasks builds canonical Task payload with resource.meta.claims and polls to completion', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return jsonResponse({ accepted: true }, 202);
    }
    return jsonResponse({ thid: 'task-reminder-001', status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.createPhoneReminderTasks(
      ctx,
      {
        windows: [{ offsetMinutes: 60, remindAt: '2099-12-31T09:30:00.000Z' }],
        locale: 'es-ES',
        notificationPhone: '+34111222333',
        controllerPhone: '+34111222333',
        subjectRef: 'Person/patient-001',
        ownerRef: 'RelatedPerson/controller-001',
        focusRef: 'Appointment/appt-001',
        subjectDisplay: 'Ana',
        reminderSummary: 'Cita 2099-12-31 10:30',
        description: 'Medication reminder call',
      },
      { timeoutMs: 5000, intervalMs: 1 },
    );

    assert.equal(result.submit.status, 202);
    assert.equal(result.poll.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.api/Task/_batch',
    );
    assert.equal(
      calls[1].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.hl7.fhir.api/Task/_batch-response',
    );

    const payload = JSON.parse(calls[0].options.body);
    const entry = payload?.body?.data?.[0];
    assert.ok(entry);
    assert.equal(entry.type, 'Task');
    assert.ok(entry.resource?.meta?.claims);
    assert.equal(entry.meta, undefined, 'entry.meta should not be used for task claims');

    const claims = entry.resource.meta.claims;
    assert.equal(claims['@context'], 'org.hl7.fhir.api');
    assert.equal(claims.status, 'scheduled');
    assert.equal(claims.subject, 'Person/patient-001');
    assert.equal(claims.owner, 'RelatedPerson/controller-001');
    assert.equal(claims.focus, 'Appointment/appt-001');
    assert.equal(claims['execution-period-start'], '2099-12-31T09:30:00.000Z');
    assert.equal(claims['trigger-type'], 'phone-call');
    assert.equal(claims.channel, 'phone');
    assert.equal(claims['timing-repeat-offset'], '60');
    assert.equal(claims['max-attempts'], '3');
    assert.equal(claims['based-on-display'], 'Cita 2099-12-31 10:30');
    assert.equal(entry.resource.description, 'Medication reminder call');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uploadConversionFile sends multipart with file and fields', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ thid: 'upload-thid-001', status: 'queued' }, 202);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000' });
    const submit = await client.uploadConversionFile({
      path: '/acme/cds-ES/v1/animal-care/conversion/excel-adapter/xlsx/_upload',
      fileName: 'input.xlsx',
      fileContent: new Uint8Array([0x01, 0x02, 0x03]),
      fields: { mode: 'didcomm-plain' },
    });

    assert.equal(submit.status, 202);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, 'POST');

    const body = calls[0].options.body;
    assert.ok(body instanceof FormData);

    const modeValues = body.getAll('mode');
    assert.equal(modeValues.length, 1);
    assert.equal(modeValues[0], 'didcomm-plain');

    const filePart = body.get('file');
    assert.ok(filePart instanceof Blob);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('wallet signDetachedJws produces header..signature compact form verifiable against payload', async () => {
  const provider = new MemoryWalletProvider();
  const wallets = new MultiWalletClient(provider);
  const context = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
  const wallet = wallets.forContext(context);

  const payload = Buffer.from(JSON.stringify({ sub: 'patient-001', vc: { type: ['VerifiableCredential'] } }));
  const detachedJws = await wallet.signDetachedJws({
    header: { typ: 'JWT', alg: 'ES384' },
    payload,
  });

  const parts = detachedJws.split('.');
  assert.equal(parts.length, 3);
  assert.ok(parts[0].length > 0, 'header part must be non-empty');
  assert.equal(parts[1], '', 'payload part must be empty (detached)');
  assert.ok(parts[2].length > 0, 'signature part must be non-empty');

  // Verify: reconstruct the signing input and check with the sig key
  const publicJwks = await wallet.getPublicJwks();
  const signingJwk = publicJwks.find((jwk) => jwk.use === 'sig');
  const [encodedHeader, , encodedSignature] = parts;
  const signingInput = Buffer.concat([
    Buffer.from(`${encodedHeader}.`, 'ascii'),
    payload,
  ]);
  assert.equal(await wallet.verify(signingInput, encodedSignature, signingJwk), true);
});

test('wallet buildCompactJwe / decryptCompactJwe roundtrip with ML-KEM-768 + A256GCM', async () => {
  const provider = new MemoryWalletProvider();
  const wallets = new MultiWalletClient(provider);
  const context = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
  const wallet = wallets.forContext(context);

  const publicJwks = await wallet.getPublicJwks();
  const encryptionJwk = publicJwks.find((jwk) => jwk.use === 'enc');
  assert.ok(encryptionJwk, 'must have enc JWK');
  assert.equal(encryptionJwk.kty, 'OKP');
  assert.equal(encryptionJwk.crv, 'ML-KEM-768');
  assert.equal(encryptionJwk.alg, 'ML-KEM-768');

  const plaintext = 'signed.compact.jws.token.here';
  const jwe = await wallet.buildCompactJwe({ plaintext, recipientJwk: encryptionJwk, contentType: 'JWS' });

  // JWE must be 5 parts
  const parts = jwe.split('.');
  assert.equal(parts.length, 5);

  // Decode and check header
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  assert.equal(header.alg, 'ML-KEM-768');
  assert.equal(header.enc, 'A256GCM');
  assert.equal(header.cty, 'JWS');
  assert.equal(header.kid, encryptionJwk.kid);

  // Decrypt and check plaintext
  const decrypted = await wallet.decryptCompactJwe(jwe);
  assert.equal(Buffer.from(decrypted).toString('utf8'), plaintext);
});

test('submitBatchEncrypted posts compact JWE with content-type application/didcomm-encrypted+json', async () => {
  const provider = new MemoryWalletProvider();
  const walletContext = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
  const client = new DataspaceNodeClient({
    baseUrl: 'http://localhost:3000',
    wallet: provider,
    bearerToken: 'demo-token',
  });

  // Use wallet's own enc key as the "recipient" for the test
  const publicJwks = await provider.getPublicJwks(walletContext);
  const encryptionJwk = publicJwks.find((jwk) => jwk.use === 'enc');
  assert.ok(encryptionJwk);

  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ accepted: true }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const payload = { thid: 'enc-thid-001', body: { data: [] } };
    const result = await client.submitBatchEncrypted(
      '/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_batch',
      payload,
      encryptionJwk,
      walletContext,
    );

    assert.equal(result.status, 202);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_batch',
    );
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['Content-Type'], 'application/didcomm-encrypted+json');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer demo-token');

    // Body must be a compact JWE string (5 base64url parts)
    const body = calls[0].options.body;
    assert.equal(typeof body, 'string');
    const parts = body.split('.');
    assert.equal(parts.length, 5);

    // Decrypt and verify inner JWS contains the original payload
    const wallets = new MultiWalletClient(provider);
    const wallet = wallets.forContext(walletContext);
    const decryptedBytes = await wallet.decryptCompactJwe(body);
    const jws = Buffer.from(decryptedBytes).toString('utf8');
    const jwsParts = jws.split('.');
    assert.equal(jwsParts.length, 3);
    const innerClaims = JSON.parse(Buffer.from(jwsParts[1], 'base64url').toString('utf8'));
    assert.equal(innerClaims.thid, 'enc-thid-001');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('individualFamilyOrganizationSearchPath and BatchPath return canonical paths', () => {
  const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000' });
  const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };

  assert.equal(
    client.individualFamilyOrganizationSearchPath(ctx),
    '/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_search',
  );
  assert.equal(
    client.individualFamilyOrganizationSearchPollPath(ctx),
    '/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_search-response',
  );
  assert.equal(
    client.individualFamilyOrganizationBatchPath(ctx),
    '/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_batch',
  );
  assert.equal(
    client.individualFamilyOrganizationPollPath(ctx),
    '/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_batch-response',
  );
});

test('searchFamilyOrganization returns FamilyOrganizationSummary for already_exists', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  const pollBody = {
    body: {
      data: [{
        type: 'Family-search-result-v1.0',
        meta: {
          claims: {
            'org.schema.FamilyRegistration.status': 'already_exists',
            'org.schema.Organization.alternateName': 'Ana',
            'org.schema.Organization.owner.telephone': '+34600000001',
            'org.schema.Organization.foundingDate': '2010-05-20',
            'org.schema.Offer.identifier': 'offer-uuid-001',
          },
        },
        resource: { id: 'org-uuid-001' },
      }],
    },
  };

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse(pollBody, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'tok' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.searchFamilyOrganization(
      ctx,
      { controllerPhone: '+34600000001', usualname: 'Ana', birthDate: '2010-05-20' },
      { timeoutMs: 5000, intervalMs: 1 },
    );

    assert.ok(result, 'result should not be null');
    assert.equal(result.status, 'already_exists');
    assert.equal(result.organizationId, 'org-uuid-001');
    assert.equal(result.offerId, 'offer-uuid-001');
    assert.equal(result.subjectInfo?.nickname, 'Ana');
    assert.equal(result.subjectInfo?.telephone, '+34600000001');
    assert.equal(result.subjectInfo?.birthDate, '2010-05-20');
    assert.equal(
      calls[0].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_search',
    );
    assert.equal(
      calls[1].url,
      'http://localhost:3000/acme/cds-ES/v1/health-care/individual/org.schema/Organization/_search-response',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('searchFamilyOrganization returns null for not_found status', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({
      body: {
        data: [{
          type: 'Family-search-result-v1.0',
          meta: { claims: { 'org.schema.FamilyRegistration.status': 'not_found' } },
        }],
      },
    }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'tok' });
    const ctx = { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' };
    const result = await client.searchFamilyOrganization(
      ctx,
      { controllerPhone: '+34999999999', usualname: 'Unknown' },
      { timeoutMs: 5000, intervalMs: 1 },
    );
    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('offer helpers extract offerId and preview from activation-like response', () => {
  const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000' });
  const result = {
    poll: {
      body: {
        body: {
          data: [{
            meta: {
              claims: {
                'org.schema.Offer.identifier': 'urn:offer:abc',
                'org.schema.Offer.price': '0.00',
                'org.schema.Offer.priceCurrency': 'EUR',
                'org.schema.Offer.eligibleQuantity.value': 2,
                'org.schema.Offer.itemOffered.name': 'License Tier XS',
                'org.schema.Offer.itemOffered.sku': 'portal-web',
                'org.schema.Offer.acceptedPaymentMethod': 'Stripe',
                'org.schema.Offer.checkoutPageURLTemplate': 'https://pay.example.com/checkout/123',
              },
            },
          }],
        },
      },
    },
  };

  assert.equal(client.getOfferIdFromResponse(result), 'urn:offer:abc');
  const preview = client.getOfferPreviewFromResponse(result);
  assert.equal(preview.offerId, 'urn:offer:abc');
  assert.equal(preview.amount, '0.00');
  assert.equal(preview.currency, 'EUR');
  assert.equal(preview.seats, 2);
  assert.equal(preview.planName, 'License Tier XS');
  assert.equal(preview.sku, 'portal-web');
  assert.equal(preview.paymentMethod, 'Stripe');
  assert.equal(preview.checkoutUrl, 'https://pay.example.com/checkout/123');
});

test('activateOrganizationInGatewaySimple maps single-object input and seconds options', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options, body: options?.body ? JSON.parse(options.body) : undefined });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'tok' });
    const result = await client.activateOrganizationInGatewaySimple({
      jurisdiction: 'ES',
      sector: 'health-care',
      vpToken: 'vp-001',
      serviceProviderUrl: 'https://api.acme.org',
      controllerEmail: 'admin@acme.org',
      controllerRole: 'ISCO-08|1112',
      numberOfMembers: 3,
      timeoutSeconds: 5,
      intervalSeconds: 1,
    });

    assert.equal(result.poll.status, 200);
    assert.equal(calls[0].url, 'http://localhost:3000/host/cds-ES/v1/health-care/registry/org.schema/Organization/_activate');
    const claims = calls[0].body?.body?.data?.[0]?.meta?.claims || {};
    assert.equal(calls[0].body?.body?.data?.[0]?.vp_token, 'vp-001');
    assert.equal(claims.vp_token, undefined);
    assert.equal(claims['org.schema.Organization.numberOfEmployees'], 3);
    assert.equal(claims['org.schema.Service.category'], 'health-care');
    assert.equal(claims['org.schema.Service.identifier'], 'did:web:api.acme.org');
    assert.equal(claims['org.schema.Service.url'], 'https://api.acme.org');
    assert.equal(claims['org.schema.Person.email'], 'admin@acme.org');
    assert.equal(claims['org.schema.Person.hasOccupation'], 'ISCO-08|1112');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('confirmLegalOrganizationOrderSimple builds order payload from single object', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options, body: options?.body ? JSON.parse(options.body) : undefined });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'tok' });
    const result = await client.confirmLegalOrganizationOrderSimple({
      jurisdiction: 'ES',
      sector: 'health-care',
      offerId: 'urn:offer:xyz',
      timeoutSeconds: 5,
      intervalSeconds: 1,
    });

    assert.equal(result.poll.status, 200);
    assert.equal(calls[0].url, 'http://localhost:3000/host/cds-ES/v1/health-care/registry/org.schema/Order/_batch');
    const claims = calls[0].body?.body?.data?.[0]?.meta?.claims || {};
    assert.equal(claims['Order.acceptedOffer.identifier'], 'urn:offer:xyz');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('constructor default ctx allows onboarding calls without passing ctx each time', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options, body: options?.body ? JSON.parse(options.body) : undefined });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202); // activate submit
    if (calls.length === 2) {
      return jsonResponse({
        body: { data: [{ meta: { claims: { 'org.schema.Offer.identifier': 'urn:offer:def' } } }] },
      }, 200); // activate poll
    }
    if (calls.length === 3) return jsonResponse({ accepted: true }, 202); // order submit
    return jsonResponse({ status: 'COMPLETED' }, 200); // order poll
  };

  try {
    const client = new DataspaceNodeClient({
      baseUrl: 'http://localhost:3000',
      bearerToken: 'tok',
      ctx: { tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' },
    });
    const activation = await client.activateOrganizationInGatewayFromIcaProof(undefined, { vpToken: 'vp-ctx-001' }, { timeoutMs: 5000, intervalMs: 1 });
    const offerId = client.getOfferIdFromResponse(activation);
    assert.equal(offerId, 'urn:offer:def');
    const legalOrgOrder = await client.confirmLegalOrganizationOrderSimple({
      jurisdiction: 'ES',
      sector: 'health-care',
      offerId: offerId,
      timeoutSeconds: 5,
      intervalSeconds: 1,
    });
    assert.equal(legalOrgOrder.poll.status, 200);
    assert.equal(calls[0].url, 'http://localhost:3000/host/cds-ES/v1/health-care/registry/org.schema/Organization/_activate');
    assert.equal(calls[2].url, 'http://localhost:3000/host/cds-ES/v1/health-care/registry/org.schema/Order/_batch');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('setTenantId/setJurisdiction/setSector configure default ctx for simple methods', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    if (calls.length === 2) {
      return jsonResponse({
        body: {
          data: [{
            meta: { claims: { 'org.schema.Offer.identifier': 'offer-setter-001' } },
          }],
        },
      }, 200);
    }
    if (calls.length === 3) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'id-token' });
    client.setTenantId('acme').setJurisdiction('ES').setSector('health-care');

    const activation = await client.activateOrganizationInGatewaySimple({
      vpToken: 'vp-token-001',
      serviceProviderDidWeb: 'did:web:api.acme.org',
      controllerEmail: 'owner@acme.org',
      controllerRole: 'ISCO-08|1112',
    });
    const offerId = client.getOfferIdFromResponse(activation);
    assert.equal(offerId, 'offer-setter-001');

    const order = await client.confirmLegalOrganizationOrderSimple({
      offerId,
    });
    assert.equal(order.poll.status, 200);
    assert.equal(calls[0].url, 'http://localhost:3000/host/cds-ES/v1/health-care/registry/org.schema/Organization/_activate');
    assert.equal(calls[2].url, 'http://localhost:3000/host/cds-ES/v1/health-care/registry/org.schema/Order/_batch');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('setContextOrg configures default ctx for simple methods', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    if (calls.length === 2) return jsonResponse({ body: { data: [{ meta: { claims: { 'org.schema.Offer.identifier': 'offer-orgctx-001' } } }] } }, 200);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'id-token' });
    client.setContextOrg({ tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' });
    const activation = await client.activateOrganizationInGatewaySimple({
      vpToken: 'vp-token-001',
      serviceProviderUrl: 'portal.acme.org',
      controllerTelephone: 'tel:+34600111222',
      controllerRole: 'ISCO-08|1112',
    });
    assert.equal(client.getOfferIdFromResponse(activation), 'offer-orgctx-001');
    assert.equal(calls[0].url, 'http://localhost:3000/host/cds-ES/v1/health-care/registry/org.schema/Organization/_activate');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('setDefaultTimeoutSeconds and setDefaultIntervalSeconds apply to simple methods', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    if (calls.length === 2) return jsonResponse({ status: 'PENDING' }, 202);
    return jsonResponse({ status: 'COMPLETED' }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000', bearerToken: 'id-token' });
    client
      .setContextOrg({ tenantId: 'acme', jurisdiction: 'ES', sector: 'health-care' })
      .setDefaultTimeoutSeconds(5)
      .setDefaultIntervalSeconds(0.001);

    const result = await client.activateOrganizationInGatewaySimple({
      vpToken: 'vp-token-001',
      serviceProviderDidWeb: 'did:web:api.acme.org',
      controllerEmail: 'owner@acme.org',
      controllerRole: 'ISCO-08|1112',
    });

    assert.equal(result.poll.status, 200);
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('activateOrganizationInGatewaySimple throws on business-level error in DIDComm entry', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return jsonResponse({ accepted: true }, 202);
    return jsonResponse({
      data: [{
        type: 'Organization-activation-request-v1.0',
        response: {
          status: '400',
          outcome: { issue: [{ diagnostics: 'Missing ICA-issued organization credential.' }] },
        },
      }],
      resourceType: 'Bundle',
      type: 'batch-response',
      total: 1,
    }, 200);
  };

  try {
    const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000' });
    await assert.rejects(
      () => client.activateOrganizationInGatewaySimple({
        jurisdiction: 'ES',
        sector: 'test',
        vpToken: 'vp-token-001',
        serviceProviderDidWeb: 'did:web:api.acme.org',
        controllerEmail: 'owner@acme.org',
        controllerRole: 'ISCO-08|1112',
      }),
      /Missing ICA-issued organization credential\./,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('activateOrganizationInGatewaySimple requires controller identity and role', async () => {
  const client = new DataspaceNodeClient({ baseUrl: 'http://localhost:3000' });
  await assert.rejects(
    () => client.activateOrganizationInGatewaySimple({
      jurisdiction: 'ES',
      sector: 'test',
      vpToken: 'vp-token-001',
      serviceProviderDidWeb: 'did:web:api.acme.org',
      controllerRole: 'ISCO-08|1112',
    }),
    /requires controllerEmail or controllerTelephone/i,
  );
  await assert.rejects(
    () => client.activateOrganizationInGatewaySimple({
      jurisdiction: 'ES',
      sector: 'test',
      vpToken: 'vp-token-001',
      serviceProviderDidWeb: 'did:web:api.acme.org',
      controllerEmail: 'admin@acme.org',
      controllerRole: '',
    }),
    /requires controllerRole/i,
  );
  await assert.rejects(
    () => client.activateOrganizationInGatewaySimple({
      jurisdiction: 'ES',
      sector: 'test',
      vpToken: 'vp-token-001',
      controllerEmail: 'admin@acme.org',
      controllerRole: 'ISCO-08|1112',
    }),
    /requires serviceProviderDidWeb or serviceProviderUrl/i,
  );
});
