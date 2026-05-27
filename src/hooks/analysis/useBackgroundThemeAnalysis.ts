import { useEffect, useRef, useState } from 'react';
import { Type } from '@google/genai';
import { AI_MODEL_NAME, generateContentWithRetry, handleApiError, safeJsonParse } from '../../utils/aiUtils';
import { buildThemeAnalysisPrompt } from '../../utils/promptUtils';
import type { Section } from '../../types';
import { abortCurrent, isAbortError, withAbort } from '../../utils/withAbort';
import { logger } from '../../utils/logger';

type UseBackgroundThemeAnalysisParams = {
  song: Section[];
  topic: string;
  mood: string;
  uiLanguage?: string;
  setTopic: (v: string) => void;
  setMood: (v: string) => void;
  hasApiKey: boolean;
};

/**
 * djb2 hash — fast non-cryptographic string hash.
 * Mirrors the implementation in useLinguisticsWorker for consistency.
 */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

/** Lightweight song fingerprint: XOR of per-line (lineId + length + content hash). */
function songFingerprint(song: Section[]): number {
  let fp = 0;
  for (const s of song) {
    for (const l of s.lines) {
      fp ^= djb2(l.id + l.text.length.toString(16) + djb2(l.text).toString(16));
    }
  }
  return fp;
}

export const useBackgroundThemeAnalysis = ({
  song,
  topic,
  mood,
  uiLanguage = '',
  setTopic,
  setMood,
  hasApiKey,
}: UseBackgroundThemeAnalysisParams): { isAnalyzingTheme: boolean } => {
  const [isAnalyzingTheme, setIsAnalyzingTheme] = useState(false);

  // Stores the last hash that triggered an analysis — avoids re-analyzing unchanged content.
  const lastAnalyzedHashRef = useRef<number | null>(null);
  const backoffUntilRef = useRef(0);
  const bgAbortControllerRef = useRef<AbortController | null>(null);
  const isAnalyzingThemeRef = useRef(false);

  // Stable refs for values used inside the async callback but not needed as triggers.
  const topicRef = useRef(topic);
  topicRef.current = topic;
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const uiLanguageRef = useRef(uiLanguage);
  uiLanguageRef.current = uiLanguage;
  const setTopicRef = useRef(setTopic);
  setTopicRef.current = setTopic;
  const setMoodRef = useRef(setMood);
  setMoodRef.current = setMood;

  useEffect(() => {
    return () => {
      abortCurrent(bgAbortControllerRef);
    };
  }, []);

  useEffect(() => {
    if (!hasApiKey) return;
    if (song.length === 0) return;

    const hash = songFingerprint(song);
    if (hash === lastAnalyzedHashRef.current) return;

    const timer = setTimeout(async () => {
      if (Date.now() < backoffUntilRef.current) return;
      if (isAnalyzingThemeRef.current) return;

      lastAnalyzedHashRef.current = hash;
      isAnalyzingThemeRef.current = true;
      setIsAnalyzingTheme(true);

      let wasAborted = false;
      try {
        await withAbort(bgAbortControllerRef, async (nextSignal) => {
          const prompt = buildThemeAnalysisPrompt({
            song,
            topic: topicRef.current,
            mood: moodRef.current,
            uiLanguage: uiLanguageRef.current || 'English',
          });
          const response = await generateContentWithRetry({
            model: AI_MODEL_NAME,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  mood: { type: Type.STRING },
                },
              },
            },
            signal: nextSignal,
          });

          if (nextSignal.aborted) {
            wasAborted = true;
            return;
          }

          const data = safeJsonParse<{ topic?: string; mood?: string }>(response.text || '{}', {});
          if (data.topic && data.topic !== topicRef.current) setTopicRef.current(data.topic);
          if (data.mood && data.mood !== moodRef.current) setMoodRef.current(data.mood);
        });
      } catch (e) {
        if (isAbortError(e)) {
          wasAborted = true;
          return;
        }
        const msg = e instanceof Error ? e.message : '';
        const isQuota = (e as { code?: unknown })?.code === 429 || msg.includes('429') || msg.includes('quota');
        if (isQuota) {
          backoffUntilRef.current = Date.now() + 5 * 60 * 1000;
          logger.warn('[useBackgroundThemeAnalysis] Quota exceeded — background analysis paused for 5 minutes.');
        } else {
          handleApiError(e, 'Background analysis failed.');
        }
      } finally {
        isAnalyzingThemeRef.current = false;
        if (!wasAborted) setIsAnalyzingTheme(false);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasApiKey, song]);

  return { isAnalyzingTheme };
};
