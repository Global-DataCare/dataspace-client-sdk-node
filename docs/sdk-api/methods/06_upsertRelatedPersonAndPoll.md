# `upsertRelatedPersonAndPoll`

## What it does

Submits RelatedPerson contact payload (emergency/non-emergency) and polls until async completion.

## When to use it in UC flows

- Register or update patient-related contacts for emergency or continuity workflows.
- Run before downstream flows that rely on contact data availability.

## Signature

`upsertRelatedPersonAndPoll(ctx, input): Promise<SubmitAndPollResult>`

## Input parameters

- `ctx`: `{ tenantId, jurisdiction, sector }`
- `input.relatedPersonPayload`: payload with `body.data[]` entries containing `meta.claims` (or canonical resource)
- optional poll options

## Endpoints called

- `POST /{tenant}/cds-{jurisdiction}/v1/{sector}/individual/org.hl7.fhir.api/RelatedPerson/_batch`
- `POST /{tenant}/cds-{jurisdiction}/v1/{sector}/individual/org.hl7.fhir.api/RelatedPerson/_batch-response`

## Example input

```ts
await client.upsertRelatedPersonAndPoll(ctx, {
  relatedPersonPayload: {
    body: {
      data: [{
        type: 'RelatedPerson-ingestion-request-v1.0',
        meta: {
          claims: {
            '@context': 'org.hl7.fhir.api',
            'RelatedPerson.patient': 'did:web:api.acme.org:individual:123',
            'RelatedPerson.relationship': 'http://terminology.hl7.org/CodeSystem/v3-RoleCode|PRN',
            'RelatedPerson.name': 'Emergency Contact Demo'
          }
        }
      }]
    }
  }
});
```

## Example output (shape)

```json
{
  "submit": { "status": 202 },
  "poll": { "status": 200 }
}
```

## Common errors

- missing `RelatedPerson.patient`/`subject`
- malformed `meta.claims`
- GW validation rejects resource/claims

## Tests

- Unit: `tests/client.test.mjs` (`upsertRelatedPersonAndPoll submits...`)
- Live E2E: `tests/live-gw-uc5.e2e.test.mjs` (`LIVE RelatedPerson ingestion...`)

