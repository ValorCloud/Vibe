/**
 * LyriaPreviewPanel — Lyria 3 Clip preview (30s)
 *
 * Key contracts:
 *  - styleString is built locally from props; it NEVER writes to SongContext.musicalPrompt.
 *  - musicalPrompt (AI, from MusicalPromptBuilder) and Lyria styleString are independent outputs.
 *  - onPromptReady is called ONLY when the user clicks "Generate" (not on every param change).
 *  - styleDescriptorToString deduplicates tokens via Set to prevent e.g. "Afrobeat, …, Afrobeat".
 *  - Removable param tags use Badge + native <button> for reliable dismiss interaction in JSDOM.
 *  - KPI stats are collapsed inside <details> to reduce visual noise.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  Field,
  Input,
  Label,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Text,
  Tooltip,
  tokens,
} from '@fluentui/react-components';
import {
  CheckmarkCircle20Filled,
  Dismiss12Regular,
  Info20Regular,
  Keyboard20Regular,
  LockClosed20Regular,
  MusicNote220Regular,
  SparkleRegular,
} from '@fluentui/react-icons';
import { generateAndPoll, getLyriaKPISnapshot } from '../../services/lyriaService';
import { parseLyriaError, type ParsedLyriaError } from '../../services/lyriaError';
import type { LyriaClip, LyriaStyleDescriptor, LyriaTaskStatus } from '../../types/lyria';
import { useLanguage } from '../../i18n';

/** Serializes a LyriaStyleDescriptor to a comma-separated style string with deduplication. */
function styleDescriptorToString(s: Partial<LyriaStyleDescriptor>): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  const push = (raw: string) => {
    const key = raw.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      parts.push(raw.trim());
    }
  };
  if (s.genre)      push(s.genre);
  if (s.mood)       push(s.mood);
  if (s.tempo)      push(`${s.tempo} bpm`);
  if (s.instruments) push(`instruments: ${s.instruments}`);
  if (s.vocalStyle) push(`vocals: ${s.vocalStyle}`);
  if (s.era)        push(s.era);
  return parts.join(', ');
}

type LyriaPromptField = 'genre' | 'mood' | 'tempo' | 'instrumentation' | 'rhythm' | 'narrative';

interface LyriaPreviewPanelProps {
  lyrics: string;
  songTitle?: string;
  initialGenre?: string;
  initialMood?: string;
  initialTempo?: number;
  initialInstrumentation?: string;
  initialRhythm?: string;
  initialNarrative?: string;
  /** AI musical prompt from MusicalPromptBuilder — read-only, shown as badge only. */
  initialMusicalPrompt?: string;
  onFullSong?: (clip: LyriaClip) => void;
  /** Called with the Lyria style string ONLY when user explicitly triggers generation. */
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

  const abortRef   = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const [taskStatus, setTaskStatus]     = useState<LyriaTaskStatus>({ phase: 'idle' });
  const [kpi, setKpi]                   = useState(getLyriaKPISnapshot());
  const [excludedFields, setExcluded]   = useState<Set<LyriaPromptField>>(() => new Set());
  const [vocalStyle]                    = useState('female lead, West African, smooth');
  const [negativePrompt, setNegative]   = useState('');

  const isGenerating = taskStatus.phase === 'generating' || taskStatus.phase === 'polling';
  const doneClip     = taskStatus.phase === 'done' ? taskStatus.clip : null;
  const hasLyrics    = lyrics.trim().length > 0;

  const parsedError = useMemo<ParsedLyriaError | null>(
    () => (taskStatus.phase === 'error' ? parseLyriaError(new Error(taskStatus.message)) : null),
    [taskStatus],
  );

  useEffect(() => () => {
    mountedRef.current = false;
    abortRef.current?.abort();
  }, []);

  const included = useCallback(
    (f: LyriaPromptField) => !excludedFields.has(f),
    [excludedFields],
  );

  const removeField = useCallback((f: LyriaPromptField) => {
    setExcluded(prev => { const n = new Set(prev); n.add(f); return n; });
  }, []);

  const styleString = useMemo(() => {
    const eraParts: string[] = [];
    if (included('rhythm')    && initialRhythm)    eraParts.push(initialRhythm);
    if (included('narrative') && initialNarrative) eraParts.push(initialNarrative);

    return styleDescriptorToString({
      ...(included('genre')           && initialGenre          ? { genre: initialGenre }                   : {}),
      ...(included('mood')            && initialMood           ? { mood: initialMood }                     : {}),
      ...(included('tempo')           && initialTempo > 0      ? { tempo: initialTempo }                   : {}),
      ...(included('instrumentation') && initialInstrumentation ? { instruments: initialInstrumentation } : {}),
      ...(vocalStyle                                           ? { vocalStyle }                            : {}),
      ...(eraParts.length > 0                                  ? { era: eraParts.join(' | ') }             : {}),
    });
  }, [included, initialGenre, initialMood, initialTempo, initialInstrumentation, initialRhythm, initialNarrative, vocalStyle]);

