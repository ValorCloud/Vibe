/**
 * MusicalInsightsBar
 * Ribbon contextuel affiché à la place de InsightsBar quand activeTab === 'musical'.
 *
 * Groupes :
 *   [State]   — badge prompt filled/empty
 *   [Actions] — Auto-Suggest · Copy · Export JSON · Reset fields
 *   [Generate]— bouton Generate → Suno (spinner pendant génération)
 *   [Quality] — score de complétude du prompt (segments remplis / total)
 */
import React, { useCallback, useState } from 'react';
import { Spinner } from '@fluentui/react-components';
import { Tooltip } from '../ui/Tooltip';
import { useTranslation } from '../../i18n';
import { useSongContext } from '../../contexts/SongContext';
import { useComposerContext } from '../../contexts/ComposerContext';
import { useAppStateContext } from '../../contexts/AppStateContext';
import { useSuno } from '../../hooks/useSuno';
import { copyToClipboard } from '../../utils/clipboard';
import { computeCompleteness } from '../../utils/musicalPromptCompleteness';
import { RhythmicCoherenceDialog } from './modals/RhythmicCoherenceDialog';
import type { CoherenceResult } from '../../lib/rhythmicCoherence';
import {
  MusicNote2Regular,
  CopyRegular,
  ArrowDownloadRegular,
  ArrowResetRegular,
  PlayCircleRegular,
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  SparkleRegular,
  DismissCircleRegular,
} from '@fluentui/react-icons';

// ─── sub-components ──────────────────────────────────────────────────────────

function PromptStateBadge({ hasPrompt, labelReady, labelEmpty }: { hasPrompt: boolean; labelReady: string; labelEmpty: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold tracking-wide"
      style={{
        background: hasPrompt
          ? 'color-mix(in srgb, var(--lcars-cyan, #4f98a3) 12%, transparent)'
          : 'color-mix(in srgb, var(--text-secondary) 8%, transparent)',
        color: hasPrompt ? 'var(--lcars-cyan, #4f98a3)' : 'var(--text-secondary)',
        border: `1px solid ${
          hasPrompt
            ? 'color-mix(in srgb, var(--lcars-cyan, #4f98a3) 25%, transparent)'
            : 'var(--border-color)'
        }`,
      }}
      aria-label={hasPrompt ? labelReady : labelEmpty}
    >
      {hasPrompt
        ? <CheckmarkCircleRegular style={{ width: 13, height: 13 }} />
        : <ErrorCircleRegular style={{ width: 13, height: 13 }} />}
      <span>{hasPrompt ? labelReady : labelEmpty}</span>
    </div>
  );
}

