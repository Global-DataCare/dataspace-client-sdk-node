# ENDPOINT_ID_CATALOG

Canonical endpoint-id construction for token cache/session reuse.

Use `client.getEndpointId(selector, providerDid?)` and avoid ad-hoc strings.

Selector shape:

```ts
type EndpointSelector = {
  section: string;
  format: string;
  resourceType: string;
  action: string;
};
```

Generation rule:
- With `providerDid`: `did:web:...#section:format:resourceType:action`
- Without `providerDid`: `section:format:resourceType:action`

## Recommended selectors

```ts
export const ENDPOINT_SELECTORS = {
  ORG_COMPOSITION_SEARCH: {
    section: 'organization',
    format: 'org.hl7.fhir.r4',
    resourceType: 'Composition',
    action: '_search',
  },
  INDIVIDUAL_CONSENT_BATCH: {
    section: 'individual',
    format: 'org.hl7.fhir.r4',
    resourceType: 'Consent',
    action: '_batch',
  },
  INDIVIDUAL_COMMUNICATION_BATCH: {
    section: 'individual',
    format: 'org.hl7.fhir.r4',
    resourceType: 'Communication',
    action: '_batch',
  },
  INDIVIDUAL_DOCUMENTREFERENCE_BATCH: {
    section: 'individual',
    format: 'org.hl7.fhir.r4',
    resourceType: 'DocumentReference',
    action: '_batch',
  },
  IDENTITY_AUTH_TOKEN: {
    section: 'identity',
    format: 'auth',
    resourceType: 'token',
    action: '_token',
  },
  IDENTITY_AUTH_DCR: {
    section: 'identity',
    format: 'auth',
    resourceType: 'device',
    action: '_dcr',
  },
  IDENTITY_AUTH_EXCHANGE: {
    section: 'identity',
    format: 'auth',
    resourceType: 'token',
    action: '_exchange',
  },
} as const;
```

## Example

```ts
const targetEndpoint = client.getEndpointId(
  ENDPOINT_SELECTORS.ORG_COMPOSITION_SEARCH,
  ORG_CONTROLLER_DID_WEB,
);

const smart = await client.requestSmartTokenSimple({
  idToken,
  targetEndpoint,
  scopes: ['organization/Composition.rs'],
});
```

## Alignment policy

- Prefer current namespaces and flows: `/host`, `/ica`, `/publisher`, and GW runtime `identity/auth`.
- Do not introduce new integrations based on legacy aliases.
- Keep endpoint-id selectors stable and explicit across Node + frontend SDKs.
