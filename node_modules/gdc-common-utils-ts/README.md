# gdc-common-utils-ts

Shared TypeScript utilities for GDC client and connector code. This package provides low-level primitives for cryptography, DID/DIDComm-related helpers, and the shared models and interfaces used across SDKs.

It is intentionally not a full backend orchestration layer.

## Install

```bash
npm install gdc-common-utils-ts
```

## What It Exports

The published package exposes these entry points through `package.json`:

- Root: `gdc-common-utils-ts`
- `gdc-common-utils-ts/AesManager`
- `gdc-common-utils-ts/CryptographyService`
- `gdc-common-utils-ts/hmac`
- `gdc-common-utils-ts/constants`
- `gdc-common-utils-ts/models`
- `gdc-common-utils-ts/utils`
- `gdc-common-utils-ts/interfaces`
- File-level subpaths under `constants/*`, `models/*`, `utils/*`, and `interfaces/*`

### Root crypto exports

The package root re-exports the main crypto helpers:

- `AesManager`
- `CryptographyService`
- `computeHmacSha256`
- `computeHmacSha256Base64Url`

Example:

```ts
import { AesManager, CryptographyService, computeHmacSha256Base64Url } from 'gdc-common-utils-ts';
```

### Utilities

The `utils` export exposes reusable helpers for DID and message handling, such as:

- `utils/did` helpers like `generateServiceId`, `normalizeDidWeb`, `createHostedDidWeb`, `buildHostedDidDetails`, and `getBaseUrlFromDidWeb`
- `utils/jwt`
- `utils/content`
- `utils/normalize`
- `utils/fhir-cid` for recursive FHIR canonicalization + CID generation + `meta.versionId` assignment
- conversion, formatting, and multibase helpers

These helpers support DIDComm-style message construction and related transport/data-shaping workflows.

Example:

```ts
import { normalizeDidWeb, generateServiceId } from 'gdc-common-utils-ts/utils/did';
import { fhirResourceToCid, assignCidToFhirResourceVersionId } from 'gdc-common-utils-ts/utils/fhir-cid';
```

### Models

The `models` export contains the shared data shapes used by the SDKs, including:

- cryptographic and JOSE shapes such as `aes`, `jwe`, `jws`, `jwt`, and `jwk`
- DID and DIDComm-related models such as `did`, `comm`, and `verifiable-credential`
- confidential transport and storage models
- auth, device, response, issue, and FHIR-oriented models

Example:

```ts
import { JweObject, JwtCompactParts } from 'gdc-common-utils-ts/models';
```

### Interfaces

The `interfaces` export contains the shared type contracts and cryptography types, including:

- `ICryptography`
- `ICryptoHelper`
- `IWallet`
- `Cryptography.types`
- `MlDsa`
- `MlKem`

Example:

```ts
import { ICryptography, MlkemPublicJwk } from 'gdc-common-utils-ts/interfaces/Cryptography.types';
```

## Auth-Flow Boundaries

This package provides primitives, not orchestration.

It supports the cryptographic and data-model building blocks needed by higher-level clients, but it does not coordinate the backend auth exchange sequence for:

- `/_dcr`
- `/_code`
- `/_token`
- `/_exchange`

Those request/response flows belong in connector SDKs and backend orchestration layers.

## Relationship To Other SDKs

`gdc-sdk-client-ts` and `dataconv-client-sdk-ts` are consumers of this package, not replacements for it.

- Use `gdc-common-utils-ts` when you need shared crypto primitives, DID/DIDComm helpers, and common types
- Use `gdc-sdk-client-ts` or `dataconv-client-sdk-ts` when you need higher-level client orchestration, transport, or API workflows

## Notes

- The package is published as ESM.
- The `files` field only publishes `dist/`, so source imports should use the documented package entry points rather than local file paths.

## Roadmap and Briefing
- `BRIEFING_DATASPACE_EN.md`
- `TODO_ROADMAP.md`
