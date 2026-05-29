import { useContext } from 'react';
import { LanguageContext } from '../../i18n/LanguageProvider';
import { langIdToLocaleCode } from '../../i18n/constants';
import { uiLocaleToBcp47 } from './voiceAssistantAudioService';

export interface UiSpeechLocale {
  /** Bare UI locale code, e.g. 'fr', 'en'. Drives AI reply language. */
  uiLocaleCode: string;
  /** Full BCP-47 tag, e.g. 'fr-FR'. Drives Web Speech STT/TTS voice selection. */
  bcpTag: string;
}

/**
 * Resolve the active UI language into the codes needed by the Web Speech API
 * and AI prompts, so every voice surface (assistant, read-aloud buttons) speaks
 * in the language selected for the interface.
 *
 * Falls back to English when LanguageContext is unavailable (tests, SSR).
 */
export function useUiSpeechLocale(): UiSpeechLocale {
  const langCtx = useContext(LanguageContext);
  const uiLocaleCode = langCtx ? langIdToLocaleCode(langCtx.language) : 'en';
  return { uiLocaleCode, bcpTag: uiLocaleToBcp47(uiLocaleCode) };
}