  // NOTE: No mount/update useEffect calling onPromptReady.
  // onPromptReady fires ONLY in handleGenerate (explicit user action).

  const handleGenerate = useCallback(async () => {
    if (isGenerating || !lyrics.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setTaskStatus({ phase: 'generating' });
    // Surface Lyria style string to parent only at generation time
    onPromptReady?.(styleString);
    const params = {
      lyrics,
      style: styleString,
      title: songTitle,
      mode: 'clip' as const,
      ...(negativePrompt ? { negativePrompt } : {}),
    };
    try {
      setTaskStatus({ phase: 'polling', elapsed: 0 });
      const clip = await generateAndPoll(params, { intervalMs: 2_000, timeoutMs: 90_000, signal });
      if (!signal.aborted) {
        setTaskStatus({ phase: 'done', clip });
        setKpi(getLyriaKPISnapshot());
      }
    } catch (err) {
      if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
      if (mountedRef.current) {
        setTaskStatus({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
        setKpi(getLyriaKPISnapshot());
      }
    }
  }, [isGenerating, lyrics, styleString, negativePrompt, songTitle, onPromptReady]);

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

  /**
   * Renders a dismissible param badge using Badge + native <button>.
   * Native <button> is required for reliable getByRole('button', { name }) in tests.
   */
  const renderParamBadge = (field: LyriaPromptField, label: string) => {
    if (!included(field)) return null;
    return (
      <span
        key={field}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
      >
        <Badge
          appearance="tint"
          size="small"
          aria-label={`${field.charAt(0).toUpperCase() + field.slice(1)}: ${label.replace(/^[^\w]+/, '').trim()}`}
        >
          {label}
        </Badge>
        <button
          type="button"
          aria-label={`Remove ${field}`}
          onClick={() => removeField(field)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 2px',
            display: 'inline-flex',
            alignItems: 'center',
            color: tokens.colorNeutralForeground3,
            borderRadius: tokens.borderRadiusSmall,
          }}
        >
          <Dismiss12Regular />
        </button>
      </span>
    );
  };

  const hasVisibleParams = Boolean(
    (initialGenre          && included('genre'))          ||
    (initialMood           && included('mood'))           ||
    (initialTempo > 0      && included('tempo'))          ||
    (initialInstrumentation && included('instrumentation')) ||
    (initialRhythm         && included('rhythm'))         ||
    (initialNarrative      && included('narrative'))      ||
    initialMusicalPrompt,
  );

  return (
    <Card style={{ padding: tokens.spacingVerticalL, gap: tokens.spacingVerticalM, display: 'flex', flexDirection: 'column', background: tokens.colorNeutralBackground2 }}>

      {/* ── Header ── */}
      <CardHeader
        image={<MusicNote220Regular style={{ color: tokens.colorBrandForeground1, fontSize: 20 }} />}
        header={<Text weight="semibold" size={400}>Lyria 3 — Preview 30''</Text>}
        description={
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
            <Badge appearance="tint" color="success" size="small">Google DeepMind</Badge>
            <Badge appearance="tint" color="warning" size="small">AI/A7</Badge>
            <Tooltip content={L?.shortcutTooltip ?? 'Alt+A to generate quickly'} relationship="label">
              <Badge appearance="ghost" size="small" style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: 3, color: tokens.colorNeutralForeground3 }}>
                <Keyboard20Regular style={{ fontSize: 11 }} /> Alt+A
              </Badge>
            </Tooltip>
          </div>
        }
        action={
          <Tooltip content={L?.infoTooltip ?? 'Generates a ~30s audio clip. Engine: Lyria 3 Clip via Gemini API. SynthID watermarked.'} relationship="label">
            <Info20Regular style={{ color: tokens.colorNeutralForeground3 }} />
          </Tooltip>
        }
      />

      <Divider />

      {/* ── Params (read-only — edit in MusicalParamsPanel) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS, padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`, background: tokens.colorNeutralBackground3, borderRadius: tokens.borderRadiusMedium, border: `1px solid ${tokens.colorNeutralStroke2}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, marginBottom: tokens.spacingVerticalXXS }}>
          <LockClosed20Regular style={{ fontSize: 13, color: tokens.colorNeutralForeground3 }} />
          <Text size={100} style={{ color: tokens.colorNeutralForeground3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {L?.musicalParamsLabel ?? 'MUSICAL PARAMS (FROM MUSICALPARAMSPANEL)'}
          </Text>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS, alignItems: 'center' }}>
          {initialGenre           && renderParamBadge('genre',           `🎵 ${initialGenre}`)}
          {initialMood            && renderParamBadge('mood',            `🌈 ${initialMood}`)}
          {initialTempo > 0       && renderParamBadge('tempo',           `♩ ${initialTempo} BPM`)}
          {initialInstrumentation && renderParamBadge('instrumentation', `🎸 ${initialInstrumentation}`)}
          {initialRhythm          && renderParamBadge('rhythm',          `🥁 ${initialRhythm.slice(0, 60)}${initialRhythm.length > 60 ? '…' : ''}`)}
          {initialNarrative       && renderParamBadge('narrative',       `📖 ${initialNarrative.slice(0, 60)}${initialNarrative.length > 60 ? '…' : ''}`)}
        </div>

        {initialMusicalPrompt && (
          <Badge appearance="tint" color="success" size="small" style={{ alignSelf: 'flex-start', marginTop: tokens.spacingVerticalXXS }}>
            ✨ Full prompt active
          </Badge>
        )}
        {!hasVisibleParams && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {L?.noParams ?? 'No params set — configure them in the musical params panel above.'}
          </Text>
        )}
      </div>

      {/* ── Negative prompt ── */}
      <Field label={L?.negativePrompt ?? 'Avoid (optional)'}>
        <Input
          value={negativePrompt}
          onChange={(_, d) => setNegative(d.value)}
          placeholder={L?.negativePromptPlaceholder ?? 'e.g. heavy metal, distorted guitar, screaming'}
        />
      </Field>

      {/* ── Generate button ── */}
      <Tooltip
        content={!hasLyrics ? (L?.lyricsRequiredHint ?? 'Lyria needs at least one line of lyrics.') : (L?.shortcutTooltip ?? 'Alt+A to generate quickly')}
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

      {/* ── Error ── */}
      {parsedError && (() => {
        const intent = parsedError.kind === 'rateLimit' || parsedError.kind === 'timeout' ? 'warning' : 'error';
        const heading =
          parsedError.kind === 'auth'      ? (L?.errorAuth      ?? 'Unauthorized request.')              :
          parsedError.kind === 'rateLimit' ? (L?.errorRateLimit ?? 'Rate limited.')                      :
          parsedError.kind === 'timeout'   ? (L?.errorTimeout   ?? 'Lyria took too long to respond.')    :
          parsedError.kind === 'server'    ? (L?.errorServer    ?? 'Lyria backend error.')                :
          parsedError.kind === 'network'   ? (L?.errorNetwork   ?? 'Could not reach the Lyria proxy.')   :
          (L?.errorTitle ?? 'Generation failed');
        return (
          <MessageBar intent={intent} layout="multiline" politeness="assertive">
            <MessageBarBody>
              <MessageBarTitle>{L?.errorTitle ?? 'Generation failed'}</MessageBarTitle>
              <Text size={200}>{heading}</Text>
              <details style={{ marginTop: tokens.spacingVerticalXXS }}>
                <summary style={{ cursor: 'pointer', color: tokens.colorNeutralForeground3, fontSize: 12 }}>Details</summary>
                <Text size={100} font="monospace" style={{ color: tokens.colorNeutralForeground3, wordBreak: 'break-all' }}>
                  {parsedError.raw}
                </Text>
              </details>
            </MessageBarBody>
          </MessageBar>
        );
      })()}

      {/* ── Done clip ── */}
      {doneClip && (
        <Card style={{ background: tokens.colorNeutralBackground3, padding: tokens.spacingVerticalM, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
              <CheckmarkCircle20Filled style={{ color: tokens.colorStatusSuccessForeground1 }} />
              <Text weight="semibold" size={300}>{doneClip.title}</Text>
            </div>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS }}>
              <Badge appearance="tint" color="informative" size="small">🛡️ SynthID</Badge>
              {kpi.lastGenerationMs && <Badge appearance="ghost" size="small">{kpi.lastGenerationMs}ms</Badge>}
            </div>
          </div>
          {doneClip.audioUrl && (
            <audio src={doneClip.audioUrl} aria-label={`Preview — ${doneClip.title}`} style={{ width: '100%' }} controls />
          )}
          {onFullSong && (
            <Button appearance="outline" size="small" style={{ alignSelf: 'flex-start' }} onClick={() => onFullSong(doneClip)}>
              {L?.escalate ?? 'Escalate to full song (Lyria 3 Pro)'}
            </Button>
          )}
        </Card>
      )}

      {/* ── KPI (collapsed) ── */}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 11, color: tokens.colorNeutralForeground3, userSelect: 'none' }}>Stats</summary>
        <div style={{ display: 'flex', gap: tokens.spacingHorizontalM, marginTop: tokens.spacingVerticalXS }}>
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
      </details>

    </Card>
  );
};

export default LyriaPreviewPanel;
