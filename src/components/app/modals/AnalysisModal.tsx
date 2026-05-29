import React from 'react';
import {
  X, BarChart2, Sparkles, Loader2, BookOpen, Activity, CheckCircle2, Target,
  Music, Check, Undo2, Zap
} from '../../ui/icons';
import { Button } from '../../ui/Button';
import { Tooltip } from '../../ui/Tooltip';
import { useTranslation } from '../../../i18n';
import { ReadAloudButton } from '../../../features/voice/ReadAloudButton';
import { AnalysisLanguagePicker } from './AnalysisLanguagePicker';
import type { SongVersion } from '../../../types';

// Sentinel strings used when saving a version before applying analysis
// suggestions. Must stay in sync with the values emitted by useAnalysis.
const BEFORE_ANALYSIS_VERSION_NAMES = [
  'Before Analysis Improvements',
  'Before Analysis Batch Improvements',
] as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isAnalyzing: boolean;
  /** Background theme analysis running (useBackgroundThemeAnalysis). */
  isAnalyzingTheme?: boolean;
  analysisReport: {
    theme: string;
    emotionalArc: string;
    strengths: string[];
    improvements: string[];
    musicalSuggestions: string[];
    summary: string;
  } | null;
  analysisSteps: string[];
  appliedAnalysisItems: Set<string>;
  selectedAnalysisItems: Set<string>;
  isApplyingAnalysis: string | null;
  toggleAnalysisItemSelection: (item: string) => void;
  /** Apply a single improvement item directly (one-click path). */
  applyAnalysisItem?: (item: string) => Promise<void>;
  applySelectedAnalysisItems: () => void;
  clearAppliedAnalysisItems: () => void;
  versions: SongVersion[];
  rollbackToVersion: (v: SongVersion) => void;
}

