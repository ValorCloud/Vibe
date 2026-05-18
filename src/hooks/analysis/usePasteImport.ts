import { useState, useRef, useEffect, useCallback } from 'react';
import { Type } from '@google/genai';
import { AI_MODEL_NAME, generateContentWithRetry, safeJsonParse, handleApiError } from '../../utils/aiUtils';
import { cleanSectionName } from '../../utils/songUtils';
import { detectRhymeSchemeLocally } from '../../utils/rhymeSchemeUtils';
import { isPureMetaLine, unwrapBracketToken } from '../../utils/metaUtils';
import { generateId } from '../../utils/idUtils';
import { languageNameToCode } from '../../constants/langFamilyMap';
import type { Section } from '../../types';
import type { AdaptationLangId } from '../../i18n/constants';
import { abortCurrent, withAbort, isAbortError } from '../../utils/withAbort';
import { resolveUiLanguageName } from '../../utils/uiLangUtils';
import { SECTION_TYPE_DEFINITIONS } from '../../constants/sections';
import { parseTextToSections } from '../../utils/libraryUtils';
import { UNTRUSTED_INPUT_PREAMBLE, fence, fenceLong, sanitizeForPrompt } from '../../utils/promptSanitization';

/** More aggressive retry budget for chunked paste-import calls. */
const PASTE_IMPORT_RETRY = { maxAttempts: 3, delayMs: 1200 } as const;

type UsePasteImportParams = {
  rhymeScheme: string;
  uiLanguage: string;
  updateSongAndStructureWithHistory: (newSong: Section[], newStructure: string[]) => void;
  setTopic: (value: string) => void;
  setMood: (value: string) => void;
  /** Optional: called when a Markdown H1 or H2 title is detected in the pasted text. */
  setSongTitle?: (value: string) => void;
  currentSongLanguage?: string;
  /** Called when the detected lyric language differs from the current song language.
   *  Receives a canonical AdaptationLangId so the language selector can update
   *  without a round-trip through migrateAdaptationToLangId. */
  onLanguageMismatch?: (lang: AdaptationLangId) => void;
  onDetectedLanguage?: (language: string, sectionIds: string[]) => void;
  requestAutoTitleGeneration: () => void;
  clearLineSelection: () => void;
  setIsAnalyzing: (value: boolean) => void;
  setIsPasteModalOpen: (value: boolean) => void;
  hasApiKey?: boolean;
};

type PasteImportChunk = {
  displayLabel: string;
  nameHint: string;
  text: string;
};

type ChunkResult = {
  name: string;
  rhymeScheme: string | undefined;
  lines: Array<{ text?: string; rhymingSyllables?: string; rhyme?: string; syllables?: number; concept?: string }>;
  _displayLabel: string;
};

export type PasteImportProgress = {
  current: number;
  total: number;
  currentLabel: string;
};

const normalizeLanguageValue = (language: string): string =>
  (languageNameToCode(language) ?? language).trim().toLowerCase();

const EMPTY_PROGRESS: PasteImportProgress = {
  current: 0,
  total: 0,
  currentLabel: '',
};
const MAX_METADATA_PROMPT_LENGTH = 6000;

const SECTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    rhymeScheme: {
      type: Type.STRING,
      description: 'Rhyme scheme: AABB, ABAB, ABCB, AAAA, AABBA, AAABBB, AABBCC, ABABAB, ABCABC, AABCCB, ABACBC, or FREE',
    },
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          rhymingSyllables: { type: Type.STRING },
          rhyme: { type: Type.STRING },
          syllables: { type: Type.INTEGER },
          concept: { type: Type.STRING },
        },
        required: ['text', 'rhymingSyllables', 'rhyme', 'syllables', 'concept'],
      },
    },
  },
  required: ['name', 'lines', 'rhymeScheme'],
};

const METADATA_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    mood: { type: Type.STRING },
    language: { type: Type.STRING },
  },
  required: ['topic', 'mood', 'language'],
};

