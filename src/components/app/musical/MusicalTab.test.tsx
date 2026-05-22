import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MusicalTab } from './MusicalTab';

import { LanguageProvider } from '../../../i18n';
const mockSongContext = vi.hoisted(() => ({
  song: [] as Array<{ id: string; name: string; lines: Array<{ id: string; text: string }> }>,
  title: '',
  topic: '',
  mood: '',
  genre: '',
  setGenre: vi.fn(),
  tempo: 120,
  setTempo: vi.fn(),
  instrumentation: '',
  setInstrumentation: vi.fn(),
  rhythm: '',
  setRhythm: vi.fn(),
  narrative: '',
  setNarrative: vi.fn(),
  musicalPrompt: '',
  setMusicalPrompt: vi.fn(),
}));

const mockComposerContext = vi.hoisted(() => ({
  isGeneratingMusicalPrompt: false,
  isAnalyzingLyrics: false,
  generateMusicalPrompt: vi.fn(),
  analyzeLyricsForMusic: vi.fn(),
}));

const mockLibraryContext = vi.hoisted(() => ({
  tracks: [] as Array<{ id: string; title: string; source: 'cloud' | 'local' | 'lyria'; memo: string; linked: boolean }>,
  addTracks: vi.fn(),
  removeTrack: vi.fn(),
  updateMemo: vi.fn(),
  updateUrl: vi.fn(),
  purgeAll: vi.fn(),
}));

const mockAppNavigationContext = vi.hoisted(() => ({
  setActiveTab: vi.fn(),
}));

vi.mock('../../../contexts/SongContext', () => ({
  useSongContext: () => mockSongContext,
}));

vi.mock('../../../contexts/ComposerContext', () => ({
  useComposerContext: () => mockComposerContext,
}));

vi.mock('../../../contexts/LibraryContext', () => ({
  useLibraryContext: () => mockLibraryContext,
}));

vi.mock('../../../contexts/AppStateContext', () => ({
  useAppNavigationContext: () => mockAppNavigationContext,
}));

vi.mock('./LyricsMusicAnalysis', () => ({
  LyricsMusicAnalysis: (props: {
    title: string;
    topic: string;
    mood: string;
    hasContext: boolean;
    hasApiKey: boolean;
    isAnalyzingLyrics: boolean;
    isGeneratingMusicalPrompt: boolean;
    analyzeLyricsForMusic: () => void;
    completedSteps: Set<number>;
  }) => (
    <div data-testid="lyrics-music-analysis">
      {JSON.stringify({
        title: props.title,
        topic: props.topic,
        mood: props.mood,
        hasContext: props.hasContext,
        hasApiKey: props.hasApiKey,
        isAnalyzingLyrics: props.isAnalyzingLyrics,
        isGeneratingMusicalPrompt: props.isGeneratingMusicalPrompt,
        completedStepsSize: props.completedSteps.size,
        analyzeLyricsForMusic: props.analyzeLyricsForMusic === mockComposerContext.analyzeLyricsForMusic,
      })}
    </div>
  ),
}));

vi.mock('./MusicalParamsPanel', () => ({
  MusicalParamsPanel: (props: {
    genre: string;
    setGenre: () => void;
    tempo: number;
    setTempo: () => void;
    instrumentation: string;
    setInstrumentation: () => void;
    rhythm: string;
    setRhythm: () => void;
    narrative: string;
    setNarrative: () => void;
    onWorkflowStepComplete: (step: number) => void;
  }) => (
    <div data-testid="musical-params-panel">
      {JSON.stringify({
        genre: props.genre,
        tempo: props.tempo,
        instrumentation: props.instrumentation,
        rhythm: props.rhythm,
        narrative: props.narrative,
        usesSetters: [
          props.setGenre === mockSongContext.setGenre,
          props.setTempo === mockSongContext.setTempo,
          props.setInstrumentation === mockSongContext.setInstrumentation,
          props.setRhythm === mockSongContext.setRhythm,
          props.setNarrative === mockSongContext.setNarrative,
        ].every(Boolean),
      })}
    </div>
  ),
}));

