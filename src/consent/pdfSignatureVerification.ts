// pdfSignatureVerification.ts
// Node.js SDK contract for PDF signature verification

export interface PdfVerifySubmission {
  pdf_buffer: Buffer; // PDF as Buffer
  content_type: string; // standardized snake_case for API
  // Optionally: patient_id, metadata, etc.
}

export interface PdfVerifyResult {
  ok: boolean;
  signer?: string;
  signing_time?: string;
  notes?: string[];
  // Optionally: extracted_claims, credential, etc.
}

export interface PdfSignatureVerificationApi {
  verifyPdfSignature(submission: PdfVerifySubmission): Promise<PdfVerifyResult>;
}

import fetch from 'node-fetch';

export class PdfSignatureVerificationHttpApi implements PdfSignatureVerificationApi {
  constructor(private readonly endpoint: string) {}

  async verifyPdfSignature(submission: PdfVerifySubmission): Promise<PdfVerifyResult> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: submission.pdf_buffer,
    });
    if (!res.ok) throw new Error('PDF verification failed: ' + res.status);
    return (await res.json()) as PdfVerifyResult;
  }
}

// Usage (Node):
// const api = new PdfSignatureVerificationHttpApi('https://api.example.com/verify-pdf');
// const result = await api.verifyPdfSignature({ pdf_buffer, content_type: 'application/pdf' });
// if (result.ok) { ... }