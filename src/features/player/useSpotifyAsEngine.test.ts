/**
 * Tests for `useSpotifyAsEngine` — the adapter that wraps the Spotify
 * engine so it can be consumed by the canonical player widgets through the
 * `AudioEngineState` contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SpotifyPlaybackState } from '../../types/spotify';

// ── Mocks ───────────────────────────────────────────────────────────────────
const mockControls = {
  play: vi.fn(),
  resume: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn().mockResolvedValue(undefined),
  seek: vi.fn().mockResolvedValue(undefined),
  setVolume: vi.fn().mockResolvedValue(undefined),
  nextTrack: vi.fn().mockResolvedValue(undefined),
  previousTrack: vi.fn().mockResolvedValue(undefined),
};

let mockPlayerState: 'idle' | 'loading' | 'ready' | 'playing' | 'error' = 'ready';
let mockPlaybackState: SpotifyPlaybackState | null = null;

vi.mock('../../contexts/SpotifyEngineContext', () => ({
  useSpotifyEngine_: () => ({
    playerState: mockPlayerState,
    playbackState: mockPlaybackState,
    controls: mockControls,
    deviceId: 'test-device',
  }),
}));

vi.mock('../../contexts/SpotifyAuthContext', () => ({
  useSpotifyAuthActions: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    getValidToken: vi.fn().mockResolvedValue('test-token'),
    forceRefreshToken: vi.fn(),
  }),
}));

// Avoid touching the Spotify SDK loader.
vi.mock('../../hooks/useSpotifyEngine', () => ({
  getStoredSpotifyVolume: () => 0.5,
  SPOTIFY_VOLUME_STORAGE_KEY: 'voxnova.spotify.volume',
  SPOTIFY_VOLUME_DEFAULT: 0.7,
}));

import { useSpotifyAsEngine } from './useSpotifyAsEngine';

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
        id: 't1', uri: 'spotify:track:t1', type: 'track', name: 'Test Track',
        duration_ms: 180_000, is_playable: true,
        artists: [{ name: 'Test Artist', uri: 'spotify:artist:a1' }],
        album: { name: 'Test Album', uri: 'spotify:album:al1', images: [] },
      },
      next_tracks: [],
      previous_tracks: [],
    },
    ...overrides,
  };
}

describe('useSpotifyAsEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayerState = 'ready';
    mockPlaybackState = null;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports idle state when no Spotify track is playing', () => {
    const { result } = renderHook(() => useSpotifyAsEngine());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.duration).toBe(0);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.trackInfo).toBeNull();
  });

  it('exposes Spotify playback position/duration in seconds and isPlaying flag', () => {
    mockPlaybackState = makePlaybackState({ paused: true });
    const { result } = renderHook(() => useSpotifyAsEngine());
    expect(result.current.duration).toBe(180);
    expect(result.current.currentTime).toBe(30);
    expect(result.current.isPlaying).toBe(false);
  });

  it('togglePlay routes to Spotify resume when paused', () => {
    mockPlaybackState = makePlaybackState({ paused: true });
    const { result } = renderHook(() => useSpotifyAsEngine());
    act(() => { result.current.togglePlay(); });
    expect(mockControls.resume).toHaveBeenCalledTimes(1);
    expect(mockControls.pause).not.toHaveBeenCalled();
  });

  it('togglePlay routes to Spotify pause when playing', () => {
    mockPlaybackState = makePlaybackState({ paused: false });
    const { result } = renderHook(() => useSpotifyAsEngine());
    expect(result.current.isPlaying).toBe(true);
    act(() => { result.current.togglePlay(); });
    expect(mockControls.pause).toHaveBeenCalledTimes(1);
  });

  it('seek converts seconds to milliseconds when calling Spotify controls', () => {
    mockPlaybackState = makePlaybackState();
    const { result } = renderHook(() => useSpotifyAsEngine());
    act(() => { result.current.seek(45); });
    expect(mockControls.seek).toHaveBeenCalledWith(45_000);
  });

  it('setVolume clamps to [0,1] and forwards to Spotify', () => {
    const { result } = renderHook(() => useSpotifyAsEngine());
    act(() => { result.current.setVolume(1.5); });
    expect(mockControls.setVolume).toHaveBeenCalledWith(1);
    expect(result.current.volume).toBe(1);

    act(() => { result.current.setVolume(-0.2); });
    expect(mockControls.setVolume).toHaveBeenLastCalledWith(0);
    expect(result.current.volume).toBe(0);
  });

  it('mirrors Spotify shuffle/repeat state from playback state', () => {
    mockPlaybackState = makePlaybackState({ shuffle: true, repeat_mode: 1 });
    const { result } = renderHook(() => useSpotifyAsEngine());
    expect(result.current.shuffle).toBe(true);
    expect(result.current.repeat).toBe('all');
  });

  it('toggleShuffle issues a Spotify Web API PUT with the inverted state', async () => {
    mockPlaybackState = makePlaybackState({ shuffle: false });
    const { result } = renderHook(() => useSpotifyAsEngine());
    await act(async () => { result.current.toggleShuffle(); });
    // Optimistic local override flips immediately
    expect(result.current.shuffle).toBe(true);
    // …and the API call goes out
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me/player/shuffle?state=true',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('toggleRepeat cycles none → all → one → none and PUTs to the Spotify API', async () => {
    mockPlaybackState = makePlaybackState({ repeat_mode: 0 });
    const { result } = renderHook(() => useSpotifyAsEngine());
    expect(result.current.repeat).toBe('none');
    await act(async () => { result.current.toggleRepeat(); });
    expect(result.current.repeat).toBe('all');
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      'https://api.spotify.com/v1/me/player/repeat?state=context',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('setSleepTimer schedules a Spotify pause once the timer expires', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useSpotifyAsEngine());
      act(() => { result.current.setSleepTimer(5_000); });
      expect(result.current.sleepTimerEnd).not.toBeNull();
      expect(mockControls.pause).not.toHaveBeenCalled();

      act(() => { vi.advanceTimersByTime(5_000); });
      expect(mockControls.pause).toHaveBeenCalledTimes(1);
      expect(result.current.sleepTimerEnd).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('crossfade/autoplay are local-only no-op stores for UI parity', () => {
    const { result } = renderHook(() => useSpotifyAsEngine());
    expect(result.current.crossfadeMs).toBe(0);
    expect(result.current.autoplay).toBe(true);
    act(() => { result.current.setCrossfadeMs(3_000); });
    expect(result.current.crossfadeMs).toBe(3_000);
    act(() => { result.current.toggleAutoplay(); });
    expect(result.current.autoplay).toBe(false);
  });

  it('inert fields (loadTrack, beep, attachVideoElement) do not throw', () => {
    const { result } = renderHook(() => useSpotifyAsEngine());
    expect(() => result.current.beep()).not.toThrow();
    expect(() => result.current.attachVideoElement(null)).not.toThrow();
    expect(result.current.loadTrack).toBeTypeOf('function');
  });
});
