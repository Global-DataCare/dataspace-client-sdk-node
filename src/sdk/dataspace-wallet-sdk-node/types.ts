export type WalletContext = {
  tenantId: string;
  jurisdiction: string;
  sector: string;
  walletId?: string;
};

export type PublicJwk = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
  key_ops?: string[];
};

export type PrivateKeyRef = {
  kid: string;
  kind: 'managed';
  algorithm: 'ES384' | 'ML-KEM-768' | 'RSA-OAEP-256/RS256';
};

export type SignOptions = {
  keyId?: string;
  algorithm?: 'ES384' | 'RS256';
};

export type VerifyOptions = {
  algorithm?: 'ES384' | 'RS256';
};

export type EncryptOptions = {
  keyId?: string;
  /** Defaults to ML-KEM-768 when recipient JWK has kty:'OKP', crv:'ML-KEM-768'; falls back to RSA-OAEP-256 for legacy RSA JWKs. */
  algorithm?: 'ML-KEM-768' | 'RSA-OAEP-256';
};

export type DecryptOptions = {
  keyId?: string;
  algorithm?: 'RSA-OAEP-256';
};

export type WalletProviderKind = 'mem' | 'seed' | 'external';

export type WalletInitOptions = {
  contexts?: WalletContext[];
};

export type CompactJwsHeader = {
  alg: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
};

export type CompactJweHeader = {
  /** KEM algorithm. ML-KEM-768 (post-quantum) or RSA-OAEP-256 (legacy). */
  alg: 'ML-KEM-768' | 'RSA-OAEP-256' | string;
  enc: 'A256GCM' | 'A128GCM' | string;
  cty?: string;
  kid?: string;
  [key: string]: unknown;
};
