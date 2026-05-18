import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Section } from '../types';
import { useSessionActions } from '../useSessionActions';

// --- Mocks ---

const mockSetTitle = vi.fn();
const mockSetTitleOrigin = vi.fn();
const mockSetTopic = vi.fn();
const mockSetMood = vi.fn();
const mockSetRhymeScheme = vi.fn();
const mockSetTargetSyllables = vi.fn();
const mockSetGenre = vi.fn();
const mockSetTempo = vi.fn();
const mockSetInstrumentation = vi.fn();
const mockSetRhythm = vi.fn();
const mockSetNarrative = vi.fn();
const mockSetMusicalPrompt = vi.fn();

vi.mock('../../contexts/SongContext', () => ({
  useSongContext: () => ({
    song: [],
    structure: [],
    topic: '',
    mood: '',
    rhymeScheme: 'AABB',
    title: '',
    titleOrigin: 'user' as const,
    setTitle: mockSetTitle,
    setTitleOrigin: mockSetTitleOrigin,
    setTopic: mockSetTopic,
    setMood: mockSetMood,
    setRhymeScheme: mockSetRhymeScheme,
    targetSyllables: 8,
    setTargetSyllables: mockSetTargetSyllables,
    genre: '',
    setGenre: mockSetGenre,
    tempo: 120,
    setTempo: mockSetTempo,
    instrumentation: '',
    setInstrumentation: mockSetInstrumentation,
    rhythm: '',
    setRhythm: mockSetRhythm,
    narrative: '',
    setNarrative: mockSetNarrative,
    musicalPrompt: '',
    setMusicalPrompt: mockSetMusicalPrompt,
  }),
}));

vi.mock('../../utils/sessionReset', () => ({
  buildResetPayload: (rhymeScheme: string) => ({
    song: [],
    structure: [],
    title: '',
    titleOrigin: 'user' as const,
    topic: '',
    mood: '',
    rhymeScheme,
    targetSyllables: 8,
    genre: '',
    tempo: 120,
    instrumentation: '',
    rhythm: '',
    narrative: '',
    musicalPrompt: '',
    markupText: '',
    activeTab: 'lyrics' as const,
    isLeftPanelOpen: true,
    similarityMatches: [],
    hasSavedSession: false,
  }),
  buildPartialResetPayload: (rhymeScheme: string) => ({
    song: [],
    structure: [],
    title: '',
    titleOrigin: 'user' as const,
    topic: '',
    mood: '',
    rhymeScheme,
  }),
  clearPersistedSession: vi.fn(),
}));

vi.mock('../../utils/songDefaults', () => ({
  createEmptySong: () => [],
}));

const makeAppState = () => ({
  setHasSavedSession: vi.fn(),
  setMarkupText: vi.fn(),
  setActiveTab: vi.fn(),
  setIsLeftPanelOpen: vi.fn(),
  setSimilarityMatches: vi.fn(),
});

const makeParams = (overrides = {}) => ({
  song: [] as Section[],
  structure: [] as string[],
  rhymeScheme: 'AABB',
  appState: makeAppState(),
  replaceStateWithoutHistory: vi.fn(),
  navigateWithHistory: vi.fn(),
  clearHistory: vi.fn(),
  clearSelection: vi.fn(),
  resetWebSimilarityIndex: vi.fn(),
  resetSuggestionCycle: vi.fn(),
  updateSongAndStructureWithHistory: vi.fn(),
  setIsResetModalOpen: vi.fn(),
  ...overrides,
});

describe('useSessionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resetSong', () => {
    it('calls updateSongAndStructureWithHistory with empty song', () => {
      const params = makeParams();
      const { result } = renderHook(() => useSessionActions(params));
      act(() => { result.current.resetSong(); });
      expect(params.updateSongAndStructureWithHistory).toHaveBeenCalledWith([], []);
    });

    it('resets title and topic via context setters', () => {
      const params = makeParams();
      const { result } = renderHook(() => useSessionActions(params));
      act(() => { result.current.resetSong(); });
      expect(mockSetTitle).toHaveBeenCalledWith('');
      expect(mockSetTopic).toHaveBeenCalledWith('');
      expect(mockSetMood).toHaveBeenCalledWith('');
    });

    it('calls resetSuggestionCycle', () => {
      const params = makeParams();
      const { result } = renderHook(() => useSessionActions(params));
      act(() => { result.current.resetSong(); });
      expect(params.resetSuggestionCycle).toHaveBeenCalledTimes(1);
    });

    it('calls setIsResetModalOpen(false)', () => {
      const params = makeParams();
      const { result } = renderHook(() => useSessionActions(params));
      act(() => { result.current.resetSong(); });
      expect(params.setIsResetModalOpen).toHaveBeenCalledWith(false);
    });

    it('resets web similarity index', () => {
      const params = makeParams();
      const { result } = renderHook(() => useSessionActions(params));
      act(() => { result.current.resetSong(); });
      expect(params.resetWebSimilarityIndex).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleCreateEmptySong', () => {
    it('calls navigateWithHistory to preserve the old song in undo stack', () => {
      const params = makeParams();
      const { result } = renderHook(() => useSessionActions(params));
      act(() => { result.current.handleCreateEmptySong(); });
      expect(params.navigateWithHistory).toHaveBeenCalledTimes(1);
    });

    it('calls resetSuggestionCycle', () => {
      const params = makeParams();
      const { result } = renderHook(() => useSessionActions(params));
      act(() => { result.current.handleCreateEmptySong(); });
      expect(params.resetSuggestionCycle).toHaveBeenCalledTimes(1);
    });

    it('resets all song meta setters', () => {
      const params = makeParams();
      const { result } = renderHook(() => useSessionActions(params));
      act(() => { result.current.handleCreateEmptySong(); });
      expect(mockSetTitle).toHaveBeenCalled();
      expect(mockSetTopic).toHaveBeenCalled();
      expect(mockSetMood).toHaveBeenCalled();
      expect(mockSetRhymeScheme).toHaveBeenCalled();
      expect(mockSetGenre).toHaveBeenCalled();
      expect(mockSetTempo).toHaveBeenCalled();
    });
  });

  describe('songMetaSetters memo stability', () => {
    it('returns stable function references across re-renders', () => {
      const params = makeParams();
      const { result, rerender } = renderHook(() => useSessionActions(params));
      const first = result.current.resetSong;
      rerender();
      expect(result.current.resetSong).toBe(first);
    });
  });
});
