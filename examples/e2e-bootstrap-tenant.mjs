import { DataspaceNodeClient } from '../dist/index.js';
import { ClaimsPersonSchemaorg } from 'gdc-common-utils-ts/constants/schemaorg';

function parseCsv(value, fallback = []) {
  const items = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function parseBool(value, fallback = false) {
  if (value === undefined) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function readOptionalJson(envName) {
  const raw = String(process.env[envName] || '').trim();
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function pickDiagnostics(result) {
  return (
    result?.poll?.body?.issues?.issue?.[0]?.diagnostics ||
    result?.poll?.body?.body?.issues?.issue?.[0]?.diagnostics ||
    ''
  );
}

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const authMode = (process.env.AUTH_MODE || 'demo').trim().toLowerCase();
const hostCtx = {
  jurisdiction: process.env.JURISDICTION || 'ES',
  sector: process.env.HOST_REGISTRY_SECTOR || 'test',
};
const tenantCtx = {
  tenantId: process.env.TENANT_ID || 'acme',
  jurisdiction: process.env.JURISDICTION || 'ES',
  sector: process.env.SECTOR || 'health-care',
};

const pollOptions = {
  timeoutMs: Number(process.env.POLL_TIMEOUT_MS || 120000),
  intervalMs: Number(process.env.POLL_INTERVAL_MS || 2000),
};

async function resolveClient() {
  if (authMode === 'pkce') {
    const authClient = new DataspaceNodeClient({ baseUrl });
    const auth = await authClient.authenticateBackendPkceAndExchange({
      ctx: tenantCtx,
      apiKey: requiredEnv('GW_API_KEY'),
      controllerPublicJwk: readOptionalJson('GW_CONTROLLER_PUBLIC_JWK_SIGN') || readOptionalJson('GW_PUBLIC_JWK'),
      scopes: parseCsv(process.env.GW_AUTH_SCOPES, ['onboarding', 'employee.write']),
      endpointId: process.env.GW_AUTH_ENDPOINT_ID || 'e2e-bootstrap',
      codeVerifier: process.env.GW_PKCE_CODE_VERIFIER,
      pollOptions,
    });
    if (auth.status === 'failed' || !auth.accessToken) {
      throw new Error(`PKCE auth failed at step ${auth.step || 'unknown'}.`);
    }
    return new DataspaceNodeClient({ baseUrl, bearerToken: auth.accessToken });
  }

  return new DataspaceNodeClient({
    baseUrl,
    bearerToken: process.env.AUTH_BEARER || 'demo-token',
  });
}

async function main() {
  const client = await resolveClient();

  const activation = await client.activateOrganizationInGatewayFromIcaProof(
    hostCtx,
    {
      vpToken: requiredEnv('VP_TOKEN'),
      organizationVc: process.env.ORGANIZATION_VC_JWT,
      legalRepresentativeVc: process.env.LEGAL_REPRESENTATIVE_VC_JWT,
    },
    pollOptions,
  );

  console.log(`[activate] http=${activation.poll.status}`);
  if (activation.poll.status !== 200) {
    const diagnostics = pickDiagnostics(activation);
    throw new Error(`Organization activation failed (status=${activation.poll.status})${diagnostics ? `: ${diagnostics}` : ''}`);
  }

  if (!parseBool(process.env.CREATE_CONTROLLER_EMPLOYEE, false)) {
    console.log('[employee] skipped (CREATE_CONTROLLER_EMPLOYEE=false)');
    return;
  }

  const employee = await client.createOrganizationEmployee(
    tenantCtx,
    {
      employeeClaims: {
        '@context': 'org.schema',
        [ClaimsPersonSchemaorg.email]: process.env.CONTROLLER_EMAIL || 'controller@example.com',
        [ClaimsPersonSchemaorg.hasOccupation]: process.env.CONTROLLER_ROLE || 'ISCO-08|1342',
      },
    },
    pollOptions,
  );

  console.log(`[employee] http=${employee.poll.status}`);
  if (employee.poll.status !== 200) {
    const diagnostics = pickDiagnostics(employee);
    throw new Error(`Controller employee creation failed (status=${employee.poll.status})${diagnostics ? `: ${diagnostics}` : ''}`);
  }
}

main().catch((error) => {
  console.error('[e2e-bootstrap-tenant] ERROR:', error?.message || error);
  process.exit(1);
});
