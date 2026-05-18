// TODO: AdapterCryptoSdkNode and other cryptography adapters should be re-exported here
// to allow external consumers (tests, services) to import them from the SDK directly.
// For now, consumers must import from gdc-common-utils-ts/adapters/node/crypto directly.
// See subjectVaultPhoneResolution.test.ts for context and migration plan.
export * from './types.js';
export * from './builders.js';
export * from './canonical.js';
export * from './communication-transform.js';
export * from './vp-token.js';
export * from './client.js';
export * from './orchestration/personal-sdk.js';
export * from './orchestration/professional-sdk.js';
export * from './sdk/dataspace-wallet-sdk-node/index.js';
