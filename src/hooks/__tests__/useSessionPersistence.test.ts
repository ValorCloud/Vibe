import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STRUCTURE } from '../../constants/editor';
import { useSessionPersistence } from '../useSessionPersistence';
import { createEmptySong } from '../../utils/songDefaults';

const songContextMock = vi.hoisted(() => ({
  // Setters
  setTitle: vi.fn(),
  setTitleOrigin: vi.fn(),
  setTopic: vi.fn(),
  setMood: vi.fn(),
  setRhymeScheme: vi.fn(),
  setTargetSyllables: vi.fn(),
  setGenre: vi.fn(),
  setTempo: vi.fn(),
  setInstrumentation: vi.fn(),
  setRhythm: vi.fn(),
  setNarrative: vi.fn(),
  setMusicalPrompt: vi.fn(),
  setSongLanguage: vi.fn(),
  // Actions
  replaceStateWithoutHistory: vi.fn(),
  clearHistory: vi.fn(),
  // State
  song: [] as ReturnType<typeof createEmptySong>,
  structure: [] as string[],
  title: '',
  titleOrigin: 'user' as const,
  topic: '',
  mood: '',
  rhymeScheme: 'AABB',
  targetSyllables: 10,
  genre: '',
  tempo: 120,
  instrumentation: '',
  rhythm: '',
  narrative: '',
  musicalPrompt: '',
  songLanguage: 'en',
}));

vi.mock('../../contexts/SongContext', () => ({
  useSongContext: () => songContextMock,
}));

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
};

const createParams = () => ({
  isSessionHydrated: false,
  setIsSessionHydrated: vi.fn(),
  setHasSavedSession: vi.fn(),
});

