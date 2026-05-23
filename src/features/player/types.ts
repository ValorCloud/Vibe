export type TrackSource = 'cloud' | 'local' | 'lyria' | 'spotify';

export interface TrackEntry {
  id: string;
  title: string;
  source: TrackSource;
  url: string;
  memo?: string;
  linked?: boolean;
  /** True when the file is a video container (mp4/webm/mov/mkv) */
  isVideo?: boolean;
  /** OneDrive Graph item ID — present only for source === 'cloud' */
  oneDriveItemId?: string;
  /** OneDrive drive ID — used for multi-drive support */
  oneDrivedriveId?: string;
  /** ISO timestamp of last modification — used for display */
  oneDriveLastModified?: string;
  /** Approximate file size in bytes */
  oneDriveSize?: number;
  /** Known media duration in seconds, populated after metadata loads */
  durationSeconds?: number;
  /** Spotify URI — present only for source === 'spotify' */
  spotifyUri?: string;
  /** Spotify track ID — present only for source === 'spotify' */
  spotifyId?: string;
  /** Spotify album artwork URL */
  spotifyArtworkUrl?: string;
  /** Spotify artist name(s) */
  spotifyArtists?: string[];
  /** Spotify album name */
  spotifyAlbum?: string;
}

export const SCAN_PROTOCOLS = [
  'wav', 'mp3', 'm4a', 'flac', 'ogg', 'opus', 'aac', 'aiff', 'wma',
  'mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v',
] as const;

export type ScanProtocol = typeof SCAN_PROTOCOLS[number];

export interface ScanConfig {
  accept: ScanProtocol[];
  pattern: string;
}
