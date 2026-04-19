import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { DataspaceNodeClient } from '../dist/index.js';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const bearerToken = process.env.AUTH_BEARER || 'demo-token';

const tenantId = process.env.TENANT_ID || 'acme';
const jurisdiction = process.env.JURISDICTION || 'ES';
const sector = process.env.SECTOR || 'animal-care';
const softwareId = process.env.SOFTWARE_ID || 'excel-adapter';
const sourceFormat = process.env.SOURCE_FORMAT || 'xlsx';
const filePath = process.env.SOURCE_FILE;

if (!filePath) {
  throw new Error('Missing SOURCE_FILE env var (path to excel/csv file).');
}

const client = new DataspaceNodeClient({ baseUrl, bearerToken });
const ctx = { tenantId, jurisdiction, sector };

const uploadPath = client.conversionUploadPath(ctx, softwareId, sourceFormat);
const pollPath = client.conversionUploadPollPath(ctx, softwareId, sourceFormat);

const fileName = basename(filePath);
const bytes = await readFile(filePath);

const submit = await client.uploadConversionFile({
  path: uploadPath,
  fileName,
  fileContent: bytes,
  fields: {
    // Optional provider-specific fields. Keep/remove depending on DataConv API contract.
    mode: process.env.CONVERSION_MODE || 'didcomm-plain',
  },
});

console.log('Upload submit:', JSON.stringify(submit, null, 2));

const thid =
  process.env.THID ||
  submit.body?.thid ||
  submit.body?.body?.thid ||
  submit.body?.data?.thid;

if (!thid) {
  console.log('No thid found in upload response. If your DataConv API is synchronous, stop here.');
  process.exit(0);
}

const poll = await client.pollUntilComplete(pollPath, { thid }, { timeoutMs: 120000, intervalMs: 5000 });
console.log('Upload poll:', JSON.stringify(poll, null, 2));
