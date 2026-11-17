/**
 * useSessionState
 *
 * Composition shell — assembles the 4 domain hooks into the same surface
 * that all existing consumers expect. No logic lives here.
 *
 * Domain hooks:
 *   useThemeState      — theme toggle + <html> class
 *   useApiStatus       — hasApiKey via /api/status with retry
 *   useUiPreferences   — uiScale, defaultEditMode, showTranslation + fontSize
 *   useLibraryState    — similarityMatches, libraryCount, libraryAssets, isSavingToLibrary
 *
 * hasSavedSession is initialized to true when a session was restored from OPFS
 * (initialSession !== null). The boolean is passed down from AppStateProvider.
 */
import { useCallback, useState } from 'react';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';
import { useThemeState } from './useThemeState';
import { useApiStatus } from './useApiStatus';
import { useUiPreferences } from './useUiPreferences';
import { useLibraryState } from './useLibraryState';

export function useSessionState(hasSavedSessionInit = false) {
  const { theme, setTheme } = useThemeState();
  const { hasApiKey } = useApiStatus();
  const {
    uiScale, setUiScale,
    defaultEditMode, setDefaultEditMode,
    showTranslationFeatures, setShowTranslationFeatures,
  } = useUiPreferences();
  const {
    similarityMatches, setSimilarityMatches,
    libraryCount, setLibraryCount,
    libraryAssets, setLibraryAssets,
    isSavingToLibrary, setIsSavingToLibrary,
  } = useLibraryState();

  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  // Initialize to true if a session snapshot was loaded from OPFS
  const [hasSavedSession, setHasSavedSession] = useState(hasSavedSessionInit);
  const [audioFeedback, setAudioFeedbackState] = useState(() => safeGetItem('vibe_audio_feedback') !== 'false');
  const setAudioFeedback = useCallback((value: boolean) => {
    setAudioFeedbackState(value);
    safeSetItem('vibe_audio_feedback', String(value));
  }, []);

  return {
    theme, setTheme,
    hasApiKey,
    isSessionHydrated, setIsSessionHydrated,
    hasSavedSession, setHasSavedSession,
    audioFeedback, setAudioFeedback,
    uiScale, setUiScale,
    defaultEditMode, setDefaultEditMode,
    showTranslationFeatures, setShowTranslationFeatures,
    similarityMatches, setSimilarityMatches,
    libraryCount, setLibraryCount,
    libraryAssets, setLibraryAssets,
    isSavingToLibrary, setIsSavingToLibrary,
  };
}
