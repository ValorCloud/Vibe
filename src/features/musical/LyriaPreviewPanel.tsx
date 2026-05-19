/**
 * LyriaPreviewPanel.tsx
 * Fluent 2 panel: generate a 30-second Lyria 3 Clip preview from current lyrics + style.
 *
 * Props:
 *   lyrics                 — verbatim lyrics string from SongContext (passed silently to generation, not displayed)
 *   songTitle              — pre-fills the title field
 *   initialGenre           — genre from SongContext / MusicalParamsPanel
 *   initialMood            — mood from SongContext
 *   initialTempo           — tempo (number, BPM) from SongContext
 *   initialInstrumentation — instruments string from SongContext
 *   initialRhythm          — rhythm & groove description from SongContext
 *   initialNarrative       — narrative/mood description from SongContext
 *   initialMusicalPrompt   — full structured musical prompt from MusicalPromptBuilder (used as style override when set)
 *   onFullSong             — callback to escalate to full-song generation (LyriaFullSongPanel)
 *   onPromptReady          — called with the Lyria style string (no lyrics) when generation is triggered
 *                            → parent writes it into MusicalPromptBuilder's container
 *
 * Keyboard shortcuts (global, active when panel is mounted):
 *   Alt+A  — trigger generate (if not already generating)
 *
 * Design contract:
 *   lyrics / genre / mood / tempo / instrumentation / rhythm / narrative all come from SongContext — not displayed here.
 *   negativePrompt ("Avoid") is the only user-editable Lyria-specific field in this panel.
 *   vocalStyle is kept in local state for generation until relocated to its own section.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Field,
  Label,
  Spinner,
  Text,
  Badge,
  Divider,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Tooltip,
  tokens,
} from '@fluentui/react-components';
import {
  MusicNote220Regular,
  SparkleRegular,
  CheckmarkCircle20Filled,
  Info20Regular,
  Keyboard20Regular,
  LockClosed20Regular,
} from '@fluentui/react-icons';
import { generateAndPoll, getLyriaKPISnapshot } from '../../services/lyriaService';
import { parseLyriaError, type ParsedLyriaError } from '../../services/lyriaError';
import type { LyriaClip, LyriaStyleDescriptor, LyriaTaskStatus } from '../../types/lyria';
import { useLanguage } from '../../i18n';

// Client-side serializer — mirrors api/lyria/generate.ts styleDescriptorToString
function styleDescriptorToString(s: LyriaStyleDescriptor): string {
  const parts: string[] = [];
  if (s.genre) parts.push(s.genre);
  if (s.mood) parts.push(s.mood);
  if (s.tempo) parts.push(`${s.tempo} bpm`);
  if (s.instruments) parts.push(`instruments: ${s.instruments}`);
  if (s.vocalStyle) parts.push(`vocals: ${s.vocalStyle}`);
  if (s.era) parts.push(s.era); // reused for rhythm+narrative combined
  return parts.join(', ');
}

type LyriaPromptField = 'genre' | 'mood' | 'tempo' | 'instrumentation' | 'rhythm' | 'narrative';

interface LyriaPreviewPanelProps {
  lyrics: string;
  songTitle?: string;
  /** Provided by MusicalTab from SongContext — read-only inside this panel */
  initialGenre?: string;
  initialMood?: string;
  initialTempo?: number;
  initialInstrumentation?: string;
  initialRhythm?: string;
  initialNarrative?: string;
  /** Full structured musical prompt from MusicalPromptBuilder — used as style if set */
  initialMusicalPrompt?: string;
  onFullSong?: (clip: LyriaClip) => void;
  /** Called with the Lyria style string (no lyrics) right before generation starts */
  onPromptReady?: (stylePrompt: string) => void;
}

