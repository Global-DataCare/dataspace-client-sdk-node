export type VpTokenHeader = {
  alg: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
};

export type VpTokenPayload = {
  iss: string;
  sub?: string;
  aud?: string;
  jti?: string;
  iat?: number;
  exp?: number;
  nonce?: string;
  vp: {
    '@context'?: unknown;
    type?: unknown;
    holder?: string;
    verifiableCredential: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function toB64UrlJson(input: unknown): string {
  return Buffer.from(JSON.stringify(input), 'utf-8').toString('base64url');
}

function fallbackId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `id-${Date.now()}-${rand}`;
}

export function generateUuidLike(): string {
  const fn = (globalThis as any)?.crypto?.randomUUID;
  if (typeof fn === 'function') return fn.call((globalThis as any).crypto);
  return fallbackId();
}

export function buildEpochWindow(ttlSeconds = 300): { iat: number; exp: number } {
  const iat = Math.floor(Date.now() / 1000);
  return { iat, exp: iat + Math.max(1, Math.floor(ttlSeconds)) };
}

export function createVP(input?: Partial<VpTokenPayload>): VpTokenPayload {
  const ttl = input?.exp && input?.iat ? undefined : buildEpochWindow(300);
  const jti = input?.jti || generateUuidLike();
  const nonce = input?.nonce || generateUuidLike();
  return {
    iss: String(input?.iss || ''),
    sub: input?.sub,
    aud: input?.aud,
    jti,
    iat: input?.iat ?? ttl?.iat,
    exp: input?.exp ?? ttl?.exp,
    nonce,
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: input?.vp?.holder || input?.iss || '',
      verifiableCredential: [],
      ...(input?.vp || {}),
    },
  };
}

export function addVC(vpPayload: VpTokenPayload, vcJwt: string): VpTokenPayload {
  const v = String(vcJwt || '').trim();
  if (v) vpPayload.vp.verifiableCredential.push(v);
  return vpPayload;
}

export function prepareForSignature(header: VpTokenHeader, payload: VpTokenPayload): {
  encodedHeader: string;
  encodedPayload: string;
  signingInput: string;
} {
  const encodedHeader = toB64UrlJson(header);
  const encodedPayload = toB64UrlJson(payload);
  return { encodedHeader, encodedPayload, signingInput: `${encodedHeader}.${encodedPayload}` };
}

export function prepareBytesForSignature(header: VpTokenHeader, payload: VpTokenPayload): Uint8Array {
  const { signingInput } = prepareForSignature(header, payload);
  return new TextEncoder().encode(signingInput);
}

export function buildVpTokenCompact(encodedHeader: string, encodedPayload: string, signatureBase64Url: string): string {
  return `${encodedHeader}.${encodedPayload}.${String(signatureBase64Url || '').trim()}`;
}
