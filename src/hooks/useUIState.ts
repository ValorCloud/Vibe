/**
 * useUIState — ephemeral UI state
 *
 * Navigation state (activeTab, isStructureOpen, isLeftPanelOpen) can be
 * seeded from a SessionSnapshot loaded before first render (OPFS restore).
 * All other state is ephemeral and always resets to defaults.
 */
import { useState, useRef, useEffect } from 'react';
import type { EditMode } from '../types';
import type { PickMode } from '../services/cloudStorage';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';
import { VIBE_EVENTS } from '../constants/vibeEvents';

const SPLASH_SHOWN_KEY = 'vibe_splash_shown';
const shouldShowSplash = (): boolean => {
  try {
    if (safeGetItem(SPLASH_SHOWN_KEY)) return false;
    safeSetItem(SPLASH_SHOWN_KEY, '1');
    return true;
  } catch {
    return false;
  }
};

export type AppTab = 'lyrics' | 'musical' | 'player';

export interface NavInitial {
  activeTab?: AppTab;
  isStructureOpen?: boolean;
  isLeftPanelOpen?: boolean;
}

export function useUIState(initial?: NavInitial) {
  // ── Modals ──────────────────────────────────────────────────────────
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(() => shouldShowSplash());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiErrorModal, setApiErrorModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);
  const [isSimilarityModalOpen, setIsSimilarityModalOpen] = useState(false);
  const [isSaveToLibraryModalOpen, setIsSaveToLibraryModalOpen] = useState(false);
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isKeyboardShortcutsModalOpen, setIsKeyboardShortcutsModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; onConfirm: () => void } | null>(null);
  const [promptModal, setPromptModal] = useState<{ open: boolean; onConfirm: (value: string) => void } | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isSearchReplaceOpen, setIsSearchReplaceOpen] = useState(false);
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);
  const [isCloudStoragePickerOpen, setIsCloudStoragePickerOpen] = useState(false);
  const [cloudStoragePickerMode, setCloudStoragePickerMode] = useState<PickMode>('lyrics');

  // ── Navigation ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<AppTab>(initial?.activeTab ?? 'lyrics');
  const [isStructureOpen, setIsStructureOpen] = useState(initial?.isStructureOpen ?? false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(initial?.isLeftPanelOpen ?? true);

  // ── Edit mode ───────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState<EditMode>('markdown');
  const [markupText, setMarkupText] = useState('');
  const markupTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Import ref ───────────────────────────────────────────────────────
  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Global error event ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail;
      setApiErrorModal({ open: true, message: detail.message });
    };
    window.addEventListener(VIBE_EVENTS.API_ERROR, handler);
    return () => window.removeEventListener(VIBE_EVENTS.API_ERROR, handler);
  }, []);

  return {
    isAboutOpen, setIsAboutOpen,
    isSettingsOpen, setIsSettingsOpen,
    apiErrorModal, setApiErrorModal,
    isExportModalOpen, setIsExportModalOpen,
    isSectionDropdownOpen, setIsSectionDropdownOpen,
    isSimilarityModalOpen, setIsSimilarityModalOpen,
    isSaveToLibraryModalOpen, setIsSaveToLibraryModalOpen,
    isVersionsModalOpen, setIsVersionsModalOpen,
    isResetModalOpen, setIsResetModalOpen,
    isKeyboardShortcutsModalOpen, setIsKeyboardShortcutsModalOpen,
    confirmModal, setConfirmModal,
    promptModal, setPromptModal,
    isPasteModalOpen, setIsPasteModalOpen,
    isAnalysisModalOpen, setIsAnalysisModalOpen,
    isSearchReplaceOpen, setIsSearchReplaceOpen,
    isAnalysisPanelOpen, setIsAnalysisPanelOpen,
    isCloudStoragePickerOpen, setIsCloudStoragePickerOpen,
    cloudStoragePickerMode, setCloudStoragePickerMode,
    activeTab, setActiveTab,
    isStructureOpen, setIsStructureOpen,
    isLeftPanelOpen, setIsLeftPanelOpen,
    editMode, setEditMode,
    markupText, setMarkupText,
    markupTextareaRef,
    importInputRef,
  };
}
