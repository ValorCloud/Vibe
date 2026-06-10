import React, { useState, useCallback } from 'react';
import { Button, tokens } from '@fluentui/react-components';
import { Play20Regular } from '@fluentui/react-icons';
import { LyricsMusicAnalysis } from './LyricsMusicAnalysis';
import { MusicalParamsPanel } from './MusicalParamsPanel';
import { MusicalPromptBuilder } from './MusicalPromptBuilder';
import { MusicalSuggestionsPanel } from './MusicalSuggestionsPanel';
import { useSongContext } from '../../../contexts/SongContext';
import { useComposerContext } from '../../../contexts/ComposerContext';
import { useLibraryContext } from '../../../contexts/LibraryContext';
import { useAppNavigationContext } from '../../../contexts/AppStateContext';
import { useTranslation } from '../../../i18n';
import { LyriaPreviewPanel } from '../../../features/musical/LyriaPreviewPanel';
import { LyriaFullSongPanel } from '../../../features/musical/LyriaFullSongPanel';
import type { LyriaClip } from '../../../types/lyria';

interface Props {
  hasApiKey: boolean;
}

export function MusicalTab({ hasApiKey }: Props) {
  const { t } = useTranslation();
  const m = t.musical;
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

  const { addTracks, tracks } = useLibraryContext();
  const { setActiveTab } = useAppNavigationContext();
  const lyriaTrackCount = tracks.filter(track => track.source === 'lyria').length;

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [approvedClip, setApprovedClip] = useState<LyriaClip | null>(null);

  const lyricsText = song
    .flatMap(s => s.lines.map(l => l.text))
    .filter(l => l.trim() !== '')
    .join('\n');

  const handleWorkflowStepComplete = useCallback((step: number) => {
    setCompletedSteps(prev => new Set(prev).add(step));
  }, []);

  /**
   * When the user removes a badge in LyriaPreviewPanel, clear the corresponding
   * SongContext value so MusicalParamsPanel deselects it and both prompts update.
   */
  const handleParamRemoved = useCallback((field: 'genre' | 'mood' | 'tempo' | 'instrumentation' | 'rhythm' | 'narrative') => {
    switch (field) {
      case 'genre':           setGenre('');           break;
      case 'tempo':           setTempo(0);            break;
      case 'instrumentation': setInstrumentation(''); break;
      case 'rhythm':          setRhythm('');          break;
      case 'narrative':       setNarrative('');       break;
      // 'mood' is derived from lyrics analysis — not cleared from here
    }
  }, [setGenre, setTempo, setInstrumentation, setRhythm, setNarrative]);

  /**
   * Bridge Lyria generations (preview clips and full songs) into the Player
   * library. Each successful generation is appended as a new TrackEntry with
   * source: 'lyria' so users can replay and compare multiple variants.
   */
  const handleAddLyriaToLibrary = useCallback(
    (entry: Parameters<typeof addTracks>[0][number]) => {
      addTracks([entry]);
    },
    [addTracks],
  );

  const handleOpenPlayer = useCallback(() => {
    setActiveTab('player');
  }, [setActiveTab]);

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

        {/*
          LyriaPreviewPanel receives LIVE props from SongContext (not snapshots).
          onParamRemoved clears the corresponding SongContext value so
          MusicalParamsPanel deselects it and both prompts stay in sync.
        */}
        <LyriaPreviewPanel
          lyrics={lyricsText}
          songTitle={title ?? ''}
          genre={genre}
          mood={mood ?? ''}
          tempo={tempo}
          instrumentation={instrumentation}
          rhythm={rhythm}
          narrative={narrative}
          musicalPrompt={musicalPrompt}
          onParamRemoved={handleParamRemoved}
          onFullSong={(clip) => setApprovedClip(clip)}
          onAddToLibrary={handleAddLyriaToLibrary}
        />

        {approvedClip && (
          <LyriaFullSongPanel
            approvedPrompt={approvedClip.prompt}
            clipTitle={approvedClip.title}
            lyrics={lyricsText}
            songTitle={title ?? ''}
            onAddToLibrary={handleAddLyriaToLibrary}
          />
        )}

        {/* Quick access from the Lyria container to the Player tab so users
            can replay and compare all generated tracks under the LYRIA view. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: tokens.spacingVerticalS }}>
          <Button
            appearance="secondary"
            icon={<Play20Regular />}
            onClick={handleOpenPlayer}
            aria-label={lyriaTrackCount > 0
              ? `${m.openPlayer} (${lyriaTrackCount})`
              : m.openPlayer}
          >
            {lyriaTrackCount > 0
              ? `${m.openPlayer} (${lyriaTrackCount})`
              : m.openPlayer}
          </Button>
        </div>
      </div>
    </div>
  );
}
