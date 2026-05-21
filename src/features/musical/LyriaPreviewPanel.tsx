/**
 * LyriaPreviewPanel — Lyria 3 Clip preview (30s)
 *
 * Sync contract (v1.31.0.7):
 *  - Props are LIVE (not initial*): genre, mood, tempo, instrumentation, rhythm, narrative.
 *    Any change in MusicalParamsPanel is immediately reflected here.
 *  - Removing a badge calls onParamRemoved(field) → parent clears SongContext → params panel deselects.
 *  - musicalPrompt (AI) is read-only; displayed as "Full prompt active" badge.
 *  - onPromptReady fires ONLY at Generate time (explicit user action).
 *  - Lyria prompt structure mirrors MUSICAL PROMPT: "Style: …, Mood: …, BPM: …, Instrumentation: …, Vocals: …"
 *  - Global tags (MELODIC, Wide stereo field, Global Crossover, Commercial release) always appended, dismissible.
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

/** Global production tags appended to every Lyria prompt — removable by user. */
const GLOBAL_TAGS = ['MELODIC', 'Wide stereo field', 'Global Crossover', 'Commercial release'] as const;
type GlobalTag = typeof GLOBAL_TAGS[number];

/**
 * Serializes a LyriaStyleDescriptor to a structured, labeled style string
 * matching the MUSICAL PROMPT format:
 *   "Style: Afrobeat, Mood: dark, tense, BPM: 100, Instrumentation: …, Vocals: …"
 */
function styleDescriptorToString(
  s: Partial<LyriaStyleDescriptor>,
  globalTags: GlobalTag[],
): string {
  const seen = new Set<string>();
  const segments: string[] = [];

  const addSegment = (label: string, value: string) => {
    const key = value.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      segments.push(`${label}: ${value.trim()}`);
    }
  };

  if (s.genre)       addSegment('Style', s.genre);
  if (s.mood)        addSegment('Mood', s.mood);
  if (s.tempo)       addSegment('BPM', String(s.tempo));
  if (s.instruments) addSegment('Instrumentation', s.instruments);
  if (s.vocalStyle)  addSegment('Vocals', s.vocalStyle);
  if (s.era)         addSegment('Feel', s.era);

  for (const tag of globalTags) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      segments.push(tag);
    }
  }

  return segments.join(', ');
}

type LyriaPromptField = 'genre' | 'mood' | 'tempo' | 'instrumentation' | 'rhythm' | 'narrative';

export interface LyriaPreviewPanelProps {
  lyrics: string;
  songTitle?: string;
  genre?: string;
  mood?: string;
  tempo?: number;
  instrumentation?: string;
  rhythm?: string;
  narrative?: string;
  musicalPrompt?: string;
  onParamRemoved?: (field: LyriaPromptField) => void;
  onFullSong?: (clip: LyriaClip) => void;
  onPromptReady?: (stylePrompt: string) => void;
  /** @deprecated Use genre (live prop) instead. Will be removed in v1.32. */
  initialGenre?: string;
  /** @deprecated Use mood (live prop) instead. Will be removed in v1.32. */
  initialMood?: string;
  /** @deprecated Use tempo (live prop) instead. Will be removed in v1.32. */
  initialTempo?: number;
  /** @deprecated Use instrumentation (live prop) instead. Will be removed in v1.32. */
  initialInstrumentation?: string;
  /** @deprecated Use rhythm (live prop) instead. Will be removed in v1.32. */
  initialRhythm?: string;
  /** @deprecated Use narrative (live prop) instead. Will be removed in v1.32. */
  initialNarrative?: string;
  /** @deprecated Use musicalPrompt (live prop) instead. Will be removed in v1.32. */
  initialMusicalPrompt?: string;
}

