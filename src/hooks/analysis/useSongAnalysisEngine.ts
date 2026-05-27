import { useCallback, useEffect, useRef, useState } from 'react';
import { Type } from '@google/genai';
import { AI_MODEL_NAME, generateContentWithRetry, safeJsonParse } from '../../utils/aiUtils';
import { mapSongWithPreservedIds } from '../../utils/songMergeUtils';
import { resolveUiLanguageName } from '../../utils/uiLangUtils';
import { getSectionText } from '../../utils/songUtils';
import type { Section } from '../../types';
import { abortCurrent, withAbort, isAbortError } from '../../utils/withAbort';
import { useBackgroundThemeAnalysis } from './useBackgroundThemeAnalysis';
import {
  buildApplyAnalysisBatchPrompt,
  buildApplyAnalysisItemPrompt,
  buildSongAnalysisPrompt,
} from '../../utils/promptUtils';
import { analyzeSongRhymes } from '../../utils/songRhymeAnalysis';
import { logger } from '../../utils/logger';

export { analyzeSongRhymes } from '../../utils/songRhymeAnalysis';

/** Maximum characters sent to the AI for song analysis. Prevents unbounded payloads on very long songs. */
const MAX_SONG_TEXT_CHARS = 40_000;

type AnalysisReport = {
  theme: string;
  emotionalArc: string;
  technicalAnalysis: string[];
  strengths: string[];
  improvements: string[];
  musicalSuggestions: string[];
  summary: string;
};

const EMPTY_ANALYSIS_REPORT: AnalysisReport = {
  theme: '',
  emotionalArc: '',
  technicalAnalysis: [],
  strengths: [],
  improvements: [],
  musicalSuggestions: [],
  summary: '',
};

/** Ensures all array fields are actual arrays regardless of what the AI returned. */
function normalizeAnalysisReport(raw: AnalysisReport): AnalysisReport {
  return {
    theme: raw.theme ?? '',
    emotionalArc: raw.emotionalArc ?? '',
    technicalAnalysis: Array.isArray(raw.technicalAnalysis) ? raw.technicalAnalysis : [],
    strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
    musicalSuggestions: Array.isArray(raw.musicalSuggestions) ? raw.musicalSuggestions : [],
    summary: raw.summary ?? '',
  };
}

type SaveVersionFn = (name: string, snapshot?: {
  song: Section[];
  structure: string[];
  title: string;
  titleOrigin: 'user' | 'ai';
  topic: string;
  mood: string;
}) => void;

type UseSongAnalysisEngineParams = {
  song: Section[];
  topic: string;
  mood: string;
  uiLanguage: string;
  saveVersion: SaveVersionFn;
  updateSongAndStructureWithHistory: (newSong: Section[], newStructure: string[]) => void;
  setTopic: (value: string) => void;
  setMood: (value: string) => void;
  setIsAnalyzing: (value: boolean) => void;
  setIsAnalysisModalOpen: (value: boolean) => void;
  hasApiKey: boolean;
};

const SONG_SECTIONS_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      rhymeScheme: { type: Type.STRING },
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
    required: ['name', 'lines'],
  },
};

