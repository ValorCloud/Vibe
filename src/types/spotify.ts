// ---------------------------------------------------------------------------
// Spotify Web Playback SDK — global type declarations
// ---------------------------------------------------------------------------

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  uri: string;
  images: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  is_playable: boolean;
}

export interface SpotifyPlayerState {
  context: {
    uri: string | null;
    metadata: Record<string, unknown> | null;
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

export interface SpotifyDevice {
  device_id: string;
}

export interface SpotifyReadyEvent {
  device_id: string;
}

export interface SpotifyError {
  message: string;
}

export interface SpotifyPlayerInstance {
  connect(): Promise<boolean>;
  disconnect(): void;
  getCurrentState(): Promise<SpotifyPlayerState | null>;
  getVolume(): Promise<number>;
  nextTrack(): Promise<void>;
  pause(): Promise<void>;
  previousTrack(): Promise<void>;
  resume(): Promise<void>;
  seek(position_ms: number): Promise<void>;
  setName(name: string): Promise<void>;
  setVolume(volume: number): Promise<void>;
  togglePlay(): Promise<void>;
  addListener(event: 'ready', cb: (e: SpotifyReadyEvent) => void): boolean;
  addListener(event: 'not_ready', cb: (e: SpotifyReadyEvent) => void): boolean;
  addListener(event: 'player_state_changed', cb: (state: SpotifyPlayerState | null) => void): boolean;
  addListener(event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', cb: (e: SpotifyError) => void): boolean;
  removeListener(event: string, cb?: (...args: unknown[]) => void): boolean;
}

// ---------------------------------------------------------------------------
// Spotify Web API — /me/player responses
// ---------------------------------------------------------------------------

export interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  progress_ms: number | null;
  item: SpotifyTrack | null;
  device: {
    id: string;
    name: string;
    type: string;
    volume_percent: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export type SpotifyAuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error';

export interface SpotifyAuthState {
  status: SpotifyAuthStatus;
  accessToken: string | null;
  expiresAt: number | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// SDK global augmentation (injected by https://sdk.scdn.co/spotify-player.js)
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
  }
}
