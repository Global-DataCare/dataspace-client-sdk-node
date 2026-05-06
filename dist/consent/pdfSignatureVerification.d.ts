export interface PdfVerifySubmission {
    pdf_buffer: Buffer;
    content_type: string;
}
export interface PdfVerifyResult {
    ok: boolean;
    signer?: string;
    signing_time?: string;
    notes?: string[];
}
export interface PdfSignatureVerificationApi {
    verifyPdfSignature(submission: PdfVerifySubmission): Promise<PdfVerifyResult>;
}
export declare class PdfSignatureVerificationHttpApi implements PdfSignatureVerificationApi {
    private readonly endpoint;
    constructor(endpoint: string);
    verifyPdfSignature(submission: PdfVerifySubmission): Promise<PdfVerifyResult>;
}
