import { getAlgoFamily, isTonalLanguage, type AlgoFamily } from '../constants/langFamilyMap';
import type { Section, SongVersion } from '../types';
import type { SimilarityMatch, SimilaritySectionMatch } from './similarityUtils';
import { normalizeText } from './similarityUtils';

type WordMatch = {
  lastWord: string;
  normalizedWord: string;
  wordStart: number;
};

type VowelSpan = { start: number; end: number };

type RhymeCandidate = {
  normalizedSuffix: string;
};

type RhymeMatchOptions = {
  forScheme?: boolean;
};

/**
 * Full IPA vowel inventory covering Latin, Germanic umlauts, Slavic, Uralic,
 * Austronesian, Dravidian and Sinitic vowel characters encountered after NFD
 * normalization. Extending beyond 'aeiouy' fixes getVowelGroups for
 * ALGO-GER, ALGO-FIN, ALGO-DRV, ALGO-AUS, ALGO-SLV, ALGO-SIN, ALGO-KOR.
 */
const VOWELS = new Set([
  // Basic Latin
  'a', 'e', 'i', 'o', 'u', 'y',
  // IPA close / mid vowels
  'ɑ', 'ɒ', 'ɔ', 'ɛ', 'œ', 'ø', 'ɪ', 'ʊ', 'ʌ', 'ə', 'ɨ', 'ɵ', 'ɜ', 'ɞ', 'ɐ', 'ʉ', 'ɯ', 'ɤ',
  // Germanic / Uralic umlauts (post-NFD base chars)
  'ä', 'ö', 'ü', 'å',
  // Scandinavian / Uralic
  'æ', 'ø',
  // Slavic / IIR
  'ы', 'э', 'я', 'ю', 'е', 'ё', 'и',
  // Dravidian vowel letters (Tamil, Kannada, Malayalam — post-transliteration)
  'ā', 'ī', 'ū', 'ṛ', 'ḷ', 'ē', 'ō', 'ai', 'au',
]);

const isVowel = (ch: string) => VOWELS.has(ch);

/**
 * Strip Unicode accents and lowercase — with optional tonal preservation.
 * For tonal languages (KWA, CRV families), tone diacritics are preserved.
 *
 * Latin ligatures (œ, æ) are transliterated to digraphs (oe, ae) BEFORE the
 * `[a-z]` filter so that words like `cœur`, `sœur`, `œuvre`, `æsir` keep
 * their vowel content and the family-specific suffix-canonicalization tables
 * (e.g. Romance `oeu → eu`) can normalize them as expected.
 * Without this step the ligature is silently dropped (`cœur` → `cur`),
 * producing spurious rhyme decisions.
 *
 * @param s - The string to normalize
 * @param langCode - Optional language code for tonal language detection
 */
const normalizeWord = (s: string, langCode?: string): string => {
  const normalized = s.normalize('NFD');

  const stripDiacritics = isTonalLanguage(langCode || '')
    ? normalized
    : normalized.replace(/[\u0300-\u036f]/g, '');

  const transliterated = stripDiacritics
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss');

  return transliterated.replace(/[^a-z\u0300-\u036f]/g, '');
};

/**
 * Extract the final word-like token from a lyric line, normalize it for
 * comparisons, and keep the original start offset so UI highlighting can be
 * mapped back onto the untouched line text.
 * @param text - The text to extract from
 * @param langCode - Optional language code for tonal preservation
 */
const extractLastWord = (text: string, langCode?: string): WordMatch | null => {
  const trimmedText = text.trimEnd().replace(/[^\p{L}\p{N}]+$/u, '');
  if (!trimmedText) return null;

  const lastWordMatch = /[\p{L}\p{N}]+$/u.exec(trimmedText);
  if (!lastWordMatch) return null;

  const lastWord = lastWordMatch[0];
  const normalizedWord = normalizeWord(lastWord, langCode);
  if (!normalizedWord) return null;

  return {
    lastWord,
    normalizedWord,
    wordStart: lastWordMatch.index,
  };
};

/**
 * Identify contiguous vowel groups inside a normalized word. These spans act
 * as the candidate starting points for rime comparisons and fallback splits.
 * Uses the extended IPA VOWELS set to correctly handle non-Latin families.
 */
const getVowelGroups = (normalizedWord: string): VowelSpan[] => {
  const vowelGroups: VowelSpan[] = [];
  const chars = [...normalizedWord];
  let i = 0;
  while (i < chars.length) {
    if (isVowel(chars[i]!)) {
      const start = i;
      while (i < chars.length && isVowel(chars[i]!)) i++;
      vowelGroups.push({ start, end: i });
    } else {
      i++;
    }
  }
  return vowelGroups;
};

/**
 * Call-site-local memoization helper for getVowelGroups.
 */
const makeMemoizedGetVowelGroups = () => {
  const cache = new Map<string, VowelSpan[]>();
  return (word: string): VowelSpan[] => {
    const cached = cache.get(word);
    if (cached) return cached;
    const result = getVowelGroups(word);
    cache.set(word, result);
    return result;
  };
};

// ─── Per-family phonemic normalization tables ────────────────────────────────

type SuffixTable = readonly [string, string][];

