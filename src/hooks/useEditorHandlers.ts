/**
 * useEditorHandlers
 * Aggregates all action/handler hooks for AppEditorLayout.
 * Receives the output of useEditorState to avoid double context reads.
 *
 * NOTE: useTitleGenerator and useTopicMoodSuggester have been migrated to
 * ComposerParamsContext — they must NOT be instantiated here to avoid
 * double-instance side-effects (double auto-suggest, double auto-title).
 */
import { useCallback } from 'react';
import { useTranslation } from '../i18n';
import { useSongEditor } from './useSongEditor';
import { useAppHandlers } from './useAppHandlers';
import { useModalHandlers } from './useModalHandlers';
import { useSessionActions } from './useSessionActions';
import { useLibraryActions } from './useLibraryActions';
import { useImportHandlers } from './useImportHandlers';
import type { useEditorState } from './useEditorState';

type EditorState = ReturnType<typeof useEditorState>;

interface UseEditorHandlersProps {
  state: EditorState;
  isMobileOrTablet: boolean;
}

export function useEditorHandlers({ state, isMobileOrTablet }: UseEditorHandlersProps) {
  const { t } = useTranslation();

  const {
    song, structure, rhymeScheme,
    appState,
    replaceStateWithoutHistory, navigateWithHistory, clearHistory, clearSelection,
    resetWebSimilarityIndex,
    updateSongAndStructureWithHistory,
    setSongLanguage,
    setTitle,
    setTitleOrigin,
    setPastedText,
    setSectionTargetLanguages,
    hasRealLyricContent,
    scrollToSectionFn,
    generateSong,
  } = state;

  const {
    setActiveTab,
    setIsLeftPanelOpen,
    setIsStructureOpen,
    setApiErrorModal,
    setConfirmModal,
    setIsPasteModalOpen,
    setIsExportModalOpen,
    setIsSettingsOpen,
    setIsAboutOpen,
    setIsKeyboardShortcutsModalOpen,
    setIsSearchReplaceOpen,
    setIsResetModalOpen,
    setIsSaveToLibraryModalOpen,
    setIsSavingToLibrary,
    setSimilarityMatches,
    setLibraryCount,
    setLibraryAssets,
    setIsAnalysisPanelOpen,
    importInputRef,
  } = appState;

  // ── Song editor (add/remove structure, file analysis) ───────────────────────
  const { removeStructureItem, addStructureItem, normalizeStructure, loadFileForAnalysis } = useSongEditor({
    openPasteModalWithText: (text: string) => {
      setPastedText(text);
      setIsPasteModalOpen(true);
    },
  });

  // ── App-level handlers ────────────────────────────────────────────
  const {
    handleApiKeyHelp,
    handleTitleChange,
    handleGlobalRegenerate,
    handleScrollToSection,
    handleOpenNewGeneration,
  } = useAppHandlers({
    t,
    hasRealLyricContent,
    isMobileOrTablet,
    setApiErrorModal,
    setConfirmModal,
    setActiveTab,
    setIsLeftPanelOpen,
    setIsStructureOpen,
    generateSong,
    scrollToSection: scrollToSectionFn,
  });

  // ── Modal handlers ─────────────────────────────────────────────
  const {
    handleOpenPasteModal,
    handleOpenExport,
    handleOpenSettings,
    handleOpenAbout,
    handleOpenKeyboardShortcuts,
    handleOpenSearch,
    handleSectionTargetLanguageChange,
  } = useModalHandlers({
    setIsPasteModalOpen,
    setIsExportModalOpen,
    setIsSettingsOpen,
    setIsAboutOpen,
    setIsKeyboardShortcutsModalOpen,
    setIsSearchReplaceOpen,
    setSectionTargetLanguages,
  });

  // ── Session actions ──────────────────────────────────────────────
  const { handleCreateEmptySong } = useSessionActions({
    song,
    structure,
    rhymeScheme,
    appState,
    replaceStateWithoutHistory,
    navigateWithHistory,
    clearHistory,
    clearSelection,
    resetWebSimilarityIndex,
    resetSuggestionCycle: () => { /* managed by ComposerParamsContext */ },
    updateSongAndStructureWithHistory,
    setIsResetModalOpen,
  });

  // ── Library actions ──────────────────────────────────────────────
  const { handleOpenSaveToLibraryModal } = useLibraryActions({
    setSimilarityMatches,
    setLibraryCount,
    setLibraryAssets,
    setIsSavingToLibrary,
    setIsSaveToLibraryModalOpen,
  });

  // ── Import handlers ──────────────────────────────────────────────
  // Set title origin to 'user' so the auto-title generator does not overwrite
  // a title extracted from an imported file.
  const handleSetImportTitle = useCallback((v: string) => {
    setTitle(v);
    setTitleOrigin('user');
  }, [setTitle, setTitleOrigin]);

  const { handleImportInputChange, handleImportChooseFile } = useImportHandlers({
    importInputRef,
    loadFileForAnalysis,
    setIsPasteModalOpen,
    setPastedText,
    setSongLanguage,
    setSongTitle: handleSetImportTitle,
  });

  // ── Derived composite callbacks ───────────────────────────────────────
  const handleGenerateSongFromLeftPanel = useCallback(() => {
    setIsLeftPanelOpen(false);
    handleGlobalRegenerate();
  }, [setIsLeftPanelOpen, handleGlobalRegenerate]);

  const handleToggleAnalysisPanel = useCallback(() => {
    setIsAnalysisPanelOpen((prev: boolean) => !prev);
  }, [setIsAnalysisPanelOpen]);

  const handleCloseAnalysisPanel = useCallback(() => {
    setIsAnalysisPanelOpen(false);
  }, [setIsAnalysisPanelOpen]);

  return {
    // Song structure
    removeStructureItem,
    addStructureItem,
    normalizeStructure,
    loadFileForAnalysis,
    // Title
    handleTitleChange,
    // App handlers
    handleApiKeyHelp,
    handleGlobalRegenerate,
    handleScrollToSection,
    handleOpenNewGeneration,
    // Modal handlers
    handleOpenPasteModal,
    handleOpenImport: handleImportChooseFile,
    handleOpenExport,
    handleOpenSettings,
    handleOpenAbout,
    handleOpenKeyboardShortcuts,
    handleOpenSearch,
    handleSectionTargetLanguageChange,
    // Session
    handleCreateEmptySong,
    // Library
    handleOpenSaveToLibraryModal,
    // Import
    handleImportInputChange,
    handleImportChooseFile,
    // Composite
    handleGenerateSongFromLeftPanel,
    handleToggleAnalysisPanel,
    handleCloseAnalysisPanel,
  };
}
