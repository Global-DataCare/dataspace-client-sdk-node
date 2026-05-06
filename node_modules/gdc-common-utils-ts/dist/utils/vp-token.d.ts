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
export declare function generateUuidLike(): string;
export declare function buildEpochWindow(ttlSeconds?: number): {
    iat: number;
    exp: number;
};
export declare function createVP(input?: Partial<VpTokenPayload>): VpTokenPayload;
export declare function addVC(vpPayload: VpTokenPayload, vcJwt: string): VpTokenPayload;
export declare function prepareForSignature(header: VpTokenHeader, payload: VpTokenPayload): {
    encodedHeader: string;
    encodedPayload: string;
    signingInput: string;
};
export declare function prepareBytesForSignature(header: VpTokenHeader, payload: VpTokenPayload): Uint8Array;
export declare function buildVpTokenCompact(encodedHeader: string, encodedPayload: string, signatureBase64Url: string): string;
