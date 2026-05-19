/**
 * lyria.ts
 * Lyria 3 domain types — mirrors suno.ts structure for uniform UI consumption.
 * Engine: Google DeepMind Lyria 3 (Clip = ~30s, Pro = ~3min)
 */

export type LyriaModel = 'lyria-3' | 'lyria-3-pro';

export type LyriaClipStatus =
  | 'submitted'
  | 'processing'
  | 'complete'
  | 'error';

/** Structured musical style descriptor, concatenated into a Lyria prompt server-side */
export interface LyriaStyleDescriptor {
  /** e.g. 'afrobeats', 'highlife', 'afro-pop', 'gospel' */
  genre: string;
  /** e.g. 'upbeat', 'melancholic', 'cinematic', 'aggressive' */
  mood?: string;
  /** BPM — Lyria honours approximate tempo hints */
  tempo?: number;
  /** e.g. 'piano, acoustic guitar, talking drum, bass' */
  instruments?: string;
  /** e.g. 'female lead, West African accent, smooth' */
  vocalStyle?: string;
  /** e.g. '2000s Lagos highlife' */
  era?: string;
}

export interface LyriaGenerateParams {
  /** Verbatim lyrics from the Lyricist Core engine */
  lyrics: string;
  /** Human-readable style summary OR a LyriaStyleDescriptor (serialized server-side) */
  style: string | LyriaStyleDescriptor;
  title?: string;
  /** 'clip' → ~30s preview via lyria-3 | 'full' → ~3min via lyria-3-pro */
  mode: 'clip' | 'full';
  /** Optional negative prompt (instruments/styles to avoid) */
  negativePrompt?: string;
  /** Deterministic seed for reproducible generation */
  seed?: number;
}

export interface LyriaClip {
  id: string;
  title: string;
  status: LyriaClipStatus;
  /** Public URL — available once status === 'complete' */
  audioUrl: string | null;
  /** Google SynthID watermarked: always true for Lyria outputs */
  synthIdWatermarked: boolean;
  /** Duration in seconds as reported by API (null until complete) */
  durationSeconds: number | null;
  model: LyriaModel;
  prompt: string;
  createdAt: string;
  errorMessage: string | null;
}

/**
 * LyriaTaskStatus — represents the local async generation state in UI components.
 *
 * Phases:
 *   idle       — initial state, nothing running
 *   generating — request fired, waiting for first server response
 *   polling    — async job in progress; elapsed is seconds since generation started
 *   done       — generation succeeded; clip is the complete LyriaClip
 *   error      — generation failed; message is the human-readable error string
 */
export type LyriaTaskStatus =
  | { phase: 'idle' }
  | { phase: 'generating' }
  | { phase: 'polling'; elapsed: number }
  | { phase: 'done'; clip: LyriaClip }
  | { phase: 'error'; message: string };

/** KPI snapshot exposed in the UI */
export interface LyriaKPISnapshot {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  lastGenerationMs: number | null;
  lastError: string | null;
}
