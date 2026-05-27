import { useState, useRef, useEffect, useCallback } from 'react';
import { AI_MODEL_NAME, generateContentWithRetry, safeJsonParse, handleApiError } from '../../utils/aiUtils';
import { detectRhymeSchemeLocally } from '../../utils/rhymeSchemeUtils';
import { isPureMetaLine } from '../../utils/metaUtils';
import { generateId } from '../../utils/idUtils';
import type { Section } from '../../types';
import type { AdaptationLangId } from '../../i18n/constants';
import { abortCurrent, withAbort, isAbortError } from '../../utils/withAbort';
import { resolveUiLanguageName } from '../../utils/uiLangUtils';
import { parseTextToSections } from '../../utils/libraryUtils';
import { logger } from '../../utils/logger';
import {
  PASTE_IMPORT_RETRY,
  SECTION_RESPONSE_SCHEMA,
  METADATA_RESPONSE_SCHEMA,
  EMPTY_PROGRESS,
  type PasteImportProgress,
  type PasteImportChunk,
  type ChunkResult,
  normalizeLanguageValue,
  extractH1TitleFromText,
  splitPastedLyricsIntoChunks,
  deriveSchemeFromLineLabels,
  normalizeImportedSectionNames,
  buildSectionPrompt,
  buildMetadataPrompt,
} from './usePasteImport.parsers';

export type { PasteImportProgress } from './usePasteImport.parsers';

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
            logger.warn(`Paste import: section "${chunk.displayLabel}" failed after retries, skipping.`, sectionError);
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
          logger.debug('Failed to analyze pasted lyrics metadata:', err);
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
