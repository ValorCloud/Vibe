/**
 * IPA Pipeline Integration
 * Orchestrates the complete 5-step phonemic processing pipeline
 * Based on docs_fusion_optimal.md specification
 *
 * Pipeline Steps:
 * 1. Normalization/tokenization (already in syllableUtils)
 * 2. G2P → IPA (g2pUtils + phonemizeClient)
 * 3. Syllabification phonémique (ipaSyllabification)
 * 4. Extraction Rhyme Nucleus (ipaSyllabification)
 * 5. Scoring IPA (ipaUtils)
 */

import { getAlgoFamily, getFamilyConfig, type AlgoFamily } from '../constants/langFamilyMap';
import { phonemizeText, type PhonemeResponse } from './phonemizeClient';
import { graphemeToIPA } from './g2pUtils';
import { syllabifyIPA, extractRhymeNucleus, type IPASyllable } from './ipaSyllabification';
import {
  calculateRhymeSimilarity,
  calculateRhymeSimilarityWithWeight,
  classifyRhymeQuality,
  type RhymeSimilarityResult,
} from './ipaUtils';
import { finalizeDetectedRhymeScheme, RHYME_SCHEME_LETTERS } from './rhymeSchemeUtils';
import { logger } from './logger';

const createAbortError = () => {
  const error = new Error('Operation aborted');
  error.name = 'AbortError';
  return error;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw createAbortError();
  }
};

const isAbortError = (error: unknown) =>
  (error instanceof DOMException && error.name === 'AbortError')
  || (error instanceof Error && error.name === 'AbortError');

/**
 * Complete IPA pipeline result
 */
export interface IPAPipelineResult {
  success: boolean;
  text: string;
  langCode: string;
  family: AlgoFamily;
  ipa: string;
  syllables: IPASyllable[];
  rhymeNucleus: string;
  method: 'service' | 'client-fallback' | 'graphemic';
  lowResource: boolean;
}

const FAMILY_RHYME_THRESHOLDS: Partial<Record<AlgoFamily, number>> = {
  'ALGO-KWA':  0.80,
  'ALGO-SIN':  0.82,
  'ALGO-VIET': 0.82,
  'ALGO-TAI':  0.80,
  'ALGO-BNT':  0.78,
  'ALGO-CRV':  0.78,
  'ALGO-GER':  0.72,
  'ALGO-SLV':  0.72,
  'ALGO-KOR':  0.72,
};

export const TONE_WEIGHT_DEFAULTS: Partial<Record<AlgoFamily, number>> = {
  'ALGO-SIN':  0.70,
  'ALGO-VIET': 0.70,
  'ALGO-TAI':  0.65,
  'ALGO-KWA':  0.55,
  'ALGO-CRV':  0.55,
  'ALGO-BNT':  0.55,
};

export const getToneWeightForLangCode = (langCode: string, override?: number): number => {
  const family = getAlgoFamily(langCode);
  if (!family) return 0.0;
  const defaultWeight = TONE_WEIGHT_DEFAULTS[family] ?? 0.0;
  if (defaultWeight === 0.0) return 0.0;
  if (override !== undefined) return Math.max(0, Math.min(1, override));
  return defaultWeight;
};

export const getThresholdForLangCode = (langCode: string, base = 0.75): number => {
  const family = getAlgoFamily(langCode);
  return (family && FAMILY_RHYME_THRESHOLDS[family]) ?? base;
};

