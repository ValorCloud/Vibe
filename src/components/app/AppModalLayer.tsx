/**
 * AppModalLayer
 * Consumes all required contexts directly — zero props from AppInnerContent.
 * Lazy-loads AppModals (already code-split). Owns the ErrorBoundary + Suspense
 * wrapper that was previously inlined in AppInnerContent.
 */
import React, { Suspense, lazy, useCallback } from 'react';
import { Spinner } from '@fluentui/react-components';
import { ErrorBoundary } from './ErrorBoundary';
import { useSongContext } from '../../contexts/SongContext';
import { useComposerContext } from '../../contexts/ComposerContext';
import { useAppStateContext } from '../../contexts/AppStateContext';
import { useVersionContext } from '../../contexts/VersionContext';
import { useAnalysisContext } from '../../contexts/AnalysisContext';
import { useSimilarityContext } from '../../contexts/SimilarityContext';
import { useImportHandlers } from '../../hooks/useImportHandlers';
import { useLibraryActions } from '../../hooks/useLibraryActions';
import { useModalHandlers } from '../../hooks/useModalHandlers';
import { useSessionActions } from '../../hooks/useSessionActions';
import { useSongEditor } from '../../hooks/useSongEditor';
import { useTopicMoodSuggester } from '../../hooks/useTopicMoodSuggester';
import { useTranslation } from '../../i18n';
import type { CloudFile } from '../../services/cloudStorage';
import { VIBE_EVENTS } from '../../constants/vibeEvents';

const AppModals = lazy(() =>
  import('./AppModals').then(m => ({ default: m.AppModals }))
);

function LazyFallback() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t.common?.loading ?? 'Loading'}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', width: '100%' }}
    >
      <Spinner size="small" />
    </div>
  );
}