/** ALGO-ROM: French / Spanish / Italian / Portuguese / Romanian / Catalan */
const ROM_SUFFIX_TABLE: SuffixTable = [
  ['uitte', 'ui'],
  ['oire',  'oir'],
  ['eure',  'eur'],
  ['ielle', 'iel'],
  ['elle',  'el'],
  ['ette',  'ete'],
  ['tion',  'sion'],
  ['asse',  'as'],
  ['ace',   'as'],
  ['ain',   'in'],
  ['ein',   'in'],
  ['uit',   'ui'],
  ['oir',   'oir'],
  ['iel',   'iel'],
  ['eur',   'eur'],
  ['ete',   'ete'],
  ['ete',   'ete'],
];

/** ALGO-GER: English / German / Dutch / Scandinavian */
const GER_SUFFIX_TABLE: SuffixTable = [
  ['ight',  'ait'],
  ['tion',  'shun'],
  ['sion',  'shun'],
  ['ough',  'of'],
  ['ite',   'ait'],
  ['ey',    'ay'],
  ['ai',    'ay'],
  ['ay',    'ay'],
  ['ee',    'ee'],
  ['ea',    'ee'],
  ['ow',    'ow'],
  ['oe',    'ow'],
];

/** ALGO-SLV: Russian / Polish / Czech / Slovak / Ukrainian / Bulgarian / Serbian / Croatian */
const SLV_SUFFIX_TABLE: SuffixTable = [
  ['ить',   'ит'],
  ['ыть',   'ит'],
  ['ий',    'и'],
  ['ый',    'и'],
  ['ей',    'ой'],
];

/** ALGO-FIN: Finnish / Estonian / Hungarian — long vowels and geminate consonants */
const FIN_SUFFIX_TABLE: SuffixTable = [
  ['aa', 'a'],
  ['ee', 'e'],
  ['ii', 'i'],
  ['oo', 'o'],
  ['uu', 'u'],
  ['ll', 'l'],
  ['nn', 'n'],
  ['ss', 's'],
  ['tt', 't'],
];

/** ALGO-KWA: Baoulé / Ewe / Dioula / Mina — long vowels */
const KWA_SUFFIX_TABLE: SuffixTable = [
  ['aa', 'a'],
  ['ee', 'e'],
  ['ii', 'i'],
  ['oo', 'o'],
  ['uu', 'u'],
];

/** ALGO-BNT: Swahili / Yoruba / Zulu / Xhosa / Bantu — long vowels */
const BNT_SUFFIX_TABLE: SuffixTable = [
  ['aa', 'a'],
  ['ee', 'e'],
  ['ii', 'i'],
  ['oo', 'o'],
  ['uu', 'u'],
];

/**
 * ALGO-IIR: Hindi / Urdu / Bengali / Punjabi / Farsi / Sanskrit
 */
const IIR_SUFFIX_TABLE: SuffixTable = [
  ['ph',  'f'],
  ['bh',  'b'],
  ['th',  't'],
  ['dh',  'd'],
  ['sh',  's'],
  ['jh',  'j'],
  ['ā',   'a'],
  ['ī',   'i'],
  ['ū',   'u'],
  ['ṛ',   'ri'],
];

/** ALGO-DRV: Tamil / Telugu / Kannada / Malayalam */
const DRV_SUFFIX_TABLE: SuffixTable = [
  ['ai',  'e'],
  ['au',  'o'],
  ['ā',   'a'],
  ['ī',   'i'],
  ['ū',   'u'],
];

/**
 * ALGO-TRK: Turkish / Uzbek / Kazakh / Azerbaijani
 * Vowel harmony: collapse back/front vowel pairs.
 */
const TRK_SUFFIX_TABLE: SuffixTable = [
  ['ı',   'i'],
  ['ü',   'u'],
  ['ö',   'o'],
];

/**
 * ALGO-AUS: Indonesian / Malay / Tagalog / Javanese
 */
const AUS_SUFFIX_TABLE: SuffixTable = [
  ['ngg', 'ng'],
  ['ng',  'ng'],
  ['h',   ''],
];

/**
 * ALGO-SEM: Arabic / Hebrew / Amharic
 * Buckwalter-style transliteration for rhyme suffix normalization.
 * Long vowels collapsed to short; emphatic consonants neutralized;
 * definite article prefix stripped.
 */
const SEM_SUFFIX_TABLE: SuffixTable = [
  // Long vowel digraphs → short canonical (longest first)
  ['aa',  'a'],
  ['uu',  'u'],
  ['ii',  'i'],
  // Romanized macron forms (post-NFD: ā→a+macron stripped upstream, handled here as safety)
  ['ah',  'a'],   // Arabic tā marbūṭa romanized
  // Emphatic consonant neutralization
  ['ṭ',   't'],
  ['ḍ',   'd'],
  ['ṣ',   's'],
  ['ẓ',   'z'],
  // Definite article prefix strip (al-)
  ['al',  ''],
  // Diphthongs
  ['ay',  'ay'],
  ['aw',  'aw'],
];

/**
 * ALGO-JAP: Japanese (Hepburn romanization)
 * Mora collapse: long vowels, digraph simplification.
 */
const JAP_SUFFIX_TABLE: SuffixTable = [
  // Long vowels (longest first)
  ['ou',  'o'],
  ['oo',  'o'],
  ['uu',  'u'],
  ['ii',  'i'],
  // Digraph mora normalization
  ['shi', 'si'],
  ['chi', 'ti'],
  ['tsu', 'tu'],
  ['ji',  'zi'],
  // Syllabic nasal
  ['n',   'n'],
];

/**
 * ALGO-KOR: Korean (Yale/RR romanization)
 * Jamo coda neutralization for rhyme.
 */
