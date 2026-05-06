import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from 'node:crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import type {
  CompactJwsHeader,
  DecryptOptions,
  EncryptOptions,
  PrivateKeyRef,
  PublicJwk,
  SignOptions,
  VerifyOptions,
  WalletContext,
  WalletInitOptions,
  WalletProviderKind,
} from '../types.js';
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

function contextKey(context: WalletContext): string {
  return [context.tenantId, context.jurisdiction, context.sector, context.walletId ?? 'default'].join(':');
}

function normalizeBytes(input: Uint8Array | string): Uint8Array {
  return typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
}

function toBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('base64url');
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function encodeJsonBase64Url(value: Record<string, unknown>): string {
  return toBase64Url(Buffer.from(JSON.stringify(value), 'utf8'));
}

function buildKid(context: WalletContext, jwk: PublicJwk): string {
  const thumbprint = createHash('sha256')
    .update(JSON.stringify({
      crv: jwk.crv,
      e: jwk.e,
      kty: jwk.kty,
      n: jwk.n,
      x: jwk.x,
      y: jwk.y,
    }))
    .digest('base64url')
    .slice(0, 16);

  return `wallet:${context.tenantId}:${context.jurisdiction}:${context.sector}:${thumbprint}`;
}

function buildPrivateKeyRef(kid: string, algorithm: PrivateKeyRef['algorithm']): PrivateKeyRef {
  return {
    kid,
    kind: 'managed',
    algorithm,
  };
}

function buildSigningKeyPair(context: WalletContext): {
  publicJwk: PublicJwk;
  publicKey: KeyObject;
  privateKey: KeyObject;
  privateKeyRef: PrivateKeyRef;
} {
  const generated = generateKeyPairSync('ec', {
    namedCurve: 'secp384r1',
  });
  const publicJwk = generated.publicKey.export({ format: 'jwk' }) as PublicJwk;
  const kid = buildKid(context, publicJwk);
  const normalizedPublicJwk: PublicJwk = {
    ...publicJwk,
    kid,
    alg: 'ES384',
    use: 'sig',
    key_ops: ['verify'],
  };

  return {
    publicJwk: normalizedPublicJwk,
    publicKey: createPublicKey({ key: normalizedPublicJwk, format: 'jwk' }),
    privateKey: generated.privateKey,
    privateKeyRef: buildPrivateKeyRef(kid, 'ES384'),
  };
}

/** Generate a ML-KEM-768 key pair for content-key encapsulation (JWE `encrypted_key`). */
function buildMlKemEncryptionKeyPair(context: WalletContext): {
  publicJwk: PublicJwk;
  secretKeyBytes: Uint8Array;
  privateKeyRef: PrivateKeyRef;
} {
  const seed = randomBytes(64);
  const { publicKey: publicKeyBytes, secretKey: secretKeyBytes } = ml_kem768.keygen(seed);
  const x = toBase64Url(publicKeyBytes);
  const kid = createHash('sha256')
    .update(JSON.stringify({ crv: 'ML-KEM-768', kty: 'OKP', x }))
    .digest('base64url')
    .slice(0, 16);
  const fullKid = `wallet:${context.tenantId}:${context.jurisdiction}:${context.sector}:${kid}`;
  const publicJwk: PublicJwk = {
    kty: 'OKP',
    crv: 'ML-KEM-768',
    x,
    kid: fullKid,
    alg: 'ML-KEM-768',
    use: 'enc',
    key_ops: ['wrapKey'],
  };
  return {
    publicJwk,
    secretKeyBytes,
    privateKeyRef: buildPrivateKeyRef(fullKid, 'ML-KEM-768'),
  };
}

export class MemoryWalletProvider implements WalletProvider {
  public readonly kind: WalletProviderKind = 'mem';
  private readonly keysByContext = new Map<string, StoredKeyPair>();

  public init(options?: WalletInitOptions): void {
    for (const context of options?.contexts ?? []) {
      this.ensureKeyPair(context);
    }
  }

  public async getPublicJwks(context: WalletContext): Promise<PublicJwk[]> {
    const pair = this.ensureKeyPair(context);
    return [pair.signingPublicJwk, pair.encryptionPublicJwk];
  }

  public async sign(payload: Uint8Array | string, context: WalletContext, options?: SignOptions): Promise<string> {
    const pair = this.selectSigningKeyPair(context, options?.keyId);
    const signature = cryptoSign('sha384', normalizeBytes(payload), pair.signingPrivateKey);
    return toBase64Url(signature);
  }

  public async verify(
    payload: Uint8Array | string,
    signature: string,
    jwk: PublicJwk,
    _options?: VerifyOptions,
  ): Promise<boolean> {
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    return cryptoVerify('sha384', normalizeBytes(payload), publicKey, fromBase64Url(signature));
  }

  public async signCompactJws(
    context: WalletContext,
    params: { header: CompactJwsHeader; claims: Record<string, unknown> },
  ): Promise<string> {
    const pair = this.selectSigningKeyPair(context, params.header.kid);
    const header: CompactJwsHeader = {
      ...params.header,
      alg: params.header.alg || 'ES384',
      kid: params.header.kid || pair.signingPublicJwk.kid,
    };
    const signingInput = `${encodeJsonBase64Url(header as Record<string, unknown>)}.${encodeJsonBase64Url(params.claims)}`;
    const signature = cryptoSign('sha384', Buffer.from(signingInput, 'ascii'), pair.signingPrivateKey);
    return `${signingInput}.${toBase64Url(signature)}`;
  }

