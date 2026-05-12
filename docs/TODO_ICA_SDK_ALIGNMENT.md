# TODO: ICA / SDK Alignment (Activation VC Contract)

Status: temporary compatibility in SDK test fixtures.

## Current issue

GW activation requires resolvable representative DID for `LegalRepresentativeCredential`.
Current real ICA credential may provide:
- `credentialSubject.id` as non-DID URN (person identifier), and
- no explicit DID field aligned with GW activation checks.

## Temporary compatibility used in tests

- Added `credentialSubject.sameAs = did:web:...` in test VP fixture for representative credential.
- Removed heavy `evidence` fields from fixture to keep tests lightweight.

## Required alignment (ICA + ICA SDK)

1. Define a stable controller DID claim in `LegalRepresentativeCredential`.
2. Ensure GW activation and SDK examples use that same claim contract.
3. Keep `memberOf.taxID` as legal linkage to organization tax identifier.
4. Keep occupation data (`hasOccupation`) as metadata, not legal-representation proof.

## Acceptance criteria

- Live E2E activation works with ICA-issued credentials without test-only synthetic claims.
- No fallback-only logic required in docs/examples.
