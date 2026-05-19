import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceAssistantState } from './useVoiceAssistantState';

describe('useVoiceAssistantState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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
    expect(localStorage.getItem('vibe_voice_assistant_onboarding_seen')).toBe('1');
  });
});
