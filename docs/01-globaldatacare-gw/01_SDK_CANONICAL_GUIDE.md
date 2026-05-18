# SDK Canonical Guide

This is the single entry point to understand:
1. what each SDK method does,
2. when to use it and why,
3. how complete end-to-end UC orchestration works actor by actor.

## 1) Plain-language glossary

### What is the "identity exchange async flow"?

It is the GW asynchronous process used to transform an identity proof token into an operational token.

Why it exists:
- token issuance in GW is asynchronous (submit + poll),
- policy checks and identity checks happen server-side before final token issuance.

When to use it:
- whenever you need an operational bearer token to call protected business endpoints.

What method uses it:
- `requestSmartTokenSimple(...)`.

Practical sequence:
1. send `idToken` + scopes to `identity/auth/_exchange`,
2. poll `identity/auth/_exchange-response` until done,
3. read final `access_token` and use it as bearer for business APIs.

### What is DCR in this SDK?

Dynamic Client Registration (DCR) here means binding device/client public keys to runtime identity.

When to use it:
- onboarding of controller/member/professional devices before requesting SMART tokens.

Main method:
- `activateEmployeeDeviceWithActivationCodeSimple(...)`.

### Why `submitAndPoll` exists?

GW endpoints are async. `submitAndPoll` abstracts:
- submit request,
- poll response endpoint until final status.

Use it directly only when there is no typed helper.

## 2) Complete API table (what/when/why)

For the detailed, method-by-method references (params, input/output examples, errors):
- [SDK detailed API index](../sdk-api/00_README.md)

For quick status and coverage view:
- [SDK API table](../04-reference/catalogs/SDK_API_TABLE.md)

## 3) End-to-end orchestration by actor

### Actor A: Legal organization controller

Goal: activate organization in GW and enable runtime operations.

Steps:
1. `activateOrganizationInGatewayFromIcaProof(...)`
Payload contract note:
- activation proof is sent as `body.data[].vp_token` (or `body.data[].vp`), not duplicated in side-fields.
2. issue employee activation codes (`createOrganizationEmployee(...)` as needed)
3. use activation code from `org.schema.IndividualProduct.serialNumber` to run
`activateEmployeeDeviceWithActivationCodeSimple(...)`:
this executes `Token/_exchange` (`id_token` -> `initial_access_token`) and then `Device/_dcr`
to bind wallet key(s) to the license serial number and controller email.
4. get operational token:
`requestSmartTokenSimple(...)`

### Actor B: Professional/member

Goal: become operational and request authorized data access.

Steps:
1. receive activation code
2. `activateEmployeeDeviceWithActivationCodeSimple(...)` (`Token/_exchange` + `Device/_dcr`)
3. `requestSmartTokenSimple(...)`
4. perform authorized operations (search/read/update flows)

### Actor C: Individual/controller of individual

Goal: bootstrap personal org, define permissions, ingest artifacts.

Steps:
1. `startIndividualOrganizationSimple(...)`
2. `confirmIndividualOrganizationOrderSimple(...)`
3. add/update contacts: `upsertRelatedPersonAndPoll(...)`
4. grant consent: `grantProfessionalAccessSimple(...)`
5. ingest communication/IPS artifacts:
`ingestCommunicationAndUpdateIndex(...)`
6. search/read indexed outputs through Bundle/Composition search flow.

Communication/DocumentReference notes:
- FHIR Communication can be multi-payload/multi-note natively.
- Current UC profile uses atomic conversion (`1 payload + 1 note` per logical unit) for deterministic indexing.
- Attachment artifacts may be projected to DocumentReference with CID-based content traceability.
- Current profile keeps one attachment per projected DocumentReference; multi-attachment indexed claims
  (e.g. `DocumentReference.attachment[i]-*`) are planned, not active.

## 4) Flow completeness rule (mandatory)

Each UC/resource must cover:
1. create/activate/ingest,
2. search/read/list,
3. update/add/revoke/deactivate.

If step 3 is not implemented yet, it must be explicit in:
- [SDK missing implementation plan](../04-reference/planning/SDK_MISSING_IMPLEMENTATION_PLAN.md)
