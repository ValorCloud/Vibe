import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileCode2, FileText, Library, X } from '../../ui/icons';
import { Button } from '../../ui/Button';
import { useTranslation } from '../../../i18n';
import type { ExportFormat } from '../../../utils/exportUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenLibrary: () => void;
  onExport: (format: ExportFormat) => void;
}

/** Minimal SVG badge used as a format icon when lucide has no suitable equivalent. */
function FormatBadge({ label, color }: { label: string; color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" fill="none" />
      <text
        x="10"
        y="13.5"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fontFamily="monospace"
        fill={color}
        letterSpacing="0.5"
      >
        {label}
      </text>
    </svg>
  );
}

export function ExportModal({ isOpen, onClose, onOpenLibrary, onExport }: Props) {
  const { t } = useTranslation();
  const exportDialog = t.exportDialog ?? ({} as NonNullable<typeof t.exportDialog>);
  const saveToLibrary = t.saveToLibrary ?? ({} as NonNullable<typeof t.saveToLibrary>);
  const actions = (t as { actions?: { cancel?: string } }).actions;
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('txt');

  useEffect(() => {
    if (isOpen) setSelectedFormat('txt');
  }, [isOpen]);

  const formats = useMemo(() => {
    const exportFormats = t.exportDialog?.formats ?? ({} as NonNullable<NonNullable<typeof t.exportDialog>['formats']>);
    return [
      {
        value: 'txt' as const,
        label: exportFormats.txt ?? 'TXT',
        extension: '.txt',
        icon: <FileText className="w-5 h-5" />,
        accent: '#38bdf8',
        surface: 'rgba(56, 189, 248, 0.14)',
        border: 'rgba(56, 189, 248, 0.28)',
      },
      {
        value: 'markup' as const,
        label: exportFormats.markup ?? 'MARKUP',
        extension: '.md',
        icon: <FileCode2 className="w-5 h-5" />,
        accent: '#a855f7',
        surface: 'rgba(168, 85, 247, 0.14)',
        border: 'rgba(168, 85, 247, 0.28)',
      },
      {
        value: 'odt' as const,
        label: exportFormats.odt ?? 'ODT',
        extension: '.odt',
        icon: <FormatBadge label="ODT" color="#22c55e" />,
        accent: '#22c55e',
        surface: 'rgba(34, 197, 94, 0.14)',
        border: 'rgba(34, 197, 94, 0.28)',
      },
      {
        value: 'docx' as const,
        label: exportFormats.docx ?? 'DOCX',
        extension: '.docx',
        icon: <FormatBadge label="DOC" color="#2563eb" />,
        accent: '#2563eb',
        surface: 'rgba(37, 99, 235, 0.14)',
        border: 'rgba(37, 99, 235, 0.28)',
      },
    ];
  }, [t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Gradient border wrapper */}
      <div
        className="lcars-gradient-outline relative w-full sm:max-w-lg h-full sm:h-auto rounded-none sm:rounded-[24px_8px_24px_8px] animate-in zoom-in-95 duration-300"
        style={{
          padding: '2px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          isolation: 'isolate',
        }}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={exportDialog.title ?? 'Export song'}
        className="relative w-full h-full flex flex-col dialog-surface rounded-none sm:rounded-[22px_6px_22px_6px] shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-sidebar)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center">
              <Download className="w-4 h-4 text-[var(--accent-color)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-widest text-[var(--text-primary)] uppercase">
                 {exportDialog.title ?? 'Export song'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                 {exportDialog.description ?? 'Choose a format to export your lyrics.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={exportDialog.cancel ?? actions?.cancel ?? 'Cancel'}
            className="ux-interactive p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)] rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 bg-[var(--bg-app)]">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mb-3">
            {exportDialog.formatLabel ?? 'Format'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {formats.map(format => {
              const isSelected = format.value === selectedFormat;
              return (
                <button
                  key={format.value}
                  type="button"
                  onClick={() => setSelectedFormat(format.value)}
                  aria-pressed={isSelected}
                  aria-label={`${format.label} ${format.extension}`}
                  className="ux-interactive text-left rounded-[16px_6px_16px_6px] border px-4 py-4"
                  style={isSelected
                    ? {
                        borderColor: format.accent,
                        background: format.surface,
                        boxShadow: `0 0 0 1px ${format.accent}, 0 12px 30px -24px ${format.accent}`,
                      }
                    : {
                        borderColor: 'var(--border-color)',
                        background: 'var(--bg-card)',
                      }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-11 h-11 rounded-[12px_4px_12px_4px] border flex items-center justify-center shrink-0"
                      style={{
                        borderColor: isSelected ? format.border : 'var(--border-color)',
                        background: isSelected ? format.surface : 'transparent',
                        color: isSelected ? format.accent : 'var(--text-secondary)',
                      }}
                    >
                      {format.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{format.label}</p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] uppercase"
                          style={{ background: format.surface, color: format.accent }}
                        >
                          {format.extension}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {format.value.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] flex items-center justify-between gap-3 flex-wrap">
          <Button
            onClick={onOpenLibrary}
            variant="outlined"
            color="inherit"
            startIcon={<Library className="w-4 h-4" />}
            className="ux-interactive"
          >
            {saveToLibrary.title ?? 'Library'}
          </Button>
          <div className="flex items-center gap-3">
            <Button onClick={onClose} variant="outlined" color="inherit" className="ux-interactive">
              {exportDialog.cancel ?? actions?.cancel ?? 'Cancel'}
            </Button>
            <Button
              onClick={() => { onExport(selectedFormat); onClose(); }}
              variant="contained"
              color="primary"
              className="ux-interactive"
            >
               {exportDialog.save ?? 'Save file'}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
