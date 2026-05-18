/**
 * AppPanelOrchestrator
 * Renderless component that manages isLeftPanelOpen / isStructureOpen /
 * isSuggestionsOpen synchronisation logic. Reads everything it needs from
 * SongContext, AppStateContext, ComposerContext directly.
 */
import { useEffect, useRef } from 'react';
import { useAppStateContext } from '../../contexts/AppStateContext';
import { useComposerContext } from '../../contexts/ComposerContext';
import { useSongContext } from '../../contexts/SongContext';
import { useSwitchEditMode } from '../../hooks/useSwitchEditMode';
import { useDerivedAppState } from '../../hooks/useDerivedAppState';
import { useSimilarityContext } from '../../contexts/SimilarityContext';

export function AppPanelOrchestrator() {
  const { appState } = useAppStateContext();
  const {
    activeTab, isStructureOpen, setIsStructureOpen,
    setIsLeftPanelOpen,
    editMode, setEditMode, markupText, setMarkupText,
    defaultEditMode, isSessionHydrated,
  } = appState;

  const { selectedLineId } = useComposerContext();
  const { updateSongAndStructureWithHistory } = useSongContext();

  const { switchEditMode } = useSwitchEditMode({
    editMode,
    markupText,
    setEditMode,
    setMarkupText,
    updateSongAndStructureWithHistory,
  });

  const { index: webSimilarityIndex } = useSimilarityContext();

  const { hasRealLyricContent } = useDerivedAppState({
    editMode, markupText, webSimilarityIndex,
  });

  const isSuggestionsOpen = activeTab === 'lyrics' && Boolean(selectedLineId);

  // ── Effect 1: Apply default edit mode after session hydration ─────────
  const hasAppliedDefaultEditModeRef = useRef(false);
  useEffect(() => {
    if (isSessionHydrated && !hasAppliedDefaultEditModeRef.current) {
      hasAppliedDefaultEditModeRef.current = true;
      if (defaultEditMode !== 'section') switchEditMode(defaultEditMode);
    }
  }, [isSessionHydrated, defaultEditMode, switchEditMode]);

  // ── Effect 2: Sync edit mode with active tab changes ──────────────────
  const previousActiveTabRef = useRef(activeTab);
  useEffect(() => {
    const prev = previousActiveTabRef.current;
    previousActiveTabRef.current = activeTab;

    if (activeTab !== 'lyrics' && editMode !== 'section') {
      setEditMode('section');
    } else if (activeTab === 'lyrics' && prev !== 'lyrics' && hasAppliedDefaultEditModeRef.current) {
      if (defaultEditMode !== 'section' && editMode === 'section') {
        switchEditMode(defaultEditMode);
      }
    }
  }, [activeTab, editMode, defaultEditMode, setEditMode, switchEditMode]);

  // ── Effect 3: Close structure sidebar when suggestions panel opens ────
  useEffect(() => {
    if (isSuggestionsOpen && isStructureOpen) {
      setIsStructureOpen(false);
    }
  }, [isSuggestionsOpen, isStructureOpen, setIsStructureOpen]);

  // ── Effect 4: Auto-open left panel after initial hydration only ───────
  const hasSyncedInitialLeftPanelRef = useRef(false);
  useEffect(() => {
    if (!isSessionHydrated) return;
    if (hasSyncedInitialLeftPanelRef.current) return;
    hasSyncedInitialLeftPanelRef.current = true;
    setIsLeftPanelOpen(!hasRealLyricContent);
  }, [hasRealLyricContent, isSessionHydrated, setIsLeftPanelOpen]);

  // ── Effect 5: Collapse left panel as soon as lyrics content appears ───
  // Covers all three entry points: file import, paste modal, direct typing.
  // Runs only after initial sync (ref guard) so it doesn't fight Effect 4.
  const prevHasRealLyricContentRef = useRef(false);
  useEffect(() => {
    if (!hasSyncedInitialLeftPanelRef.current) return;
    if (hasRealLyricContent && !prevHasRealLyricContentRef.current) {
      setIsLeftPanelOpen(false);
    }
    prevHasRealLyricContentRef.current = hasRealLyricContent;
  }, [hasRealLyricContent, setIsLeftPanelOpen]);

  return null;
}