describe('useSessionPersistence', () => {
  it('does not announce a saved fallback session when localStorage rejects the write', async () => {
    vi.useFakeTimers();
    try {
      const params = { ...createParams(), isSessionHydrated: true };
      songContextMock.song[0]!.lines[0]!.text = 'Unsaved song';
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
      renderHook(() => useSessionPersistence(params));
      await act(() => vi.advanceTimersByTimeAsync(500));
      expect(params.setHasSavedSession).not.toHaveBeenCalledWith(true);
      expect(songContextMock.song[0]!.lines[0]!.text).toBe('Unsaved song');
    } finally { vi.useRealTimers(); }
  });
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.stubGlobal('fetch', vi.fn());
    songContextMock.song = createEmptySong(DEFAULT_STRUCTURE, 'AABB');
    songContextMock.structure = [...DEFAULT_STRUCTURE];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.values(songContextMock).forEach((v) => { if (typeof v === 'function') v.mockReset?.(); });
  });

  it('uses defaults when no stored session exists and hydrates the session', () => {
    const params = createParams();

    renderHook(() => useSessionPersistence(params));

    expect(songContextMock.replaceStateWithoutHistory).not.toHaveBeenCalled();
    expect(songContextMock.clearHistory).not.toHaveBeenCalled();
    expect(songContextMock.setTitle).not.toHaveBeenCalled();
    expect(songContextMock.setTopic).not.toHaveBeenCalled();
    expect(songContextMock.setMood).not.toHaveBeenCalled();
    expect(params.setHasSavedSession).not.toHaveBeenCalled();
    expect(params.setIsSessionHydrated).toHaveBeenCalledWith(true);
  });

  it('restores all persisted fields from a valid stored session and normalizes stored names', () => {
    const params = createParams();
    localStorage.setItem('lyricist_session', JSON.stringify({
      song: [{
        id: 'stored-section',
        name: ' Verse 1 ',
        rhymeScheme: 'ABAB',
        lines: [{
          id: 'stored-line',
          text: 'City lights are calling',
          rhymingSyllables: 'alling',
          rhyme: 'A',
          syllables: 6,
          concept: 'hook',
        }],
      }],
      structure: [' Verse 1 '],
      title: 'Midnight Echo',
      titleOrigin: 'ai',
      topic: 'Night drive',
      mood: 'Electric',
      rhymeScheme: 'ABAB',
      targetSyllables: 8,
      genre: 'Synthwave',
      tempo: '98',
      instrumentation: 'Analog synths',
      rhythm: 'Pulse',
      narrative: 'Chasing neon',
      musicalPrompt: 'Wide cinematic chorus',
      songLanguage: 'fr',
    }));

    renderHook(() => useSessionPersistence(params));

    expect(params.setHasSavedSession).toHaveBeenCalledWith(true);
    expect(songContextMock.replaceStateWithoutHistory).toHaveBeenCalledWith(
      [expect.objectContaining({
        id: 'stored-section',
        name: 'Verse 1',
        rhymeScheme: 'ABAB',
        lines: [expect.objectContaining({
          id: 'stored-line',
          text: 'City lights are calling',
          concept: 'hook',
        })],
      })],
      ['Verse 1'],
    );
    expect(songContextMock.setTitle).toHaveBeenCalledWith('Midnight Echo');
    expect(songContextMock.setTitleOrigin).toHaveBeenCalledWith('ai');
    expect(songContextMock.setTopic).toHaveBeenCalledWith('Night drive');
    expect(songContextMock.setMood).toHaveBeenCalledWith('Electric');
    expect(songContextMock.setRhymeScheme).toHaveBeenCalledWith('ABAB');
    expect(songContextMock.setTargetSyllables).toHaveBeenCalledWith(8);
    expect(songContextMock.setGenre).toHaveBeenCalledWith('Synthwave');
    expect(songContextMock.setTempo).toHaveBeenCalledWith(98);
    expect(songContextMock.setInstrumentation).toHaveBeenCalledWith('Analog synths');
    expect(songContextMock.setRhythm).toHaveBeenCalledWith('Pulse');
    expect(songContextMock.setNarrative).toHaveBeenCalledWith('Chasing neon');
    expect(songContextMock.setMusicalPrompt).toHaveBeenCalledWith('Wide cinematic chorus');
    expect(songContextMock.setSongLanguage).toHaveBeenCalledWith('fr');
    expect(songContextMock.clearHistory).toHaveBeenCalledOnce();
    expect(params.setIsSessionHydrated).toHaveBeenCalledWith(true);
  });

  it('gracefully degrades when the stored session is corrupt', () => {
    const params = createParams();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('lyricist_session', '{not-valid-json');

    expect(() => {
      renderHook(() => useSessionPersistence(params));
    }).not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(songContextMock.replaceStateWithoutHistory).not.toHaveBeenCalled();
    expect(songContextMock.clearHistory).not.toHaveBeenCalled();
    expect(params.setHasSavedSession).not.toHaveBeenCalled();
    expect(params.setIsSessionHydrated).toHaveBeenCalledWith(true);
  });

  it('skips hydration when stored session is valid JSON but fails schema validation', () => {
    const params = createParams();
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Valid JSON, but tempo is an object (schema expects number | string)
    localStorage.setItem('lyricist_session', JSON.stringify({
      song: [{ name: 'Verse', lines: [{ text: 'hello' }] }],
      tempo: { invalid: true },
    }));

    expect(() => {
      renderHook(() => useSessionPersistence(params));
    }).not.toThrow();

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(songContextMock.replaceStateWithoutHistory).not.toHaveBeenCalled();
    expect(songContextMock.clearHistory).not.toHaveBeenCalled();
    expect(params.setHasSavedSession).not.toHaveBeenCalled();
    expect(params.setIsSessionHydrated).toHaveBeenCalledWith(true);
  });

  it('restores empty string fields when stored with !== undefined checks', () => {
    const params = createParams();
    localStorage.setItem('lyricist_session', JSON.stringify({
      song: [{ name: 'Verse', lines: [{ text: 'hello' }] }],
      title: '',
      topic: '',
      mood: '',
    }));

    renderHook(() => useSessionPersistence(params));

    expect(songContextMock.setTitle).toHaveBeenCalledWith('');
    expect(songContextMock.setTopic).toHaveBeenCalledWith('');
    expect(songContextMock.setMood).toHaveBeenCalledWith('');
    expect(params.setIsSessionHydrated).toHaveBeenCalledWith(true);
  });
});
