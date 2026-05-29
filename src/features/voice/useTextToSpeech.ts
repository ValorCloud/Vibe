import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrowserVoiceAudioService,
  type VoiceAudioService,
} from './voiceAssistantAudioService';
import { useUiSpeechLocale } from './useUiSpeechLocale';

interface UseTextToSpeechOptions {
  /** Override the audio service (used by tests). */
  audioService?: VoiceAudioService;
}

export interface TextToSpeechApi {
  /** Whether the browser supports speech synthesis at all. */
  isSupported: boolean;
  /** Identifier of the utterance currently being spoken, or null when idle. */
  speakingId: string | null;
  /**
   * Speak `text` in the active UI language. Passing the same `id` while it is
   * already speaking acts as a toggle and stops playback instead.
   */
  speak: (text: string, id?: string) => void;
  /** Stop any in-flight speech immediately. */
  stop: () => void;
}

const DEFAULT_ID = 'default';

/**
 * Reusable text-to-speech hook that reads arbitrary text aloud in the language
 * selected for the application interface. Coordinates with the global
 * speechSynthesis queue so starting a new utterance cancels the previous one.
 */
export function useTextToSpeech(options: UseTextToSpeechOptions = {}): TextToSpeechApi {
  const defaultService = useMemo(() => new BrowserVoiceAudioService(), []);
  const audio = options.audioService ?? defaultService;
  const { bcpTag } = useUiSpeechLocale();

  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      audio.cancel?.();
    };
  }, [audio]);

  const stop = useCallback(() => {
    audio.cancel?.();
    if (mountedRef.current) setSpeakingId(null);
  }, [audio]);

  const speak = useCallback((text: string, id: string = DEFAULT_ID) => {
    const trimmed = text?.trim();
    if (!trimmed || !audio.isSpeechSupported()) return;

    // Toggle: clicking the active control again stops playback.
    if (speakingId === id) {
      stop();
      return;
    }

    setSpeakingId(id);
    void audio.speak(trimmed, { lang: bcpTag }).finally(() => {
      // Only clear if we are still the active utterance; a newer speak() call
      // may have already taken over and updated speakingId.
      if (mountedRef.current) {
        setSpeakingId(prev => (prev === id ? null : prev));
      }
    });
  }, [audio, bcpTag, speakingId, stop]);

  return { isSupported: audio.isSpeechSupported(), speakingId, speak, stop };
}
