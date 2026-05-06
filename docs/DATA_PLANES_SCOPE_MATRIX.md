# Data Planes And Scope Matrix (SDK Guide)

Canonical reference for scope semantics and resource placement in the Node SDK.

Primary backend source: `gdc-unid-node-ts/docs/02-API-AND-ENDPOINTS/02.F-DATA-PLANES-SCOPE-MATRIX.md`.

## Quick rules

1. Admin/legal plane
- Scopes: `org.schema/Organization.<cruds>`, `org.schema/Person.<cruds>`.
- Use for legal/admin governance and registry/discovery metadata.

2. Subject data plane
- Scopes: `organization/<ResourceType>.<cruds|rs|rus>`.
- Use for private subject operations (`Person`, `RelatedPerson`, `Appointment`, `AppointmentResponse`, `Composition`, etc.).

3. Catalog publication
- Public/legal metadata: `org.schema` plane.
- Private subject data: never publish raw records in catalog.

## Resource matrix

| Intent | Scope |
|---|---|
| Subject private person profile | `organization/Person.rus` |
| Emergency contacts | `organization/RelatedPerson.cruds` |
| Appointments | `organization/Appointment.cruds` |
| Appointment responses | `organization/AppointmentResponse.cruds` |
| Subject index composition read | `organization/Composition.rs` |

## Notification phone policy

1. Subject notification routing (caregiver/spouse/multi-contact) belongs to private data plane and should be stored in `organization/Organization`.
2. Subject own phone belongs to `organization/Person`.
3. Emergency contacts belong to `organization/RelatedPerson`.
4. Do not model these private routing contacts as legal/public `org.schema` publication data.

## Recommended default scope bundle for subject apps

- `organization/Person.rus`
- `organization/RelatedPerson.cruds`
- `organization/Appointment.cruds`
- `organization/AppointmentResponse.cruds`
- `organization/Composition.rs`

## Test checklist

1. Token minted with only `org.schema/*` cannot operate on `organization/*` resources.
2. Token minted with only `organization/*` cannot mutate legal/admin `org.schema/*` resources.
3. Scope propagation in flow tests:
- bootstrap -> consent -> request token -> subject operation.
