/**
 * Converts a UI locale identifier to a full English language name
 * suitable for AI prompt injection.
 *
 * Accepts:
 * - Canonical UI langIds: "ui:fr"
 * - Locale codes: "fr", "fr-FR", "fr_FR"
 */
export const resolveUiLanguageName = (value: string): string => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return 'English';

  const withoutPrefix = raw.startsWith('ui:') ? raw.slice(3) : raw;
  const primarySubtag = withoutPrefix.split(/[-_]/)[0];

  switch (primarySubtag) {
    case 'fr': return 'French';
    case 'es': return 'Spanish';
    case 'de': return 'German';
    case 'pt': return 'Portuguese';
    case 'ar': return 'Arabic';
    case 'zh': return 'Chinese';
    case 'ko': return 'Korean';
    default: return 'English';
  }
};
