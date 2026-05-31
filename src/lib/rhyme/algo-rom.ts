/**
 * Rhyme Engine v2 — Romance Family Algorithm
 * Languages: FR, ES, IT, PT, RO, CA
 * Strategy: rule-based G2P + silent-e handling + mute final consonants (FR/CA)
 *
 * IMPORTANT: all extraction operates on the LAST WHITESPACE-DELIMITED TOKEN
 * of unit.surface, not on the full surface string.  The engine passes the
 * line-ending unit which may contain several words; rhyme lives in the last
 * word only.
 */

import type { LineEndingUnit, LangCode, RhymeNucleus } from './types';

// ─── French / Catalan mute final consonants ───────────────────────────────────
// NOTE: 'l' and 'r' are intentionally excluded — they are phonetically
// realised in most French lyric words (ciel /sjɛl/, amour /amuʁ/).
const FR_MUTE_FINALS = /[bcdghpqst]+$/i;

// French silent suffixes — longer alternatives must precede shorter ones that
// are a prefix of them (leftmost-match ordering), otherwise the shorter
// alternative shadows the longer (e.g. `ent` must precede `e`).
// Covers: -ent (ils chantent), -aient (imparfait), -eront/-iront (futur),
//         -es (2s présent / pluriel), bare -e (e muet).
// NOTE: -ont / -ons are intentionally NOT here — see FR_NASAL_VERBAL_FINAL
// below for the dedicated terminal-consonant-only strip that preserves `on`.
const FR_SILENT_SUFFIX = /(?:aient|eront|iront|uront|aront|ent|es|e)$/i;

// Strip only the terminal `t` or `s` of verbal -ont/-ons forms, preserving
// the nasal nucleus `on`. Applied as a SECOND PASS only when FR_SILENT_SUFFIX
// did NOT fire (effectiveEnd === joined.length), so it never touches words
// whose verbal suffix was already handled (chanteront → already stripped to
// `chanter` by FR_SILENT_SUFFIX before this regex is reached).
//
// seront  → seron   (nucleus `on`) → rhymes avec chanson, maison ✓
// feront  → feron   (nucleus `on`) ✓
// allons  → allon   (nucleus `on`) ✓
// maisons → maison  via FR_MUTE_FINALS (s stripped separately) ✓  — not affected
// chansons→ chanson via FR_MUTE_FINALS ✓  — not affected
//
// NOTE: written WITHOUT a lookbehind. Lookbehind in a regex literal is a
// syntax error on Safari/WebKit < 16.4 and crashes the whole module at parse
// time. We capture `on` explicitly and remap the strip offset to just after it
// (see `effectiveEnd = nasalMatch.index + 2` below).
const FR_NASAL_VERBAL_FINAL = /on[ts]$/i;

// ─── Whitelist: French words whose final consonant IS pronounced ──────────────
// These must NOT have their consonants stripped by FR_MUTE_FINALS,
// and must NOT be touched by FR_NASAL_VERBAL_FINAL.
const FR_PRONOUNCED_FINALS = new Set([
  // Native French — final consonant phonetically realised
  'font', 'sont', 'dont', 'pont', 'mont', 'front', 'long', 'bond',
  'fond', 'rond', 'blond', 'second', 'profond',
  // English loans
  'net', 'fat', 'test', 'toast', 'fast', 'cast', 'best', 'west', 'rest',
  'trust', 'bust', 'dust', 'rust', 'gust', 'just', 'must', 'post', 'coast',
  'ghost', 'host', 'most', 'roast', 'boost', 'frost', 'lost', 'cost',
  'blast', 'last', 'past', 'vast', 'mast', 'contrast', 'podcast',
  'contact', 'impact', 'intact', 'exact', 'abstract', 'compact', 'extract',
  'react', 'interact', 'attract', 'distract', 'subtract', 'contract',
  'chic', 'tac', 'fac', 'lac', 'bac', 'mac',
  'cap', 'rap', 'map', 'gap', 'clap', 'snap', 'trap', 'wrap', 'slap',
  'step', 'rep', 'prep', 'dep',
  'bid', 'did', 'kid', 'lid', 'rid', 'grid', 'slid',
  'bad', 'dad', 'had', 'mad', 'sad', 'glad', 'grad',
  'bed', 'fed', 'led', 'red', 'shed', 'sled', 'bled', 'bred', 'fled',
  'god', 'rod', 'nod', 'pod', 'plod',
  'bud', 'dud', 'mud', 'stud', 'thud',
]);

// ─── Vowel regex (shared) ─────────────────────────────────────────────────────
// Longer alternatives must precede shorter ones that are a prefix of them
// (leftmost-match ordering). 'ui' added before single-vowel fallback to
// correctly capture nuit/bruit/fruit/lui.
const VOWEL_RE = /eau|oeu|œu|[ao]u|[aeo]i|ui|eu|[aeiouáàâäéèêëíìîïóòôöúùûüýÿæœ]+/giu;

