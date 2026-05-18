export type CommunicationClaims = Record<string, unknown>;

export type CommunicationTransformMode = 'strict' | 'normalize';

export type TransformCommunicationClaimsToResourceFhirR4Options = {
  /**
   * Validation mode:
   * - `strict`: throws when constraints are violated.
   * - `normalize`: applies deterministic fallback and records warnings.
   */
  mode?: CommunicationTransformMode;
  /**
   * Optional default status when not provided in claims.
   * FHIR R4 Communication.status is required, so this fills missing values.
   */
  defaultStatus?: string;
};

export type TransformCommunicationClaimsToResourceFhirR4Result = {
  resources: Array<Record<string, unknown>>;
  warnings: string[];
};

/**
 * Convert an array of flat Communication claims into FHIR R4 Communication resources.
 *
 * Contract:
 * - 1 input claims object maps to 1 output `Communication` resource (1:1).
 * - In this atomic conversion profile, only one payload kind is allowed per converted row:
 *   attachment OR reference OR code.
 * - In this atomic conversion profile, only one note text is allowed per converted row.
 * - Important: this does NOT redefine FHIR. Native FHIR Communication supports multiple payload[]
 *   and multiple note[] entries. This utility intentionally constrains each converted item to
 *   one logical atomic message for deterministic split/merge behavior.
 * - Canonical FHIR SearchParameter key names must be used in claims:
 *   e.g. `Communication.part-of` (never `Communication.partOf`).
 * - `resource.meta.claims` is always preserved in output.
 *
 * Payload claim keys:
 * - Attachment:
 *   - `Communication.content-attachment-data`
 *   - `Communication.content-attachment-type`
 *   - `Communication.content-attachment-title`
 *   - `Communication.content-attachment-url`
 * - Reference:
 *   - `Communication.content-reference`
 * - Code:
 *   - `Communication.content-code` as `system|code` or plain `code`
 *
 * Note claim keys:
 * - `Communication.note` (single string) OR array with one string.
 * - `Communication.text` is accepted as legacy alias for note text.
 *
 * In `normalize` mode, conflicts are resolved deterministically:
 * - payload priority: attachment > reference > code
 * - note priority: first non-empty note
 *
 * Future compatibility note:
 * - If multi-payload/multi-note ingestion is required for one FHIR Communication, apply an explicit
 *   split phase before this function (producing one claims row per atomic payload/note pair).
 */
