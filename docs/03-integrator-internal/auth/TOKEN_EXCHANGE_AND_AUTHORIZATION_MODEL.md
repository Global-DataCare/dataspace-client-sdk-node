# Token Exchange and Authorization Model for Gateway-Based Data Spaces

## Abstract

This document summarizes the authorization model used by the gateway and SDK flows in this repository. The goal is to remove ambiguity between onboarding proofs, bootstrap exchanges, client registration, and SMART authorization. The model combines standard OAuth 2.0 token exchange concepts with gateway-specific semantics for activation codes, tenant onboarding, and profile-bound credentials.

## Core Idea

The flows should be read as four separate concerns:

1. **Activation proof**: proves that a legal organization or controller is entitled to activate a tenant or organization context.
2. **Bootstrap token exchange**: converts a one-time activation or license code into an initial access token.
3. **Client registration (DCR)**: registers the public keys of a backend, device, or controller.
4. **SMART authorization**: issues a scoped bearer token for protected resource access.

The main source of errors in integrations is mixing those concerns into a single step.

## Flow Matrix

| Flow | Primary Input | Secondary Input | Output | Purpose | Standard basis |
|---|---|---|---|---|---|
| Legal organization activation | `vp_token` | Optional transport bearer | Activation result and onboarding state | Prove organizational entitlement and activate the tenant context | Profile-specific activation contract |
| Initial access token exchange | User `id_token` as bearer | `subject_token` = activation/license code | `initial_access_token` | Convert a one-time code into a short-lived token for DCR | OAuth 2.0 Token Exchange vocabulary (`subject_token`) plus gateway semantics |
| DCR | `initial_access_token` | Client public keys (`jwks`) | Registered client identity | Bind client keys to a tenant-scoped identity | Standard DCR / `private_key_jwt` family |
| SMART token request | User `id_token` or prior bootstrap token, depending on profile | `subject_token` may be the `id_token` in the exchange | Scoped SMART bearer token | Authorize protected runtime operations | OAuth 2.0 / SMART on FHIR style authorization |
| Confidential backend auth | Client key material | `client_assertion` signed with private key | Access token for backend runtime | Authenticate a backend service as a confidential client | `private_key_jwt` |

## Practical Interpretation

### 1. Activation is not token exchange

The organization activation step uses a `vp_token` to prove entitlement. It is not the same as exchanging a license code. In the SDK, activation is modeled separately from token exchange so that onboarding proofs remain distinct from runtime authorization.

### 2. `subject_token` is the exchange payload

The `subject_token` field belongs to the token-exchange step. It is standard OAuth 2.0 terminology, but the meaning depends on the gateway profile:

- In bootstrap licensing flows, `subject_token` is the activation or license code.
- In SMART bootstrap or federation-like flows, `subject_token` can be the user `id_token`.

### 3. DCR registers keys, it does not create identity

Dynamic Client Registration only binds public keys and metadata to a client identity. The client’s signing key is represented by a `kid`, typically derived from the public key thumbprint. In this repository, deterministic key identity follows RFC 7638 thumbprint rules.

### 4. SMART authorization is a separate step

After activation and registration, the user or backend obtains a scoped SMART bearer token. This token is what should be used for protected runtime routes.

## Identity Mapping Guidance

For conference and documentation purposes, the following phrasing is safer than hard-coding one schema field name:

- Use the organization or controller credential to prove entitlement.
- Bind the credential to a DID key using `verificationMethod` and `kid`.
- Use RFC 7638 thumbprints for deterministic key identity.
- Keep legal identity claims, route aliases, and tenant vault identifiers separate.

Example DID patterns used in the gateway profiles:

- Individual identity: `did:web:<provider.domain>:individual:multibase:z<multibase58(UUID)>`
- Individual member binding: `did:web:<provider.domain>:individual:multibase:z<multibase58(UUID)>:member:<multihash(email)>:role:<role>`
- Legal organization identity: `did:web:<provider.domain>:organization:taxid:<VAT>`
- Legal organization member binding: `did:web:<provider.domain>:organization:taxid:<VAT>:member:<multihash(email)>:role:<role>`
- Legal representative binding: `memberOf.taxID` links the person credential to the organization tax identifier

In this profile family, `Consent.actor-identifier` can resolve to a DID, an email address, or a telephone URI such as `tel:+34600111222` depending on the channel used to identify the actor.

`did:web` is domain-based and resolves through a web host name; it is not itself an ISO 3166 country or region code. Country/region belongs in the deployment profile or jurisdiction metadata, not in the DID method syntax.

The canonical stored consent rule remains atomic: one `Consent.actor-identifier` and one `Consent.actor-role`. If a deployment wants to accept multiple candidate identifiers or multiple candidate roles, that expansion should happen before rule storage, producing one atomic rule per resolved combination.

If a profile includes a field such as `memberOf.taxID`, it should be treated as the legal-linkage claim that ties a person credential to the organization tax identifier.

## Consent Rule Model

Consent is modeled as a policy document that is turned into a query-optimized rule. The incoming consent claims describe who grants access, to whom, for what purpose, and over which data sections.

### Consent claims used to define the rule

