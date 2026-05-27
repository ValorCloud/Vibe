import type { Section, SongVersion, PromptSnapshot } from '../types';
import type { SimilarityMatch } from './similarityUtils';
import { calculateSimilarityWithMetadata } from './rhymeDetection';
import { DEFAULT_MOOD, DEFAULT_TOPIC } from './songDefaults';
import { safeGetItem, safeSetItem } from './safeStorage';
import { normalizeLoadedSection } from './songUtils';
import { SectionSchema } from '../schemas/sessionSchema';
import { LibraryAssetSchema, LibraryStoreSchema } from '../schemas/librarySchema';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// History size caps — prevents unbounded localStorage growth.
// ---------------------------------------------------------------------------
const MAX_ASSET_VERSIONS    = 50;
const MAX_PROMPT_SNAPSHOTS  = 100;

export type LibraryAsset = {
  id: string;
  title: string;
  artist?: string;
  timestamp: number;
  type: 'song' | 'poem' | 'lyrics';
  sections: Section[];
  versions?: SongVersion[];
  metadata?: {
    album?: string;
    year?: number;
    genre?: string;
    language?: string;
    topic?: string;
    mood?: string;
    tempo?: number;
    instrumentation?: string;
    rhythm?: string;
    narrative?: string;
    musicalPrompt?: string;
    /** Ordered history of musical prompt values, oldest first. */
    promptSnapshots?: PromptSnapshot[];
    [key: string]: unknown;
  };
};

export type LibraryAsset_Metadata = NonNullable<LibraryAsset['metadata']>;

export type LibrarySearchResult = SimilarityMatch & {
  assetType: 'song' | 'poem' | 'lyrics';
  artist?: string;
  metadata?: LibraryAsset['metadata'];
};

// ---------------------------------------------------------------------------
// M2 fix: version-stamp + merge strategy for atomic-safe writes.
// ---------------------------------------------------------------------------

type LibraryStore = {
  version: number;
  assets: LibraryAsset[];
};

const LIBRARY_KEY = 'lyricist_library';

const readStore = (): LibraryStore => {
  try {
    const raw = safeGetItem(LIBRARY_KEY);
    if (!raw) return { version: 0, assets: [] };
    const json = JSON.parse(raw) as unknown;
    const result = LibraryStoreSchema.safeParse(json);
    if (!result.success) {
      logger.warn(
        '[libraryUtils] readStore: invalid library payload, resetting to empty store.\n',
        result.error.format(),
      );
      return { version: 0, assets: [] };
    }
    return result.data as unknown as LibraryStore;
  } catch {
    return { version: 0, assets: [] };
  }
};

const writeStore = (store: LibraryStore): boolean =>
  safeSetItem(LIBRARY_KEY, JSON.stringify(store));

/**
 * Merge `incoming` assets into `base`, keeping all unique ids.
 * `incoming` wins on conflict (same id → keep incoming version).
 */
export const mergeAssets = (base: LibraryAsset[], incoming: LibraryAsset[]): LibraryAsset[] => {
  const map = new Map<string, LibraryAsset>();
  for (const a of base) map.set(a.id, a);
  for (const a of incoming) map.set(a.id, a);
  return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
};

export const loadLibraryAssets = async (): Promise<LibraryAsset[]> => {
  return readStore().assets;
};

