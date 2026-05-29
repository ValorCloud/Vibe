import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpotifyPlaybackState } from '../../types/spotify';
import type { AudioEngineState } from './useAudioEngine';

let mockSpotifyStatus: 'idle' | 'authenticating' | 'authenticated' | 'error' = 'idle';
let mockSpotifyPlaybackState: SpotifyPlaybackState | null = null;

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

function makePlaybackState(overrides: Partial<SpotifyPlaybackState> = {}): SpotifyPlaybackState {
  return {
    context: { uri: null, metadata: {} },
    disallows: {},
    duration: 180_000,
    paused: false,
    position: 30_000,
    repeat_mode: 0,
    shuffle: false,
    timestamp: Date.now(),
    track_window: {
      current_track: {
        id: 'spotify-track',
        uri: 'spotify:track:spotify-track',
        type: 'track',
        name: 'Test Track',
        duration_ms: 180_000,
        is_playable: true,
        artists: [{ name: 'Test Artist', uri: 'spotify:artist:test-artist' }],
        album: { name: 'Test Album', uri: 'spotify:album:test-album', images: [] },
      },
      next_tracks: [],
      previous_tracks: [],
    },
    ...overrides,
  };
}

const mockLocalEngine = makeEngine();
const mockSpotifyEngine = makeEngine({ autoplay: true });

vi.mock('./useAudioEngine', () => ({
  useAudioEngine: () => mockLocalEngine,
}));

vi.mock('./useSpotifyAsEngine', () => ({
  useSpotifyAsEngine: () => mockSpotifyEngine,
}));

vi.mock('./useFrequencyAnalyser', () => ({
  useFrequencyAnalyser: () => ({ bins: [] }),
}));

vi.mock('../../contexts/LibraryContext', () => ({
  useLibraryContext: () => ({
    tracks: [],
    purgeAll: vi.fn(),
    updateDuration: vi.fn(),
  }),
}));

vi.mock('./usePlayerNavigation', () => ({
  usePlayerNavigation: () => ({
    view: 'cloud',
    setView: vi.fn(),
    selectedId: null,
    setSelectedId: vi.fn(),
    selectedTrack: null,
    handleSelect: vi.fn(),
    handlePrev: vi.fn(),
    handleNext: vi.fn(),
  }),
}));

vi.mock('../../contexts/SpotifyAuthContext', () => ({
  useSpotifyAuthState: () => ({ status: mockSpotifyStatus }),
}));

vi.mock('../../contexts/SpotifyEngineContext', () => ({
  useSpotifyEngine_: () => ({
    playerState: 'ready',
    playbackState: mockSpotifyPlaybackState,
    controls: {
      previousTrack: vi.fn().mockResolvedValue(undefined),
      nextTrack: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

import { useVoxNovaPlayer } from './useVoxNovaPlayer';

describe('useVoxNovaPlayer', () => {
  beforeEach(() => {
    mockSpotifyStatus = 'idle';
    mockSpotifyPlaybackState = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('switches to Spotify immediately when auth completes with an active playback state', () => {
    mockSpotifyPlaybackState = makePlaybackState();
    const { result, rerender } = renderHook(() => useVoxNovaPlayer());

    expect(result.current.audioSource).toBe('local');

    mockSpotifyStatus = 'authenticated';
    rerender();

    expect(result.current.audioSource).toBe('spotify');
  });

  it('falls back to Spotify after five seconds when auth completes without an active session', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(() => useVoxNovaPlayer());

    mockSpotifyStatus = 'authenticated';
    rerender();

    expect(result.current.audioSource).toBe('local');

    act(() => {
      vi.advanceTimersByTime(4_999);
    });
    expect(result.current.audioSource).toBe('local');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.audioSource).toBe('spotify');
  });

  it('clears the fallback timer when playback state appears before the timeout', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(() => useVoxNovaPlayer());

    mockSpotifyStatus = 'authenticated';
    rerender();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    mockSpotifyPlaybackState = makePlaybackState();
    rerender();

    expect(result.current.audioSource).toBe('spotify');
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      result.current.setAudioSource('local');
      vi.advanceTimersByTime(3_000);
    });

    expect(result.current.audioSource).toBe('local');
  });
});
