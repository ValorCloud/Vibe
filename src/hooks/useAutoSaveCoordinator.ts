/**
 * useAutoSaveCoordinator
 *
 * Reads all song fields from SongContext directly, combines them with the
 * panel UI state (activeTab, isStructureOpen, isLeftPanelOpen) supplied by
 * the caller, and delegates to useSessionAutoSave.
 *
 * Eliminates the 16-field prop-drilling pattern that previously lived in
 * AppInnerContent.
 */
import { useRef } from 'react';
import { useSongContext } from '../contexts/SongContext';
import { useSessionAutoSave } from './useSessionAutoSave';
import type { SessionAutoSaveResult } from './useSessionAutoSave';
import type { AppTab } from './useUIState';

interface AutoSaveCoordinatorOptions {
  activeTab: AppTab;
  isStructureOpen: boolean;
  isLeftPanelOpen: boolean;
  /** Called once after the first successful OPFS write. */
  onSaved?: (() => void) | undefined;
}

export function useAutoSaveCoordinator({
  activeTab,
  isStructureOpen,
  isLeftPanelOpen,
  onSaved,
}: AutoSaveCoordinatorOptions): SessionAutoSaveResult {
  const songCtx = useSongContext();

  // Stable ref so useSessionAutoSave's dep-array never sees a new function.
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const stableOnSaved = useRef<(() => void) | undefined>(undefined);
  if (!stableOnSaved.current) {
    stableOnSaved.current = () => onSavedRef.current?.();
  }

  return useSessionAutoSave({
    song:                songCtx.song,
    structure:           songCtx.structure,
    title:               songCtx.title,
    titleOrigin:         songCtx.titleOrigin,
    topic:               songCtx.topic,
    mood:                songCtx.mood,
    rhymeScheme:         songCtx.rhymeScheme,
    targetSyllables:     songCtx.targetSyllables,
    songLanguage:        songCtx.songLanguage,
    genre:               songCtx.genre,
    tempo:               songCtx.tempo,
    songDurationSeconds: songCtx.songDurationSeconds,
    timeSignature:       songCtx.timeSignature,
    instrumentation:     songCtx.instrumentation,
    rhythm:              songCtx.rhythm,
    narrative:           songCtx.narrative,
    musicalPrompt:       songCtx.musicalPrompt,
    activeTab,
    isStructureOpen,
    isLeftPanelOpen,
    onSaved: stableOnSaved.current,
  });
}