function CompletenessScore({ pct, filled, total }: { pct: number; filled: number; total: number }) {
  const color =
    pct >= 80 ? 'var(--lcars-cyan, #4f98a3)'
    : pct >= 40 ? 'var(--lcars-amber, #e8af34)'
    : 'var(--accent-danger, var(--color-error, #a12c7b))';

  return (
    <Tooltip title={`Complétude du prompt : ${filled}/${total} sections détectées`}>
      <div className="flex items-center gap-2" aria-label={`Complétude ${pct}%`}>
        <div
          style={{
            width: 56,
            height: 4,
            borderRadius: 2,
            background: 'var(--border-color)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: color,
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color,
            minWidth: 28,
          }}
        >
          {pct}%
        </span>
      </div>
    </Tooltip>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        height: 20,
        background: 'var(--border-color)',
        opacity: 0.5,
        flexShrink: 0,
      }}
    />
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export const MusicalInsightsBar = React.memo(function MusicalInsightsBar() {
  const { t } = useTranslation();

  // ── Song state ──────────────────────────────────────────────────────────────
  const {
    musicalPrompt,
    setMusicalPrompt,
    setGenre,
    setTempo,
    setInstrumentation,
    setRhythm,
    setNarrative,
    song,
    title,
    topic,
    genre,
    mood,
    instrumentation,
    rhythm,
  } = useSongContext();

  // ── App state (API key) ─────────────────────────────────────────────────────
  const { appState } = useAppStateContext();
  const hasApiKey = appState.hasApiKey;

  // ── Composer ────────────────────────────────────────────────────────────────
  const {
    isGenerating,
    isGeneratingMusicalPrompt,
    generateMusicalPrompt,
    coherenceResult,
    dismissCoherenceResult,
  } = useComposerContext();

  // ── Suno ────────────────────────────────────────────────────────────────────
  const { generate, status } = useSuno();

  const isSunoGenerating =
    status.phase === 'generating' || status.phase === 'polling';

  const hasPrompt = Boolean(musicalPrompt && musicalPrompt.trim().length > 0);
  const { filled, total, pct } = computeCompleteness(musicalPrompt);
  const busy = isGenerating || isGeneratingMusicalPrompt || isSunoGenerating;

  // ── Auto-Suggest gating ─────────────────────────────────────────────────────
  const hasLyrics = song.some(s => s.lines.some(l => l.text.trim() !== ''));
  const hasContext = Boolean(title || topic || hasLyrics || mood || genre || instrumentation);
  const canAutoSuggest = hasApiKey && hasContext;
  const autoSuggestDisabled = busy || !canAutoSuggest;
  const autoSuggestTooltip = !hasApiKey
    ? t.tooltips.aiUnavailable
    : !hasContext
      ? 'Ajoutez un titre, sujet, paroles, humeur, genre ou instrumentation'
      : t.tooltips.generateMusical;

  const handleAutoSuggest = useCallback(() => {
    if (autoSuggestDisabled) return;
    void generateMusicalPrompt();
  }, [autoSuggestDisabled, generateMusicalPrompt]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setMusicalPrompt('');
    setGenre('');
    setTempo(120);
    setInstrumentation('');
    setRhythm('');
    setNarrative('');
  }, [setMusicalPrompt, setGenre, setTempo, setInstrumentation, setRhythm, setNarrative]);

  const handleGenerateWithSuno = useCallback(() => {
    if (!musicalPrompt.trim()) return;
    const trimmedTitle = title?.trim();
    void generate({
      prompt: musicalPrompt.trim(),
      ...(trimmedTitle ? { title: trimmedTitle } : {}),
      style: [genre, mood, instrumentation, rhythm].filter(Boolean).join(', '),
    });
  }, [generate, musicalPrompt, title, genre, mood, instrumentation, rhythm]);

  // copy feedback
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    if (!musicalPrompt) return;
    const ok = await copyToClipboard(musicalPrompt);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [musicalPrompt]);

  // export as JSON
  const handleExport = useCallback(() => {
    if (!musicalPrompt) return;
    const blob = new Blob(
      [JSON.stringify({ prompt: musicalPrompt, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'musical-prompt.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [musicalPrompt]);

  // ── Coherence dialog handler ─────────────────────────────────────────────────
  const handleCoherenceApply = useCallback((option: 'a' | 'b', result: CoherenceResult) => {
    if (option === 'a') {
      const [suggestedMin] = result.suggestedBpmRange;
      setTempo(suggestedMin);
    }
    dismissCoherenceResult?.();
  }, [setTempo, dismissCoherenceResult]);

  // i18n labels pour PromptStateBadge
  const labelReady = t.musical.promptReady;
  const labelEmpty = t.musical.promptEmpty;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {coherenceResult && (
        <RhythmicCoherenceDialog
          result={coherenceResult}
          onApply={handleCoherenceApply}
          onSkip={() => dismissCoherenceResult?.()}
        />
      )}
    <div
      role="toolbar"
      aria-label="Musical generation controls"
      className="flex items-center gap-3 px-4 py-2 border-b border-fluent-border"
      style={{
        backgroundColor: 'var(--bg-elev-1, var(--bg-app))',
        minHeight: 40,
        flexWrap: 'wrap',
        userSelect: 'none',
      }}
    >
      {/* ── State ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <MusicNote2Regular
          style={{ width: 15, height: 15, color: 'var(--lcars-violet, #a86fdf)', flexShrink: 0 }}
          aria-hidden
        />
        <PromptStateBadge hasPrompt={hasPrompt} labelReady={labelReady} labelEmpty={labelEmpty} />
      </div>

      <Divider />

      {/* ── Prompt actions ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* Auto-Suggest */}
        <Tooltip title={autoSuggestTooltip}>
          <button
            onClick={handleAutoSuggest}
            disabled={autoSuggestDisabled}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
            style={{
              background: autoSuggestDisabled
                ? 'transparent'
                : 'color-mix(in srgb, var(--accent-color) 10%, transparent)',
              color: autoSuggestDisabled ? 'var(--text-secondary)' : 'var(--accent-color)',
              border: `1px solid ${
                autoSuggestDisabled
                  ? 'var(--border-color)'
                  : 'color-mix(in srgb, var(--accent-color) 30%, transparent)'
              }`,
              cursor: autoSuggestDisabled ? 'not-allowed' : 'pointer',
              opacity: autoSuggestDisabled ? 0.5 : 1,
            }}
            aria-label={t.tooltips.generateMusical}
          >
            {isGeneratingMusicalPrompt ? (
              <Spinner size="tiny" aria-label="Génération en cours…" />
            ) : (
              <SparkleRegular style={{ width: 13, height: 13 }} />
            )}
            <span className="hidden sm:inline">Auto-Suggest</span>
          </button>
        </Tooltip>

        {/* Copy */}
        <Tooltip title={copied ? 'Copié !' : 'Copier le prompt'}>
          <button
            onClick={handleCopy}
            disabled={!hasPrompt || busy}
            className="flex items-center justify-center rounded-md transition-all"
            style={{
              minWidth: 44,
              minHeight: 44,
              color: copied ? 'var(--lcars-cyan, #4f98a3)' : 'var(--text-secondary)',
              opacity: hasPrompt ? 1 : 0.35,
              cursor: hasPrompt ? 'pointer' : 'not-allowed',
            }}
            aria-label="Copier le prompt"
          >
            <CopyRegular style={{ width: 15, height: 15 }} />
          </button>
        </Tooltip>
        {/* sr-only live region pour feedback "Copié" */}
        <span
          aria-live="polite"
          className="sr-only"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
        >
          {copied ? 'Prompt copié dans le presse-papiers' : ''}
        </span>

        {/* Export JSON */}
        <Tooltip title="Exporter le prompt en JSON">
          <button
            onClick={handleExport}
            disabled={!hasPrompt || busy}
            className="flex items-center justify-center rounded-md transition-all"
            style={{
              minWidth: 44,
              minHeight: 44,
              color: 'var(--text-secondary)',
              opacity: hasPrompt ? 1 : 0.35,
              cursor: hasPrompt ? 'pointer' : 'not-allowed',
            }}
            aria-label="Exporter le prompt en JSON"
          >
            <ArrowDownloadRegular style={{ width: 15, height: 15 }} />
          </button>
        </Tooltip>

        {/* Reset */}
        <Tooltip title="Réinitialiser les champs musicaux">
          <button
            onClick={handleReset}
            disabled={busy}
            className="flex items-center justify-center rounded-md transition-all"
            style={{
              minWidth: 44,
              minHeight: 44,
              color: 'var(--text-secondary)',
              opacity: busy ? 0.35 : 0.7,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
            aria-label="Réinitialiser le formulaire musical"
          >
            <ArrowResetRegular style={{ width: 15, height: 15 }} />
          </button>
        </Tooltip>
      </div>

      <Divider />

      {/* ── Suno generate ─────────────────────────────────────────────── */}
      <Tooltip title={hasPrompt ? 'Générer de la musique avec Suno' : 'Générez d\'abord un prompt'}>
        <button
          onClick={handleGenerateWithSuno}
          disabled={!hasPrompt || busy}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all"
          style={{
            background:
              hasPrompt && !busy
                ? 'var(--lcars-amber, #e8af34)'
                : 'color-mix(in srgb, var(--lcars-amber, #e8af34) 15%, transparent)',
            color: hasPrompt && !busy
              ? 'var(--color-text-inverse, #1a1a1a)'
              : 'var(--text-secondary)',
            border: 'none',
            cursor: hasPrompt && !busy ? 'pointer' : 'not-allowed',
            opacity: hasPrompt ? 1 : 0.4,
            minHeight: 32,
          }}
          aria-label="Générer de la musique avec Suno"
          aria-busy={isSunoGenerating}
        >
          {isSunoGenerating ? (
            <Spinner size="tiny" aria-label="Génération Suno en cours…" />
          ) : (
            <PlayCircleRegular style={{ width: 14, height: 14 }} />
          )}
          <span>
            {status.phase === 'polling'
              ? `Génération… ${Math.round(((status as { elapsed?: number }).elapsed ?? 0) / 1000)}s`
              : isSunoGenerating
              ? 'Génération…'
              : 'Generate Music'}
          </span>
        </button>
      </Tooltip>

      {/* Suno error — message complet, non tronqué */}
      {status.phase === 'error' && (
        <div
          role="alert"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px]"
          style={{
            color: 'var(--accent-danger, var(--color-error, #a12c7b))',
            background: 'color-mix(in srgb, var(--accent-danger, var(--color-error, #a12c7b)) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-danger, var(--color-error, #a12c7b)) 25%, transparent)',
            maxWidth: 320,
            wordBreak: 'break-word',
          }}
        >
          <DismissCircleRegular style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span>{(status as { message?: string }).message ?? 'Erreur Suno'}</span>
        </div>
      )}

      {/* ── Completeness ─────────────────────────────────────────────── */}
      <div className="ml-auto hidden sm:flex items-center gap-2">
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Complétude
        </span>
        <CompletenessScore pct={pct} filled={filled} total={total} />
      </div>
    </div>
    </>
  );
});
