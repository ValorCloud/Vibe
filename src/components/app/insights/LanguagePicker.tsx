import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SUPPORTED_ADAPTATION_LANGUAGES } from '../../../i18n';
import { LanguageBadge } from '../../ui/LanguageBadge';
import { type PickerCoords } from './usePickerCoords';
import { useListboxKeyboard } from './useListboxKeyboard';

interface LanguagePickerProps {
  pickerOpen: boolean;
  coords: PickerCoords | null;
  popoverWidth: number;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  defaultLanguage?: string | undefined;
  onSetDefaultLanguage: (langCode: string) => void;
  closePicker: () => void;
  popoverRef: React.RefObject<HTMLDivElement | null>;
}

export function LanguagePicker({
  pickerOpen,
  coords,
  popoverWidth,
  activeIndex,
  setActiveIndex,
  defaultLanguage,
  onSetDefaultLanguage,
  closePicker,
  popoverRef,
}: LanguagePickerProps) {
  const listboxId = useId();
  const listboxRef = useRef<HTMLDivElement>(null);

  const { handleListboxKeyDown } = useListboxKeyboard({
    activeIndex,
    setActiveIndex,
    closePicker,
    onSetDefaultLanguage,
  });

  // Fix #4: move focus into listbox on open.
  // activeIndex intentionally omitted from deps — focus only on *open* event,
  // not on every arrow key press.
  useEffect(() => {
    if (!pickerOpen) return;
    const raf = requestAnimationFrame(() => {
      const items = listboxRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
      items?.[activeIndex >= 0 ? activeIndex : 0]?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [pickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll active item into view on keyboard navigation
  useEffect(() => {
    if (!pickerOpen || activeIndex < 0) return;
    const items = listboxRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    items?.[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, pickerOpen]);

  if (!pickerOpen || !coords) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        ...(coords.top !== undefined ? { top: coords.top } : { bottom: coords.bottom }),
        left: coords.left,
        zIndex: 9999,
        width: `${popoverWidth}px`,
      }}
    >
      <div
        ref={listboxRef}
        id={listboxId}
        className="w-full rounded shadow-xl text-[11px] overflow-hidden"
        style={{
          background: 'var(--bg-app, #1a1a2e)',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
        }}
        role="listbox"
        aria-label="Default language"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        onKeyDown={handleListboxKeyDown}
      >
        <div
          className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.18em] opacity-50"
          aria-hidden="true"
        >
          Default language
        </div>
        <div className="max-h-64 overflow-y-auto">
          {SUPPORTED_ADAPTATION_LANGUAGES.map((lang, idx) => {
            const isSelected =
              lang.code.toLowerCase() === defaultLanguage?.toLowerCase();
            const isActive = idx === activeIndex;
            return (
              // ARIA 1.1 §6.32: role=option must not be on a native interactive
              // element. div with roving tabIndex + onKeyDown is the compliant pattern.
              <div
                key={lang.code}
                id={`${listboxId}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={isActive ? 0 : -1}
                onClick={() => {
                  onSetDefaultLanguage(lang.code.toLowerCase());
                  closePicker();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSetDefaultLanguage(lang.code.toLowerCase());
                    closePicker();
                  }
                }}
                className={[
                  'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors outline-none cursor-pointer',
                  isSelected
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/90',
                  isActive ? 'ring-1 ring-inset ring-white/30' : '',
                ].join(' ')}
              >
                <LanguageBadge langId={lang.langId} signOnly />
                <span className="uppercase font-semibold text-[10px] tracking-wider flex-shrink-0">
                  {lang.code}
                </span>
                <span className="text-[10px] truncate">
                  {lang.aiName}
                  {lang.region ? ` \u2013 ${lang.region}` : ''}
                </span>
                {isSelected && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
