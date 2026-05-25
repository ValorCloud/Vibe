import { strToU8, zipSync } from 'fflate';
import type { Section, SongVersion } from '../types';
import { generateId } from './idUtils';

export type ExportFormat = 'txt' | 'markup' | 'json' | 'odt' | 'docx' | 'lrc' | 'pdf';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ODT_MIME = 'application/vnd.oasis.opendocument.text';

/** Shared song data fields (no format). Used for print/share utilities. */
type SongData = {
  song: Section[];
  title: string;
  titleOrigin?: 'user' | 'ai';
  topic: string;
  mood: string;
  songLanguage?: string;
  genre?: string;
  tempo?: number;
  instrumentation?: string;
  rhythm?: string;
  narrative?: string;
  musicalPrompt?: string;
  versions?: SongVersion[];
};

/** Parameters for file-based exports (PDF is handled separately via print). */
type SongExportParams = SongData & { format: Exclude<ExportFormat, 'pdf'> };

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const escapeMarkdown = (value: string) => value.replace(/([\\\`*_{}[\]()#+\-.!|>])/g, '\\$1');

const getBaseFileName = (title: string) => (title.trim() || 'Untitled Song').replace(/\s+/g, '_');

/** Returns true if a lyric line text is an artifact that should be excluded from exports. */
const isArtifactLine = (text: string): boolean => {
  const trimmed = text.trim();
  return trimmed === '' || trimmed === '[]';
};

// ---------------------------------------------------------------------------
// TXT — lossless frontmatter: # title, # lang, then [Section] body
// ---------------------------------------------------------------------------
const buildTxtContent = (song: Section[], title: string, songLanguage = '') => {
  let content = `# title: ${title.trim() || 'Untitled Song'}\n`;
  if (songLanguage.trim()) content += `# lang: ${songLanguage.trim()}\n`;
  content += '\n';
  song.forEach(section => {
    content += `[${section.name}]\n`;
    section.lines
      .filter(line => !isArtifactLine(line.text))
      .forEach(line => { content += `${line.text}\n`; });
    content += '\n';
  });
  return content;
};

// ---------------------------------------------------------------------------
// Markdown — lossless: # title H1, **Key:** bold-labels, [meta] tag for isMeta lines
// ---------------------------------------------------------------------------
const buildMarkupContent = (song: Section[], title: string, topic: string, mood: string) => {
  let content = `# ${escapeMarkdown(title)}\n\n`;
  content += `**Topic:** ${escapeMarkdown(topic)}\n`;
  content += `**Mood:** ${escapeMarkdown(mood)}\n\n`;
  song.forEach(section => {
    content += `### ${escapeMarkdown(section.name)}\n\n`;
    section.lines
      .filter(line => !isArtifactLine(line.text))
      .forEach(line => {
        // [meta] prefix is a round-trip-safe marker: parsed back as isMeta:true on import.
        content += line.isMeta
          ? `[meta] ${escapeMarkdown(line.text)}  \n`
          : `${escapeMarkdown(line.text)}  \n`;
      });
    content += '\n';
  });
  return content;
};

const buildWordParagraph = (text: string, options?: { bold?: boolean }) => {
  if (!text) return '<w:p/>';
  return `<w:p><w:r>${options?.bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
};

// ---------------------------------------------------------------------------
// DOCX — lossless: dc:title + dc:subject (topic) + dc:description (mood) in core.xml
// ---------------------------------------------------------------------------
const buildDocxBlob = (song: Section[], title: string, topic: string, mood: string, songLanguage = '') => {
  const paragraphs = [
    buildWordParagraph(title, { bold: true }),
    buildWordParagraph(`Topic: ${topic}`),
    buildWordParagraph(`Mood: ${mood}`),
    '<w:p/>',
    ...song.flatMap(section => [
      buildWordParagraph(section.name, { bold: true }),
      ...section.lines
        .filter(line => !isArtifactLine(line.text))
        .map(line => buildWordParagraph(line.text)),
      '<w:p/>',
    ]),
  ].join('');
  const trimmedTitle = title.trim() || 'Untitled Song';
  const trimmedSongLanguage = songLanguage.trim();

  const files = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`),
    'docProps/core.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties
  xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${escapeXml(trimmedTitle)}</dc:title>
  <dc:subject>${escapeXml(topic)}</dc:subject>
  <dc:description>${escapeXml(mood)}</dc:description>${trimmedSongLanguage ? `\n  <dc:language>${escapeXml(trimmedSongLanguage)}</dc:language>` : ''}
</cp:coreProperties>`),
  };

  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: DOCX_MIME });
};

// ---------------------------------------------------------------------------
// ODT — lossless: dc:title + dc:subject (topic) + dc:description (mood) in meta.xml
// ---------------------------------------------------------------------------
const buildOdtBlob = (song: Section[], title: string, topic: string, mood: string, songLanguage = '') => {
  const paragraphs = [
    `<text:p text:style-name="Title">${escapeXml(title)}</text:p>`,
    `<text:p text:style-name="Standard">${escapeXml(`Topic: ${topic}`)}</text:p>`,
    `<text:p text:style-name="Standard">${escapeXml(`Mood: ${mood}`)}</text:p>`,
    '<text:p text:style-name="Standard"/>',
    ...song.flatMap(section => [
      `<text:p text:style-name="Heading">${escapeXml(section.name)}</text:p>`,
      ...section.lines
        .filter(line => !isArtifactLine(line.text))
        .map(line => `<text:p text:style-name="Standard">${escapeXml(line.text)}</text:p>`),
      '<text:p text:style-name="Standard"/>',
    ]),
  ].join('');
  const trimmedTitle = title.trim() || 'Untitled Song';
  const trimmedSongLanguage = songLanguage.trim();

  const files = {
    mimetype: strToU8(ODT_MIME),
    'content.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="Title" style:family="paragraph">
      <style:text-properties fo:font-size="16pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading" style:family="paragraph">
      <style:text-properties fo:font-size="12pt" fo:font-weight="bold"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${paragraphs}
    </office:text>
  </office:body>
</office:document-content>`),
    'styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  office:version="1.2">
  <office:styles>
    <style:default-style style:family="paragraph"/>
  </office:styles>
</office:document-styles>`),
    'meta.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
  office:version="1.2">
  <office:meta>
    <meta:generator>Vibe Export</meta:generator>
    <dc:title>${escapeXml(trimmedTitle)}</dc:title>
    <dc:subject>${escapeXml(topic)}</dc:subject>
    <dc:description>${escapeXml(mood)}</dc:description>${trimmedSongLanguage ? `\n    <dc:language>${escapeXml(trimmedSongLanguage)}</dc:language>` : ''}
  </office:meta>
</office:document-meta>`),
    'settings.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-settings
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  office:version="1.2">
  <office:settings/>