const KOR_SUFFIX_TABLE: SuffixTable = [
  // Palatal coda neutralization
  ['ch',  'j'],
  // Velar nasal (single phoneme)
  ['ng',  'ng'],
  // Stop codas (unreleased — all neutralize to their class)
  ['k',   'k'],
  ['p',   'p'],
  ['t',   't'],
];

/**
 * ALGO-SIN: Chinese (Mandarin pinyin / Cantonese / Wu)
 * Finals only; tonal distinctions are upstream-preserved via isTonalLanguage.
 * ü→u, special finals ian/uan contracted.
 */
const SIN_SUFFIX_TABLE: SuffixTable = [
  // Contracted finals (longest first)
  ['iang', 'iang'],
  ['uang', 'uang'],
  ['iong', 'iong'],
  ['ian',  'ien'],
  ['uan',  'uen'],
  // ü-initial finals
  ['üe',   'ue'],
  ['ü',    'u'],
  // Long/short vowel pairs
  ['ao',   'ao'],
  ['ou',   'ou'],
  ['ai',   'ai'],
  ['ei',   'ei'],
];

/**
 * ALGO-TAI: Thai / Lao
 * Stop-coda neutralization; tonal preserved upstream.
 */
const TAI_SUFFIX_TABLE: SuffixTable = [
  // Velar nasal
  ['ng',  'ng'],
  // Nasal codas
  ['m',   'm'],
  ['n',   'n'],
  // Stop codas → neutralized to canonical class symbol
  ['k',   'stop_k'],
  ['p',   'stop_p'],
  ['t',   'stop_t'],
];

/**
 * ALGO-VIET: Vietnamese / Khmer
 * Final cluster merge; tonal preserved upstream.
 */
const VIET_SUFFIX_TABLE: SuffixTable = [
  // Palatal/alveolar nasal merge (longest first)
  ['nh',  'n'],
  ['ch',  'n'],
  // Velar nasal
  ['ng',  'ng'],
  // Stop codas
  ['c',   't'],
  ['t',   't'],
  ['p',   'p'],
];

/**
 * ALGO-CRV: Bekwarra / Ijaw / Iko / Hausa (Cross River + Hausa belt)
 * Implosives and labiovelar stop simplification.
 */
const CRV_SUFFIX_TABLE: SuffixTable = [
  // Labiovelar stops
  ['kw',  'k'],
  ['gw',  'g'],
  // Ejective/implosive affricates
  ['ts',  's'],
  // Glottalized approximant
  ["'y",  'y'],
];

/**
 * ALGO-CRE: Nigerian Pidgin / Nouchi / Cameroonian Pidgin (Creoles)
 * Final consonant reduction and nasal vowel simplification.
 */
const CRE_SUFFIX_TABLE: SuffixTable = [
  // Final stop drop (longest first)
  ['nd',  'n'],
  ['nt',  'n'],
  // -ing → -in
  ['ing', 'in'],
  // th-fronting
  ['th',  'd'],
  // Final voiced/unvoiced stop drop
  ['d',   ''],
  ['t',   ''],
];

/** Map each family to its normalization table */
const FAMILY_SUFFIX_TABLES: Partial<Record<AlgoFamily, SuffixTable>> = {
  'ALGO-ROM':  ROM_SUFFIX_TABLE,
  'ALGO-GER':  GER_SUFFIX_TABLE,
  'ALGO-SLV':  SLV_SUFFIX_TABLE,
  'ALGO-FIN':  FIN_SUFFIX_TABLE,
  'ALGO-KWA':  KWA_SUFFIX_TABLE,
  'ALGO-BNT':  BNT_SUFFIX_TABLE,
  'ALGO-IIR':  IIR_SUFFIX_TABLE,
  'ALGO-DRV':  DRV_SUFFIX_TABLE,
  'ALGO-TRK':  TRK_SUFFIX_TABLE,
  'ALGO-AUS':  AUS_SUFFIX_TABLE,
  'ALGO-SEM':  SEM_SUFFIX_TABLE,
  'ALGO-JAP':  JAP_SUFFIX_TABLE,
  'ALGO-KOR':  KOR_SUFFIX_TABLE,
  'ALGO-SIN':  SIN_SUFFIX_TABLE,
  'ALGO-TAI':  TAI_SUFFIX_TABLE,
  'ALGO-VIET': VIET_SUFFIX_TABLE,
  'ALGO-CRV':  CRV_SUFFIX_TABLE,
  'ALGO-CRE':  CRE_SUFFIX_TABLE,
};

/**
 * Apply the family-specific phonemic normalization table to a suffix.
 * Longest-key-wins (tables are ordered longest-first within each family).
 */
const applyFamilySuffixNorm = (suffix: string, table: SuffixTable): string => {
  for (const [from, to] of table) {
    if (suffix.startsWith(from)) {
      return to + suffix.slice(from.length);
    }
  }
  return suffix;
};

/**
 * Romance vowel-sequence canonical mergers (orthographic, longest-first).
 */
const ROMANCE_VOWEL_MERGERS: Array<[re: RegExp, canon: string]> = [
  [/^oi/, 'oi'],
  [/^(?:an|en|am|em)/, 'an'],
  [/^(?:ain|ein|in|im|yn|ym)/, 'in'],
  [/^(?:on|om)/, 'on'],
  [/^(?:un|um)/, 'un'],
  [/^(?:oeu|eu|oe|ueu)/, 'eu'],
  [/^ou/, 'ou'],
  [/^(?:eau|au)/, 'au'],
];

/**
 * Canonicalize a rhyme suffix.
 * Returns one or more canonical forms (Romance dual-emission for silent/voiced codas).
 */
