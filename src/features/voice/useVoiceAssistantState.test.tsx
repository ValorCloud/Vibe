import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceAssistantState } from './useVoiceAssistantState';

describe('useVoiceAssistantState', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts in first-call mode when storage is empty', () => {
    const { result } = renderHook(() =>
      useVoiceAssistantState({ page: 'lyrics', mode: 'section' }),
    );

    expect(result.current.isFirstCall).toBe(true);
  });

  it('persists first-call completion in localStorage', () => {
    const { result } = renderHook(() =>
      useVoiceAssistantState({ page: 'lyrics', mode: 'section' }),
    );

    act(() => {
      result.current.markFirstCallHandled();
    });

    expect(result.current.isFirstCall).toBe(false);
    expect(Storage.prototype.setItem).toHaveBeenCalledWith('vibe_voice_assistant_onboarding_seen', '1');
  });
});