</office:document-settings>`),
    'META-INF/manifest.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest
  xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
  manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="${ODT_MIME}"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="settings.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`),
  };

  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: ODT_MIME });
};

// ---------------------------------------------------------------------------
// LRC — synchronized lyrics with evenly-spaced placeholder timestamps
// ---------------------------------------------------------------------------
const LRC_LINE_INTERVAL_S = 5;

const buildLrcContent = (song: Section[], title: string, songLanguage = ''): string => {
  const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');
  const formatTimestamp = (totalSecs: number): string => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs - m * 60;
    const ss = String(Math.floor(s)).padStart(2, '0');
    const cs = String(Math.round((s % 1) * 100)).padStart(2, '0');
    return `[${pad2(m)}:${ss}.${cs}]`;
  };

  let content = `[ti:${title.trim() || 'Untitled Song'}]\n`;
  if (songLanguage.trim()) content += `[la:${songLanguage.trim()}]\n`;
  content += '[by:Vibe]\n\n';

  let currentSec = 0;
  song.forEach(section => {
    content += `${formatTimestamp(currentSec)}▶ ${section.name}\n`;
    currentSec += LRC_LINE_INTERVAL_S;
    section.lines
      .filter(line => !isArtifactLine(line.text) && !line.isMeta)
      .forEach(line => {
        content += `${formatTimestamp(currentSec)}${line.text}\n`;
        currentSec += LRC_LINE_INTERVAL_S;
      });
    currentSec += LRC_LINE_INTERVAL_S;
  });

  return content;
};

