/**
 * player/types.ts
 * Shared types for the LCARS Player feature.
 */

export interface Track {
  id: string;        // GCS UUID (cloud) or blob URL (local)
  title: string;
  source: 'cloud' | 'local';
  memo: string;
  fileName?: string; // local only
  linked: boolean;   // false = blob URL expired
}

export type LibraryTab = 'cloud' | 'local';
export type ScanType   = 'wav' | 'mp3' | 'all';

export interface PlayerState {
  library:        Track[];
  selectedTrack:  Track;
  isPlaying:      boolean;
  libraryTab:     LibraryTab;
  scanType:       ScanType;
  scanPattern:    string;
}
