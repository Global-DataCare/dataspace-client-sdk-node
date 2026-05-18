# SDK API Reference (Detailed)

This is the canonical API reference for integrators.

Start here first for conceptual explanation and actor-by-actor orchestration:
- [SDK_CANONICAL_GUIDE.md](../01-globaldatacare-gw/01_SDK_CANONICAL_GUIDE.md)
- Full list of all public `DataspaceNodeClient` methods:
- [SDK_API_COMPLETE_REFERENCE.md](../04-reference/catalogs/SDK_API_COMPLETE_REFERENCE.md)

Each method page includes:
- purpose and UC step mapping,
- full parameter description,
- endpoint paths used,
- input/output examples,
- common errors,
- test coverage links.

## Method Index

| Method | Primary Use Case Step | Detailed Doc |
|---|---|---|
| `activateOrganizationInGatewayFromIcaProof` | UC onboarding: legal organization activation | [activateOrganizationInGatewayFromIcaProof](./methods/01_activateOrganizationInGatewayFromIcaProof.md) |
| `activateEmployeeDeviceWithActivationCodeSimple` | UC practitioner/controller runtime identity activation (DCR bootstrap) | [activateEmployeeDeviceWithActivationCodeSimple](./methods/02_activateEmployeeDeviceWithActivationCodeSimple.md) |
| `requestSmartTokenSimple` | UC access token issuance after identity activation | [requestSmartTokenSimple](./methods/03_requestSmartTokenSimple.md) |
| `grantProfessionalAccessSimple` | UC consent creation from minimal fields | [grantProfessionalAccessSimple](./methods/04_grantProfessionalAccessSimple.md) |
| `ingestCommunicationAndUpdateIndex` | UC IPS/communication ingestion for index update | [ingestCommunicationAndUpdateIndex](./methods/05_ingestCommunicationAndUpdateIndex.md) |
| `upsertRelatedPersonAndPoll` | UC emergency/non-emergency contacts (RelatedPerson) | [upsertRelatedPersonAndPoll](./methods/06_upsertRelatedPersonAndPoll.md) |
| `submitAndPoll` | Generic async submit+poll helper used by all flows | [submitAndPoll](./methods/07_submitAndPoll.md) |

## Planned methods (missing, to implement with TDD)

See:
- [SDK_MISSING_IMPLEMENTATION_PLAN.md](../04-reference/planning/SDK_MISSING_IMPLEMENTATION_PLAN.md)
