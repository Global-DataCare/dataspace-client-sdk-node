export type ContextualClaims = Record<string, unknown> & {
  '@context'?: string | readonly string[];
};

function trimTokenPart(value: string): string {
  return String(value ?? '').trim();
}

function extractContextPrefix(context: ContextualClaims['@context']): string | undefined {
  if (typeof context === 'string') {
    return trimTokenPart(context) || undefined;
  }

  if (Array.isArray(context)) {
    for (const item of context) {
      if (typeof item === 'string') {
        const trimmed = trimTokenPart(item);
        if (trimmed) return trimmed;
      }
    }
  }

  return undefined;
}

/**
 * Emit a canonical LOINC coding token.
 *
 * Accepts either a bare code or an already-prefixed token and always returns
 * the normalized `LOINC|<code>` form.
 */
export function buildLoincToken(code: string): string {
  const raw = trimTokenPart(code).replace(/^LOINC\|/i, '');
  return raw ? `LOINC|${raw}` : 'LOINC|';
}

/**
 * Emit a canonical LOINC i18n key.
 *
 * Accepts either a bare code or an already-prefixed key and always returns
 * the normalized `org.loinc.<code>` form.
 */
export function buildLoincI18nKey(code: string): string {
  const raw = trimTokenPart(code).replace(/^org\.loinc\./i, '');
  return raw ? `org.loinc.${raw}` : 'org.loinc.';
}

/**
 * Prefix contextual claim keys using the provided `@context`.
 *
 * Keys that are already fully-qualified, or keys that start with `@`, are
 * preserved as-is. This keeps canonical claim emissions stable while still
 * allowing compact authoring forms for context-scoped keys.
 */
export function normalizeContextualClaims<T extends ContextualClaims>(claims: T): T {
  const context = extractContextPrefix(claims['@context']);
  if (!context) return { ...claims };

  const prefix = `${context}.`;
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(claims)) {
    if (key === '@context' || key.startsWith('@') || key.startsWith(prefix) || key.includes('.')) {
      normalized[key] = value;
      continue;
    }
    normalized[`${prefix}${key}`] = value;
  }

  return normalized as T;
}
