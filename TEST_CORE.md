# TEST_CORE - dataspace-client-sdk-node

Purpose: define exactly what the live core E2E proves against the GlobalDataCare GW core profile.

This file is the canonical summary to justify the core-memory baseline from the legacy Node SDK side.

Historical note:
- the live file is still named `tests/live-gw-uc5.e2e.test.mjs`
- for documentation, review, and thesis/memory purposes, treat it as the GW core live E2E

## Scope

This suite validates the core path from the SDK point of view:
- host onboarding
- organization controller bootstrap
- individual/family indexing tenant bootstrap
- consent grant
- SMART token request
- Communication-driven ingestion and indexed retrieval
- RelatedPerson baseline
- bearer/security-mode expectations

It does not validate:
- extension repositories
- portal/frontend UI
- full confidential conversational channel/thread registry

## Command

Baseline core chain:

```bash
RUN_LIVE_GW_E2E=1 npm run test:e2e:live-use-cases
```

Baseline core chain plus Communication/IPS ingestion branch:

```bash
RUN_LIVE_GW_E2E=1 RUN_LIVE_GW_E2E_IPS_INGESTION=1 npm run test:e2e:live-use-cases
```

Debug artifacts:

```bash
RUN_LIVE_GW_E2E=1 \
RUN_LIVE_GW_E2E_IPS_INGESTION=1 \
LIVE_GW_E2E_DEBUG=1 \
npm run test:e2e:live-use-cases
```

## Coverage Table

| Layer | Live test / assertion | What it proves in GW core | Primary SDK methods involved | Evidence artifact |
| --- | --- | --- | --- | --- |
| Host onboarding | `LIVE use-cases chain on local GW` | GW accepts ICA-derived activation proof, completes async submit/poll, and returns a valid organization activation result | `activateOrganizationInGatewayFromIcaProof(...)` | `test-results/live-gw-uc5-debug-*.jsonl`, `test-results/live-gw-http-trace-*.jsonl` |
| Organization controller | `LIVE use-cases chain on local GW` | GW creates or reuses the controller employee entry needed for subsequent organization operations | `createOrganizationEmployee(...)` | same run artifacts |
| Individual/family bootstrap | `LIVE use-cases chain on local GW` | GW accepts individual organization start and order confirmation as first-class core routes | `startIndividualOrganizationSimple(...)`, `confirmIndividualOrganizationOrderSimple(...)` | same run artifacts |
| Consent grant | `LIVE use-cases chain on local GW` | GW persists the consent rule used to authorize professional/member access to the subject | `grantProfessionalAccessSimple(...)` | same run artifacts |
| SMART token | `LIVE use-cases chain on local GW` | GW returns a SMART bearer token with the expected shape for the granted scopes | `requestSmartTokenSimple(...)` | same run artifacts |
| Communication ingestion | `LIVE IPS ingestion through Communication updates individual index baseline` | GW accepts Communication bundle ingestion as the canonical core index-update entrypoint | `ingestCommunicationAndUpdateIndex(...)` | same run artifacts |
| Indexed retrieval | `LIVE IPS ingestion through Communication updates individual index baseline` | GW updates the subject index so `DocumentReference` search returns at least one CID-backed match for the subject | `submitAndPoll(...)` search through SDK client | same run artifacts |
| RelatedPerson baseline | `LIVE RelatedPerson ingestion persists emergency contact flow baseline` | GW accepts the emergency-contact baseline through the RelatedPerson core route and persists the result | `upsertRelatedPersonAndPoll(...)` | same run artifacts |
| Bearer/security mode | `LIVE Bearer shape via SDK in compat/insecure mode` | SDK bearer normalization matches GW expectations in the configured core runtime/security mode | bearer handling + authenticated calls | same run artifacts |

## Why this matters for the core-memory baseline

This suite is the strongest SDK-side proof that the documented GW core flow is not only described but executable end to end.

It demonstrates:
- real async submit/poll behavior
- route availability in the core profile
- persistence and retrieval for the clinically relevant baseline resources
- security-token interoperability at the SDK/GW boundary

## Relationship to other docs

- Flow description in GW: `../gwtemplate-node-ts/docs/API_CORE_INTEGRATION.md`
- Legacy broader matrix: `TEST_MATRIX.md`
- New converged runtime view: `../gdc-sdk-node-ts/TEST_CORE.md`