| Claim | Meaning | Example |
|---|---|---|
| `Consent.decision` | Whether the rule permits or denies access | `permit` |
| `Consent.subject` | Subject of the consent, usually the patient or member | `did:web:subject.example.com` |
| `Consent.identifier` | Original consent document identifier used for auditing | `urn:uuid:...` |
| `Consent.date` | Date the consent was granted | `2026-05-07` |
| `Consent.purpose` | Purpose of use | `TREAT` |
| `Consent.action` | Comma-separated list of authorized Composition scopes and EEDS history sections, expressed with FHIR-style scope strings and `system|code` pairs | `organization/Composition.rs,organization/Composition.summary,LOINC|48765-2,LOINC|10160-0` |
| `Consent.actor-identifier` | Actor whose access is being controlled; canonical values may be `did:web:...`, `email`, or `tel:+...` depending on the profile | `did:web:hospital.example.com` |
| `Consent.actor-role` | Occupation/role classifier for the actor; profile input may be a comma-separated list of ISCO-08 or FHIR role tokens that is normalized before storage | `ISCO-08|2211,v3-RoleCode|RESPRSN` |
| `Consent.attachment-contentType` | Media type of the attached policy artifact | `application/odrl+json` |
| `Consent.attachment-data` | Base64 encoded attachment payload | `e30=` |

### How the rule ID is generated

The consent rule ID is not the same as the consent document identifier, and it is also different from the CID assigned to the canonical consent claims document. The document identifier remains part of the consent claims for auditing, the claims payload can be assigned a canonical `@id` / `claimsCid`, and the rule ID is derived from a separate canonical rule key:

1. Start from the subject identifier.
2. Add the sector.
3. Add the actor identifier.
4. Add the decision.
5. Add the purpose.
6. Concatenate those parts with `|`.
7. Hash the resulting string with SHA3-384.

In pseudocode:

```text
ruleKey = subjectId | sector | target | decision | purpose
ruleId = sha3-384(ruleKey)
```

The gateway implementation uses this `ruleId` as the unique ID of the stored rule. In parallel, the consent claims payload is canonicalized and assigned a stable claims CID for traceability.

### How authorized sections are associated with the rule

The authorized data sections are encoded in `Consent.action`. Each entry can be a protected resource scope such as `organization/Composition.rs` or a FHIR/EEDS section code encoded as `system|code`, for example `LOINC|48765-2`. On the request side, `section=*` means all permitted sections, while omitting `section` means the backend's default permitted set for that subject.

For role-based filtering, `Consent.actor-role` should be treated as the occupational classification attached to the actor. In this project family, numeric codes are interpreted as ISCO-08, while non-numeric values can be normalized to the relevant FHIR role system. A profile can expand a comma-separated list such as `ISCO-08|2211,v3-RoleCode|RESPRSN` into one atomic rule per resolved role.

The current gateway implementation stores the rule object in the subject-specific `rules` section, while the attachment payload is stored separately in the subject-specific `attachments` section.

That gives two levels of association:

- **Rule identity**: the hashed `ruleId` identifies the policy record itself.
- **Authorized scope**: `Consent.action` enumerates the sections or resource scopes allowed by that policy.

This makes the authorization model queryable: the backend can retrieve the rule by ID and then inspect `Consent.action` to decide whether a request to a particular section is allowed.

### FHIR coding notation in consent actions

When consent actions refer to EEDS history sections, the recommended notation is to keep the FHIR-style `system|code` form used elsewhere in the repository and to concatenate it with the Composition scope list as a comma-separated sequence, similar to how a FHIR search-style parameter list is written for `Composition`:

```text
Consent.action = organization/Composition.rs,organization/Composition.summary,LOINC|48765-2,LOINC|10160-0
```

The pipe separates the coding system from the code value. In the policy model, this keeps section semantics explicit before the rule is normalized and stored. The same pattern is used for `Consent.actor-role`: the profile-level list is expanded first, the gateway validates each token as ISCO-08 or FHIR role code, and then it persists one atomic rule per resolved actor-role and action combination.

### Why this split matters

Separating the document ID from the rule ID avoids ambiguity:

- `Consent.identifier` identifies the consent artifact.
- `ruleId` identifies the policy row used by the authorization engine.
- `Consent.action` identifies the protected sections or scopes.

In practice, this is what makes the consent system auditable and efficient at the same time.

## SDK and API Design Recommendations

To avoid ambiguity and integration errors, the SDK and API docs should consistently state:

1. `vp_token` is for activation proofs.
2. `subject_token` is for token exchange.
3. `jwks` is for DCR registration.
4. `client_assertion` is for confidential client authentication.
5. SMART bearer tokens are for protected resource access only.

## Conclusion

The clearest implementation strategy is to keep each credential in its own lane:

- `vp_token` proves organizational entitlement.
- `id_token` proves user identity.
- `subject_token` redeems a one-time bootstrap right.
- `jwks` registers public keys.
- `client_assertion` authenticates a confidential client.
- SMART access tokens authorize protected operations.

That separation keeps the current portal/backend integration understandable and avoids mixing onboarding proofs with runtime access.