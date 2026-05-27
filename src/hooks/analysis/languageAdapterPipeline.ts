import { Type } from '@google/genai';
import { AI_MODEL_NAME, generateContentWithRetry, safeJsonParse } from '../../utils/aiUtils';
import { languageNameToCode } from '../../constants/langFamilyMap';
import { isSectionHeader } from '../../utils/metaUtils';
import { mapSongWithPreservedIds, mergeAiSectionIntoCurrent } from '../../utils/songMergeUtils';
import { matchRhymeSchemeAcrossLang } from '../../utils/adaptationUtils';
import { reverseTranslateLines, reviewTranslationFidelity } from '../../utils/llmPipelineUtils';
import { buildDetectLanguagePrompt } from '../../utils/promptUtils';
import type { Line, Section } from '../../types';
import { logger } from '../../utils/logger';

type AdaptationLinePayload = Partial<Line>;
type AdaptationSectionPayload = Partial<Omit<Section, 'lines'>> & { lines?: AdaptationLinePayload[] };

type ParseAdaptationResponseParams =
  | {
      kind: 'song';
      responseText: string;
      sourceSong: Section[];
      newLanguage: string;
    }
  | {
      kind: 'section';
      responseText: string;
      section: Section;
      newLanguage: string;
    };

const adaptationLineSchema = {
  type: Type.OBJECT,
  properties: {
    text:             { type: Type.STRING },
    rhymingSyllables: { type: Type.STRING },
    rhyme:            { type: Type.STRING },
    syllables:        { type: Type.INTEGER },
    concept:          { type: Type.STRING },
  },
  required: ['text', 'rhymingSyllables', 'rhyme', 'syllables', 'concept'],
};

const adaptationSectionSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    rhymeScheme: { type: Type.STRING },
    lines: {
      type: Type.ARRAY,
      items: adaptationLineSchema,
    },
  },
  required: ['name', 'lines'],
};

export const getAdaptationResponseSchema = (kind: 'song' | 'section') =>
  kind === 'song'
    ? {
        type: Type.ARRAY,
        items: adaptationSectionSchema,
      }
    : adaptationSectionSchema;

export const getLineAdaptationResponseSchema = () => adaptationLineSchema;

export const getSourceLines = (sections: Section[]) =>
  sections.flatMap(section =>
    section.lines
      .filter(line => !line.isMeta && !isSectionHeader(line.text.replace(/^\[|\]$/g, '').trim()))
      .map(line => line.text)
  );

export interface SourceLineRef {
  sectionIndex: number;
  lineIndex: number;
  lineId: string;
  text: string;
}

/** Returns non-meta lyric lines with their section/line coordinates and IDs. */
export const getSourceLineRefs = (sections: Section[]): SourceLineRef[] =>
  sections.flatMap((section, si) =>
    section.lines
      .map((line, li) => ({ sectionIndex: si, lineIndex: li, lineId: line.id, text: line.text, isMeta: line.isMeta, raw: line.text.replace(/^\[|\]$/g, '').trim() }))
      .filter(entry => !entry.isMeta && !isSectionHeader(entry.raw))
      .map(({ sectionIndex, lineIndex, lineId, text }) => ({ sectionIndex, lineIndex, lineId, text }))
  );

export interface DetectionResult {
  /** All distinct languages found, sorted by frequency (most used first). */
  languages: string[];
  /** Per-line language names keyed by line ID. */
  lineLanguageMap: Record<string, string>;
}

/** Strips markdown code fences (```json ... ``` or ``` ... ```) from an AI response. */
function stripMarkdownFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

/** Returns true if the string looks like a bare language name (no JSON structure). */
function looksLikePlainLanguageName(s: string): boolean {
  return s.length > 0 && s.length < 64 && !s.includes('{') && !s.includes('[');
}

export const detectSongLanguage = async (song: Section[], signal?: AbortSignal): Promise<DetectionResult> => {
  const lineRefs = getSourceLineRefs(song);
  const songText = lineRefs.map(r => r.text).join('\n');
  if (!songText.trim()) return { languages: [], lineLanguageMap: {} };

  const response = await generateContentWithRetry({
    model: AI_MODEL_NAME,
    contents: buildDetectLanguagePrompt(songText),
    ...(signal ? { signal } : {}),
  });

  const rawText = response.text?.trim() || '';
  // Strip markdown fences that Gemini sometimes wraps around JSON responses.
  const text = stripMarkdownFences(rawText);

  // Try parsing as JSON (multi-language format)
  try {
    const parsed = JSON.parse(text) as { languages?: unknown; lineLanguages?: unknown };
    const languages = Array.isArray(parsed.languages)
      ? [...new Set((parsed.languages as string[]).filter(l => typeof l === 'string' && l.trim()))]
      : [];
    const lineLanguages = Array.isArray(parsed.lineLanguages)
      ? (parsed.lineLanguages as string[]).filter(l => typeof l === 'string')
      : [];

    // Build lineId → language map
    const lineLanguageMap: Record<string, string> = {};
    for (let i = 0; i < Math.min(lineRefs.length, lineLanguages.length); i++) {
      const lang = lineLanguages[i]?.trim();
      const lineId = lineRefs[i]?.lineId;
      if (lang && lineId) lineLanguageMap[lineId] = lang;
    }

    return {
      languages: languages.length > 0 ? languages : ['English'],
      lineLanguageMap,
    };
  } catch {
    // Fallback: plain-text single language name.
    // Guard: never store a raw JSON blob or multi-line string as a language name.
    const fallback = looksLikePlainLanguageName(text) ? text : 'English';
    return {
      languages: [fallback],
      lineLanguageMap: {},
    };
  }
};

