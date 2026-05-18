import React, { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { ModalProvider, useModalContext, type UIStateBag } from '../ModalContext';

const createMockUIState = (): UIStateBag => ({
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
});

describe('ModalContext', () => {
  describe('ModalProvider', () => {
    it('exposes the correct initial state through the context', () => {
      const mockUIState = createMockUIState();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );

      const { result } = renderHook(() => useModalContext(), { wrapper });

      expect(result.current.uiState).toBe(mockUIState);
      expect(result.current.openModal).toBeTypeOf('function');
      expect(result.current.closeModal).toBeTypeOf('function');
    });

    it('provides the exact uiState object passed to the provider', () => {
      const mockUIState = createMockUIState();
      mockUIState.isAboutOpen = true;
      mockUIState.isSettingsOpen = true;
      mockUIState.apiErrorModal = { open: true, message: 'Test error' };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );

      const { result } = renderHook(() => useModalContext(), { wrapper });

      expect(result.current.uiState.isAboutOpen).toBe(true);
      expect(result.current.uiState.isSettingsOpen).toBe(true);
      expect(result.current.uiState.apiErrorModal).toEqual({ open: true, message: 'Test error' });
    });
  });

  describe('openModal', () => {
    it('calls the correct setter for simple boolean modals', () => {
      const mockUIState = createMockUIState();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );

      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => { result.current.openModal('about'); });
      expect(mockUIState.setIsAboutOpen).toHaveBeenCalledWith(true);

      act(() => { result.current.openModal('settings'); });
      expect(mockUIState.setIsSettingsOpen).toHaveBeenCalledWith(true);

      act(() => { result.current.openModal('export'); });
      expect(mockUIState.setIsExportModalOpen).toHaveBeenCalledWith(true);

      act(() => { result.current.openModal('sectionDropdown'); });
      expect(mockUIState.setIsSectionDropdownOpen).toHaveBeenCalledWith(true);

      act(() => { result.current.openModal('similarity'); });
      expect(mockUIState.setIsSimilarityModalOpen).toHaveBeenCalledWith(true);

      act(() => { result.current.openModal('saveToLibrary'); });
      expect(mockUIState.setIsSaveToLibraryModalOpen).toHaveBeenCalledWith(true);

      act(() => { result.current.openModal('versions'); });
      expect(mockUIState.setIsVersionsModalOpen).toHaveBeenCalledWith(true);

      act(() => { result.current.openModal('reset'); });
      expect(mockUIState.setIsResetModalOpen).toHaveBeenCalledWith(true);

      act(() => { result.current.openModal('keyboardShortcuts'); });
      expect(mockUIState.setIsKeyboardShortcutsModalOpen).toHaveBeenCalledWith(true);

      act(() => { result.current.openModal('paste'); });
      expect(mockUIState.setIsPasteModalOpen).toHaveBeenCalledWith(true);

      act(() => { result.current.openModal('analysis'); });
      expect(mockUIState.setIsAnalysisModalOpen).toHaveBeenCalledWith(true);
    });

    it('calls the correct setter with payload for apiError modal', () => {
      const mockUIState = createMockUIState();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );
      const { result } = renderHook(() => useModalContext(), { wrapper });
      act(() => { result.current.openModal('apiError', 'Network error occurred'); });
      expect(mockUIState.setApiErrorModal).toHaveBeenCalledWith({ open: true, message: 'Network error occurred' });
    });

    it('calls the correct setter with payload for confirm modal', () => {
      const mockUIState = createMockUIState();
      const onConfirm = vi.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );
      const { result } = renderHook(() => useModalContext(), { wrapper });
      act(() => { result.current.openModal('confirm', { onConfirm }); });
      expect(mockUIState.setConfirmModal).toHaveBeenCalledWith({ open: true, onConfirm });
    });

    it('calls the correct setter with payload for prompt modal', () => {
      const mockUIState = createMockUIState();
      const onConfirm = vi.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );
      const { result } = renderHook(() => useModalContext(), { wrapper });
      act(() => { result.current.openModal('prompt', { onConfirm }); });
      expect(mockUIState.setPromptModal).toHaveBeenCalledWith({ open: true, onConfirm });
    });
  });

  describe('closeModal', () => {
    it('calls the correct setter with false for simple boolean modals', () => {
      const mockUIState = createMockUIState();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => { result.current.closeModal('about'); });
      expect(mockUIState.setIsAboutOpen).toHaveBeenCalledWith(false);

      act(() => { result.current.closeModal('settings'); });
      expect(mockUIState.setIsSettingsOpen).toHaveBeenCalledWith(false);

      act(() => { result.current.closeModal('export'); });
      expect(mockUIState.setIsExportModalOpen).toHaveBeenCalledWith(false);

      act(() => { result.current.closeModal('sectionDropdown'); });
      expect(mockUIState.setIsSectionDropdownOpen).toHaveBeenCalledWith(false);

      act(() => { result.current.closeModal('similarity'); });
      expect(mockUIState.setIsSimilarityModalOpen).toHaveBeenCalledWith(false);

      act(() => { result.current.closeModal('saveToLibrary'); });
      expect(mockUIState.setIsSaveToLibraryModalOpen).toHaveBeenCalledWith(false);

      act(() => { result.current.closeModal('versions'); });
      expect(mockUIState.setIsVersionsModalOpen).toHaveBeenCalledWith(false);

      act(() => { result.current.closeModal('reset'); });
      expect(mockUIState.setIsResetModalOpen).toHaveBeenCalledWith(false);

      act(() => { result.current.closeModal('keyboardShortcuts'); });
      expect(mockUIState.setIsKeyboardShortcutsModalOpen).toHaveBeenCalledWith(false);

      act(() => { result.current.closeModal('paste'); });
      expect(mockUIState.setIsPasteModalOpen).toHaveBeenCalledWith(false);

      act(() => { result.current.closeModal('analysis'); });
      expect(mockUIState.setIsAnalysisModalOpen).toHaveBeenCalledWith(false);
    });

    it('resets apiError modal correctly', () => {
      const mockUIState = createMockUIState();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );
      const { result } = renderHook(() => useModalContext(), { wrapper });
      act(() => { result.current.closeModal('apiError'); });
      expect(mockUIState.setApiErrorModal).toHaveBeenCalledWith({ open: false, message: '' });
    });

    it('resets confirm modal to null', () => {
      const mockUIState = createMockUIState();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );
      const { result } = renderHook(() => useModalContext(), { wrapper });
      act(() => { result.current.closeModal('confirm'); });
      expect(mockUIState.setConfirmModal).toHaveBeenCalledWith(null);
    });

    it('resets prompt modal to null', () => {
      const mockUIState = createMockUIState();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );
      const { result } = renderHook(() => useModalContext(), { wrapper });
      act(() => { result.current.closeModal('prompt'); });
      expect(mockUIState.setPromptModal).toHaveBeenCalledWith(null);
    });
  });

  describe('useModalContext', () => {
    it('throws an error when used outside of ModalProvider', () => {
      const originalError = console.error;
      console.error = vi.fn();
      expect(() => { renderHook(() => useModalContext()); }).toThrow('useModalContext must be used inside <ModalProvider>');
      console.error = originalError;
    });

    it('returns context value when used inside ModalProvider', () => {
      const mockUIState = createMockUIState();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );
      const { result } = renderHook(() => useModalContext(), { wrapper });
      expect(result.current).toBeDefined();
      expect(result.current.openModal).toBeTypeOf('function');
      expect(result.current.closeModal).toBeTypeOf('function');
      expect(result.current.uiState).toBe(mockUIState);
    });
  });

  describe('open and close flow integration', () => {
    it('supports opening and closing a modal in sequence', () => {
      const mockUIState = createMockUIState();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );
      const { result } = renderHook(() => useModalContext(), { wrapper });
      act(() => { result.current.openModal('about'); });
      expect(mockUIState.setIsAboutOpen).toHaveBeenCalledWith(true);
      act(() => { result.current.closeModal('about'); });
      expect(mockUIState.setIsAboutOpen).toHaveBeenCalledWith(false);
    });

    it('supports opening multiple modals', () => {
      const mockUIState = createMockUIState();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState}>{children}</ModalProvider>
      );
      const { result } = renderHook(() => useModalContext(), { wrapper });
      act(() => {
        result.current.openModal('about');
        result.current.openModal('settings');
      });
      expect(mockUIState.setIsAboutOpen).toHaveBeenCalledWith(true);
      expect(mockUIState.setIsSettingsOpen).toHaveBeenCalledWith(true);
    });
  });

  describe('context stability', () => {
    it('updates openModal and closeModal references when uiState changes', () => {
      const mockUIState1 = createMockUIState();
      const mockUIState2 = createMockUIState();
      mockUIState2.isAboutOpen = true;

      const wrapper1 = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState1}>{children}</ModalProvider>
      );
      const { result: result1 } = renderHook(() => useModalContext(), { wrapper: wrapper1 });
      const initialOpenModal = result1.current.openModal;
      const initialCloseModal = result1.current.closeModal;

      const wrapper2 = ({ children }: { children: React.ReactNode }) => (
        <ModalProvider uiState={mockUIState2}>{children}</ModalProvider>
      );
      const { result: result2 } = renderHook(() => useModalContext(), { wrapper: wrapper2 });

      expect(result2.current.openModal).not.toBe(initialOpenModal);
      expect(result2.current.closeModal).not.toBe(initialCloseModal);

      act(() => { result2.current.openModal('about'); });
      expect(mockUIState2.setIsAboutOpen).toHaveBeenCalledWith(true);
    });
  });
});
