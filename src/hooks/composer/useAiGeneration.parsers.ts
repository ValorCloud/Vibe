/**
 * Pure parsers, prompt fragments and schemas used by `useAiGeneration`.
 *
 * Extracted to keep the host hook focused on React state + I/O orchestration.
 * Everything in this file is side-effect-free and unit-testable.
 */
import { z } from 'zod';
import { Type } from '@google/genai';
import type { Section } from '../../types';
import { isPureMetaLine } from '../../utils/metaUtils';
import { generateId } from '../../utils/idUtils';
import { getDefaultLineCount } from '../../utils/songDefaults';
import { sanitizeForPrompt } from '../../utils/promptSanitization';

export const LineResponseSchema = z.object({
  text: z.string().default(''),
  rhymingSyllables: z.string().default(''),
  rhyme: z.string().default(''),
  syllables: z.number().default(0),
  concept: z.string().default(''),
});

export const SectionResponseSchema = z.object({
  name: z.string().default('Verse'),
  rhymeScheme: z.string().default('FREE'),
  lines: z.array(LineResponseSchema).default([]),
});

export const SongResponseSchema = z.array(SectionResponseSchema);
export type SongResponse = z.infer<typeof SongResponseSchema>;

export const sectionNamesMatch = (left: string, right: string): boolean =>
  left.toLowerCase() === right.toLowerCase();

export const createEmptySection = (name: string, defaultRhymeScheme: string): Section => ({
  id: generateId(),
  name,
  rhymeScheme: defaultRhymeScheme,
  lines: Array(getDefaultLineCount(name))
    .fill(null)
    .map(() => ({
      id: generateId(),
      text: '',
      rhymingSyllables: '',
      rhyme: '',
      syllables: 0,
      concept: 'New line',
    })),
});

export const alignGeneratedSongToStructure = (
  generatedSong: Section[],
  structure: string[],
  defaultRhymeScheme: string,
): Section[] => {
  const remainingSections = [...generatedSong];
  return structure.map(sectionName => {
    const matchingIndex = remainingSections.findIndex(section =>
      sectionNamesMatch(section.name, sectionName),
    );
    let matchedSection: Section | undefined;
    if (matchingIndex === -1) {
      matchedSection = remainingSections.length > 0 ? remainingSections.shift() : undefined;
    } else {
      matchedSection = remainingSections.splice(matchingIndex, 1)[0];
    }
    return matchedSection
      ? { ...matchedSection, name: sectionName }
      : createEmptySection(sectionName, defaultRhymeScheme);
  });
};

export const flagMetaLines = <T extends { text?: string }>(
  lines: T[],
): (T & { isMeta: boolean })[] =>
  lines.map(line => ({
    ...line,
    isMeta: isPureMetaLine(line.text ?? ''),
  }));

export const buildExclusiveLanguageInstruction = (language: string): string => {
  const safe = sanitizeForPrompt(language, { maxLength: 64 });
  return safe ? `Write exclusively in ${safe}.` : '';
};

export const META_INSTRUCTION_HINT =
`PERFORMANCE / PRODUCTION META-INSTRUCTIONS:
You may insert standalone meta-instruction lines using square brackets, e.g.:
  [Guitar solo], [Whispered], [Anthemic], [Ad-lib], [Key change], [Falsetto], [Drum break]
Rules:
- Square brackets are MANDATORY. Never write a meta-instruction as bare text — it will be ignored.
- Meta lines are NOT counted toward the section's lyric line count.
- Meta lines are NOT subject to rhyme or syllable requirements.
- These are preserved and displayed as special directives in the song editor.`;

export const RHYME_ENFORCEMENT_RULES =
`RHYME ENFORCEMENT — CRITICAL:
The rhyme scheme you declare MUST be phonetically respected. Shared-letter lines MUST end
with words whose final stressed vowel + following consonants match.

Phonetic rhyme rules by language:
- French: accented vowels are transparent (âme = ame, éclat = eclat). "E muet" at end counts
  (lame / âme / flamme all rhyme; bien / chrétien / lien all rhyme; BUT bien ≠ scintille).
- English: rely on pronunciation, not spelling (love/above rhyme; love/move do NOT).

Scheme-specific guidance:
- AABB: lines 1-2 share one rhyme sound, lines 3-4 share a DIFFERENT rhyme sound.
- ABAB: lines 1 and 3 rhyme; lines 2 and 4 rhyme (cross-rhyme).
- AABBCC: three distinct rhyme pairs — AA, BB, CC. Each pair must use a DIFFERENT sound.
- ABCB: only lines 2 and 4 rhyme; lines 1 and 3 are free.
- FREE: no rhyme constraints.

SELF-VALIDATION (mandatory before returning):
For each section, mentally check: do all lines sharing the same letter end with matching
phonetic sounds? If any pair fails, rewrite those lines before returning.`;

export const GENERATION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      rhymeScheme: {
        type: Type.STRING,
        description: 'The rhyme scheme for this section, e.g., AABB, ABAB, ABCB, AAAA, AAABBB, AABBCC, ABABAB, ABCABC, AABCCB, or FREE',
      },
      lines: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            rhymingSyllables: { type: Type.STRING },
            rhyme: { type: Type.STRING },
            syllables: { type: Type.INTEGER },
            concept: { type: Type.STRING },
          },
          required: ['text', 'rhymingSyllables', 'rhyme', 'syllables', 'concept'],
        },
      },
    },
    required: ['name', 'lines', 'rhymeScheme'],
  },
} as const;
