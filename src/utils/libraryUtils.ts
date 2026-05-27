import type { Section, SongVersion, PromptSnapshot } from '../types';
import type { SimilarityMatch } from './similarityUtils';
import { calculateSimilarityWithMetadata } from './rhymeDetection';
import { DEFAULT_MOOD, DEFAULT_TOPIC } from './songDefaults';
import { safeGetItem, safeSetItem } from './safeStorage';
import { normalizeLoadedSection } from './songUtils';
import { SectionSchema } from '../schemas/sessionSchema';
import { LibraryAssetSchema, LibraryStoreSchema } from '../schemas/librarySchema';

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

/** Maximum number of version snapshots kept per asset. Oldest are dropped. */
const MAX_VERSIONS = 50;

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
      console.warn(
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
    console.error('Failed to save asset to library:', error);
    throw error;
  }
};

/**
 * Update an existing LibraryAsset in place.
 *
 * Before applying the patch:
 * 1. The current asset state is pushed into `versions[]` as a named snapshot
 *    (auto-label "v{n} – {ISO date}") so the full history is preserved.
 * 2. If `patch.metadata.musicalPrompt` differs from the stored value, the
 *    old prompt is appended to `metadata.promptSnapshots[]` before overwrite.
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
      updatedSnapshots = [...existingSnapshots, promptSnapshot];
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
      // Keep at most MAX_VERSIONS snapshots; drop oldest when the cap is exceeded.
      versions: [...existingVersions, snapshot].slice(-MAX_VERSIONS),
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
    console.error('Failed to update asset in library:', error);
    throw error;
  }
};

export const deleteAssetFromLibrary = async (assetId: string): Promise<void> => {
  try {
    const current = readStore();
    const updated = current.assets.filter(a => a.id !== assetId);
    writeStore({ version: current.version + 1, assets: updated });
  } catch (error) {
    console.error('Failed to delete asset from library:', error);
    throw error;
  }
};

export const purgeLibrary = async (): Promise<void> => {
  try {
    writeStore({ version: 0, assets: [] });
  } catch (error) {
    console.error('Failed to purge library:', error);
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
// Text-file metadata extraction
//
// Three recognised formats (applied in order, all may coexist):
//
//  1. Frontmatter comment  →  # key: value
//     Must appear before any non-comment, non-blank line.
//
//  2. H1 heading           →  # Title text  (no colon)
//     First occurrence used as title when no explicit "# title:" is present.
//     The H1 line is consumed and excluded from the lyrics body.
//
//  3. Bold label           →  **Key:** value  or  **Key :** value
//     Recognised anywhere in the leading header block (before the first
//     lyric section).  Case-insensitive key matching.
//     The matched lines are consumed and excluded from the lyrics body.
//
// All three formats are stripped from the body passed to parseTextToSections
// so they do not appear as lyric lines.
// ---------------------------------------------------------------------------

type ExtractedTextMetadata = {
  title?: string;
  artist?: string;
  metadata: LibraryAsset_Metadata;
  body: string;
};

/** Apply a normalised key string to the metadata bag. */
const applyMetaKey = (
  key: string,
  value: string,
  meta: LibraryAsset_Metadata,
  titleRef: { v?: string },
  artistRef: { v?: string },
): void => {
  const k = key.toLowerCase().replace(/[-\s]/g, '_');
  switch (k) {
    case 'title':            titleRef.v = value; break;
    case 'artist':           artistRef.v = value; break;
    case 'topic':            meta.topic = value; break;
    case 'mood':             meta.mood = value; break;
    case 'genre':            meta.genre = value; break;
    case 'language':
    case 'lang':             meta.language = value; break;
    case 'tempo':            { const n = parseInt(value, 10); if (!isNaN(n)) meta.tempo = n; break; }
    case 'instrumentation':  meta.instrumentation = value; break;
    case 'rhythm':           meta.rhythm = value; break;
    case 'narrative':        meta.narrative = value; break;
    case 'musical_prompt':   meta.musicalPrompt = value; break;
    default: break;
  }
};

