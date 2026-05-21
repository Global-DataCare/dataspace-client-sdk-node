# `submitAndPoll`

## What it does

Generic helper that submits payload to async GW endpoint and polls the corresponding `*-response` endpoint until completion (non-202).

## When to use it in UC flows

- Base primitive for all create/search/update operations when a dedicated typed helper does not yet exist.

## Signature

`submitAndPoll(submitPath, pollPath, payload, options?): Promise<SubmitAndPollResult>`

## Input parameters

- `submitPath`: target submit route (`_batch`, `_search`, etc.)
- `pollPath`: target response route (`_batch-response`, `_search-response`, etc.)
- `payload`: object containing at least `thid`
- `options.timeoutMs` / `options.intervalMs` (optional)

## Endpoints called

- `POST {submitPath}`
- `POST {pollPath}` repeatedly until status != 202

## Example input

```ts
await client.submitAndPoll(
  client.individualCompositionR4BatchPath(ctx),
  client.individualCompositionR4PollPath(ctx),
  { thid: 'composition-123', body: { data: [] } },
  { timeoutMs: 120000, intervalMs: 1500 }
);
```

## Example output (shape)

```json
{
  "submit": { "status": 202 },
  "poll": { "status": 200, "attempts": 2 }
}
```

## Common errors

- `payload.thid` missing
- poll timeout
- upstream GW status >= 400

## Tests

- Unit: `tests/client.test.mjs` (`submitAndPoll uses DIDComm plain submit...`)
- Used transitively by most other unit/live scenarios.

