import { DataspaceNodeClient, createDidcommPlainMessage } from '../dist/index.js';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const bearerToken = process.env.AUTH_BEARER || 'demo-token';

const client = new DataspaceNodeClient({ baseUrl, bearerToken });
const ctx = {
  tenantId: process.env.TENANT_ID || 'acme',
  jurisdiction: process.env.JURISDICTION || 'ES',
  sector: process.env.SECTOR || 'health-care',
};

const payload = createDidcommPlainMessage({
  iss: 'adult1@example.com',
  aud: 'did:web:api.acme.org',
  body: {
    data: [
      {
        type: 'Family-registration-form-v1.0',
        meta: {
          claims: {
            '@context': 'org.schema',
            '@type': 'template',
            'org.schema.Organization.address.addressCountry': 'ES',
            'org.schema.Organization.identifier.additionalType': 'UUID',
            'org.schema.Organization.identifier.value': `family-${Date.now()}`,
            'org.schema.Person.email': 'adult1@example.com',
            'org.schema.Service.category': ctx.sector,
            'org.schema.Service.identifier': 'did:web:api-provider.example.com',
            'org.schema.Service.serviceType': 'http://terminology.hl7.org/CodeSystem/v3-ActReason|SRVC',
            'org.schema.Service.termsOfService': 'https://provider.example.com/terms',
          },
        },
      },
    ],
  },
});

const submitPath = client.individualFamilyOrganizationBatchPath(ctx);
const pollPath = client.individualFamilyOrganizationPollPath(ctx);
const result = await client.submitAndPoll(submitPath, pollPath, payload, { timeoutMs: 30000, intervalMs: 2000 });

console.log(JSON.stringify(result, null, 2));