export const extractMetadataFromText = (rawText: string): ExtractedTextMetadata => {
  const lines = rawText.split(/\r?\n/);
  const meta: LibraryAsset_Metadata = {};
  const titleRef: { v?: string } = {};
  const artistRef: { v?: string } = {};

  // Indices of lines consumed as metadata (to be excluded from body).
  const consumed = new Set<number>();

  // --- Pass 1: scan the leading block for all three formats ---
  // We scan until we hit the first line that is neither blank, nor a
  // recognised metadata pattern, nor an H1 heading.
  let headerEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed === '') {
      headerEnd = i + 1;
      continue;
    }

    // Format 1: # key: value  (frontmatter comment)
    const frontmatterMatch = trimmed.match(/^#\s*([\w-]+)\s*:\s*(.+?)\s*$/i);
    if (frontmatterMatch) {
      applyMetaKey(frontmatterMatch[1] ?? '', frontmatterMatch[2] ?? '', meta, titleRef, artistRef);
      consumed.add(i);
      headerEnd = i + 1;
      continue;
    }

    // Format 2: # Title text  (H1 heading, no colon)
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match) {
      // exactOptionalPropertyTypes: use captured group directly with explicit string cast
      const h1Title: string = String(h1Match[1] ?? '').trim();
      if (!titleRef.v && h1Title !== '') titleRef.v = h1Title;
      consumed.add(i);
      headerEnd = i + 1;
      continue;
    }

    // Format 3: **Key:** value  or  **Key :** value
    const boldMatch = trimmed.match(/^\*\*([^*:]+?)\s*:\*\*\s*(.+?)\s*$/i);
    if (boldMatch) {
      applyMetaKey(boldMatch[1] ?? '', boldMatch[2] ?? '', meta, titleRef, artistRef);
      consumed.add(i);
      headerEnd = i + 1;
      continue;
    }

    // Non-metadata line — end of header block
    headerEnd = i;
    break;
  }

  // Body = lines from headerEnd onward, minus any consumed metadata lines
  // that may have been interleaved with blank lines inside the header block.
  const bodyLines = lines
    .slice(0, headerEnd).filter((_, i) => !consumed.has(i))
    .concat(lines.slice(headerEnd));

  // Trim leading blank lines from body
  let start = 0;
  while (start < bodyLines.length && (bodyLines[start] ?? '').trim() === '') start++;

  const body = bodyLines.slice(start).join('\n');

  return {
    ...(titleRef.v !== undefined && { title: titleRef.v }),
    ...(artistRef.v !== undefined && { artist: artistRef.v }),
    metadata: meta,
    body,
  };
};

/**
 * Extract plain text from a .docx file (Office Open XML).
 */
export const extractTextFromDocx = async (file: Blob): Promise<string> => {
  const payload = await extractImportPayloadFromDocx(file);
  return payload.text;
};

export type ImportedSongFilePayload = {
  text: string;
  songLanguage: string;
};

const readBlobBytes = async (blob: Blob): Promise<Uint8Array> => {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Uint8Array(await new Response(blob).arrayBuffer());
};

const getZipEntry = (
  files: Record<string, Uint8Array>,
  expectedPath: string,
): Uint8Array | undefined => files[expectedPath]
  ?? Object.entries(files).find(([path]) => path === expectedPath || path.endsWith(`/${expectedPath}`))?.[1];

const extractDocumentLanguage = (
  files: Record<string, Uint8Array>,
  strFromU8: (data: Uint8Array) => string,
): string => {
  const preferredEntries = ['docProps/core.xml', 'meta.xml']
    .map(path => getZipEntry(files, path))
    .filter((entry): entry is Uint8Array => Boolean(entry));
  const candidateEntries = preferredEntries.length > 0 ? preferredEntries : Object.values(files);

  for (const entry of candidateEntries) {
    const match = strFromU8(entry).match(/<dc:language>([^<]+)<\/dc:language>/);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return '';
};

export const extractImportPayloadFromText = (text: string): ImportedSongFilePayload => {
  const normalizedText = text.replace(/^\uFEFF/, '');
  const match = normalizedText.match(/^#\s*lang:\s*(.+?)\s*(?:\r?\n){1,2}/i);
  if (!match) return { text: normalizedText, songLanguage: '' };
  return {
    text: normalizedText.slice(match[0].length),
    songLanguage: match[1]?.trim() ?? '',
  };
};

export const extractImportPayloadFromDocx = async (file: Blob): Promise<ImportedSongFilePayload> => {
  try {
    const { unzipSync, strFromU8 } = await import('fflate');
    const unzipped = unzipSync(await readBlobBytes(file));
    const docXml = getZipEntry(unzipped, 'word/document.xml');
    if (!docXml) return { text: '', songLanguage: '' };
    const xml = strFromU8(docXml);
    const paragraphs = xml.split(/<\/w:p>/);
    const text = paragraphs
      .map(p => {
        const texts = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1] ?? '');
        return texts.join('');
      })
      .filter(t => t.trim().length > 0)
      .join('\n');
    const songLanguage = extractDocumentLanguage(unzipped, strFromU8);
    return { text, songLanguage };
  } catch {
    return { text: '', songLanguage: '' };
  }
};

/**
 * Extract plain text from a .odt file (ODF).
 */
export const extractTextFromOdt = async (file: Blob): Promise<string> => {
  const payload = await extractImportPayloadFromOdt(file);
  return payload.text;
};

