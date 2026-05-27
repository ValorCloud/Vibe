import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SpotifyPlayerState,
  SpotifySDKPlayer,
  SpotifyPlaybackState,
  WebPlaybackError,
} from '../types/spotify';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// SDK script loader (idempotent)
// ---------------------------------------------------------------------------

let sdkReady = false;
let sdkReadyCallbacks: Array<() => void> = [];

if (typeof window !== 'undefined') {
  (window as Window & { onSpotifyWebPlaybackSDKReady?: () => void }).onSpotifyWebPlaybackSDKReady = () => {
    sdkReady = true;
    sdkReadyCallbacks.forEach(cb => cb());
    sdkReadyCallbacks = [];
  };
}

function loadSpotifySDK(): Promise<void> {
  return new Promise(resolve => {
    if (sdkReady) { resolve(); return; }
    sdkReadyCallbacks.push(resolve);
    if (!document.querySelector('script[src*="spotify-player"]')) {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEVICE_NAME = 'Lyricist Player';
export const SPOTIFY_VOLUME_DEFAULT = 0.7;
export const SPOTIFY_VOLUME_STORAGE_KEY = 'voxnova.spotify.volume';

export function getStoredSpotifyVolume(): number {
  if (typeof window === 'undefined') return SPOTIFY_VOLUME_DEFAULT;
  const raw = window.localStorage.getItem(SPOTIFY_VOLUME_STORAGE_KEY);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return SPOTIFY_VOLUME_DEFAULT;
  return Math.max(0, Math.min(1, parsed));
}

export interface UseSpotifyEngineOptions {
  accessToken: string | null | undefined;
  getValidToken: () => Promise<string | null>;
}

/**
 * Two mutually exclusive play modes:
 * - context mode  : play a playlist/album/artist from a specific track offset
 * - tracks mode   : play an ad-hoc list of track URIs (single track or queue)
 */
export type PlayRequest =
  | { contextUri: string; offsetUri: string }
  | { uris: string[] };

export interface SpotifyEngineControls {
  play: (req: PlayRequest) => Promise<void>;
  resume: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (fraction: number) => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
}

export interface UseSpotifyEngineResult {
  playerState: SpotifyPlayerState;
  playbackState: SpotifyPlaybackState | null;
  controls: SpotifyEngineControls;
  deviceId: string | null;
}

export function useSpotifyEngine({ accessToken, getValidToken }: UseSpotifyEngineOptions): UseSpotifyEngineResult {
  const [playerState, setPlayerState] = useState<SpotifyPlayerState>('idle');
  const [playbackState, setPlaybackState] = useState<SpotifyPlaybackState | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const playerRef = useRef<SpotifySDKPlayer | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    const init = async () => {
      setPlayerState('loading');
      await loadSpotifySDK();
      if (cancelled) return;

      const { Spotify } = window;

      const player = new Spotify.Player({
        name: DEVICE_NAME,
        volume: getStoredSpotifyVolume(),
        getOAuthToken: (cb: (token: string) => void) => {
          void getValidToken().then((token) => {
            if (token) cb(token);
          });
        },
      });

      (player.addListener as (event: 'ready', cb: (payload: { device_id: string }) => void) => boolean)(
        'ready',
        ({ device_id }) => {
          if (cancelled) return;
          setDeviceId(device_id);
          setPlayerState('ready');
        },
      );

      (player.addListener as (event: 'not_ready', cb: (payload: { device_id: string }) => void) => boolean)(
        'not_ready',
        () => {
          if (cancelled) return;
          setPlayerState('idle');
          setDeviceId(null);
        },
      );

      (player.addListener as (event: 'player_state_changed', cb: (state: SpotifyPlaybackState | null) => void) => boolean)(
        'player_state_changed',
        (state) => {
          if (cancelled) return;
          setPlaybackState(state);
          if (state) setPlayerState('playing');
        },
      );

      (player.addListener as (event: 'initialization_error', cb: (err: WebPlaybackError) => void) => boolean)(
        'initialization_error',
        ({ message }) => { if (!cancelled) { logger.error('[SpotifyEngine] init:', message); setPlayerState('error'); } },
      );

      (player.addListener as (event: 'authentication_error', cb: (err: WebPlaybackError) => void) => boolean)(
        'authentication_error',
        ({ message }) => { if (!cancelled) { logger.error('[SpotifyEngine] auth:', message); setPlayerState('error'); } },
      );

      (player.addListener as (event: 'account_error', cb: (err: WebPlaybackError) => void) => boolean)(
        'account_error',
        ({ message }) => { if (!cancelled) { logger.error('[SpotifyEngine] account (Premium required):', message); setPlayerState('error'); } },
      );

      await player.connect();
      playerRef.current = player;
    };

    void init();

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
      setPlayerState('idle');
      setDeviceId(null);
      setPlaybackState(null);
    };
  }, [accessToken, getValidToken]);

  const play = useCallback(async (req: PlayRequest) => {
    if (!deviceId) return;
    const token = await getValidToken();
    if (!token) return;
    const body = 'contextUri' in req
      ? { context_uri: req.contextUri, offset: { uri: req.offsetUri } }
      : { uris: req.uris };
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }, [deviceId, getValidToken]);

  const resume = useCallback(async () => { await playerRef.current?.resume(); }, []);
  const pause = useCallback(async () => { await playerRef.current?.pause(); }, []);
  const seek = useCallback(async (positionMs: number) => { await playerRef.current?.seek(positionMs); }, []);
  const setVolume = useCallback(async (fraction: number) => {
    const normalized = Math.max(0, Math.min(1, fraction));
    await playerRef.current?.setVolume(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SPOTIFY_VOLUME_STORAGE_KEY, String(normalized));
    }
  }, []);
  const nextTrack = useCallback(async () => { await playerRef.current?.nextTrack(); }, []);
  const previousTrack = useCallback(async () => { await playerRef.current?.previousTrack(); }, []);

  return {
    playerState,
    playbackState,
    deviceId,
    controls: { play, resume, pause, seek, setVolume, nextTrack, previousTrack },
  };
}
