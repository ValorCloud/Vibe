import React, { useEffect, useState } from 'react';
import { AboutModal } from './modals/AboutModal';
import { SettingsModal } from './modals/SettingsModal';
import { ExportModal } from './modals/ExportModal';
import { PasteModal } from './modals/PasteModal';
import { AnalysisModal } from './modals/AnalysisModal';
import { SimilarityModal } from './modals/SimilarityModal';
import { SaveToLibraryModal } from './modals/SaveToLibraryModal';
import { VersionsModal } from './modals/VersionsModal';
import { ResetModal } from './modals/ResetModal';
import { KeyboardShortcutsModal } from './modals/KeyboardShortcutsModal';
import { ApiErrorModal } from './modals/ApiErrorModal';
import { ConfirmModal } from './modals/ConfirmModal';
import { PromptModal } from './modals/PromptModal';
import { SearchReplaceModal } from './modals/SearchReplaceModal';
import { CloudStoragePickerModal } from './modals/CloudStoragePickerModal';
import { ErrorBoundary } from './ErrorBoundary';
import { useModalDispatch, useModalState } from '../../contexts/ModalContext';
import type { LibraryAsset } from '../../utils/libraryUtils';
import type { SimilarityMatch } from '../../utils/similarityUtils';
import type { SongVersion } from '../../types';
import type { WebSimilarityIndex } from '../../types/webSimilarity';
import type { ExportFormat } from '../../utils/exportUtils';
import type { VersionSnapshot } from '../../utils/songDefaults';
import type { CloudFile } from '../../services/cloudStorage';
import { useTranslation } from '../../i18n';

/**
 * Business-only props — no modal open/close state.
 * All UI state is read from ModalContext.
 */
interface Props {
  // Theme / audio (still needed by SettingsModal)
  theme: 'light' | 'dark';
  setTheme: (v: 'light' | 'dark') => void;
  audioFeedback: boolean;
  setAudioFeedback: (v: boolean) => void;
  uiScale: 'small' | 'medium' | 'large';
  setUiScale: (v: 'small' | 'medium' | 'large') => void;
  defaultEditMode: 'text' | 'section' | 'markdown' | 'phonetic';
  setDefaultEditMode: (v: 'text' | 'section' | 'markdown' | 'phonetic') => void;
  showTranslationFeatures: boolean;
  setShowTranslationFeatures: (v: boolean) => void;

  // Import (file input only — no dialog)
  handleImportChooseFile: () => void;
  handleImportInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // Cloud storage
  onCloudFileLoaded: (file: CloudFile) => void;

  // Export
  exportSong: (format: ExportFormat) => Promise<void>;
  getShareUrl: () => string;

  // Paste / analysis (data props only)
  pastedText: string;
  setPastedText: (v: string) => void;
  isAnalyzing: boolean;
  /** Background theme analysis indicator (useBackgroundThemeAnalysis). */
  isAnalyzingTheme: boolean;
  importProgress: {
    current: number;
    total: number;
    currentLabel: string;
  };
  analyzePastedLyrics: () => void;
  analysisReport: {
    theme: string;
    emotionalArc: string;
    technicalAnalysis: string[];
    strengths: string[];
    improvements: string[];
    musicalSuggestions: string[];
    summary: string;
  } | null;
  analysisSteps: string[];
  appliedAnalysisItems: Set<string>;
  selectedAnalysisItems: Set<string>;
  isApplyingAnalysis: string | null;
  toggleAnalysisItemSelection: (id: string) => void;
  /** One-click apply for a single analysis item. */
  applyAnalysisItem: (item: string) => Promise<void>;
  applySelectedAnalysisItems: () => void;
  clearAppliedAnalysisItems: () => void;

  // Versions
  versions: SongVersion[];
  rollbackToVersion: (version: SongVersion) => void;
  rollbackSectionToVersion: (version: SongVersion, sectionId: string) => void;
  saveVersion: (name: string, snapshot?: VersionSnapshot) => void;
  handleRequestVersionName: (callback: (name: string) => void) => void;

  // Similarity
  similarityMatches: SimilarityMatch[];
  libraryCount: number;
  webSimilarityIndex: WebSimilarityIndex;
  triggerWebSimilarity: () => void;
  handleDeleteLibraryAsset: (id: string) => Promise<void>;

