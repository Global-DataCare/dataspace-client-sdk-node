// pdfSignatureVerification.ts
// Node.js SDK contract for PDF signature verification
import fetch from 'node-fetch';
export class PdfSignatureVerificationHttpApi {
    endpoint;
    constructor(endpoint) {
        this.endpoint = endpoint;
    }
    async verifyPdfSignature(submission) {
        const res = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/pdf' },
            body: submission.pdf_buffer,
        });
        if (!res.ok)
            throw new Error('PDF verification failed: ' + res.status);
        return (await res.json());
    }
}
// Usage (Node):
// const api = new PdfSignatureVerificationHttpApi('https://api.example.com/verify-pdf');
// const result = await api.verifyPdfSignature({ pdf_buffer, content_type: 'application/pdf' });
// if (result.ok) { ... }
