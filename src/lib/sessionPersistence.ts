/**
 * sessionPersistence
 *
 * Stores / retrieves the current Vibe session via the Origin Private File
 * System (OPFS).  OPFS is attached to the device + origin — it is NOT
 * browser-profile-dependent and persists across browser restarts.
 *
 * File: vibe-session.json  (in the OPFS root directory)
 * Schema version: 1
 */
import type { Section } from '../types';
import type { SongVersion } from '../types';
import type { AppTab } from '../hooks/useUIState';

export const SESSION_SCHEMA_VERSION = 1;
const FILE_NAME = 'vibe-session.json';

export interface SessionSnapshot {
  schemaVersion: number;
  savedAt: number;          // Date.now()
  // Song data
  song: Section[];
  structure: string[];
  // Meta
  title: string;
  titleOrigin: 'user' | 'ai';
  topic: string;
  mood: string;
  rhymeScheme: string;
  targetSyllables: number;
  songLanguage: string;
  genre: string;
  tempo: number;
  songDurationSeconds?: number;
  timeSignature?: [number, number];
  instrumentation: string;
  rhythm: string;
  narrative: string;
  musicalPrompt: string;
  versions?: SongVersion[];
  // UI navigation
  activeTab: AppTab;
  isStructureOpen: boolean;
  isLeftPanelOpen: boolean;
}

// ── OPFS helpers ──────────────────────────────────────────────────────────────

function isOpfsAvailable(): boolean {
  return typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function';
}

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function saveSession(payload: SessionSnapshot): Promise<void> {
  if (!isOpfsAvailable()) return;
  try {
    const root = await getRoot();
    const fh = await root.getFileHandle(FILE_NAME, { create: true });
    const writable = await fh.createWritable();
    await writable.write(JSON.stringify({ ...payload, schemaVersion: SESSION_SCHEMA_VERSION }));
    await writable.close();
  } catch {
    // Non-blocking — never crash the app on persistence failure
  }
}

export async function loadSession(): Promise<SessionSnapshot | null> {
  if (!isOpfsAvailable()) return null;
  try {
    const root = await getRoot();
    const fh = await root.getFileHandle(FILE_NAME);
    const file = await fh.getFile();
    const raw = JSON.parse(await file.text()) as Partial<SessionSnapshot>;
    if (raw.schemaVersion !== SESSION_SCHEMA_VERSION) return null;
    return raw as SessionSnapshot;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  if (!isOpfsAvailable()) return;
  try {
    const root = await getRoot();
    await root.removeEntry(FILE_NAME);
  } catch {
    // File might not exist — ignore
  }
}
