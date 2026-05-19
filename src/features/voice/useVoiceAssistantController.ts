import { useCallback, useMemo, useState } from 'react';
import type { EditMode } from '../../types';
import { BrowserVoiceAudioService, type VoiceAudioService } from './voiceAssistantAudioService';
import { requestVoiceAssistantReply, type VoiceAssistantContext } from './voiceAssistantOrchestrator';
import { useVoiceAssistantState } from './useVoiceAssistantState';

export type VoiceAssistantUiState = 'idle' | 'listening' | 'processing' | 'speaking';

interface ControllerDependencies {
  audioService?: VoiceAudioService;
  requestReply?: (query: string, context: VoiceAssistantContext) => Promise<string>;
}

interface UseVoiceAssistantControllerParams extends ControllerDependencies {
  enabled: boolean;
  page: 'lyrics' | 'musical';
  mode: EditMode;
}

const NO_INPUT_CAPTURED_TEXT = 'I did not catch your request. Please try again in one sentence.';

export function useVoiceAssistantController({
  enabled,
  page,
  mode,
  audioService,
  requestReply = requestVoiceAssistantReply,
}: UseVoiceAssistantControllerParams) {
  const { context, isFirstCall, markFirstCallHandled } = useVoiceAssistantState({ page, mode });
  const defaultAudioService = useMemo(() => new BrowserVoiceAudioService(), []);
  const audio = audioService ?? defaultAudioService;

  const [uiState, setUiState] = useState<VoiceAssistantUiState>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [textFallback, setTextFallback] = useState<string | null>(null);
  const [promptText, setPromptText] = useState<string | null>(null);

  const isBusy = uiState !== 'idle';

  const invoke = useCallback(async () => {
    if (!enabled || isBusy) return;

    setErrorText(null);
    setTextFallback(null);
    setPromptText('What do you want to know or do?');

    if (!audio.isRecognitionSupported()) {
      setErrorText('Voice input is not available in this browser.');
      return;
    }

    try {
      setUiState('listening');
      const query = await audio.listenOnce();
      if (!query.trim()) throw new Error(NO_INPUT_CAPTURED_TEXT);

      setUiState('processing');
      const reply = await requestReply(query, { ...context, isFirstCall });
      if (isFirstCall) markFirstCallHandled();

      setUiState('speaking');
      const spoken = await audio.speak(reply, {
        slowStartMs: 1800,
        onSlowStart: () => setTextFallback(reply),
      });

      if (!spoken) setTextFallback(reply);
      setUiState('idle');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Voice assistant error.';
      setErrorText(message);
      setUiState('idle');
    }
  }, [audio, context, enabled, isBusy, isFirstCall, markFirstCallHandled, requestReply]);

  return {
    invoke,
    uiState,
    promptText,
    textFallback,
    errorText,
    isBusy,
  };
}