// ---------------------------------------------------------------------------
// Print HTML — styled page that triggers window.print() for PDF export
// ---------------------------------------------------------------------------
const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildPrintHtml = ({
  song, title, topic, mood, songLanguage = '',
}: SongData): string => {
  const escapedTitle = escapeHtml(title.trim() || 'Untitled Song');
  const metaParts = [topic, mood].filter(Boolean).map(escapeHtml);
  const metaLine = metaParts.join(' · ');

  const sectionsHtml = song
    .map(section => {
      const linesHtml = section.lines
        .filter(line => !isArtifactLine(line.text))
        .map(line =>
          `<p class="${line.isMeta ? 'meta-line' : 'lyric-line'}">${escapeHtml(line.text)}</p>`,
        )
        .join('');
      return `<section><h2>${escapeHtml(section.name)}</h2>${linesHtml}</section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="${escapeHtml(songLanguage || 'en')}">
<head>
<meta charset="UTF-8">
<title>${escapedTitle}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,'Times New Roman',serif;font-size:12pt;line-height:1.6;color:#111;background:#fff;padding:2.5cm;max-width:none}
h1{font-size:22pt;font-weight:700;margin-bottom:.4em}
.meta{font-size:10pt;color:#555;margin-bottom:1.6em}
section{margin-bottom:1.5em;break-inside:avoid}
h2{font-size:12pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5em;color:#333}
.lyric-line{font-size:12pt;margin-bottom:.2em}
.meta-line{font-size:10pt;color:#666;font-style:italic;margin-bottom:.2em}
@media print{body{padding:0}@page{margin:2cm}}
</style>
</head>
<body>
<h1>${escapedTitle}</h1>${metaLine ? `\n<p class="meta">${metaLine}</p>` : ''}
${sectionsHtml}
<script>window.addEventListener('load',function(){window.print();});<\/script>
</body>
</html>`;
};

// ---------------------------------------------------------------------------
// Share link — compact base64-URL encoding of song + metadata
// ---------------------------------------------------------------------------

/** Compact payload stored in the share URL hash. Schema v1. */
export type SharePayload = {
  v: 1;
  t: string;                           // title
  p: string;                           // topic
  m: string;                           // mood
  l: string;                           // language
  s: Array<{ n: string; ls: string[] }>; // sections (lines prefixed "[meta]" when isMeta)
};

const SHARE_PREFIX = 'share=';

/** Encodes the current song + metadata as a shareable URL. */
export const buildShareUrl = ({
  song, title, topic, mood, songLanguage = '',
}: SongData): string => {
  const payload: SharePayload = {
    v: 1,
    t: title,
    p: topic,
    m: mood,
    l: songLanguage,
    s: song.map(section => ({
      n: section.name,
      ls: section.lines
        .filter(line => !isArtifactLine(line.text))
        .map(line => (line.isMeta ? `[meta]${line.text}` : line.text)),
    })),
  };

  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  const base64 = btoa(binary);

  const base = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '';
  return `${base}#${SHARE_PREFIX}${base64}`;
};

/** Parses a `#share=…` hash fragment; returns null if malformed or wrong version. */
export const parseShareHash = (hash: string): SharePayload | null => {
  try {
    const param = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!param.startsWith(SHARE_PREFIX)) return null;
    const base64 = param.slice(SHARE_PREFIX.length);
    const bytes = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json) as SharePayload;
    return payload.v === 1 ? payload : null;
  } catch {
    return null;
  }
};

/** Converts a decoded share payload back to a Section[] + metadata bundle. */
export const sharePayloadToSong = (
  payload: SharePayload,
): { song: Section[]; structure: string[]; title: string; topic: string; mood: string; songLanguage: string } => {
  const song: Section[] = payload.s.map(s => ({
    id: generateId(),
    name: s.n,
    lines: s.ls.map(text => {
      const isMeta = text.startsWith('[meta]');
      return {
        id: generateId(),
        text: isMeta ? text.slice(6) : text,
        rhymingSyllables: '',
        rhyme: '',
        syllables: 0,
        concept: '',
        ...(isMeta ? { isMeta: true as const } : {}),
      };
    }),
  }));
  return {
    song,
    structure: song.map(s => s.name),
    title: payload.t,
    topic: payload.p,
    mood: payload.m,
    songLanguage: payload.l,
  };
};

export const createSongExport = ({
  song, title, titleOrigin = 'user', topic, mood, songLanguage = '', genre = '', tempo = 120,
  instrumentation = '', rhythm = '', narrative = '', musicalPrompt = '',
  versions = [], format,
}: SongExportParams): { blob: Blob; filename: string } => {
  const baseFileName = getBaseFileName(title);
  switch (format) {
    case 'txt':
      return {
        blob: new Blob(['\uFEFF' + buildTxtContent(song, title, songLanguage)], { type: 'text/plain;charset=utf-8' }),
        filename: `${baseFileName}.txt`,
      };
    case 'markup':
      return {
        blob: new Blob([buildMarkupContent(song, title, topic, mood)], { type: 'text/markdown;charset=utf-8' }),
        filename: `${baseFileName}.md`,
      };
    case 'json':
      return {
        blob: new Blob([JSON.stringify({
          schemaVersion: 1,
          savedAt: Date.now(),
          song,
          structure: song.map(section => section.name),
          title,
          titleOrigin,
          topic,
          mood,
          songLanguage,
          genre,
          tempo,
          instrumentation,
          rhythm,
          narrative,
          musicalPrompt,
          versions,
          activeTab: 'lyrics',
          isStructureOpen: false,
          isLeftPanelOpen: true,
        }, null, 2)], { type: 'application/json;charset=utf-8' }),
        filename: `${baseFileName}.vibe.json`,
      };
    case 'docx':
      return { blob: buildDocxBlob(song, title, topic, mood, songLanguage), filename: `${baseFileName}.docx` };
    case 'odt':
      return { blob: buildOdtBlob(song, title, topic, mood, songLanguage), filename: `${baseFileName}.odt` };
    case 'lrc':
      return {
        blob: new Blob([buildLrcContent(song, title, songLanguage)], { type: 'text/plain;charset=utf-8' }),
        filename: `${baseFileName}.lrc`,
      };
  }
};
