import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AppModals } from './AppModals';
import { ModalProvider, type UIStateBag } from '../../contexts/ModalContext';

const shouldThrowAnalysisModal = vi.hoisted(() => ({ value: false }));

vi.mock('../../i18n', () => ({
  useTranslation: () => ({
    t: {
      confirmModal: {
        regenerateTitle: 'Regenerate Song',
        regenerateConfirm: 'Regenerate',
        cancel: 'Cancel',
      },
      promptModal: {
        saveVersionTitle: 'Save Version',
        saveVersionMessage: 'Enter a name for this version:',
        saveVersionPlaceholder: 'Version name',
        saveVersionConfirm: 'Save',
        cancel: 'Cancel',
      },
      editor: {
        regenerateWarning: 'Regenerate warning',
      },
    },
  }),
}));

vi.mock('./modals/AboutModal', () => ({
  AboutModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>About modal</div> : null),
}));

vi.mock('./modals/SettingsModal', () => ({
  SettingsModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Settings modal</div> : null),
}));

vi.mock('./modals/ExportModal', () => ({
  ExportModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Export modal</div> : null),
}));

vi.mock('./modals/PasteModal', () => ({
  PasteModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Paste modal</div> : null),
}));

vi.mock('./modals/AnalysisModal', () => ({
  AnalysisModal: ({ isOpen }: { isOpen: boolean }) => {
    if (isOpen && shouldThrowAnalysisModal.value) {
      throw new Error('Analysis crashed');
    }
    return isOpen ? <div>Analysis modal</div> : null;
  },
}));

vi.mock('./modals/SimilarityModal', () => ({
  SimilarityModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Similarity modal</div> : null),
}));

vi.mock('./modals/SaveToLibraryModal', () => ({
  SaveToLibraryModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Save to library modal</div> : null),
}));

vi.mock('./modals/VersionsModal', () => ({
  VersionsModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Versions modal</div> : null),
}));

vi.mock('./modals/ResetModal', () => ({
  ResetModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Reset modal</div> : null),
}));

vi.mock('./modals/KeyboardShortcutsModal', () => ({
  KeyboardShortcutsModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Keyboard shortcuts modal</div> : null),
}));

vi.mock('./modals/ApiErrorModal', () => ({
  ApiErrorModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>API error modal</div> : null),
}));

vi.mock('./modals/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Confirm modal</div> : null),
}));

vi.mock('./modals/PromptModal', () => ({
  PromptModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Prompt modal</div> : null),
}));

vi.mock('./modals/SearchReplaceModal', () => ({
  SearchReplaceModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Search replace modal</div> : null),
}));

vi.mock('./modals/CloudStoragePickerModal', () => ({
  CloudStoragePickerModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Cloud storage modal</div> : null),
}));

vi.mock('./modals/CloudSaveModal', () => ({
  CloudSaveModal: () => null,
}));

function createUiState(overrides: Partial<UIStateBag> = {}): UIStateBag {
  return {
    setIsAboutOpen: vi.fn(),
    setIsSettingsOpen: vi.fn(),
    setApiErrorModal: vi.fn(),
    setIsExportModalOpen: vi.fn(),
    setIsSectionDropdownOpen: vi.fn(),
    setIsSimilarityModalOpen: vi.fn(),
    setIsSaveToLibraryModalOpen: vi.fn(),
    setIsVersionsModalOpen: vi.fn(),
    setIsResetModalOpen: vi.fn(),
    setIsKeyboardShortcutsModalOpen: vi.fn(),
    setConfirmModal: vi.fn(),
    setPromptModal: vi.fn(),
    setIsPasteModalOpen: vi.fn(),
    setIsAnalysisModalOpen: vi.fn(),
    setIsSearchReplaceOpen: vi.fn(),
    setIsAnalysisPanelOpen: vi.fn(),
    setIsCloudStoragePickerOpen: vi.fn(),
    isAboutOpen: false,
    isSettingsOpen: false,
    apiErrorModal: { open: false, message: '' },
    isExportModalOpen: false,
    isSectionDropdownOpen: false,
    isSimilarityModalOpen: false,
    isSaveToLibraryModalOpen: false,
    isVersionsModalOpen: false,
    isResetModalOpen: false,
    isKeyboardShortcutsModalOpen: false,
    confirmModal: null,
    promptModal: null,
    isPasteModalOpen: false,
    isAnalysisModalOpen: false,
    isSearchReplaceOpen: false,
    isAnalysisPanelOpen: false,
    isCloudStoragePickerOpen: false,
    activeTab: 'lyrics',
    setActiveTab: vi.fn(),
    isStructureOpen: false,
    setIsStructureOpen: vi.fn(),
    isLeftPanelOpen: false,
    setIsLeftPanelOpen: vi.fn(),
    importInputRef: React.createRef<HTMLInputElement>(),
    ...overrides,
  };
}

function createProps(): React.ComponentProps<typeof AppModals> {
  return {
    theme: 'dark',
    setTheme: vi.fn(),
    audioFeedback: false,
    setAudioFeedback: vi.fn(),
    uiScale: 'medium',
    setUiScale: vi.fn(),
    defaultEditMode: 'markdown',
    setDefaultEditMode: vi.fn(),
    showTranslationFeatures: false,
    setShowTranslationFeatures: vi.fn(),
    handleImportChooseFile: vi.fn(),
    handleImportInputChange: vi.fn(),
    onCloudFileLoaded: vi.fn(),
    exportSong: vi.fn(async () => {}),
    pastedText: '',
    setPastedText: vi.fn(),
    isAnalyzing: false,
    isAnalyzingTheme: false,
    importProgress: { current: 0, total: 0, currentLabel: '' },
    analyzePastedLyrics: vi.fn(),
    analysisReport: null,
    analysisSteps: [],
    appliedAnalysisItems: new Set<string>(),
    selectedAnalysisItems: new Set<string>(),
    isApplyingAnalysis: null,
    toggleAnalysisItemSelection: vi.fn(),
    applyAnalysisItem: vi.fn(async () => {}),
    applySelectedAnalysisItems: vi.fn(),
    clearAppliedAnalysisItems: vi.fn(),
    versions: [],
    rollbackToVersion: vi.fn(),
    rollbackSectionToVersion: vi.fn(),
    saveVersion: vi.fn(),
    handleRequestVersionName: vi.fn(),
    similarityMatches: [],
    libraryCount: 0,
    webSimilarityIndex: { status: 'idle', candidates: [], lastUpdated: null, error: null },
    triggerWebSimilarity: vi.fn(),
    handleDeleteLibraryAsset: vi.fn(),
    handleSaveToLibrary: vi.fn(async () => {}),
    handleLoadLibraryAsset: vi.fn(),
    handlePurgeLibrary: vi.fn(async () => {}),
    isSavingToLibrary: false,
    title: 'Test song',
    song: [],
    libraryAssets: [],
    hasCurrentSong: true,
    resetSong: vi.fn(),
    saveLibraryError: null,
    clearSaveLibraryError: vi.fn(),
  };
}

describe('AppModals', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    shouldThrowAnalysisModal.value = false;
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it('shows a scoped fallback when the analysis modal crashes without hiding other modals', () => {
    shouldThrowAnalysisModal.value = true;

    render(
      <ModalProvider uiState={createUiState({ isAboutOpen: true, isAnalysisModalOpen: true })}>
        <AppModals {...createProps()} />
      </ModalProvider>,
    );

    expect(screen.getByText('About modal')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('AI analysis error');
    expect(screen.getByText('Analysis crashed')).toBeTruthy();
  });
});
