import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChangeEvent } from 'react';
import { useImportHandlers } from '../useImportHandlers';

describe('useImportHandlers', () => {
  it('restores imported song language metadata when present', async () => {
    const loadFileForAnalysis = vi.fn(async () => ({ songLanguage: 'ar' }));
    const setSongLanguage = vi.fn();
    const { result } = renderHook(() => useImportHandlers({
      importInputRef: { current: null },
      loadFileForAnalysis,
      setIsPasteModalOpen: vi.fn(),
      setPastedText: vi.fn(),
      setSongLanguage,
    }));

    const file = new File(['lyrics'], 'song.txt', { type: 'text/plain' });
    const event = {
      target: {
        files: [file],
        value: 'song.txt',
      },
    } as unknown as ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleImportInputChange(event);
    });

    expect(loadFileForAnalysis).toHaveBeenCalledWith(file);
    expect(setSongLanguage).toHaveBeenCalledWith('ar');
    expect(event.target.value).toBe('');
  });

  it('leaves the existing song language untouched when imported metadata is empty', async () => {
    const loadFileForAnalysis = vi.fn(async () => ({ songLanguage: '   ' }));
    const setSongLanguage = vi.fn();
    const { result } = renderHook(() => useImportHandlers({
      importInputRef: { current: null },
      loadFileForAnalysis,
      setIsImportModalOpen: vi.fn(),
      setIsPasteModalOpen: vi.fn(),
      setPastedText: vi.fn(),
      setSongLanguage,
    }));

    const file = new File(['lyrics'], 'song.txt', { type: 'text/plain' });
    const event = {
      target: {
        files: [file],
        value: 'song.txt',
      },
    } as unknown as ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleImportInputChange(event);
    });

    expect(setSongLanguage).not.toHaveBeenCalled();
  });
});
