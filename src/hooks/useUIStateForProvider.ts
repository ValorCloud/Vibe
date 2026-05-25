/**
 * useUIStateForProvider
 *
 * Produces a stable UIStateBag reference for ModalProvider.
 *
 * editMode / setEditMode / markupText / setMarkupText / markupTextareaRef
 * have been moved to EditorContext and are no longer part of UIStateBag.
 * This reduces the dep array, eliminating keystroke-triggered invalidation
 * of ModalStateContext.
 *
 * useState setters have referential stability across renders, so they do
 * not contribute to invalidation in practice.
 */
import { useMemo } from 'react';
import type { UIStateBag } from '../contexts/ModalContext';
import type { UIStateSlice } from '../contexts/UIStateSlice';

export const useUIStateForProvider = (bag: UIStateSlice): UIStateBag => {
  const {
    setIsAboutOpen, setIsSettingsOpen, setApiErrorModal,
    setIsExportModalOpen, setIsSectionDropdownOpen,
    setIsSimilarityModalOpen, setIsSaveToLibraryModalOpen, setIsVersionsModalOpen,
    setIsResetModalOpen, setIsKeyboardShortcutsModalOpen,
    setConfirmModal, setPromptModal, setIsPasteModalOpen,
    setIsAnalysisModalOpen, setIsSearchReplaceOpen, setIsAnalysisPanelOpen,
    setIsCloudStoragePickerOpen,
    isAboutOpen, isSettingsOpen, apiErrorModal,
    isExportModalOpen, isSectionDropdownOpen,
    isSimilarityModalOpen, isSaveToLibraryModalOpen, isVersionsModalOpen,
    isResetModalOpen, isKeyboardShortcutsModalOpen,
    confirmModal, promptModal, isPasteModalOpen,
    isAnalysisModalOpen, isSearchReplaceOpen, isAnalysisPanelOpen,
    isCloudStoragePickerOpen,
    activeTab, setActiveTab,
    isStructureOpen, setIsStructureOpen,
    isLeftPanelOpen, setIsLeftPanelOpen,
    importInputRef,
  } = bag;

  return useMemo(() => ({
    setIsAboutOpen, setIsSettingsOpen, setApiErrorModal,
    setIsExportModalOpen, setIsSectionDropdownOpen,
    setIsSimilarityModalOpen, setIsSaveToLibraryModalOpen, setIsVersionsModalOpen,
    setIsResetModalOpen, setIsKeyboardShortcutsModalOpen,
    setConfirmModal, setPromptModal, setIsPasteModalOpen,
    setIsAnalysisModalOpen, setIsSearchReplaceOpen, setIsAnalysisPanelOpen,
    setIsCloudStoragePickerOpen,
    isAboutOpen, isSettingsOpen, apiErrorModal,
    isExportModalOpen, isSectionDropdownOpen,
    isSimilarityModalOpen, isSaveToLibraryModalOpen, isVersionsModalOpen,
    isResetModalOpen, isKeyboardShortcutsModalOpen,
    confirmModal, promptModal, isPasteModalOpen,
    isAnalysisModalOpen, isSearchReplaceOpen, isAnalysisPanelOpen,
    isCloudStoragePickerOpen,
    activeTab, setActiveTab,
    isStructureOpen, setIsStructureOpen,
    isLeftPanelOpen, setIsLeftPanelOpen,
    importInputRef,
  }), [
    setIsAboutOpen, setIsSettingsOpen, setApiErrorModal,
    setIsExportModalOpen, setIsSectionDropdownOpen,
    setIsSimilarityModalOpen, setIsSaveToLibraryModalOpen, setIsVersionsModalOpen,
    setIsResetModalOpen, setIsKeyboardShortcutsModalOpen,
    setConfirmModal, setPromptModal, setIsPasteModalOpen,
    setIsAnalysisModalOpen, setIsSearchReplaceOpen, setIsAnalysisPanelOpen,
    setIsCloudStoragePickerOpen,
    isAboutOpen, isSettingsOpen, apiErrorModal,
    isExportModalOpen, isSectionDropdownOpen,
    isSimilarityModalOpen, isSaveToLibraryModalOpen, isVersionsModalOpen,
    isResetModalOpen, isKeyboardShortcutsModalOpen,
    confirmModal, promptModal, isPasteModalOpen,
    isAnalysisModalOpen, isSearchReplaceOpen, isAnalysisPanelOpen,
    isCloudStoragePickerOpen,
    activeTab, setActiveTab,
    isStructureOpen, setIsStructureOpen,
    isLeftPanelOpen, setIsLeftPanelOpen,
    importInputRef,
  ]);
};