// ─── French mora count table ──────────────────────────────────────────────────
// Maps orthographic vowel clusters to their mora count.
const FR_DIGRAPH_MORA: Record<string, number> = {
  eau: 1, au: 1, ai: 1, ei: 1, ou: 1, oi: 1, eu: 1, oe: 1,
  oeu: 1, ae: 1, ui: 1, ie: 1, ue: 1, ia: 1, io: 1, iu: 1,
};

function countMorasFR(vowelCluster: string): number {
  const key = vowelCluster.toLowerCase();
  if (FR_DIGRAPH_MORA[key] !== undefined) return FR_DIGRAPH_MORA[key];
  // Fallback: one mora per vowel letter
  return Math.max(1, vowelCluster.replace(/[^aeiouáàâäéèêëíìîïóòôöúùûüýÿæœ]/giu, '').length);
}

/**
 * Return the last whitespace-delimited token of a surface string,
 * stripped of leading/trailing punctuation that is not part of the rhyme
 * (commas, full stops, exclamation/question marks, ellipses, quotes).
 */
export function lastRhymingToken(surface: string): string {
  const tokens = surface.trim().split(/\s+/);
  const raw = tokens[tokens.length - 1] ?? '';
  return raw.replace(/[.,!?;:…"'«»\u2018\u2019\u201C\u201D]+$/u, '');
}

// ─── Normalisation helper ─────────────────────────────────────────────────────

/**
 * Returns a stripped version of the token for nucleus extraction, plus a
 * character-level offset map so callers can remap positions back to `surface`.
 *
 * offsetMap[i] = index in `surface` that corresponds to position i in the
 * returned `stripped` string.
 */
function normalizeFR(surface: string): { stripped: string; offsetMap: number[] } {
  const nfc = surface.normalize('NFC');

  const chars: Array<{ ch: string; origIdx: number }> = [];
  for (let i = 0; i < nfc.length; i++) {
    chars.push({ ch: nfc.charAt(i), origIdx: i });
  }

  const joined = chars.map(c => c.ch).join('');
  const tokenLower = joined.toLowerCase();

  let effectiveEnd = joined.length;

  if (!FR_PRONOUNCED_FINALS.has(tokenLower)) {
    // Pass 1: strip verbal silent suffixes (-aient, -eront, -ent, -es, -e)
    const silentSuffixMatch = FR_SILENT_SUFFIX.exec(joined);
    if (silentSuffixMatch && silentSuffixMatch.index + silentSuffixMatch[0].length === joined.length) {
      effectiveEnd = silentSuffixMatch.index;
    }

    // Pass 2: strip only terminal t/s of -ont/-ons verbal forms (seront→seron,
    // allons→allon), preserving the nasal `on` nucleus.
    // Only fires when Pass 1 did NOT consume the end (effectiveEnd unchanged).
    if (effectiveEnd === joined.length) {
      const nasalMatch = FR_NASAL_VERBAL_FINAL.exec(joined);
      if (nasalMatch && nasalMatch.index !== undefined) {
        // Match is `on` + terminal t/s; preserve the `on` nucleus and strip
        // only the terminal consonant → offset is match.index + length of 'on'.
        effectiveEnd = nasalMatch.index + 2;
      }
    }

    // Pass 3: strip mute final consonants
    const afterSuffix = joined.slice(0, effectiveEnd);
    const muteFinalMatch = FR_MUTE_FINALS.exec(afterSuffix);
    if (muteFinalMatch && muteFinalMatch.index + muteFinalMatch[0].length === afterSuffix.length) {
      effectiveEnd = muteFinalMatch.index;
    }
  }

  const kept = chars.slice(0, effectiveEnd);
  return {
    stripped: kept.map(c => c.ch).join(''),
    offsetMap: kept.map(c => c.origIdx),
  };
}

// ─── Nucleus extraction helpers ───────────────────────────────────────────────

function extractNucleusData(
  surface: string,
  lang: LangCode
): {
  vowels: string;
  coda: string;
  onset: string;
  moraCount: number;
  charSpanStart: number;
  charSpanEnd: number;
} {
  if (!surface) {
    return { vowels: '', coda: '', onset: '', moraCount: 1, charSpanStart: -1, charSpanEnd: -1 };
  }

  let workStr: string;
  let offsetMap: number[];

  if (lang === 'fr' || lang === 'ca') {
    ({ stripped: workStr, offsetMap } = normalizeFR(surface));
  } else {
    workStr = surface.normalize('NFC');
    offsetMap = Array.from({ length: workStr.length }, (_, i) => i);
  }

  VOWEL_RE.lastIndex = 0;
  const vowelMatches = [...workStr.matchAll(VOWEL_RE)];

  if (vowelMatches.length === 0) {
    if (workStr.length === 0) {
      return {
        vowels: '',
        coda: '',
        onset: '',
        moraCount: 1,
        charSpanStart: -1,
        charSpanEnd: -1,
      };
    }

    const fallbackCluster = workStr.slice(-2);
    const fallbackStartInWork = workStr.length - fallbackCluster.length;
    const charSpanStart = offsetMap[fallbackStartInWork] ?? -1;
    const charSpanEnd = charSpanStart === -1 ? -1 : (offsetMap[workStr.length - 1] ?? -1) + 1;
    return {
      vowels: fallbackCluster,
      coda: '',
      onset: '',
      moraCount: 1,
      charSpanStart,
      charSpanEnd,
    };
  }

  const lastVowel = vowelMatches[vowelMatches.length - 1]!;
  const vowelStart = lastVowel.index!;
  const vowelEnd = vowelStart + lastVowel[0].length;

  const rawVowels = lastVowel[0];
  const coda = workStr.slice(vowelEnd);
  const stressedVowel = lang === 'es' ? rawVowels.match(/[áéíóúÁÉÍÓÚ]/u)?.[0] : undefined;
  let vowels = stressedVowel ?? rawVowels;

  if (lang === 'fr' || lang === 'ca') {
    const rawLower = rawVowels.toLowerCase();
    const codaLower = coda.toLowerCase();
    // ie + l/r → /ɛ/ : ciel /sjɛl/, hier /jɛʁ/, fier /fjɛʁ/.
    if (rawLower === 'ie' && (codaLower === 'l' || codaLower === 'r')) {
      vowels = 'e';
    }
    // ai / ei before a rhotic coda → /ɛ/ : clair /klɛʁ/, chair /ʃɛʁ/,
    // faire /fɛʁ/, peine→reine (ei) — so they rhyme with mer, hier, fier.
    // Restricted to a rhotic coda to avoid mis-merging -ail /aj/ (travail)
    // and nasal -ain/-aim /ɛ̃/ (main, faim) which keep their own nucleus.
    else if ((rawLower === 'ai' || rawLower === 'ei') && codaLower.startsWith('r')) {
      vowels = 'e';
    }
  }

  const onset = workStr.slice(0, vowelStart).toLowerCase();

  const moraCount = (lang === 'fr' || lang === 'ca')
    ? countMorasFR(vowels)
    : Math.max(1, vowels.replace(/[^aeiouáàâäéèêëíìîïóòôöúùûüýÿæœ]/giu, '').length);

  const charSpanStart = offsetMap[vowelStart] ?? -1;
  const charSpanEnd = charSpanStart === -1
    ? -1
    : (offsetMap[workStr.length - 1] ?? -1) + 1;

  return { vowels, coda, onset, moraCount, charSpanStart, charSpanEnd };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract the rhyme nucleus from a LineEndingUnit for the Romance family.
 *
 * Works on the LAST TOKEN of unit.surface so that multi-word tails like
 * "au fond de mon cœur" correctly target "cœur".
 *
 * Also returns `rhymeToken` so engine.ts can compute charSpan without
 * duplicating the last-token logic.
 */
export function extractNucleusROM(
  unit: LineEndingUnit,
  lang: LangCode
): RhymeNucleus & { rhymeToken: string } {
  const token = lastRhymingToken(unit.surface);

  if (!token) {
    return {
      vowels: '',
      coda: '',
      tone: '',
      onset: '',
      moraCount: 1,
      charSpanStart: -1,
      charSpanEnd: -1,
      rhymeToken: '',
    };
  }

  const { vowels, coda, onset, moraCount, charSpanStart, charSpanEnd } =
    extractNucleusData(token, lang);

  return {
    vowels,
    coda,
    tone: '',
    onset,
    moraCount,
    charSpanStart,
    charSpanEnd,
    rhymeToken: token,
  };
}

/**
 * Language-aware Romance score.
 *
 * After FR/CA stripping, coda is almost always empty → give it little weight
 * so two words that share a vowel nucleus still score high even if their
 * stripped codas differ slightly.
 *
 * Weights:
 *   FR / CA  → vowel 0.85, coda 0.15
 *   ES/IT/PT → vowel 0.65, coda 0.35  (coda is more phonetically present)
 *   others   → vowel 0.60, coda 0.40  (original conservative default)
 */
export function scoreROM(
  nA: RhymeNucleus,
  nB: RhymeNucleus,
  lang: LangCode,
  phonemeEditDistance: (a: string, b: string) => number
): number {
  const vowelW = (lang === 'fr' || lang === 'ca') ? 0.85
    : (lang === 'es' || lang === 'it' || lang === 'pt') ? 0.65
    : 0.60;
  const codaW = 1 - vowelW;

  return vowelW * (1 - phonemeEditDistance(nA.vowels, nB.vowels))
       + codaW * (1 - phonemeEditDistance(nA.coda, nB.coda));
}
