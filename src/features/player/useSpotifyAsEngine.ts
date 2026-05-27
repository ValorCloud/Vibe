import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioEngineState, RepeatMode } from './useAudioEngine';
import {
  getStoredSpotifyVolume,
  SPOTIFY_VOLUME_STORAGE_KEY,
} from '../../hooks/useSpotifyEngine';
import { useSpotifyEngine_ } from '../../contexts/SpotifyEngineContext';
import { useSpotifyAuthActions } from '../../contexts/SpotifyAuthContext';
import { logger } from '../../utils/logger';

const REPEAT_MODE_BY_INDEX: RepeatMode[] = ['none', 'all', 'one'];
const REPEAT_INDEX_BY_MODE: Record<RepeatMode, 0 | 1 | 2> = {
  none: 0,
  all: 1,
  one: 2,
};
const REPEAT_API_VALUE: Record<RepeatMode, 'off' | 'context' | 'track'> = {
  none: 'off',
  all: 'context',
  one: 'track',
};

/**
 * Adapter that exposes the Spotify Web Playback engine through the same
 * `AudioEngineState` contract as the local audio engine. This lets the canonical
 * player widgets (SeekBar, PlayerControls, VolumeControl, …) drive Spotify
 * playback without any structural changes to the player page.
 *
 * Fields that have no Spotify equivalent (audioRef, trackInfo, loadTrack,
 * beep, video attachment, crossfade) are exposed as inert/no-op so the player
 * shell can render uniformly. Sleep timer is implemented locally by issuing a
 * Spotify pause when the timer fires. Repeat/shuffle are routed through the
 * Spotify Web API; autoplay is tracked locally for UI parity.
 */
