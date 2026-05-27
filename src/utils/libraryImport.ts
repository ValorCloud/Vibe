/**
 * libraryImport.ts
 *
 * File-import / text-extraction half of the legacy `libraryUtils.ts` god module.
 *
 * Covers:
 *   - plain-text metadata extraction (frontmatter / H1 / bold-label)
 *   - DOCX / ODT text extraction via fflate
 *   - generic `importAssetsFromFile` entrypoint
 *   - the AI-free `parseTextToSections` fallback parser
 *
 * Storage CRUD (`saveAssetToLibrary`, `loadLibraryAssets`, etc.) stays in
 * `libraryUtils.ts`; that module re-exports from here for backward compat
 * with all existing callers.
 */
import type { Section } from '../types';
import type { LibraryAsset, LibraryAsset_Metadata } from './libraryUtils';
import { LibraryAssetSchema } from '../schemas/librarySchema';
import { logger } from './logger';

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

export type ExtractedTextMetadata = {
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

  const consumed = new Set<number>();
  let headerEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed === '') {
      headerEnd = i + 1;
      continue;
    }

    const frontmatterMatch = trimmed.match(/^#\s*([\w-]+)\s*:\s*(.+?)\s*$/i);
    if (frontmatterMatch) {
      applyMetaKey(frontmatterMatch[1] ?? '', frontmatterMatch[2] ?? '', meta, titleRef, artistRef);
      consumed.add(i);
      headerEnd = i + 1;
      continue;
    }

    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match) {
      const h1Title: string = String(h1Match[1] ?? '').trim();
      if (!titleRef.v && h1Title !== '') titleRef.v = h1Title;
      consumed.add(i);
      headerEnd = i + 1;
      continue;
    }

    const boldMatch = trimmed.match(/^\*\*([^*:]+?)\s*:\*\*\s*(.+?)\s*$/i);
    if (boldMatch) {
      applyMetaKey(boldMatch[1] ?? '', boldMatch[2] ?? '', meta, titleRef, artistRef);
      consumed.add(i);
      headerEnd = i + 1;
      continue;
    }

    headerEnd = i;
    break;
  }

  const bodyLines = lines
    .slice(0, headerEnd).filter((_, i) => !consumed.has(i))
    .concat(lines.slice(headerEnd));

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

// ---------------------------------------------------------------------------
// Binary file extractors (DOCX / ODT)
// ---------------------------------------------------------------------------

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

/** Extract plain text from a .docx file (Office Open XML). */
export const extractTextFromDocx = async (file: Blob): Promise<string> => {
  const payload = await extractImportPayloadFromDocx(file);
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

/** Extract plain text from a .odt file (ODF). */
export const extractTextFromOdt = async (file: Blob): Promise<string> => {
  const payload = await extractImportPayloadFromOdt(file);
  return payload.text;
};

// ---------------------------------------------------------------------------
// AI-free section parser & file importer
// ---------------------------------------------------------------------------

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

/**
 * Build a LibraryAsset from raw text + file-derived fallback title.
 * Extracts frontmatter/H1/bold-label metadata then parses the remaining body.
 */
const buildAssetFromText = (rawText: string, filenameFallback: string): LibraryAsset => {
  const { title, artist, metadata, body } = extractMetadataFromText(rawText);
  const resolvedTitle = title?.trim() || filenameFallback;
  const hasMetadata = Object.keys(metadata).length > 0;
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
            logger.warn(
              `[libraryImport] importAssetsFromFile: item ${idx} failed validation, skipping.`,
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
    logger.error('Failed to import assets:', error);
  }
  return assets;
};
