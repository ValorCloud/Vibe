import React, { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import type { UIStateSlice } from './UIStateSlice';
import type { PickMode } from '../services/cloudStorage';

// ── Minimal UIState interface ───────────────────────────────────────────────
// NOTE: editMode / setEditMode / markupText / setMarkupText / markupTextareaRef
// have been moved to EditorContext (src/contexts/EditorContext.tsx).
// They no longer belong here — they caused ModalStateContext to invalidate on
// every keystroke.
export interface UIStateBag extends UIStateSlice {}

// ── Modal names union ────────────────────────────────────────────────

export type ModalName =
  | 'about' | 'settings' | 'apiError' | 'export'
  | 'sectionDropdown' | 'similarity' | 'saveToLibrary'
  | 'versions' | 'reset' | 'keyboardShortcuts' | 'confirm' | 'prompt' | 'paste' | 'analysis'
  | 'searchReplace' | 'cloudStorage';

// ── Dispatch context (stable — never triggers re-renders on state changes) ────
export interface ModalDispatchContextValue {
  openModal: (name: ModalName, payload?: unknown) => void;
  closeModal: (name: ModalName) => void;
}

// ── State context (full UIStateBag — subscribe only when state is needed) ─────
export interface ModalStateContextValue {
  uiState: UIStateBag;
}

// ── Legacy unified type — kept for backward compat with existing consumers ────
export interface ModalContextValue extends ModalDispatchContextValue {
  uiState: UIStateBag;
}

const ModalDispatchContext = createContext<ModalDispatchContextValue | null>(null);
const ModalStateContext = createContext<ModalStateContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────

export interface ModalProviderProps {
  children: ReactNode;
  uiState: UIStateBag;
}

export function ModalProvider({ children, uiState }: ModalProviderProps) {
  const openModal = useCallback((name: ModalName, payload?: unknown) => {
    switch (name) {
      case 'about':           uiState.setIsAboutOpen(true); break;
      case 'settings':        uiState.setIsSettingsOpen(true); break;
      case 'export':          uiState.setIsExportModalOpen(true); break;
      case 'sectionDropdown': uiState.setIsSectionDropdownOpen(true); break;
      case 'similarity':      uiState.setIsSimilarityModalOpen(true); break;
      case 'saveToLibrary':   uiState.setIsSaveToLibraryModalOpen(true); break;
      case 'versions':        uiState.setIsVersionsModalOpen(true); break;
      case 'reset':           uiState.setIsResetModalOpen(true); break;
      case 'keyboardShortcuts': uiState.setIsKeyboardShortcutsModalOpen(true); break;
      case 'paste':           uiState.setIsPasteModalOpen(true); break;
      case 'analysis':        uiState.setIsAnalysisModalOpen(true); break;
      case 'searchReplace':   uiState.setIsSearchReplaceOpen(true); break;
      case 'cloudStorage': {
        const p = payload as { mode?: PickMode } | undefined;
        uiState.setCloudStoragePickerMode(p?.mode ?? 'lyrics');
        uiState.setIsCloudStoragePickerOpen(true);
        break;
      }
      case 'apiError': {
        const msg = typeof payload === 'string' ? payload : '';
        uiState.setApiErrorModal({ open: true, message: msg });
        break;
      }
      case 'confirm': {
        const p = payload as { onConfirm: () => void };
        uiState.setConfirmModal({ open: true, onConfirm: p.onConfirm });
        break;
      }
      case 'prompt': {
        const p = payload as { onConfirm: (v: string) => void };
        uiState.setPromptModal({ open: true, onConfirm: p.onConfirm });
        break;
      }
    }
  }, [uiState]);

  const closeModal = useCallback((name: ModalName) => {
    switch (name) {
      case 'about':           uiState.setIsAboutOpen(false); break;
      case 'settings':        uiState.setIsSettingsOpen(false); break;
      case 'export':          uiState.setIsExportModalOpen(false); break;
      case 'sectionDropdown': uiState.setIsSectionDropdownOpen(false); break;
      case 'similarity':      uiState.setIsSimilarityModalOpen(false); break;
      case 'saveToLibrary':   uiState.setIsSaveToLibraryModalOpen(false); break;
      case 'versions':        uiState.setIsVersionsModalOpen(false); break;
      case 'reset':           uiState.setIsResetModalOpen(false); break;
      case 'keyboardShortcuts': uiState.setIsKeyboardShortcutsModalOpen(false); break;
      case 'paste':           uiState.setIsPasteModalOpen(false); break;
      case 'analysis':        uiState.setIsAnalysisModalOpen(false); break;
      case 'searchReplace':   uiState.setIsSearchReplaceOpen(false); break;
      case 'cloudStorage':    uiState.setIsCloudStoragePickerOpen(false); break;
      case 'apiError':        uiState.setApiErrorModal({ open: false, message: '' }); break;
      case 'confirm':         uiState.setConfirmModal(null); break;
      case 'prompt':          uiState.setPromptModal(null); break;
    }
  }, [uiState]);

  const dispatchValue = useMemo(
    () => ({ openModal, closeModal }),
    [openModal, closeModal],
  );

  const stateValue = useMemo(
    () => ({ uiState }),
    [uiState],
  );

  return (
    <ModalDispatchContext.Provider value={dispatchValue}>
      <ModalStateContext.Provider value={stateValue}>
        {children}
      </ModalStateContext.Provider>
    </ModalDispatchContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────

export function useModalDispatch(): ModalDispatchContextValue {
  const ctx = useContext(ModalDispatchContext);
  if (!ctx) throw new Error('useModalDispatch must be used inside <ModalProvider>');
  return ctx;
}

export function useModalState(): ModalStateContextValue {
  const ctx = useContext(ModalStateContext);
  if (!ctx) throw new Error('useModalState must be used inside <ModalProvider>');
  return ctx;
}

/**
 * Backward-compatible hook — returns { openModal, closeModal, uiState }.
 * Combined null-check preserves the legacy error message for existing tests.
 * @deprecated Migrate to useModalDispatch() or useModalState().
 */
export function useModalContext(): ModalContextValue {
  const dispatchCtx = useContext(ModalDispatchContext);
  const stateCtx = useContext(ModalStateContext);

  if (!dispatchCtx || !stateCtx) {
    throw new Error('useModalContext must be used inside <ModalProvider>');
  }

  return { ...dispatchCtx, uiState: stateCtx.uiState };
}
