import { type KeyObject } from 'node:crypto';
import type { CompactJwsHeader, DecryptOptions, EncryptOptions, PrivateKeyRef, PublicJwk, SignOptions, VerifyOptions, WalletContext, WalletInitOptions, WalletProviderKind } from '../types.js';
import type { WalletProvider } from '../provider.js';
type StoredKeyPair = {
    signingPublicJwk: PublicJwk;
    signingPublicKey: KeyObject;
    signingPrivateKey: KeyObject;
    signingPrivateKeyRef: PrivateKeyRef;
    encryptionPublicJwk: PublicJwk;
    /** ML-KEM-768 secret key bytes (2400 bytes). Never exposed externally. */
    mlKemSecretKeyBytes: Uint8Array;
    encryptionPrivateKeyRef: PrivateKeyRef;
};
export declare class MemoryWalletProvider implements WalletProvider {
    readonly kind: WalletProviderKind;
    private readonly keysByContext;
    init(options?: WalletInitOptions): void;
    getPublicJwks(context: WalletContext): Promise<PublicJwk[]>;
    sign(payload: Uint8Array | string, context: WalletContext, options?: SignOptions): Promise<string>;
    verify(payload: Uint8Array | string, signature: string, jwk: PublicJwk, _options?: VerifyOptions): Promise<boolean>;
    signCompactJws(context: WalletContext, params: {
        header: CompactJwsHeader;
        claims: Record<string, unknown>;
    }): Promise<string>;
    encrypt(plaintext: Uint8Array | string, recipientJwk: PublicJwk, options?: EncryptOptions): Promise<string>;
    decrypt(ciphertext: string, context: WalletContext, options?: DecryptOptions): Promise<Uint8Array>;
    protected ensureKeyPair(context: WalletContext): StoredKeyPair;
    protected selectSigningKeyPair(context: WalletContext, keyId?: string): StoredKeyPair;
    protected selectEncryptionKeyPair(context: WalletContext, keyId?: string): StoredKeyPair;
    signDetachedJws(context: WalletContext, params: {
        header: CompactJwsHeader;
        payload: Uint8Array | string;
    }): Promise<string>;
    buildCompactJwe(context: WalletContext, params: {
        plaintext: Uint8Array | string;
        recipientJwk: PublicJwk;
        contentType?: string;
    }): Promise<string>;
    decryptCompactJwe(jwe: string, context: WalletContext): Promise<Uint8Array>;
}
export {};
