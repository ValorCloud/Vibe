/**
 * Pure parsers, schemas, and prompt builders for `usePasteImport`.
 *
 * Side-effect-free helpers extracted to keep the host hook focused on React
 * state and async orchestration. Everything here is unit-testable in isolation.
 */
import { Type } from '@google/genai';
import { cleanSectionName } from '../../utils/songUtils';
import { unwrapBracketToken } from '../../utils/metaUtils';
import { languageNameToCode } from '../../constants/langFamilyMap';
import { SECTION_TYPE_DEFINITIONS } from '../../constants/sections';
import { UNTRUSTED_INPUT_PREAMBLE, fence, fenceLong, sanitizeForPrompt } from '../../utils/promptSanitization';
import type { Section } from '../../types';

/** More aggressive retry budget for chunked paste-import calls. */
export const PASTE_IMPORT_RETRY = { maxAttempts: 3, delayMs: 1200 } as const;

export type PasteImportChunk = {
  displayLabel: string;
  nameHint: string;
  text: string;
};

export type ChunkResult = {
  name: string;
  rhymeScheme: string | undefined;
  lines: Array<{ text?: string; rhymingSyllables?: string; rhyme?: string; syllables?: number; concept?: string }>;
  _displayLabel: string;
};

export type PasteImportProgress = {
  current: number;
  total: number;
  currentLabel: string;
};

export const EMPTY_PROGRESS: PasteImportProgress = {
  current: 0,
  total: 0,
  currentLabel: '',
};

export const MAX_METADATA_PROMPT_LENGTH = 6000;

export const normalizeLanguageValue = (language: string): string =>
  (languageNameToCode(language) ?? language).trim().toLowerCase();

export const SECTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    rhymeScheme: {
      type: Type.STRING,
      description: 'Rhyme scheme like AABB, ABAB, ABCB, AAAA, AABBA, AAABBB, AABBCC, ABABAB, ABCABC, AABCCB, ABACBC, FREE',
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
  required: ['name', 'rhymeScheme', 'lines'],
};

export const METADATA_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    mood: { type: Type.STRING },
    language: { type: Type.STRING },
  },
  required: ['topic', 'mood', 'language'],
};

