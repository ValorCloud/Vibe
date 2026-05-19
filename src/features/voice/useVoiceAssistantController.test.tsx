import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVoiceAssistantController } from './useVoiceAssistantController';
import type { VoiceAudioService } from './voiceAssistantAudioService';

describe('useVoiceAssistantController', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows text fallback when speech output is slow/unavailable', async () => {
    const audioService: VoiceAudioService = {
      isRecognitionSupported: () => true,
      isSpeechSupported: () => true,
      listenOnce: vi.fn().mockResolvedValue('Trouve une rime pour la ligne 3'),
      speak: vi.fn().mockImplementation(async (_text, options) => {
        options?.onSlowStart?.();
        return false;
      }),
    };
    const requestReply = vi.fn().mockResolvedValue('Essaye "lueur" avec "cœur". Ajuste ensuite le débit de la ligne.');

    const { result } = renderHook(() =>
      useVoiceAssistantController({
        enabled: true,
        page: 'lyrics',
        mode: 'section',
        audioService,
        requestReply,
      }),
    );

    await act(async () => {
      await result.current.invoke();
    });

    await waitFor(() => {
      expect(result.current.textFallback).toBe('Essaye "lueur" avec "cœur". Ajuste ensuite le débit de la ligne.');
      expect(result.current.uiState).toBe('idle');
    });
  });
});