export const useSongAnalysisEngine = ({
  song,
  topic,
  mood,
  uiLanguage,
  saveVersion,
  updateSongAndStructureWithHistory,
  setTopic,
  setMood,
  setIsAnalyzing,
  setIsAnalysisModalOpen,
  hasApiKey,
}: UseSongAnalysisEngineParams) => {
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [analysisSteps, setAnalysisSteps] = useState<string[]>([]);
  const [appliedAnalysisItems, setAppliedAnalysisItems] = useState<Set<string>>(new Set());
  const [selectedAnalysisItems, setSelectedAnalysisItems] = useState<Set<string>>(new Set());
  const [isApplyingAnalysis, setIsApplyingAnalysis] = useState<string | null>(null);
  /** Foreground-only controller for user-triggered analysis/apply actions; keep separate from background aborts. */
  const fgAbortRef = useRef<AbortController | null>(null);
  /** Language name used when the current analysisReport was generated. */
  const reportLangRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      abortCurrent(fgAbortRef);
    };
  }, []);

  const uiLang = resolveUiLanguageName(uiLanguage);
  const { isAnalyzingTheme } = useBackgroundThemeAnalysis({
    song,
    topic,
    mood,
    uiLanguage: uiLang,
    setTopic,
    setMood,
    hasApiKey,
  });

  const toggleAnalysisItemSelection = useCallback((itemText: string) => {
    setSelectedAnalysisItems(prev => {
      const next = new Set(prev);
      if (next.has(itemText)) next.delete(itemText);
      else next.add(itemText);
      return next;
    });
  }, []);

  const clearAppliedAnalysisItems = useCallback(() => {
    setAppliedAnalysisItems(new Set());
  }, []);

  const analyzeLocalRhymes = useCallback(() => analyzeSongRhymes(song), [song]);

  const applySelectedAnalysisItems = useCallback(async () => {
    if (selectedAnalysisItems.size === 0 || isApplyingAnalysis) return;

    const itemsToApply = Array.from(selectedAnalysisItems);
    setIsApplyingAnalysis('batch');
    saveVersion('Before Analysis Batch Improvements');

    let wasAborted = false;
    try {
      await withAbort(fgAbortRef, async (nextSignal) => {
        const prompt = buildApplyAnalysisBatchPrompt({
          song,
          itemsToApply,
          uiLanguage: uiLang,
        });

        const response = await generateContentWithRetry({
          model: AI_MODEL_NAME,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: SONG_SECTIONS_RESPONSE_SCHEMA,
          },
          signal: nextSignal,
        });

        if (nextSignal.aborted) {
          wasAborted = true;
          return;
        }

        const newSongData = safeJsonParse<Section[]>(response.text || '[]', []);
        if (newSongData.length > 0) {
          const updatedSong = mapSongWithPreservedIds(newSongData, song);
          updateSongAndStructureWithHistory(updatedSong, updatedSong.map(s => s.name));
          setAppliedAnalysisItems(prev => {
            const next = new Set(prev);
            itemsToApply.forEach(item => next.add(item));
            return next;
          });
          setSelectedAnalysisItems(new Set());
        }
      });
    } catch (error: unknown) {
      if (isAbortError(error)) {
        wasAborted = true;
        return;
      }
      logger.error('Apply batch analysis error:', error);
    } finally {
      if (!wasAborted) setIsApplyingAnalysis(null);
    }
  }, [song, selectedAnalysisItems, isApplyingAnalysis, uiLang, saveVersion, updateSongAndStructureWithHistory]);

  const applyAnalysisItem = useCallback(async (itemText: string) => {
    if (isApplyingAnalysis) return;

    setIsApplyingAnalysis(itemText);

    if (appliedAnalysisItems.size === 0) {
      saveVersion('Before Analysis Improvements');
    }

    let wasAborted = false;
    try {
      await withAbort(fgAbortRef, async (nextSignal) => {
        const prompt = buildApplyAnalysisItemPrompt({
          song,
          itemText,
          uiLanguage: uiLang,
        });

        const response = await generateContentWithRetry({
          model: AI_MODEL_NAME,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: SONG_SECTIONS_RESPONSE_SCHEMA,
          },
          signal: nextSignal,
        });

        if (nextSignal.aborted) {
          wasAborted = true;
          return;
        }

        const newSongData = safeJsonParse<Section[]>(response.text || '[]', []);
        if (newSongData.length > 0) {
          const updatedSong = mapSongWithPreservedIds(newSongData, song);
          updateSongAndStructureWithHistory(updatedSong, updatedSong.map(s => s.name));
          setAppliedAnalysisItems(prev => new Set(prev).add(itemText));
        }
      });
    } catch (error: unknown) {
      if (isAbortError(error)) {
        wasAborted = true;
        return;
      }
      logger.error('Apply analysis error:', error);
    } finally {
      if (!wasAborted) setIsApplyingAnalysis(null);
    }
  }, [song, appliedAnalysisItems, isApplyingAnalysis, uiLang, saveVersion, updateSongAndStructureWithHistory]);

  const analyzeCurrentSong = useCallback(async () => {
    if (song.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisSteps(['Gathering song data...']);
    setIsAnalysisModalOpen(true);
    setAnalysisReport(null);
    setAppliedAnalysisItems(new Set());

    let wasAborted = false;
    try {
      await withAbort(fgAbortRef, async (nextSignal) => {
        setAnalysisSteps(prev => [...prev, 'Analyzing structure and flow...']);
        const rawSongText = song.map(s => `[${s.name}]\n${getSectionText(s)}`).join('\n\n');
        // FIX (PR-3): cap input to prevent unbounded AI payloads on very long songs.
        const songText = rawSongText.length > MAX_SONG_TEXT_CHARS
          ? rawSongText.slice(0, MAX_SONG_TEXT_CHARS)
          : rawSongText;

        const prompt = buildSongAnalysisPrompt({
          songText,
          uiLanguage: uiLang,
        });

        setAnalysisSteps(prev => [...prev, 'Consulting AI Lyricist...']);
        const response = await generateContentWithRetry({
          model: AI_MODEL_NAME,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                theme: { type: Type.STRING },
                emotionalArc: { type: Type.STRING },
                technicalAnalysis: { type: Type.ARRAY, items: { type: Type.STRING } },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
                musicalSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                summary: { type: Type.STRING },
              },
              required: ['theme', 'emotionalArc', 'technicalAnalysis', 'strengths', 'improvements', 'musicalSuggestions', 'summary'],
            },
          },
          signal: nextSignal,
        });

        if (nextSignal.aborted) {
          wasAborted = true;
          return;
        }

        setAnalysisSteps(prev => [...prev, 'Finalizing report...']);
        const raw = safeJsonParse<AnalysisReport>(response.text || '{}', EMPTY_ANALYSIS_REPORT);
        setAnalysisReport(normalizeAnalysisReport(raw));
        reportLangRef.current = uiLang;
        setAnalysisSteps(prev => [...prev, 'Analysis complete!']);
      });
    } catch (error) {
      if (isAbortError(error)) {
        wasAborted = true;
        return;
      }
      logger.error('Analysis error:', error);
      setAnalysisSteps(prev => [...prev, 'Error during analysis. Please try again.']);
    } finally {
      if (!wasAborted) setIsAnalyzing(false);
    }
  }, [song, uiLang, setIsAnalyzing, setIsAnalysisModalOpen]);

  // Re-run analysis automatically when the UI language changes while a report exists.
  useEffect(() => {
    if (
      reportLangRef.current !== null &&
      reportLangRef.current !== uiLang
    ) {
      analyzeCurrentSong();
    }
  }, [uiLang, analyzeCurrentSong]);

  return {
    analysisReport,
    analysisSteps,
    appliedAnalysisItems,
    selectedAnalysisItems,
    isApplyingAnalysis,
    isAnalyzingTheme,
    toggleAnalysisItemSelection,
    analyzeLocalRhymes,
    applySelectedAnalysisItems,
    applyAnalysisItem,
    analyzeCurrentSong,
    clearAppliedAnalysisItems,
  };
};
