# `activateOrganizationInGatewayFromIcaProof`

## What it does

Activates tenant organization in GW from ICA-derived proof (VP token + claims).

## When to use it in UC flows

- Legal organization onboarding bootstrap.
- First runtime step before employee/device flows.

## Signature

`activateOrganizationInGatewayFromIcaProof(hostCtx, input, pollOptions?): Promise<SubmitAndPollResult>`

## Input parameters

- `hostCtx`: `{ jurisdiction, sector }`
- `input.vpToken` (JWT VP) or `input.vp` (JSON VP)
- `input.additionalClaims` for registration completion

## Endpoints called

- `POST /host/cds-{jurisdiction}/v1/{sector}/registry/org.schema/Organization/_activate`
- `POST /host/cds-{jurisdiction}/v1/{sector}/registry/org.schema/Organization/_activate-response`

## Example input

```ts
await client.activateOrganizationInGatewayFromIcaProof(
  { jurisdiction: 'ES', sector: 'health-care' },
  {
    vpToken: process.env.VP_TOKEN!,
    additionalClaims: {
      'org.schema.Organization.alternateName': 'VATES-B00112233'
    }
  }
);
```

## Example output (shape)

```json
{
  "submit": { "status": 202 },
  "poll": { "status": 200, "body": { "resourceType": "Bundle" } }
}
```

## Common errors

- invalid VP/VC payload
- tenant/domain claim mismatch
- GW security mode rejects bearer/token

## Tests

- Unit: `tests/client.test.mjs` (`activateOrganizationInGatewayFromIcaProof submits...`)
- Live E2E: `tests/live-gw-uc5.e2e.test.mjs` (`LIVE use-cases chain...`)
