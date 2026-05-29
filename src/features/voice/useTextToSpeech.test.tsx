import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTextToSpeech } from './useTextToSpeech';
import type { VoiceAudioService } from './voiceAssistantAudioService';

function makeAudio(overrides: Partial<VoiceAudioService> = {}): VoiceAudioService {
  return {
    isRecognitionSupported: () => true,
    isSpeechSupported: () => true,
    listenOnce: vi.fn().mockResolvedValue(''),
    speak: vi.fn().mockResolvedValue(true),
    cancel: vi.fn(),
    ...overrides,
  };
}

describe('useTextToSpeech', () => {
  it('reports support from the audio service', () => {
    const audioService = makeAudio({ isSpeechSupported: () => false });
    const { result } = renderHook(() => useTextToSpeech({ audioService }));
    expect(result.current.isSupported).toBe(false);
  });

  it('does not speak empty text', () => {
    const audioService = makeAudio();
    const { result } = renderHook(() => useTextToSpeech({ audioService }));
    act(() => result.current.speak('   ', 'a'));
    expect(audioService.speak).not.toHaveBeenCalled();
  });

  it('speaks with the resolved UI locale and clears speakingId when done', async () => {
    const audioService = makeAudio();
    const { result } = renderHook(() => useTextToSpeech({ audioService }));

    act(() => result.current.speak('Hello there', 'a'));
    expect(audioService.speak).toHaveBeenCalledWith('Hello there', { lang: 'en-US' });

    await waitFor(() => expect(result.current.speakingId).toBeNull());
  });

  it('toggles off (cancels) when the same id is requested while speaking', () => {
    let resolveSpeak: (v: boolean) => void = () => {};
    const audioService = makeAudio({
      speak: vi.fn().mockImplementation(() => new Promise<boolean>((res) => { resolveSpeak = res; })),
    });
    const { result } = renderHook(() => useTextToSpeech({ audioService }));

    act(() => result.current.speak('Hello', 'a'));
    expect(result.current.speakingId).toBe('a');

    act(() => result.current.speak('Hello', 'a'));
    expect(audioService.cancel).toHaveBeenCalled();
    expect(result.current.speakingId).toBeNull();
    resolveSpeak(false);
  });

  it('stop() cancels speech', () => {
    const audioService = makeAudio();
    const { result } = renderHook(() => useTextToSpeech({ audioService }));
    act(() => result.current.stop());
    expect(audioService.cancel).toHaveBeenCalled();
  });
});
