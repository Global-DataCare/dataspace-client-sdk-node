import type { WalletProvider } from './provider.js';
import type {
  CompactJwsHeader,
  DecryptOptions,
  EncryptOptions,
  PublicJwk,
  SignOptions,
  VerifyOptions,
  WalletContext,
} from './types.js';
// CompactJweHeader is used transitively through WalletProvider

export class WalletClient {
  public constructor(
    private readonly provider: WalletProvider,
    private readonly context: WalletContext,
  ) {}

  public getPublicJwks(): Promise<PublicJwk[]> {
    return this.provider.getPublicJwks(this.context);
  }

  public sign(payload: Uint8Array | string, options?: SignOptions): Promise<string> {
    return this.provider.sign(payload, this.context, options);
  }

  public verify(
    payload: Uint8Array | string,
    signature: string,
    jwk: PublicJwk,
    options?: VerifyOptions,
  ): Promise<boolean> {
    return this.provider.verify(payload, signature, jwk, options);
  }

  public signCompactJws(params: { header: CompactJwsHeader; claims: Record<string, unknown> }): Promise<string> {
    return this.provider.signCompactJws(this.context, params);
  }

  public signDetachedJws(params: { header: CompactJwsHeader; payload: Uint8Array | string }): Promise<string> {
    return this.provider.signDetachedJws(this.context, params);
  }

  public buildCompactJwe(params: {
    plaintext: Uint8Array | string;
    recipientJwk: PublicJwk;
    contentType?: string;
  }): Promise<string> {
    return this.provider.buildCompactJwe(this.context, params);
  }

  public decryptCompactJwe(jwe: string): Promise<Uint8Array> {
    return this.provider.decryptCompactJwe(jwe, this.context);
  }

  public encrypt(plaintext: Uint8Array | string, recipientJwk: PublicJwk, options?: EncryptOptions): Promise<string> {
    return this.provider.encrypt(plaintext, recipientJwk, options);
  }

  public decrypt(ciphertext: string, options?: DecryptOptions): Promise<Uint8Array> {
    return this.provider.decrypt(ciphertext, this.context, options);
  }
}
