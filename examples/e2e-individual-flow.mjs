import { DataspaceNodeClient, createDidcommPlainMessage } from '../dist/index.js';
import {
  ClaimsOrganizationSchemaorg,
  ClaimsPersonSchemaorg,
  ClaimsServiceSchemaorg,
} from 'gdc-common-utils-ts/constants/schemaorg';

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
            [ClaimsOrganizationSchemaorg.addressCountry]: 'ES',
            [ClaimsOrganizationSchemaorg.identifierType]: 'UUID',
            [ClaimsOrganizationSchemaorg.identifierValue]: `family-${Date.now()}`,
            [ClaimsPersonSchemaorg.email]: 'adult1@example.com',
            [ClaimsServiceSchemaorg.category]: ctx.sector,
            [ClaimsServiceSchemaorg.identifier]: 'did:web:api-provider.example.com',
            [ClaimsServiceSchemaorg.serviceType]: 'http://terminology.hl7.org/CodeSystem/v3-ActReason|SRVC',
            [ClaimsServiceSchemaorg.termsOfService]: 'https://provider.example.com/terms',
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
