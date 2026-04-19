import test from 'node:test';
import assert from 'node:assert/strict';
import { DataspaceNodeClient, createDidcommPlainMessage } from '../dist/index.js';

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
    client.conversionUploadPath(ctx, 'excel-adapter', 'xlsx'),
    '/acme/cds-ES/v1/health-care/conversion/excel-adapter/xlsx/_upload',
  );
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
