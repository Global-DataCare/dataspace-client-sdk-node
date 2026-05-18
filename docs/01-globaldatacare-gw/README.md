# 01 - GlobalDataCare GW (UC Scope)

This section contains the docs that should drive the GlobalDataCare GW use cases end-to-end.

## Primary docs

1. [SDK canonical guide](./01_SDK_CANONICAL_GUIDE.md)
2. [Personal flow step by step](./flows/04_PERSONAL_FLOW_STEP_BY_STEP.md)
3. [Practitioner flow step by step](./flows/03_PRACTITIONER_FLOW_STEP_BY_STEP.md)
4. [Controller flow step by step](./flows/02_CONTROLLER_FLOW_STEP_BY_STEP.md)
5. [Legal organization flow step by step](./flows/01_LEGAL_ORGANIZATION_FLOW_STEP_BY_STEP.md)
6. [Live GW UC5 E2E](./testing/01_E2E_LOCAL_GW_UC5.md)
7. [Security tests](./security/01_SECURITY_TESTS.md)
8. [SDK API table (GlobalDataCare GW scope only)](./api/02_SDK_API_TABLE_GDC_SCOPE.md)

## SDK methods in-scope for these UC flows

- `activateOrganizationInGatewayFromIcaProof`
- `createOrganizationEmployee`
- `activateEmployeeDeviceWithActivationCodeSimple`
- `requestSmartTokenSimple`
- `bootstrapIndividualOrganizationSimple` (or start+confirm)
- `upsertRelatedPersonAndPoll`
- `grantProfessionalAccessSimple`
- `ingestCommunicationAndUpdateIndex`
- `submitAndPoll` (generic fallback)

## Out-of-scope for this section

- Appointments and other optional verticals not needed for current GlobalDataCare GW UC closure.
- Internal-only bootstrap/debug mechanics unless explicitly required by your deployment.
