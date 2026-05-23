import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlayerNavigation } from './usePlayerNavigation';
import type { AudioEngineState } from './useAudioEngine';
import type { TrackEntry } from './types';

function makeEngine(overrides: Partial<AudioEngineState> = {}): AudioEngineState {
  return {
    audioRef: { current: null } as AudioEngineState['audioRef'],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    repeat: 'none',
    shuffle: false,
    autoplay: false,
    crossfadeMs: 0,
    sleepTimerEnd: null,
    trackInfo: null,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    togglePlay: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    loadTrack: vi.fn(() => Promise.resolve()),
    beep: vi.fn(),
    toggleRepeat: vi.fn(),
    toggleShuffle: vi.fn(),
    toggleAutoplay: vi.fn(),
    setCrossfadeMs: vi.fn(),
    setSleepTimer: vi.fn(),
    setOnTrackEnded: vi.fn(),
    attachVideoElement: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

const tracks: TrackEntry[] = [
  { id: 'a', title: 'A', source: 'cloud', url: 'a.wav' },
  { id: 'b', title: 'B', source: 'cloud', url: 'b.wav' },
  { id: 'c', title: 'C', source: 'cloud', url: 'c.wav' },
  { id: 'd', title: 'D', source: 'local', url: 'd.wav' },
  { id: 'v', title: 'V', source: 'cloud', url: 'v.mp4', isVideo: true },
];

describe('usePlayerNavigation', () => {
  it('defaults to cloud view with no selection', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    expect(result.current.view).toBe('cloud');
    expect(result.current.selectedId).toBeNull();
    expect(result.current.visibleTracks.map(t => t.id)).toEqual(['a', 'b', 'c', 'v']);
  });

  it('filters visible tracks by view', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    act(() => result.current.setView('local'));
    expect(result.current.visibleTracks.map(t => t.id)).toEqual(['d']);
  });

  it('handleSelect loads and plays audio tracks', async () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    await act(async () => { await result.current.handleSelect(tracks[0]); });
    expect(result.current.selectedId).toBe('a');
    expect(engine.loadTrack).toHaveBeenCalledWith(tracks[0]);
    expect(engine.play).toHaveBeenCalled();
  });

  it('handleSelect waits for audio tracks to load before playing', async () => {
    let resolveLoad!: () => void;
    const loadTrack = vi.fn(() => new Promise<void>(resolve => { resolveLoad = resolve; }));
    const play = vi.fn(() => Promise.resolve());
    const engine = makeEngine({ loadTrack, play });
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));

    let selectPromise!: Promise<void>;
    act(() => {
      selectPromise = result.current.handleSelect(tracks[0]);
    });

    expect(result.current.selectedId).toBe('a');
    expect(loadTrack).toHaveBeenCalledWith(tracks[0]);
    expect(play).not.toHaveBeenCalled();

    await act(async () => {
      resolveLoad();
      await selectPromise;
    });

    expect(play).toHaveBeenCalled();
  });

  it('handleSelect on video does not auto-play via engine.play', async () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    await act(async () => { await result.current.handleSelect(tracks[4]); });
    expect(result.current.selectedId).toBe('v');
    expect(engine.loadTrack).not.toHaveBeenCalled();
    expect(engine.play).not.toHaveBeenCalled();
    expect(engine.beep).toHaveBeenCalled();
  });

  it('handleNext advances within the visible view', async () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    await act(async () => { await result.current.handleSelect(tracks[0]); });
    await act(async () => { await result.current.handleNext(); });
    expect(result.current.selectedId).toBe('b');
    await act(async () => { await result.current.handleNext(); });
    expect(result.current.selectedId).toBe('c');
  });


  it('fades volume before advancing when crossfade is enabled', async () => {
    vi.useFakeTimers();
    const setVolume = vi.fn();
    const engine = makeEngine({ isPlaying: true, crossfadeMs: 80, volume: 1, setVolume });
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    await act(async () => { await result.current.handleSelect(tracks[0]); });

    let nextPromise!: Promise<void>;
    act(() => {
      nextPromise = result.current.handleNext();
    });
    await act(async () => {
      await vi.runAllTimersAsync();
      await nextPromise;
    });

    expect(result.current.selectedId).toBe('b');
    expect(engine.loadTrack).toHaveBeenLastCalledWith(tracks[1]);
    expect(setVolume).toHaveBeenCalledWith(0);
    expect(setVolume).toHaveBeenLastCalledWith(1);
  });

  it('handlePrev wraps around to the last visible track', async () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    await act(async () => { await result.current.handleSelect(tracks[0]); });
    await act(async () => { await result.current.handlePrev(); });
    expect(result.current.selectedId).toBe('v');
  });

  it('handleNext is a no-op when there are no visible tracks', async () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks: [], engine }));
    await act(async () => { await result.current.handleNext(); });
    expect(result.current.selectedId).toBeNull();
    expect(engine.loadTrack).not.toHaveBeenCalled();
  });

  it('registers an onTrackEnded handler with the engine', () => {
    const engine = makeEngine();
    renderHook(() => usePlayerNavigation({ tracks, engine }));
    expect(engine.setOnTrackEnded).toHaveBeenCalled();
  });
});
