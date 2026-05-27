/**
 * lyricSegmenter.ts  v3.1
 * Splits raw lyric text into structured LyricLine objects.
 * Supersedes the flat string[] approach — now preserves stanza boundaries,
 * annotation markers, and RTL metadata for downstream consumers.
 *
 * docs_fusion_optimal.md §3 (segmentation) + §4 (RN extraction).
 */

/** Structural section marker: [Verse 1], [Chorus], (hook), etc. */
const SECTION_MARKER_RE = /^\s*[\[\(].+[\]\)]\s*$/;

/** RTL language codes — no impact on split logic, used for metadata only. */
const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'yi', 'ps', 'ug']);

/**
 * Scripts that have no inter-word spaces — extraction falls back to
 * last N Unicode grapheme clusters rather than last whitespace token.
 */
const SCRIPTLESS_SPACE_LANGS = new Set([
  'zh', 'zh-cn', 'zh-tw', 'yue',   // Sinitic
  'ja',                              // Japanese
  'th', 'lo',                        // Tai-Kadai
  'km',                              // Khmer
  'my',                              // Burmese
]);

// ─── Public types ───────────────────────────────────────────────────────────────────

export interface LyricLine {
  /** 0-based global position in the full text. */
  index: number;
  /** Raw trimmed text of the line. */
  text: string;
  /** True for empty lines — stanza separators, not passed to the rhyme engine. */
  isBlank: boolean;
  /** True for section markers like [Verse 1] or (hook). */
  isAnnotation: boolean;
  /** Stanza index — increments on each blank-line boundary. */
  stanzaIndex: number;
  /** 0-based position within its stanza (blank/annotation lines excluded). */
  lineInStanza: number;
  /** True for RTL language codes. */
  isRTL: boolean;
}

/**
 * Structured result of extractLineEndingUnit.
 *
 * - surface        : raw extracted token (before normalization)
 * - normalized     : token ready for G2P / RN comparison
 * - segmentationMode : how the token was isolated
 * - script         : detected Unicode script block
 * - warnings       : non-empty when fallback heuristics were applied
 */
export interface LineEndingUnit {
  surface: string;
  normalized: string;
  segmentationMode: 'space' | 'grapheme-cluster' | 'rtl-space';
  script: 'latin' | 'cjk' | 'arabic' | 'hebrew' | 'devanagari' | 'hangul' | 'thai' | 'other';
  warnings: string[];
}

// ─── Script detection ───────────────────────────────────────────────────────────

function detectScript(token: string): LineEndingUnit['script'] {
  if (!token) return 'other';
  const cp = token.codePointAt(0) ?? 0;
  if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3040 && cp <= 0x30FF)) return 'cjk';
  if (cp >= 0x0600 && cp <= 0x06FF) return 'arabic';
  if (cp >= 0x05D0 && cp <= 0x05EA) return 'hebrew';
  if (cp >= 0x0900 && cp <= 0x097F) return 'devanagari';
  if (cp >= 0xAC00 && cp <= 0xD7A3) return 'hangul';
  if (cp >= 0x0E00 && cp <= 0x0E7F) return 'thai';
  if ((cp >= 0x0041 && cp <= 0x007A) || (cp >= 0x00C0 && cp <= 0x024F)) return 'latin';
  return 'other';
}

// ─── Punctuation stripping — script-aware (leading + trailing) ─────────────────────

/**
 * Latin trailing punctuation (includes typographic closing quotes \u201D \u2019).
 * Does NOT strip tonal diacritics.
 */
