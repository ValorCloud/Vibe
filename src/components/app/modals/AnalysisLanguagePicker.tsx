import React from 'react';
import { useTranslation, SUPPORTED_UI_LOCALES } from '../../../i18n';
import { LanguageBadge } from '../../ui/LanguageBadge';
import { LocalePopoverPicker } from '../../ui/LocalePopoverPicker';

/**
 * Compact inline language picker for the Song Analysis Report header.
 * Thin wrapper around LocalePopoverPicker with 'bottom-left' placement.
 */
export function AnalysisLanguagePicker() {
  const { t, language } = useTranslation();

  // SUPPORTED_UI_LOCALES is never empty — no third fallback needed.
  const currentLocale = SUPPORTED_UI_LOCALES.find(l => l.langId === language)
    ?? SUPPORTED_UI_LOCALES[0]!;

  return (
    <LocalePopoverPicker
      placement="bottom-left"
      renderTrigger={({ triggerRef, open, toggle }) => (
        <button
          ref={triggerRef as React.RefObject<HTMLButtonElement>}
          onClick={toggle}
          aria-label={t.statusBar.language}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-color)]/5 transition-colors"
        >
          <LanguageBadge langId={currentLocale.langId} signOnly />
          <span className="uppercase font-semibold text-[10px] tracking-wider">{currentLocale.code}</span>
        </button>
      )}
    />
  );
}
