import React, { useRef, useEffect } from 'react';
import { Loader2, ScanText } from '../../ui/icons';
import { Tooltip } from '../../ui/Tooltip';
import { EmojiSign } from '../../ui/EmojiSign';
import { LanguageBadge } from '../../ui/LanguageBadge';
import { getLanguageDisplay, useTranslation, SUPPORTED_ADAPTATION_LANGUAGES } from '../../../i18n';
import { usePickerCoords } from './usePickerCoords';
import { LanguagePicker } from './LanguagePicker';
import { logger } from '../../../utils/logger';

type LanguageDisplay = ReturnType<typeof getLanguageDisplay>;

interface DetectLanguageButtonProps {
  detectedDisplays: LanguageDisplay[];
  hasLyrics: boolean;
  isDetectingLanguage: boolean;
  hasApiKey: boolean;
  /** Sync or async — both accepted. Rejections are caught and logged. */
  onDetect: () => void | Promise<void>;
  /** Called when user picks a default language (no-lyrics mode). */
  onSetDefaultLanguage?: (langCode: string) => void;
  /** Current default/target language code (shown in no-lyrics mode). */
  defaultLanguage?: string;
}

export function DetectLanguageButton({
  detectedDisplays,
  hasLyrics,
  isDetectingLanguage,
  hasApiKey,
  onDetect,
  onSetDefaultLanguage,
  defaultLanguage,
}: DetectLanguageButtonProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const {
    coords,
    popoverWidth,
    openPicker,
    closePicker,
    pickerOpen,
    activeIndex,
    setActiveIndex,
  } = usePickerCoords({ defaultLanguage, triggerRef });

  const isDisabled = !hasApiKey || isDetectingLanguage;

  // Close picker on outside mousedown
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        closePicker();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen, closePicker]);

  const detectedLanguageList = detectedDisplays
    .slice(0, 3)
    .map((d) => `${d.sign} ${d.label}`)
    .join(', ');

  const tooltipTitle = !hasApiKey
    ? (t.tooltips?.aiUnavailable ?? 'AI unavailable')
    : !hasLyrics
      ? 'Set default language for generation'
      : detectedDisplays.length > 0
        ? (t.tooltips?.redetectLanguage ?? 'Detected: {langs} — click to re-detect').replace(
            '{langs}',
            detectedLanguageList,
          )
        : (t.tooltips?.detectLanguage ?? 'Detect song language');

  // Fix #1: stopPropagation via openPicker prevents the global mousedown
  // listener from seeing the same event and immediately closing the picker.
  const handleClick = (e: React.MouseEvent) => {
    if (!hasLyrics && onSetDefaultLanguage) {
      openPicker(e);
    } else {
      // Fix #2: explicit .catch() — never silently swallow async rejections.
      Promise.resolve(onDetect()).catch((err: unknown) => {
        logger.error('[DetectLanguageButton] onDetect failed:', err);
      });
    }
  };

  // ── Button label ─────────────────────────────────────────────────────────
  const buttonContent = (() => {
    if (isDetectingLanguage) {
      return (
        <>
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          <span className="sr-only">
            {t.editor?.detectingLanguageLabel ?? 'Detecting…'}
          </span>
        </>
      );
    }
    if (!hasLyrics) {
      const defLang = defaultLanguage
        ? SUPPORTED_ADAPTATION_LANGUAGES.find(
            (l) => l.code.toLowerCase() === defaultLanguage.toLowerCase(),
          )
        : null;
      return (
        <>
          <ScanText className="w-3 h-3" aria-hidden="true" />
          {defLang ? (
            <>
              <LanguageBadge langId={defLang.langId} signOnly />
              <span className="hidden sm:inline">{defLang.code.toUpperCase()}</span>
            </>
          ) : (
            <>
              <EmojiSign sign="🌐" />
              <span className="hidden sm:inline">{t.editor?.detect ?? 'Lang'}</span>
            </>
          )}
        </>
      );
    }
    if (detectedDisplays.length > 0) {
      return (
        <>
          <ScanText className="w-3 h-3" aria-hidden="true" />
          {detectedDisplays.slice(0, 3).map((d, i) => (
            <EmojiSign key={i} sign={d.sign} />
          ))}
          {/* Fix #7: guard via optional chaining — detectedDisplays may be empty */}
          <span className="hidden sm:inline">{detectedDisplays.at(0)?.label}</span>
        </>
      );
    }
    return (
      <>
        <ScanText className="w-3 h-3" aria-hidden="true" />
        <EmojiSign sign="🌐" />
        <span className="hidden sm:inline">{t.editor?.detect ?? 'Detect'}</span>
      </>
    );
  })();

  return (
    <div className="relative">
      <Tooltip title={tooltipTitle}>
        <button
          ref={triggerRef}
          onClick={handleClick}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          aria-busy={isDetectingLanguage}
          aria-haspopup={
            !hasLyrics && !!onSetDefaultLanguage ? 'listbox' : undefined
          }
          aria-expanded={
            !hasLyrics && !!onSetDefaultLanguage ? pickerOpen : undefined
          }
          aria-controls={pickerOpen ? 'language-picker' : undefined}
          className="ux-interactive px-2.5 py-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 text-[11px] font-bold rounded flex items-center gap-1.5 disabled:opacity-50 border border-black/10 dark:border-white/10 whitespace-nowrap shrink-0"
        >
          {buttonContent}
        </button>
      </Tooltip>
      {onSetDefaultLanguage && (
        <LanguagePicker
          pickerOpen={pickerOpen}
          coords={coords}
          popoverWidth={popoverWidth}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          defaultLanguage={defaultLanguage}
          onSetDefaultLanguage={onSetDefaultLanguage}
          closePicker={closePicker}
          popoverRef={popoverRef}
        />
      )}
    </div>
  );
}
