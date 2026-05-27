/**
 * useLibrarySongActions
 *
 * Sub-hook extracted from useLibraryActions (Palier 3).
 * Handles the two handlers that consume song-context values:
 *   - handleSaveToLibrary  (reads 9 song-meta values)
 *   - handleLoadLibraryAsset (writes 12 song-meta setters + history)
 *
 * Self-sources all song-context values via useSongContext() — no context
 * values are forwarded from the parent hook.
 */
import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  saveAssetToLibrary,
  loadLibraryAssets,
  loadAssetIntoEditor,
  type LibraryAsset,
} from '../utils/libraryUtils';
import { useSongContext } from '../contexts/SongContext';
import { useOptionalVersionContext } from '../contexts/VersionContext';
import { logger } from '../utils/logger';

type UseLibrarySongActionsParams = {
  setIsSavingToLibrary: (v: boolean) => void;
  setIsSaveToLibraryModalOpen: (v: boolean) => void;
  setLibraryCount: Dispatch<SetStateAction<number>>;
  setLibraryAssets: Dispatch<SetStateAction<LibraryAsset[]>>;
  setSaveError: (msg: string | null) => void;
};

export const useLibrarySongActions = ({
  setIsSavingToLibrary,
  setIsSaveToLibraryModalOpen,
  setLibraryCount,
  setLibraryAssets,
  setSaveError,
}: UseLibrarySongActionsParams) => {
  const {
    song,
    title,
    topic,
    mood,
    genre,
    tempo,
    instrumentation,
    rhythm,
    narrative,
    musicalPrompt,
    replaceStateWithoutHistory,
    clearHistory,
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
  } = useSongContext();
  const versionContext = useOptionalVersionContext();

  const handleSaveToLibrary = useCallback(async () => {
    if (song.length === 0) return;
    setIsSavingToLibrary(true);
    setSaveError(null);
    try {
      await saveAssetToLibrary({
        title: title || 'Untitled Song',
        type: 'song',
        sections: song,
        ...(versionContext?.versions ? { versions: versionContext.versions } : {}),
        metadata: {
          topic,
          mood,
          genre,
          tempo: tempo || 120,
          instrumentation,
          rhythm,
          narrative,
          musicalPrompt,
        },
      });
      const updated = await loadLibraryAssets();
      setLibraryCount(updated.length);
      setLibraryAssets(updated);
    } catch (error) {
      logger.error('Failed to save to library:', error);
      setSaveError('Failed to save to library. Please try again.');
    } finally {
      setIsSavingToLibrary(false);
    }
  }, [
    genre,
    instrumentation,
    mood,
    musicalPrompt,
    narrative,
    rhythm,
    setIsSavingToLibrary,
    setLibraryAssets,
    setLibraryCount,
    setSaveError,
    song,
    tempo,
    title,
    topic,
    versionContext?.versions,
  ]);

  const handleLoadLibraryAsset = useCallback((asset: LibraryAsset) => {
    const loadedAsset = loadAssetIntoEditor(asset);
    replaceStateWithoutHistory(loadedAsset.song, loadedAsset.structure);
    clearHistory();
    setTitle(loadedAsset.title);
    setTitleOrigin('user');
    setTopic(loadedAsset.topic);
    setMood(loadedAsset.mood);
    setRhymeScheme(loadedAsset.rhymeScheme);
    setTargetSyllables(loadedAsset.targetSyllables);
    setGenre(loadedAsset.genre);
    setTempo(loadedAsset.tempo);
    setInstrumentation(loadedAsset.instrumentation);
    setRhythm(loadedAsset.rhythm);
    setNarrative(loadedAsset.narrative);
    setMusicalPrompt(loadedAsset.musicalPrompt);
    versionContext?.replaceVersions(loadedAsset.versions);
    setIsSaveToLibraryModalOpen(false);
  }, [
    clearHistory,
    replaceStateWithoutHistory,
    setGenre,
    setInstrumentation,
    setIsSaveToLibraryModalOpen,
    setMood,
    setMusicalPrompt,
    setNarrative,
    setRhymeScheme,
    setRhythm,
    setTargetSyllables,
    setTempo,
    setTitle,
    setTitleOrigin,
    setTopic,
    versionContext,
  ]);

  return { handleSaveToLibrary, handleLoadLibraryAsset };
};
