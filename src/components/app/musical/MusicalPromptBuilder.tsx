import React, { useState, useCallback } from 'react';
import { Sparkles, Loader2, Copy, Check } from '../../ui/icons';
import { Tooltip } from '../../ui/Tooltip';
import { GBPanel } from '../../ui/GBPanel';
import { useTranslation } from '../../../i18n';
import { copyToClipboard } from '../../../utils/clipboard';

const AMBER_PRIMARY = 'var(--lcars-amber)';
const PROMPT_CHARACTER_LIMIT = 1000;
const PROMPT_SECTIONS = ['STYLE', 'MOOD', 'VOCALS', 'INSTRUMENTATION', 'RHYTHM/GROOVE', 'STRUCTURE', 'MIX/SPACE', 'REFERENCES', 'DELIVERY'];

interface Props {
  musicalPrompt: string;
  setMusicalPrompt: (v: string) => void;
  isGeneratingMusicalPrompt: boolean;
  isAnalyzingLyrics: boolean;
  canGenerate: boolean;
  hasApiKey: boolean;
  generateMusicalPrompt: () => void;
}

export function MusicalPromptBuilder({
  musicalPrompt, setMusicalPrompt,
  isGeneratingMusicalPrompt, isAnalyzingLyrics,
  canGenerate, hasApiKey, generateMusicalPrompt,
}: Props) {
  const { t } = useTranslation();
  const m = t.musical;
  const [copied, setCopied] = useState(false);
  const promptLength = musicalPrompt.length;
  const promptUsageRatio = promptLength / PROMPT_CHARACTER_LIMIT;
  const promptUsagePercent = Math.min(100, promptUsageRatio * 100);
  const promptCounterColor = promptUsageRatio >= 0.9 ? '#f87171' : promptUsageRatio >= 0.7 ? AMBER_PRIMARY : '#34d399';

  const handleCopy = useCallback(() => {
    if (!musicalPrompt) return;
    void copyToClipboard(musicalPrompt).then((ok) => {
      if (!ok) return; // clipboard unavailable or write rejected — leave UI untouched
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [musicalPrompt]);

  return (
    <div className="space-y-4">
      <Tooltip title={!hasApiKey ? t.tooltips.aiUnavailable : m.generatePrompt}>
        <button onClick={generateMusicalPrompt}
          disabled={!canGenerate || !hasApiKey || isGeneratingMusicalPrompt || isAnalyzingLyrics}
          className="ux-interactive w-full flex items-center justify-center gap-2.5 px-6 py-3.5 font-semibold text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] vibe-card"
          style={{ background: AMBER_PRIMARY, color: '#000' }}
        >
          {isGeneratingMusicalPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {m.generatePrompt}
        </button>
      </Tooltip>

      <div className="border px-3 py-2.5 space-y-1.5 vibe-card" style={{ borderColor: `${AMBER_PRIMARY}55`, background: `${AMBER_PRIMARY}0f` }}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: AMBER_PRIMARY }} />
          <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">{m.promptStructureLabel}</span>
        </div>
        <p className="text-[11px] leading-5 text-[var(--text-secondary)]">{m.promptStructureHint}</p>
        <div className="flex flex-wrap gap-1">
          {PROMPT_SECTIONS.map(section => (
            <span key={section} className="px-2 py-0.5 text-[10px] font-semibold tracking-wide border vibe-badge" style={{ borderColor: `${AMBER_PRIMARY}55`, background: `${AMBER_PRIMARY}12`, color: AMBER_PRIMARY }}>
              {section}
            </span>
          ))}
        </div>
      </div>

      {(musicalPrompt || isGeneratingMusicalPrompt) && (
        <GBPanel>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: AMBER_PRIMARY }} />
                <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">{m.promptLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden min-w-[8rem] sm:block">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-color)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${promptUsagePercent}%`, background: promptCounterColor }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-medium" style={{ color: promptCounterColor }}>
                  {promptLength} / {PROMPT_CHARACTER_LIMIT}
                </span>
                <span className="text-[9px] text-[var(--text-secondary)] opacity-60">{m.optimizedFor}</span>
                {musicalPrompt && (
                  <button onClick={handleCopy}
                    className="ux-interactive flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium tracking-wide border border-[var(--border-color)] text-[var(--text-secondary)] vibe-badge"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? m.copied : m.copyPrompt}
                  </button>
                )}
              </div>
            </div>
            {isGeneratingMusicalPrompt && !musicalPrompt ? (
              <div className="flex items-center gap-3 py-4">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: AMBER_PRIMARY }} />
                <span className="text-sm text-[var(--text-secondary)]">{m.analyzing}</span>
              </div>
            ) : (
              <textarea value={musicalPrompt} onChange={e => setMusicalPrompt(e.target.value)} rows={6} maxLength={PROMPT_CHARACTER_LIMIT}
                className="w-full bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] lcars-glow-focus transition-colors resize-none leading-relaxed border vibe-tile"
                style={{ borderColor: `${AMBER_PRIMARY}55` }}
              />
            )}
          </div>
        </GBPanel>
      )}

      {!musicalPrompt && !isGeneratingMusicalPrompt && (
        <GBPanel>
          <div className="p-6 text-center space-y-2">
            <Sparkles className="w-8 h-8 opacity-30 mx-auto" style={{ color: AMBER_PRIMARY }} />
            <p className="text-sm text-[var(--text-secondary)] opacity-50">{m.promptPlaceholder}</p>
          </div>
        </GBPanel>
      )}
    </div>
  );
}
