# Legacy Status

Archive mode effective date: **2026-05-19**.

`dataspace-client-sdk-node` is a legacy archive repository. Migration target packages are:

- `gdc-sdk-core-ts`
- `gdc-sdk-node-ts`

Archive role:

- frozen compatibility reference only
- no new runtime features
- no new live-path integrations
- bugfix-only when strictly needed for compatibility windows

It should not be treated as the final long-term package name.

Current honest status:

- architecturally deprecated
- no longer required by live Node runtime paths (`gdc-sdk-node-ts` live E2E imports nothing from this repo)

See:
- `../GDC_SDK_REPO_BOUNDARIES_AND_FILE_MAP_2026-05-19.md`
