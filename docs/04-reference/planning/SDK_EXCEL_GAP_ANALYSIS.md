# SDK Excel Gap Analysis (Particular + Profesional)

Source file reviewed: `/Users/fernando/Downloads/GDC Listado de Actividades UC y Cierre.xlsx` (sheets `Memoria Casos Uso Particular` and `Memoria Casos Uso Profesional`).

This SDK currently exposes one core client (`DataspaceNodeClient`) and now two orchestration classes:
- `PersonalSdk`
- `ProfessionalSdk`

## Methods From Excel: Equivalent Already Available

- `employee.batchCreate` -> use `createOrganizationEmployee(...)`
- `device.dcr` -> use `activateEmployeeDeviceWithActivationCode(...)` or `activateEmployeeDeviceWithActivationCodeSimple(...)` (includes DCR flow)
- `exchange.token` -> use `requestSmartToken(...)` / `requestSmartTokenSimple(...)`
- `hosting.activate` -> use `activateOrganizationInGatewayFromIcaProof(...)`
- `document.generate` -> use `generateDigitalTwinFromSubjectData(...)` (current equivalent in this SDK)
- `index.sync` -> use `importIpsOrFhirAndUpdateIndex(...)`
- `index.references.upsert` -> use `ingestCommunicationAndUpdateIndex(...)` (current ingestion/update path)

## Methods From Excel: Missing As Named (Need New API Surface)

- `getServiceProviders`
- `getNodeOperators`
- `tenant.updateLicenses`
- `consent.ruleCreate`
- `consent.list`
- `consent.accessRequest`
- `consent.scopeCheck`
- `consent.update`
- `consent.revoke`
- `message.send`
- `message.poll`
- `message.list`
- `evidence.register`
- `audit.events`
- `invitation.create`
- `invitation.list`
- `invitation.accept` (currently only via higher-level activation flows)
- `keys.register` (currently encapsulated in higher-level flows)
- `licenses.listAvailable`
- `employee.createWithInvitation`

## Proposed Usage Until New Methods Exist

- Consent grant flow: `grantProfessionalAccessSimple(...)`
- Communication send/poll: `ingestCommunicationAndUpdateIndex(...)` + `submitAndPoll(...)`
- Individual onboarding flow: `bootstrapIndividualOrganizationSimple(...)`
- Professional onboarding flow: `activateOrganizationInGatewayFromIcaProof(...)` + `createOrganizationEmployee(...)` + `activateEmployeeDeviceWithActivationCodeSimple(...)`

## Generated Traceability Artifact

Raw extraction from Excel method references:
- `docs/sdk-method-gap-from-excel.csv`

