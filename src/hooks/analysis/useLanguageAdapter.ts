import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { AI_MODEL_NAME, generateContentWithRetry, safeJsonParse } from '../../utils/aiUtils';
import { mergeAiSectionIntoCurrent } from '../../utils/songMergeUtils';
import { isSectionHeader } from '../../utils/metaUtils';
import { resolveUiLanguageName } from '../../utils/uiLangUtils';
import { sanitizeLangName } from '../../utils/sanitizeLangInput';
import { langIdToAiName } from '../../i18n';
import type { AdaptationLangId } from '../../i18n/constants';
import type { Line, Section } from '../../types';
import { makeSongUpdater } from '../hookUtils';
import {
  type AdaptationProgress,
  type AdaptationResult,
  type AdaptationStepId,
  PIPELINE_STEPS,
  IDLE_PROGRESS,
} from './languageAdapterTypes';
import { detectSongLanguage, getAdaptationResponseSchema, getIpaEnhancedPrompt, getLineAdaptationResponseSchema, parseAdaptationResponse, reverseTranslate, reviewFidelity } from './languageAdapterPipeline';
import { abortCurrent, withAbort, isAbortError } from '../../utils/withAbort';
import { buildAdaptLinePrompt, buildAdaptSectionPrompt, buildAdaptSongPrompt } from '../../utils/promptUtils';
import { logger } from '../../utils/logger';
export type { AdaptationStepId, AdaptationStep, AdaptationProgress, AdaptationResult } from './languageAdapterTypes';
type SaveVersionFn = (name: string, snapshot?: { song: Section[]; structure: string[]; title: string; titleOrigin: 'user' | 'ai'; topic: string; mood: string }) => void;
type UseLanguageAdapterParams = {
  song: Section[];
  uiLanguage: string;
  saveVersion: SaveVersionFn;
  updateSongAndStructureWithHistory: (newSong: Section[], newStructure: string[]) => void;
  updateState: (recipe: (current: { song: Section[]; structure: string[] }) => { song: Section[]; structure: string[] }) => void;
  isGeneratingRef: RefObject<boolean>;
  songLanguage: string;
  setSongLanguage: (lang: string) => void;
  detectedLanguages: string[];
  setDetectedLanguages: (langs: string[]) => void;
  lineLanguages: Record<string, string>;
  setLineLanguages: (map: Record<string, string>) => void;
  hasApiKey: boolean;
};
type AdaptationScope = { kind: 'song'; sourceSong: Section[] } | { kind: 'section'; section: Section };
export const useLanguageAdapter = ({
  song,
  uiLanguage,
  saveVersion,
  updateSongAndStructureWithHistory,
  updateState,
  isGeneratingRef,
  songLanguage,
  setSongLanguage,
  detectedLanguages,
  setDetectedLanguages,
  lineLanguages,
  setLineLanguages,
  hasApiKey,
}: UseLanguageAdapterParams) => {
  // Initial value uses the canonical langId for English so that the dropdown
  // (whose options are keyed by langId) renders the correct flag/label pair
  // on first paint without needing migration.
  const [targetLanguage, setTargetLanguage] = useState<AdaptationLangId>('adapt:EN' as AdaptationLangId);
  const [sectionTargetLanguages, setSectionTargetLanguages] = useState<Record<string, AdaptationLangId>>({});
  const [isDetectingLanguage, setIsDetectingLanguage] = useState(false);
  const [isAdaptingLanguage, setIsAdaptingLanguage] = useState(false);
  const [adaptingLineIds, setAdaptingLineIds] = useState<Set<string>>(new Set());
  const [adaptationProgress, setAdaptationProgress] = useState<AdaptationProgress>(IDLE_PROGRESS);
  const [adaptationResult, setAdaptationResult] = useState<AdaptationResult | null>(null);

  const autoDetectFiredRef = useRef(false);
  const firstSectionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lineAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const detectRunIdRef = useRef(0);
  const adaptRunIdRef = useRef(0);
  const adaptationLabelRef = useRef('');

  const songRef = useRef(song);
  songRef.current = song;
  const songLanguageRef = useRef(songLanguage);
  songLanguageRef.current = songLanguage;
  const uiLanguageRef = useRef(uiLanguage);
  uiLanguageRef.current = uiLanguage;
  const saveVersionRef = useRef(saveVersion);
  saveVersionRef.current = saveVersion;
  const updateSongAndStructureWithHistoryRef = useRef(updateSongAndStructureWithHistory);
  updateSongAndStructureWithHistoryRef.current = updateSongAndStructureWithHistory;
  const updateStateRef = useRef(updateState);
  updateStateRef.current = updateState;
  const setSongLanguageRef = useRef(setSongLanguage);
  setSongLanguageRef.current = setSongLanguage;
  const setDetectedLanguagesRef = useRef(setDetectedLanguages);
  setDetectedLanguagesRef.current = setDetectedLanguages;
  const setLineLanguagesRef = useRef(setLineLanguages);
  setLineLanguagesRef.current = setLineLanguages;

  const updateSong = makeSongUpdater(updateState);
  const uiLang = resolveUiLanguageName(uiLanguage);
  const isGenerating = isGeneratingRef.current ?? false;

  useEffect(() => {
    const lineControllers = lineAbortControllersRef.current;
    return () => {
      abortCurrent(abortRef);
      for (const controller of lineControllers.values()) {
        controller.abort();
      }
      lineControllers.clear();
    };
  }, []);

  useEffect(() => {
    if (song.length === 0) return;
    const currentFirstId = song[0]!.id;
    if (firstSectionIdRef.current !== null && firstSectionIdRef.current !== currentFirstId) {
      autoDetectFiredRef.current = false;
      setSongLanguage('');
      setDetectedLanguages([]);
      setLineLanguages({});
    }
    firstSectionIdRef.current = currentFirstId;
  }, [song, setSongLanguage, setDetectedLanguages, setLineLanguages]);

  useEffect(() => {
    if (!hasApiKey) return;
    if (song.length > 0 && !songLanguage && !isGeneratingRef.current && !isAdaptingLanguage && !autoDetectFiredRef.current) {
      autoDetectFiredRef.current = true;
      void detectLanguage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasApiKey, song.length, songLanguage, isGenerating, isAdaptingLanguage]);

  useEffect(() => {
    if (song.length === 0) {
      autoDetectFiredRef.current = false;
      firstSectionIdRef.current = null;
      setSongLanguage('');
      setDetectedLanguages([]);
      setLineLanguages({});
    }
  }, [song.length, setSongLanguage, setDetectedLanguages, setLineLanguages]);

  const setStep = (id: AdaptationStepId, label: string) =>
    setAdaptationProgress(prev => ({ ...prev, active: id, label }));

  const detectLanguage = useCallback(async () => {
    const currentSong = songRef.current;
    if (currentSong.length === 0) return;

    const runId = ++detectRunIdRef.current;
    setIsDetectingLanguage(true);
    try {
      await withAbort(abortRef, async (nextSignal) => {
        const result = await detectSongLanguage(currentSong, nextSignal);
        if (nextSignal.aborted) return;
        if (result.languages.length > 0) {
          setSongLanguageRef.current(result.languages[0]!);
          setDetectedLanguagesRef.current(result.languages);
        }
        setLineLanguagesRef.current(result.lineLanguageMap);
      });
    } catch (error) {
      if (isAbortError(error)) return;
      logger.error('Language detection error:', error);
    } finally {
      if (detectRunIdRef.current === runId) setIsDetectingLanguage(false);
    }
  }, []);

  const runAdaptationPipeline = async (
    scope: AdaptationScope,
    newLanguage: string,
    sourceLanguage: string,
    signal: AbortSignal,
    buildPrompt: (ipaEnhancedPrompt: string, ipaSyllableCounts: ReadonlyMap<string, number>) => string,
    onAdapted: (adaptedSong: Section[]) => void,
  ): Promise<void> => {
    const sourceSong = scope.kind === 'song' ? scope.sourceSong : [scope.section];
    const { prompt: ipaEnhancedPrompt, ipaSyllableCounts } = await getIpaEnhancedPrompt(
      sourceSong,
      sourceLanguage,
      newLanguage,
      signal,
      scope.kind === 'section' ? scope.section.name : undefined,
    );
    if (signal.aborted) return;

    const adaptResponse = await generateContentWithRetry({
      model: AI_MODEL_NAME,
      contents: buildPrompt(ipaEnhancedPrompt, ipaSyllableCounts),
      config: {
        responseMimeType: 'application/json',
        responseSchema: getAdaptationResponseSchema(scope.kind),
      },
      signal,
    });
    if (signal.aborted) return;

    const adaptedSong = scope.kind === 'song'
      ? parseAdaptationResponse({
          kind: 'song',
          responseText: adaptResponse.text || '[]',
          sourceSong,
          newLanguage,
        })
      : parseAdaptationResponse({
          kind: 'section',
          responseText: adaptResponse.text || '{}',
          section: scope.section,
          newLanguage,
        });

    setStep('reversing', adaptationLabelRef.current);
    onAdapted(adaptedSong);

    const reversedLines = await reverseTranslate(adaptedSong, newLanguage, sourceLanguage, signal);
    if (signal.aborted) return;

    setStep('reviewing', adaptationLabelRef.current);
    const { score, warnings } = await reviewFidelity(sourceSong, reversedLines, newLanguage, sourceLanguage, signal);
    if (signal.aborted) return;

    const result: AdaptationResult = { score, warnings, accepted: score >= 50, targetLanguage: newLanguage };
    setAdaptationResult(result);
  };

  const runAdaptation = async ({
    scope,
    newLanguage,
    sourceLanguage,
    progressLabel,
    saveLabel,
    errorLabel,
    buildPrompt,
    onAdapted,
  }: {
    scope: AdaptationScope;
    newLanguage: string;
    sourceLanguage: string;
    progressLabel: string;
    saveLabel: string;
    errorLabel: string;
    buildPrompt: (ipaEnhancedPrompt: string, ipaSyllableCounts: ReadonlyMap<string, number>) => string;
    onAdapted: (adaptedSong: Section[]) => void;
  }) => {
    const runId = ++adaptRunIdRef.current;

    adaptationLabelRef.current = progressLabel;
    setIsAdaptingLanguage(true);
    setAdaptationResult(null);
    setAdaptationProgress({ active: 'adapting', steps: PIPELINE_STEPS, label: progressLabel });
    saveVersionRef.current(saveLabel);

    try {
      await withAbort(abortRef, async (nextSignal) => {
        setStep('adapting', progressLabel);
        await runAdaptationPipeline(scope, newLanguage, sourceLanguage, nextSignal, buildPrompt, onAdapted);
        if (nextSignal.aborted) return;
        setAdaptationProgress({ active: 'done', steps: PIPELINE_STEPS, label: progressLabel });
      });
    } catch (error) {
      if (isAbortError(error)) return;
      logger.error(errorLabel, error);
      setAdaptationProgress({ active: 'failed', steps: PIPELINE_STEPS, label: progressLabel });
    } finally {
      if (adaptRunIdRef.current === runId) setIsAdaptingLanguage(false);
    }
  };

  /**
   * Adapt the full song to a target language.
   *
   * `rawLanguage` must be a canonical `AdaptationLangId` ("adapt:*" or
   * "custom:*"). Callers must normalise legacy values via
   * `migrateAdaptationToLangId` before reaching this boundary.
   */
  const adaptSongLanguage = useCallback(async (rawLanguage: AdaptationLangId) => {
    const newLanguage = sanitizeLangName(langIdToAiName(rawLanguage));
    const currentSong = songRef.current;
    const currentSongLanguage = songLanguageRef.current;
    const currentUiLang = resolveUiLanguageName(uiLanguageRef.current);
    if (currentSong.length === 0 || newLanguage === currentSongLanguage) return;

    const sourceSong = [...currentSong];
    const sourceLanguage = currentSongLanguage || 'unknown';
    const progressLabel = `${sourceLanguage} → ${newLanguage}`;

    await runAdaptation({
      scope: { kind: 'song', sourceSong },
      newLanguage,
      sourceLanguage,
      progressLabel,
      saveLabel: `Before Translation to ${newLanguage}`,
      errorLabel: 'Language adaptation error:',
      buildPrompt: (ipaEnhancedPrompt, ipaSyllableCounts) => buildAdaptSongPrompt({ sourceSong, newLanguage, uiLanguage: currentUiLang, ipaEnhancedPrompt, ipaSyllableCounts }),
      onAdapted: adaptedSong => {
        updateSongAndStructureWithHistoryRef.current(adaptedSong, adaptedSong.map(section => section.name));
        setSongLanguageRef.current(newLanguage);
        setDetectedLanguagesRef.current([newLanguage]);
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Adapt a single section to a target language.
   *
   * Same contract as `adaptSongLanguage`: `rawLanguage` must be a canonical
   * `AdaptationLangId`. The UI selector enforces this by emitting only langId
   * values (or custom: sentinels) across the component boundary.
   */
  const adaptSectionLanguage = async (sectionId: string, rawLanguage: AdaptationLangId) => {
    const newLanguage = sanitizeLangName(langIdToAiName(rawLanguage));
    const section = song.find(s => s.id === sectionId);
    if (!section) return;

    const sourceLanguage = songLanguage || 'unknown';
    const progressLabel = `${section.name}: ${sourceLanguage} → ${newLanguage}`;

    await runAdaptation({
      scope: { kind: 'section', section },
      newLanguage,
      sourceLanguage,
      progressLabel,
      saveLabel: `Before Section ${section.name} Translation to ${newLanguage}`,
      errorLabel: 'Section language adaptation error:',
      buildPrompt: (ipaEnhancedPrompt, ipaSyllableCounts) => buildAdaptSectionPrompt({ section, newLanguage, uiLanguage: uiLang, ipaEnhancedPrompt, ipaSyllableCounts }),
      onAdapted: adaptedSong => updateSong(currentSong => currentSong.map(currentSection =>
        currentSection.id === sectionId
          ? mergeAiSectionIntoCurrent(currentSection, adaptedSong[0]!, newLanguage)
          : currentSection
      )),
    });

    void detectLanguage();
  };

  /**
   * Adapt a single line to a target language.
   *
   * Same contract as `adaptSongLanguage` and `adaptSectionLanguage`:
   * `rawLanguage` must be a canonical `AdaptationLangId` ("adapt:*" or
   * "custom:*"). Callers must normalise legacy values via
   * `migrateAdaptationToLangId` before reaching this boundary.
   */
  const adaptLineLanguage = async (sectionId: string, lineId: string, rawLanguage: AdaptationLangId) => {
    const newLanguage = sanitizeLangName(langIdToAiName(rawLanguage));
    const section = song.find(s => s.id === sectionId);
    if (!section) return;
    const line = section.lines.find(l => l.id === lineId);
    if (!line) return;

    setAdaptingLineIds(prev => new Set(prev).add(lineId));
    try {
      const controller = new AbortController();
      lineAbortControllersRef.current.get(lineId)?.abort();
      lineAbortControllersRef.current.set(lineId, controller);

      const adaptResponse = await generateContentWithRetry({
        model: AI_MODEL_NAME,
        contents: buildAdaptLinePrompt({ line, newLanguage, uiLanguage: uiLang }),
        config: {
          responseMimeType: 'application/json',
          responseSchema: getLineAdaptationResponseSchema(),
        },
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const linePayload = safeJsonParse<Partial<Line>>(adaptResponse.text || '{}', {});
      if (linePayload.text) {
        updateSong(currentSong => currentSong.map(currentSection => {
          if (currentSection.id !== sectionId) return currentSection;
          return {
            ...currentSection,
            lines: currentSection.lines.map(currentLine => {
              if (currentLine.id !== lineId) return currentLine;
              return {
                ...currentLine,
                text: linePayload.text!,
                rhymingSyllables: linePayload.rhymingSyllables ?? currentLine.rhymingSyllables,
                rhyme: linePayload.rhyme ?? currentLine.rhyme,
                syllables: linePayload.syllables ?? currentLine.syllables,
                concept: linePayload.concept ?? currentLine.concept,
              };
            }),
          };
        }));
      }
    } catch (error) {
      if (isAbortError(error)) return;
      logger.error('Line adaptation error:', error);
    } finally {
      lineAbortControllersRef.current.delete(lineId);
      setAdaptingLineIds(prev => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    }
  };

  return {
    songLanguage, setSongLanguage,
    detectedLanguages, lineLanguages,
    targetLanguage, setTargetLanguage,
    sectionTargetLanguages, setSectionTargetLanguages,
    isDetectingLanguage, isAdaptingLanguage,
    adaptingLineIds,
    adaptationProgress, adaptationResult,
    detectLanguage, adaptSongLanguage, adaptSectionLanguage, adaptLineLanguage,
  };
};