export const LyriaPreviewPanel: React.FC<LyriaPreviewPanelProps> = ({
  lyrics,
  songTitle = '',
  genre: genreProp,
  mood: moodProp,
  tempo: tempoProp,
  instrumentation: instrumentationProp,
  rhythm: rhythmProp,
  narrative: narrativeProp,
  musicalPrompt: musicalPromptProp,
  onParamRemoved,
  onFullSong,
  onPromptReady,
  initialGenre,
  initialMood,
  initialTempo,
  initialInstrumentation,
  initialRhythm,
  initialNarrative,
  initialMusicalPrompt,
}) => {
  const { t } = useLanguage();
  const L = t.lyria;

  const activeGenre           = genreProp          ?? initialGenre          ?? 'afrobeats';
  const activeMood            = moodProp           ?? initialMood           ?? '';
  const activeTempo           = tempoProp          ?? initialTempo          ?? 96;
  const activeInstrumentation = instrumentationProp ?? initialInstrumentation ?? '';
  const activeRhythm          = rhythmProp         ?? initialRhythm         ?? '';
  const activeNarrative       = narrativeProp      ?? initialNarrative      ?? '';
  const activeMusicalPrompt   = musicalPromptProp  ?? initialMusicalPrompt  ?? '';

  const abortRef   = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const [taskStatus, setTaskStatus]         = useState<LyriaTaskStatus>({ phase: 'idle' });
  const [kpi, setKpi]                       = useState(getLyriaKPISnapshot());
  const [excludedFields, setExcluded]       = useState<Set<LyriaPromptField>>(() => new Set());
  const [excludedGlobal, setExcludedGlobal] = useState<Set<GlobalTag>>(() => new Set());
  // Constant vocal style — no state needed, value never changes at runtime
  const vocalStyle = 'female lead, West African, smooth';
  const [negativePrompt, setNegative]       = useState('');

  const isGenerating = taskStatus.phase === 'generating' || taskStatus.phase === 'polling';
  const doneClip     = taskStatus.phase === 'done' ? taskStatus.clip : null;
  const hasLyrics    = lyrics.trim().length > 0;

  const parsedError = useMemo<ParsedLyriaError | null>(
    () => (taskStatus.phase === 'error' ? parseLyriaError(new Error(taskStatus.message)) : null),
    [taskStatus],
  );

  useEffect(() => () => {
    // Abort any in-flight request before marking component as unmounted,
    // so the AbortError guard fires before the mountedRef guard.
    abortRef.current?.abort();
    mountedRef.current = false;
  }, []);

  useEffect(() => { setExcluded(prev => { const n = new Set(prev); n.delete('genre'); return n; }); }, [activeGenre]);
  useEffect(() => { setExcluded(prev => { const n = new Set(prev); n.delete('mood'); return n; }); }, [activeMood]);
  useEffect(() => { setExcluded(prev => { const n = new Set(prev); n.delete('tempo'); return n; }); }, [activeTempo]);
  useEffect(() => { setExcluded(prev => { const n = new Set(prev); n.delete('instrumentation'); return n; }); }, [activeInstrumentation]);
  useEffect(() => { setExcluded(prev => { const n = new Set(prev); n.delete('rhythm'); return n; }); }, [activeRhythm]);
  useEffect(() => { setExcluded(prev => { const n = new Set(prev); n.delete('narrative'); return n; }); }, [activeNarrative]);

  const included = useCallback(
    (f: LyriaPromptField) => !excludedFields.has(f),
    [excludedFields],
  );

  const removeField = useCallback((f: LyriaPromptField) => {
    setExcluded(prev => { const n = new Set(prev); n.add(f); return n; });
    onParamRemoved?.(f);
  }, [onParamRemoved]);

  const removeGlobalTag = useCallback((tag: GlobalTag) => {
    setExcludedGlobal(prev => { const n = new Set(prev); n.add(tag); return n; });
  }, []);

  const activeGlobalTags = useMemo(
    () => GLOBAL_TAGS.filter(tag => !excludedGlobal.has(tag)),
    [excludedGlobal],
  );

  const styleString = useMemo(() => {
    const eraParts: string[] = [];
    if (included('rhythm')    && activeRhythm)    eraParts.push(activeRhythm);
    if (included('narrative') && activeNarrative) eraParts.push(activeNarrative);

    return styleDescriptorToString(
      {
        ...(included('genre')           && activeGenre           ? { genre: activeGenre }                 : {}),
        ...(included('mood')            && activeMood            ? { mood: activeMood }                   : {}),
        ...(included('tempo')           && activeTempo > 0       ? { tempo: activeTempo }                 : {}),
        ...(included('instrumentation') && activeInstrumentation ? { instruments: activeInstrumentation } : {}),
        ...(vocalStyle                                           ? { vocalStyle }                         : {}),
        ...(eraParts.length > 0                                  ? { era: eraParts.join(' | ') }          : {}),
      },
      activeGlobalTags,
    );
  }, [included, activeGenre, activeMood, activeTempo, activeInstrumentation, activeRhythm, activeNarrative, vocalStyle, activeGlobalTags]);

  const handleGenerate = useCallback(async () => {
    if (isGenerating || !lyrics.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setTaskStatus({ phase: 'generating' });
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

  const renderParamBadge = (field: LyriaPromptField, label: string, value: string) => {
    if (!included(field)) return null;
    return (
      <span
        key={field}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
      >
        <Badge
          appearance="tint"
          size="small"
          role="status"
          aria-label={`${label}: ${value}`}
        >
          <Text size={100} style={{ color: tokens.colorNeutralForeground3, marginRight: 2 }}>{label}:</Text>
          {value}
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

  const renderGlobalTag = (tag: GlobalTag) => (
    <span
      key={tag}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
    >
      <Badge appearance="outline" size="small" color="informative">
        {tag}
      </Badge>
      <button
        type="button"
        aria-label={`Remove global tag: ${tag}`}
        onClick={() => removeGlobalTag(tag)}
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

  const hasVisibleParams = Boolean(
    (activeGenre           && included('genre'))           ||
    (activeMood            && included('mood'))            ||
    (activeTempo > 0       && included('tempo'))           ||
    (activeInstrumentation && included('instrumentation')) ||
    (activeRhythm          && included('rhythm'))          ||
    (activeNarrative       && included('narrative'))       ||
    activeMusicalPrompt,
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

      {/* ── Params (live — mirrors SongContext) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS, padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`, background: tokens.colorNeutralBackground3, borderRadius: tokens.borderRadiusMedium, border: `1px solid ${tokens.colorNeutralStroke2}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, marginBottom: tokens.spacingVerticalXXS }}>
          <LockClosed20Regular style={{ fontSize: 13, color: tokens.colorNeutralForeground3 }} />
          <Text size={100} style={{ color: tokens.colorNeutralForeground3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {L?.musicalParamsLabel ?? 'LYRIA PROMPT'}
          </Text>
        </div>

        {/* Structured param badges — Label: value */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS, alignItems: 'center' }}>
          {activeGenre           && renderParamBadge('genre',           'Style',           activeGenre)}
          {activeMood            && renderParamBadge('mood',            'Mood',            activeMood)}
          {activeTempo > 0       && renderParamBadge('tempo',           'BPM',             String(activeTempo))}
          {activeInstrumentation && renderParamBadge('instrumentation', 'Instrumentation', activeInstrumentation)}
          {activeRhythm          && renderParamBadge('rhythm',          'Rhythm',          activeRhythm.slice(0, 60) + (activeRhythm.length > 60 ? '\u2026' : ''))}
          {activeNarrative       && renderParamBadge('narrative',       'Narrative',       activeNarrative.slice(0, 60) + (activeNarrative.length > 60 ? '\u2026' : ''))}
        </div>

        {/* Global production tags — always appended, individually dismissible */}
        {activeGlobalTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS, alignItems: 'center', marginTop: tokens.spacingVerticalXXS, paddingTop: tokens.spacingVerticalXXS, borderTop: `1px solid ${tokens.colorNeutralStroke2}` }}>
            {activeGlobalTags.map(renderGlobalTag)}
          </div>
        )}

        {activeMusicalPrompt && (
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
          {isGenerating ? (L?.generating ?? 'Generating\u2026') : (L?.generatePreview ?? "Generate preview 30''")}
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
              <CheckmarkCircle20Filled style={{ color: tokens.colorStatusSuccessForeground1, fontSize: 20 }} />
              <Text weight="semibold">{doneClip.title}</Text>
            </div>
            {doneClip.synthIdWatermarked && (
              <Badge appearance="ghost" size="small" style={{ color: tokens.colorNeutralForeground3 }}>
                SynthID ✓
              </Badge>
            )}
          </div>
          <audio
            controls
            src={doneClip.audioUrl ?? undefined}
            style={{ width: '100%' }}
            aria-label={`Preview — ${doneClip.title}`}
          />
          {onFullSong && (
            <Button
              appearance="subtle"
              size="small"
              onClick={() => onFullSong(doneClip)}
              style={{ alignSelf: 'flex-start' }}
            >
              {L?.escalate ?? 'Escalate to full song (Lyria 3 Pro)'}
            </Button>
          )}
          <details>
            <summary style={{ cursor: 'pointer', color: tokens.colorNeutralForeground3, fontSize: 12 }}>Stats de génération Lyria</summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalXXS }}>
              {[
                { label: 'Requests', value: kpi.totalRequests },
                { label: 'Success', value: kpi.successCount },
                { label: 'Errors', value: kpi.errorCount },
                { label: 'Last gen', value: kpi.lastGenerationMs != null ? `${kpi.lastGenerationMs}ms` : '\u2014' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 48 }}>
                  <Text size={400} weight="semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Text>
                  <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{label}</Text>
                </div>
              ))}
            </div>
          </details>
        </Card>
      )}
    </Card>
  );
};
