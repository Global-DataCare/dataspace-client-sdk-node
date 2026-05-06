import type { WalletContext } from '../types.js';
import { MemoryWalletProvider } from './memory-provider.js';
/**
 * Dev-only provider.
 *
 * It stabilizes wallet identity selection from a seed, but it is not intended
 * for production custody or HSM-backed key management.
 */
export declare class SeedWalletProvider extends MemoryWalletProvider {
    private readonly seed;
    readonly kind: "seed";
    constructor(seed: string);
    protected ensureKeyPair(context: WalletContext): {
        signingPublicJwk: import("../types.js").PublicJwk;
        signingPublicKey: import("node:crypto").KeyObject;
        signingPrivateKey: import("node:crypto").KeyObject;
        signingPrivateKeyRef: import("../types.js").PrivateKeyRef;
        encryptionPublicJwk: import("../types.js").PublicJwk;
        mlKemSecretKeyBytes: Uint8Array;
        encryptionPrivateKeyRef: import("../types.js").PrivateKeyRef;
    };
}
