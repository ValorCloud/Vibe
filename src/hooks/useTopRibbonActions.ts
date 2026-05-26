/**
 * useTopRibbonActions
 *
 * Aggregates all stable action callbacks consumed by TopRibbon.
 * Replaces 9 individual modal-callback props that were previously drilled
 * from AppEditorLayout → TopRibbon.
 *
 * Consumers of TopRibbon no longer need to pass:
 *   setIsVersionsModalOpen, setIsResetModalOpen, onImportClick,
 *   onExportClick, onOpenLibraryClick, onOpenSettingsClick, onOpenAboutClick,
 *   onOpenKeyboardShortcutsClick, onPasteLyrics / canPasteLyrics (paste modal)
 *
 * These are now sourced directly from ModalContext (openModal) and
 * AnalysisContext (canPasteLyrics, isAnalyzing).
 */
import { useCallback } from 'react';
import { useModalDispatch, useModalState } from '../contexts/ModalContext';
import { useAnalysisContext } from '../contexts/AnalysisContext';

export interface TopRibbonActions {
  openVersionsModal: () => void;
  openResetModal: () => void;
  openImport: () => void;
  openExport: () => void;
  openLibrary: () => void;
  openSettings: () => void;
  openAbout: () => void;
  openKeyboardShortcuts: () => void;
  openPasteModal: () => void;
  /** mode:'lyrics' — ouvre le picker cloud pour sélectionner un fichier de paroles */
  openCloudStorageLyrics: () => void;
  /** mode:'player' — ouvre le picker cloud pour sélectionner un dossier audio */
  openCloudStoragePlayer: () => void;
  /** mode:'player-files' — ouvre le picker cloud multi-sélection fichiers audio */
  openCloudStoragePlayerFiles: () => void;
  canPasteLyrics: boolean;
  isAnalyzing: boolean;
}

export function useTopRibbonActions(): TopRibbonActions {
  const { openModal } = useModalDispatch();
  const { uiState } = useModalState();
  const { canPasteLyrics, isAnalyzing } = useAnalysisContext();

  const openVersionsModal           = useCallback(() => openModal('versions'),                                  [openModal]);
  const openResetModal              = useCallback(() => openModal('reset'),                                     [openModal]);
  const openImport                  = useCallback(() => uiState.importInputRef.current?.click(),                [uiState.importInputRef]);
  const openExport                  = useCallback(() => openModal('export'),                                    [openModal]);
  const openLibrary                 = useCallback(() => openModal('saveToLibrary'),                            [openModal]);
  const openSettings                = useCallback(() => openModal('settings'),                                 [openModal]);
  const openAbout                   = useCallback(() => openModal('about'),                                    [openModal]);
  const openKeyboardShortcuts       = useCallback(() => openModal('keyboardShortcuts'),                        [openModal]);
  const openPasteModal              = useCallback(() => openModal('paste'),                                    [openModal]);
  const openCloudStorageLyrics      = useCallback(() => openModal('cloudStorage', { mode: 'lyrics' }),         [openModal]);
  const openCloudStoragePlayer      = useCallback(() => openModal('cloudStorage', { mode: 'player' }),         [openModal]);
  const openCloudStoragePlayerFiles = useCallback(() => openModal('cloudStorage', { mode: 'player-files' }),   [openModal]);

  return {
    openVersionsModal,
    openResetModal,
    openImport,
    openExport,
    openLibrary,
    openSettings,
    openAbout,
    openKeyboardShortcuts,
    openPasteModal,
    openCloudStorageLyrics,
    openCloudStoragePlayer,
    openCloudStoragePlayerFiles,
    canPasteLyrics,
    isAnalyzing,
  };
}