vi.mock('./MusicalPromptBuilder', () => ({
  MusicalPromptBuilder: (props: {
    musicalPrompt: string;
    setMusicalPrompt: () => void;
    isGeneratingMusicalPrompt: boolean;
    isAnalyzingLyrics: boolean;
    canGenerate: boolean;
    generateMusicalPrompt: () => void;
  }) => (
    <div data-testid="musical-prompt-builder">
      {JSON.stringify({
        musicalPrompt: props.musicalPrompt,
        usesSetter: props.setMusicalPrompt === mockSongContext.setMusicalPrompt,
        isGeneratingMusicalPrompt: props.isGeneratingMusicalPrompt,
        isAnalyzingLyrics: props.isAnalyzingLyrics,
        canGenerate: props.canGenerate,
        generateMusicalPrompt: props.generateMusicalPrompt === mockComposerContext.generateMusicalPrompt,
      })}
    </div>
  ),
}));

vi.mock('./MusicalSuggestionsPanel', () => ({
  MusicalSuggestionsPanel: () => <div data-testid="musical-suggestions-panel" />,
}));

describe('MusicalTab', () => {
  beforeEach(() => {
    mockSongContext.song = [];
    mockSongContext.title = '';
    mockSongContext.topic = '';
    mockSongContext.mood = '';
    mockSongContext.genre = '';
    mockSongContext.tempo = 120;
    mockSongContext.instrumentation = '';
    mockSongContext.rhythm = '';
    mockSongContext.narrative = '';
    mockSongContext.musicalPrompt = '';
    mockComposerContext.isGeneratingMusicalPrompt = false;
    mockComposerContext.isAnalyzingLyrics = false;
  });

  it('reads musical data and actions from the song and composer contexts', () => {
    mockSongContext.song = [{
      id: 'verse-1',
      name: 'Verse',
      lines: [{ id: 'line-1', text: 'Sing it loud' }],
    }];
    mockSongContext.title = 'Night Drive';
    mockSongContext.topic = 'City lights';
    mockSongContext.mood = 'Euphoric';
    mockSongContext.genre = 'Synthwave';
    mockSongContext.tempo = 108;
    mockSongContext.instrumentation = 'Synth bass';
    mockSongContext.rhythm = 'Electronic (4/4)';
    mockSongContext.narrative = 'First-person';
    mockSongContext.musicalPrompt = 'Shimmering pads and neon drums';
    mockComposerContext.isGeneratingMusicalPrompt = true;
    mockComposerContext.isAnalyzingLyrics = true;

    render(<LanguageProvider><MusicalTab hasApiKey /></LanguageProvider>);

    expect(screen.getByTestId('lyrics-music-analysis').textContent).toContain('"title":"Night Drive"');
    expect(screen.getByTestId('lyrics-music-analysis').textContent).toContain('"hasContext":true');
    expect(screen.getByTestId('lyrics-music-analysis').textContent).toContain('"analyzeLyricsForMusic":true');

    expect(screen.getByTestId('musical-params-panel').textContent).toContain('"genre":"Synthwave"');
    expect(screen.getByTestId('musical-params-panel').textContent).toContain('"tempo":108');
    expect(screen.getByTestId('musical-params-panel').textContent).toContain('"usesSetters":true');

    expect(screen.getByTestId('musical-prompt-builder').textContent).toContain('"musicalPrompt":"Shimmering pads and neon drums"');
    expect(screen.getByTestId('musical-prompt-builder').textContent).toContain('"isGeneratingMusicalPrompt":true');
    expect(screen.getByTestId('musical-prompt-builder').textContent).toContain('"isAnalyzingLyrics":true');
    expect(screen.getByTestId('musical-prompt-builder').textContent).toContain('"canGenerate":true');
    expect(screen.getByTestId('musical-prompt-builder').textContent).toContain('"generateMusicalPrompt":true');
    // NOTE: setMusicalPrompt is NOT called automatically — onPromptReady fires only
    // on explicit user action (handleGenerate). No waitFor assertion here.
  });
});
