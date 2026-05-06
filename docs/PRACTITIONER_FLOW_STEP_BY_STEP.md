# PRACTITIONER_FLOW_STEP_BY_STEP

Flow for physician/practitioner employee after controller has issued `activationCode`.

## Rules first

- `jurisdiction` is mandatory (country context for tenant routing and authorization).
- `activationCode` is single-use bootstrap material for identity activation.
- Identity token endpoints and entity/business endpoints are different concerns:
  - identity token flow path: `/host/cds-{jurisdiction}/v1/{sector}/{tenantId}/identity/auth/...`
  - entity/business paths: `/{tenantId}/cds-{jurisdiction}/v1/{sector}/...`
- Practitioner signs `client_assertion` with their private signing key when required by the token endpoint.
- Message transport may also use backend wallet JWS/JWE protection (deployment policy: `plain` / `strict` / `auto-detect`).

## 1) Receive activation code

Input from controller flow:
- `activationCode`

Runtime context:

```ts
const profileContext = {
  baseUrl: process.env.BASE_URL!,
  jurisdiction: process.env.JURISDICTION!, // REQUIRED
  sector: process.env.SECTOR || 'health-care',
};

const sessionContext = {
  tenantId: currentSession.tenantId,
  practitionerDidWeb: currentSession.practitioner.didWeb,
  practitionerIdToken: currentSession.idToken,
  practitionerPublicJwk: currentSession.practitioner.publicJwk,
};
```

## 2) Activate device identity (DCR bootstrap)

```ts
const client = new DataspaceNodeClient({
  baseUrl: profileContext.baseUrl,
  ctx: {
    tenantId: sessionContext.tenantId,
    jurisdiction: profileContext.jurisdiction,
    sector: profileContext.sector,
  },
});

const device = await client.activateEmployeeDeviceWithActivationCodeSimple({
  tenantId: sessionContext.tenantId,
  jurisdiction: profileContext.jurisdiction,
  sector: profileContext.sector,
  activationCode,
  idToken: sessionContext.practitionerIdToken,
  dcrPayload: {
    application_type: 'web',
    token_endpoint_auth_method: 'private_key_jwt',
    jwks: { keys: [sessionContext.practitionerPublicJwk] },
  },
});
```

## 3) Request SMART token for protected operations

`targetEndpoint` is only a local token-target identifier. Authorization is defined by `scopes`.

```ts
const smart = await client.requestSmartTokenSimple({
  tenantId: sessionContext.tenantId,
  jurisdiction: profileContext.jurisdiction,
  sector: profileContext.sector,
  idToken: sessionContext.practitionerIdToken,
  targetEndpoint: `smart:practitioner:${sessionContext.practitionerDidWeb}:ips-read`,
  scopes: [
    'organization/Composition.rs',
    'organization/Consent.cruds',
    'organization/Communication.cruds',
  ],
});
```

IPS note:
- Access to IPS sections is authorized via scopes (for example `organization/Composition.rs`) and consent/policy checks.
- Do not derive authorization from `targetEndpoint` or from a single endpoint selector.

## 3.1) Where JWT signing happens (`private_key_jwt`)

If your token endpoint requires `client_assertion` (`private_key_jwt`), the JWT must be signed with the practitioner's/controller's private key.

Option A (recommended): SDK signs and sends `client_assertion` for you.

```ts
const token = await client.authenticateBackendSmartStandard({
  clientId: sessionContext.practitionerDidWeb,
  scopes: ['organization/Composition.rs'],
  targetEndpoint: `smart:practitioner:${sessionContext.practitionerDidWeb}:ips-read`,
  tokenUrl: `${profileContext.baseUrl}/token`,
  audience: `${profileContext.baseUrl}/token`,
  walletContext: {
    tenantId: sessionContext.tenantId,
    jurisdiction: profileContext.jurisdiction,
    sector: profileContext.sector,
  },
  publicJwk: sessionContext.practitionerPublicJwk,
});
```

Option B (manual): build/sign JWT yourself, then attach it in token request.

```ts
const now = Math.floor(Date.now() / 1000);
const encodedHeader = base64url(JSON.stringify({
  alg: 'ES384',
  typ: 'JWT',
  kid: sessionContext.practitionerPublicJwk.kid,
}));
const encodedPayload = base64url(JSON.stringify({
  iss: sessionContext.practitionerDidWeb,
  sub: sessionContext.practitionerDidWeb,
  aud: `${profileContext.baseUrl}/token`,
  iat: now,
  exp: now + 300,
  jti: crypto.randomUUID(),
}));
const signingInput = `${encodedHeader}.${encodedPayload}`; // what must be signed

const signatureBase64Url = await externalSigner(signingInput); // integrator-managed signer
const clientAssertion = `${encodedHeader}.${encodedPayload}.${signatureBase64Url}`;

// Equivalent high-level helper style:
// const clientAssertion = await wallet.signCompactJws({ header, claims });
```

```ts
const tokenRequestBody = {
  grant_type: 'client_credentials',
  client_id: sessionContext.practitionerDidWeb,
  scope: 'organization/Composition.rs organization/Consent.cruds organization/Communication.cruds',
  client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
  client_assertion, // signed JWT is attached here
};
```

Integrator note:
- SDK can help generate/sign compact JWTs, but key custody/signature execution belongs to the integrator.
- The signer may be wallet SDK, secure enclave, KMS, HSM, or remote signature service.

```ts
// Alternative helper form if your signer abstraction already returns compact JWS:
const clientAssertion = await wallet.signCompactJws({
  header: {
    alg: 'ES384',
    typ: 'JWT',
    kid: sessionContext.practitionerPublicJwk.kid,
  },
  claims: {
    iss: sessionContext.practitionerDidWeb,
    sub: sessionContext.practitionerDidWeb,
    aud: `${profileContext.baseUrl}/token`,
    iat: now,
    exp: now + 300,
    jti: crypto.randomUUID(),
  },
});
```

For the current GW `identity/auth/_token` flow documented in this SDK, `requestSmartTokenSimple(...)` is id-token based.  
Use `private_key_jwt` flow when your deployment exposes a standards token endpoint that requires `client_assertion`.

## 4) Call protected APIs with returned bearer

Use `smart.accessToken` in subsequent requests.

Complete path examples:
- exchange activation code:
  `/host/cds-ES/v1/health-care/{tenantId}/identity/auth/_exchange`
- DCR:
  `/host/cds-ES/v1/health-care/{tenantId}/identity/auth/_dcr`
- SMART token:
  `/host/cds-ES/v1/health-care/{tenantId}/identity/auth/_token`
- example protected entity route (if practitioner is allowed):
  `/{tenantId}/cds-ES/v1/health-care/entity/org.schema/Employee/_search`
