import type { DidcommPlainMessage } from './types.js';
export declare function createDidcommPlainMessage(input: {
    iss: string;
    aud: string;
    body: Record<string, unknown>;
    type?: string;
    jti?: string;
    thid?: string;
}): DidcommPlainMessage;
export declare function buildAsyncPollRequest(thid: string): {
    thid: string;
};
