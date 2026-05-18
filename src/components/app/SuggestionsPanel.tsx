import React, { useState } from 'react';
import { X, Lightbulb, Sparkles, Hash, RefreshCw, Check } from '../ui/icons';
import { useTranslation } from '../../i18n';
import { countSyllables } from '../../utils/syllableUtils';
import { useSuggestionsContext } from '../../contexts/SuggestionsContext';

interface Props {
  /** Layout-only concerns — all data sourced from SuggestionsContext. */
  isMobileOverlay?: boolean;
  className?: string;
}

// ─── Skeleton shimmer ────────────────────────────────────────────────
function SkeletonBar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded animate-pulse bg-black/[0.06] dark:bg-white/[0.06] ${className}`}
      aria-hidden="true"
    />
  );
}

function SpellCheckSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading spell check">
      <SkeletonBar className="h-3 w-24" />
      <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--border-color)] space-y-2">
        <SkeletonBar className="h-3.5 w-full" />
        <SkeletonBar className="h-3.5 w-4/5" />
        <div className="flex gap-2 pt-1">
          <SkeletonBar className="h-6 w-20 rounded-lg" />
          <SkeletonBar className="h-6 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function SynonymsSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading synonyms">
      <SkeletonBar className="h-3 w-20" />
      <div className="flex flex-wrap gap-1.5">
        <SkeletonBar className="h-6 w-[56px] rounded-md" />
        <SkeletonBar className="h-6 w-[72px] rounded-md" />
        <SkeletonBar className="h-6 w-[48px] rounded-md" />
        <SkeletonBar className="h-6 w-[64px] rounded-md" />
        <SkeletonBar className="h-6 w-[52px] rounded-md" />
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────
export function SuggestionsPanel({
  isMobileOverlay = false,
  className,
}: Props) {
  const { t } = useTranslation();
  const [
    openSynonymWord,
    setOpenSynonymWord,
  ] = useState<string | null>(null);

  const {
    selectedLineId,
    setSelectedLineId,
    suggestions,
    isSuggesting,
    hasApiKey,
    applySuggestion,
    generateSuggestions,
    spellCheck,
    synonyms,
    isSynonymsLoading,
  } = useSuggestionsContext();

  const panelClassName = [
    'flex flex-col z-50 shadow-2xl',
    'lcars-panel fluent-animate-panel',
    className,
  ].filter(Boolean).join(' ');

  if (!selectedLineId) return null;

  // Guard: t.suggestions is optional in the Translations type
  const ts = t.suggestions ?? ({} as NonNullable<typeof t.suggestions>);

  const hasSpellCorrection = spellCheck?.correction != null;
  const hasSynonyms = synonyms && Object.keys(synonyms).length > 0;

  return (
    <div
      data-suggestions-panel
      className={panelClassName}
      style={{ overflow: 'visible', position: 'relative' }}
    >
      <div className="w-[280px] flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div
          className="h-16 px-5 flex items-center justify-between shrink-0"
          style={{ position: 'relative', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}
        >
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 'var(--accent-rail-thickness, 2px)',
            background: 'var(--accent-rail-gradient-h-rev)',
            opacity: 0.85,
            pointerEvents: 'none',
            zIndex: 1,
          }} />
          <h3
            className="micro-label flex items-center gap-2"
            style={{ color: 'var(--text-muted)' }}
          >
            <Lightbulb className="w-4 h-4 text-[var(--accent-warning)]" />
            <span className="text-xs uppercase tracking-widest font-semibold">{ts.title ?? 'Suggestions'}</span>
          </h3>
          <button
            onClick={() => setSelectedLineId(null)}
            className="p-2 transition-colors rounded"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={isMobileOverlay ? 'Close suggestions panel' : 'Clear line suggestions'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">

          {/* ── Spell-check correction ── */}
          {(spellCheck?.isChecking || hasSpellCorrection) && (
            <div className="space-y-2">
              <p
                className="text-[11px] uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                {ts.spellCheckTitle ?? 'Spell check'}
              </p>
              {spellCheck?.isChecking ? (
                <SpellCheckSkeleton />
              ) : hasSpellCorrection ? (
                <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--accent-color)]/20 space-y-2">
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {spellCheck!.correction}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { spellCheck!.applyCorrection(spellCheck!.correction!); setSelectedLineId(null); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-color)]/20 hover:bg-[var(--accent-color)]/30 text-[11px] text-[var(--accent-color)] uppercase tracking-wider transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      {ts.applyCorrection ?? 'Apply correction'}
                    </button>
                    <button
                      type="button"
                      onClick={spellCheck!.dismissCorrection}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[11px] uppercase tracking-wider transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {ts.dismiss ?? 'Dismiss'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* ── Synonyms ── */}
          {(isSynonymsLoading || hasSynonyms) && (
            <div className="space-y-2">
              <p
                className="text-[11px] uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                {ts.synonymsTitle ?? 'Synonyms'}
              </p>
              {isSynonymsLoading ? (
                <SynonymsSkeleton />
              ) : hasSynonyms ? (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(synonyms!).map(([word, syns]) => (
                    <div key={word} className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenSynonymWord(openSynonymWord === word ? null : word)}
                        aria-label={`Show synonyms for "${word}"`}
                        className="px-2 py-1 rounded-md text-[11px] bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.10] border border-black/10 dark:border-white/10 hover:border-[var(--accent-color)]/40 transition-all"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {word}
                      </button>
                      {openSynonymWord === word && (
                        <div className="absolute bottom-full left-0 mb-1 z-20 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl p-2 space-y-1 min-w-[120px]">
                          {syns.map(syn => (
                            <button
                              key={syn}
                              type="button"
                              onClick={() => {
                                applySuggestion(syn);
                                setOpenSynonymWord(null);
                              }}
                              className="block w-full text-left px-2 py-1 rounded text-xs hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {syn}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* ── Divider if spell/synonym sections visible ── */}
          {(hasSpellCorrection || isSynonymsLoading || hasSynonyms) && (
            <div className="border-t border-black/5 dark:border-white/5 my-2" />
          )}

          {/* ── AI line suggestions ── */}
          {isSuggesting ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-[var(--accent-color)]/20 border-t-[var(--accent-color)] animate-spin" />
                <Sparkles className="absolute inset-0 m-auto w-5 h-5 text-[var(--accent-color)] animate-pulse" />
              </div>
              <p className="text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>
                {ts.crafting ?? 'Crafting…'}
              </p>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-3">
              {suggestions.map((suggestion, idx) => {
                const syllables = suggestion
                  .split(/\s+/)
                  .filter(Boolean)
                  .reduce((acc, word) => acc + countSyllables(word), 0);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { applySuggestion(suggestion); setSelectedLineId(null); }}
                    aria-label={`Apply suggestion: ${suggestion}`}
                    className="group w-full p-4 text-left bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/5 hover:border-[var(--accent-color)]/30 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="text-sm leading-relaxed flex-1 group-hover:text-[var(--text-primary)]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {suggestion}
                      </p>
                      {syllables > 0 && (
                        <span
                          className="flex-shrink-0 text-[11px] tabular-nums bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 mt-0.5"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {syllables} syll.
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[11px] text-[var(--accent-color)] uppercase tracking-wider">{ts.clickToApply ?? 'Click to apply'}</span>
                      <Check className="w-3 h-3 text-[var(--accent-color)]" />
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => generateSuggestions(selectedLineId)}
                disabled={!hasApiKey}
                aria-label="Generate more suggestions"
                className="w-full py-3 mt-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest hover:text-[var(--accent-color)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: 'var(--text-muted)' }}
              >
                <RefreshCw className="w-3 h-3" />
                {ts.moreOptions ?? 'More options'}
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-20">
              <div className="w-12 h-12 rounded-full bg-black/[0.03] dark:bg-white/[0.02] flex items-center justify-center">
                <Hash className="w-6 h-6" style={{ color: 'var(--text-faint)' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {ts.empty ?? 'No suggestions'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
