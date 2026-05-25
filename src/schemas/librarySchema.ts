/**
 * librarySchema
 *
 * Zod schemas for LibraryAsset and LibraryStore (localStorage key
 * `lyricist_library`).  These schemas are the single source of truth
 * for the shape of persisted library data — any field added to the
 * LibraryAsset TypeScript type MUST be mirrored here.
 *
 * Design decisions:
 * - All asset fields except `id`, `title`, `timestamp`, `type`, and
 *   `sections` are optional, matching the existing TypeScript type.
 * - `sections` items are validated through the existing SectionSchema
 *   (passthrough) so that extra runtime fields are preserved, not
 *   stripped — normalizeLoadedSection handles unknown fields safely.
 * - The metadata record uses `.catchall(z.unknown())` to accept any
 *   [key: string]: unknown extension without failing validation.
 * - LibraryStoreSchema recognises both the current versioned format
 *   { version, assets } and the legacy plain-array format, which is
 *   migrated transparently to { version: 0, assets }.
 */
import { z } from 'zod';
import { SectionSchema } from './sessionSchema';

const SongVersionSchema = z.object({
  id:          z.string(),
  timestamp:   z.number(),
  song:        z.array(SectionSchema),
  structure:   z.array(z.string()),
  title:       z.string(),
  titleOrigin: z.enum(['user', 'ai']),
  topic:       z.string(),
  mood:        z.string(),
  musicalPrompt: z.string().optional(),
  name:        z.string(),
});

export const LibraryAsset_MetadataSchema = z
  .object({
    album:           z.string().optional(),
    year:            z.number().optional(),
    genre:           z.string().optional(),
    language:        z.string().optional(),
    topic:           z.string().optional(),
    mood:            z.string().optional(),
    tempo:           z.number().optional(),
    instrumentation: z.string().optional(),
    rhythm:          z.string().optional(),
    narrative:       z.string().optional(),
    musicalPrompt:   z.string().optional(),
  })
  .catchall(z.unknown()); // preserves [key: string]: unknown extension

export const LibraryAssetSchema = z.object({
  id:        z.string(),
  title:     z.string(),
  artist:    z.string().optional(),
  timestamp: z.number(),
  type:      z.enum(['song', 'poem', 'lyrics']),
  sections:  z.array(SectionSchema),
  versions:  z.array(SongVersionSchema).optional(),
  metadata:  LibraryAsset_MetadataSchema.optional(),
});

/**
 * LibraryStoreSchema validates both formats stored under `lyricist_library`:
 *   - Current format: { version: number; assets: LibraryAsset[] }
 *   - Legacy format:  LibraryAsset[]  (pre-M2, plain array)
 *
 * If the raw value is an array it is accepted directly — the version is
 * inferred as 0 and each element is validated through LibraryAssetSchema.
 */
export const LibraryStoreSchema = z
  .union([
    // Current format
    z.object({
      version: z.number(),
      assets:  z.array(LibraryAssetSchema),
    }),
    // Legacy format — plain array
    z.array(LibraryAssetSchema).transform(assets => ({
      version: 0 as const,
      assets,
    })),
  ]);

export type LibraryAssetData        = z.infer<typeof LibraryAssetSchema>;
export type LibraryAsset_MetadataData = z.infer<typeof LibraryAsset_MetadataSchema>;
export type LibraryStoreData        = z.infer<typeof LibraryStoreSchema>;
