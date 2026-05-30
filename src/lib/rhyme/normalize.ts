/**
 * Rhyme Engine v3 — Normalization, Line Ending Extraction & Block Segmentation
 */

import type { LineEndingUnit, ScriptClass, SegmentationMode, LangCode } from './types';

const TONE_MARK_LANGS = new Set(['vi', 'ba', 'ew', 'mi', 'di']);

// ─── Script detection ─────────────────────────────────────────────────────────

const SCRIPT_RANGES: Array<[RegExp, ScriptClass]> = [
  [/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u, 'arabic'],
  [/[\u0590-\u05FF\uFB1D-\uFB4F]/u,              'hebrew'],
  [/[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF]/u, 'cjk'],
  [/[\u0E00-\u0E7F]/u,                            'thai'],
  [/[\u1780-\u17FF]/u,                            'khmer'],
  [/[\u0400-\u04FF]/u,                            'cyrillic'],
  [/[\u0900-\u097F]/u,                            'devanagari'],
  [/[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/u,        'latin'],
];

function detectScript(text: string): ScriptClass {
  for (const [re, cls] of SCRIPT_RANGES) {
    if (re.test(text)) return cls;
  }
  return 'other';
}

// ─── Segmentation mode ────────────────────────────────────────────────────────

function segmentationModeForScript(script: ScriptClass): SegmentationMode {
  switch (script) {
    case 'cjk':    return 'character';
    case 'arabic':
    case 'hebrew': return 'rtl';
    case 'thai':
    case 'khmer':  return 'tonal-syllable';
    default:       return 'whitespace';
  }
}

function resolveSegmentationMode(script: ScriptClass, langHint?: string): SegmentationMode {
  if (langHint && TONE_MARK_LANGS.has(langHint) && script === 'latin') return 'tone-mark';
  return segmentationModeForScript(script);
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeInput(raw: string): string {
  return raw.normalize('NFC').trim();
}

// ─── Annotation strip ─────────────────────────────────────────────────────────
//
// Parenthetical content — backing vocals, harmony cues, stage directions —
// must NOT participate in rhyme scoring.  We strip ALL bracketed blocks
// from the working line before token extraction.
//
// Bracket pairs covered:
//   ( )  — Latin/universal
//   [ ]  — editorial / chord notation
//   { }  — templating / annotation
//   ＜ ＞ — fullwidth (CJK annotations)
//   （ ） — fullwidth parentheses (Japanese / Chinese)
//   【 】— CJK lenticular brackets
//   〔 〕— tortoise-shell brackets
//   「 」— Japanese corner brackets (often used for asides)
//
// Nesting is NOT handled — a single greedy pass is sufficient for lyrics.
// If stripping reduces the line to whitespace the original is returned so
// the caller always has something to work with.

const ANNOTATION_BLOCK_RE =
  /[([{＜（【〔「][^\])}＞）】〕」]*[\])}＞）】〕」]/gu;

function stripAnnotations(line: string): string {
  const stripped = line.replace(ANNOTATION_BLOCK_RE, '').trim();
  return stripped.length > 0 ? stripped : line;
}

// ─── Punctuation ──────────────────────────────────────────────────────────────

const LATIN_PUNCT   = /[.,;:!?¡¿"'«»()\[\]{}…–—]+$/u;
const ARABIC_PUNCT  = /[،؛؟\u06D4\.!"'()\[\]{}…]+$/u;
const CJK_PUNCT     = /[。、！？「」『』【】〔〕…・]+$/u;
const GENERIC_PUNCT = /[\p{P}\p{S}]+$/u;

function stripTrailingPunctuation(token: string, script: ScriptClass): string {
  switch (script) {
    case 'arabic':
    case 'hebrew': return token.replace(ARABIC_PUNCT, '');
    case 'cjk':    return token.replace(CJK_PUNCT, '');
    case 'latin':  return token.replace(LATIN_PUNCT, '');
    default:       return token.replace(GENERIC_PUNCT, '');
  }
}

// ─── RTL languages ────────────────────────────────────────────────────────────

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

function isRTLLang(lang?: string): boolean {
  return !!lang && RTL_LANGS.has(lang);
}

// ─── French hemistich split ───────────────────────────────────────────────────

const FR_HEMISTICH_RE = /\s{3,}|[—]\s|\s;\s/;

function splitFrenchHemistich(line: string): [string, string] | null {
  const match = FR_HEMISTICH_RE.exec(line);
  if (!match || match.index < 3) return null;
  return [line.slice(0, match.index).trimEnd(), line.slice(match.index + match[0].length).trimStart()];
}

// ─── Token extraction ─────────────────────────────────────────────────────────

function extractFinalToken(normalized: string, mode: SegmentationMode, script: ScriptClass): string {
  switch (mode) {
    case 'character': {
      const chars = [...normalized].filter(c => !/[\p{P}\p{S}]/u.test(c));
      return chars.at(-1) ?? normalized.at(-1) ?? '';
    }
    case 'rtl': {
      const tokens = normalized.split(/\s+/).filter(Boolean);
      const raw = tokens[0] ?? '';
      return stripTrailingPunctuation(raw, script);
    }
    case 'tonal-syllable': {
      const tokens = normalized.split(/[\s\u200B]+/).filter(Boolean);
      const raw = tokens.at(-1) ?? '';
      return stripTrailingPunctuation(raw, script);
    }
    case 'tone-mark': {
      const tokens = normalized.split(/\s+/).filter(Boolean);
      const raw = tokens.at(-1) ?? '';
      return raw.replace(LATIN_PUNCT, '');
    }
    case 'whitespace':
    default: {
      const tokens = normalized.split(/\s+/).filter(Boolean);
      const raw = tokens.at(-1) ?? '';
      return stripTrailingPunctuation(raw, script);
    }
  }
}

// ─── Public: extractLineEndingUnit ───────────────────────────────────────────

export function extractLineEndingUnit(line: string, langHint?: string): LineEndingUnit {
  const warnings: string[] = [];
  const normalized = normalizeInput(line);

  if (!normalized) {
    warnings.push('empty-line');
    return { surface: '', normalized: '', script: 'other', segmentationMode: 'unknown', warnings };
  }

  const script = detectScript(normalized);
  const segmentationMode = resolveSegmentationMode(script, langHint);

  // Strip parenthetical annotations (backing vocals, harmony cues, stage
  // directions) BEFORE token extraction so they never pollute rhyme scoring.
  const deAnnotated = stripAnnotations(normalized);

  const workingNorm = isRTLLang(langHint)
    ? deAnnotated.split(/\s+/).reverse().join(' ')
    : deAnnotated;

  const surface = extractFinalToken(workingNorm, segmentationMode, script);

  if (!surface) warnings.push('no-token-extracted');

  return { surface, normalized, script, segmentationMode, warnings };
}

// ─── Public: segmentBlock ────────────────────────────────────────────────────

export function segmentBlock(text: string, lang?: LangCode): string[] {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: string[] = [];

  for (const line of rawLines) {
    if (lang === 'fr' || lang === 'ca') {
      const hemi = splitFrenchHemistich(line);
      if (hemi) {
        result.push(hemi[0], hemi[1]);
        continue;
      }
    }
    result.push(line);
  }

  return result;
}
