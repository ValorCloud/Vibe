import { useCallback, useMemo } from 'react';
import type { Section } from '../types';
import type { SimilarityMatch } from '../utils/similarityUtils';
import { buildResetPayload, buildPartialResetPayload, clearPersistedSession } from '../utils/sessionReset';
import { createEmptySong } from '../utils/songDefaults';
import { useSongContext } from '../contexts/SongContext';
import type { SongMeta } from './useSongHistoryState';
import type { AppTab } from './useUIState';

type StateBag = {
  setHasSavedSession: (v: boolean) => void;
  setMarkupText: (v: string) => void;
  setActiveTab: (v: AppTab) => void;
  setIsLeftPanelOpen: (v: boolean) => void;
  setSimilarityMatches: (v: SimilarityMatch[]) => void;
};

type UseSessionActionsParams = {
  song: ReturnType<typeof createEmptySong>;
  structure: string[];
  rhymeScheme: string;
  appState: StateBag;
  replaceStateWithoutHistory: (song: ReturnType<typeof createEmptySong>, structure: string[]) => void;
  navigateWithHistory: (song: Section[], structure: string[], meta: SongMeta) => void;
  clearHistory: () => void;
  clearSelection: () => void;
  resetWebSimilarityIndex: () => void;
  resetSuggestionCycle: () => void;
  updateSongAndStructureWithHistory: (song: Section[], structure: string[]) => void;
  setIsResetModalOpen: (v: boolean) => void;
};

const applyResetPayload = (
  payload: ReturnType<typeof buildResetPayload>,
  navigateWithHistory: (song: Section[], structure: string[], meta: SongMeta) => void,
  currentMeta: SongMeta,
  clearPersistedSessionFn: () => void,
  clearSelection: () => void,
  resetWebSimilarityIndex: () => void,
  appState: StateBag,
  songMetaSetters: {
    setTitle: (v: string) => void;
    setTitleOrigin: (v: 'user' | 'ai') => void;
    setTopic: (v: string) => void;
    setMood: (v: string) => void;
    setRhymeScheme: (v: string) => void;
    setTargetSyllables: (v: number) => void;
    setGenre: (v: string) => void;
    setTempo: (v: number) => void;
    setInstrumentation: (v: string) => void;
    setRhythm: (v: string) => void;
    setNarrative: (v: string) => void;
    setMusicalPrompt: (v: string) => void;
  },
) => {
  // Push current song+meta into history, then set new blank song.
  // This enables Undo to restore the previous song (with its metadata)
  // and Redo to return to the new blank song.
  navigateWithHistory(payload.song, payload.structure, currentMeta);
  clearPersistedSessionFn();
  clearSelection();
  appState.setHasSavedSession(payload.hasSavedSession);
  songMetaSetters.setTitle(payload.title);
  songMetaSetters.setTitleOrigin(payload.titleOrigin);
  songMetaSetters.setTopic(payload.topic);
  songMetaSetters.setMood(payload.mood);
  songMetaSetters.setRhymeScheme(payload.rhymeScheme);
  songMetaSetters.setTargetSyllables(payload.targetSyllables);
  songMetaSetters.setGenre(payload.genre);
  songMetaSetters.setTempo(payload.tempo);
  songMetaSetters.setInstrumentation(payload.instrumentation);
  songMetaSetters.setRhythm(payload.rhythm);
  songMetaSetters.setNarrative(payload.narrative);
  songMetaSetters.setMusicalPrompt(payload.musicalPrompt);
  appState.setMarkupText(payload.markupText);
  appState.setActiveTab(payload.activeTab);
  appState.setIsLeftPanelOpen(payload.isLeftPanelOpen);
  appState.setSimilarityMatches(payload.similarityMatches);
  resetWebSimilarityIndex();
};

export const useSessionActions = (params: UseSessionActionsParams) => {
  const {
    song,
    structure,
    rhymeScheme,
    appState,
    navigateWithHistory,
    clearSelection,
    resetWebSimilarityIndex,
    resetSuggestionCycle,
    updateSongAndStructureWithHistory,
    setIsResetModalOpen,
  } = params;

  const {
    setTitle, setTitleOrigin, setTopic, setMood, setRhymeScheme,
    setTargetSyllables, setGenre, setTempo, setInstrumentation,
    setRhythm, setNarrative, setMusicalPrompt,
    title, topic, mood, targetSyllables, genre, tempo,
    instrumentation, rhythm, narrative, musicalPrompt, titleOrigin,
  } = useSongContext();

  const songMetaSetters = useMemo(() => ({
    setTitle,
    setTitleOrigin,
    setTopic,
    setMood,
    setRhymeScheme,
    setTargetSyllables,
    setGenre,
    setTempo,
    setInstrumentation,
    setRhythm,
    setNarrative,
    setMusicalPrompt,
  }), [
    setTitle,
    setTitleOrigin,
    setTopic,
    setMood,
    setRhymeScheme,
    setTargetSyllables,
    setGenre,
    setTempo,
    setInstrumentation,
    setRhythm,
    setNarrative,
    setMusicalPrompt,
  ]);

  const handleCreateEmptySong = useCallback(() => {
    const currentMeta: SongMeta = {
      title,
      titleOrigin,
      topic,
      mood,
      rhymeScheme,
      targetSyllables,
      genre,
      tempo,
      instrumentation,
      rhythm,
      narrative,
      musicalPrompt,
    };
    applyResetPayload(
      buildResetPayload('AABB'),
      navigateWithHistory,
      currentMeta,
      clearPersistedSession,
      clearSelection,
      resetWebSimilarityIndex,
      appState,
      songMetaSetters,
    );
    resetSuggestionCycle();
  }, [
    appState,
    navigateWithHistory,
    clearSelection,
    resetSuggestionCycle,
    resetWebSimilarityIndex,
    songMetaSetters,
    title, titleOrigin, topic, mood, rhymeScheme, targetSyllables,
    genre, tempo, instrumentation, rhythm, narrative, musicalPrompt,
  ]);

  const resetSong = useCallback(() => {
    const partial = buildPartialResetPayload(rhymeScheme);
    updateSongAndStructureWithHistory(partial.song, partial.structure);
    clearPersistedSession();
    appState.setHasSavedSession(false);
    clearSelection();
    setTitle(partial.title);
    setTitleOrigin(partial.titleOrigin);
    setTopic(partial.topic);
    setMood(partial.mood);
    appState.setMarkupText('');
    appState.setSimilarityMatches([]);
    resetWebSimilarityIndex();
    resetSuggestionCycle();
    setIsResetModalOpen(false);
  }, [
    appState, clearSelection, resetSuggestionCycle, resetWebSimilarityIndex,
    rhymeScheme, setIsResetModalOpen, updateSongAndStructureWithHistory,
    setTitle, setTitleOrigin, setTopic, setMood,
  ]);

  return { handleCreateEmptySong, resetSong };
};