  public async encrypt(
    plaintext: Uint8Array | string,
    recipientJwk: PublicJwk,
    options?: EncryptOptions,
  ): Promise<string> {
    // Delegate to buildCompactJwe; returns a compact JWE string.
    return this.buildCompactJwe(undefined as unknown as WalletContext, {
      plaintext,
      recipientJwk,
    });
  }

  public async decrypt(ciphertext: string, context: WalletContext, options?: DecryptOptions): Promise<Uint8Array> {
    // ciphertext is a compact JWE produced by encrypt / buildCompactJwe.
    return this.decryptCompactJwe(ciphertext, context);
  }

  protected ensureKeyPair(context: WalletContext): StoredKeyPair {
    const key = contextKey(context);
    const existing = this.keysByContext.get(key);
    if (existing) {
      return existing;
    }

    const signingKeyPair = buildSigningKeyPair(context);
    const encryptionKeyPair = buildMlKemEncryptionKeyPair(context);

    const pair: StoredKeyPair = {
      signingPublicJwk: signingKeyPair.publicJwk,
      signingPublicKey: signingKeyPair.publicKey,
      signingPrivateKey: signingKeyPair.privateKey,
      signingPrivateKeyRef: signingKeyPair.privateKeyRef,
      encryptionPublicJwk: encryptionKeyPair.publicJwk,
      mlKemSecretKeyBytes: encryptionKeyPair.secretKeyBytes,
      encryptionPrivateKeyRef: encryptionKeyPair.privateKeyRef,
    };

    this.keysByContext.set(key, pair);
    return pair;
  }

  protected selectSigningKeyPair(context: WalletContext, keyId?: string): StoredKeyPair {
    const pair = this.ensureKeyPair(context);
    if (keyId && pair.signingPrivateKeyRef.kid !== keyId) {
      throw new Error(`Wallet key not found for kid: ${keyId}`);
    }
    return pair;
  }

  protected selectEncryptionKeyPair(context: WalletContext, keyId?: string): StoredKeyPair {
    const pair = this.ensureKeyPair(context);
    if (keyId && pair.encryptionPrivateKeyRef.kid !== keyId) {
      throw new Error(`Wallet key not found for kid: ${keyId}`);
    }
    return pair;
  }

  public async signDetachedJws(
    context: WalletContext,
    params: { header: CompactJwsHeader; payload: Uint8Array | string },
  ): Promise<string> {
    const pair = this.selectSigningKeyPair(context, params.header.kid);
    const header: CompactJwsHeader = {
      ...params.header,
      alg: params.header.alg || 'ES384',
      kid: params.header.kid || pair.signingPublicJwk.kid,
      b64: false,
      crit: ['b64'],
    };
    const payloadBytes = normalizeBytes(params.payload);
    const encodedHeader = encodeJsonBase64Url(header as Record<string, unknown>);
    const signingInput = Buffer.concat([Buffer.from(`${encodedHeader}.`, 'ascii'), payloadBytes]);
    const signature = cryptoSign('sha384', signingInput, pair.signingPrivateKey);
    return `${encodedHeader}..${toBase64Url(signature)}`;
  }

  public async buildCompactJwe(
    context: WalletContext,
    params: { plaintext: Uint8Array | string; recipientJwk: PublicJwk; contentType?: string },
  ): Promise<string> {
    const kid = params.recipientJwk.kid;
    const header: Record<string, unknown> = {
      alg: 'ML-KEM-768',
      enc: 'A256GCM',
      ...(params.contentType ? { cty: params.contentType } : {}),
      ...(kid ? { kid } : {}),
    };
    const encodedHeader = encodeJsonBase64Url(header);

    // ML-KEM-768: encapsulate derives a 32-byte CEK and produces a cipherText (1088 bytes)
    // that the recipient can decapsulate with their secret key.
    const publicKeyBytes = fromBase64Url(params.recipientJwk.x as string);
    const { cipherText: encapsulatedKey, sharedSecret: cek } = ml_kem768.encapsulate(publicKeyBytes);

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', cek, iv);
    cipher.setAAD(Buffer.from(encodedHeader, 'ascii'));
    const ciphertext = Buffer.concat([cipher.update(normalizeBytes(params.plaintext)), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      encodedHeader,
      toBase64Url(encapsulatedKey),
      toBase64Url(iv),
      toBase64Url(ciphertext),
      toBase64Url(authTag),
    ].join('.');
  }

  public async decryptCompactJwe(jwe: string, context: WalletContext): Promise<Uint8Array> {
    const parts = jwe.split('.');
    if (parts.length !== 5) {
      throw new Error('Invalid compact JWE: expected 5 parts.');
    }
    const [encodedHeader, encapsulatedKeyB64, ivB64, ciphertextB64, tagB64] = parts;
    const pair = this.selectEncryptionKeyPair(context);

    // Recover CEK by decapsulating the ML-KEM ciphertext with the secret key.
    const cek = ml_kem768.decapsulate(fromBase64Url(encapsulatedKeyB64), pair.mlKemSecretKeyBytes);

    const decipher = createDecipheriv('aes-256-gcm', cek, fromBase64Url(ivB64));
    decipher.setAAD(Buffer.from(encodedHeader, 'ascii'));
    decipher.setAuthTag(fromBase64Url(tagB64));
    return Buffer.concat([decipher.update(fromBase64Url(ciphertextB64)), decipher.final()]);
  }
}
