/**
 * Player domain types.
 *
 * Track: metadata for a single audio file in the local or cloud library.
 * AudioProtocol: filter by file extension in the Pattern Match sidebar.
 * PlayerStatus: playback machine state.
 */

export type AudioProtocol = 'wav' | 'mp3' | 'all';

export interface Track {
  id: string;
  title: string;
  /** Sector label shown in the sidebar (e.g. "CLOUD" | "LOCAL") */
  sector: 'cloud' | 'local';
  /** GCS or blob URL resolved at runtime */
  url: string;
  /** Optional user-authored mission memo, persisted to localStorage */
  memo?: string;
  /** Inferred from file extension */
  protocol: 'wav' | 'mp3';
  /** Duration in seconds, filled after first load */
  duration?: number;
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface PlayerState {
  tracks: Track[];
  currentIndex: number;
  status: PlayerStatus;
  progress: number;   // 0–1
  volume: number;     // 0–1
  filter: AudioProtocol;
  patternMatch: string;
}