const normalizeSectionHeaderCandidate = (line: string): string => {
  const trimmed = line.trim().replace(/^#+\s*/, '').replace(/[:::]\s*$/, '');
  const bracketValue = unwrapBracketToken(trimmed);
  return cleanSectionName(bracketValue ?? trimmed);
};

const normalizeSectionLookup = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getSectionHeaderHint = (line: string): string => {
  const normalized = normalizeSectionHeaderCandidate(line);
  const lookup = normalizeSectionLookup(normalized);
  if (!lookup) return '';

  const isStandaloneHeader = SECTION_TYPE_DEFINITIONS.some(({ aliases }) =>
    aliases.some((alias) => {
      const normalizedAlias = normalizeSectionLookup(alias);
      return lookup === normalizedAlias
        || lookup.match(new RegExp(`^${normalizedAlias}\\s+(?:\\d+|[ivx]+)$`, 'i')) !== null;
    }),
  );

  return isStandaloneHeader ? normalized : '';
};

/**
 * Extract a leading Markdown H1 or H2 title and metadata block from pasted text.
 */
const extractH1TitleFromText = (text: string): { songTitle: string | null; lyricsText: string } => {
  const lines = text.split(/\r?\n/);
  let songTitle: string | null = null;
  let firstContentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (songTitle === null && /^#{1,2}\s+.+/.test(line)) {
      songTitle = line.replace(/^#{1,2}\s+/, '').trim();
      firstContentIndex = i + 1;
      continue;
    }
    if (songTitle !== null && /^\*{1,2}[^*]+\*{1,2}\s*:/.test(line)) {
      firstContentIndex = i + 1;
      continue;
    }
    if (songTitle !== null && line !== '') {
      firstContentIndex = i;
      break;
    }
  }

  const lyricsText = songTitle !== null
    ? lines.slice(firstContentIndex).join('\n').trimStart()
    : text;

  return { songTitle, lyricsText };
};

const splitPastedLyricsIntoChunks = (text: string): PasteImportChunk[] => {
  const chunks: PasteImportChunk[] = [];
  const lines = text.split(/\r?\n/);
  let currentHeader = '';
  let currentLines: string[] = [];

  const pushChunk = () => {
    const chunkText = currentLines.join('\n').trim();
    if (!chunkText) return;
    const displayLabel = currentHeader || `Section ${chunks.length + 1}`;
    chunks.push({
      displayLabel,
      nameHint: currentHeader,
      text: chunkText,
    });
    currentLines = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const headerHint = trimmed ? getSectionHeaderHint(trimmed) : '';

    if (headerHint) {
      pushChunk();
      currentHeader = headerHint;
      continue;
    }

    if (!trimmed) {
      if (currentLines.length > 0) {
        pushChunk();
        currentHeader = '';
      }
      continue;
    }

    currentLines.push(rawLine.trimEnd());
  }

  pushChunk();

  if (chunks.length > 0) return chunks;

  const fallbackText = text.trim();
  return fallbackText
    ? [{ displayLabel: 'Section 1', nameHint: '', text: fallbackText }]
    : [];
};

/**
 * Derive a canonical rhyme scheme from per-line rhyme labels when the AI
 * returns FREE but each line carries an individual label (A/B/C…).
 */
const deriveSchemeFromLineLabels = (
  lines: Array<{ rhyme?: string }>,
  fallback: string,
): string => {
  const labels = lines.map(l => (l.rhyme ?? '').trim()).filter(Boolean);
  if (labels.length === 0) return fallback;
  const candidate = labels.join('');
  const KNOWN = [
    'AABB', 'ABAB', 'ABCB', 'AAAA', 'AABBA', 'AAABBB',
    'AABBCC', 'ABABAB', 'ABCABC', 'AABCCB', 'ABACBC',
  ];
  return KNOWN.includes(candidate) ? candidate : fallback;
};

/** True if the section name is an INTRO variant (e.g. "Intro", "Intro 1"). */
const isIntroName = (name: string): boolean =>
  /^intro(\s+\d+)?$/i.test(name.trim());

/**
 * Post-process imported sections:
 * - titleExtracted=false: first INTRO → "Title", subsequent INTROs → "Verse N"
 * - titleExtracted=true:  all INTROs stay "Intro", only duplicate INTROs become "Verse N"
 */
const normalizeImportedSectionNames = (sections: Section[], titleExtracted: boolean): Section[] => {
  const hasTitle = sections.some(s => /^title$/i.test(s.name.trim()));
  let introSeen = false;
  let extraVerseOffset = sections.filter(s => /^verse\s*\d*$/i.test(s.name.trim())).length;

  return sections.map((section) => {
    if (!isIntroName(section.name)) return section;

    if (!introSeen) {
      introSeen = true;
      if (titleExtracted) return section;
      if (!hasTitle) return { ...section, name: 'Title' };
      return section;
    }

    extraVerseOffset += 1;
    return { ...section, name: `Verse ${extraVerseOffset}` };
  });
};

const buildSectionPrompt = (chunk: PasteImportChunk, uiLang: string): string => `${UNTRUSTED_INPUT_PREAMBLE}

Analyze this single lyrics section.
IMPORTANT: You MUST ONLY use the following section names (you can append numbers like "Verse 1", "Chorus 2"):
- Intro
- Verse
- Pre-Chorus
- Chorus
- Final Chorus
- Bridge
- Outro

CRITICAL INSTRUCTIONS:
1. ONLY analyze the lyrics provided below.
2. DO NOT generate new lyrics.
3. DO NOT continue the song.
4. Stop immediately when you reach the end of the provided lyrics.
5. Keep concepts very short (1-3 words) and write them in ${sanitizeForPrompt(uiLang, { maxLength: 64 })}.
6. Performance/production meta-instructions in brackets (e.g. [Guitar solo], [Whispered], [Anthemic], [Ad-lib]) are NOT section headers — include them verbatim as lyric lines with their brackets preserved.
7. If a source section label is provided, normalize it to the closest allowed section name instead of inventing a new one.

RHYME SCHEME DETECTION — CRITICAL RULES:
- Evaluate rhymes phonetically in the language of the lyrics, not in English.
- Near-rhymes, assonances, and imperfect rhymes count as rhyming.
- Assign FREE ONLY when you find absolutely zero recurring end-sound pattern across ANY pair of lines in the section.
- Prefer a structured scheme over FREE whenever at least 2 line-pairs share a sound.

For this single section, return one JSON object with:
- "name": section name
- "rhymeScheme": one of AABB, ABAB, ABCB, AAAA, AABBA, AAABBB, AABBCC, ABABAB, ABCABC, AABCCB, ABACBC, FREE
- "lines": array of lines with exact lyric text, rhyming syllables, rhyme identifier, exact syllable count, and short core concept

${chunk.nameHint ? `${fence('SOURCE_SECTION_LABEL', chunk.nameHint, { maxLength: 64 })}\n\n` : ''}${fenceLong('LYRICS', chunk.text)}`;

const buildMetadataPrompt = (text: string, uiLang: string): string => `${UNTRUSTED_INPUT_PREAMBLE}

Analyze these lyrics and return a JSON object with:
- "topic": the overall topic in ${sanitizeForPrompt(uiLang, { maxLength: 64 })}
- "mood": the overall mood in ${sanitizeForPrompt(uiLang, { maxLength: 64 })}
- "language": the main lyric language in English (e.g. "English", "French", "Yoruba")

Use only the provided lyrics. Do not generate new content.

${fenceLong('LYRICS', text.substring(0, MAX_METADATA_PROMPT_LENGTH), { maxLength: 0 })}`;

export const usePasteImport = ({
  rhymeScheme,
  uiLanguage,
  updateSongAndStructureWithHistory,
  setTopic,
  setMood,
  setSongTitle,
  currentSongLanguage = '',
  onLanguageMismatch,
  onDetectedLanguage,
  requestAutoTitleGeneration,
  clearLineSelection,
  setIsAnalyzing,
  setIsPasteModalOpen,
  hasApiKey = true,
}: UsePasteImportParams) => {
  const [pastedText, setPastedText] = useState('');
  const [hasClipboardText, setHasClipboardText] = useState(false);
  const [importProgress, setImportProgress] = useState<PasteImportProgress>(EMPTY_PROGRESS);

  const abortControllerRef = useRef<AbortController | null>(null);
  useEffect(() => { return () => { abortCurrent(abortControllerRef); }; }, []);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const uiLang = resolveUiLanguageName(uiLanguage);
  const refreshClipboardText = useCallback(async () => {
    if (
      typeof window === 'undefined'
      || !window.isSecureContext
      || typeof navigator === 'undefined'
      || !navigator.clipboard?.readText
    ) {
      setHasClipboardText(false);
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      setHasClipboardText(Boolean(clipboardText.trim()));
    } catch {
      setHasClipboardText(false);
    }
  }, []);

  useEffect(() => {
    void refreshClipboardText();

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleFocus = () => { void refreshClipboardText(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshClipboardText();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshClipboardText]);

  const canPasteLyrics = Boolean(pastedText.trim()) || hasClipboardText;

  const analyzePastedLyrics = async () => {
    if (!pastedText.trim()) return;

    const { songTitle: extractedTitle, lyricsText } = extractH1TitleFromText(pastedText);
    const titleExtracted = Boolean(extractedTitle);
    const textToProcess = titleExtracted ? lyricsText : pastedText;

    if (!hasApiKey) {
      const sections = parseTextToSections(textToProcess);
      if (sections.length === 0) return;
      const newStructure = sections.map(s => s.name);
      updateSongAndStructureWithHistory(sections, newStructure);
      if (extractedTitle && setSongTitle) {
        setSongTitle(extractedTitle);
      } else if (!titleExtracted) {
        requestAutoTitleGeneration();
      }
      clearLineSelection();
      setIsPasteModalOpen(false);
      setPastedText('');
      return;
    }

    const chunks = splitPastedLyricsIntoChunks(textToProcess);
    if (chunks.length === 0) return;

    const firstChunkLabel = chunks[0]?.displayLabel ?? '';
    setIsAnalyzing(true);
    setImportProgress({
      current: 0,
      total: chunks.length,
      currentLabel: firstChunkLabel,
    });

    // Atomic counter + in-progress index tracker for parallel progress updates
    const completedRef = { count: 0 };
    const inProgressRef = new Set<number>();

    let wasAborted = false;
    try {
      await withAbort(abortControllerRef, async (nextSignal) => {

        const chunkPromises = chunks.map(async (chunk, idx): Promise<ChunkResult | null> => {
          // Mark this chunk as in-progress and show the lowest in-flight label
          inProgressRef.add(idx);
          const minInFlight = Math.min(...inProgressRef);
          setImportProgress({
            current: completedRef.count,
            total: chunks.length,
            currentLabel: chunks[minInFlight]?.displayLabel ?? chunk.displayLabel,
          });

          try {
            const response = await generateContentWithRetry({
              model: AI_MODEL_NAME,
              contents: buildSectionPrompt(chunk, uiLang),
              config: {
                responseMimeType: 'application/json',
                responseSchema: SECTION_RESPONSE_SCHEMA,
              },
              signal: nextSignal,
            }, PASTE_IMPORT_RETRY);

            if (nextSignal.aborted) return null;

            const section = safeJsonParse<{
              name?: string;
              rhymeScheme?: string;
              lines?: Array<{ text?: string; rhymingSyllables?: string; rhyme?: string; syllables?: number; concept?: string }>;
            }>(response.text || '{}', {});

            return {
              name: section.name?.trim() || chunk.nameHint || chunk.displayLabel,
              rhymeScheme: section.rhymeScheme,
              lines: section.lines ?? [],
              _displayLabel: chunk.displayLabel,
            };
          } catch (sectionError) {
            if (isAbortError(sectionError)) return null;
            console.warn(`Paste import: section "${chunk.displayLabel}" failed after retries, skipping.`, sectionError);
            return null;
          } finally {
            inProgressRef.delete(idx);
            completedRef.count += 1;
            // After completion, show the next lowest in-flight chunk (if any)
            const nextMin = inProgressRef.size > 0
              ? Math.min(...inProgressRef)
              : idx;
            setImportProgress({
              current: completedRef.count,
              total: chunks.length,
              currentLabel: chunks[nextMin]?.displayLabel ?? chunk.displayLabel,
            });
          }
        });

        const metadataPromise = generateContentWithRetry({
          model: AI_MODEL_NAME,
          contents: buildMetadataPrompt(textToProcess, uiLang),
          config: {
            responseMimeType: 'application/json',
            responseSchema: METADATA_RESPONSE_SCHEMA,
          },
          signal: nextSignal,
        }, PASTE_IMPORT_RETRY).then(res =>
          safeJsonParse<{ topic?: string; mood?: string; language?: string }>(res.text || '{}', {})
        ).catch((err) => {
          console.debug('Failed to analyze pasted lyrics metadata:', err);
          return {} as { topic?: string; mood?: string; language?: string };
        });

        const [chunkResults, metadata] = await Promise.all([
          Promise.all(chunkPromises),
          metadataPromise,
        ]);

        if (nextSignal.aborted) {
          wasAborted = true;
          return;
        }

        const validChunks: ChunkResult[] = chunkResults.filter((r): r is ChunkResult => r !== null);
        if (validChunks.length === 0) return;

        const detectedLanguage = metadata.language;

        const rawSections: Section[] = validChunks.map((chunk) => {
          const rawScheme = chunk.rhymeScheme ?? rhymeScheme;
          const resolvedScheme = rawScheme === 'FREE'
            ? deriveSchemeFromLineLabels(chunk.lines ?? [], 'FREE')
            : rawScheme;

          const section: Section = {
            id: generateId(),
            name: chunk.name,
            rhymeScheme: resolvedScheme,
            lines: (chunk.lines ?? []).map((line) => ({
              id: generateId(),
              text: line.text ?? '',
              rhymingSyllables: line.rhymingSyllables ?? '',
              rhyme: line.rhyme ?? '',
              syllables: line.syllables ?? 0,
              concept: line.concept ?? '',
            })),
          };

          if (detectedLanguage) {
            (section as Section & { language?: string }).language = detectedLanguage;
          }

          return section;
        });

        const newSections = normalizeImportedSectionNames(rawSections, titleExtracted);

        const validSections = newSections.filter(
          section => !isPureMetaLine(section.name) &&
            section.lines.some(line => line.text.trim())
        );
        if (validSections.length === 0) return;

        const newStructure = validSections.map(s => s.name);
        updateSongAndStructureWithHistory(validSections, newStructure);

        if (metadata.topic) setTopic(metadata.topic);
        if (metadata.mood) setMood(metadata.mood);

        if (detectedLanguage) {
          const detectedLang = normalizeLanguageValue(detectedLanguage);
          const currentLang = normalizeLanguageValue(currentSongLanguage);
          if (detectedLang && detectedLang !== currentLang) {
            onLanguageMismatch?.(detectedLanguage as AdaptationLangId);
          }
          const sectionIds = validSections.map(s => s.id);
          onDetectedLanguage?.(detectedLanguage, sectionIds);
        }

        if (extractedTitle && setSongTitle) {
          setSongTitle(extractedTitle);
        } else if (!titleExtracted) {
          requestAutoTitleGeneration();
        }
        clearLineSelection();
        setIsPasteModalOpen(false);
        setPastedText('');
      });
    } catch (error) {
      if (isAbortError(error)) {
        wasAborted = true;
      } else {
        handleApiError(error, 'Paste import error');
        setIsPasteModalOpen(false);
        setPastedText('');
      }
    } finally {
      setIsAnalyzing(false);
      if (!wasAborted) setImportProgress(EMPTY_PROGRESS);
    }
  };

  return {
    pastedText, setPastedText,
    hasClipboardText,
    canPasteLyrics,
    importProgress,
    analyzePastedLyrics,
    refreshClipboardText,
  };
};
