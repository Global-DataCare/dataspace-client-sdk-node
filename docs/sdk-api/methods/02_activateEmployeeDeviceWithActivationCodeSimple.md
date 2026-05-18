# `activateEmployeeDeviceWithActivationCodeSimple`

## What it does

Activates an employee/member runtime identity from an activation code and registers device keys (DCR flow wrapper).

## When to use it in UC flows

- Organization/practitioner onboarding after invitation/license issue.
- Before requesting SMART tokens for operational API calls.

Typical sequence:
1. controller obtains/issues activation code (`org.schema.IndividualProduct.serialNumber`) after Order
2. employee/controller runs `activateEmployeeDeviceWithActivationCodeSimple(...)`:
`Token/_exchange` (`id_token` -> `initial_access_token`) + `Device/_dcr` (bind wallet key(s) to license serial + email)
3. employee runs `requestSmartTokenSimple(...)`

## Signature

`activateEmployeeDeviceWithActivationCodeSimple(input: EmployeeDeviceActivationSimpleInput): Promise<EmployeeDeviceActivationResult>`

## Input parameters

- `input.activationCode` (required): issued activation code.
- `input.idToken` (required): token used in exchange step.
- `input.endpointId` (optional): endpoint identity selector.
- `input.ctx` (optional): route context override.
- polling options in seconds (optional).

## Endpoints called

This wrapper orchestrates:
- identity exchange route
- DCR route
- corresponding poll routes

## Example input

```ts
const device = await client.activateEmployeeDeviceWithActivationCodeSimple({
  activationCode: process.env.ACTIVATION_CODE!,
  idToken: process.env.PROFESSIONAL_ID_TOKEN!,
  timeoutSeconds: 60,
  intervalSeconds: 2,
});
```

## Example output (shape)

```json
{
  "exchange": { "poll": { "status": 200 } },
  "dcr": { "poll": { "status": 200 } },
  "endpointId": "did:web:...:device:..."
}
```

## Common errors

- activation code invalid/expired
- missing `initial_access_token` from exchange result
- DCR failure (key registration/policy)

## Tests

- Unit: `tests/client.test.mjs` (`activateEmployeeDeviceWithActivationCodeSimple...`)
- Live E2E: `tests/live-gw-uc5.e2e.test.mjs` (UC chain)
