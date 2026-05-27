import React, { createContext, useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import type { Translations } from './locales/types';
import { SUPPORTED_UI_LOCALES, migrateToLangId, langIdToLocaleCode } from './constants';
import { logger } from '../utils/logger';

// Re-export legacy alias so existing consumers don't break
export { SUPPORTED_UI_LOCALES as SUPPORTED_LANGUAGES } from './constants';

// ---------------------------------------------------------------------------
// Optimized glossary architecture: lazy-load locale files on-demand
// ---------------------------------------------------------------------------
const _localeLoaders = import.meta.glob<Translations>(
  './locales/*.json',
  { import: 'default' },
);

// Cache for loaded locales to avoid re-fetching
const localeCache: Record<string, Translations> = {};

async function loadLocale(lang: string): Promise<Translations | null> {
  if (localeCache[lang]) return localeCache[lang]!;

  const loaderKey = Object.keys(_localeLoaders).find(path => {
    const match = path.match(/\/([A-Za-z0-9-]+)\.json$/);
    return match?.[1]?.toLowerCase() === lang.toLowerCase();
  });

  if (!loaderKey) return null;

  try {
    const loader = _localeLoaders[loaderKey];
    if (!loader) return null;
    const locale = await loader();
    localeCache[lang] = locale;
    return locale;
  } catch (error) {
    logger.error(`[i18n] Failed to load locale '${lang}':`, error);
    return null;
  }
}

// Preload English as the base/fallback locale
let en: Translations | null = null;
const enPromise = loadLocale('en').then(locale => {
  if (!locale || Object.keys(locale).length === 0) {
    logger.error('[i18n] en.json is missing or empty.');
    return null;
  }
  en = locale;
  return locale;
});

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result: T = { ...base };
  for (const key in override) {
    const val = override[key as keyof T];
    if (val !== undefined && val !== null) {
      if (typeof val === 'object' && !Array.isArray(val)) {
        result[key as keyof T] = deepMerge(
          base[key as keyof T] as object,
          val as Partial<T[keyof T] & object>,
        ) as T[keyof T];
      } else {
        result[key as keyof T] = val as T[keyof T];
      }
    }
  }
  return result;
}

function buildSafeTranslations(localeCode: string, locale: Translations | null): Translations | null {
  if (!en) return null;
  if (localeCode === 'en' || !locale) return en;
  return deepMerge(en, locale as Partial<Translations>);
}

// ---------------------------------------------------------------------------
// Storage key — stores a canonical langId ("ui:fr", "ui:ar").
// On read, legacy bare codes are migrated transparently.
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'lyricist_language';

function readStoredLangId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? 'ui:en';
    const migrated = migrateToLangId(raw);
    // If migration changed the value, persist the canonical form immediately.
    if (migrated !== raw) {
      try { localStorage.setItem(STORAGE_KEY, migrated); } catch { /* ignore */ }
    }
    // Ensure we only accept UI locale langIds here (adapter langIds are for content, not UI).
    return migrated.startsWith('ui:') ? migrated : 'ui:en';
  } catch {
    return 'ui:en';
  }
}

export interface LanguageContextValue {
  /** Canonical UI locale langId, e.g. "ui:fr" */
  language: string;
  setLanguage: (langId: string) => void;
  t: Translations;
  dir: 'ltr' | 'rtl';
  isLoading: boolean;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [langId, setLangIdState] = useState<string>(readStoredLangId);

  const [currentLocale, setCurrentLocale] = useState<Translations | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setLanguage = useCallback((newLangId: string) => {
    const canonical = migrateToLangId(newLangId);
    const safeId = canonical.startsWith('ui:') ? canonical : 'ui:en';
    setLangIdState(safeId);
    try { localStorage.setItem(STORAGE_KEY, safeId); } catch { /* ignore */ }
  }, []);

  // Derive BCP-47 code from langId for locale loading
  const localeCode = useMemo(() => langIdToLocaleCode(langId), [langId]);

  useEffect(() => {
    let cancelled = false;
    const loadLanguage = async () => {
      setIsLoading(true);
      await enPromise;
      if (cancelled) return;
      if (localeCode === 'en') {
        setCurrentLocale(en);
        setIsLoading(false);
      } else {
        const locale = await loadLocale(localeCode);
        if (!cancelled) {
          setCurrentLocale(locale);
          setIsLoading(false);
        }
      }
    };
    loadLanguage();
    return () => { cancelled = true; };
  }, [localeCode]);

  const t = useMemo(() => buildSafeTranslations(localeCode, currentLocale), [localeCode, currentLocale]);

  const dir = useMemo(
    () => SUPPORTED_UI_LOCALES.find(l => l.code === localeCode)?.dir ?? 'ltr',
    [localeCode],
  );

  useEffect(() => {
    document.documentElement.setAttribute('lang', localeCode);
    document.documentElement.setAttribute('dir', dir);
  }, [localeCode, dir]);

  if (!t) return null;

  // Expose `language` as the langId for consumers that need to store/compare it.
  const value: LanguageContextValue = { language: langId, setLanguage, t, dir, isLoading };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
