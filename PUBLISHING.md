# Publishing

This package is published as a public, unscoped package (`dataspace-client-sdk-node`).

## NPM token

In this workspace, the npm token is exported by the shell config:

```bash
source ~/.zshrc
```

Expected variable:

```bash
echo "$NPM_TOKEN"
```

Do not commit the token value into the repository or docs.

## Configure npm auth from shell token

```bash
npm config set //registry.npmjs.org/:_authToken="$NPM_TOKEN"
```

Verify:

```bash
npm whoami
```

## Publish

Recommended validation before publish:

```bash
npm test -- --runInBand tests/client.test.mjs
RUN_LIVE_GW_E2E=1 ./scripts/run-secure-e2e-google-user.sh
```

Publish:

```bash
npm publish --access public
```

If 2FA for publish is enabled, add an OTP:

```bash
NPM_CONFIG_OTP=123456 npm publish --access public
```
