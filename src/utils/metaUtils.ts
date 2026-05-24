/**
 * Known section-header keywords that must NOT be treated as meta-instructions.
 */
export const BRACKET_TOKEN_REGEX = /[\[［【「『〔〈《]([^\]］】」』〕〉》]+)[\]］】」』〕〉》]/g;
export const BRACKETED_LINE_REGEX = /^(?:\*\*)?[\[［【「『〔〈《](.+?)[\]］】」』〕〉》](?:\*\*)?$/;
const EMPTY_BRACKET_LINE_REGEX = /^[\[［【「『〔〈《]\s*[\]］】」』〕〉》]$/;

const SECTION_HEADER_PATTERNS = [
  /^intro/i,
  /^verse/i,
  /^pre[- ]?chorus/i,
  /^post[- ]?chorus/i,
  /^chorus/i,
  /^final[- ]chorus/i,
  /^bridge/i,
  /^breakdown/i,
  /^outro/i,
  /^couplet/i,
  /^refrain/i,
  /^refrain[- ]final/i,
  /^pont/i,
  /^hook/i,
  /^tag/i,
  /^solo/i,
  /^interlude/i,
  /^spoken/i,
  /^drop/i,
  /^vamp/i,
  // French variants
  /^pr[eé][- ]?refrain/i,
  /^pr[eé][- ]?chorus/i,
  /^post[- ]?refrain/i,
  /^double[- ]chorus/i,
  /^final[- ]refrain/i,
];

export const isSectionHeader = (inner: string): boolean =>
  SECTION_HEADER_PATTERNS.some(re => re.test(inner.trim()));

export const unwrapBracketToken = (value: string): string | null => {
  const match = value.trim().match(BRACKETED_LINE_REGEX);
  return match?.[1]?.trim() || null;
};

/**
 * Returns true if a raw text line is a pure bracketed line (meta-instruction
 * and/or section marker). Anything inside `[]` is non-lyric content and must
 * never be rendered as a lyric.
 *
 *   [Rhythmic Upbeat | Alto harmonica riff]     → true  (single, non-header)
 *   [Intro][Deep dry kicks]                     → true  (multi-token)
 *   [Pre-Chorus][Soft Women choir answers]      → true
 *   [Chorus][Alto harmonica answers]            → true
 *   [Verse 1]                                   → true  (pure section marker)
 *   [Guitar solo]                               → true  (pure meta instruction)
 *   Si ton amour est comme une transaction.     → false (plain lyric)
 *
 * Algorithm:
 *   1. The trimmed line must consist ONLY of bracket tokens (no text outside brackets).
 *   2. At least one non-empty bracket token must be present.
 *   Section-header tokens ([Intro], [Chorus]…) DO count: per the product
 *   requirement, nothing inside `[]` may be treated as lyrics.
 */
export const isPureMetaLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Must contain at least one opening bracket
  BRACKET_TOKEN_REGEX.lastIndex = 0;
  if (!BRACKET_TOKEN_REGEX.test(trimmed)) return false;
  BRACKET_TOKEN_REGEX.lastIndex = 0;

  // Collect all bracket tokens and verify nothing exists outside them
  const tokens: string[] = [];
  const regex = BRACKET_TOKEN_REGEX;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(trimmed)) !== null) {
    // Any text between brackets means this is not a pure meta line
    if (match.index > last) {
      const between = trimmed.slice(last, match.index);
      if (between.trim()) return false;
    }
    tokens.push(match[1]!.trim());
    last = match.index + match[0].length;
  }
  // Any trailing text after the last bracket
  if (last < trimmed.length && trimmed.slice(last).trim()) return false;

  // Need at least one non-empty token — whether section header or meta.
  return tokens.some(t => t.length > 0);
};

/**
 * Returns true if the line is a bare empty-bracket artifact: [] or [  ]
 */
export const isEmptyBracketLine = (line: string): boolean => {
  const trimmedLine = line.trim();
  if (trimmedLine === '[]') return true;
  const m = trimmedLine.match(EMPTY_BRACKET_LINE_REGEX);
  return m !== null;
};

/**
 * Tokenizes a meta line into display parts.
 * For meta tokens, returns `inner` (WITHOUT surrounding brackets) so MetaLine
 * can render them without duplication with its own bracket badge.
 *
 * Section-header tokens ([Intro], [Chorus]…) embedded ALONGSIDE other meta
 * tokens are skipped — not rendered as badges, not rendered as plain text —
 * because the section header is already shown above the lyrics.
 *
 * However, when the line consists ONLY of section-header tokens (e.g. a stray
 * `[Verse 1]` that ended up in the lyric area), they ARE rendered so the user
 * can see the marker rather than the line being silently dropped.
 *
 * Fallback: if the text contains NO brackets at all (AI omitted them),
 * the entire text is treated as a single isMeta token so MetaLine always
 * renders the [ ] visual wrapper and cyan styling.
 */
export const tokenizeMetaInline = (
  text: string
): Array<{ text: string; isMeta: boolean }> => {
  const trimmed = text.trim();

  // Fast path: no brackets at all — treat entire text as meta token
  BRACKET_TOKEN_REGEX.lastIndex = 0;
  if (!BRACKET_TOKEN_REGEX.test(trimmed)) {
    BRACKET_TOKEN_REGEX.lastIndex = 0;
    const content = trimmed;
    if (content) return [{ text: content, isMeta: true }];
    return [];
  }
  BRACKET_TOKEN_REGEX.lastIndex = 0;

  // First pass: detect whether any non-section-header bracket token exists.
  // When all bracket tokens are section headers, we still render them so the
  // marker is visible to the user instead of producing an empty meta line.
  const detectRegex = BRACKET_TOKEN_REGEX;
  let detectMatch: RegExpExecArray | null;
  let hasNonHeaderToken = false;
  while ((detectMatch = detectRegex.exec(text)) !== null) {
    const inner = (detectMatch[1] ?? '').trim();
    if (inner && !isSectionHeader(inner)) {
      hasNonHeaderToken = true;
      break;
    }
  }
  detectRegex.lastIndex = 0;

  const parts: Array<{ text: string; isMeta: boolean }> = [];
  const regex = BRACKET_TOKEN_REGEX;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const inner = match[1] ?? '';
    if (match.index > last) {
      const between = text.slice(last, match.index);
      if (between.trim()) parts.push({ text: between, isMeta: false });
    }
    const innerTrimmed = inner.trim();
    if (innerTrimmed) {
      // Skip section-header tokens only when there's other non-header meta
      // content on the line (avoid duplicate display of the section name).
      if (!hasNonHeaderToken || !isSectionHeader(innerTrimmed)) {
        parts.push({ text: innerTrimmed, isMeta: true });
      }
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    const tail = text.slice(last);
    if (tail.trim()) parts.push({ text: tail, isMeta: false });
  }
  return parts;
};