export const LyriaPreviewPanel: React.FC<LyriaPreviewPanelProps> = ({
  lyrics,
  songTitle = '',
  initialGenre = 'afrobeats',
  initialMood = '',
  initialTempo = 96,
  initialInstrumentation = '',
  initialRhythm = '',
  initialNarrative = '',
  initialMusicalPrompt = '',
  onFullSong,
  onPromptReady,
}) => {
  const { t } = useLanguage();
  const L = t.lyria;

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const [taskStatus, setTaskStatus] = useState<LyriaTaskStatus>({ phase: 'idle' });
  const [kpi, setKpi] = useState(getLyriaKPISnapshot());
  const [excludedPromptFields, setExcludedPromptFields] = useState<Set<LyriaPromptField>>(() => new Set());

  // vocalStyle: Lyria-specific, kept local until relocated to its own section
  const [vocalStyle] = useState('female lead, West African, smooth');
  const [negativePrompt, setNegativePrompt] = useState('');

  const isGenerating = taskStatus.phase === 'generating' || taskStatus.phase === 'polling';
  const doneClip = taskStatus.phase === 'done' ? taskStatus.clip : null;
  const hasLyrics = lyrics.trim().length > 0;

  const parsedError = useMemo<ParsedLyriaError | null>(
    () => (taskStatus.phase === 'error' ? parseLyriaError(new Error(taskStatus.message)) : null),
    [taskStatus],
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const isPromptFieldIncluded = useCallback(
    (field: LyriaPromptField) => !excludedPromptFields.has(field),
    [excludedPromptFields],
  );

  const removePromptField = useCallback((field: LyriaPromptField) => {
    setExcludedPromptFields(prev => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }, []);

  const { styleValue, styleString } = useMemo(() => {
    const rhythmNarrativeParts: string[] = [];
    if (isPromptFieldIncluded('rhythm') && initialRhythm) rhythmNarrativeParts.push(initialRhythm);
    if (isPromptFieldIncluded('narrative') && initialNarrative) rhythmNarrativeParts.push(initialNarrative);
    const eraField = rhythmNarrativeParts.join(' | ');

    const descriptor: LyriaStyleDescriptor = {
      ...(isPromptFieldIncluded('genre') && initialGenre ? { genre: initialGenre } : {}),
      ...(isPromptFieldIncluded('mood') && initialMood ? { mood: initialMood } : {}),
      ...(isPromptFieldIncluded('tempo') && initialTempo > 0 ? { tempo: initialTempo } : {}),
      ...(isPromptFieldIncluded('instrumentation') && initialInstrumentation ? { instruments: initialInstrumentation } : {}),
      ...(vocalStyle ? { vocalStyle } : {}),
      ...(eraField ? { era: eraField } : {}),
    };

    return {
      styleValue: descriptor,
      styleString: styleDescriptorToString(descriptor),
    };
  }, [
    isPromptFieldIncluded,
    initialGenre,
    initialMood,
    initialTempo,
    initialInstrumentation,
    initialRhythm,
    initialNarrative,
    vocalStyle,
  ]);

  useEffect(() => {
    if (hasLyrics && styleString) {
      onPromptReady?.(styleString);
    }
  }, [hasLyrics, onPromptReady, styleString]);

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (isGenerating || !lyrics.trim()) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setTaskStatus({ phase: 'generating' });

    // Push style prompt (no lyrics) to MusicalPromptBuilder container
    onPromptReady?.(styleString);

    const baseParams = {
      lyrics,
      style: styleValue,
      title: songTitle,
      mode: 'clip' as const,
    };
    const params = negativePrompt ? { ...baseParams, negativePrompt } : baseParams;

    try {
      setTaskStatus({ phase: 'polling', elapsed: 0 });
      const clip = await generateAndPoll(
        params,
        { intervalMs: 2_000, timeoutMs: 90_000, signal },
      );
      if (!signal.aborted) {
        setTaskStatus({ phase: 'done', clip });
        setKpi(getLyriaKPISnapshot());
      }
    } catch (err) {
      if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
      const message = err instanceof Error ? err.message : String(err);
      if (mountedRef.current) {
        setTaskStatus({ phase: 'error', message });
        setKpi(getLyriaKPISnapshot());
      }
    }
  }, [
    isGenerating, lyrics, initialGenre, initialMood, initialTempo,
    styleValue, styleString, negativePrompt, songTitle, onPromptReady,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'a' && !e.defaultPrevented) {
        e.preventDefault();
        void handleGenerate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleGenerate]);

  const renderPromptBadge = (
    field: LyriaPromptField,
    ariaLabel: string,
    content: React.ReactNode,
    color: 'brand' | 'informative' | 'subtle',
  ) => {
    if (!isPromptFieldIncluded(field)) return null;
    return (
      <Badge appearance="tint" color={color} size="small">
        <span tabIndex={0} aria-label={ariaLabel}>{content}</span>
        <button
          type="button"
          aria-label={`Remove ${field} from Lyria prompt`}
          onClick={(event) => {
            event.stopPropagation();
            removePromptField(field);
          }}
          style={{
            marginLeft: 4,
            border: 0,
            padding: 0,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </Badge>
    );
  };

  const hasVisiblePromptParams = Boolean(
    (initialGenre && isPromptFieldIncluded('genre')) ||
    (initialMood && isPromptFieldIncluded('mood')) ||
    (initialTempo > 0 && isPromptFieldIncluded('tempo')) ||
    (initialInstrumentation && isPromptFieldIncluded('instrumentation')) ||
    (initialRhythm && isPromptFieldIncluded('rhythm')) ||
    (initialNarrative && isPromptFieldIncluded('narrative')) ||
    initialMusicalPrompt,
  );

  return (
    <Card
      style={{
        padding: tokens.spacingVerticalL,
        gap: tokens.spacingVerticalM,
        display: 'flex',
        flexDirection: 'column',
        background: tokens.colorNeutralBackground2,
      }}
    >
      {/* Header */}
      <CardHeader
        image={
          <MusicNote220Regular
            style={{ color: tokens.colorBrandForeground1, fontSize: 20 }}
          />
        }
        header={
          <Text weight="semibold" size={400}>
            Lyria 3 — Preview 30''
          </Text>
        }
        description={
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
            <Badge appearance="tint" color="success" size="small">
              Google DeepMind
            </Badge>
            <Badge appearance="tint" color="warning" size="small">
              AI/A7
            </Badge>
            <Tooltip content={L?.shortcutTooltip ?? 'Alt+A to generate quickly'} relationship="label">
              <Badge
                appearance="ghost"
                size="small"
                style={{
                  cursor: 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  color: tokens.colorNeutralForeground3,
                }}
              >
                <Keyboard20Regular style={{ fontSize: 11 }} />
                Alt+A
              </Badge>
            </Tooltip>
          </div>
        }
        action={
          <Tooltip
            content={L?.infoTooltip ?? 'Generates a ~30s audio clip based on your lyrics and musical style. Engine: Lyria 3 Clip via Gemini API. SynthID watermarked audio.'}
            relationship="label"
          >
            <Info20Regular style={{ color: tokens.colorNeutralForeground3 }} />
          </Tooltip>
        }
      />

      <Divider />

      {/* ── Musical params (read-only — edit in MusicalParamsPanel) ─── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacingVerticalXS,
          padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
          background: tokens.colorNeutralBackground3,
          borderRadius: tokens.borderRadiusMedium,
          border: `1px solid ${tokens.colorNeutralStroke2}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacingHorizontalXS,
            marginBottom: tokens.spacingVerticalXXS,
          }}
        >
          <LockClosed20Regular style={{ fontSize: 13, color: tokens.colorNeutralForeground3 }} />
          <Text size={100} style={{ color: tokens.colorNeutralForeground3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {L?.musicalParamsLabel ?? 'MUSICAL PARAMS (FROM MUSICALPARAMSPANEL)'}
          </Text>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS }}>
          {initialGenre && renderPromptBadge('genre', `Genre: ${initialGenre}`, <>🎵 {initialGenre}</>, 'brand')}
          {initialMood && renderPromptBadge('mood', `Mood: ${initialMood}`, <>🌈 {initialMood}</>, 'informative')}
          {initialTempo > 0 && renderPromptBadge('tempo', `Tempo: ${initialTempo} BPM`, <>♩ {initialTempo} BPM</>, 'subtle')}
          {initialInstrumentation && renderPromptBadge('instrumentation', `Instrumentation: ${initialInstrumentation}`, <>🎸 {initialInstrumentation}</>, 'subtle')}
          {initialRhythm && renderPromptBadge('rhythm', `Rhythm: ${initialRhythm}`, <>🥁 {initialRhythm.slice(0, 60)}{initialRhythm.length > 60 ? '…' : ''}</>, 'subtle')}
          {initialNarrative && renderPromptBadge('narrative', `Narrative: ${initialNarrative}`, <>📖 {initialNarrative.slice(0, 60)}{initialNarrative.length > 60 ? '…' : ''}</>, 'subtle')}
          {initialMusicalPrompt && (
            <Badge appearance="tint" color="success" size="small">
              <span tabIndex={0} aria-label="Full musical prompt active">✨ Full prompt active</span>
            </Badge>
          )}
          {!hasVisiblePromptParams && (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {L?.noParams ?? 'No params set — configure them in the musical params panel above.'}
            </Text>
          )}
        </div>
      </div>

      {/* Avoid / Negative prompt — only Lyria-specific editable field */}
      <Field
        label={L?.negativePrompt ?? 'Avoid (optional)'}
        {...(L?.negativePromptHint ? { hint: L.negativePromptHint } : {})}
      >
        <Input
          value={negativePrompt}
          onChange={(_, d) => setNegativePrompt(d.value)}
          placeholder={L?.negativePromptPlaceholder ?? 'e.g. heavy metal, distorted guitar, screaming'}
        />
      </Field>

      {/* Generate button — Tooltip surfaces the disabled reason for accessibility */}
      <Tooltip
        content={
          !hasLyrics
            ? (L?.lyricsRequiredHint ?? 'Lyria needs at least one line of lyrics to generate audio.')
            : (L?.shortcutTooltip ?? 'Alt+A to generate quickly')
        }
        relationship="label"
      >
        <Button
          appearance="primary"
          icon={isGenerating ? <Spinner size="tiny" /> : <SparkleRegular />}
          disabled={isGenerating || !hasLyrics}
          onClick={() => void handleGenerate()}
          style={{ alignSelf: 'flex-start' }}
        >
          {isGenerating ? (L?.generating ?? 'Generating…') : (L?.generatePreview ?? "Generate preview 30''")}
        </Button>
      </Tooltip>

      {!hasLyrics && !isGenerating && (
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          {L?.lyricsRequired ?? 'Write some lyrics in the editor first.'}
        </Text>
      )}

      {/* Status / result — Fluent MessageBar with actionable hint per error class */}
      {parsedError && (() => {
        const intent =
          parsedError.kind === 'rateLimit' ? 'warning' :
          parsedError.kind === 'timeout' ? 'warning' :
          'error';
        const heading =
          parsedError.kind === 'auth' ? (L?.errorAuth ?? 'Unauthorized request.') :
          parsedError.kind === 'rateLimit' ? (L?.errorRateLimit ?? 'Rate limited.') :
          parsedError.kind === 'timeout' ? (L?.errorTimeout ?? 'Lyria took too long to respond.') :
          parsedError.kind === 'server' ? (L?.errorServer ?? 'Lyria backend error.') :
          parsedError.kind === 'network' ? (L?.errorNetwork ?? 'Could not reach the Lyria proxy.') :
          (L?.errorTitle ?? 'Generation failed');
        const hint =
          parsedError.kind === 'auth' ? (L?.errorAuthHint ?? '') :
          parsedError.kind === 'rateLimit' ? (L?.errorRateLimitHint ?? '') :
          parsedError.kind === 'timeout' ? (L?.errorTimeoutHint ?? '') :
          parsedError.kind === 'server' ? (L?.errorServerHint ?? '') :
          parsedError.kind === 'network' ? (L?.errorNetworkHint ?? '') :
          '';
        return (
          <MessageBar intent={intent} layout="multiline" politeness="assertive">
            <MessageBarBody>
              <MessageBarTitle>{L?.errorTitle ?? 'Generation failed'}</MessageBarTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS }}>
                <Text size={200}>{heading}</Text>
                {hint && (
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {hint}
                  </Text>
                )}
                <details style={{ marginTop: tokens.spacingVerticalXXS }}>
                  <summary style={{ cursor: 'pointer', color: tokens.colorNeutralForeground3, fontSize: 12 }}>
                    Details
                  </summary>
                  <Text
                    size={100}
                    font="monospace"
                    style={{ color: tokens.colorNeutralForeground3, wordBreak: 'break-all' }}
                  >
                    {parsedError.raw}
                  </Text>
                </details>
              </div>
            </MessageBarBody>
          </MessageBar>
        );
      })()}

      {doneClip && (
        <Card
          style={{
            background: tokens.colorNeutralBackground3,
            padding: tokens.spacingVerticalM,
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacingVerticalS,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacingHorizontalS,
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
              <CheckmarkCircle20Filled style={{ color: tokens.colorStatusSuccessForeground1 }} />
              <Text weight="semibold" size={300}>
                {doneClip.title}
              </Text>
            </div>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS }}>
              <Badge appearance="tint" color="informative" size="small">
                🛡️ SynthID
              </Badge>
              {kpi.lastGenerationMs && (
                <Badge appearance="ghost" size="small">
                  {kpi.lastGenerationMs}ms
                </Badge>
              )}
            </div>
          </div>

          {doneClip.audioUrl && (
            <audio
              src={doneClip.audioUrl}
              aria-label={`Preview audio — ${doneClip.title}`}
              style={{ width: '100%' }}
              controls
            />
          )}

          {onFullSong && (
            <Button
              appearance="outline"
              size="small"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => onFullSong(doneClip)}
            >
              {L?.escalate ?? 'Escalate to full song (Lyria 3 Pro)'}
            </Button>
          )}
        </Card>
      )}

      {/* KPI footer */}
      <div
        style={{
          display: 'flex',
          gap: tokens.spacingHorizontalM,
          marginTop: tokens.spacingVerticalXS,
        }}
      >
        <Label size="small" style={{ color: tokens.colorNeutralForeground3 }}>
          {(L?.successCount ?? 'Success: {n}').replace('{n}', String(kpi.successCount))}
        </Label>
        <Label size="small" style={{ color: tokens.colorNeutralForeground3 }}>
          {(L?.errorCount ?? 'Errors: {n}').replace('{n}', String(kpi.errorCount))}
        </Label>
        {kpi.lastError && (
          <Label size="small" style={{ color: tokens.colorStatusDangerForeground1 }}>
            {(L?.lastError ?? 'Last error: {msg}').replace('{msg}', kpi.lastError)}
          </Label>
        )}
      </div>
    </Card>
  );
};

export default LyriaPreviewPanel;
