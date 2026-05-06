import { DataspaceNodeClient } from '../dist/index.js';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const bearerToken = process.env.AUTH_BEARER || 'demo-token';
const tenantId = process.env.TENANT_ID || 'acme';
const jurisdiction = process.env.JURISDICTION || 'ES';
const sector = process.env.HOST_REGISTRY_SECTOR || 'test';
const vpToken = process.env.VP_TOKEN || 'demo-vp';

const client = new DataspaceNodeClient({ baseUrl, bearerToken });
client
  .setContextOrg({ tenantId, jurisdiction, sector })
  .setDefaultTimeoutSeconds(Number(process.env.TIMEOUT_SECONDS || 60))
  .setDefaultIntervalSeconds(Number(process.env.INTERVAL_SECONDS || 2));

try {
  const activation = await client.activateOrganizationInGatewaySimple({
    vpToken,
    numberOfMembers: Number(process.env.NUMBER_OF_MEMBERS || 2),
  });

  console.log('[activate] submit=', activation.submit.status, 'poll=', activation.poll.status);

  const offerId = client.getOfferIdFromResponse(activation);
  const offer = client.getOfferPreviewFromResponse(activation);
  console.log('[activate] offerId=', offerId || '<missing>');
  console.log('[activate] offerPreview=', JSON.stringify(offer));

  if (!offerId) {
    console.log('[order] skipped: no offerId in activation response');
    process.exit(0);
  }

  const order = await client.confirmLegalOrganizationOrderSimple({ offerId });
  console.log('[order] submit=', order.submit.status, 'poll=', order.poll.status);
  process.exit(order.poll.status === 200 ? 0 : 1);
} catch (error) {
  console.error('[smoke-legal-org-local] ERROR:', error?.message || error);
  process.exit(1);
}
