import React from 'react';
import { Upload, AlertTriangle, Library, X } from '../../ui/icons';
import { useTranslation } from '../../../i18n';
import { Button } from '../../ui/Button';

interface Props {
  isOpen: boolean;
  hasExistingWork: boolean;
  onClose: () => void;
  onOpenLibrary: () => void;
  onChooseFile: () => void;
  onPasteLyrics: () => void;
}

export function ImportModal({ isOpen, hasExistingWork, onClose, onOpenLibrary, onChooseFile, onPasteLyrics }: Props) {
  const { t } = useTranslation();
  const importDialog = t.importDialog ?? ({} as NonNullable<typeof t.importDialog>);
  const saveToLibrary = t.saveToLibrary ?? ({} as NonNullable<typeof t.saveToLibrary>);
  const actions = (t as { actions?: { cancel?: string } }).actions;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Ambient glow – dark theme only */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden items-center justify-center hidden dark:flex">
        <div className={`w-[400px] h-[300px] blur-[120px] rounded-full ${hasExistingWork ? 'bg-amber-500/10' : 'bg-[var(--accent-color)]/10'}`} />
      </div>

      {/* Gradient border wrapper */}
      <div
        className="lcars-gradient-outline relative w-full sm:max-w-md h-full sm:h-auto rounded-none sm:rounded-[24px_8px_24px_8px] animate-in zoom-in-95 duration-300"
        style={{
          padding: '2px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          isolation: 'isolate',
        }}
      >
      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={importDialog.title ?? 'Import lyrics'}
        className="relative w-full h-full flex flex-col dialog-surface rounded-none sm:rounded-[22px_6px_22px_6px] shadow-2xl overflow-hidden"
      >

        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0 bg-[var(--bg-sidebar)]">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasExistingWork ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20'}`}>
              {hasExistingWork
                ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                : <Upload className="w-4 h-4 text-[var(--accent-color)]" />}
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-widest text-[var(--text-primary)] uppercase">
                 {importDialog.title ?? 'Import lyrics'}
              </h3>
              {hasExistingWork && (
                <p className="text-xs text-amber-500 uppercase tracking-wider mt-0.5">
                   {importDialog.warning ?? 'Existing lyrics will be replaced'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={importDialog.cancel ?? actions?.cancel ?? 'Cancel'}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 bg-[var(--bg-app)]">
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {hasExistingWork
              ? (importDialog.replaceDescription ?? 'Importing will replace your current lyrics.')
              : (importDialog.emptyDescription ?? 'Paste lyrics or choose a file to import.')}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{importDialog.supportedFiles ?? 'Supported files: .txt, .md, .docx, .odt'}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
          <Button onClick={onOpenLibrary} variant="outlined" color="inherit" startIcon={<Library className="w-4 h-4" />}>
            {saveToLibrary.title ?? 'Library'}
          </Button>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Button onClick={onPasteLyrics} variant="outlined" color="primary">
              {(t.editor as { emptyState?: { pasteLyrics?: string } } | undefined)?.emptyState?.pasteLyrics ?? 'Paste Lyrics'}
            </Button>
            <Button onClick={onChooseFile} variant="contained" color="primary">
              {importDialog.chooseFile ?? 'Choose file'}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
