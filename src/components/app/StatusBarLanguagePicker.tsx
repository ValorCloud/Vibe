import { LanguageBadge } from '../ui/LanguageBadge';
import { useTranslation, SUPPORTED_UI_LOCALES } from '../../i18n';
import { StatusChoice } from './StatusChoice';

/**
 * Compact language picker for the StatusBar.
 * Uses the same hover, keyboard and touch lists as the other status controls.
 */
export function StatusBarLanguagePicker() {
  const { t, language, setLanguage } = useTranslation();

  // SUPPORTED_UI_LOCALES is never empty — no third fallback needed.
  const currentLocale = SUPPORTED_UI_LOCALES.find(l => l.langId === language)
    ?? SUPPORTED_UI_LOCALES[0]!;

  return (
    <StatusChoice label={`${t.settings.language.label} · ${currentLocale.label}`} value={currentLocale.langId}
      options={SUPPORTED_UI_LOCALES.map(locale => ({ value: locale.langId, label: locale.label }))}
      onSelect={setLanguage}>
      <span className="uppercase font-semibold">{currentLocale.code.toUpperCase()}</span>
      <LanguageBadge langId={currentLocale.langId} signOnly />
    </StatusChoice>
  );
}