export function AnalysisModal({
  isOpen, onClose,
  isAnalyzing, isAnalyzingTheme = false, analysisReport, analysisSteps,
  appliedAnalysisItems, selectedAnalysisItems, isApplyingAnalysis,
  toggleAnalysisItemSelection, applyAnalysisItem, applySelectedAnalysisItems,
  clearAppliedAnalysisItems, versions, rollbackToVersion,
}: Props) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const strengths = Array.isArray(analysisReport?.strengths) ? analysisReport.strengths : [];
  const improvements = Array.isArray(analysisReport?.improvements) ? analysisReport.improvements : [];
  const musicalSuggestions = Array.isArray(analysisReport?.musicalSuggestions) ? analysisReport.musicalSuggestions : [];

  const hasReport = !!analysisReport;

  // Assemble a natural, voice-friendly reading of the report using localized
  // section labels so it is spoken in the active UI language.
  const analysisSpokenText = analysisReport
    ? [
        `${t.analysis.summary}. ${analysisReport.summary}`,
        `${t.analysis.emotionalArc}. ${analysisReport.emotionalArc}`,
        `${t.analysis.theme}. ${analysisReport.theme}`,
        strengths.length ? `${t.analysis.strengths}. ${strengths.join('. ')}` : '',
        improvements.length ? `${t.analysis.improvements}. ${improvements.join('. ')}` : '',
      ].filter(Boolean).join('. ')
    : '';

  // Only clear the applied-items state when a matching snapshot actually exists.
  // Calling clearAppliedAnalysisItems() without a rollback would mislead the UI
  // into showing 'reverted' state while the song data is unchanged.
  function handleRevert() {
    const beforeVersion = versions.find(v =>
      BEFORE_ANALYSIS_VERSION_NAMES.includes(v.name as typeof BEFORE_ANALYSIS_VERSION_NAMES[number])
    );
    if (beforeVersion) {
      rollbackToVersion(beforeVersion);
      clearAppliedAnalysisItems();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px] animate-in fade-in duration-200"
        onClick={!isAnalyzing && isApplyingAnalysis === null ? onClose : undefined}
      />

      {/* Ambient glow – dark theme only */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden items-center justify-center hidden dark:flex">
        <div className="w-[700px] h-[400px] bg-[var(--accent-color)]/10 blur-[120px] rounded-full" />
      </div>

      {/*
        LCARS rule: TL=grand TR=petit BR=grand BL=petit
        Both panels use rounded-[24px_8px_24px_8px] / inner rounded-[22px_6px_22px_6px]
        Right panel left edge flush via sm:-ml-[2px] (gradient border overlap).
      */}
      <div className="relative flex flex-col sm:flex-row items-stretch gap-0 w-full sm:w-auto sm:max-w-5xl h-full sm:h-auto animate-in zoom-in-95 duration-300">

        {/* ── Main dialog ── */}
        <div
          className="lcars-gradient-outline relative w-full sm:w-[520px] h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-[24px_8px_24px_8px] flex-shrink-0"
          style={{ padding: '2px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', isolation: 'isolate' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.analysis.title}
            className="relative w-full h-full flex flex-col glass-panel rounded-none sm:rounded-[22px_6px_22px_6px] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-sidebar)] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4 text-[var(--accent-color)]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-widest text-[var(--text-primary)] uppercase">
                    {t.analysis.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-[var(--accent-color)] uppercase tracking-wider">
                      {isAnalyzing ? t.analysis.deepAnalysis : analysisReport ? t.analysis.summary : ''}
                    </p>
                    {!isAnalyzing && isAnalyzingTheme && (
                      <span
                        className="flex items-center gap-1 text-[10px] text-[var(--accent-color)]/60 uppercase tracking-wider"
                        aria-label="Background theme analysis running"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]/60 animate-pulse" />
                        Theme
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasReport && !isAnalyzing && (
                  <ReadAloudButton
                    id="analysis-report"
                    text={analysisSpokenText}
                    label={t.tooltips?.readAnalysis ?? 'Read analysis aloud'}
                  />
                )}
                <AnalysisLanguagePicker />
                <button
                  onClick={onClose}
                  disabled={isAnalyzing || isApplyingAnalysis !== null}
                  aria-label={t.analysis.close}
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-app)]">
              {isAnalyzing ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6 py-16">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-[var(--accent-color)]/10 border-t-[var(--accent-color)] animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-[var(--accent-color)] animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-3 text-center">
                    <h4 className="text-lg font-medium text-[var(--text-primary)]">{t.analysis.deepAnalysis}</h4>
                    <div className="flex flex-col items-center gap-2">
                      {analysisSteps.map((step, idx) => (
                        <p key={idx} className={`text-xs transition-all duration-500 ${
                          idx === analysisSteps.length - 1
                            ? 'text-[var(--accent-color)] font-medium scale-110'
                            : 'text-[var(--text-secondary)] opacity-50'
                        }`}>{step}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : analysisReport ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Executive Brief */}
                  <div className="bg-[var(--accent-color)]/5 border border-[var(--accent-color)]/20 p-3 rounded-2xl">
                    <h4 className="text-xs font-medium text-[var(--accent-color)] mb-1">{t.analysis.summary}</h4>
                    <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed">"{analysisReport.summary}"</p>
                  </div>
                  {/* Emotional Arc */}
                  <section className="space-y-2">
                    <h4 className="micro-label text-[var(--accent-color)] flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" />{t.analysis.emotionalArc}
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-black/[0.02] dark:bg-white/[0.02] p-3 rounded-xl border border-black/5 dark:border-white/5">{analysisReport.emotionalArc}</p>
                  </section>
                  {/* Theme */}
                  <section className="space-y-2">
                    <h4 className="micro-label text-[var(--accent-color)] flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5" />{t.analysis.theme}
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-black/[0.02] dark:bg-white/[0.02] p-3 rounded-xl border border-black/5 dark:border-white/5">{analysisReport.theme}</p>
                  </section>
                  {/* Strengths */}
                  <section className="space-y-2">
                    <h4 className="micro-label text-emerald-500 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />{t.analysis.strengths}
                    </h4>
                    <div className="bg-black/[0.02] dark:bg-white/[0.02] p-3 rounded-xl border border-black/5 dark:border-white/5">
                      <ul className="space-y-1.5">
                        {strengths.map((s, i) => (
                          <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-2">
                            <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                  {musicalSuggestions.length > 0 && (
                    <p className="text-[9px] text-[var(--text-secondary)]/60 text-center uppercase tracking-widest flex items-center justify-center gap-1.5">
                      <Music className="w-2.5 h-2.5" />
                      {t.analysis.musicalSuggestionsMovedHint}
                    </p>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-20">
                  <p className="text-[var(--text-secondary)]">{t.analysis.noData}</p>
                </div>
              )}
            </div>

            {/* Footer — Close only */}
            <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] flex justify-end items-center flex-shrink-0">
              <Tooltip title={t.tooltips.closeAnalysis}>
                <Button onClick={onClose} variant="outlined" color="inherit" disabled={isAnalyzing || isApplyingAnalysis !== null}>
                  {t.analysis.close}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* ── Right panel: Actionable Improvements ──
            LCARS: TL=grand(24) TR=petit(8) BR=grand(24) BL=petit(8)
            Identical pattern to the main dialog.
        */}
        {hasReport && (
          <div
            className="lcars-gradient-outline relative w-full sm:w-72 sm:max-h-[90vh] rounded-none sm:rounded-[24px_8px_24px_8px] flex-shrink-0 sm:-ml-[2px]"
            style={{ padding: '2px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', isolation: 'isolate' }}
          >
            <div className="relative w-full h-full flex flex-col glass-panel rounded-none sm:rounded-[22px_6px_22px_6px] overflow-hidden">
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] flex-shrink-0">
                <h4 className="micro-label text-amber-500 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" />{t.analysis.improvements}
                </h4>
              </div>

              {/* Improvements list */}
              <div className="p-4 flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-app)]">
                <ul className="space-y-2">
                  {improvements.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 group">
                      <button
                        onClick={() => !appliedAnalysisItems.has(s) && toggleAnalysisItemSelection(s)}
                        disabled={isApplyingAnalysis !== null || appliedAnalysisItems.has(s)}
                        aria-label={appliedAnalysisItems.has(s) ? 'Applied' : selectedAnalysisItems.has(s) ? 'Deselect' : 'Select for batch apply'}
                        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          appliedAnalysisItems.has(s)
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : selectedAnalysisItems.has(s)
                            ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                            : 'border-[var(--border-color)] hover:border-amber-500/50 group-hover:bg-amber-500/10'
                        }`}
                      >
                        {(appliedAnalysisItems.has(s) || selectedAnalysisItems.has(s))
                          ? <Check className="w-2.5 h-2.5" />
                          : <div className="w-1 h-1 rounded-full bg-[var(--text-secondary)]/20 group-hover:bg-amber-500/50" />}
                      </button>
                      <span className={`flex-1 text-xs leading-relaxed transition-colors ${
                        appliedAnalysisItems.has(s)
                          ? 'text-[var(--text-secondary)] line-through'
                          : selectedAnalysisItems.has(s)
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)]'
                      }`}>{s}</span>
                      {applyAnalysisItem && !appliedAnalysisItems.has(s) && (
                        <Tooltip title="Apply this suggestion directly">
                          <button
                            onClick={() => applyAnalysisItem(s)}
                            disabled={isApplyingAnalysis !== null}
                            aria-label={`Apply: ${s.slice(0, 80)}${s.length > 80 ? '…' : ''}`}
                            className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-0 ${
                              isApplyingAnalysis === s ? 'opacity-100' : ''
                            }`}
                          >
                            {isApplyingAnalysis === s
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Zap className="w-3 h-3" />
                            }
                          </button>
                        </Tooltip>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Panel footer: apply batch + revert */}
              <div className="px-4 py-3 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] flex flex-col gap-2 flex-shrink-0">
                {selectedAnalysisItems.size > 0 && (
                  <Tooltip title={t.tooltips.applyAnalysis}>
                    <Button
                      onClick={applySelectedAnalysisItems}
                      variant="contained" color="success"
                      disabled={isApplyingAnalysis !== null}
                      startIcon={isApplyingAnalysis === 'batch'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Sparkles className="w-4 h-4" />}
                      fullWidth
                    >
                      {t.analysis.apply} ({selectedAnalysisItems.size})
                    </Button>
                  </Tooltip>
                )}
                {appliedAnalysisItems.size > 0 && (
                  <Tooltip title={t.tooltips.revertAnalysis}>
                    <button
                      onClick={handleRevert}
                      className="text-[10px] uppercase tracking-widest text-amber-500 hover:text-amber-400 flex items-center justify-center gap-2 transition-colors w-full py-1"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      {t.analysis.revert}
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
