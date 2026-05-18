# `ingestCommunicationAndUpdateIndex`

## What it does

Submits a Communication payload and waits for GW async completion; used to trigger index updates from communication artifacts (including IPS payloads).

## Atomic vs native FHIR model (important)

- Native FHIR `Communication` supports multiple `payload[]` and multiple `note[]`.
- The current SDK/GW ingestion profile applies an atomic conversion rule per logical message:
  `1 payload + 1 note -> 1 atomic CommMsg unit`.
- This atomic rule is a conversion/profile constraint for deterministic processing; it is not a redefinition of FHIR.
- Multi-payload FHIR inputs should be explicitly split into atomic units before/within ingestion pipeline when deterministic traceability is required.

## When to use it in UC flows

- When sending communication-driven clinical artifacts to GW.
- In IPS-through-Communication ingestion chain before Composition/Bundle search verification.

## Signature

`ingestCommunicationAndUpdateIndex(ctx, input): Promise<SubmitAndPollResult>`

## Input parameters

- `ctx`: `{ tenantId, jurisdiction, sector }`
- `input.communicationPayload`: DIDComm/plain payload with `thid` + `body.data[]`
- `input.pathFormatSegment`: `api` / `r4` / canonical aliases
- `input.autoConvertClaimsToFhirR4` (default `true` for r4 path)
- optional polling options

## Endpoints called

- `POST /{tenant}/cds-{jurisdiction}/v1/{sector}/individual/org.hl7.fhir.{api|r4}/Communication/_batch`
- `POST /{tenant}/cds-{jurisdiction}/v1/{sector}/individual/org.hl7.fhir.{api|r4}/Communication/_batch-response`

## DocumentReference/CID behavior in current profile

- Communication attachment ingestion can project a `DocumentReference` for indexed retrieval.
- Current simplified behavior assumes one attachment per projected `DocumentReference`.
- CID is used as content fingerprint/version-like value for that attachment.
- Versioning target model (planned refinement):
  - stable logical `DocumentReference.identifier` (UUID/URN),
  - evolving CID per version (`meta.versionId` and/or content hash fields).

## Known limitations and roadmap

- Multi-attachment `DocumentReference.content[i]` is out of current scope.
- Flat-claims indexed form for multi-attachment (planned): `DocumentReference.attachment[i]-<field>`.
- This roadmap is intentional to keep current UC flows deterministic and simpler for E2E validation.

## Retrieval by hash (CID) after ingestion

After Communication ingestion, implementations can retrieve projected DocumentReference rows via Bundle search:

- R4 path:
  `POST /{tenant}/cds-{jurisdiction}/v1/{sector}/individual/org.hl7.fhir.r4/Bundle/_search`
- API path:
  `POST /{tenant}/cds-{jurisdiction}/v1/{sector}/individual/org.hl7.fhir.api/Bundle/_search`

Typical request entry URL:

- `DocumentReference?subject=<did>&contenthash=<cid>`
- or `DocumentReference?subject=<did>&identifier=<docref-identifier>`

Expected response:
- bundle-like payload with `resource.total` and `resource.data[]` rows (0..n)
- empty result is valid (`total=0`)
- row-level failures should be represented as `OperationOutcome` when applicable.

## MIME and FHIR version parameter note

For strict FHIR interoperability profiles, clients may send explicit MIME parameters in headers, e.g.:

`Accept: application/fhir+json; fhirVersion=4.0`

Current SDK/GW routing is primarily path-segment based (`org.hl7.fhir.api` / `org.hl7.fhir.r4`), but this header convention is compatible and recommended for future strict-mode convergence.

## Example input

```ts
await client.ingestCommunicationAndUpdateIndex(ctx, {
  pathFormatSegment: 'r4',
  communicationPayload: {
    body: {
      data: [{
        type: 'Communication-ingestion-request-v1.0',
        meta: { claims: { 'Communication.subject': 'did:web:...:individual:123' } }
      }]
    }
  }
});
```

## Example output (shape)

```json
{
  "submit": { "status": 202 },
  "poll": { "status": 200, "body": { "resourceType": "Bundle" } }
}
```

## Common errors

- route format mismatch (`api` vs `r4`)
- invalid communication payload shape
- GW policy rejects claims/resource

## Tests

- Unit: `tests/client.test.mjs` (`ingestCommunicationAndUpdateIndex ...`)
- Live E2E: `tests/live-gw-uc5.e2e.test.mjs` (`LIVE IPS ingestion through Communication...`)
