import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
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
  it('defaults player volume to 50 percent', () => {
    const audio = makeMediaElement('audio');
    vi.stubGlobal('Audio', vi.fn(() => audio.el));
    const { result } = renderHook(() => useAudioEngine());
    expect(result.current.volume).toBe(0.5);
    expect(audio.el.volume).toBe(0.5);
  });

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

  it('sleep timer pauses the media element that is active when it expires', () => {
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

    expect(video.pause).toHaveBeenCalledOnce();
    expect(audio.pause).not.toHaveBeenCalled();
  });

  it('probes cloud audio metadata with a bounded range request', async () => {
    const audio = makeMediaElement('audio');
    Object.defineProperty(audio.el, 'duration', { value: 120, configurable: true });
    vi.stubGlobal('Audio', vi.fn(() => audio.el));
    const decodeAudioData = vi.fn().mockResolvedValue({ numberOfChannels: 6, sampleRate: 48000 });
    const close = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('AudioContext', vi.fn(() => ({ decodeAudioData, close })));
    const arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(16));
    const fetch = vi.fn().mockResolvedValue({
      status: 206,
      headers: new Headers({
        'content-length': '16',
        'content-range': 'bytes 0-15/9600000',
      }),
      arrayBuffer,
    } as Response);
    vi.stubGlobal('fetch', fetch);

    const { result } = renderHook(() => useAudioEngine());
    await act(async () => {
      const loadPromise = result.current.loadTrack({
        id: 'song',
        title: 'Song.flac',
        source: 'cloud',
        url: 'https://onedrive.example/song.flac',
        oneDriveSize: 9_600_000,
      });
      audio.el.dispatchEvent(new Event('loadedmetadata'));
      audio.el.dispatchEvent(new Event('canplay'));
      await loadPromise;
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.trackInfo?.channels).toBe(6));

    expect(fetch).toHaveBeenCalledWith('https://onedrive.example/song.flac', {
      headers: { Range: 'bytes=0-65535' },
    });
    expect(arrayBuffer).toHaveBeenCalledOnce();
    expect(result.current.trackInfo).toMatchObject({
      sampleRate: 48000,
      bitrateKbps: 640,
      channelLabel: '5.1 SURROUND',
      codec: 'FLAC',
    });
  });

  it('does not buffer a full cloud response when range is ignored', async () => {
    const audio = makeMediaElement('audio');
    Object.defineProperty(audio.el, 'duration', { value: 10_000, configurable: true });
    vi.stubGlobal('Audio', vi.fn(() => audio.el));
    const decodeAudioData = vi.fn();
    vi.stubGlobal('AudioContext', vi.fn(() => ({ decodeAudioData, close: vi.fn() })));
    const arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(1));
    const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-length': '800000000' }),
      body: { cancel } as unknown as ReadableStream<Uint8Array>,
      arrayBuffer,
    } as Response));

    const { result } = renderHook(() => useAudioEngine());
    await act(async () => {
      const loadPromise = result.current.loadTrack({
        id: 'song',
        title: 'Song.flac',
        source: 'cloud',
        url: 'https://onedrive.example/song.flac',
        oneDriveSize: 800_000_000,
      });
      audio.el.dispatchEvent(new Event('loadedmetadata'));
      audio.el.dispatchEvent(new Event('canplay'));
      await loadPromise;
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.trackInfo?.bitrateKbps).toBe(640));

    expect(cancel).toHaveBeenCalledOnce();
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(decodeAudioData).not.toHaveBeenCalled();
    expect(result.current.trackInfo).toMatchObject({
      channels: null,
      sampleRate: null,
      channelLabel: 'STEREO',
      codec: 'FLAC',
    });
  });
});
