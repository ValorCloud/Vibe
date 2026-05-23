import { describe, expect, it, vi } from 'vitest';
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
    play: vi.fn(),
    pause: vi.fn(),
    togglePlay: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    loadTrack: vi.fn(),
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

  it('handleSelect loads and plays audio tracks', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    act(() => result.current.handleSelect(tracks[0]));
    expect(result.current.selectedId).toBe('a');
    expect(engine.loadTrack).toHaveBeenCalledWith(tracks[0]);
    expect(engine.play).toHaveBeenCalled();
  });

  it('handleSelect on video does not auto-play via engine.play', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    act(() => result.current.handleSelect(tracks[4]));
    expect(result.current.selectedId).toBe('v');
    expect(engine.loadTrack).not.toHaveBeenCalled();
    expect(engine.play).not.toHaveBeenCalled();
    expect(engine.beep).toHaveBeenCalled();
  });

  it('handleNext advances within the visible view', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    act(() => result.current.handleSelect(tracks[0]));
    act(() => result.current.handleNext());
    expect(result.current.selectedId).toBe('b');
    act(() => result.current.handleNext());
    expect(result.current.selectedId).toBe('c');
  });

  it('handlePrev wraps around to the last visible track', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks, engine }));
    act(() => result.current.handleSelect(tracks[0]));
    act(() => result.current.handlePrev());
    expect(result.current.selectedId).toBe('v');
  });

  it('handleNext is a no-op when there are no visible tracks', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayerNavigation({ tracks: [], engine }));
    act(() => result.current.handleNext());
    expect(result.current.selectedId).toBeNull();
    expect(engine.loadTrack).not.toHaveBeenCalled();
  });

  it('registers an onTrackEnded handler with the engine', () => {
    const engine = makeEngine();
    renderHook(() => usePlayerNavigation({ tracks, engine }));
    expect(engine.setOnTrackEnded).toHaveBeenCalled();
  });
});
