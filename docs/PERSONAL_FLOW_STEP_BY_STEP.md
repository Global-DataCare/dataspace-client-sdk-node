# PERSONAL_FLOW_STEP_BY_STEP

Canonical flow for personal/family onboarding and consented access.

Security note:
- User authentication/authorization (id-token + scopes + consent) is independent from transport/message protection.
- Backend may enforce DIDComm message security (JWS/JWE) per deployment policy: `plain` / `strict` / `auto-detect`.

## 1) Start individual/family organization onboarding

```ts
const started = await client.startIndividualOrganizationSimple({
  alternateName,
  controllerEmail,        // or controllerTelephone
  controllerRole: '|RESPRSN',
});
```


Role format note:
- use `codingSystem|codeValue` (FHIR-style split by `|`).
- if coding system is omitted, keep leading pipe and send only code value, for example `|RESPRSN`.

**Nota sobre RESPRSN:**
El código `RESPRSN` significa "Responsible Party" según el estándar FHIR. Puedes consultar la definición oficial en: [HL7 FHIR RoleCode - Responsible Party](https://terminology.hl7.org/CodeSystem-v3-RoleCode.html)

## 2) Show offer in UI and accept

```ts
const offerId = started.offerId;
const offerPreview = started.offerPreview;
```

## 3) Confirm order (always)

```ts
const order = await client.confirmIndividualOrganizationOrderSimple({ offerId: offerId! });
```

## 4) Configure consent/preauthorization

```ts
const consent = await client.grantProfessionalAccessSimple(
  { tenantId, jurisdiction, sector },
  {
    subjectDid,
    actor: { identifier: practitionerDid },
    actorRole: 'Practitioner',
    purpose: 'TREAT',
    actions: ['organization/Composition.rs'],
  },
);
```

## 5) Optional: import/update index data

Use your ingestion path (`/publisher/...`) and then subject-side runtime operations.

## 6) Professional requests token and reads allowed resources

```ts
const smart = await client.requestSmartTokenSimple({
  idToken: practitionerIdToken,
  targetEndpoint: client.getEndpointId({
    section: 'organization',
    format: 'org.hl7.fhir.r4',
    resourceType: 'Composition',
    action: '_search',
  }, practitionerDid),
  scopes: ['organization/Composition.rs'],
});
```

## Notes

- For personal onboarding in GW, verification is integrated in the onboarding flow (`individual/org.schema/Organization/_batch` + `Order/_batch`).
- Keep Offer/Order UX explicit even when amount is `0`.
- Use endpoint-id selectors from `docs/ENDPOINT_ID_CATALOG.md`.
