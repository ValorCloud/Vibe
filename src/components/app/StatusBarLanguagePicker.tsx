import React from 'react';
import { Tooltip } from '../ui/Tooltip';
import { LanguageBadge } from '../ui/LanguageBadge';
import { useTranslation, SUPPORTED_UI_LOCALES } from '../../i18n';
import { LocalePopoverPicker } from '../ui/LocalePopoverPicker';

/**
 * Compact language picker for the StatusBar.
 * Thin wrapper around LocalePopoverPicker with 'top-right' placement.
 */
export function StatusBarLanguagePicker() {
  const { t, language } = useTranslation();

  // SUPPORTED_UI_LOCALES is never empty — no third fallback needed.
  const currentLocale = SUPPORTED_UI_LOCALES.find(l => l.langId === language)
    ?? SUPPORTED_UI_LOCALES[0]!;

  return (
    <LocalePopoverPicker
      placement="top-right"
      renderTrigger={({ triggerRef, open, toggle }) => (
        <Tooltip title={t.settings.language.label}>
          <div
            ref={triggerRef as React.RefObject<HTMLDivElement>}
            role="button"
            tabIndex={0}
            aria-label={t.settings.language.label}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={toggle}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-color)]/5 transition-colors"
          >
            <LanguageBadge langId={currentLocale.langId} signOnly />
            <span className="uppercase font-semibold text-[10px] tracking-wider">
              {currentLocale.code}
            </span>
          </div>
        </Tooltip>
      )}
    />
  );
}
