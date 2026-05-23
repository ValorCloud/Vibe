import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAudioEngine } from './useAudioEngine';

function makeMediaElement(tag: 'audio' | 'video') {
  const el = document.createElement(tag) as HTMLMediaElement;
  const load = vi.fn();
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();

  Object.defineProperty(el, 'load', { value: load, configurable: true });
  Object.defineProperty(el, 'play', { value: play, configurable: true });
  Object.defineProperty(el, 'pause', { value: pause, configurable: true });

  return { el, load, play, pause };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAudioEngine', () => {
  it('loadTrack resolves after the audio element is ready', async () => {
    const audio = makeMediaElement('audio');
    vi.stubGlobal('Audio', vi.fn(() => audio.el));
    const { result } = renderHook(() => useAudioEngine());

    let loadPromise!: Promise<void>;
    act(() => {
      loadPromise = result.current.loadTrack({
        id: 'song',
        title: 'Song.mp3',
        source: 'cloud',
        url: 'song.mp3',
      });
    });

    let settled = false;
    void loadPromise.then(() => { settled = true; });
    await Promise.resolve();

    expect(audio.load).toHaveBeenCalled();
    expect(settled).toBe(false);

    act(() => {
      audio.el.dispatchEvent(new Event('canplay'));
    });

    await expect(loadPromise).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });

  it('sleep timer pauses the media element that was active when it was set', () => {
    vi.useFakeTimers();
    const audio = makeMediaElement('audio');
    const video = makeMediaElement('video');
    vi.stubGlobal('Audio', vi.fn(() => audio.el));
    const { result } = renderHook(() => useAudioEngine());

    act(() => {
      result.current.setSleepTimer(1000);
      result.current.attachVideoElement(video.el as HTMLVideoElement);
      vi.advanceTimersByTime(1000);
    });

    expect(audio.pause).toHaveBeenCalledOnce();
    expect(video.pause).not.toHaveBeenCalled();
  });
});
