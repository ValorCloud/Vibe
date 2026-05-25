/**
 * useUIStateForProvider — test suite (flat-memo contract)
 *
 * Aligns with the EditorContext refactor: editMode / markupText /
 * markupTextareaRef / setEditMode / setMarkupText have moved to
 * EditorContext and are no longer part of UIStateBag.
 *
 * Contract under test:
 *   1. Same object reference when no dependency changes.
 *   2. New object reference when any dependency changes.
 *   3. Values are correctly propagated to the returned bag.
 *   4. useState setters (referentially stable by React guarantee) do not
 *      cause invalidation on their own.
 *   5. Individual field independence — changing field X does not alter
 *      the value of unrelated field Y.
 */
import { createRef } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UIStateBag } from '../../contexts/ModalContext';
import { useUIStateForProvider } from '../useUIStateForProvider';

const createParams = (): UIStateBag => ({
  setIsAboutOpen: vi.fn(),
  setIsSettingsOpen: vi.fn(),
  setApiErrorModal: vi.fn(),
  setIsImportModalOpen: vi.fn(),
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
  isSettingsOpen: true,
  apiErrorModal: { open: false, message: '' },
  isImportModalOpen: false,
  isExportModalOpen: true,
  isSectionDropdownOpen: false,
  isSimilarityModalOpen: true,
  isSaveToLibraryModalOpen: false,
  isVersionsModalOpen: true,
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
  isStructureOpen: true,
  setIsStructureOpen: vi.fn(),
  isLeftPanelOpen: false,
  setIsLeftPanelOpen: vi.fn(),
  importInputRef: createRef<HTMLInputElement>(),
});

describe('useUIStateForProvider — flat-memo contract', () => {

  // ── 1. Stability ─────────────────────────────────────────────────────

  it('returns the same reference when no dependency changes', () => {
    const params = createParams();
    const { result, rerender } = renderHook(
      (p: UIStateBag) => useUIStateForProvider(p),
      { initialProps: params },
    );
    const first = result.current;
    rerender(params);
    expect(result.current).toBe(first);
  });

  // ── 2. Invalidation on value change ──────────────────────────────────

  it('returns a new reference when a boolean state field changes', () => {
    const params = createParams();
    const { result, rerender } = renderHook(
      (p: UIStateBag) => useUIStateForProvider(p),
      { initialProps: params },
    );
    const first = result.current;
    rerender({ ...params, isLeftPanelOpen: true });
    expect(result.current).not.toBe(first);
    expect(result.current.isLeftPanelOpen).toBe(true);
  });

  it('returns a new reference when activeTab changes', () => {
    const params = createParams();
    const { result, rerender } = renderHook(
      (p: UIStateBag) => useUIStateForProvider(p),
      { initialProps: params },
    );
    const first = result.current;
    rerender({ ...params, activeTab: 'musical' });
    expect(result.current).not.toBe(first);
    expect(result.current.activeTab).toBe('musical');
  });

  it('returns a new reference when a modal flag changes', () => {
    const params = createParams();
    const { result, rerender } = renderHook(
      (p: UIStateBag) => useUIStateForProvider(p),
      { initialProps: params },
    );
    const first = result.current;
    rerender({ ...params, isAboutOpen: true });
    expect(result.current).not.toBe(first);
    expect(result.current.isAboutOpen).toBe(true);
  });

  it('returns a new reference when a setter function changes', () => {
    const params = createParams();
    const { result, rerender } = renderHook(
      (p: UIStateBag) => useUIStateForProvider(p),
      { initialProps: params },
    );
    const first = result.current;
    const newSetter = vi.fn();
    rerender({ ...params, setIsAboutOpen: newSetter });
    expect(result.current).not.toBe(first);
    expect(result.current.setIsAboutOpen).toBe(newSetter);
  });

  // ── 3. Value propagation ──────────────────────────────────────────

  it('propagates all initial values correctly', () => {
    const params = createParams();
    const { result } = renderHook(
      (p: UIStateBag) => useUIStateForProvider(p),
      { initialProps: params },
    );
    expect(result.current.isAboutOpen).toBe(false);
    expect(result.current.isSettingsOpen).toBe(true);
    expect(result.current.activeTab).toBe('lyrics');
    expect(result.current.isLeftPanelOpen).toBe(false);
    expect(result.current.isStructureOpen).toBe(true);
  });

  // ── 4. Setter stability ───────────────────────────────────────────────

  it('does not invalidate when the same setter reference is passed again', () => {
    const params = createParams();
    const { result, rerender } = renderHook(
      (p: UIStateBag) => useUIStateForProvider(p),
      { initialProps: params },
    );
    const first = result.current;
    rerender({ ...params });
    expect(result.current).toBe(first);
  });

  // ── 5. Field independence ─────────────────────────────────────────────

  it('does not alter modal fields when only layout fields change', () => {
    const params = createParams();
    const { result, rerender } = renderHook(
      (p: UIStateBag) => useUIStateForProvider(p),
      { initialProps: params },
    );
    const snap = {
      isAboutOpen: result.current.isAboutOpen,
      isSettingsOpen: result.current.isSettingsOpen,
      isImportModalOpen: result.current.isImportModalOpen,
    };
    rerender({ ...params, activeTab: 'musical', isStructureOpen: false });
    expect(result.current.isAboutOpen).toBe(snap.isAboutOpen);
    expect(result.current.isSettingsOpen).toBe(snap.isSettingsOpen);
    expect(result.current.isImportModalOpen).toBe(snap.isImportModalOpen);
  });

  it('does not alter layout fields when only modal flags change', () => {
    const params = createParams();
    const { result, rerender } = renderHook(
      (p: UIStateBag) => useUIStateForProvider(p),
      { initialProps: params },
    );
    const snap = {
      activeTab: result.current.activeTab,
      isStructureOpen: result.current.isStructureOpen,
      isLeftPanelOpen: result.current.isLeftPanelOpen,
    };
    rerender({ ...params, isAboutOpen: true, isSettingsOpen: false, isPasteModalOpen: true });
    expect(result.current.activeTab).toBe(snap.activeTab);
    expect(result.current.isStructureOpen).toBe(snap.isStructureOpen);
    expect(result.current.isLeftPanelOpen).toBe(snap.isLeftPanelOpen);
  });

  it('does not alter modal fields when only the importInputRef changes', () => {
    const params = createParams();
    const { result, rerender } = renderHook(
      (p: UIStateBag) => useUIStateForProvider(p),
      { initialProps: params },
    );
    const snap = {
      isAboutOpen: result.current.isAboutOpen,
      activeTab: result.current.activeTab,
    };
    const newRef = createRef<HTMLInputElement>();
    rerender({ ...params, importInputRef: newRef });
    expect(result.current.isAboutOpen).toBe(snap.isAboutOpen);
    expect(result.current.activeTab).toBe(snap.activeTab);
    expect(result.current.importInputRef).toBe(newRef);
  });
});
