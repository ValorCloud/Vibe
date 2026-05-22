export interface TrackEntry {
  id: string;
  title: string;
  source: 'cloud' | 'local' | 'lyria';
  url: string;
  memo?: string;
  linked?: boolean;
}

export interface ScanConfig {
  accept: 'wav' | 'mp3' | 'm4a' | 'mp4' | 'all';
  pattern: string;
}
