# React Web Integration

This guide is frontend-only.  
Backend SDK usage is documented in `docs/BACKEND_NODE_INTEGRATION.md`.

## 1. What the React app does

1. Run ICA UX flow and obtain `vpToken`.
2. Send onboarding payloads to your backend.
3. Show progress and status from backend responses.

React does not call privileged GW onboarding routes directly.

## 2. Legal onboarding payload sent by frontend

Minimum payload to backend endpoint `/api/onboarding/legal/activate`:

```json
{
  "jurisdiction": "ES",
  "sector": "health-care",
  "vpToken": "<vp_token>"
}
```

Notes:
- `jurisdiction` is explicit route context. Do not infer from VAT.
- `sector` is explicit route context. Do not infer from DID.
- include proof only as `vpToken` (JWT VP) or `vp` (JSON VP).

## 3. Frontend code example

```ts
export async function activateLegalOrganization(input: {
  jurisdiction: string;
  sector: string;
  vpToken: string;
}) {
  const response = await fetch('/api/onboarding/legal/activate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Activation failed: ${response.status}`);
  return response.json();
}
```

## 4. Personal/family onboarding from frontend

```ts
export async function registerPersonalOrganization(payload: {
  tenantId: string;
  jurisdiction: string;
  sector: string;
  registrationPayload: unknown;
  confirmationPayload?: unknown;
}) {
  const response = await fetch('/api/onboarding/personal/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Personal onboarding failed: ${response.status}`);
  return response.json();
}
```

## 5. Backend document

For exact SDK methods and backend implementation steps, use:
- `docs/BACKEND_NODE_INTEGRATION.md`
