# E2E Bootstrap (Tenant + Controller)

This flow prepares a tenant for frontend E2E tests (`apptemplate`) after ICA proof is available.

## 1) What the script does

Script: `examples/e2e-bootstrap-tenant.mjs`

1. Authenticates to GW (`AUTH_MODE=demo|pkce`).
2. Calls host activation endpoint (`Organization/_activate`) with `vp_token` and optional ICA JWT VCs.
3. Optionally creates a controller employee in the tenant (`Employee/_batch`).

## 2) Run command

```bash
npm run example:e2e-bootstrap-tenant
```

## 3) Required env

- `BASE_URL` (default `http://localhost:3000`)
- `VP_TOKEN` (required)

Auth-specific:

- Demo:
  - `AUTH_MODE=demo` (default)
  - `AUTH_BEARER` (optional, default `demo-token`)
- PKCE:
  - `AUTH_MODE=pkce`
  - `GW_API_KEY`
  - `GW_CONTROLLER_PUBLIC_JWK_SIGN` (JSON object)

Routing:

- `JURISDICTION` (default `ES`)
- `HOST_REGISTRY_SECTOR` (default `test`)
- `TENANT_ID` (default `acme`)
- `SECTOR` (default `health-care`)

Optional:

- `ORGANIZATION_VC_JWT`
- `LEGAL_REPRESENTATIVE_VC_JWT`
- `CREATE_CONTROLLER_EMPLOYEE=true`
- `CONTROLLER_EMAIL`
- `CONTROLLER_ROLE`

## 4) Typical sequence

1. Start local stack (GW + ICA + dependencies).
2. Obtain `vp_token` from ICA flow (frontend or node).
3. Run this bootstrap script.
4. Run `apptemplate` integration profile (`local-demo`, `local-docker`, or `cloud-staging`).
