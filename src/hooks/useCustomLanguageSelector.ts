import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  adaptationLanguageLabel,
  CUSTOM_LANG_ID_PREFIX,
  CUSTOM_LANGUAGE_VALUE,
  SUPPORTED_ADAPTATION_LANGUAGES,
} from '../i18n/constants';

interface UseCustomLanguageSelectorParams {
  storedValue: string;
  onValueChange: (lang: string) => void;
}

function toCustomText(value: string): string {
  if (!value.startsWith(CUSTOM_LANG_ID_PREFIX)) return '';
  return value.slice(CUSTOM_LANG_ID_PREFIX.length).trim();
}

export function useCustomLanguageSelector({
  storedValue,
  onValueChange,
}: UseCustomLanguageSelectorParams) {
  const [selectValue, setSelectValue] = useState<string>(
    storedValue.startsWith(CUSTOM_LANG_ID_PREFIX) ? CUSTOM_LANGUAGE_VALUE : storedValue,
  );
  const [customText, setCustomTextState] = useState<string>(toCustomText(storedValue));
  const customInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (storedValue.startsWith(CUSTOM_LANG_ID_PREFIX)) {
      setSelectValue(CUSTOM_LANGUAGE_VALUE);
      setCustomTextState(toCustomText(storedValue));
      return;
    }
    setSelectValue(storedValue);
    setCustomTextState('');
  }, [storedValue]);

  const languageOptions = useMemo(
    () => [
      ...SUPPORTED_ADAPTATION_LANGUAGES.map((lang) => ({
        value: lang.langId,
        label: adaptationLanguageLabel(lang),
        title: lang.region ? `${lang.aiName} (${lang.region})` : lang.aiName,
        searchText: `${lang.aiName} ${lang.code} ${lang.region ?? ''}`.trim(),
      })),
      {
        value: CUSTOM_LANGUAGE_VALUE,
        label: '🌐 Other language…',
        title: 'Type any language name',
        searchText: 'other custom language',
      },
    ],
    [],
  );

  const showCustomInput = selectValue === CUSTOM_LANGUAGE_VALUE;
  const effectiveLang = customText.trim();

  useEffect(() => {
    if (!showCustomInput) return;
    customInputRef.current?.focus();
  }, [showCustomInput]);

  const setCustomText = useCallback(
    (value: string) => {
      setCustomTextState(value);
      const trimmed = value.trim();
      if (showCustomInput && trimmed.length > 0) {
        onValueChange(`${CUSTOM_LANG_ID_PREFIX}${trimmed}`);
      }
    },
    [onValueChange, showCustomInput],
  );

  const handleCustomTextChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setCustomText(event.target.value);
    },
    [setCustomText],
  );

  const handleLanguageSelect = useCallback(
    (lang: string) => {
      setSelectValue(lang);
      if (lang === CUSTOM_LANGUAGE_VALUE) {
        if (customText.trim().length > 0) {
          onValueChange(`${CUSTOM_LANG_ID_PREFIX}${customText.trim()}`);
        }
        return;
      }
      onValueChange(lang);
      setCustomTextState('');
    },
    [customText, onValueChange],
  );

  return {
    selectValue,
    customText,
    customInputRef,
    showCustomInput,
    effectiveLang,
    languageOptions,
    handleLanguageSelect,
    handleCustomTextChange,
    setCustomText,
  };
}