const canonicalizeRhymeSuffix = (suffix: string, langCode?: string): string[] => {
  const s = suffix.length <= 2 ? suffix : suffix.replace(/[sx]$/, '');

  const family = langCode ? getAlgoFamily(langCode) : undefined;
  const isRomance = !family || family === 'ALGO-ROM';

  if (isRomance) {
    for (const [re, canon] of ROMANCE_VOWEL_MERGERS) {
      const match = re.exec(s);
      if (match) {
        const rest = s.slice(match[0].length);
        return rest ? [canon, canon + rest] : [canon];
      }
    }
  }

  const familyKey = family ?? 'ALGO-ROM';
  const table = FAMILY_SUFFIX_TABLES[familyKey];
  if (table) {
    return [applyFamilySuffixNorm(s, table)];
  }

  return [s];
};

const getLastVowelGroupSuffix = (
  normalizedWord: string,
  langCode?: string,
  memoGet: (w: string) => VowelSpan[] = getVowelGroups,
): string => {
  const vowelGroups = memoGet(normalizedWord);
  const last = vowelGroups.at(-1);
  const tail = last ? normalizedWord.slice(last.start) : normalizedWord;
  return canonicalizeRhymeSuffix(tail, langCode)[0] ?? tail;
};

/**
 * Romance rhotic / liquid vowel mergers mirroring the phonetic ALGO-ROM rules
 * so the graphemic safety-net agrees with the IPA pipeline. Only the vowel
 * nucleus is rewritten; the rhotic/liquid coda (matched via lookahead) is
 * preserved:
 *   ie → e / _[lr] : hier 'ier'→'er', fier 'ier'→'er', ciel 'iel'→'el'
 *   ai|ei → e / _r : clair 'air'→'er', chair 'air'→'er', faire 'aire'→'ere'
 * Restricted to a rhotic/liquid coda so -ai /aj/ (travail) and nasal -ain /ɛ̃/
 * (main) keep their own nucleus.
 *
 * Applied only to the comparison candidates (not inside canonicalizeRhymeSuffix)
 * so rhyme highlighting, which slices the raw orthography, is left untouched.
 */
const applyRomanceRhoticMerge = (suffix: string, langCode?: string): string => {
  const family = langCode ? getAlgoFamily(langCode) : undefined;
  const isRomance = !family || family === 'ALGO-ROM';
  if (!isRomance) return suffix;
  return suffix
    .replace(/^ie(?=[lr])/, 'e')
    .replace(/^(?:ai|ei)(?=r)/, 'e');
};

const getRhymeCandidates = (
  text: string,
  langCode?: string,
  options?: RhymeMatchOptions,
  memoGet: (w: string) => VowelSpan[] = getVowelGroups,
): RhymeCandidate[] => {
  const word = extractLastWord(text, langCode);
  if (!word) return [];

  const vowelGroups = memoGet(word.normalizedWord);
  if (vowelGroups.length === 0) {
    return canonicalizeRhymeSuffix(word.normalizedWord, langCode)
      .map(form => ({ normalizedSuffix: applyRomanceRhoticMerge(form, langCode) }));
  }

  let groupsToUse = vowelGroups;
  if (options?.forScheme) {
    let pickIndex = vowelGroups.length - 1;

    const family = langCode ? getAlgoFamily(langCode) : undefined;
    const isRomance = !family || family === 'ALGO-ROM';
    if (isRomance && pickIndex > 0) {
      const last = vowelGroups[pickIndex]!;
      const tail = word.normalizedWord.slice(last.end);
      const isSilentFinal =
        last.end - last.start === 1
        && word.normalizedWord[last.start] === 'e'
        && /^s?$/.test(tail);
      if (isSilentFinal) pickIndex--;
    }

    groupsToUse = [vowelGroups[pickIndex]!];
  }

  return groupsToUse.flatMap(({ start }) =>
    canonicalizeRhymeSuffix(word.normalizedWord.slice(start), langCode)
      .map(form => ({ normalizedSuffix: applyRomanceRhoticMerge(form, langCode) })),
  );
};

const getLongestCommonSuffix = (a: string, b: string): string => {
  let sharedLength = 0;
  while (
    sharedLength < a.length
    && sharedLength < b.length
    && a[a.length - 1 - sharedLength] === b[b.length - 1 - sharedLength]
  ) {
    sharedLength++;
  }
  return sharedLength > 0 ? a.slice(a.length - sharedLength) : '';
};

/**
 * Canonical digraphs per family — for the 1-char exact-match fallback.
 */
