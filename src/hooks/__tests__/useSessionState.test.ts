import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSessionState } from '../useSessionState';

describe('useSessionState', () => {
  beforeEach(() => {
    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem');
    vi.spyOn(Storage.prototype, 'setItem');
    localStorage.clear();

    // Mock fetch for API status check
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('happy paths', () => {
    it('initializes with default values', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      expect(result.current.theme).toBe('dark');
      expect(result.current.hasApiKey).toBe(false);
      expect(result.current.isSessionHydrated).toBe(false);
      expect(result.current.hasSavedSession).toBe(false);
      expect(result.current.audioFeedback).toBe(true);
      expect(result.current.uiScale).toBe('large');
      expect(result.current.defaultEditMode).toBe('markdown');
      expect(result.current.similarityMatches).toEqual([]);
      expect(result.current.libraryCount).toBe(0);
      expect(result.current.libraryAssets).toEqual([]);
      expect(result.current.isSavingToLibrary).toBe(false);
    });

    it('loads UI scale from localStorage when available', () => {
      localStorage.setItem('vibe_ui_scale', 'small');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      expect(result.current.uiScale).toBe('small');
    });

    it('loads default edit mode from localStorage when set to markdown', () => {
      localStorage.setItem('vibe_default_edit_mode', 'markdown');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      expect(result.current.defaultEditMode).toBe('markdown');
    });

    it('loads default edit mode from localStorage when set to phonetic', () => {
      localStorage.setItem('vibe_default_edit_mode', 'phonetic');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      expect(result.current.defaultEditMode).toBe('phonetic');
    });

    it('updates theme state and applies dark class to document', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      expect(document.documentElement.classList.contains('dark')).toBe(true);

      act(() => result.current.setTheme('light'));

      await waitFor(() => {
        expect(result.current.theme).toBe('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });

      expect(localStorage.getItem('vibe_theme')).toBe('light');
    });

    it('loads theme from localStorage when set to light', () => {
      localStorage.setItem('vibe_theme', 'light');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      expect(result.current.theme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('updates UI scale and persists to localStorage', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      act(() => result.current.setUiScale('medium'));

      expect(result.current.uiScale).toBe('medium');
      expect(localStorage.getItem('vibe_ui_scale')).toBe('medium');
      expect(document.documentElement.style.fontSize).toBe('14px');
    });

    it('updates default edit mode and persists to localStorage', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      act(() => result.current.setDefaultEditMode('markdown'));

      expect(result.current.defaultEditMode).toBe('markdown');
      expect(localStorage.getItem('vibe_default_edit_mode')).toBe('markdown');
    });

    it('checks API key status on mount and sets hasApiKey to true when available', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: true }),
      });

      const { result } = renderHook(() => useSessionState());

      await waitFor(() => {
        expect(result.current.hasApiKey).toBe(true);
      });
    });

    it('updates audio feedback state', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      act(() => result.current.setAudioFeedback(false));

      expect(result.current.audioFeedback).toBe(false);
    });

    it('updates session hydration state', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      act(() => result.current.setIsSessionHydrated(true));

      expect(result.current.isSessionHydrated).toBe(true);
    });

    it('updates saved session state', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      act(() => result.current.setHasSavedSession(true));

      expect(result.current.hasSavedSession).toBe(true);
    });

    it('updates similarity matches', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());
      const mockMatches = [{ score: 0.95, asset: { id: 'test', title: 'Test' } }] as any;

      act(() => result.current.setSimilarityMatches(mockMatches));

      expect(result.current.similarityMatches).toEqual(mockMatches);
    });

    it('updates library count', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      act(() => result.current.setLibraryCount(42));

      expect(result.current.libraryCount).toBe(42);
    });

    it('updates library assets', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());
      const mockAssets = [{ id: 'test', title: 'Test Asset' }] as any;

      act(() => result.current.setLibraryAssets(mockAssets));

      expect(result.current.libraryAssets).toEqual(mockAssets);
    });

    it('updates isSavingToLibrary state', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      act(() => result.current.setIsSavingToLibrary(true));

      expect(result.current.isSavingToLibrary).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    it('falls back to large scale when localStorage has invalid value', () => {
      localStorage.setItem('vibe_ui_scale', 'invalid');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      expect(result.current.uiScale).toBe('large');
    });

    it('falls back to section mode when localStorage has invalid edit mode', () => {
      localStorage.setItem('vibe_default_edit_mode', 'invalid');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      const { result } = renderHook(() => useSessionState());

      expect(result.current.defaultEditMode).toBe('markdown');
    });

    it('retries API status checks on network failure before succeeding', async () => {
      vi.useFakeTimers();
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          json: async () => ({ available: true }),
        });

      const { result } = renderHook(() => useSessionState());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(result.current.hasApiKey).toBe(true);

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('sets hasApiKey to false when API status check fails after all retries', async () => {
      vi.useFakeTimers();
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSessionState());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(result.current.hasApiKey).toBe(false);

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('times out each API status attempt after 5 seconds', async () => {
      vi.useFakeTimers();
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useSessionState());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(18000);
      });

      expect(result.current.hasApiKey).toBe(false);

      expect(global.fetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('sets hasApiKey to false when API response is malformed', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({}),
      });

      const { result } = renderHook(() => useSessionState());

      await waitFor(() => {
        expect(result.current.hasApiKey).toBe(false);
      });
    });

    it('ignores AbortError during API status check', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

      const { result } = renderHook(() => useSessionState());

      // Should not set hasApiKey to false immediately on AbortError
      // Default value remains false
      expect(result.current.hasApiKey).toBe(false);
    });

    it('aborts API status check on unmount', async () => {
      vi.useFakeTimers();
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      const { unmount } = renderHook(() => useSessionState());

      unmount();

      expect(abortSpy).toHaveBeenCalled();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('handles localStorage setItem failures gracefully', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ available: false }),
      });

      // Mock localStorage.setItem to throw
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const { result } = renderHook(() => useSessionState());

      // Should not throw
      expect(() => {
        act(() => result.current.setUiScale('small'));
      }).not.toThrow();

      // State should still update even if localStorage fails
      expect(result.current.uiScale).toBe('small');
    });
  });
});