export type LoadedLibraryAssetState = {
  song: Section[];
  structure: string[];
  title: string;
  topic: string;
  mood: string;
  rhymeScheme: string;
  targetSyllables: number;
  genre: string;
  tempo: number;
  instrumentation: string;
  rhythm: string;
  narrative: string;
  musicalPrompt: string;
  versions: SongVersion[];
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const loadAssetIntoEditor = (asset: LibraryAsset): LoadedLibraryAssetState => {
  const song = asset.sections.map(section => {
    const parsed = SectionSchema.safeParse(section);
    return normalizeLoadedSection(parsed.success ? parsed.data : toRecord(section));
  });
  const firstSection = song[0];
  const metadata = asset.metadata;

  return {
    song,
    structure: song.map(section => section.name),
    title: asset.title,
    topic: typeof metadata?.topic === 'string' ? metadata.topic : DEFAULT_TOPIC,
    mood: typeof metadata?.mood === 'string' ? metadata.mood : DEFAULT_MOOD,
    rhymeScheme: firstSection?.rhymeScheme || 'AABB',
    targetSyllables: firstSection?.targetSyllables || 10,
    genre: typeof metadata?.genre === 'string' ? metadata.genre : '',
    tempo: (typeof metadata?.tempo === 'number' || typeof metadata?.tempo === 'string')
      ? parseInt(String(metadata.tempo), 10) || 120
      : 120,
    instrumentation: typeof metadata?.instrumentation === 'string' ? metadata.instrumentation : '',
    rhythm: typeof metadata?.rhythm === 'string' ? metadata.rhythm : '',
    narrative: typeof metadata?.narrative === 'string' ? metadata.narrative : '',
    musicalPrompt: typeof metadata?.musicalPrompt === 'string' ? metadata.musicalPrompt : '',
    versions: Array.isArray(asset.versions) ? asset.versions : [],
  };
};

export const saveAssetToLibrary = async (asset: Omit<LibraryAsset, 'id' | 'timestamp'>): Promise<LibraryAsset> => {
  const newAsset: LibraryAsset = {
    ...asset,
    id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
  };
  try {
    const current = readStore();
    const merged = mergeAssets(current.assets, [newAsset]);
    writeStore({ version: current.version + 1, assets: merged });
    return newAsset;
  } catch (error) {
    logger.error('Failed to save asset to library:', error);
    throw error;
  }
};

/**
 * Update an existing LibraryAsset in place.
 *
 * Before applying the patch:
 * 1. The current asset state is pushed into `versions[]` as a named snapshot
 *    (auto-label "v{n} – {ISO date}") so the full history is preserved.
 *    versions[] is capped at MAX_ASSET_VERSIONS (oldest entries dropped first).
 * 2. If `patch.metadata.musicalPrompt` differs from the stored value, the
 *    old prompt is appended to `metadata.promptSnapshots[]` before overwrite.
 *    promptSnapshots[] is capped at MAX_PROMPT_SNAPSHOTS.
 *
 * Nothing happens if `id` is not found — returns `null` in that case.
 */
export const updateAssetInLibrary = async (
  id: string,
  patch: Partial<Omit<LibraryAsset, 'id'>>,
): Promise<LibraryAsset | null> => {
  try {
    const current = readStore();
    const idx = current.assets.findIndex(a => a.id === id);
    if (idx === -1) return null;

    const existing = current.assets[idx] as LibraryAsset;
    const now = Date.now();

    // --- 1. Snapshot current state into versions[] ---
    const existingVersions: SongVersion[] = Array.isArray(existing.versions)
      ? existing.versions
      : [];
    const versionCount = existingVersions.length + 1;
    const versionLabel = `v${versionCount} – ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')}`;
    const snapshot: SongVersion = {
      id:          `ver_${now}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp:   now,
      song:        existing.sections,
      structure:   existing.sections.map(s => s.name),
      title:       existing.title,
      titleOrigin: 'user',
      topic:       existing.metadata?.topic ?? '',
      mood:        existing.metadata?.mood ?? '',
      ...(existing.metadata?.musicalPrompt !== undefined && {
        musicalPrompt: existing.metadata.musicalPrompt,
      }),
      name: versionLabel,
    };

    // Cap versions[] at MAX_ASSET_VERSIONS — keep the most recent.
    const cappedVersions = [...existingVersions, snapshot].slice(-MAX_ASSET_VERSIONS);

    // --- 2. Snapshot old musicalPrompt if it changes ---
    const incomingPrompt = patch.metadata?.musicalPrompt;
    const oldPrompt = existing.metadata?.musicalPrompt;
    const existingSnapshots: PromptSnapshot[] = Array.isArray(existing.metadata?.promptSnapshots)
      ? (existing.metadata!.promptSnapshots as PromptSnapshot[])
      : [];

    let updatedSnapshots = existingSnapshots;
    if (
      typeof incomingPrompt === 'string' &&
      typeof oldPrompt === 'string' &&
      incomingPrompt !== oldPrompt &&
      oldPrompt.trim() !== ''
    ) {
      const promptSnapshot: PromptSnapshot = {
        timestamp: now,
        prompt:    oldPrompt,
        label:     `Before update ${new Date(now).toISOString().slice(0, 10)}`,
      };
      // Cap promptSnapshots[] at MAX_PROMPT_SNAPSHOTS — keep the most recent.
      updatedSnapshots = [...existingSnapshots, promptSnapshot].slice(-MAX_PROMPT_SNAPSHOTS);
    }

    // --- 3. Build updated asset ---
    // exactOptionalPropertyTypes: use conditional spread to avoid assigning
    // `undefined` to `promptSnapshots` — TS2375.
    const updatedMetadata: LibraryAsset_Metadata = {
      ...existing.metadata,
      ...patch.metadata,
      ...(updatedSnapshots.length > 0 && { promptSnapshots: updatedSnapshots }),
    };

    const updatedAsset: LibraryAsset = {
      ...existing,
      ...patch,
      id,
      timestamp: now,
      versions: cappedVersions,
      metadata: updatedMetadata,
    };

    const updatedAssets = [
      ...current.assets.slice(0, idx),
      updatedAsset,
      ...current.assets.slice(idx + 1),
    ].sort((a, b) => b.timestamp - a.timestamp);

    writeStore({ version: current.version + 1, assets: updatedAssets });
    return updatedAsset;
  } catch (error) {
    logger.error('Failed to update asset in library:', error);
    throw error;
  }
};

export const deleteAssetFromLibrary = async (assetId: string): Promise<void> => {
  try {
    const current = readStore();
    const updated = current.assets.filter(a => a.id !== assetId);
    writeStore({ version: current.version + 1, assets: updated });
  } catch (error) {
    logger.error('Failed to delete asset from library:', error);
    throw error;
  }
};

export const purgeLibrary = async (): Promise<void> => {
  try {
    writeStore({ version: 0, assets: [] });
  } catch (error) {
    logger.error('Failed to purge library:', error);
    throw error;
  }
};

export const findSimilarAssetsInLibrary = async (
  currentSong: Section[],
  _threshold = 0,
  limit = 3,
): Promise<LibrarySearchResult[]> => {
  if (currentSong.length === 0) return [];
  const library = await loadLibraryAssets();
  if (library.length === 0) return [];
  return library
    .filter(asset => asset.sections.length > 0)
    .map((asset): LibrarySearchResult => {
      const similarityData = calculateSimilarityWithMetadata(currentSong, asset.sections);
      return {
        ...similarityData,
        versionId: asset.id,
        versionName: asset.title,
        title: asset.title,
        timestamp: asset.timestamp,
        assetType: asset.type,
        ...(asset.artist !== undefined && { artist: asset.artist }),
        ...(asset.metadata !== undefined && { metadata: asset.metadata }),
      };
    })
    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
    .slice(0, limit);
};

// ---------------------------------------------------------------------------
// File-import / text-extraction logic lives in `libraryImport.ts`.
// We re-export the public surface here for backward compatibility with all
// existing callers (`import { extractTextFromDocx } from './libraryUtils'`).
// ---------------------------------------------------------------------------

export {
  extractMetadataFromText,
  extractTextFromDocx,
  extractTextFromOdt,
  extractImportPayloadFromText,
  extractImportPayloadFromDocx,
  extractImportPayloadFromOdt,
  importAssetsFromFile,
  parseTextToSections,
  type ImportedSongFilePayload,
  type ExtractedTextMetadata,
} from './libraryImport';

export const exportLibraryToJson = async (): Promise<Blob> => {
  const library = await loadLibraryAssets();
  const json = JSON.stringify(library, null, 2);
  return new Blob([json], { type: 'application/json' });
};
