/**
 * LyriaPreviewPanel.tsx
 * Fluent 2 panel: generate a 30-second Lyria 3 Clip preview from current lyrics + style.
 *
 * Props:
 *   lyrics              — verbatim lyrics string from the active song/section in the editor
 *   songTitle           — pre-fills the title field
 *   initialGenre        — genre from SongContext / MusicalParamsPanel
 *   initialMood         — mood from SongContext
 *   initialTempo        — tempo (number, BPM) from SongContext
 *   initialInstrumentation — instruments string from SongContext
 *   onFullSong          — callback to escalate to full-song generation (LyriaFullSongPanel)
 *
 * Keyboard shortcuts (global, active when panel is mounted):
 *   Alt+A  — trigger generate (if not already generating)
 *
 * Design contract:
 *   genre / mood / tempo / instrumentation come from SongContext via MusicalTab.
 *   They are displayed read-only in the panel — edit them in MusicalParamsPanel.
 *   vocalStyle and negativePrompt are Lyria-specific and remain local.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Field,
  Label,
  Spinner,
  Text,
  Textarea,
  Badge,
  Divider,
  Input,
  Tooltip,
  tokens,
} from '@fluentui/react-components';
import {
  MusicNote220Regular,
  Play20Filled,
  Pause20Filled,
  SparkleRegular,
  CheckmarkCircle20Filled,
  DismissCircle20Regular,
  Info20Regular,
  Keyboard20Regular,
  LockClosed20Regular,
} from '@fluentui/react-icons';
import { generateAndPoll, getLyriaKPISnapshot } from '../../services/lyriaService';
import type { LyriaClip, LyriaStyleDescriptor, LyriaTaskStatus } from '../../types/lyria';
import { useLanguage } from '../../i18n';

interface LyriaPreviewPanelProps {
  lyrics: string;
  songTitle?: string;
  /** Provided by MusicalTab from SongContext — read-only inside this panel */
  initialGenre?: string;
  initialMood?: string;
  initialTempo?: number;
  initialInstrumentation?: string;
  onFullSong?: (clip: LyriaClip) => void;
}

export const LyriaPreviewPanel: React.FC<LyriaPreviewPanelProps> = ({
  lyrics,
  songTitle = '',
  initialGenre = 'afrobeats',
  initialMood = '',
  initialTempo = 96,
  initialInstrumentation = '',
  onFullSong,
}) => {
  const { t } = useLanguage();
  const L = t.lyria;

  const audioRef = useRef<HTMLAudioElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [taskStatus, setTaskStatus] = useState<LyriaTaskStatus>({ phase: 'idle' });
  const [kpi, setKpi] = useState(getLyriaKPISnapshot());

  // Lyria-specific local state (not in SongContext)
  const [vocalStyle, setVocalStyle] = useState('female lead, West African, smooth');
  const [negativePrompt, setNegativePrompt] = useState('');

  const isGenerating = taskStatus.phase === 'generating' || taskStatus.phase === 'polling';
  const doneClip = taskStatus.phase === 'done' ? taskStatus.clip : null;

  // Abort polling on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Reset playback state when a new clip is generated
  useEffect(() => {
    if (doneClip) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [doneClip]);

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (isGenerating || !lyrics.trim()) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setTaskStatus({ phase: 'generating' });

    const style: LyriaStyleDescriptor = {
      genre: initialGenre,
      ...(initialMood ? { mood: initialMood } : {}),
      ...(initialTempo > 0 ? { tempo: initialTempo } : {}),
      ...(initialInstrumentation ? { instruments: initialInstrumentation } : {}),
      ...(vocalStyle ? { vocalStyle } : {}),
    };

    const baseParams = {
      lyrics,
      style,
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
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : String(err);
      setTaskStatus({ phase: 'error', message });
      setKpi(getLyriaKPISnapshot());
    }
  }, [isGenerating, lyrics, initialGenre, initialMood, initialTempo, initialInstrumentation, vocalStyle, negativePrompt, songTitle]);

  // Alt+A — trigger generate from anywhere on the page when this panel is mounted
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

  function togglePlayback(): void {
    if (!audioRef.current || !doneClip?.audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
  }

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
          {initialGenre && (
            <Badge appearance="tint" color="brand" size="small">
              🎵 {initialGenre}
            </Badge>
          )}
          {initialMood && (
            <Badge appearance="tint" color="informative" size="small">
              🌈 {initialMood}
            </Badge>
          )}
          {initialTempo > 0 && (
            <Badge appearance="tint" color="subtle" size="small">
              ♩ {initialTempo} BPM
            </Badge>
          )}
          {initialInstrumentation && (
            <Badge appearance="tint" color="subtle" size="small">
              🎸 {initialInstrumentation}
            </Badge>
          )}
          {!initialGenre && !initialMood && !initialTempo && !initialInstrumentation && (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {L?.noParams ?? 'No params set — configure them in the musical params panel above.'}
            </Text>
          )}
        </div>
      </div>

      {/* Vocal style (Lyria-specific, not in SongContext) */}
      <Field label={L?.vocalStyle ?? 'Vocal style'}>
        <Input
          value={vocalStyle}
          onChange={(_, d) => setVocalStyle(d.value)}
          placeholder={L?.vocalStylePlaceholder ?? 'e.g. female lead, smooth, West African'}
        />
      </Field>

      {/* Negative prompt */}
      <Field label={L?.negativePrompt ?? 'Avoid (optional)'}>
        <Input
          value={negativePrompt}
          onChange={(_, d) => setNegativePrompt(d.value)}
          placeholder={L?.negativePromptPlaceholder ?? 'e.g. heavy metal, distorted guitar, screaming'}
        />
      </Field>

      {/* Lyrics preview (read-only) */}
      <Field label={L?.injectedLyrics ?? 'Injected lyrics'}>
        <Textarea
          value={lyrics}
          readOnly
          resize="vertical"
          style={{ minHeight: 72, fontSize: tokens.fontSizeBase200 }}
        />
      </Field>

      {/* Generate button */}
      <Button
        appearance="primary"
        icon={isGenerating ? <Spinner size="tiny" /> : <SparkleRegular />}
        disabled={isGenerating || !lyrics.trim()}
        onClick={() => void handleGenerate()}
        style={{ alignSelf: 'flex-start' }}
      >
        {isGenerating ? (L?.generating ?? 'Generating…') : (L?.generatePreview ?? "Generate preview 30''")}
      </Button>

      {/* Status / result */}
      {taskStatus.phase === 'error' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacingHorizontalS,
            color: tokens.colorStatusDangerForeground1,
          }}
        >
          <DismissCircle20Regular />
          <Text size={200}>{taskStatus.message}</Text>
        </div>
      )}

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
          {/* Completion header */}
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

          {/* Audio player */}
          {doneClip.audioUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
              <Button
                appearance="subtle"
                icon={isPlaying ? <Pause20Filled /> : <Play20Filled />}
                onClick={togglePlayback}
                aria-label={isPlaying ? (L?.pause ?? 'Pause') : (L?.play ?? 'Play')}
              />
              <audio
                ref={audioRef}
                src={doneClip.audioUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                aria-label={`Preview audio — ${doneClip.title}`}
                style={{ flex: 1 }}
                controls
              />
            </div>
          )}

          {/* Escalate to full song */}
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
