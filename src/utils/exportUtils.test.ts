// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { Section } from '../types';
import { createSongExport } from './exportUtils';

const song: Section[] = [
  {
    id: 's1',
    name: 'Chorus',
    lines: [
      {
        id: 'l1',
        text: 'Sing along',
        rhymingSyllables: '',
        rhyme: '',
        syllables: 0,
        concept: 'New line',
      },
      {
        id: 'l2',
        text: '[drop]',
        rhymingSyllables: '',
        rhyme: '',
        syllables: 0,
        concept: 'New line',
        isMeta: true,
      },
    ],
  },
];

describe('createSongExport', () => {
  it('builds readable txt output', async () => {
    const { blob, filename } = createSongExport({
      song,
      title: 'Test Song',
      topic: 'night drive',
      mood: 'moody',
      songLanguage: 'fr',
      format: 'txt',
    });

    expect(filename).toBe('Test_Song.txt');
    await expect(blob.text()).resolves.toContain('# lang: fr');
    await expect(blob.text()).resolves.toContain('[Chorus]');
    await expect(blob.text()).resolves.toContain('Sing along');
  });

  it('builds readable markup output', async () => {
    const { blob, filename } = createSongExport({
      song,
      title: 'Test Song',
      topic: 'night drive',
      mood: 'moody',
      format: 'markup',
    });

    expect(filename).toBe('Test_Song.md');
    await expect(blob.text()).resolves.toContain('# Test Song');
    await expect(blob.text()).resolves.toContain('### Chorus');
    await expect(blob.text()).resolves.toContain('[meta] \\[drop\\]');
  });

  it.each([
    ['docx', 'Test_Song.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['odt', 'Test_Song.odt', 'application/vnd.oasis.opendocument.text'],
  ] as const)('builds %s as a zip container', async (format, expectedFilename, expectedMime) => {
    const { blob, filename } = createSongExport({
      song,
      title: 'Test Song',
      topic: 'night drive',
      mood: 'moody',
      format,
    });

    expect(filename).toBe(expectedFilename);
    expect(blob.type).toBe(expectedMime);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 2))).toEqual([80, 75]);
  });

  it('stores language metadata in docx and odt exports when provided', async () => {
    const docx = createSongExport({
      song,
      title: 'Test Song',
      topic: 'night drive',
      mood: 'moody',
      songLanguage: 'ar',
      format: 'docx',
    });
    const odt = createSongExport({
      song,
      title: 'Test Song',
      topic: 'night drive',
      mood: 'moody',
      songLanguage: 'ar',
      format: 'odt',
    });

    const docxFiles = unzipSync(new Uint8Array(await docx.blob.arrayBuffer()));
    const odtFiles = unzipSync(new Uint8Array(await odt.blob.arrayBuffer()));

    expect(strFromU8(docxFiles['docProps/core.xml'] ?? new Uint8Array())).toContain('<dc:language>ar</dc:language>');
    expect(strFromU8(odtFiles['meta.xml'] ?? new Uint8Array())).toContain('<dc:language>ar</dc:language>');
  });
});
