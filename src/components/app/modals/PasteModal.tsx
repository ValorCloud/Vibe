import React, { useEffect, useRef } from 'react';
import { X, ClipboardPaste, Sparkles, Loader2 } from '../../ui/icons';
import { Button } from '../../ui/Button';
import { Tooltip } from '../../ui/Tooltip';
import { useTranslation } from '../../../i18n';

type ImportProgress = {
  current: number;
  total: number;
  currentLabel: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pastedText: string;
  setPastedText: (v: string) => void;
  isAnalyzing: boolean;
  importProgress?: ImportProgress;
  onAnalyze: () => void;
}

export function PasteModal({
  isOpen,
  onClose,
  pastedText,
  setPastedText,
  isAnalyzing,
  importProgress,
  onAnalyze,
}: Props) {
  const { t } = useTranslation();
  const activeLineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const progressValue = importProgress?.total
    ? Math.round((importProgress.current / importProgress.total) * 100)
    : 0;

  // Indeterminate shimmer: analyzing started but no step completed yet
  const isIndeterminate = isAnalyzing && importProgress?.total !== undefined && importProgress.current === 0;

  // Compute which line range is "active" based on progress ratio
  const lines = pastedText.split('\n');
  const totalLines = lines.length;
  const activeLine = isAnalyzing && importProgress?.total
    ? Math.min(
        Math.floor((importProgress.current / importProgress.total) * totalLines),
        totalLines - 1
      )
    : -1;

  // Auto-scroll active line into view
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }
  }, [activeLine]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Gradient border wrapper */}
      <div
        className="lcars-gradient-outline relative w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-[24px_8px_24px_8px] animate-in zoom-in-95 duration-300"
        style={{
          padding: '2px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          isolation: 'isolate',
        }}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.paste.title}
        className="dialog-surface w-full h-full overflow-hidden flex flex-col rounded-none sm:rounded-[22px_6px_22px_6px] shadow-2xl"
      >
        <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-sidebar)]">
          <h3 className="text-sm font-bold tracking-widest text-[var(--text-primary)] uppercase flex items-center gap-2.5">
            <ClipboardPaste className="w-4 h-4 text-[var(--accent-color)]" />
            {t.paste.title}
          </h3>
          <button
            onClick={onClose}
            aria-label={t.paste.cancel}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-app)]">
          <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">{t.paste.description}</p>

          {/* Textarea when idle, animated scanner when analyzing */}
          {!isAnalyzing ? (
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={t.paste.placeholder}
              className="w-full h-80 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl p-5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]/50 focus:ring-1 focus:ring-[var(--accent-color)]/30 transition-all resize-none placeholder:text-[var(--text-secondary)] font-mono leading-relaxed"
            />
          ) : (
            <div
              ref={scrollContainerRef}
              className="w-full h-80 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed"
              style={{ padding: '20px' }}
            >
              {lines.map((line, idx) => {
                const isPast = idx < activeLine;
                const isActive = idx === activeLine;
                const isFuture = idx > activeLine;

                return (
                  <div
                    key={idx}
                    ref={isActive ? activeLineRef : undefined}
                    style={{
                      position: 'relative',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      transition: 'background 0.3s ease, color 0.3s ease, opacity 0.3s ease',
                      opacity: isPast ? 0.35 : isFuture ? 0.6 : 1,
                      color: isActive
                        ? 'var(--accent-color)'
                        : isPast
                        ? 'var(--text-secondary)'
                        : 'var(--text-primary)',
                      background: isActive
                        ? 'color-mix(in srgb, var(--accent-color) 10%, transparent)'
                        : 'transparent',
                      boxShadow: isActive
                        ? 'inset 0 0 0 1px color-mix(in srgb, var(--accent-color) 25%, transparent)'
                        : 'none',
                      minHeight: '1.5em',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {/* Scan beam on active line */}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '4px',
                          background:
                            'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-color) 20%, transparent) 50%, transparent 100%)',
                          backgroundSize: '200% 100%',
                          animation: 'paste-scan 1.4s ease-in-out infinite',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {line || '\u00A0'}
                  </div>
                );
              })}
            </div>
          )}

          {/* Keyframes: scan beam + indeterminate shimmer */}
          <style>{`
            @keyframes paste-scan {
              0%   { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
            @keyframes paste-progress-indeterminate {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
            @keyframes paste-label-in {
              from { opacity: 0; transform: translateY(4px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {isAnalyzing && importProgress && importProgress.total > 0 && (
            <div className="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)]/80 p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>{t.paste.analyzing}</span>
                {/* tabular-nums prevents layout shift as digits change */}
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {importProgress.current}/{importProgress.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--input-bg)] relative">
                {isIndeterminate ? (
                  /* Indeterminate shimmer: first step not yet complete */
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '30%',
                      borderRadius: '9999px',
                      background: 'var(--accent-color)',
                      opacity: 0.7,
                      animation: 'paste-progress-indeterminate 1.2s cubic-bezier(0.65, 0, 0.35, 1) infinite',
                    }}
                  />
                ) : (
                  <div
                    role="progressbar"
                    aria-label={t.paste.analyzing}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressValue}
                    style={{
                      width: `${progressValue}%`,
                      willChange: 'width',
                      transition: 'width 400ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    className="h-full rounded-full bg-[var(--accent-color)]"
                  />
                )}
              </div>
              {importProgress.currentLabel && (
                /* key triggers re-mount → slide-in animation on each new label */
                <p
                  key={importProgress.currentLabel}
                  className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--accent-color)]"
                  style={{ animation: 'paste-label-in 200ms ease-out both' }}
                >
                  {importProgress.currentLabel}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] flex justify-end gap-3">
          <Tooltip title={t.tooltips.analysisCancel}>
            <Button onClick={onClose} variant="text" color="inherit">{t.paste.cancel}</Button>
          </Tooltip>
          <Tooltip title={t.tooltips.analysisImport}>
            <Button
              onClick={onAnalyze}
              disabled={!pastedText.trim() || isAnalyzing}
              variant="contained" color="info"
              startIcon={isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            >
              {isAnalyzing ? t.paste.analyzing : t.paste.analyze}
            </Button>
          </Tooltip>
        </div>
      </div>
      </div>
    </div>
  );
}