export function useSpotifyAsEngine(): AudioEngineState {
  const { playbackState, controls } = useSpotifyEngine_();
  const { getValidToken } = useSpotifyAuthActions();

  // ── Smoothly interpolate position between SDK state updates ──────────────
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!playbackState || playbackState.paused) return;
    const id = window.setInterval(() => setTick(t => t + 1), 250);
    return () => window.clearInterval(id);
  }, [playbackState]);

  const sdkPosMs = playbackState?.position ?? 0;
  const sdkTimestamp = playbackState?.timestamp ?? 0;
  const paused = playbackState?.paused ?? true;
  const durationMs = playbackState?.track_window?.current_track?.duration_ms ?? 0;

  const interpolatedPosMs = useMemo(() => {
    if (!playbackState) return 0;
    if (paused || !sdkTimestamp) return sdkPosMs;
    const drift = Date.now() - sdkTimestamp;
    return Math.min(durationMs, sdkPosMs + Math.max(0, drift));
    // tick is intentionally a dependency to re-evaluate on each interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackState, paused, sdkPosMs, sdkTimestamp, durationMs, tick]);

  // ── Volume (mirrors the Spotify-specific storage) ────────────────────────
  const [volume, setVolumeState] = useState<number>(() => getStoredSpotifyVolume());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SPOTIFY_VOLUME_STORAGE_KEY) return;
      setVolumeState(getStoredSpotifyVolume());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    void controls.setVolume(clamped);
  }, [controls]);

  // ── Local state for player-shell parity (crossfade/autoplay) ─────────────
  const [autoplay, setAutoplay] = useState(true);
  const [crossfadeMs, setCrossfadeMs] = useState(0);
  const [sleepTimerEnd, setSleepTimerEndState] = useState<number | null>(null);

  // Sleep timer — issues a Spotify pause when it expires.
  const sleepTimerRef = useRef<number | null>(null);
  const setSleepTimer = useCallback((ms: number | null) => {
    if (sleepTimerRef.current !== null) {
      window.clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (ms === null) { setSleepTimerEndState(null); return; }
    const end = Date.now() + ms;
    setSleepTimerEndState(end);
    sleepTimerRef.current = window.setTimeout(() => {
      sleepTimerRef.current = null;
      setSleepTimerEndState(null);
      void controls.pause();
    }, ms);
  }, [controls]);
  useEffect(() => () => {
    if (sleepTimerRef.current !== null) window.clearTimeout(sleepTimerRef.current);
  }, []);

  // ── Repeat & shuffle: route to the Spotify Web API ───────────────────────
  const sdkRepeat: RepeatMode = REPEAT_MODE_BY_INDEX[playbackState?.repeat_mode ?? 0] ?? 'none';
  const sdkShuffle = playbackState?.shuffle ?? false;

  // Optimistic local mirrors so the UI updates immediately while the API call
  // round-trips. They're superseded by `sdkRepeat`/`sdkShuffle` once Spotify
  // confirms the change via the next state update.
  const [repeatOverride, setRepeatOverride] = useState<RepeatMode | null>(null);
  const [shuffleOverride, setShuffleOverride] = useState<boolean | null>(null);
  useEffect(() => { setRepeatOverride(null); }, [playbackState?.repeat_mode]);
  useEffect(() => { setShuffleOverride(null); }, [playbackState?.shuffle]);

  const repeat = repeatOverride ?? sdkRepeat;
  const shuffle = shuffleOverride ?? sdkShuffle;

  const callSpotifyApi = useCallback(async (path: string) => {
    const token = await getValidToken();
    if (!token) return;
    try {
      await fetch(`https://api.spotify.com/v1/me/player/${path}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      logger.warn('[useSpotifyAsEngine] Spotify API call failed:', err);
    }
  }, [getValidToken]);

  const toggleRepeat = useCallback(() => {
    const nextIdx = ((REPEAT_INDEX_BY_MODE[repeat] + 1) % 3) as 0 | 1 | 2;
    const next: RepeatMode = REPEAT_MODE_BY_INDEX[nextIdx] ?? 'none';
    setRepeatOverride(next);
    void callSpotifyApi(`repeat?state=${REPEAT_API_VALUE[next]}`);
  }, [repeat, callSpotifyApi]);

  const toggleShuffle = useCallback(() => {
    const next = !shuffle;
    setShuffleOverride(next);
    void callSpotifyApi(`shuffle?state=${next ? 'true' : 'false'}`);
  }, [shuffle, callSpotifyApi]);

  const toggleAutoplay = useCallback(() => setAutoplay(a => !a), []);

  // ── Transport ────────────────────────────────────────────────────────────
  const isPlaying = !paused && !!playbackState?.track_window?.current_track;

  const play = useCallback(async () => { await controls.resume(); }, [controls]);
  const pause = useCallback(() => { void controls.pause(); }, [controls]);
  const togglePlay = useCallback(() => {
    if (isPlaying) void controls.pause();
    else void controls.resume();
  }, [isPlaying, controls]);
  const seek = useCallback((seconds: number) => {
    void controls.seek(Math.max(0, seconds) * 1000);
  }, [controls]);

  // ── Stable refs for inert fields ─────────────────────────────────────────
  const audioRef = useRef<HTMLMediaElement>(null);
  const onTrackEndedRef = useRef<(() => void) | undefined>(undefined);
  const setOnTrackEnded = useCallback((cb: (() => void) | undefined) => {
    onTrackEndedRef.current = cb;
  }, []);

  return {
    audioRef,
    isPlaying,
    currentTime: interpolatedPosMs / 1000,
    duration: durationMs / 1000,
    volume,
    repeat,
    shuffle,
    autoplay,
    crossfadeMs,
    sleepTimerEnd,
    trackInfo: null,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    loadTrack: async () => { /* not applicable: Spotify tracks are loaded via the browser panel */ },
    beep: () => { /* no-op: no WebAudio context in Spotify mode */ },
    toggleRepeat,
    toggleShuffle,
    toggleAutoplay,
    setCrossfadeMs,
    setSleepTimer,
    ...(onTrackEndedRef.current ? { onTrackEnded: onTrackEndedRef.current } : {}),
    setOnTrackEnded,
    attachVideoElement: () => { /* no-op: no local video element in Spotify mode */ },
  };
}
