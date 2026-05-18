# SDK API Table - GlobalDataCare GW Scope

This table includes only the methods required for current GlobalDataCare GW UC closure.

| Method | Purpose in UC flow | Category |
|---|---|---|
| `activateOrganizationInGatewayFromIcaProof` | legal organization activation in GW | core |
| `createOrganizationEmployee` | employee creation/license issuance | core |
| `activateEmployeeDeviceWithActivationCodeSimple` | runtime identity activation for controller/professional | core |
| `requestSmartTokenSimple` | obtain operational token for protected operations | core |
| `startIndividualOrganizationSimple` | start personal/family registration | core |
| `confirmIndividualOrganizationOrderSimple` | confirm accepted offer/order | core |
| `bootstrapIndividualOrganizationSimple` | combined start+confirm helper | core |
| `upsertRelatedPersonAndPoll` | register/update emergency and continuity contacts | core |
| `grantProfessionalAccessSimple` | create consent claims and submit Consent | core |
| `ingestCommunicationAndUpdateIndex` | ingest communication/IPS artifacts to update index | core |
| `submitAndPoll` | generic async operation fallback | core helper |
| `pollUntilComplete` | generic poll helper | core helper |

## Excluded from this table

- integrator/internal bootstrap mechanics,
- optional UNID extensions not required for current GW UC closure.

For complete method inventory, see:
- [../../04-reference/README.md](../../04-reference/README.md)

