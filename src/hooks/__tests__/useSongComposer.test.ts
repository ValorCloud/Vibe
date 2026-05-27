import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Section } from '../../types';
import { RefsProvider } from '../../contexts/RefsContext';
import { useSongComposer } from '../useSongComposer';
import { VIBE_EVENTS } from '../../constants/vibeEvents';

const RefsWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement(RefsProvider, null, children);

const generateContent = vi.hoisted(() => vi.fn());

vi.mock('@google/genai', () => ({
  Type: {
    ARRAY: 'array',
    OBJECT: 'object',
    STRING: 'string',
    INTEGER: 'integer',
  },
}));

vi.mock('../../utils/aiUtils', async () => {
  const actual = await vi.importActual<typeof import('../../utils/aiUtils')>('../../utils/aiUtils');

  return {
    ...actual,
    AI_MODEL_NAME: 'test-model',
    getAi: () => ({
      models: {
        generateContent,
      },
    }),
    generateContentWithRetry: generateContent,
  };
});

vi.mock('../../utils/withRetry', () => ({
  withRetry: async <T,>(fn: () => Promise<T>) => fn(),
}));

vi.mock('../../utils/withAbort', () => ({
  withAbort: async (
    ref: { current: AbortController | null },
    callback: (signal: AbortSignal) => Promise<unknown>,
  ) => {
    const controller = new AbortController();
    ref.current = controller;
    return callback(controller.signal);
  },
  isAbortError: (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
}));

const createSong = (): Section[] => [
  {
    id: 'section-1',
    name: 'Verse 1',
    rhymeScheme: 'AABB',
    lines: [
      {
        id: 'line-1',
        text: 'Original target line',
        rhymingSyllables: '',
        rhyme: 'A',
        syllables: 4,
        concept: 'target',
        isMeta: false,
      },
      {
        id: 'line-2',
        text: 'Neighbour line stays put',
        rhymingSyllables: '',
        rhyme: 'A',
        syllables: 5,
        concept: 'neighbour',
        isMeta: false,
      },
    ],
  },
  {
    id: 'section-2',
    name: 'Chorus',
    rhymeScheme: 'AABB',
    lines: [{
      id: 'line-3',
      text: 'Second section stays put',
      rhymingSyllables: '',
      rhyme: 'B',
      syllables: 5,
      concept: 'other',
      isMeta: false,
    }],
  },
];

const createParams = (overrides: Partial<Parameters<typeof useSongComposer>[0]> = {}) => {
  const song = overrides.song ?? createSong();

  return {
    song,
    structure: ['Verse 1', 'Chorus'],
    topic: 'Night drive',
    mood: 'Electric',
    rhymeScheme: 'AABB',
    targetSyllables: 8,
    title: 'Midnight Echo',
    genre: '',
    tempo: 120,
    songDurationSeconds: 180,
    timeSignature: [4, 4] as [number, number],
    instrumentation: '',
    rhythm: '',
    narrative: '',
    songLanguage: 'English',
    uiLanguage: 'English',
    hasApiKey: true,
    setMusicalPrompt: vi.fn(),
    setGenre: vi.fn(),
    setTempo: vi.fn(),
    setInstrumentation: vi.fn(),
    setRhythm: vi.fn(),
    setNarrative: vi.fn(),
    updateState: vi.fn(),
    updateSongWithHistory: vi.fn(),
    updateSongAndStructureWithHistory: vi.fn(),
    requestAutoTitleGeneration: vi.fn(),
    ...overrides,
  };
};

const createGeneratedSongResponse = () => ({
  text: JSON.stringify([{
    name: 'Verse 1',
    rhymeScheme: 'AABB',
    lines: Array.from({ length: 6 }, (_, index) => ({
      text: `Generated line ${index + 1}`,
      rhymingSyllables: '',
      rhyme: index < 3 ? 'A' : 'B',
      syllables: 4,
      concept: `concept-${index + 1}`,
    })),
  }, {
    name: 'Chorus',
    rhymeScheme: 'AABB',
    lines: Array.from({ length: 4 }, (_, index) => ({
      text: `Hook line ${index + 1}`,
      rhymingSyllables: '',
      rhyme: index < 2 ? 'A' : 'B',
      syllables: 4,
      concept: `hook-${index + 1}`,
    })),
  }]),
});

describe('useSongComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sets and then clears isGenerating during song generation', async () => {
    let resolveGeneration: ((value: { text: string }) => void) | undefined;
    generateContent.mockImplementationOnce(() => new Promise(resolve => {
      resolveGeneration = resolve;
    }));

    const params = createParams();
    const { result } = renderHook(() => useSongComposer(params), { wrapper: RefsWrapper });

    act(() => {
      void result.current.generateSong();
    });

    expect(result.current.isGenerating).toBe(true);

    await act(async () => {
      resolveGeneration?.(createGeneratedSongResponse());
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it('resets isGenerating and dispatches vibe:apierror when generation fails', async () => {
    generateContent.mockRejectedValueOnce(new Error('AI offline'));
    const params = createParams();
    const eventListener = vi.fn();
    window.addEventListener(VIBE_EVENTS.API_ERROR, eventListener as EventListener);

    const { result } = renderHook(() => useSongComposer(params), { wrapper: RefsWrapper });

    act(() => {
      void result.current.generateSong();
    });

    await waitFor(() => {
      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(result.current.isGenerating).toBe(false);
    });

    const event = eventListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>;
    expect(event.detail.message).toContain('AI offline');
    window.removeEventListener(VIBE_EVENTS.API_ERROR, eventListener as EventListener);
  });

  it('updates only the targeted line when updateLineText is called', () => {
    const song = createSong();
    const nextSnapshots: Array<{ song: Section[]; structure: string[] }> = [];
    const params = createParams({
      song,
      updateState: vi.fn(recipe => {
        nextSnapshots.push(recipe({ song, structure: ['Verse 1', 'Chorus'] }));
      }),
    });

    const { result } = renderHook(() => useSongComposer(params), { wrapper: RefsWrapper });

    act(() => {
      result.current.updateLineText('section-1', 'line-1', 'Updated target line only');
    });

    const updatedSong = nextSnapshots[0]?.song;
    expect(updatedSong).toBeDefined();
    expect(updatedSong?.[0]?.lines[0]).toEqual(expect.objectContaining({
      id: 'line-1',
      text: 'Updated target line only',
      isManual: true,
    }));
    expect(updatedSong?.[0]?.lines[1]).toBe(song[0]?.lines[1]);
    expect(updatedSong?.[1]).toBe(song[1]);
  });

  it('keeps numbered choruses and final chorus in sync when one chorus line is edited', () => {
    const song: Section[] = [
      {
        id: 'section-1',
        name: 'Verse 1',
        rhymeScheme: 'AABB',
        lines: [{
          id: 'line-1',
          text: 'Verse line',
          rhymingSyllables: '',
          rhyme: 'A',
          syllables: 2,
          concept: 'verse',
        }],
      },
      {
        id: 'section-2',
        name: 'Chorus 1',
        rhymeScheme: 'AABB',
        lines: [{
          id: 'line-2',
          text: 'Original hook',
          rhymingSyllables: '',
          rhyme: 'A',
          syllables: 4,
          concept: 'hook',
        }],
      },
      {
        id: 'section-3',
        name: 'Chorus 2',
        rhymeScheme: 'AABB',
        lines: [{
          id: 'line-3',
          text: 'Original hook',
          rhymingSyllables: '',
          rhyme: 'A',
          syllables: 4,
          concept: 'hook',
        }],
      },
      {
        id: 'section-4',
        name: 'Final Chorus',
        rhymeScheme: 'AABB',
        lines: [{
          id: 'line-4',
          text: 'Original hook',
          rhymingSyllables: '',
          rhyme: 'A',
          syllables: 4,
          concept: 'hook',
        }],
      },
    ];
    const nextSnapshots: Array<{ song: Section[]; structure: string[] }> = [];
    const params = createParams({
      song,
      structure: song.map(section => section.name),
      updateState: vi.fn(recipe => {
        nextSnapshots.push(recipe({ song, structure: song.map(section => section.name) }));
      }),
    });

    const { result } = renderHook(() => useSongComposer(params), { wrapper: RefsWrapper });

    act(() => {
      result.current.updateLineText('section-3', 'line-3', 'Unified hook line');
    });

    const updatedSong = nextSnapshots[0]?.song;
    expect(updatedSong?.[0]?.lines[0]?.text).toBe('Verse line');
    expect(updatedSong?.[1]?.lines[0]).toEqual(expect.objectContaining({
      id: 'line-2',
      text: 'Unified hook line',
      isManual: true,
    }));
    expect(updatedSong?.[2]?.lines[0]).toEqual(expect.objectContaining({
      id: 'line-3',
      text: 'Unified hook line',
      isManual: true,
    }));
    expect(updatedSong?.[3]?.lines[0]).toEqual(expect.objectContaining({
      id: 'line-4',
      text: 'Unified hook line',
      isManual: true,
    }));
  });
});
