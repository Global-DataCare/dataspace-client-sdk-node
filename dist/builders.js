export function createDidcommPlainMessage(input) {
    const random = Math.random().toString(36).slice(2, 10);
    const now = Date.now();
    const thid = input.thid ?? `thid-${now}-${random}`;
    const jti = input.jti ?? `jti-${now}-${random}`;
    return {
        jti,
        thid,
        iss: input.iss,
        aud: input.aud,
        type: input.type ?? 'application/api+json',
        body: input.body,
    };
}
export function buildAsyncPollRequest(thid) {
    return { thid };
}
