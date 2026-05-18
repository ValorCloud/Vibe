import React, { createRef } from 'react';
import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModalProvider, type UIStateBag } from '../../contexts/ModalContext';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

const createUiState = (overrides: Partial<UIStateBag> = {}): UIStateBag => ({
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
  activeTab: 'lyrics',
  setActiveTab: vi.fn(),
  isStructureOpen: false,
  setIsStructureOpen: vi.fn(),
  isLeftPanelOpen: false,
  setIsLeftPanelOpen: vi.fn(),
  importInputRef: createRef<HTMLInputElement>(),
  ...overrides,
});

const renderUseKeyboardShortcuts = (
  uiState: UIStateBag,
  overrides: Partial<Parameters<typeof useKeyboardShortcuts>[0]> = {},
) => {
  const closeMobilePanels = vi.fn();
  const undo = vi.fn();
  const redo = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ModalProvider uiState={uiState}>{children}</ModalProvider>
  );

  renderHook(() => useKeyboardShortcuts({
    isMobileOrTablet: false,
    closeMobilePanels,
    undo,
    redo,
    ...overrides,
  }), { wrapper });

  return { closeMobilePanels, undo, redo };
};

describe('useKeyboardShortcuts', () => {
  it.each([
    ['prompt modal', createUiState({ promptModal: { open: true, onConfirm: vi.fn() } }), 'setPromptModal', null],
    ['confirm modal', createUiState({ confirmModal: { open: true, onConfirm: vi.fn() } }), 'setConfirmModal', null],
    ['API error modal', createUiState({ apiErrorModal: { open: true, message: 'Boom' } }), 'setApiErrorModal', { open: false, message: '' }],
    ['reset modal', createUiState({ isResetModalOpen: true }), 'setIsResetModalOpen', false],
    ['versions modal', createUiState({ isVersionsModalOpen: true }), 'setIsVersionsModalOpen', false],
    ['save to library modal', createUiState({ isSaveToLibraryModalOpen: true }), 'setIsSaveToLibraryModalOpen', false],
    ['similarity modal', createUiState({ isSimilarityModalOpen: true }), 'setIsSimilarityModalOpen', false],
    ['analysis modal', createUiState({ isAnalysisModalOpen: true }), 'setIsAnalysisModalOpen', false],
    ['paste modal', createUiState({ isPasteModalOpen: true }), 'setIsPasteModalOpen', false],
    ['export modal', createUiState({ isExportModalOpen: true }), 'setIsExportModalOpen', false],
    ['settings modal', createUiState({ isSettingsOpen: true }), 'setIsSettingsOpen', false],
    ['about modal', createUiState({ isAboutOpen: true }), 'setIsAboutOpen', false],
  ] as const)('dismisses the %s from ModalContext on Escape', (_label, uiState, setterName, expectedValue) => {
    renderUseKeyboardShortcuts(uiState);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(uiState[setterName]).toHaveBeenCalledWith(expectedValue);
  });

  it('dismisses only the highest-priority modal on Escape', () => {
    const uiState = createUiState({
      promptModal: { open: true, onConfirm: vi.fn() },
      confirmModal: { open: true, onConfirm: vi.fn() },
      apiErrorModal: { open: true, message: 'Boom' },
      isResetModalOpen: true,
    });

    renderUseKeyboardShortcuts(uiState);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(uiState.setPromptModal).toHaveBeenCalledWith(null);
    expect(uiState.setConfirmModal).not.toHaveBeenCalled();
    expect(uiState.setApiErrorModal).not.toHaveBeenCalled();
    expect(uiState.setIsResetModalOpen).not.toHaveBeenCalled();
  });

  it('closes mobile panels on Escape when no modal is open', () => {
    const uiState = createUiState();
    const { closeMobilePanels } = renderUseKeyboardShortcuts(uiState, { isMobileOrTablet: true });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(closeMobilePanels).toHaveBeenCalledTimes(1);
  });
});