const LATIN_TRAIL_RE = /[.,!?;:"'\xab\xbb\u201C\u201D\u2018\u2019\u2026\-\u2013\u2014\)\]]+$/u;

/**
 * Latin leading punctuation: opening quotes, brackets, dashes.
 * \u201C = \u201C (left double), \u2018 = \u2018 (left single), \xab = \u00AB (guillemet),
 * \u2014 = em-dash, \u2013 = en-dash.
 * Intentionally narrow to avoid stripping diacritic-bearing initials.
 */
const LATIN_LEAD_RE = /^["'\xab\u201C\u2018\u2039\u2014\u2013\-\(\[]+/u;

/**
 * Tonal-safe trailing strip: only ASCII punctuation, no diacritic removal.
 */
const TONAL_LATIN_TRAIL_RE = /[.,!?;:"'\u2026\-\u2013\u2014\)\]]+$/u;

/** Tonal-safe leading strip: ASCII only. */
const TONAL_LATIN_LEAD_RE = /^["'\-\(\[]+/u;

/**
 * Arabic / Hebrew trailing punctuation (right-side strip after logical reversal).
 * Preserves shadda, hamza, and all vocalic diacritics.
 */
const ARABIC_TRAIL_RE = /[\u060C\u061B\u061F\u06D4.,!?]+$/u;
const HEBREW_TRAIL_RE = /[\u05F3\u05F4.,!?:"']+$/u;

/** CJK / Thai fullwidth punctuation. */
const CJK_TRAIL_RE = /[\uff01\uff0c\uff0e\uff1f\u3002\u3001\uff1b\uff1a]+$/u;

function stripBoth(
  token: string,
  script: LineEndingUnit['script'],
  tonal: boolean,
): string {
  if (!token) return token;
  let t = token;
  switch (script) {
    case 'arabic':
      t = t.replace(ARABIC_TRAIL_RE, '');
      break;
    case 'hebrew':
      t = t.replace(HEBREW_TRAIL_RE, '');
      break;
    case 'cjk':
    case 'thai':
    case 'hangul':
    case 'devanagari':
      t = t.replace(CJK_TRAIL_RE, '');
      break;
    case 'latin':
    default:
      if (tonal) {
        t = t.replace(TONAL_LATIN_TRAIL_RE, '').replace(TONAL_LATIN_LEAD_RE, '');
      } else {
        t = t.replace(LATIN_TRAIL_RE, '').replace(LATIN_LEAD_RE, '');
      }
      break;
  }
  return t;
}

// ─── Tonal language detection ───────────────────────────────────────────────────────────

/**
 * Language codes where tonal diacritics must NOT be stripped or lowercased.
 */
const TONAL_LANGS = new Set([
  'vi',
  'th', 'lo',
  'yo', 'ibo', 'ewe', 'tw', 'ba',
  'ln',
]);

// ─── Grapheme cluster iterator ──────────────────────────────────────────────────────────

function toGraphemeClusters(str: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    // `Intl.Segmenter` is available in all modern browsers but the TS lib
    // shipped at the time of writing does not always expose it; use a
    // narrowly-typed structural reference instead of `any`.
    type SegmenterCtor = new (
      locales?: string | string[],
      options?: { granularity?: 'grapheme' | 'word' | 'sentence' },
    ) => { segment: (input: string) => Iterable<{ segment: string }> };
    const SegmenterRef = (Intl as unknown as { Segmenter: SegmenterCtor }).Segmenter;
    const seg = new SegmenterRef(undefined, { granularity: 'grapheme' });
    return [...seg.segment(str)].map(s => s.segment);
  }
  return [...str];
}

// ─── Core extraction ──────────────────────────────────────────────────────────────

export function extractLineEndingUnit(
  line: string,
  langCode: string = 'fr',
): LineEndingUnit {
  const warnings: string[] = [];
  const lang = langCode.toLowerCase().split('-')[0] ?? 'fr';

  if (!line || !line.trim()) {
    return { surface: '', normalized: '', segmentationMode: 'space', script: 'other', warnings: ['empty line'] };
  }

  const trimmed = line.trim();

  // ── Path 1: scripts without word spaces ─────────────────────────────────────
  if (SCRIPTLESS_SPACE_LANGS.has(lang) || SCRIPTLESS_SPACE_LANGS.has(langCode.toLowerCase())) {
    const clusters = toGraphemeClusters(trimmed);
    const endClusters = clusters.slice(-3).join('');
    const script = detectScript(endClusters);
    const stripped = stripBoth(endClusters, script, false);
    return { surface: endClusters, normalized: stripped, segmentationMode: 'grapheme-cluster', script, warnings };
  }

  // ── Path 2: RTL scripts ──────────────────────────────────────────────────────
  if (RTL_LANGS.has(lang)) {
    const tokens = trimmed.split(/\s+/);
    const last = tokens[tokens.length - 1] ?? '';
    const script = detectScript(last);
    const stripped = stripBoth(last, script, false);
    return { surface: last, normalized: stripped, segmentationMode: 'rtl-space', script, warnings };
  }

  // ── Path 3 & 4: space-delimited (Latin, Cyrillic, Devanagari, Hangul…) ───
  const tokens = trimmed.split(/\s+/);
  const last = tokens[tokens.length - 1] ?? '';

  if (!last) {
    warnings.push('no token found — falling back to full line');
    return { surface: trimmed, normalized: trimmed.toLowerCase(), segmentationMode: 'space', script: 'other', warnings };
  }

  const script = detectScript(last);
  const isTonal = TONAL_LANGS.has(lang);

  const stripped = stripBoth(last, script, isTonal);
  const normalized = isTonal ? stripped : stripped.toLowerCase();

  return { surface: last, normalized, segmentationMode: 'space', script, warnings };
}

// ─── Main export ────────────────────────────────────────────────────────────────────

export function splitLyricIntoLines(text: string, langCode: string): LyricLine[] {
  if (!text || !text.trim()) return [];

  const isRTL = RTL_LANGS.has(langCode.toLowerCase().split('-')[0] ?? '');
  const rawLines = text.split('\n');
  const result: LyricLine[] = [];

  let globalIndex = 0;
  let stanzaIndex = 0;
  let lineInStanza = 0;
  let lastWasBlank = false;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    const isBlank = trimmed.length === 0;
    const isAnnotation = !isBlank && SECTION_MARKER_RE.test(trimmed);

    if (isBlank) {
      if (!lastWasBlank) {
        result.push({ index: globalIndex++, text: '', isBlank: true, isAnnotation: false, stanzaIndex, lineInStanza: 0, isRTL });
        stanzaIndex++;
        lineInStanza = 0;
      }
      lastWasBlank = true;
      continue;
    }

    lastWasBlank = false;
    result.push({ index: globalIndex++, text: trimmed, isBlank: false, isAnnotation, stanzaIndex, lineInStanza: isAnnotation ? 0 : lineInStanza, isRTL });
    if (!isAnnotation) lineInStanza++;
  }

  return result;
}

// ─── Legacy compat ───────────────────────────────────────────────────────────────────

export function splitIntoRhymingLines(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !SECTION_MARKER_RE.test(l));
}

/**
 * @deprecated Use extractLineEndingUnit() instead.
 */
export function extractLineTail(line: string, langCode: string = 'fr'): string {
  return extractLineEndingUnit(line, langCode).normalized;
}
