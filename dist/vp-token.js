function toB64UrlJson(input) {
    return Buffer.from(JSON.stringify(input), 'utf-8').toString('base64url');
}
function fallbackId() {
    const rand = Math.random().toString(36).slice(2, 10);
    return `id-${Date.now()}-${rand}`;
}
export function generateUuidLike() {
    const fn = globalThis?.crypto?.randomUUID;
    if (typeof fn === 'function')
        return fn.call(globalThis.crypto);
    return fallbackId();
}
export function buildEpochWindow(ttlSeconds = 300) {
    const iat = Math.floor(Date.now() / 1000);
    return { iat, exp: iat + Math.max(1, Math.floor(ttlSeconds)) };
}
export function createVP(input) {
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
export function addVC(vpPayload, vcJwt) {
    const v = String(vcJwt || '').trim();
    if (v)
        vpPayload.vp.verifiableCredential.push(v);
    return vpPayload;
}
export function prepareForSignature(header, payload) {
    const encodedHeader = toB64UrlJson(header);
    const encodedPayload = toB64UrlJson(payload);
    return { encodedHeader, encodedPayload, signingInput: `${encodedHeader}.${encodedPayload}` };
}
export function prepareBytesForSignature(header, payload) {
    const { signingInput } = prepareForSignature(header, payload);
    return new TextEncoder().encode(signingInput);
}
export function buildVpTokenCompact(encodedHeader, encodedPayload, signatureBase64Url) {
    return `${encodedHeader}.${encodedPayload}.${String(signatureBase64Url || '').trim()}`;
}