export function AppModalLayer() {
  const {
    song,
    structure,
    title,
    setTitle,
    rhymeScheme,
    replaceStateWithoutHistory,
    navigateWithHistory,
    clearHistory,
    updateSongAndStructureWithHistory,
    setSongLanguage,
  } = useSongContext();

  const { clearSelection } = useComposerContext();

  const { appState } = useAppStateContext();
  const {
    theme, setTheme, audioFeedback, setAudioFeedback,
    uiScale, setUiScale, defaultEditMode, setDefaultEditMode,
    showTranslationFeatures, setShowTranslationFeatures,
    similarityMatches, setSimilarityMatches,
    libraryCount, setLibraryCount, libraryAssets, setLibraryAssets,
    isSavingToLibrary, setIsSavingToLibrary,
    setIsSaveToLibraryModalOpen,
    setIsExportModalOpen,
    setIsSettingsOpen, setIsAboutOpen,
    setIsKeyboardShortcutsModalOpen, setIsSearchReplaceOpen,
    setIsPasteModalOpen,
    importInputRef,
    setIsResetModalOpen,
    setIsLeftPanelOpen,
    editMode, markupText,
    hasApiKey,
    cloudStoragePickerMode,
  } = appState;

  const {
    pastedText, setPastedText,
    isAnalyzing, isAnalyzingTheme, importProgress,
    analysisReport, analysisSteps,
    appliedAnalysisItems, selectedAnalysisItems, isApplyingAnalysis,
    targetLanguage, setTargetLanguage,
    sectionTargetLanguages, setSectionTargetLanguages,
    toggleAnalysisItemSelection, applyAnalysisItem, applySelectedAnalysisItems,
    clearAppliedAnalysisItems, analyzePastedLyrics,
  } = useAnalysisContext();

  const { versions, saveVersion, rollbackToVersion, rollbackSectionToVersion, handleRequestVersionName } = useVersionContext();

  const { index: webSimilarityIndex, triggerNow: triggerWebSimilarity, resetIndex: resetWebSimilarityIndex } = useSimilarityContext();

  const { resetSuggestionCycle } = useTopicMoodSuggester({ hasApiKey });

  const { exportSong, loadFileForAnalysis, getShareUrl } = useSongEditor({
    openPasteModalWithText: (text: string) => { setPastedText(text); setIsPasteModalOpen(true); },
  });

  const { handleImportInputChange, handleImportChooseFile } = useImportHandlers({
    importInputRef,
    loadFileForAnalysis,
    setIsPasteModalOpen,
    setPastedText,
    setSongLanguage,
    setSongTitle: setTitle,
    onComplete: () => setIsLeftPanelOpen(false),
  });

  // Cloud storage — branche selon le mode
  const handleCloudFileLoaded = useCallback((file: CloudFile) => {
    setIsLeftPanelOpen(false);
    if (cloudStoragePickerMode === 'player' || cloudStoragePickerMode === 'player-files') {
      // Both player modes dispatch to PlayerTab via custom event.
      // PlayerTab listener reads file.fileList (AudioFileEntry[]) and adds tracks.
      window.dispatchEvent(new CustomEvent(VIBE_EVENTS.PLAYER_FOLDER_LOADED, { detail: file }));
      return;
    }
    // Mode lyrics : comportement original
    loadFileForAnalysis(new File([file.content], file.name, { type: 'text/plain' }));
  }, [loadFileForAnalysis, setIsLeftPanelOpen, cloudStoragePickerMode]);

  // Fold the left panel when the user confirms paste-analyze.
  const handleAnalyzePastedLyrics = useCallback(() => {
    setIsLeftPanelOpen(false);
    analyzePastedLyrics();
  }, [setIsLeftPanelOpen, analyzePastedLyrics]);

  const {
    handleSaveToLibrary, handleLoadLibraryAsset,
    handleDeleteLibraryAsset, handlePurgeLibrary,
    saveLibraryError, clearSaveLibraryError,
  } = useLibraryActions({
    setSimilarityMatches,
    setLibraryCount,
    setLibraryAssets,
    setIsSavingToLibrary,
    setIsSaveToLibraryModalOpen,
  });

  const { handleSectionTargetLanguageChange } = useModalHandlers({
    setIsPasteModalOpen,
    setIsExportModalOpen,
    setIsSettingsOpen,
    setIsAboutOpen,
    setIsKeyboardShortcutsModalOpen,
    setIsSearchReplaceOpen,
    setSectionTargetLanguages,
  });

  const { resetSong } = useSessionActions({
    song,
    structure,
    rhymeScheme,
    appState,
    replaceStateWithoutHistory,
    navigateWithHistory,
    clearHistory,
    clearSelection,
    resetWebSimilarityIndex,
    resetSuggestionCycle,
    updateSongAndStructureWithHistory,
    setIsResetModalOpen,
  });

  return (
    <ErrorBoundary>
      <Suspense fallback={<LazyFallback />}>
        <AppModals
          theme={theme} setTheme={setTheme}
          audioFeedback={audioFeedback} setAudioFeedback={setAudioFeedback}
          uiScale={uiScale} setUiScale={setUiScale}
          defaultEditMode={defaultEditMode} setDefaultEditMode={setDefaultEditMode}
          showTranslationFeatures={showTranslationFeatures} setShowTranslationFeatures={setShowTranslationFeatures}
          handleImportChooseFile={handleImportChooseFile}
          handleImportInputChange={handleImportInputChange}
          onCloudFileLoaded={handleCloudFileLoaded}
          cloudPickerMode={cloudStoragePickerMode}
          exportSong={exportSong}
          getShareUrl={getShareUrl}
          pastedText={pastedText} setPastedText={setPastedText}
          isAnalyzing={isAnalyzing}
          isAnalyzingTheme={isAnalyzingTheme}
          importProgress={importProgress}
          analyzePastedLyrics={handleAnalyzePastedLyrics}
          analysisReport={analysisReport} analysisSteps={analysisSteps}
          appliedAnalysisItems={appliedAnalysisItems}
          selectedAnalysisItems={selectedAnalysisItems}
          isApplyingAnalysis={isApplyingAnalysis}
          toggleAnalysisItemSelection={toggleAnalysisItemSelection}
          applyAnalysisItem={applyAnalysisItem}
          applySelectedAnalysisItems={applySelectedAnalysisItems}
          clearAppliedAnalysisItems={clearAppliedAnalysisItems}
          versions={versions} rollbackToVersion={rollbackToVersion} rollbackSectionToVersion={rollbackSectionToVersion}
          similarityMatches={similarityMatches} libraryCount={libraryCount}
          webSimilarityIndex={webSimilarityIndex} triggerWebSimilarity={triggerWebSimilarity}
          handleDeleteLibraryAsset={handleDeleteLibraryAsset}
          handleSaveToLibrary={handleSaveToLibrary} isSavingToLibrary={isSavingToLibrary}
          saveLibraryError={saveLibraryError} clearSaveLibraryError={clearSaveLibraryError}
          title={title} song={song} libraryAssets={libraryAssets} hasCurrentSong={song.length > 0}
          handleLoadLibraryAsset={handleLoadLibraryAsset}
          handlePurgeLibrary={handlePurgeLibrary}
          saveVersion={saveVersion}
          handleRequestVersionName={handleRequestVersionName}
          resetSong={resetSong}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
