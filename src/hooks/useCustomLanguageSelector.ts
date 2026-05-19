import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  SUPPORTED_ADAPTATION_LANGUAGES,
  CUSTOM_LANGUAGE_VALUE,
  isCustomAdaptationLanguage,
  migrateAdaptationToLangId,
  isCustomLangId,
  readCustomLangText,
  type AdaptationLanguage,
} from '../i18n';
import { LanguageBadge } from '../components/ui/LanguageBadge';

// ─── Language grouping ────────────────────────────────────────────────────────
//
// IMPORTANT: every code listed here MUST exist in SUPPORTED_ADAPTATION_LANGUAGES.
// Phantom codes cause the language to fall into the 'Other' catch-all group and
// display with the wrong grouping/flag in the adaptation dropdown.
// Run `npx ts-node scripts/validateLanguageGroups.ts` to verify after any change.
//
// Invariance (adaptation):
// - The only identifier that may cross component boundaries is the canonical
//   `langId` ("adapt:*" or "custom:*").
// - All visual rendering (flag / ethnic picto / label / region) MUST go
//   through <LanguageBadge langId={…}/> which itself resolves from the
//   central i18n registry. No consumer may derive a flag or label from codes
//   or names directly.

export type LangGroup = { label: string; codes: string[] };

export const LANGUAGE_GROUPS: LangGroup[] = [
  { label: 'Romance',          codes: ['ES', 'FR', 'IT', 'PT', 'RO'] },
  { label: 'Germanic',         codes: ['EN', 'DE', 'NL', 'SV', 'DA', 'NO', 'IS'] },
  { label: 'Slavic',           codes: ['RU', 'PL', 'CS', 'SK', 'UK', 'BG', 'SR', 'HR'] },
  { label: 'Semitic',          codes: ['AR', 'HE', 'AM'] },
  { label: 'South & SE Asian', codes: ['HI', 'SA', 'UR', 'BN', 'PA', 'FA', 'TA', 'TE', 'KN', 'ML', 'TH', 'LO', 'VI', 'KM', 'ID', 'MS', 'TL'] },
  { label: 'CJK & Altaic',     codes: ['ZH', 'YUE', 'JA', 'KO', 'JV', 'TR', 'AZ', 'UZ', 'KK', 'FI', 'HU', 'ET'] },
  { label: 'African',          codes: ['SW', 'YO', 'HA', 'FF', 'BM', 'BA', 'DI', 'EW', 'MI', 'LN', 'ZU', 'WO', 'BK', 'CB', 'OG'] },
  { label: 'Creole & Other',   codes: ['NOU', 'PCM', 'CFG'] },
];

const CODE_TO_GROUP = new Map<string, string>();
for (const g of LANGUAGE_GROUPS) {
  for (const c of g.codes) CODE_TO_GROUP.set(c, g.label);
}

// Build a code→lang lookup for O(1) access in buildGroupedLanguageOptions.
const CODE_TO_LANG = new Map(
  SUPPORTED_ADAPTATION_LANGUAGES.map(l => [l.code.toUpperCase(), l])
);

function getGroupLabel(code: string): string {
  return CODE_TO_GROUP.get(code.toUpperCase()) ?? 'Other';
}

export interface GroupedLanguageOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  /** When true, the option is shown even when a search filter is active. */
  alwaysShow?: boolean;
  /** Plain-text representation used for live filtering in searchable selects. */
  searchText?: string;
}

function makeLangOption(lang: AdaptationLanguage): GroupedLanguageOption {
  // The option `value` is the canonical langId — the only identifier that
  // crosses a component boundary. Every flag/label render is funnelled through
  // <LanguageBadge langId=…/> so the sign and label can never get out of sync.
  return {
    value: lang.langId,
    label: React.createElement(LanguageBadge, {
      langId: lang.langId,
      showRegion: true,
      labelClassName: 'text-[11px]',
    }) as React.ReactNode,
    searchText: lang.region ? `${lang.aiName} ${lang.region}` : lang.aiName,
  };
}

