import { useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react';
import {
  SUPPORTED_ADAPTATION_LANGUAGES,
  adaptationLanguageLabel,
  buildCustomLangId,
  CUSTOM_LANGUAGE_VALUE,
  migrateAdaptationToLangId,
  readCustomLangText,
} from '../i18n';
import type { AdaptationLangId } from '../i18n/constants';

interface UseCustomLanguageSelectorOptions {
  storedValue: AdaptationLangId;
  onValueChange: (lang: string) => void;
}

interface LanguageOption {
  value: string;
  label: string;
  title?: string;
  alwaysShow?: boolean;
  searchText?: string;
}

export function useCustomLanguageSelector({
  storedValue,
  onValueChange,
}: UseCustomLanguageSelectorOptions) {
  const initialCustomText = readCustomLangText(storedValue) ?? '';
  const [customText, setCustomText] = useState(initialCustomText);
  const [showCustomInput, setShowCustomInput] = useState(initialCustomText.length > 0);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const nextCustomText = readCustomLangText(storedValue) ?? '';
    setCustomText(nextCustomText);
    setShowCustomInput(nextCustomText.length > 0);
  }, [storedValue]);

  useEffect(() => {
    if (!showCustomInput) return;
    const frame = requestAnimationFrame(() => customInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [showCustomInput]);

  const languageOptions = useMemo<LanguageOption[]>(
    () => [
      ...SUPPORTED_ADAPTATION_LANGUAGES.map((language) => ({
        value: language.langId,
        label: adaptationLanguageLabel(language),
        title: language.aiName,
        searchText: `${language.aiName} ${language.code} ${language.region ?? ''}`,
      })),
      {
        value: CUSTOM_LANGUAGE_VALUE,
        label: 'Other language…',
        title: 'Type any language name',
        alwaysShow: true,
        searchText: 'Other language',
      },
    ],
    [],
  );

  const handleLanguageSelect = (value: string) => {
    if (value === CUSTOM_LANGUAGE_VALUE) {
      setShowCustomInput(true);
      const nextCustomId = buildCustomLangId(customText);
      if (nextCustomId) onValueChange(nextCustomId);
      return;
    }

    setShowCustomInput(false);
    onValueChange(migrateAdaptationToLangId(value));
  };

  const handleCustomTextChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setCustomText(event.target.value);
  };

  return {
    selectValue: showCustomInput ? CUSTOM_LANGUAGE_VALUE : migrateAdaptationToLangId(storedValue),
    customText,
    setCustomText,
    customInputRef,
    showCustomInput,
    effectiveLang: customText.trim(),
    languageOptions,
    handleLanguageSelect,
    handleCustomTextChange,
  };
}
