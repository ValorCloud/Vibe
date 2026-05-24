// ---------------------------------------------------------------------------
// Spotify OAuth
// ---------------------------------------------------------------------------

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  expires_in: number;
  /** Only present on initial authorization, not on refresh */
  refresh_token?: string;
}

export type SpotifyAuthStatus =
  | 'idle'
  | 'authenticating'
  | 'authenticated'
  | 'error';

export interface SpotifyAuthState {
  status: SpotifyAuthStatus;
  accessToken: string | null;
  expiresAt: number | null;
  error: string | null;
}

export interface SpotifyTokenProvider {
  getValidToken: () => Promise<string | null>;
  forceRefreshToken: () => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Web Playback SDK — Player lifecycle
// ---------------------------------------------------------------------------

export type SpotifyPlayerState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'error';

export interface WebPlaybackError {
  message: string;
}

// ---------------------------------------------------------------------------
// Web Playback SDK — Playback state
// ---------------------------------------------------------------------------

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  name: string;
  uri: string;
}

export interface SpotifyAlbum {
  name: string;
  uri: string;
  images: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string | null;
  uri: string;
  type: 'track' | 'episode' | 'ad';
  name: string;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  is_playable: boolean;
}

export interface SpotifyPlaybackState {
  context: {
    uri: string | null;
    metadata: Record<string, unknown>;
  };
  disallows: {
    pausing?: boolean;
    peeking_next?: boolean;
    peeking_prev?: boolean;
    resuming?: boolean;
    seeking?: boolean;
    skipping_next?: boolean;
    skipping_prev?: boolean;
  };
  duration: number;
  paused: boolean;
  position: number;
  repeat_mode: 0 | 1 | 2;
  shuffle: boolean;
  timestamp: number;
  track_window: {
    current_track: SpotifyTrack;
    next_tracks: SpotifyTrack[];
    previous_tracks: SpotifyTrack[];
  };
}

// ---------------------------------------------------------------------------
// Web Playback SDK — Player instance (minimal surface used by the hook)
// ---------------------------------------------------------------------------

export interface SpotifySDKPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (data: unknown) => void): boolean;
  removeListener(event: string, cb?: (data: unknown) => void): boolean;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
  setName(name: string): Promise<void>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Window extension
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifySDKPlayer;
    };
  }
}
