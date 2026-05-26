/**
 * sessionSchema
 *
 * Zod schema for the localStorage session payload.
 * All fields are optional — a partial or legacy session is accepted.
 * Unrecognised keys on the top-level session object are stripped by default,
 * but unknown keys inside nested `song` sections/lines are preserved because
 * those schemas use `.passthrough()`.
 *
 * P5: SectionLineSchema and SectionSchema now mirror the full Section/Line
 * TypeScript types — previously missing fields (rhymingSyllables, concept,
 * isManual, rhymeScheme, targetSyllables, mood, preInstructions,
 * postInstructions) were silently dropped on session restore.
 *
 * P6: Added isMeta — mirrors Line.isMeta from src/types/index.ts.
 *     Was preserved by .passthrough() but absent from the inferred
 *     SessionLine type, causing silent type gaps.
 *
 * P7: Added SongVersionSchema + SessionSchema.versions — eliminates the
 *     unsafe double-cast (as { versions: SongVersion[] }) in useSongEditor.
 *
 * Usage:
 *   const result = SessionSchema.safeParse(JSON.parse(raw));
 *   if (result.success) { // use result.data }
 */
import { z } from 'zod';

export const SectionLineSchema = z.object({
  id:                z.string().optional(),
  text:              z.string().optional(),
  rhyme:             z.string().optional(),
  syllables:         z.number().optional(),
  phonemes:          z.array(z.string()).optional(),
  // P5: fields previously missing — silently dropped on restore
  rhymingSyllables:  z.string().optional(),
  concept:           z.string().optional(),
  isManual:          z.boolean().optional(),
  // P6: production/performance meta-instruction flag (e.g. [Guitar solo])
  isMeta:            z.boolean().optional(),
}).passthrough(); // allow extra fields — normalizeLoadedSection will handle them

export const SectionSchema = z.object({
  name:             z.string().optional(),
  lines:            z.array(SectionLineSchema).optional(),
  id:               z.string().optional(),
  // P5: fields previously missing — silently dropped on restore
  rhymeScheme:      z.string().optional(),
  targetSyllables:  z.number().optional(),
  mood:             z.string().optional(),
  preInstructions:  z.array(z.string()).optional(),
  postInstructions: z.array(z.string()).optional(),
}).passthrough();

// P7: mirrors SongVersion interface (src/types/index.ts)
export const SongVersionSchema = z.object({
  id:           z.string(),
  timestamp:    z.number(),
  song:         z.array(SectionSchema),
  structure:    z.array(z.string()),
  title:        z.string(),
  titleOrigin:  z.enum(['user', 'ai']),
  topic:        z.string(),
  mood:         z.string(),
  musicalPrompt: z.string().optional(),
  name:         z.string(),
});

export const SessionSchema = z.object({
  song:             z.array(SectionSchema).optional(),
  structure:        z.array(z.string()).optional(),
  title:            z.string().optional(),
  titleOrigin:      z.enum(['user', 'ai']).optional(),
  topic:            z.string().optional(),
  mood:             z.string().optional(),
  rhymeScheme:      z.string().optional(),
  targetSyllables:  z.number().optional(),
  genre:            z.string().optional(),
  tempo:            z.union([z.number(), z.string()]).optional(),
  instrumentation:  z.string().optional(),
  rhythm:           z.string().optional(),
  narrative:        z.string().optional(),
  musicalPrompt:    z.string().optional(),
  songLanguage:     z.string().optional(),
  // P7: versions — previously absent, causing unsafe cast in useSongEditor
  versions:         z.array(SongVersionSchema).optional(),
});

export type SessionData    = z.infer<typeof SessionSchema>;
export type SessionSection = z.infer<typeof SectionSchema>;
export type SessionLine    = z.infer<typeof SectionLineSchema>;
export type SessionVersion = z.infer<typeof SongVersionSchema>;
