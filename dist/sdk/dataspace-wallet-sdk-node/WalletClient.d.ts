import type { WalletProvider } from './provider.js';
import type { CompactJwsHeader, DecryptOptions, EncryptOptions, PublicJwk, SignOptions, VerifyOptions, WalletContext } from './types.js';
export declare class WalletClient {
    private readonly provider;
    private readonly context;
    constructor(provider: WalletProvider, context: WalletContext);
    getPublicJwks(): Promise<PublicJwk[]>;
    sign(payload: Uint8Array | string, options?: SignOptions): Promise<string>;
    verify(payload: Uint8Array | string, signature: string, jwk: PublicJwk, options?: VerifyOptions): Promise<boolean>;
    signCompactJws(params: {
        header: CompactJwsHeader;
        claims: Record<string, unknown>;
    }): Promise<string>;
    signDetachedJws(params: {
        header: CompactJwsHeader;
        payload: Uint8Array | string;
    }): Promise<string>;
    buildCompactJwe(params: {
        plaintext: Uint8Array | string;
        recipientJwk: PublicJwk;
        contentType?: string;
    }): Promise<string>;
    decryptCompactJwe(jwe: string): Promise<Uint8Array>;
    encrypt(plaintext: Uint8Array | string, recipientJwk: PublicJwk, options?: EncryptOptions): Promise<string>;
    decrypt(ciphertext: string, options?: DecryptOptions): Promise<Uint8Array>;
}
