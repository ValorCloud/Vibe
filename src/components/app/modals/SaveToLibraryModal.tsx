import React, { useState } from 'react';
import { Save, X, BookOpen, Music, Clock, Loader2, Library, Trash2, FolderOpen, HardDrive, AlertTriangle } from '../../ui/icons';
import { Button } from '../../ui/Button';
import { useTranslation } from '../../../i18n';
import type { LibraryAsset } from '../../../utils/libraryUtils';
import { useStorageEstimate } from '../../../hooks/useStorageEstimate';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onLoadAsset?: (asset: LibraryAsset) => void;
  onDeleteAsset?: (assetId: string) => void;
  onPurgeLibrary?: () => Promise<void>;
  isSaving: boolean;
  saveError?: string | null;
  onDismissError?: () => void;
  currentTitle: string;
  libraryAssets: LibraryAsset[];
  hasCurrentSong?: boolean;
};

export function SaveToLibraryModal({
  isOpen,
  onClose,
  onSave,
  onLoadAsset,
  onDeleteAsset,
  onPurgeLibrary,
  isSaving,
  saveError,
  onDismissError,
  currentTitle,
  libraryAssets,
  hasCurrentSong = true,
}: Props) {
  const { t } = useTranslation();
  const saveToLibrary = t.saveToLibrary ?? ({} as NonNullable<typeof t.saveToLibrary>);
  const actions = (t as { actions?: { cancel?: string; close?: string } }).actions;
  const storage = useStorageEstimate();
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const handlePurge = async () => {
    if (onPurgeLibrary) {
      await onPurgeLibrary();
      setShowPurgeConfirm(false);
    }
  };

  if (!isOpen) return null;

  const tierColor = storage.tier === 'red' ? 'text-red-400' :
                    storage.tier === 'orange' ? 'text-orange-400' :
                    'text-[var(--accent-color)]';

  const tierBg = storage.tier === 'red' ? 'bg-red-500/10 border-red-500/20' :
                 storage.tier === 'orange' ? 'bg-orange-500/10 border-orange-500/20' :
                 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/20';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Gradient border wrapper — isolation prevents gradient from bleeding into interior */}
      <div
        className="lcars-gradient-outline relative w-full sm:max-w-lg h-full sm:h-auto rounded-none sm:rounded-[24px_8px_24px_8px] animate-in zoom-in-95 duration-300"
        style={{
          padding: '2px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          isolation: 'isolate',
        }}
      >
        {/* Modal panel — dialog-surface ensures opaque dark background */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={saveToLibrary.title ?? 'Library'}
          className="relative w-full h-full flex flex-col fluent-animate-panel dialog-surface shadow-2xl overflow-hidden rounded-none sm:rounded-[22px_6px_22px_6px]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-sidebar)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center">
                <Library className="w-4 h-4 text-[var(--accent-color)]" />
              </div>
              <h3 className="text-sm font-bold tracking-widest text-[var(--text-primary)] uppercase">
                 {saveToLibrary.title ?? 'Library'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Save current song section */}
          {hasCurrentSong && (
            <div className="p-6 border-b border-[var(--border-color)] space-y-3">
              <div className="flex items-center justify-between gap-4 p-4 rounded-[12px_4px_12px_4px] bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20">
                <div className="flex items-center gap-3 min-w-0">
                  <Music className="w-4 h-4 text-[var(--accent-color)] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {currentTitle}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                       {saveToLibrary.saveDescription ?? 'Save Current Song'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="fluent-animate-pressable flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] hover:opacity-90 text-[var(--on-accent-color)] text-xs font-bold rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                   {isSaving ? (saveToLibrary.saving ?? 'Saving...') : (saveToLibrary.save ?? 'Save')}
                </button>
              </div>

              {/* Inline save error banner */}
              {saveError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="text-xs flex-1">{saveError}</span>
                  {onDismissError && (
                    <button
                      type="button"
                      onClick={onDismissError}
                      aria-label="Dismiss error"
                      className="flex-shrink-0 hover:text-red-300 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Library list */}
          <div className="overflow-y-auto max-h-80 custom-scrollbar">
            <div className="px-6 pt-4 pb-2 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                 {saveToLibrary.yourLibrary ?? 'Your Library'} ({libraryAssets.length})
              </span>
            </div>

            {libraryAssets.length === 0 ? (
              <div className="px-6 pb-6 pt-2 flex flex-col items-center justify-center text-center space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">
                   {saveToLibrary.empty ?? 'No songs in library yet.'}
                </p>
              </div>
            ) : (
              <div className="px-6 pb-6 pt-2 space-y-2">
                {[...libraryAssets].reverse().map(asset => (
                  <div
                    key={asset.id}
                    className="fluent-animate-in fluent-animate-pressable flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-md bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center flex-shrink-0">
                      <Music className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {asset.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-[var(--text-secondary)]" />
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          {new Date(asset.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-[10px] text-[var(--text-secondary)]">
                        {asset.sections.length} section{asset.sections.length !== 1 ? 's' : ''}
                      </div>
                      {onLoadAsset && (
                        <button
                          type="button"
                          onClick={() => onLoadAsset(asset)}
                           aria-label={`${saveToLibrary.load ?? 'Load'}: ${asset.title}`}
                           title={saveToLibrary.loadDescription ?? 'Load song from library'}
                          className="fluent-animate-pressable flex items-center gap-1 rounded border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-color)] transition hover:bg-[var(--accent-color)]/20"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                           {saveToLibrary.load ?? 'Load'}
                        </button>
                      )}
                      {onDeleteAsset && (
                        <button
                          type="button"
                          onClick={() => onDeleteAsset(asset.id)}
                          aria-label={(t.tooltips?.removeFromLibraryItem ?? 'Remove {title} from library').replace('{title}', asset.title)}
                          title={t.tooltips?.removeFromLibrary ?? 'Remove from library'}
                          className="fluent-animate-pressable flex h-7 w-7 items-center justify-center rounded border border-red-500/20 bg-red-500/10 text-red-400 transition hover:bg-red-500/25 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Storage details section */}
          <div className="px-6 pb-4 border-t border-[var(--border-color)]">
            <div className={`p-4 rounded-[12px_4px_12px_4px] border ${tierBg} mt-4`}>
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className={`w-4 h-4 ${tierColor}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                   {saveToLibrary.storageTitle ?? 'Storage'}
                </span>
              </div>

              {storage.supported && (
                <div className="h-2 w-full rounded-full bg-[var(--bg-app)] overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(storage.ratio * 100)}%`,
                      background: storage.tier === 'red' ? '#ef4444' :
                                 storage.tier === 'orange' ? '#f59e0b' :
                                 'var(--accent-color)'
                    }}
                  />
                </div>
              )}

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                   <span className="text-[var(--text-secondary)]">{saveToLibrary.storageLibraryData ?? 'Library data'}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{storage.libraryUsageMB}</span>
                </div>
                {storage.supported && (
                  <>
                    <div className="flex justify-between">
                       <span className="text-[var(--text-secondary)]">{saveToLibrary.storageUsed ?? 'Browser usage'}</span>
                      <span className={`font-semibold ${tierColor}`}>{storage.usageMB}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-[var(--text-secondary)]">{saveToLibrary.storageQuota ?? 'Browser limit'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">{storage.quotaMB}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-[var(--text-secondary)]">{saveToLibrary.storageSaturation ?? 'Saturation'}</span>
                      <span className={`font-bold ${tierColor}`}>{Math.round(storage.ratio * 100)}%</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between pt-2 border-t border-[var(--border-color)] mt-2">
                   <span className="text-[var(--text-secondary)]">{saveToLibrary.libraryItems ?? 'Library items'}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{libraryAssets.length}</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                 {saveToLibrary.storageScopeLocal ?? 'Library data covers only lyricist_library. Browser usage and limit are global estimates for this browser when available.'}
              </p>

              {/* Purge button */}
              {onPurgeLibrary && libraryAssets.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                  {!showPurgeConfirm ? (
                    <button
                      onClick={() => setShowPurgeConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                       {saveToLibrary.purge ?? 'Purge library'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                         <span>{saveToLibrary.purgeWarning ?? 'This will permanently delete your library.'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handlePurge}
                          className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded transition-all"
                        >
                           {saveToLibrary.confirmPurge ?? 'Confirm purge'}
                        </button>
                        <button
                          onClick={() => setShowPurgeConfirm(false)}
                          className="flex-1 px-3 py-2 bg-[var(--bg-app)] hover:bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-bold rounded transition-all"
                        >
                           {saveToLibrary.cancel ?? actions?.cancel ?? 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] flex justify-end">
            <Button onClick={onClose} variant="outlined" color="info" size="small">
               {saveToLibrary.close ?? actions?.close ?? 'Close'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
