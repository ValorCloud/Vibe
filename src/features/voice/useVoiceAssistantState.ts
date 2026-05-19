import { useCallback, useMemo, useState } from 'react';
import type { EditMode } from '../../types';
import { safeGetItem, safeSetItem } from '../../utils/safeStorage';

const VOICE_ASSISTANT_FIRST_CALL_STORAGE_KEY = 'vibe_voice_assistant_onboarding_seen';

export interface VoiceAssistantStateParams {
  page: 'lyrics' | 'musical';
  mode: EditMode;
}

export function useVoiceAssistantState({ page, mode }: VoiceAssistantStateParams) {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(
    () => safeGetItem(VOICE_ASSISTANT_FIRST_CALL_STORAGE_KEY) === '1',
  );

  const isFirstCall = !hasSeenOnboarding;
  const context = useMemo(() => ({ page, mode }), [page, mode]);

  const markFirstCallHandled = useCallback(() => {
    if (hasSeenOnboarding) return;
    setHasSeenOnboarding(true);
    safeSetItem(VOICE_ASSISTANT_FIRST_CALL_STORAGE_KEY, '1');
  }, [hasSeenOnboarding]);

  return {
    context,
    isFirstCall,
    markFirstCallHandled,
  };
}
