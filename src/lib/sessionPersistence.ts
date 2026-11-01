/**
 * sessionPersistence
 *
 * Stores / retrieves the current Vibe session via the Origin Private File
 * System (OPFS). OPFS belongs to this origin and browser profile on this
 * device. Clearing site data/private browsing can remove it; export important
 * work separately. It is not a cloud or cross-device backup.
 *
 * File: vibe-session.json  (in the OPFS root directory)
 * Schema version: 1
 *
 * P7: loadSession() now validates the raw JSON against a structural guard
 *     before returning it as SessionSnapshot, instead of casting blindly.
 *     Invalid or partial payloads (corrupted OPFS data, migration mismatch)
 *     return null so the app starts clean rather than propagating corrupt state.
 */
import type { Section, SectionVersion } from '../types';
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
  sectionVersions?: Record<string, SectionVersion[]>;
  // UI navigation
  activeTab: AppTab;
  isStructureOpen: boolean;
  isLeftPanelOpen: boolean;
}

// ─── Structural guard (no Zod dependency in this module) ─────────────────────
// Validates the minimum required fields before we trust the payload.
// Full deep validation of `song` sections / `versions` is delegated to the
// SessionSchema / SongVersionSchema Zod schemas used at import time.

function isValidSnapshot(raw: unknown): raw is SessionSnapshot {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    r['schemaVersion'] === SESSION_SCHEMA_VERSION &&
    typeof r['savedAt'] === 'number' &&
    Array.isArray(r['song']) &&
    Array.isArray(r['structure']) &&
    typeof r['title'] === 'string' &&
    (r['titleOrigin'] === 'user' || r['titleOrigin'] === 'ai') &&
    typeof r['topic'] === 'string' &&
    typeof r['mood'] === 'string' &&
    typeof r['rhymeScheme'] === 'string' &&
    typeof r['targetSyllables'] === 'number' &&
    typeof r['songLanguage'] === 'string' &&
    typeof r['genre'] === 'string' &&
    typeof r['tempo'] === 'number' &&
    typeof r['instrumentation'] === 'string' &&
    typeof r['rhythm'] === 'string' &&
    typeof r['narrative'] === 'string' &&
    typeof r['musicalPrompt'] === 'string' &&
    typeof r['activeTab'] === 'string' &&
    typeof r['isStructureOpen'] === 'boolean' &&
    typeof r['isLeftPanelOpen'] === 'boolean'
  );
}

// ─── OPFS helpers ──────────────────────────────────────────────────────────────

function isOpfsAvailable(): boolean {
  return typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function';
}

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

// Preserve invocation order, including a reset queued while a write is pending.
// Web Locks additionally serialize cooperating tabs on this origin.
let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const run = pending.then(async (): Promise<T> => typeof navigator !== 'undefined' && navigator.locks
    ? await navigator.locks.request('vibe-session', operation)
    : await operation());
  pending = run.catch(() => {});
  return run;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function saveSession(payload: SessionSnapshot): Promise<void> {
  if (!isOpfsAvailable()) throw new Error('Session storage is unavailable. Export your current work.');
  // Snapshot before queueing: subsequent edits must not change this write.
  const contents = JSON.stringify({ ...payload, schemaVersion: SESSION_SCHEMA_VERSION });
  return serialize(async () => {
    const root = await getRoot();
    const fh = await root.getFileHandle(FILE_NAME, { create: true });
    const writable = await fh.createWritable();
    try {
      await writable.write(contents);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => {});
      throw error;
    }
    if (await (await fh.getFile()).text() !== contents) {
      throw new Error('Session storage could not be verified. Export your current work.');
    }
  });
}

export async function loadSession(): Promise<SessionSnapshot | null> {
  if (!isOpfsAvailable()) return null;
  try {
    const root = await getRoot();
    const fh = await root.getFileHandle(FILE_NAME);
    const file = await fh.getFile();
    const raw: unknown = JSON.parse(await file.text());
    // P7: structural validation instead of blind cast
    if (!isValidSnapshot(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  if (!isOpfsAvailable()) return;
  return serialize(async () => {
    try {
      const root = await getRoot();
      await root.removeEntry(FILE_NAME);
    } catch {
      // Reset stays non-blocking when the file is absent or storage is denied.
    }
  });
}