  // Library
  handleSaveToLibrary: (name: string) => Promise<void>;
  handleLoadLibraryAsset: (asset: LibraryAsset) => void;
  handlePurgeLibrary: () => Promise<void>;
  isSavingToLibrary: boolean;
  saveLibraryError: string | null;
  clearSaveLibraryError: () => void;
  title: string;
  song: SongVersion['song'];
  libraryAssets: LibraryAsset[];
  hasCurrentSong: boolean;

  // Reset
  resetSong: () => void;
}

export const AppModals = React.memo(function AppModals({
  theme, setTheme, audioFeedback, setAudioFeedback, uiScale, setUiScale, defaultEditMode, setDefaultEditMode,
  showTranslationFeatures, setShowTranslationFeatures,
  handleImportChooseFile, handleImportInputChange,
  onCloudFileLoaded,
  exportSong, getShareUrl,
  pastedText, setPastedText, isAnalyzing, isAnalyzingTheme, importProgress, analyzePastedLyrics,
  analysisReport, analysisSteps,
  appliedAnalysisItems, selectedAnalysisItems, isApplyingAnalysis,
  toggleAnalysisItemSelection, applyAnalysisItem, applySelectedAnalysisItems, clearAppliedAnalysisItems,
  versions, rollbackToVersion, rollbackSectionToVersion, saveVersion, handleRequestVersionName,
  similarityMatches, libraryCount, webSimilarityIndex, triggerWebSimilarity, handleDeleteLibraryAsset,
  handleSaveToLibrary, handleLoadLibraryAsset, handlePurgeLibrary, isSavingToLibrary,
  saveLibraryError, clearSaveLibraryError,
  title, song, libraryAssets, hasCurrentSong,
  resetSong,
}: Props) {
  const { t } = useTranslation();
  const { closeModal, openModal } = useModalDispatch();
  const { uiState: ui } = useModalState();
  const { importInputRef } = ui;

  const [hasShownSplash, setHasShownSplash] = useState(false);
  const [showSplashMode, setShowSplashMode] = useState(false);

  useEffect(() => {
    if (!hasShownSplash) {
      setHasShownSplash(true);
      setShowSplashMode(true);
      openModal('about');
    }
  }, [hasShownSplash, openModal]);

  useEffect(() => {
    if (!ui.isAboutOpen && showSplashMode) {
      setShowSplashMode(false);
    }
  }, [ui.isAboutOpen, showSplashMode]);

  const openLibraryFromExport = () => { closeModal('export'); openModal('saveToLibrary'); };

  const confirmTitle = t.confirmModal?.regenerateTitle ?? 'Regenerate Song';
  const confirmLabel = t.confirmModal?.regenerateConfirm ?? 'Regenerate';
  const confirmCancel = t.confirmModal?.cancel ?? 'Cancel';
  const promptTitle = t.promptModal?.saveVersionTitle ?? 'Save Version';
  const promptMessage = t.promptModal?.saveVersionMessage ?? 'Enter a name for this version:';
  const promptPlaceholder = t.promptModal?.saveVersionPlaceholder ?? 'Version name';
  const promptConfirm = t.promptModal?.saveVersionConfirm ?? 'Save';
  const promptCancel = t.promptModal?.cancel ?? 'Cancel';

  return (
    <>
      <AboutModal
        isOpen={ui.isAboutOpen}
        onClose={() => closeModal('about')}
        isSplashScreen={showSplashMode}
      />
      <SettingsModal
        isOpen={ui.isSettingsOpen} onClose={() => closeModal('settings')}
        theme={theme} setTheme={setTheme}
        audioFeedback={audioFeedback} setAudioFeedback={setAudioFeedback}
        uiScale={uiScale} setUiScale={setUiScale}
        defaultEditMode={defaultEditMode} setDefaultEditMode={setDefaultEditMode}
        showTranslationFeatures={showTranslationFeatures} setShowTranslationFeatures={setShowTranslationFeatures}
      />
      <ExportModal
        isOpen={ui.isExportModalOpen}
        onClose={() => closeModal('export')}
        onOpenLibrary={openLibraryFromExport}
        onExport={exportSong}
        getShareUrl={getShareUrl}
      />
      <ErrorBoundary label="AI analysis">
        <>
          <PasteModal
            isOpen={ui.isPasteModalOpen} onClose={() => closeModal('paste')}
            pastedText={pastedText} setPastedText={setPastedText}
            isAnalyzing={isAnalyzing} importProgress={importProgress} onAnalyze={analyzePastedLyrics}
          />
          <AnalysisModal
            isOpen={ui.isAnalysisModalOpen} onClose={() => closeModal('analysis')}
            isAnalyzing={isAnalyzing} isAnalyzingTheme={isAnalyzingTheme}
            analysisReport={analysisReport} analysisSteps={analysisSteps}
            appliedAnalysisItems={appliedAnalysisItems} selectedAnalysisItems={selectedAnalysisItems}
            isApplyingAnalysis={isApplyingAnalysis}
            toggleAnalysisItemSelection={toggleAnalysisItemSelection}
            applyAnalysisItem={applyAnalysisItem}
            applySelectedAnalysisItems={applySelectedAnalysisItems}
            clearAppliedAnalysisItems={clearAppliedAnalysisItems}
            versions={versions} rollbackToVersion={rollbackToVersion}
          />
        </>
      </ErrorBoundary>
      <SimilarityModal
        isOpen={ui.isSimilarityModalOpen} onClose={() => closeModal('similarity')}
        matches={similarityMatches} candidateCount={libraryCount}
        webIndex={webSimilarityIndex} onWebRefresh={triggerWebSimilarity}
        onDeleteLibraryAsset={handleDeleteLibraryAsset}
      />
      <SaveToLibraryModal
        isOpen={ui.isSaveToLibraryModalOpen} onClose={() => closeModal('saveToLibrary')}
        onSave={() => handleSaveToLibrary(title)}
        onLoadAsset={handleLoadLibraryAsset}
        onDeleteAsset={handleDeleteLibraryAsset} onPurgeLibrary={handlePurgeLibrary}
        isSaving={isSavingToLibrary}
        saveError={saveLibraryError} onDismissError={clearSaveLibraryError}
        currentTitle={title} libraryAssets={libraryAssets} hasCurrentSong={hasCurrentSong}
      />
      <VersionsModal
        isOpen={ui.isVersionsModalOpen} versions={versions}
        onClose={() => closeModal('versions')} onSaveCurrent={saveVersion}
        onRollback={rollbackToVersion} onRollbackSection={rollbackSectionToVersion}
        onRequestVersionName={handleRequestVersionName} currentSong={song}
      />
      <ResetModal isOpen={ui.isResetModalOpen} onClose={() => closeModal('reset')} onConfirm={resetSong} />
      <KeyboardShortcutsModal
        isOpen={ui.isKeyboardShortcutsModalOpen}
        onClose={() => closeModal('keyboardShortcuts')}
      />
      <SearchReplaceModal
        isOpen={ui.isSearchReplaceOpen}
        onClose={() => closeModal('searchReplace')}
      />
      <CloudStoragePickerModal
        isOpen={ui.isCloudStoragePickerOpen}
        onClose={() => closeModal('cloudStorage')}
        onFileLoaded={onCloudFileLoaded}
      />
      <ApiErrorModal
        isOpen={ui.apiErrorModal.open} onClose={() => closeModal('apiError')}
        message={ui.apiErrorModal.message}
      />
      {ui.confirmModal && (
        <ConfirmModal
          isOpen={ui.confirmModal.open}
          title={confirmTitle}
          message={t.editor.regenerateWarning}
          confirmLabel={confirmLabel}
          cancelLabel={confirmCancel}
          onConfirm={ui.confirmModal.onConfirm}
          onCancel={() => closeModal('confirm')}
        />
      )}
      {ui.promptModal && (
        <PromptModal
          isOpen={ui.promptModal.open}
          title={promptTitle}
          message={promptMessage}
          placeholder={promptPlaceholder}
          confirmLabel={promptConfirm}
          cancelLabel={promptCancel}
          onConfirm={ui.promptModal.onConfirm}
          onCancel={() => closeModal('prompt')}
        />
      )}
      <input
        ref={importInputRef} type="file" accept=".txt,.md,.json,.docx,.odt"
        className="hidden" onChange={handleImportInputChange}
      />
    </>
  );
});
