import { DataspaceNodeClient, createDidcommPlainMessage } from '../dist/index.js';
import { ClaimsPersonSchemaorg } from 'gdc-common-utils-ts/constants/schemaorg';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const bearerToken = process.env.AUTH_BEARER || 'demo-token';

const client = new DataspaceNodeClient({ baseUrl, bearerToken });

const hostCtx = {
  jurisdiction: process.env.JURISDICTION || 'ES',
  sector: process.env.HOST_REGISTRY_SECTOR || 'test-network',
};

const tenantCtx = {
  tenantId: process.env.TENANT_ID || 'acme',
  jurisdiction: process.env.JURISDICTION || 'ES',
  sector: process.env.SECTOR || 'health-care',
};

// 1) Host organization activation
const activatePayload = createDidcommPlainMessage({
  iss: 'did:web:controller.example.com',
  aud: 'did:web:host.example.com',
  body: {
    data: [
      {
        type: 'Organization-activation-request-v1.0',
        meta: {
          claims: {
            '@context': 'org.schema',
            'Organization.identifier': process.env.TENANT_URN || 'urn:example:tenant',
            vp_token: process.env.VP_TOKEN || '<vp-token-placeholder>',
          },
        },
      },
    ],
  },
});

const activateSubmitPath = client.hostRegistryOrganizationActivatePath(hostCtx);
const activatePollPath = client.hostRegistryOrganizationActivatePollPath(hostCtx);
const activation = await client.submitAndPoll(activateSubmitPath, activatePollPath, activatePayload, {
  timeoutMs: 120000,
  intervalMs: 5000,
});

console.log('Activation status:', activation.poll.status);

// 2) Employee creation under tenant
const employeePayload = createDidcommPlainMessage({
  iss: 'did:web:api.acme.org:employee:admin1@acme.org:device:<uuid>',
  aud: 'did:web:api.acme.org',
  body: {
    data: [
      {
        type: 'Employee-registration-request-v1.0',
        meta: {
          claims: {
            '@context': 'org.schema',
            [ClaimsPersonSchemaorg.email]: process.env.EMPLOYEE_EMAIL || 'doctor1@acme.org',
            [ClaimsPersonSchemaorg.hasOccupation]: process.env.EMPLOYEE_ROLE || 'ISCO-08|2211',
          },
        },
      },
    ],
  },
});

const employeeSubmitPath = client.employeeBatchPath(tenantCtx);
const employeePollPath = client.employeePollPath(tenantCtx);
const employee = await client.submitAndPoll(employeeSubmitPath, employeePollPath, employeePayload, {
  timeoutMs: 120000,
  intervalMs: 5000,
});

console.log('Employee status:', employee.poll.status);