const CANONICAL_DIGRAPHS_BY_FAMILY: Partial<Record<AlgoFamily, Set<string>>> = {
  'ALGO-ROM':  new Set(['an', 'in', 'on', 'un', 'ou', 'oi', 'eu', 'au', 'ui', 'ie', 'el', 'al', 'il']),
  'ALGO-GER':  new Set(['ay', 'ee', 'ow', 'ai', 'oi', 'oo']),
  'ALGO-SLV':  new Set(['ой', 'ей', 'ий', 'ый']),
  'ALGO-FIN':  new Set(['an', 'en', 'in', 'on', 'un', 'ai', 'oi', 'ui']),
  'ALGO-KWA':  new Set(['an', 'on', 'in', 'un', 'en']),
  'ALGO-BNT':  new Set(['an', 'on', 'in', 'un', 'en']),
  'ALGO-IIR':  new Set(['an', 'in', 'un', 'ai', 'au', 'ri']),
  'ALGO-DRV':  new Set(['an', 'in', 'un', 'ai', 'au', 'en', 'on']),
  'ALGO-TRK':  new Set(['an', 'in', 'on', 'un', 'en']),
  'ALGO-AUS':  new Set(['an', 'in', 'on', 'un', 'ng', 'ay', 'ai']),
  'ALGO-SEM':  new Set(['ay', 'aw', 'an', 'in', 'un']),
  'ALGO-JAP':  new Set(['an', 'in', 'on', 'un', 'en', 'ai', 'oi', 'ui']),
  'ALGO-KOR':  new Set(['an', 'in', 'on', 'un', 'ng']),
  'ALGO-SIN':  new Set(['an', 'en', 'in', 'on', 'un', 'ao', 'ou', 'ai', 'ei']),
  'ALGO-TAI':  new Set(['an', 'in', 'on', 'un', 'ng', 'ai', 'ao']),
  'ALGO-VIET': new Set(['an', 'en', 'in', 'on', 'un', 'ng']),
  'ALGO-CRV':  new Set(['an', 'in', 'on', 'un', 'ng']),
  'ALGO-CRE':  new Set(['an', 'in', 'on', 'un', 'en']),
};

const isSharedRhymeStrongEnough = (
  suffix: string,
  exactMatch: boolean,
  langCode?: string,
  options?: RhymeMatchOptions,
): boolean => {
  const family = langCode ? getAlgoFamily(langCode) : undefined;
  const isRomance = !family || family === 'ALGO-ROM';
  const familyKey = family ?? 'ALGO-ROM';

  if (suffix.length >= 2) return true;

  if (exactMatch && suffix.length === 1 && isVowel(suffix)) {
    if (options?.forScheme && isRomance && suffix === 'e') return false;
    return true;
  }

  const digraphs = CANONICAL_DIGRAPHS_BY_FAMILY[familyKey];
  if (exactMatch && digraphs?.has(suffix)) return true;

  return false;
};

const findBestSharedRhymeSuffix = (
  a: string,
  b: string,
  langCode?: string,
  options?: RhymeMatchOptions,
): string | null => {
  const memoGet = makeMemoizedGetVowelGroups();
  const aCandidates = getRhymeCandidates(a, langCode, options, memoGet);
  const bCandidates = getRhymeCandidates(b, langCode, options, memoGet);
  let bestMatch = '';

  for (const aCandidate of aCandidates) {
    for (const bCandidate of bCandidates) {
      const exactMatch = aCandidate.normalizedSuffix === bCandidate.normalizedSuffix;
      const sharedSuffix = exactMatch
        ? aCandidate.normalizedSuffix
        : getLongestCommonSuffix(aCandidate.normalizedSuffix, bCandidate.normalizedSuffix);
      if (!isSharedRhymeStrongEnough(sharedSuffix, exactMatch, langCode, options)) continue;
      if (sharedSuffix.length > bestMatch.length) bestMatch = sharedSuffix;
    }
  }

  return bestMatch || null;
};

const FRENCH_DIGRAPHS = new Set(['ai', 'ei', 'oi', 'ou', 'au', 'eu']);

const extendToVowelOnset = (normalizedWord: string, suffixStart: number): number => {
  if (suffixStart <= 0) return suffixStart;

  let pos = suffixStart;

  if (!isVowel(normalizedWord[pos]!)) {
    while (pos > 0 && !isVowel(normalizedWord[pos]!)) pos--;
    if (!isVowel(normalizedWord[pos]!)) return suffixStart;
  }

  if (pos >= 1 && isVowel(normalizedWord[pos - 1]!)) {
    const digraph = normalizedWord[pos - 1]! + normalizedWord[pos]!;
    if (FRENCH_DIGRAPHS.has(digraph)) {
      return pos - 1;
    }
  }

  return pos;
};

const splitLineAtNormalizedSuffix = (text: string, normalizedSuffix: string, langCode?: string): { before: string; rhyme: string } | null => {
  const word = extractLastWord(text, langCode);
  if (!word) return null;

  const suffixStart = word.normalizedWord.lastIndexOf(normalizedSuffix);
  if (suffixStart < 0) return null;

  const suffixStartsWithVowel = isVowel(normalizedSuffix[0] ?? '');
  const effectiveStart = isTonalLanguage(langCode || '') || !suffixStartsWithVowel
    ? suffixStart
    : extendToVowelOnset(word.normalizedWord, suffixStart);

  const absoluteStart = word.wordStart + effectiveStart;
  return {
    before: text.slice(0, absoluteStart),
    rhyme: text.slice(absoluteStart),
  };
};

/**
 * Split a line at the vowel-group onset that produced a given canonical suffix.
 *
 * The split position is always `group.start` — the onset of the matching
 * vowel group in the normalized word — regardless of whether the match is
 * exact or an endsWith match. Using `rawTail.lastIndexOf(canonicalSuffix)`
 * was wrong because the canonical suffix (produced by family normalization
 * tables) is often shorter than the raw orthography and does not literally
 * appear in `rawTail`, causing lastIndexOf to return -1 and Math.max to
 * collapse the offset to 0, which either highlighted nothing or highlighted
 * too much. Examples that were broken before this fix:
 *   "choose" → OOSE  (GER: oose→"us", "us" not in "oose" → offset 0)
 *   "breeze" → EEZE  (GER: eeze→"ez", "ez" not in "eeze" → offset 0)
 *   "soul"   → OLE   (ROM: ole→"ol",  offset was fine but extendToVowelOnset
 *                      was applied from pos 0 unnecessarily)
 *
 * extendToVowelOnset is still applied for non-tonal languages so digraph
 * boundaries (ou, ai, ei …) are respected across all supported families.
 */