export const extractImportPayloadFromOdt = async (file: Blob): Promise<ImportedSongFilePayload> => {
  try {
    const { unzipSync, strFromU8 } = await import('fflate');
    const unzipped = unzipSync(await readBlobBytes(file));
    const contentXml = getZipEntry(unzipped, 'content.xml');
    if (!contentXml) return { text: '', songLanguage: '' };
    const xml = strFromU8(contentXml);
    const paragraphs = xml.split(/<\/text:p>/);
    const text = paragraphs
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length > 0)
      .join('\n');
    const songLanguage = extractDocumentLanguage(unzipped, strFromU8);
    return { text, songLanguage };
  } catch {
    return { text: '', songLanguage: '' };
  }
};

/**
 * Build a LibraryAsset from raw text + file-derived fallback title.
 * Extracts frontmatter/H1/bold-label metadata then parses the remaining body.
 */
const buildAssetFromText = (rawText: string, filenameFallback: string): LibraryAsset => {
  const { title, artist, metadata, body } = extractMetadataFromText(rawText);
  const resolvedTitle = title?.trim() || filenameFallback;
  const hasMetadata = Object.keys(metadata).length > 0;
  // exactOptionalPropertyTypes: use conditional spread for optional props
  const asset: LibraryAsset = {
    id: `import_${Date.now()}`,
    title: resolvedTitle,
    timestamp: Date.now(),
    type: 'lyrics',
    sections: parseTextToSections(body || rawText),
    ...(hasMetadata && { metadata }),
    ...(artist !== undefined && { artist }),
  };
  return asset;
};

export const importAssetsFromFile = async (file: File): Promise<LibraryAsset[]> => {
  const assets: LibraryAsset[] = [];
  try {
    if (file.name.endsWith('.json')) {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        for (let idx = 0; idx < parsed.length; idx++) {
          const result = LibraryAssetSchema.safeParse(parsed[idx]);
          if (result.success) {
            assets.push(result.data as unknown as LibraryAsset);
          } else {
            console.warn(
              `[libraryUtils] importAssetsFromFile: item ${idx} failed validation, skipping.`,
              result.error.format(),
            );
          }
        }
        return assets;
      }
    } else if (file.name.endsWith('.docx')) {
      const text = await extractTextFromDocx(file);
      if (text) {
        assets.push(buildAssetFromText(text, file.name.replace(/\.docx$/, '')));
      }
    } else if (file.name.endsWith('.odt')) {
      const text = await extractTextFromOdt(file);
      if (text) {
        assets.push(buildAssetFromText(text, file.name.replace(/\.odt$/, '')));
      }
    } else {
      const text = await file.text();
      assets.push(buildAssetFromText(text, file.name.replace(/\.(txt|md)$/, '')));
    }
  } catch (error) {
    console.error('Failed to import assets:', error);
  }
  return assets;
};

/** Parse plain text into Section objects without AI. Used as a local fallback
 *  when no API key is available and for library imports. */
export const parseTextToSections = (text: string): Section[] => {
  const blocks = text.split(/\n\s*\n/);
  const sections: Section[] = [];
  let uid = Date.now();

  blocks.forEach((block) => {
    const lines = block.trim().split('\n');
    if (lines.length === 0) return;
    let sectionName = 'Verse';
    let contentLines = lines;
    const firstLine = (lines[0] ?? '').trim();
    if ((firstLine.startsWith('[') && firstLine.endsWith(']')) || (firstLine.startsWith('**[') && firstLine.endsWith(']**'))) {
      const headerMatch = firstLine.match(/^(?:\*\*)?\[(.+?)\](?:\*\*)?$/);
      sectionName = headerMatch?.[1] ?? sectionName;
      contentLines = lines.slice(1);
    } else if (firstLine.match(/^#{1,3}\s+.+/)) {
      // ### Section Name  (markdown heading used as section label)
      const headingMatch = firstLine.match(/^#{1,3}\s+(.+)$/);
      sectionName = headingMatch?.[1]?.trim() ?? sectionName;
      contentLines = lines.slice(1);
    }
    const sectionLines = contentLines
      .filter(line => line.trim().length > 0)
      .map((lineText, idx) => ({
        id: `line_${uid++}_${idx}`,
        text: lineText.replace(/\\(.)/g, '$1').trim(),
        rhymingSyllables: '',
        rhyme: '',
        syllables: 0,
        concept: '',
        isManual: true,
      }));
    if (sectionLines.length > 0) {
      sections.push({
        id: `section_${uid++}_${sections.length}`,
        name: sectionName,
        rhymeScheme: 'AABB',
        targetSyllables: 8,
        mood: '',
        lines: sectionLines,
        preInstructions: [],
        postInstructions: [],
      });
    }
  });
  return sections;
};

export const exportLibraryToJson = async (): Promise<Blob> => {
  const library = await loadLibraryAssets();
  const json = JSON.stringify(library, null, 2);
  return new Blob([json], { type: 'application/json' });
};