export const runIPAPipeline = async (
  text: string,
  langCode: string,
  signal?: AbortSignal,
): Promise<IPAPipelineResult> => {
  throwIfAborted(signal);

  const normalized = text.normalize('NFD').trim();

  if (!normalized) {
    return {
      success: false,
      text,
      langCode,
      family: 'ALGO-ROM',
      ipa: '',
      syllables: [],
      rhymeNucleus: '',
      method: 'graphemic',
      lowResource: true,
    };
  }

  const family = getAlgoFamily(langCode) || 'ALGO-ROM';
  const config = getFamilyConfig(langCode);

  let ipaText = '';
  let syllables: IPASyllable[] = [];
  let method: 'service' | 'client-fallback' | 'graphemic' = 'graphemic';
  let lowResource = true;

  try {
    const serviceResult = await phonemizeText(normalized, langCode, signal);
    if (serviceResult) {
      ipaText = serviceResult.ipa;
      method = 'service';
      lowResource = serviceResult.low_resource;

      if (serviceResult.syllables && serviceResult.syllables.length > 0) {
        syllables = serviceResult.syllables.map(s => ({
          onset: s.onset,
          nucleus: s.nucleus,
          coda: s.coda,
          ...(s.tone !== undefined && { tone: s.tone }),
          ...(s.stress !== undefined && { stress: s.stress }),
        }));
      }
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    logger.debug('Phonemization service unavailable, using client fallback');
  }

  throwIfAborted(signal);

  if (!ipaText) {
    ipaText = graphemeToIPA(normalized, family);
    method = 'client-fallback';
    lowResource = true;
  }

  if (syllables.length === 0 && ipaText) {
    syllables = syllabifyIPA(ipaText, family);
  }

  const rhymeNucleus = syllables.length > 0
    ? extractRhymeNucleus(syllables, family)
    : '';

  throwIfAborted(signal);

  return {
    success: true,
    text: normalized,
    langCode,
    family,
    ipa: ipaText,
    syllables,
    rhymeNucleus,
    method,
    lowResource,
  };
};

export interface CompareTextsOptions {
  toneWeight?: number;
}

const applyTonePenalty = (baseScore: number, toneWeight: number): number => {
  if (toneWeight <= 0) return baseScore;
  const penalty = toneWeight * (1 - baseScore);
  return Math.max(0, baseScore - penalty);
};

export const compareTextsWithIPA = async (
  text1: string,
  text2: string,
  langCode: string,
  options?: CompareTextsOptions & { langCode2?: string },
): Promise<RhymeSimilarityResult> => {
  const langCode2 = options?.langCode2 ?? langCode;

  const [result1, result2] = await Promise.all([
    runIPAPipeline(text1, langCode),
    runIPAPipeline(text2, langCode2),
  ]);

  if (!result1.success || !result2.success) {
    return {
      score: 0,
      quality: 'none',
      distance: Infinity,
      method: 'exact',
    };
  }

  const rn1 = result1.rhymeNucleus || result1.ipa;
  const rn2 = result2.rhymeNucleus || result2.ipa;

  const tw1 = getToneWeightForLangCode(langCode, options?.toneWeight);
  const tw2 = getToneWeightForLangCode(langCode2, options?.toneWeight);
  const effectiveToneWeight = tw1 > 0 && tw2 > 0 ? Math.min(tw1, tw2) : 0.0;

  if (result1.family === 'ALGO-CRV' && result2.family === 'ALGO-CRV') {
    const weight1 = result1.syllables.length > 0
      ? result1.syllables[result1.syllables.length - 1]?.weight
      : undefined;
    const weight2 = result2.syllables.length > 0
      ? result2.syllables[result2.syllables.length - 1]?.weight
      : undefined;
    return calculateRhymeSimilarityWithWeight(rn1, rn2, weight1, weight2, true);
  }

  const base = calculateRhymeSimilarity(rn1, rn2, true);

  if (effectiveToneWeight <= 0) return base;

  const tone1 = result1.syllables.length > 0
    ? result1.syllables[result1.syllables.length - 1]?.tone
    : undefined;
  const tone2 = result2.syllables.length > 0
    ? result2.syllables[result2.syllables.length - 1]?.tone
    : undefined;
  const tonesKnown = tone1 !== undefined && tone2 !== undefined;
  const tonesMismatch = tonesKnown && tone1 !== tone2;

  if (!tonesMismatch) return base;

  const adjustedScore = applyTonePenalty(base.score, effectiveToneWeight);
  if (adjustedScore === base.score) return base;

  // Use statically-imported classifyRhymeQuality — no dynamic import needed
  return {
    ...base,
    score: adjustedScore,
    quality: classifyRhymeQuality(adjustedScore),
  };
};

export const runIPAPipelineBatch = async (
  texts: string[],
  langCode: string,
  signal?: AbortSignal,
): Promise<IPAPipelineResult[]> => {
  return Promise.all(texts.map(text => runIPAPipeline(text, langCode, signal)));
};

export const compareMultipleTexts = async (
  texts: string[],
  langCode: string
): Promise<RhymeSimilarityResult[][]> => {
  const results = await runIPAPipelineBatch(texts, langCode);

  const matrix: RhymeSimilarityResult[][] = [];
  for (let i = 0; i < results.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < results.length; j++) {
      if (i === j) {
        matrix[i]![j] = {
          score: 1.0,
          quality: 'rich',
          distance: 0,
          method: 'exact',
        };
      } else {
        const rn1 = results[i]!.rhymeNucleus || results[i]!.ipa;
        const rn2 = results[j]!.rhymeNucleus || results[j]!.ipa;
        matrix[i]![j] = calculateRhymeSimilarity(rn1, rn2, true);
      }
    }
  }

  return matrix;
};

export const doLinesRhymeIPA = async (
  line1: string,
  line2: string,
  langCode: string,
  threshold?: number,
  options?: CompareTextsOptions & { langCode2?: string },
): Promise<boolean> => {
  const effectiveThreshold = threshold ?? getThresholdForLangCode(langCode);
  const similarity = await compareTextsWithIPA(line1, line2, langCode, options);
  return similarity.score >= effectiveThreshold;
};

export const getRhymeQualityForLines = async (
  line1: string,
  line2: string,
  langCode: string
): Promise<RhymeSimilarityResult> => {
  return compareTextsWithIPA(line1, line2, langCode);
};

export const detectRhymeSchemeLocallyIPA = async (
  lines: string[],
  langCode: string,
  threshold?: number
): Promise<string | null> => {
  const effectiveThreshold = threshold ?? getThresholdForLangCode(langCode);
  const lyricLines = lines.filter(line => line.trim().length > 0);
  const n = lyricLines.length;
  if (n < 2) return null;

  const letters: (string | null)[] = new Array(n).fill(null);
  let nextLetter = 0;

  for (let i = 0; i < n; i++) {
    if (letters[i] !== null) continue;
    let matchedLetter: string | null = null;
    for (let j = 0; j < i; j++) {
      if (await doLinesRhymeIPA(lyricLines[i]!, lyricLines[j]!, langCode, effectiveThreshold)) {
        matchedLetter = letters[j]!;
        break;
      }
    }
    if (matchedLetter) {
      letters[i] = matchedLetter;
    } else {
      letters[i] = RHYME_SCHEME_LETTERS[nextLetter] ?? String.fromCharCode(65 + nextLetter);
      nextLetter++;
    }
    for (let k = i + 1; k < n; k++) {
      if (letters[k] === null && await doLinesRhymeIPA(lyricLines[i]!, lyricLines[k]!, langCode, effectiveThreshold)) {
        letters[k] = letters[i]!;
      }
    }
  }

  return finalizeDetectedRhymeScheme(letters);
};
