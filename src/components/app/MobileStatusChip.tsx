import React from 'react';
import { useTranslation, stripInternalPrefix } from '../../i18n';
import { useComposerContext } from '../../contexts/ComposerContext';
import type { SaveStatus } from '../../hooks/useSessionAutoSave';

interface Props {
  hasApiKey: boolean;
  saveStatus?: SaveStatus;
  lastSavedAt?: number | null;
}

export function MobileStatusChip({ hasApiKey, saveStatus = 'idle', lastSavedAt = null }: Props) {
  const { isGenerating, isSuggesting } = useComposerContext();
  const { t, language } = useTranslation();

  const isBusy = isGenerating || isSuggesting;

  // ── Save status dot
  const dotClass =
    saveStatus === 'saving'  ? 'mobile-status-dot mobile-status-dot--saving'
    : saveStatus === 'unsaved' ? 'mobile-status-dot mobile-status-dot--unsaved'
    : saveStatus === 'error'   ? 'mobile-status-dot mobile-status-dot--error'
    : 'mobile-status-dot mobile-status-dot--saved';

  const saveLabel =
    saveStatus === 'saving'  ? (t.statusBar?.saving   ?? 'saving')
    : saveStatus === 'unsaved' ? (t.statusBar?.unsaved  ?? 'unsaved')
    : saveStatus === 'error'   ? (t.statusBar?.saveError ?? 'error')
    : lastSavedAt
      ? new Date(lastSavedAt).toLocaleTimeString(
          stripInternalPrefix(language) || 'en',
          { hour: '2-digit', minute: '2-digit' },
        )
      : (t.statusBar?.sessionSavedBadge ?? 'saved');

  // ── Language code
  const langCode = (stripInternalPrefix(language) || 'en').toUpperCase().slice(0, 2);

  // ── API key indicator
  const apiDotClass = hasApiKey
    ? 'mobile-status-dot mobile-status-dot--saved'
    : 'mobile-status-dot mobile-status-dot--error';
  const apiLabel = hasApiKey
    ? (t.statusBar?.ready ?? 'API')
    : 'NO KEY';

  // ── A11y labels — give the visual-only dots and the bare language code
  // explicit meaning for assistive technology. The outer container already
  // has aria-live="polite", so updates to these labels are announced.
  const saveStatusAria =
    saveStatus === 'saving'  ? `Save status: ${t.statusBar?.saving ?? 'save in progress'}`
    : saveStatus === 'unsaved' ? `Save status: ${t.statusBar?.unsaved ?? 'changes not saved'}`
    : saveStatus === 'error'   ? `Save status: ${t.statusBar?.saveError ?? 'save failed'}`
    : lastSavedAt
      ? `Last saved at ${saveLabel}`
      : `Save status: ${t.statusBar?.sessionSavedBadge ?? 'all changes saved'}`;

  const languageAria = `${t.statusBar?.language ?? 'Language'}: ${langCode}`;

  const apiKeyAria = hasApiKey
    ? `API key: ${t.statusBar?.ready ?? 'ready'}`
    : 'API key: missing';

  const busyAria = isGenerating
    ? (t.statusBar?.generating ?? 'Generating')
    : (t.statusBar?.suggesting ?? 'Suggesting');

  return (
    <div className="mobile-status-chip" role="status" aria-live="polite" aria-label="App status">
      {/* Save status */}
      {(saveStatus !== 'idle' || lastSavedAt !== null) && <span className="mobile-status-chip__item" aria-label={saveStatusAria}>
        <span className={dotClass} aria-hidden="true" />
        <span className="mobile-status-chip__label" aria-hidden="true">{saveLabel}</span>
      </span>}

      <span className="mobile-status-chip__divider" aria-hidden="true" />

      {/* Language */}
      <span className="mobile-status-chip__item" aria-label={languageAria}>
        <span className="mobile-status-chip__label mobile-status-chip__label--mono" aria-hidden="true">{langCode}</span>
      </span>

      <span className="mobile-status-chip__divider" aria-hidden="true" />

      {/* API key */}
      <span className="mobile-status-chip__item" aria-label={apiKeyAria}>
        <span className={apiDotClass} aria-hidden="true" />
        <span className="mobile-status-chip__label" aria-hidden="true">{apiLabel}</span>
      </span>

      {/* Busy indicator — right-aligned */}
      {isBusy && (
        <>
          <span className="mobile-status-chip__divider" aria-hidden="true" />
          <span
            className="mobile-status-chip__item mobile-status-chip__item--busy"
            aria-label={busyAria}
          >
            <span className="mobile-status-chip__spinner" aria-hidden="true" />
            <span className="mobile-status-chip__label" aria-hidden="true">
              {isGenerating
                ? (t.statusBar?.generating ?? 'GEN')
                : (t.statusBar?.suggesting ?? 'AI')}
            </span>
          </span>
        </>
      )}
    </div>
  );
}