const splitLineAtCanonicalSuffix = (
  text: string,
  canonicalSuffix: string,
  langCode?: string,
): { before: string; rhyme: string } | null => {
  const word = extractLastWord(text, langCode);
  if (!word) return null;

  const vowelGroups = getVowelGroups(word.normalizedWord);

  for (let i = vowelGroups.length - 1; i >= 0; i--) {
    const group = vowelGroups[i]!;
    const rawTail = word.normalizedWord.slice(group.start);
    const canonForms = canonicalizeRhymeSuffix(rawTail, langCode);

    const matchingForm = canonForms.find(f => f === canonicalSuffix || f.endsWith(canonicalSuffix));
    if (!matchingForm) continue;

    const isExactMatch = matchingForm === canonicalSuffix;
    const prefixLen = isExactMatch ? 0 : matchingForm.length - canonicalSuffix.length;

    const splitPos = group.start + prefixLen;
    const effectiveStart = isTonalLanguage(langCode || '')
      ? splitPos
      : extendToVowelOnset(word.normalizedWord, splitPos);

    const absoluteStart = word.wordStart + effectiveStart;
    return {
      before: text.slice(0, absoluteStart),
      rhyme: text.slice(absoluteStart),
    };
  }

  return null;
};

/**
 * Pick the vowel-group index that carries the rhyme nucleus.
 *
 * For families with a silent word-final 'e' (Romance, Germanic/English) a
 * trailing lone 'e' (optionally followed by a final 's': "homes", "chooses")
 * is not the rhyme nucleus, so we step back to the preceding vowel group.
 * This is what lets the fallback highlight the full orthographic rhyme:
 *   "choose" → OOSE  (not the silent final E)
 *   "whole"  → OLE
 *   "breeze" → EEZE
 * Languages where final 'e' is pronounced (Finnish, etc.) keep the last group.
 */
const pickRhymeVowelGroupIndex = (
  normalizedWord: string,
  vowelGroups: VowelSpan[],
  langCode?: string,
): number => {
  let pickIndex = vowelGroups.length - 1;
  if (pickIndex <= 0) return pickIndex;

  const family = langCode ? getAlgoFamily(langCode) : undefined;
  const hasSilentFinalE = !family || family === 'ALGO-ROM' || family === 'ALGO-GER';
  if (!hasSilentFinalE) return pickIndex;

  const last = vowelGroups[pickIndex]!;
  const tail = normalizedWord.slice(last.end);
  const isSilentFinal =
    last.end - last.start === 1
    && normalizedWord[last.start] === 'e'
    && /^s?$/.test(tail);
  if (isSilentFinal) pickIndex--;
  return pickIndex;
};

const getFallbackRhymingSuffix = (text: string, langCode?: string): { before: string; rhyme: string } | null => {
  const word = extractLastWord(text, langCode);
  if (!word) return null;

  const vowelGroups = getVowelGroups(word.normalizedWord);
  if (vowelGroups.length === 0) {
    return {
      before: text.slice(0, word.wordStart),
      rhyme: text.slice(word.wordStart),
    };
  }

  // Anchor the split to the raw vowel-group onset rather than re-locating a
  // canonicalized suffix (which may not appear literally in the orthography,
  // e.g. GER "seas" → canonical "ee", lastIndexOf("ee") === -1 → null).
  const group = vowelGroups[pickRhymeVowelGroupIndex(word.normalizedWord, vowelGroups, langCode)]!;
  const splitPos = isTonalLanguage(langCode || '')
    ? group.start
    : extendToVowelOnset(word.normalizedWord, group.start);

  const absoluteStart = word.wordStart + splitPos;
  return {
    before: text.slice(0, absoluteStart),
    rhyme: text.slice(absoluteStart),
  };
};

const removeTrailingToken = (text: string): string => text.trimEnd().replace(/\s+\S+$/, '');

export const splitRhymingSuffix = (text: string, peerLines: string[] = [], langCode?: string): { before: string; rhyme: string } | null => {
  const segment = segmentVerseToRhymingUnit(text, langCode);
  const effectiveText = segment.position === 'enjambed'
    ? removeTrailingToken(text)
    : text;
  let bestSuffix: string | null = null;

  for (const peerLine of peerLines) {
    const peerSegment = segmentVerseToRhymingUnit(peerLine, langCode);
    const sharedSuffix = findBestSharedRhymeSuffix(
      segment.rhymingUnit,
      peerSegment.rhymingUnit,
      langCode,
    );
    if (sharedSuffix && (!bestSuffix || sharedSuffix.length > bestSuffix.length)) {
      bestSuffix = sharedSuffix;
    }
  }

  if (bestSuffix) {
    const split =
      splitLineAtCanonicalSuffix(effectiveText, bestSuffix, langCode)
      ?? splitLineAtNormalizedSuffix(effectiveText, bestSuffix, langCode);
    if (split) return split;
  }

  return getFallbackRhymingSuffix(effectiveText, langCode);
};

export const doLinesRhymeGraphemic = (
  a: string,
  b: string,
  langCode?: string,
  options?: RhymeMatchOptions,
): boolean => {
  const segA = segmentVerseToRhymingUnit(a, langCode);
  const segB = segmentVerseToRhymingUnit(b, langCode);
  return findBestSharedRhymeSuffix(segA.rhymingUnit, segB.rhymingUnit, langCode, options) !== null;
};

