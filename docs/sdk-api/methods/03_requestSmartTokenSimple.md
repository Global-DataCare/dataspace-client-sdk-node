# `requestSmartTokenSimple`

## What it does

Requests a SMART access token from GW using the identity exchange async flow.

## When to use it in UC flows

- After device identity activation (DCR bootstrap).
- Before calling protected business endpoints requiring SMART scopes.

Typical sequence:
1. `activateEmployeeDeviceWithActivationCodeSimple(...)`
2. `requestSmartTokenSimple(...)`
3. call business operations with returned access token

## Signature

`requestSmartTokenSimple(input: SmartTokenRequestSimpleInput): Promise<SmartTokenExchangeResult>`

## Input parameters

- `input.idToken` (required): OIDC id token (or compatible token for configured GW mode).
- `input.scopes` (required): requested scopes array.
- `input.ctx` (optional): route context override (`tenantId`, `jurisdiction`, `sector`).
- `input.timeoutSeconds` / `input.intervalSeconds` (optional): async polling controls.

## Endpoints called

- `POST /host/cds-{jurisdiction}/v1/{sector}/{tenantId}/identity/auth/_exchange`
- `POST /host/cds-{jurisdiction}/v1/{sector}/{tenantId}/identity/auth/_exchange-response`

## Example input

```ts
const smart = await client.requestSmartTokenSimple({
  idToken: process.env.PROFESSIONAL_ID_TOKEN!,
  scopes: ['employee.healthcare.getIndexComposition'],
  timeoutSeconds: 60,
  intervalSeconds: 2,
});
```

## Example output (shape)

```json
{
  "status": "fetched",
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "scope": "employee.healthcare.getIndexComposition",
  "expiresIn": 3600
}
```

## Common errors

- missing `idToken`
- missing scopes/token cache key
- async poll timeout
- bearer/token validation failure in GW (`401`)

## Tests

- Unit: `tests/client.test.mjs` (`requestSmartTokenSimple uses identity auth exchange async flow`)
- Live E2E: `tests/live-gw-uc5.e2e.test.mjs` (UC chain + bearer shape)

