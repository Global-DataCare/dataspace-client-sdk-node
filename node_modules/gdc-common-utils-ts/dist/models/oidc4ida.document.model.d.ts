import { AttachmentExternalDLT, CheckDetails, VerifierDLT } from './oidc4ida.common.model';
import { IssuerElectronicRecordDLT } from './oidc4ida.electronicRecord.model';
/** Common for Document and Bill evidences  */
export interface EvidenceCommonSubElementDLT {
    method: string;
    time?: string;
}
/** Predefined method values are given in Verification Methods (https://bitbucket.org/openid/ekyc-ida/wiki/identifiers)
 * - pipp (Physical In-Person Proofing)
 * - sripp (Supervised remote In-Person Proofing)
 * - eid (Online verification of an electronic ID card)
 * - uripp (Unsupervised remote in-person proofing with video capture of the ID document, user self-portrait video and liveness checks).
 */
export interface EvidenceDocumentDLT extends EvidenceCommonSubElementDLT {
    attachments?: AttachmentExternalDLT;
    check_details?: CheckDetails[];
    document_details?: DocumentDetailsDLT;
    method: string;
    time?: string;
    type: 'document';
    verifier: VerifierDLT;
}
/** OpenID 'document' evidence sub-element.
 * - 'type' of the (physical) document (standarized).
 * - 'date_of_issuance' is the date the document was issued as ISO 8601:2004 YYYY-MM-DD format.
 * - 'date_of_expiry' is the date the document will expire as ISO 8601:2004 YYYY-MM-DD format.
 * - 'serial_number' is the model of the document irrespective of any personalization information (usually physical artefacts and is present before personalization).
 * - 'document_number' is the unique document ID that was issued to the End-User and will change if it is reissued, e.g., a passport number, certificate number, etc.
 *  Note: number can be used as an alias for 'document_number' for backward compatibilty purposes but will be deprecated in future releases, implementers are recommended to use document_number.
 */
export interface DocumentDetailsBase {
    date_of_expiry?: string;
    date_of_issuance?: string;
    document_number?: string;
    serial_number?: string;
    type: string;
}
/** JSON object representing the document used to perform the identity verification.
 *  - type: REQUIRED. Standardized values are defined in the Identity Documents section. The OP MAY use other than the predefined values in which case the RPs will either be unable to process the assertion, just store this value for audit purposes, or apply bespoken business logic to it.
 *  - personal_number: OPTIONAL. It is the subject's DID URI (can be also the holder).
 *  - issuer: OPTIONAL. JSON object containing information about the issuer of this document.
 *  - date_of_issuance: REQUIRED. If this attribute exists for the particular type of document. The date the document was issued as ISO 8601:2004 YYYY-MM-DD format.
 *  - date_of_expiry: REQUIRED. If this attribute exists for the particular type of document. The date the document will expire as ISO 8601:2004 YYYY-MM-DD format.
 *  - document_number: OPTIONAL. Unique document ID that was issued to the End-User. This is used on one document and will change if it is reissued, e.g., a passport number, certificate number, etc. Note: number can be used as an alias for 'document_number' for backward compatibilty purposes but will be deprecated in future releases, implementers are recommended to use document_number.
 *  - serial_number: OPTIONAL. Model of document irrespective of any personalization information (usually physical artefacts and is present before personalization).
 */
export interface DocumentDetailsDLT extends DocumentDetailsBase {
    issuer?: IssuerElectronicRecordDLT;
    personal_number?: string;
}
