import React, { useState, useCallback } from 'react';
import { LyricsMusicAnalysis } from './LyricsMusicAnalysis';
import { MusicalParamsPanel } from './MusicalParamsPanel';
import { MusicalPromptBuilder } from './MusicalPromptBuilder';
import { MusicalSuggestionsPanel } from './MusicalSuggestionsPanel';
import { useSongContext } from '../../../contexts/SongContext';
import { useComposerContext } from '../../../contexts/ComposerContext';
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
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [approvedClip, setApprovedClip] = useState<LyriaClip | null>(null);

  const lyricsText = song
    .flatMap(s => s.lines.map(l => l.text))
    .filter(l => l.trim() !== '')
    .join('\n');

  const handleWorkflowStepComplete = useCallback((step: number) => {
    setCompletedSteps(prev => new Set(prev).add(step));
  }, []);

  // When Lyria fires, push the built style prompt into MusicalPromptBuilder's container.
  // Only overwrites if the user hasn't manually edited their own prompt (or if it's empty).
  const handleLyriaPromptReady = useCallback((stylePrompt: string) => {
    if (stylePrompt.trim()) {
      setMusicalPrompt(stylePrompt);
    }
  }, [setMusicalPrompt]);

  const hasLyrics  = song.some(s => s.lines.some(l => l.text.trim() !== ''));
  const hasContext = !!(title || topic || mood || hasLyrics);
  const canGeneratePrompt = hasApiKey && !!(hasContext || genre || instrumentation);

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

        {/* ── Lyria 3 Preview 30'' — consomme toutes les valeurs SongContext ─── */}
        <LyriaPreviewPanel
          lyrics={lyricsText}
          songTitle={title ?? ''}
          initialGenre={genre}
          initialMood={mood ?? ''}
          initialTempo={tempo}
          initialInstrumentation={instrumentation}
          initialRhythm={rhythm}
          initialNarrative={narrative}
          initialMusicalPrompt={musicalPrompt}
          onFullSong={(clip) => setApprovedClip(clip)}
          onPromptReady={handleLyriaPromptReady}
        />

        {/* ── Lyria 3 Pro — titre complet (conditionnel) ──────────────── */}
        {approvedClip && (
          <LyriaFullSongPanel
            approvedPrompt={approvedClip.prompt}
            clipTitle={approvedClip.title}
            lyrics={lyricsText}
            songTitle={title ?? ''}
          />
        )}
      </div>
    </div>
  );
}