// ─── Step-0: verse segmentation ──────────────────────────────────────────────

export type RhymePosition = 'end' | 'internal' | 'enjambed';

export type VerseRhymingSegment = {
  rhymingUnit: string;
  position: RhymePosition;
  originalText: string;
  syllableIndex?: number;
  lastWord?: string;
};

const ENJAMBMENT_CONNECTORS = new Set([
  // French
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'que', 'qui', 'dont',
  'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'en', 'par',
  'pour', 'sur', 'sous', 'avec', 'sans', 'vers', 'comme',
  // English
  'and', 'or', 'but', 'so', 'yet', 'nor', 'for', 'the', 'a', 'an',
  'of', 'in', 'on', 'at', 'to', 'by', 'from', 'with', 'into', 'like',
  // Spanish / Italian / Portuguese
  'y', 'e', 'o', 'pero', 'sino', 'porque', 'con', 'sin', 'por',
  // German / Dutch
  'und', 'oder', 'aber', 'weil', 'mit', 'ohne', 'von', 'en', 'maar', 'van',
  // Yoruba (ALGO-BNT)
  'ati', 'àti', 'tabi', 'tàbí', 'nitori', 'bi', 'ti', 'ni', 'si', 'fun',
  // Swahili (ALGO-BNT)
  'na', 'ya', 'wa', 'za', 'la', 'kwa', 'bila', 'hadi', 'au',
  // Dioula / Bambara (ALGO-KWA)
  'ani', 'walima', 'nka', 'fo', 'kɔ',
  // Baoulé (ALGO-KWA)
  'mɔ', 'kɛ', 'yɛ',
  // Ewe / Mina (ALGO-KWA)
  'kple', 'eye', 'ke', 'ne', 'le',
  // Lingala (ALGO-BNT)
  'mpe', 'to', 'kasi', 'po',
  // Nigerian Pidgin / Nouchi (ALGO-CRE)
  'pis', 'kon', 'sof', 'den', 'dem', 'wit',
  // Bekwarra / Ijaw (ALGO-CRV)
  'ma', 'be',
]);

const isEnjambmentConnector = (normalizedToken: string): boolean =>
  ENJAMBMENT_CONNECTORS.has(normalizedToken) || ENJAMBMENT_CONNECTORS.has(normalizedToken.normalize('NFC'));

const AGGLUTINATIVE_FAMILIES: ReadonlySet<AlgoFamily> = new Set<AlgoFamily>(['ALGO-TRK', 'ALGO-FIN', 'ALGO-KOR']);

const detectInternalRhymeToken = (tokens: string[], lastWord: string, langCode?: string): string | null => {
  if (tokens.length < 2) return null;

  const memoGet = makeMemoizedGetVowelGroups();
  const lwSuffix = getLastVowelGroupSuffix(lastWord, langCode, memoGet);

  if (!lwSuffix || lwSuffix.length < 2 || lwSuffix === 'es') return null;

  const candidates = tokens.slice(0, -1);
  for (const token of candidates) {
    const normalized = normalizeWord(token, langCode);
    if (!normalized) continue;

    const suffix = getLastVowelGroupSuffix(normalized, langCode, memoGet);
    if (!suffix) continue;

    const shared = suffix.startsWith(lwSuffix)
      ? lwSuffix
      : lwSuffix.startsWith(suffix)
        ? suffix
        : null;

    if (shared && shared.length >= 2) return normalized;
  }
  return null;
};

export const segmentVerseToRhymingUnit = (line: string, langCode?: string): VerseRhymingSegment => {
  const family = langCode ? getAlgoFamily(langCode) : undefined;

  const stripped = line.trimEnd().replace(/[^\p{L}\p{N}\s]+$/u, '').trim();
  const tokens = stripped.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return { rhymingUnit: '', position: 'end', originalText: line };
  }

  if (family && AGGLUTINATIVE_FAMILIES.has(family)) {
    const lastToken = tokens[tokens.length - 1]!;
    const normalized = normalizeWord(lastToken, langCode);
    const vowelGroups = getVowelGroups(normalized);
    const rhymingUnit = vowelGroups.length > 0
      ? normalized.slice(vowelGroups[vowelGroups.length - 1]!.start)
      : (normalized || lastToken);
    return {
      rhymingUnit,
      position: 'end',
      originalText: line,
    };
  }

  const lastToken = tokens[tokens.length - 1]!;
  const lastNormalized = normalizeWord(lastToken, langCode);
  if (isEnjambmentConnector(lastNormalized) && tokens.length >= 2) {
    const contentToken = tokens[tokens.length - 2]!;
    const contentNormalized = normalizeWord(contentToken, langCode);
    return {
      rhymingUnit: isTonalLanguage(langCode || '') ? contentNormalized.normalize('NFC') : contentNormalized,
      position: 'enjambed',
      originalText: line,
    };
  }

  const wordMatch = extractLastWord(stripped, langCode);
  if (wordMatch) {
    const internalToken = detectInternalRhymeToken(tokens, wordMatch.normalizedWord, langCode);
    if (internalToken) {
      return {
        rhymingUnit: internalToken,
        position: 'internal',
        originalText: line,
        lastWord: wordMatch.lastWord,
      };
    }
  }

  const rhymingUnit = wordMatch ? wordMatch.normalizedWord : lastNormalized;
  const segment: VerseRhymingSegment = {
    rhymingUnit,
    position: 'end',
    originalText: line,
  };
  if (wordMatch) segment.lastWord = wordMatch.lastWord;
  return segment;
};