export function transformCommunicationClaimsToResourceFhirR4(
  communicationClaims: CommunicationClaims[],
  options: TransformCommunicationClaimsToResourceFhirR4Options = {},
): TransformCommunicationClaimsToResourceFhirR4Result {
  const mode = options.mode ?? 'strict';
  const defaultStatus = options.defaultStatus ?? 'completed';
  const warnings: string[] = [];

  const resources = communicationClaims.map((claims, index) => {
    const payloadAttachmentData = toStringOrUndefined(claims['Communication.content-attachment-data']);
    const payloadAttachmentType = toStringOrUndefined(claims['Communication.content-attachment-type']);
    const payloadAttachmentTitle = toStringOrUndefined(claims['Communication.content-attachment-title']);
    const payloadAttachmentUrl = toStringOrUndefined(claims['Communication.content-attachment-url']);
    const payloadReference = toStringOrUndefined(claims['Communication.content-reference']);
    const payloadCodeRaw = toStringOrUndefined(claims['Communication.content-code']);

    const hasAttachment = Boolean(payloadAttachmentData || payloadAttachmentType || payloadAttachmentTitle || payloadAttachmentUrl);
    const hasReference = Boolean(payloadReference);
    const hasCode = Boolean(payloadCodeRaw);
    const payloadKinds = [hasAttachment, hasReference, hasCode].filter(Boolean).length;

    if (payloadKinds > 1) {
      const msg = `Communication[${index}] has more than one payload kind (attachment/reference/code).`;
      if (mode === 'strict') throw new Error(msg);
      warnings.push(`${msg} Keeping attachment > reference > code.`);
    }

    const noteValues = normalizeNoteValues(claims['Communication.note'] ?? claims['Communication.text']);
    if (noteValues.length > 1) {
      const msg = `Communication[${index}] has more than one note.`;
      if (mode === 'strict') throw new Error(msg);
      warnings.push(`${msg} Keeping first note only.`);
    }

    const payload = buildPayload({
      hasAttachment,
      hasReference,
      hasCode,
      payloadAttachmentData,
      payloadAttachmentType,
      payloadAttachmentTitle,
      payloadAttachmentUrl,
      payloadReference,
      payloadCodeRaw,
      mode,
    });

    const partOf = toStringOrUndefined(claims['Communication.part-of']);
    if (claims['Communication.partOf'] !== undefined) {
      const msg = `Communication[${index}] uses non-canonical key 'Communication.partOf'. Use 'Communication.part-of'.`;
      if (mode === 'strict') throw new Error(msg);
      warnings.push(msg);
    }

    const resource: Record<string, unknown> = {
      resourceType: 'Communication',
      status: toStringOrUndefined(claims['Communication.status']) || defaultStatus,
      meta: {
        claims: { ...claims },
      },
    };

    const identifier = toStringOrUndefined(claims['Communication.identifier']);
    if (identifier) resource['identifier'] = [{ value: identifier }];

    const sent = toStringOrUndefined(claims['Communication.sent']);
    if (sent) resource['sent'] = sent;

    const category = toStringOrUndefined(claims['Communication.category']);
    if (category) {
      const coding = parseSystemCode(category);
      resource['category'] = [{ coding: [coding] }];
    }

    const subject = toStringOrUndefined(claims['Communication.subject']);
    if (subject) resource['subject'] = { reference: subject };

    const recipient = toStringOrUndefined(claims['Communication.recipient']);
    if (recipient) resource['recipient'] = [{ reference: recipient }];

    const sender = toStringOrUndefined(claims['Communication.sender']);
    if (sender) resource['sender'] = { reference: sender };

    if (partOf) resource['partOf'] = [{ reference: partOf }];
    if (payload) resource['payload'] = [payload];
    if (noteValues.length) resource['note'] = [{ text: noteValues[0] }];

    return resource;
  });

  return { resources, warnings };
}

function normalizeNoteValues(raw: unknown): string[] {
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  return [];
}

function buildPayload(input: {
  hasAttachment: boolean;
  hasReference: boolean;
  hasCode: boolean;
  payloadAttachmentData?: string;
  payloadAttachmentType?: string;
  payloadAttachmentTitle?: string;
  payloadAttachmentUrl?: string;
  payloadReference?: string;
  payloadCodeRaw?: string;
  mode: CommunicationTransformMode;
}): Record<string, unknown> | undefined {
  const {
    hasAttachment,
    hasReference,
    hasCode,
    payloadAttachmentData,
    payloadAttachmentType,
    payloadAttachmentTitle,
    payloadAttachmentUrl,
    payloadReference,
    payloadCodeRaw,
  } = input;

  if (hasAttachment) {
    const value: Record<string, unknown> = {};
    if (payloadAttachmentData) value['data'] = payloadAttachmentData;
    if (payloadAttachmentType) value['contentType'] = payloadAttachmentType;
    if (payloadAttachmentTitle) value['title'] = payloadAttachmentTitle;
    if (payloadAttachmentUrl) value['url'] = payloadAttachmentUrl;
    return { contentAttachment: value };
  }

  if (hasReference) return { contentReference: { reference: payloadReference } };
  if (hasCode && payloadCodeRaw) return { contentCodeableConcept: { coding: [parseSystemCode(payloadCodeRaw)] } };
  return undefined;
}

function parseSystemCode(value: string): { system?: string; code: string } {
  const trimmed = String(value || '').trim();
  const separatorIndex = trimmed.indexOf('|');
  if (separatorIndex > 0) {
    const system = trimmed.slice(0, separatorIndex).trim();
    const code = trimmed.slice(separatorIndex + 1).trim();
    return { system, code };
  }
  return { code: trimmed };
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}
