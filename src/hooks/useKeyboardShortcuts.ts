import { useEffect } from 'react';
import { useModalDispatch, useModalState } from '../contexts/ModalContext';

export type KeyboardShortcutCategory = 'edit' | 'navigation' | 'file' | 'ai';

export type KeyboardShortcutId =
  | 'undo'
  | 'redo'
  | 'dismissReset'
  | 'dismissNavigation'
  | 'dismissFileDialogs'
  | 'dismissAiDialogs'
  | 'openSearch'
  | 'goToMusical'
  | 'lyriaGenerate';

export type KeyboardShortcutModifier = 'ctrlOrMeta' | 'shift' | 'alt';

export interface KeyboardShortcutCombo {
  key: string;
  modifiers: readonly KeyboardShortcutModifier[];
}

export interface KeyboardShortcutMetadata {
  id: KeyboardShortcutId;
  category: KeyboardShortcutCategory;
  combos: readonly KeyboardShortcutCombo[];
}

export const KEYBOARD_SHORTCUTS_METADATA: readonly KeyboardShortcutMetadata[] = [
  {
    id: 'undo',
    category: 'edit',
    combos: [{ key: 'Z', modifiers: ['ctrlOrMeta'] }],
  },
  {
    id: 'redo',
    category: 'edit',
    combos: [{ key: 'Z', modifiers: ['ctrlOrMeta', 'shift'] }],
  },
  {
    id: 'dismissReset',
    category: 'edit',
    combos: [{ key: 'Escape', modifiers: [] }],
  },
  {
    id: 'dismissNavigation',
    category: 'navigation',
    combos: [{ key: 'Escape', modifiers: [] }],
  },
  {
    id: 'dismissFileDialogs',
    category: 'file',
    combos: [{ key: 'Escape', modifiers: [] }],
  },
  {
    id: 'dismissAiDialogs',
    category: 'ai',
    combos: [{ key: 'Escape', modifiers: [] }],
  },
  {
    id: 'openSearch',
    category: 'edit',
    combos: [{ key: 'f', modifiers: ['ctrlOrMeta'] }],
  },
  {
    id: 'goToMusical',
    category: 'navigation',
    combos: [{ key: 'b', modifiers: ['alt'] }],
  },
  {
    id: 'lyriaGenerate',
    category: 'ai',
    combos: [{ key: 'a', modifiers: ['alt'] }],
  },
] as const;

type UseKeyboardShortcutsParams = {
  isMobileOrTablet: boolean;
  closeMobilePanels: () => void;
  undo: () => void;
  redo: () => void;
  onLyriaGenerate?: () => void;
};

export const useKeyboardShortcuts = ({
  isMobileOrTablet,
  closeMobilePanels,
  undo,
  redo,
  onLyriaGenerate,
}: UseKeyboardShortcutsParams) => {
  const { closeModal, openModal } = useModalDispatch();
  const { uiState } = useModalState();
  const {
    promptModal,
    confirmModal,
    apiErrorModal,
    isResetModalOpen,
    isVersionsModalOpen,
    isSaveToLibraryModalOpen,
    isSimilarityModalOpen,
    isAnalysisModalOpen,
    isPasteModalOpen,
    isExportModalOpen,
    isSettingsOpen,
    isAboutOpen,
    isSearchReplaceOpen,
    isKeyboardShortcutsModalOpen,
    setActiveTab,
    setPromptModal,
    setConfirmModal,
    setApiErrorModal,
    setIsResetModalOpen,
    setIsVersionsModalOpen,
    setIsSaveToLibraryModalOpen,
    setIsSimilarityModalOpen,
    setIsAnalysisModalOpen,
    setIsPasteModalOpen,
    setIsExportModalOpen,
    setIsSettingsOpen,
    setIsAboutOpen,
    setIsSearchReplaceOpen,
    setIsKeyboardShortcutsModalOpen,
  } = uiState;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      // Alt+B — aller à l'onglet Musical
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'b') {
        e.preventDefault();
        setActiveTab('musical');
        return;
      }

      // Alt+A — déclencher la génération Lyria Preview (si callback fourni)
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'a') {
        e.preventDefault();
        onLyriaGenerate?.();
        return;
      }

      if (e.key === 'Escape') {
        if (isSearchReplaceOpen) { closeModal('searchReplace'); return; }
        if (promptModal?.open) { setPromptModal(null); return; }
        if (confirmModal?.open) { setConfirmModal(null); return; }
        if (apiErrorModal.open) { closeModal('apiError'); return; }
        if (isResetModalOpen) { closeModal('reset'); return; }
        if (isVersionsModalOpen) { closeModal('versions'); return; }
        if (isSaveToLibraryModalOpen) { closeModal('saveToLibrary'); return; }
        if (isSimilarityModalOpen) { closeModal('similarity'); return; }
        if (isAnalysisModalOpen) { closeModal('analysis'); return; }
        if (isPasteModalOpen) { closeModal('paste'); return; }
        if (isExportModalOpen) { closeModal('export'); return; }
        if (isSettingsOpen) { closeModal('settings'); return; }
        if (isAboutOpen) { closeModal('about'); return; }
        if (isKeyboardShortcutsModalOpen) { setIsKeyboardShortcutsModalOpen(false); return; }
        if (isMobileOrTablet) { closeMobilePanels(); return; }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        openModal('searchReplace');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    apiErrorModal.open, confirmModal, isAboutOpen, isAnalysisModalOpen, isExportModalOpen,
    isMobileOrTablet, isPasteModalOpen, isResetModalOpen,
    isSaveToLibraryModalOpen, isSettingsOpen, isSimilarityModalOpen, isVersionsModalOpen,
    isSearchReplaceOpen, isKeyboardShortcutsModalOpen,
    promptModal, closeMobilePanels, redo,
    closeModal, openModal,
    setPromptModal, setConfirmModal,
    setIsAboutOpen, setIsAnalysisModalOpen, setIsExportModalOpen,
    setIsPasteModalOpen, setIsResetModalOpen, setIsSaveToLibraryModalOpen, setIsSettingsOpen,
    setIsSimilarityModalOpen, setIsVersionsModalOpen,
    setApiErrorModal, undo,
    setIsSearchReplaceOpen, setIsKeyboardShortcutsModalOpen,
    setActiveTab, onLyriaGenerate,
  ]);
};
