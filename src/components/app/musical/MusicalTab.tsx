import React, { useState, useCallback } from 'react';
import { LyricsMusicAnalysis } from './LyricsMusicAnalysis';
import { MusicalParamsPanel } from './MusicalParamsPanel';
import { MusicalPromptBuilder } from './MusicalPromptBuilder';
import { MusicalSuggestionsPanel } from './MusicalSuggestionsPanel';
import { Loader2, Sparkles } from '../../ui/icons';
import { Button } from '../../ui/Button';
import { Tooltip } from '../../ui/Tooltip';
import { useTranslation } from '../../../i18n';
import { useSongContext } from '../../../contexts/SongContext';
import { useComposerContext } from '../../../contexts/ComposerContext';
import { useSuno } from '../../../hooks/useSuno';
import { LyriaPreviewPanel } from '../../../features/musical/LyriaPreviewPanel';
import { LyriaFullSongPanel } from '../../../features/musical/LyriaFullSongPanel';
import type { LyriaClip } from '../../../types/lyria';

interface Props {
  hasApiKey: boolean;
}

export function MusicalTab({
  hasApiKey,
}: Props) {
  const {
    song, title, topic, mood,
    genre, setGenre, tempo, setTempo,
    instrumentation, setInstrumentation,
    rhythm, setRhythm,
    narrative, setNarrative,
    musicalPrompt, setMusicalPrompt,
  } = useSongContext();
  const {
    isGeneratingMusicalPrompt,
    isAnalyzingLyrics,
    generateMusicalPrompt,
    analyzeLyricsForMusic,
  } = useComposerContext();
  const { t } = useTranslation();
  const { generate, status } = useSuno();
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [approvedClip, setApprovedClip] = useState<LyriaClip | null>(null);

  const lyricsText = song
    .flatMap(s => s.lines.map(l => l.text))
    .filter(l => l.trim() !== '')
    .join('\n');

  const handleWorkflowStepComplete = useCallback((step: number) => {
    setCompletedSteps(prev => new Set(prev).add(step));
  }, []);

  const hasLyrics  = song.some(s => s.lines.some(l => l.text.trim() !== ''));
  const hasContext = !!(title || topic || mood || hasLyrics);
  const canGeneratePrompt = hasApiKey && !!(hasContext || genre || instrumentation);
  const canGenerateAudio = musicalPrompt.trim().length > 0 && status.phase !== 'generating' && status.phase !== 'polling';

  const handleGenerateWithSuno = useCallback(() => {
    if (!musicalPrompt.trim()) return;
    const trimmedTitle = title?.trim();
    void generate({
      prompt: musicalPrompt.trim(),
      ...(trimmedTitle ? { title: trimmedTitle } : {}),
      style: [genre, mood, instrumentation, rhythm].filter(Boolean).join(', '),
    });
  }, [generate, musicalPrompt, title, genre, mood, instrumentation, rhythm]);

  return (
    <div className="flex flex-col h-full overflow-y-auto fluent-fade-in">
      <LyricsMusicAnalysis
        title={title} topic={topic} mood={mood}
        hasContext={hasContext} hasApiKey={hasApiKey}
        isAnalyzingLyrics={isAnalyzingLyrics}
        isGeneratingMusicalPrompt={isGeneratingMusicalPrompt}
        analyzeLyricsForMusic={analyzeLyricsForMusic}
        completedSteps={completedSteps}
      />
      <div className="flex-1 p-6 space-y-5">
        <MusicalSuggestionsPanel />
        <MusicalParamsPanel
          genre={genre} setGenre={setGenre}
          tempo={tempo} setTempo={setTempo}
          instrumentation={instrumentation} setInstrumentation={setInstrumentation}
          rhythm={rhythm} setRhythm={setRhythm}
          narrative={narrative} setNarrative={setNarrative}
          onWorkflowStepComplete={handleWorkflowStepComplete}
        />
        <MusicalPromptBuilder
          musicalPrompt={musicalPrompt} setMusicalPrompt={setMusicalPrompt}
          isGeneratingMusicalPrompt={isGeneratingMusicalPrompt}
          isAnalyzingLyrics={isAnalyzingLyrics}
          canGenerate={canGeneratePrompt}
          hasApiKey={hasApiKey}
          generateMusicalPrompt={generateMusicalPrompt}
        />

        {/* ── Lyria 3 Preview 30'' ──────────────────────────────────── */}
        <LyriaPreviewPanel
          lyrics={lyricsText}
          songTitle={title ?? ''}
          onFullSong={(clip) => setApprovedClip(clip)}
        />

        {/* ── Lyria 3 Pro — titre complet (conditionnel) ──────────── */}
        {approvedClip && (
          <LyriaFullSongPanel
            clip={approvedClip}
            lyrics={lyricsText}
            songTitle={title ?? ''}
          />
        )}

        {/* ── Suno fallback ──────────────────────────────────────────── */}
        <div className="space-y-2">
          <Tooltip
            title={!musicalPrompt.trim()
              ? (t.musical?.promptPlaceholder ?? 'Generate or write a musical prompt first')
              : (t.tooltips.generateSong ?? 'Generate song')}
          >
            <Button
              onClick={handleGenerateWithSuno}
              disabled={!canGenerateAudio}
              variant="contained"
              color="primary"
              size="medium"
              startIcon={status.phase === 'generating' || status.phase === 'polling'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Sparkles className="w-4 h-4" />}
              className="w-full fluent-animate-pressable"
            >
              {status.phase === 'polling'
                ? `Generating… ${Math.round((status.elapsed ?? 0) / 1000)}s`
                : (t.tooltips.generateSong ?? 'Generate song')}
            </Button>
          </Tooltip>
          {status.phase === 'error' && (
            <p className="text-xs text-[var(--accent-danger)]">{status.message}</p>
          )}
          {status.phase === 'done' && status.songs.length > 0 && (
            <p className="text-xs text-[var(--text-secondary)]">
              {status.songs.length} track{status.songs.length > 1 ? 's' : ''} generated.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