export const normalizeSectionHeaderCandidate = (line: string): string => {
  const trimmed = line.trim().replace(/^#+\s*/, '').replace(/[:::]\s*$/, '');
  const bracketValue = unwrapBracketToken(trimmed);
  return cleanSectionName(bracketValue ?? trimmed);
};

export const normalizeSectionLookup = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const getSectionHeaderHint = (line: string): string => {
  const normalized = normalizeSectionHeaderCandidate(line);
  const lookup = normalizeSectionLookup(normalized);
  if (!lookup) return '';

  const isStandaloneHeader = SECTION_TYPE_DEFINITIONS.some(({ aliases }) =>
    aliases.some((alias) => {
      const normalizedAlias = normalizeSectionLookup(alias);
      return lookup === normalizedAlias
        || lookup.match(new RegExp(`^${normalizedAlias}\\s+(?:\\d+|[ivx]+)$`, 'i')) !== null;
    }),
  );

  return isStandaloneHeader ? normalized : '';
};

/**
 * Extract a leading Markdown H1 or H2 title and metadata block from pasted text.
 */
export const extractH1TitleFromText = (text: string): { songTitle: string | null; lyricsText: string } => {
  const lines = text.split(/\r?\n/);
  let songTitle: string | null = null;
  let firstContentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (songTitle === null && /^#{1,2}\s+.+/.test(line)) {
      songTitle = line.replace(/^#{1,2}\s+/, '').trim();
      firstContentIndex = i + 1;
      continue;
    }
    if (songTitle !== null && /^\*{1,2}[^*]+\*{1,2}\s*:/.test(line)) {
      firstContentIndex = i + 1;
      continue;
    }
    if (songTitle !== null && line !== '') {
      firstContentIndex = i;
      break;
    }
  }

  const lyricsText = songTitle !== null
    ? lines.slice(firstContentIndex).join('\n').trimStart()
    : text;

  return { songTitle, lyricsText };
};

export const splitPastedLyricsIntoChunks = (text: string): PasteImportChunk[] => {
  const chunks: PasteImportChunk[] = [];
  const lines = text.split(/\r?\n/);
  let currentHeader = '';
  let currentLines: string[] = [];

  const pushChunk = () => {
    const chunkText = currentLines.join('\n').trim();
    if (!chunkText) return;
    const displayLabel = currentHeader || `Section ${chunks.length + 1}`;
    chunks.push({
      displayLabel,
      nameHint: currentHeader,
      text: chunkText,
    });
    currentLines = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const headerHint = trimmed ? getSectionHeaderHint(trimmed) : '';

    if (headerHint) {
      pushChunk();
      currentHeader = headerHint;
      continue;
    }

    if (!trimmed) {
      if (currentLines.length > 0) {
        pushChunk();
        currentHeader = '';
      }
      continue;
    }

    currentLines.push(rawLine.trimEnd());
  }

  pushChunk();

  if (chunks.length > 0) return chunks;

  const fallbackText = text.trim();
  return fallbackText
    ? [{ displayLabel: 'Section 1', nameHint: '', text: fallbackText }]
    : [];
};

/**
 * Derive a canonical rhyme scheme from per-line rhyme labels when the AI
 * returns FREE but each line carries an individual label (A/B/C…).
 */
export const deriveSchemeFromLineLabels = (
  lines: Array<{ rhyme?: string }>,
  fallback: string,
): string => {
  const labels = lines.map(l => (l.rhyme ?? '').trim()).filter(Boolean);
  if (labels.length === 0) return fallback;
  const candidate = labels.join('');
  const KNOWN = [
    'AABB', 'ABAB', 'ABCB', 'AAAA', 'AABBA', 'AAABBB',
    'AABBCC', 'ABABAB', 'ABCABC', 'AABCCB', 'ABACBC',
  ];
  return KNOWN.includes(candidate) ? candidate : fallback;
};

/** True if the section name is an INTRO variant (e.g. "Intro", "Intro 1"). */
export const isIntroName = (name: string): boolean =>
  /^intro(\s+\d+)?$/i.test(name.trim());

/**
 * Post-process imported sections:
 * - titleExtracted=false: first INTRO → "Title", subsequent INTROs → "Verse N"
 * - titleExtracted=true:  all INTROs stay "Intro", only duplicate INTROs become "Verse N"
 */
export const normalizeImportedSectionNames = (sections: Section[], titleExtracted: boolean): Section[] => {
  const hasTitle = sections.some(s => /^title$/i.test(s.name.trim()));
  let introSeen = false;
  let extraVerseOffset = sections.filter(s => /^verse\s*\d*$/i.test(s.name.trim())).length;

  return sections.map((section) => {
    if (!isIntroName(section.name)) return section;

    if (!introSeen) {
      introSeen = true;
      if (titleExtracted) return section;
      if (!hasTitle) return { ...section, name: 'Title' };
      return section;
    }

    extraVerseOffset += 1;
    return { ...section, name: `Verse ${extraVerseOffset}` };
  });
};

export const buildSectionPrompt = (chunk: PasteImportChunk, uiLang: string): string => `${UNTRUSTED_INPUT_PREAMBLE}

Analyze this single lyrics section.
IMPORTANT: You MUST ONLY use the following section names (you can append numbers like "Verse 1", "Chorus 2"):
- Intro
- Verse
- Pre-Chorus
- Chorus
- Final Chorus
- Bridge
- Outro

CRITICAL INSTRUCTIONS:
1. ONLY analyze the lyrics provided below.
2. DO NOT generate new lyrics.
3. DO NOT continue the song.
4. Stop immediately when you reach the end of the provided lyrics.
5. Keep concepts very short (1-3 words) and write them in ${sanitizeForPrompt(uiLang, { maxLength: 64 })}.
6. Performance/production meta-instructions in brackets (e.g. [Guitar solo], [Whispered], [Anthemic], [Ad-lib]) are NOT section headers — include them verbatim as lyric lines with their brackets preserved.
7. If a source section label is provided, normalize it to the closest allowed section name instead of inventing a new one.

RHYME SCHEME DETECTION — CRITICAL RULES:
- Evaluate rhymes phonetically in the language of the lyrics, not in English.
- Near-rhymes, assonances, and imperfect rhymes count as rhyming.
- Assign FREE ONLY when you find absolutely zero recurring end-sound pattern across ANY pair of lines in the section.
- Prefer a structured scheme over FREE whenever at least 2 line-pairs share a sound.

For this single section, return one JSON object with:
- "name": section name
- "rhymeScheme": one of AABB, ABAB, ABCB, AAAA, AABBA, AAABBB, AABBCC, ABABAB, ABCABC, AABCCB, ABACBC, FREE
- "lines": array of lines with exact lyric text, rhyming syllables, rhyme identifier, exact syllable count, and short core concept

${chunk.nameHint ? `${fence('SOURCE_SECTION_LABEL', chunk.nameHint, { maxLength: 64 })}\n\n` : ''}${fenceLong('LYRICS', chunk.text)}`;

export const buildMetadataPrompt = (text: string, uiLang: string): string => `${UNTRUSTED_INPUT_PREAMBLE}

Analyze these lyrics and return a JSON object with:
- "topic": the overall topic in ${sanitizeForPrompt(uiLang, { maxLength: 64 })}
- "mood": the overall mood in ${sanitizeForPrompt(uiLang, { maxLength: 64 })}
- "language": the main lyric language in English (e.g. "English", "French", "Yoruba")

Use only the provided lyrics. Do not generate new content.

${fenceLong('LYRICS', text.substring(0, MAX_METADATA_PROMPT_LENGTH), { maxLength: 0 })}`;
