/**
 * AppStateContext
 *
 * Accepts an optional initialSession to seed navigation state and
 * hasSavedSession flag from a preloaded OPFS snapshot.
 */
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { RefObject } from 'react';
import { useAppState } from '../hooks/useAppState';
import { useUIStateForProvider } from '../hooks/useUIStateForProvider';
import type { UIStateBag } from './ModalContext';
import type { SessionSnapshot } from '../lib/sessionPersistence';
import type { AppTab } from '../hooks/useUIState';

type AppStateBag = ReturnType<typeof useAppState>;

interface AppStateContextValue {
  appState: AppStateBag;
  uiStateForProvider: UIStateBag;
}

export interface AppNavigationValue {
  activeTab: AppTab;
  setActiveTab: (v: AppTab) => void;
  isStructureOpen: boolean;
  setIsStructureOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLeftPanelOpen: boolean;
  setIsLeftPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// Re-export for convenience
export type { AppTab };

const AppStateContext = createContext<AppStateContextValue | null>(null);
const AppNavigationContext = createContext<AppNavigationValue | null>(null);

interface AppStateProviderProps {
  children: ReactNode;
  initialSession?: SessionSnapshot | null;
}

export function AppStateProvider({ children, initialSession }: AppStateProviderProps) {
  const appState = useAppState(
    initialSession
      ? {
          navInitial: {
            activeTab: initialSession.activeTab,
            isStructureOpen: initialSession.isStructureOpen,
            isLeftPanelOpen: initialSession.isLeftPanelOpen,
          },
          hasSavedSessionInit: true,
        }
      : undefined,
  );

  const uiStateForProvider = useUIStateForProvider({
    setIsAboutOpen: appState.setIsAboutOpen,
    setIsSettingsOpen: appState.setIsSettingsOpen,
    setApiErrorModal: appState.setApiErrorModal,
    setIsExportModalOpen: appState.setIsExportModalOpen,
    setIsSectionDropdownOpen: appState.setIsSectionDropdownOpen,
    setIsSimilarityModalOpen: appState.setIsSimilarityModalOpen,
    setIsSaveToLibraryModalOpen: appState.setIsSaveToLibraryModalOpen,
    setIsVersionsModalOpen: appState.setIsVersionsModalOpen,
    setIsResetModalOpen: appState.setIsResetModalOpen,
    setIsKeyboardShortcutsModalOpen: appState.setIsKeyboardShortcutsModalOpen,
    setConfirmModal: appState.setConfirmModal,
    setPromptModal: appState.setPromptModal,
    setIsPasteModalOpen: appState.setIsPasteModalOpen,
    setIsAnalysisModalOpen: appState.setIsAnalysisModalOpen,
    setIsSearchReplaceOpen: appState.setIsSearchReplaceOpen,
    setIsAnalysisPanelOpen: appState.setIsAnalysisPanelOpen,
    setIsCloudStoragePickerOpen: appState.setIsCloudStoragePickerOpen,
    setCloudStoragePickerMode: appState.setCloudStoragePickerMode,
    setIsCloudSaveOpen: appState.setIsCloudSaveOpen,
    setCloudSaveProvider: appState.setCloudSaveProvider,
    setActiveTab: appState.setActiveTab,
    setIsStructureOpen: appState.setIsStructureOpen,
    setIsLeftPanelOpen: appState.setIsLeftPanelOpen,
    isAboutOpen: appState.isAboutOpen,
    isSettingsOpen: appState.isSettingsOpen,
    apiErrorModal: appState.apiErrorModal,
    isExportModalOpen: appState.isExportModalOpen,
    isSectionDropdownOpen: appState.isSectionDropdownOpen,
    isSimilarityModalOpen: appState.isSimilarityModalOpen,
    isSaveToLibraryModalOpen: appState.isSaveToLibraryModalOpen,
    isVersionsModalOpen: appState.isVersionsModalOpen,
    isResetModalOpen: appState.isResetModalOpen,
    isKeyboardShortcutsModalOpen: appState.isKeyboardShortcutsModalOpen,
    confirmModal: appState.confirmModal,
    promptModal: appState.promptModal,
    isPasteModalOpen: appState.isPasteModalOpen,
    isAnalysisModalOpen: appState.isAnalysisModalOpen,
    isSearchReplaceOpen: appState.isSearchReplaceOpen,
    isAnalysisPanelOpen: appState.isAnalysisPanelOpen,
    isCloudStoragePickerOpen: appState.isCloudStoragePickerOpen,
    cloudStoragePickerMode: appState.cloudStoragePickerMode,
    isCloudSaveOpen: appState.isCloudSaveOpen,
    cloudSaveProvider: appState.cloudSaveProvider,
    activeTab: appState.activeTab,
    isStructureOpen: appState.isStructureOpen,
    isLeftPanelOpen: appState.isLeftPanelOpen,
    importInputRef: appState.importInputRef as RefObject<HTMLInputElement>,
  });

  const contextValue = useMemo(
    () => ({ appState, uiStateForProvider }),
    [appState, uiStateForProvider],
  );

  const navigationValue = useMemo<AppNavigationValue>(
    () => ({
      activeTab: appState.activeTab,
      setActiveTab: appState.setActiveTab,
      isStructureOpen: appState.isStructureOpen,
      setIsStructureOpen: appState.setIsStructureOpen,
      isLeftPanelOpen: appState.isLeftPanelOpen,
      setIsLeftPanelOpen: appState.setIsLeftPanelOpen,
    }),
    [
      appState.activeTab,
      appState.setActiveTab,
      appState.isStructureOpen,
      appState.setIsStructureOpen,
      appState.isLeftPanelOpen,
      appState.setIsLeftPanelOpen,
    ],
  );

  return (
    <AppStateContext.Provider value={contextValue}>
      <AppNavigationContext.Provider value={navigationValue}>
        {children}
      </AppNavigationContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppStateContext(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppStateContext must be used inside <AppStateProvider>');
  return ctx;
}

export function useAppNavigationContext(): AppNavigationValue {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) throw new Error('useAppNavigationContext must be used inside <AppStateProvider>');
  return ctx;
}

export function useOptionalAppNavigationContext(): AppNavigationValue | null {
  return useContext(AppNavigationContext);
}