export interface IpaEnhancedPromptResult {
  /** The IPA-enriched prompt block, prefixed with newlines, or '' when unavailable. */
  prompt: string;
  /**
   * Authoritative per-line syllable counts produced by the IPA pipeline,
   * keyed by `Line.id`. Empty when the pipeline did not run, was aborted,
   * or produced no usable results.
   */
  ipaSyllableCounts: Map<string, number>;
}

const EMPTY_IPA_PROMPT_RESULT = (): IpaEnhancedPromptResult => ({
  prompt: '',
  ipaSyllableCounts: new Map(),
});

export const getIpaEnhancedPrompt = async (
  sections: Section[],
  sourceLanguage: string,
  newLanguage: string,
  signal: AbortSignal,
  sectionName?: string,
): Promise<IpaEnhancedPromptResult> => {
  const sourceRefs = getSourceLineRefs(sections);
  const sourceLines = sourceRefs.map(r => r.text);
  const sourceLangCode = languageNameToCode(sourceLanguage);
  const targetLangCode = languageNameToCode(newLanguage);

  if (!sourceLangCode || !targetLangCode || sourceLines.length === 0) {
    return EMPTY_IPA_PROMPT_RESULT();
  }

  try {
    const adaptationResult = await matchRhymeSchemeAcrossLang(
      sourceLines,
      sourceLangCode,
      targetLangCode,
      signal
    );
    if (signal.aborted || !adaptationResult.success) {
      return EMPTY_IPA_PROMPT_RESULT();
    }

    // Build authoritative per-line syllable counts aligned to source line IDs.
    const ipaSyllableCounts = new Map<string, number>();
    adaptationResult.sourceAnalysis.forEach((analysis, idx) => {
      const ref = sourceRefs[idx];
      if (!ref || !analysis?.success) return;
      const count = analysis.syllables.length;
      if (count > 0) ipaSyllableCounts.set(ref.lineId, count);
    });

    if (sectionName) {
      logger.debug('IPA constraints applied for section:', sectionName, adaptationResult.sourceScheme);
    } else {
      logger.debug('IPA constraints applied:', adaptationResult.sourceScheme);
    }
    return {
      prompt: `\n\n${adaptationResult.constrainedPrompt}`,
      ipaSyllableCounts,
    };
  } catch (error) {
    if (sectionName) {
      logger.debug('IPA pipeline not available for section, continuing with standard prompt:', error);
    } else {
      logger.debug('IPA pipeline not available, continuing with standard prompt:', error);
    }
    return EMPTY_IPA_PROMPT_RESULT();
  }
};

export const parseAdaptationResponse = (
  params: ParseAdaptationResponseParams,
): Section[] => {
  if (params.kind === 'song') {
    const newSongData = safeJsonParse<AdaptationSectionPayload[]>(params.responseText || '[]', []);
    if (newSongData.length === 0) throw new Error('Empty adaptation response');
    return mapSongWithPreservedIds(newSongData, params.sourceSong, params.newLanguage);
  }

  const newSectionData = safeJsonParse<AdaptationSectionPayload>(params.responseText || '{}', {});
  if (!newSectionData.name) throw new Error('Empty section adaptation response');
  return [mergeAiSectionIntoCurrent(params.section, newSectionData, params.newLanguage)];
};

/**
 * Reverse-translates adapted lyrics literally back to the source language.
 * P6-fix: accepts AbortSignal so the caller's controller can cancel mid-pipeline.
 */
export const reverseTranslate = async (
  adaptedSong: Section[],
  fromLanguage: string,
  toLanguage: string,
  signal?: AbortSignal,
): Promise<string[]> => {
  const lines = adaptedSong.flatMap(s =>
    s.lines.filter(l => !l.isMeta).map(l => l.text)
  );
  return reverseTranslateLines(lines, fromLanguage, toLanguage, signal);
};

/**
 * Reviews the fidelity of an adaptation via LLM scoring (0–100).
 * P6-fix: accepts AbortSignal so the caller's controller can cancel mid-pipeline.
 */
export const reviewFidelity = async (
  originalSong: Section[],
  reversedLines: string[],
  targetLanguage: string,
  sourceLang: string,
  signal?: AbortSignal,
): Promise<{ score: number; warnings: string[] }> => {
  const originalLines = originalSong
    .flatMap(s => s.lines.filter(l => !l.isMeta).map(l => l.text));

  try {
    const result = await reviewTranslationFidelity(
      originalLines,
      reversedLines,
      targetLanguage,
      sourceLang,
      signal,
    );

    if (
      result &&
      typeof result === 'object' &&
      typeof result.score === 'number' &&
      Array.isArray(result.warnings)
    ) {
      return result;
    }
  } catch {
    // Fall through to explicit zero-score fallback below.
  }

  return {
    score: 0,
    warnings: ['Fidelity review failed: invalid or unavailable review response'],
  };
};
