import type { CompactJwsHeader, DecryptOptions, EncryptOptions, PublicJwk, SignOptions, VerifyOptions, WalletContext, WalletInitOptions, WalletProviderKind } from './types.js';
export interface WalletProvider {
    readonly kind: WalletProviderKind;
    init?(options?: WalletInitOptions): Promise<void> | void;
    getPublicJwks(context: WalletContext): Promise<PublicJwk[]>;
    sign(payload: Uint8Array | string, context: WalletContext, options?: SignOptions): Promise<string>;
    verify(payload: Uint8Array | string, signature: string, jwk: PublicJwk, options?: VerifyOptions): Promise<boolean>;
    signCompactJws(context: WalletContext, params: {
        header: CompactJwsHeader;
        claims: Record<string, unknown>;
    }): Promise<string>;
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
    encrypt(plaintext: Uint8Array | string, recipientJwk: PublicJwk, options?: EncryptOptions): Promise<string>;
    decrypt(ciphertext: string, context: WalletContext, options?: DecryptOptions): Promise<Uint8Array>;
}
