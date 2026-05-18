/**
 * LyriaPreviewPanel.tsx
 * Fluent 2 panel: generate a 30-second Lyria 3 Clip preview from current lyrics + style.
 *
 * Props:
 *   lyrics       — verbatim lyrics string from the active song/section in the editor
 *   songTitle    — pre-fills the title field
 *   onFullSong   — callback to escalate to full-song generation (LyriaFullSongPanel)
 */

import React, { useRef, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Label,
  Spinner,
  Text,
  Textarea,
  Badge,
  Divider,
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
} from '@fluentui/react-icons';
import { generateAndPoll, getLyriaKPISnapshot } from '../../services/lyriaService';
import type { LyriaClip, LyriaStyleDescriptor, LyriaTaskStatus } from '../../types/lyria';

interface LyriaPreviewPanelProps {
  lyrics: string;
  songTitle?: string;
  onFullSong?: (clip: LyriaClip) => void;
}

const GENRES = [
  'afrobeats', 'highlife', 'afro-pop', 'gospel', 'R&B', 'hip-hop',
  'pop', 'electronic', 'jazz', 'soul', 'reggae', 'dancehall',
];

const MOODS = [
  'upbeat', 'melancholic', 'cinematic', 'energetic', 'smooth', 'aggressive', 'romantic', 'ethereal',
];

export const LyriaPreviewPanel: React.FC<LyriaPreviewPanelProps> = ({
  lyrics,
  songTitle = '',
  onFullSong,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [taskStatus, setTaskStatus] = useState<LyriaTaskStatus>({ phase: 'idle' });
  const [kpi, setKpi] = useState(getLyriaKPISnapshot());

  // Style descriptor state
  const [genre, setGenre] = useState('afrobeats');
  const [mood, setMood] = useState('upbeat');
  const [tempo, setTempo] = useState('96');
  const [instruments, setInstruments] = useState('acoustic guitar, bass, talking drum, piano');
  const [vocalStyle, setVocalStyle] = useState('female lead, West African, smooth');
  const [negativePrompt, setNegativePrompt] = useState('');

  const isGenerating = taskStatus.phase === 'generating' || taskStatus.phase === 'polling';
  const doneClip = taskStatus.phase === 'done' ? taskStatus.clip : null;

  async function handleGenerate(): Promise<void> {
    setTaskStatus({ phase: 'generating' });

    // Build style — use conditional spread to satisfy exactOptionalPropertyTypes
    const style: LyriaStyleDescriptor = {
      genre,
      ...(mood ? { mood } : {}),
      ...(tempo ? { tempo: Number(tempo) } : {}),
      ...(instruments ? { instruments } : {}),
      ...(vocalStyle ? { vocalStyle } : {}),
    };

    // Build params — negativePrompt is optional, omit key entirely when empty
    const baseParams = {
      lyrics,
      style,
      title: songTitle,
      mode: 'clip' as const,
    };
    const params = negativePrompt
      ? { ...baseParams, negativePrompt }
      : baseParams;

    try {
      setTaskStatus({ phase: 'polling', elapsed: 0 });
      const clip = await generateAndPoll(
        params,
        {
          intervalMs: 2_000,
          timeoutMs: 90_000,
        },
      );
      setTaskStatus({ phase: 'done', clip });
      setKpi(getLyriaKPISnapshot());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTaskStatus({ phase: 'error', message });
      setKpi(getLyriaKPISnapshot());
    }
  }

  function togglePlayback(): void {
    if (!audioRef.current || !doneClip?.audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      void audioRef.current.play();
      setIsPlaying(true);
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
          <Badge appearance="tint" color="success" size="small">
            Google DeepMind
          </Badge>
        }
        action={
          <Tooltip
            content="Gènere un extrait audio ~30s basé sur vos paroles et votre style musical. Moteur: Lyria 3 Clip via Gemini API. Audio SynthID watermarké."
            relationship="label"
          >
            <Info20Regular style={{ color: tokens.colorNeutralForeground3 }} />
          </Tooltip>
        }
      />

      <Divider />

      {/* Genre row */}
      <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' }}>
        {GENRES.map((g) => (
          <Badge
            key={g}
            appearance={genre === g ? 'filled' : 'outline'}
            color={genre === g ? 'brand' : 'subtle'}
            style={{ cursor: 'pointer' }}
            onClick={() => setGenre(g)}
          >
            {g}
          </Badge>
        ))}
      </div>

      {/* Mood row */}
      <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' }}>
        {MOODS.map((m) => (
          <Badge
            key={m}
            appearance={mood === m ? 'filled' : 'outline'}
            color={mood === m ? 'subtle' : 'subtle'}
            style={{ cursor: 'pointer' }}
            onClick={() => setMood(m)}
          >
            {m}
          </Badge>
        ))}
      </div>

      {/* Tempo + Instruments */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: tokens.spacingHorizontalM,
          alignItems: 'end',
        }}
      >
        <Field label="Tempo (BPM)">
          <Input
            type="number"
            value={tempo}
            onChange={(_, d) => setTempo(d.value)}
            min={60}
            max={200}
          />
        </Field>
        <Field label="Instruments">
          <Input
            value={instruments}
            onChange={(_, d) => setInstruments(d.value)}
          />
        </Field>
      </div>

      {/* Vocal style */}
      <Field label="Style vocal">
        <Input
          value={vocalStyle}
          onChange={(_, d) => setVocalStyle(d.value)}
          placeholder="e.g. female lead, smooth, West African"
        />
      </Field>

      {/* Negative prompt */}
      <Field label="Éviter (optionnel)">
        <Input
          value={negativePrompt}
          onChange={(_, d) => setNegativePrompt(d.value)}
          placeholder="e.g. heavy metal, distorted guitar, screaming"
        />
      </Field>

      {/* Lyrics preview (read-only) */}
      <Field label="Paroles injectées">
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
        {isGenerating ? 'Génération en cours…' : "Générer le preview 30''"}
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
                aria-label={isPlaying ? 'Pause' : 'Lecture'}
              />
              <audio
                ref={audioRef}
                src={doneClip.audioUrl}
                onEnded={() => setIsPlaying(false)}
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
              Escalader en titre complet (Lyria 3 Pro)
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
          Succès : {kpi.successCount}
        </Label>
        <Label size="small" style={{ color: tokens.colorNeutralForeground3 }}>
          Erreurs : {kpi.errorCount}
        </Label>
        {kpi.lastError && (
          <Label size="small" style={{ color: tokens.colorStatusDangerForeground1 }}>
            Dernier erreur : {kpi.lastError}
          </Label>
        )}
      </div>
    </Card>
  );
};

export default LyriaPreviewPanel;
