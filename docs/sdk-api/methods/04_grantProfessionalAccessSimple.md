# `grantProfessionalAccessSimple`

## What it does

Builds canonical flat Consent claims from minimal frontend inputs and submits a FHIR Consent batch entry.

## When to use it in UC flows

- Individual/controller grants permissions to professional/system.
- Should run before professional token-based access to indexed data.

## Signature

`grantProfessionalAccessSimple(ctx, input): Promise<GrantProfessionalAccessSimpleResult>`

## Input parameters

- `ctx`: `{ tenantId, jurisdiction, sector }`
- `input.subjectDid` or subject aliases (`subjectPhone`, `subjectGivenName`)
- `input.actor`: target actor data (did/url/taxId/email/phone)
- `input.actorRole`, `input.purpose`, `input.actions`
- optional decision/date/identifier/attachment/polling options

## Endpoints called

- `POST /{tenant}/cds-{jurisdiction}/v1/{sector}/individual/org.hl7.fhir.r4/Consent/_batch`
- `POST /{tenant}/cds-{jurisdiction}/v1/{sector}/individual/org.hl7.fhir.r4/Consent/_batch-response`

## Example input

```ts
const consent = await client.grantProfessionalAccessSimple(ctx, {
  subjectDid: 'did:web:api.acme.org:individual:123',
  actor: { organizationUrl: 'https://hospital.example.com' },
  actorRole: 'Practitioner',
  purpose: 'TREAT',
  actions: ['access', 'read'],
});
```

## Example output (shape)

```json
{
  "thid": "consent-...",
  "consent": { "poll": { "status": 200 } },
  "subjectIdentifier": "did:web:...",
  "actorIdentifier": "did:web:hospital.example.com",
  "consentClaims": {
    "Consent.actor-role": "Practitioner",
    "Consent.action": "access,read"
  }
}
```

## Common errors

- unresolved actor/subject identity
- invalid actions/purpose values for GW policy
- async poll timeout

## Tests

- Unit: `tests/client.test.mjs` (`grantProfessionalAccessSimple builds canonical consent claims...`)
- Live E2E: `tests/live-gw-uc5.e2e.test.mjs` (UC chain)