export function buildGroupedLanguageOptions(): GroupedLanguageOption[] {
  const result: GroupedLanguageOption[] = [];

  // "Free input" entry sits at the very top.
  result.push(
    {
      value: '__group__other_lang',
      label: React.createElement('span', {
        className: 'text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500 select-none'
      }, 'Free input') as React.ReactNode,
      disabled: true,
      alwaysShow: true,
    },
    {
      value: CUSTOM_LANGUAGE_VALUE,
      label: (
        React.createElement('span', { className: 'flex items-center gap-1.5 min-w-0 w-full' },
          React.createElement('span', { style: { fontSize: '0.95em' } }, '✏️'),
          React.createElement('span', { className: 'truncate text-[11px]' }, 'Other language…')
        )
      ) as React.ReactNode,
      alwaysShow: true,
      searchText: 'Other language',
    },
  );

  const seenCodes = new Set<string>();

  for (const { label: groupLabel, codes } of LANGUAGE_GROUPS) {
    const items: GroupedLanguageOption[] = [];
    for (const code of codes) {
      const lang = CODE_TO_LANG.get(code.toUpperCase());
      if (!lang) continue;
      seenCodes.add(code.toUpperCase());
      items.push(makeLangOption(lang));
    }
    if (items.length === 0) continue;
    result.push({
      value: `__group__${groupLabel}`,
      label: (
        React.createElement('span', {
          className: 'text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500 select-none'
        }, groupLabel)
      ) as React.ReactNode,
      disabled: true,
    });
    result.push(...items);
  }

  const ungrouped = SUPPORTED_ADAPTATION_LANGUAGES.filter(
    l => !seenCodes.has(l.code.toUpperCase())
  );
  if (ungrouped.length > 0) {
    result.push({
      value: '__group__Other',
      label: (
        React.createElement('span', {
          className: 'text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500 select-none'
        }, 'Other')
      ) as React.ReactNode,
      disabled: true,
    });
    for (const lang of ungrouped) result.push(makeLangOption(lang));
  }

  return result;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseCustomLanguageSelectorOptions {
  storedValue: string;
  // Accepts any string-based callback, including branded subtypes such as
  // AdaptationLangId or LangId, to avoid contravariance errors at call-sites
  // where the caller has already narrowed its callback to a branded type.
  onValueChange: (lang: string) => void;
}

export interface UseCustomLanguageSelectorResult {
  selectValue: string;
  customText: string;
  customInputRef: React.RefObject<HTMLInputElement>;
  showCustomInput: boolean;
  effectiveLang: string;
  languageOptions: ReturnType<typeof buildGroupedLanguageOptions>;
  handleLanguageSelect: (lang: string) => void;
  handleCustomTextChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Imperatively set the custom text (e.g. wired from a searchable dropdown). */
  setCustomText: (value: string) => void;
  /** Call on Enter / blur / Apply button to commit the custom text. */
  handleCustomConfirm: () => void;
}

export function useCustomLanguageSelector({
  storedValue,
  onValueChange,
}: UseCustomLanguageSelectorOptions): UseCustomLanguageSelectorResult {
  // Migrate any legacy stored value (bare aiName like "English", uppercase
  // code like "ES", or a "custom:<text>" sentinel) into the canonical wire
  // format used by the picker: a langId or a custom: sentinel.
  const migrated = migrateAdaptationToLangId(storedValue);
  const isStoredCustomSentinel = isCustomAdaptationLanguage(storedValue);
  const isStoredCustomLangId = isCustomLangId(migrated);
  const isStoredCustom = isStoredCustomSentinel || isStoredCustomLangId;

  const [selectValue, setSelectValue] = useState<string>(
    isStoredCustom ? CUSTOM_LANGUAGE_VALUE : migrated,
  );
  const [customText, setCustomText] = useState<string>(
    isStoredCustomLangId
      ? (readCustomLangText(migrated) ?? '')
      : isStoredCustomSentinel
        ? storedValue
        : '',
  );
  const customInputRef = useRef<HTMLInputElement>(null);

  const showCustomInput = isCustomAdaptationLanguage(selectValue);
  const effectiveLang = showCustomInput ? customText.trim() : selectValue;

  const languageOptions = useMemo(() => buildGroupedLanguageOptions(), []);

  const handleLanguageSelect = useCallback(
    (lang: string) => {
      if (lang.startsWith('__group__')) return;
      setSelectValue(lang);
      if (!isCustomAdaptationLanguage(lang)) {
        setCustomText('');
        onValueChange(lang);
      } else {
        setCustomText('');
        requestAnimationFrame(() => customInputRef.current?.focus());
      }
    },
    [onValueChange],
  );

  const handleCustomTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCustomText(e.target.value);
    },
    [],
  );

  const handleCustomConfirm = useCallback(() => {
    const trimmed = customText.trim();
    // Wrap the typed text in the `custom:<text>` sentinel so downstream
    // resolvers can always tell custom values apart from canonical entries.
    if (trimmed) onValueChange(`custom:${trimmed}`);
  }, [customText, onValueChange]);

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
    handleCustomConfirm,
  };
}
