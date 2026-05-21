export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export function toDidWebFromUrlOrHost(raw: string): string | undefined {
  const v = String(raw || '').trim();
  if (!v) return undefined;
  if (v.startsWith('did:web:')) return v;
  const host = v
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();
  if (!host) return undefined;
  return `did:web:${host}`;
}

export function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const raw = header.trim();
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1000);
  }
  const epochMs = Date.parse(raw);
  if (Number.isFinite(epochMs)) {
    const delta = epochMs - Date.now();
    return delta > 0 ? delta : 0;
  }
  return undefined;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.floor(ms))));
}

export function normalizeCommunicationPathFormatSegment(
  raw?: 'org.hl7.fhir.api' | 'org.hl7.fhir.r4' | 'api' | 'r4' | 'fhir.r4',
): 'org.hl7.fhir.api' | 'org.hl7.fhir.r4' {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'api' || value === 'org.hl7.fhir.api') return 'org.hl7.fhir.api';
  if (value === 'r4' || value === 'fhir.r4' || value === 'org.hl7.fhir.r4') return 'org.hl7.fhir.r4';
  return 'org.hl7.fhir.api';
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function isRetryableTransportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /fetch failed|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|abort/i.test(message);
}

export function isDemoMode(mode?: string): boolean {
  return String(mode || '').toLowerCase() === 'demo';
}

export function normalizeBearerToken(rawToken?: string): string | undefined {
  if (!rawToken) return undefined;
  const trimmed = String(rawToken).trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^Bearer\s+/i, '').trim() || undefined;
}

export function redactSensitive(value: unknown): Record<string, unknown> {
  const redacted = JSON.parse(JSON.stringify(value, (key, nestedValue) => {
    if (/token|authorization|secret|password|assertion/i.test(String(key || ''))) {
      return '[redacted]';
    }
    return nestedValue;
  }));
  return redacted && typeof redacted === 'object' ? redacted as Record<string, unknown> : {};
}