// ─── Existing exports unchanged below ────────────────────────────────────────

const tokenize = (text: string) =>
  normalizeText(text)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length > 2);

const getSongLines = (song: Section[]) =>
  song
    .flatMap(section => (section.lines ?? []).map(line => normalizeText(line.text ?? '')))
    .filter(Boolean);

const getSongTokens = (song: Section[]) => getSongLines(song).flatMap(tokenize);

const ratio = (intersection: number, union: number) => (union > 0 ? intersection / union : 0);

const getSetOverlapRatio = (left: string[], right: string[]) => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter(value => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return ratio(intersection, union);
};

const getSharedKeywords = (
  currentTokens: string[],
  candidateSong: Section[],
) => {
  const currentCounts = new Map<string, number>();
  const candidateCounts = new Map<string, number>();

  for (const token of currentTokens) {
    currentCounts.set(token, (currentCounts.get(token) || 0) + 1);
  }

  for (const token of getSongTokens(candidateSong)) {
    candidateCounts.set(token, (candidateCounts.get(token) || 0) + 1);
  }

  return [...currentCounts.entries()]
    .filter(([token]) => candidateCounts.has(token))
    .map(([token, count]) => ({
      token,
      weight: count + (candidateCounts.get(token) || 0),
    }))
    .sort((a, b) => b.weight - a.weight || a.token.localeCompare(b.token))
    .slice(0, 5)
    .map(item => item.token);
};

const getMatchedSections = (currentSong: Section[], candidateSong: Section[]) => {
  const candidateByName = new Map(
    candidateSong.map(section => [normalizeText(section.name), section] as const),
  );

  return currentSong
    .map((section) => {
      const candidateSection = candidateByName.get(normalizeText(section.name));
      if (!candidateSection) return null;

      const sectionScore = Math.round(
        getSetOverlapRatio(
          (section.lines ?? []).map(line => normalizeText(line.text ?? '')).filter(Boolean),
          (candidateSection.lines ?? []).map(line => normalizeText(line.text ?? '')).filter(Boolean),
        ) * 100,
      );

      if (sectionScore === 0) return null;

      return {
        name: section.name,
        score: sectionScore,
      };
    })
    .filter((section): section is SimilaritySectionMatch => section !== null)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
};

const calculateSimilarity = (
  currentLines: string[],
  currentTokens: string[],
  candidateSong: Section[],
  currentSong: Section[],
) => {
  const candidateLines = getSongLines(candidateSong);
  const candidateTokens = getSongTokens(candidateSong);
  const currentSections = currentSong.map(section => normalizeText(section.name));
  const candidateSections = candidateSong.map(section => normalizeText(section.name));

  const lineScore = getSetOverlapRatio(currentLines, candidateLines);
  const tokenScore = getSetOverlapRatio(currentTokens, candidateTokens);
  const structureScore = getSetOverlapRatio(currentSections, candidateSections);

  return Math.round((tokenScore * 0.6 + lineScore * 0.3 + structureScore * 0.1) * 100);
};

export const calculateSimilarityWithMetadata = (
  currentSong: Section[],
  candidateSong: Section[],
): Omit<SimilarityMatch, 'versionId' | 'versionName' | 'title' | 'timestamp'> => {
  const currentTokens = getSongTokens(currentSong);
  const currentLines = getSongLines(currentSong);
  const candidateTokens = getSongTokens(candidateSong);
  const candidateTokenSet = new Set(candidateTokens);
  const candidateLines = getSongLines(candidateSong);
  const candidateLineSet = new Set(candidateLines);

  const sharedWords = new Set(currentTokens.filter(token => candidateTokenSet.has(token))).size;
  const sharedLines = new Set(currentLines.filter(line => candidateLineSet.has(line))).size;

  return {
    score: calculateSimilarity(currentLines, currentTokens, candidateSong, currentSong),
    sharedWords,
    sharedLines,
    sharedKeywords: getSharedKeywords(currentTokens, candidateSong),
    matchedSections: getMatchedSections(currentSong, candidateSong).slice(0, 3),
  };
};

export const getTopSimilarSongMatches = (
  currentSong: Section[],
  versions: SongVersion[],
  limit = 3,
): SimilarityMatch[] => {
  if (currentSong.length === 0) return [];

  const currentTokens = getSongTokens(currentSong);
  const currentLines = getSongLines(currentSong);

  return versions
    .filter(version => (version.song ?? []).length > 0)
    .map((version) => {
      const candidateTokens = getSongTokens(version.song);
      const candidateTokenSet = new Set(candidateTokens);
      const candidateLines = getSongLines(version.song);
      const candidateLineSet = new Set(candidateLines);

      const sharedWords = new Set(currentTokens.filter(token => candidateTokenSet.has(token))).size;
      const sharedLines = new Set(currentLines.filter(line => candidateLineSet.has(line))).size;

      return {
        versionId: version.id,
        versionName: version.name,
        title: version.title,
        timestamp: version.timestamp,
        score: calculateSimilarity(currentLines, currentTokens, version.song, currentSong),
        sharedWords,
        sharedLines,
        sharedKeywords: getSharedKeywords(currentTokens, version.song),
        matchedSections: getMatchedSections(currentSong, version.song).slice(0, 3),
        method: 'graphemic' as const,
      };
    })
    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
    .slice(0, limit);
};

export type { RhymeMatchOptions };
