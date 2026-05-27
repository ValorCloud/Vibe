import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';
import { AI_MODEL_NAME, generateContentWithRetry, safeJsonParse } from '../utils/aiUtils';
import { withAbort, isAbortError } from '../utils/withAbort';
import { useSongContext } from '../contexts/SongContext';
import { DEFAULT_TITLE } from '../constants/editor';
import { sanitizeForPrompt } from '../utils/promptSanitization';
import { logger } from '../utils/logger';

interface TopicMoodSuggestion {
  topic: string;
  mood: string;
  title: string;
}

/** Zod schema — validates that all three AI-generated fields are non-empty strings. */
const TopicMoodSuggestionSchema = z.object({
  topic: z.string().min(1),
  mood: z.string().min(1),
  title: z.string().min(1),
});

export function useTopicMoodSuggester({ hasApiKey }: { hasApiKey: boolean }) {
  const {
    title: currentTitle,
    topic: currentTopic,
    mood: currentMood,
    songLanguage,
    setTitle,
    setTitleOrigin,
    setTopic,
    setMood,
  } = useSongContext();
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [hasSuggested, setHasSuggested] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortControllerRef.current?.abort(); }, []);

  const generateSuggestion = useCallback(async (): Promise<TopicMoodSuggestion | null> => {
    setIsGeneratingSuggestion(true);
    let wasAborted = false;
    try {
      return await withAbort(abortControllerRef, async (nextSignal) => {
        const safeLang = sanitizeForPrompt(songLanguage.trim(), { maxLength: 64 });
        const languageInstruction = safeLang
          ? `\nWhen responding, write the "topic", "mood", and "title" values exclusively in ${safeLang}.`
          : '';
        const prompt = `Generate a creative, inspiring song topic, matching mood, and fitting title for a songwriting session.\nReturn as JSON:\n{\n  "topic": "short description (2-8 words)",\n  "mood": "comma-separated mood descriptors (e.g., 'Melancholic, nostalgic, bittersweet')",\n  "title": "concise song title (2-6 words)"\n}\n\nExamples:\n- {"topic": "A lonely astronaut drifting in deep space", "mood": "Isolated, contemplative, yearning", "title": "Orbit Without You"}\n- {"topic": "Dancing in a neon-lit city at midnight", "mood": "Energetic, euphoric, cyberpunk", "title": "Midnight Neon"}\n- {"topic": "The last letter from a lost love", "mood": "Heartbreaking, tender, regretful", "title": "The Final Letter"}\n\nBe original and evocative.${languageInstruction}`;

        const response = await generateContentWithRetry({
          model: AI_MODEL_NAME,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
          signal: nextSignal,
        });

        if (nextSignal.aborted) {
          wasAborted = true;
          return null;
        }
        const suggestion = safeJsonParse<TopicMoodSuggestion | null>(
          response.text?.trim() || '{}',
          null,
          TopicMoodSuggestionSchema as z.ZodType<TopicMoodSuggestion | null, z.ZodTypeDef, unknown>,
        );
        if (suggestion && (!currentTitle || currentTitle === DEFAULT_TITLE) && suggestion.title) {
          setTitle(suggestion.title);
          setTitleOrigin('ai');
        }
        return suggestion;
      });
    } catch (error) {
      if (isAbortError(error)) {
        wasAborted = true;
        return null;
      }
      logger.warn('Failed to generate topic/mood suggestion:', error);
      return null;
    } finally {
      if (!wasAborted) setIsGeneratingSuggestion(false);
    }
  }, [currentTitle, setTitle, setTitleOrigin, songLanguage]);

  const resetSuggestionCycle = useCallback(() => {
    setHasSuggested(false);
  }, []);

  useEffect(() => {
    if (!hasApiKey) return;
    const shouldAutoSuggest =
      !hasSuggested &&
      (!currentTopic || currentTopic === 'A neon city in the rain') &&
      (!currentMood || currentMood === 'Cyberpunk, nostalgic, bittersweet, reflective');

    if (shouldAutoSuggest) {
      setHasSuggested(true);
      generateSuggestion().then(suggestion => {
        if (suggestion) {
          setTopic(suggestion.topic);
          setMood(suggestion.mood);
        }
      }).catch(() => { /* abort or network error — silently ignore */ });
    }
  }, [hasApiKey, currentMood, currentTitle, currentTopic, generateSuggestion, hasSuggested, setMood, setTitle, setTitleOrigin, setTopic]);

  return { generateSuggestion, isGeneratingSuggestion, resetSuggestionCycle };
}
