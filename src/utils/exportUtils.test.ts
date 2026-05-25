// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { Section } from '../types';
import { buildShareUrl, createSongExport, parseShareHash, sharePayloadToSong } from './exportUtils';

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

  it('builds a project JSON export with musical prompt and versions', async () => {
    const { blob, filename } = createSongExport({
      song,
      title: 'Test Song',
      topic: 'night drive',
      mood: 'moody',
      musicalPrompt: 'STYLE: synthwave',
      versions: [{
        id: 'v1',
        timestamp: 1,
        song,
        structure: ['Chorus'],
        title: 'Test Song',
        titleOrigin: 'user',
        topic: 'night drive',
        mood: 'moody',
        musicalPrompt: 'STYLE: acoustic',
        name: 'Draft',
      }],
      format: 'json',
    });

    const payload = JSON.parse(await blob.text()) as { musicalPrompt: string; versions: unknown[] };
    expect(filename).toBe('Test_Song.vibe.json');
    expect(payload.musicalPrompt).toBe('STYLE: synthwave');
    expect(payload.versions).toHaveLength(1);
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

  it('builds lrc output with timestamps and section markers', async () => {
    const { blob, filename } = createSongExport({
      song,
      title: 'Test Song',
      topic: 'night drive',
      mood: 'moody',
      songLanguage: 'en',
      format: 'lrc',
    });

    expect(filename).toBe('Test_Song.lrc');
    const text = await blob.text();
    expect(text).toContain('[ti:Test Song]');
    expect(text).toContain('[la:en]');
    expect(text).toContain('[by:Vibe]');
    expect(text).toContain('▶ Chorus');
    expect(text).toContain('Sing along');
    // Timestamps should follow [mm:ss.cs] format
    expect(text).toMatch(/\[\d{2}:\d{2}\.\d{2}\]/);
    // Meta lines should be excluded
    expect(text).not.toContain('[drop]');
  });
});

describe('share URL utilities', () => {
  it('round-trips song data via buildShareUrl / parseShareHash / sharePayloadToSong', () => {
    const shareUrl = buildShareUrl({
      song,
      title: 'Round Trip',
      topic: 'test topic',
      mood: 'mellow',
      songLanguage: 'en',
    });

    expect(shareUrl).toContain('#share=');

    const hash = '#' + shareUrl.split('#')[1]!;
    const payload = parseShareHash(hash);
    expect(payload).not.toBeNull();
    expect(payload!.t).toBe('Round Trip');
    expect(payload!.p).toBe('test topic');
    expect(payload!.m).toBe('mellow');
    expect(payload!.l).toBe('en');
    expect(payload!.s).toHaveLength(1);
    expect(payload!.s[0]!.n).toBe('Chorus');
    // Non-meta lines appear as-is; meta lines are stored with a "[meta]" prefix
    expect(payload!.s[0]!.ls[0]).toBe('Sing along');
    expect(payload!.s[0]!.ls[1]).toBe('[meta][drop]');

    const { song: restored, title } = sharePayloadToSong(payload!);
    expect(title).toBe('Round Trip');
    expect(restored).toHaveLength(1);
    expect(restored[0]!.name).toBe('Chorus');
    expect(restored[0]!.lines[0]!.text).toBe('Sing along');
    // Meta line is correctly reconstructed
    expect(restored[0]!.lines[1]!.text).toBe('[drop]');
    expect(restored[0]!.lines[1]!.isMeta).toBe(true);
  });

  it('parseShareHash returns null for invalid input', () => {
    expect(parseShareHash('#other=abc')).toBeNull();
    expect(parseShareHash('')).toBeNull();
    expect(parseShareHash('#share=!!!invalid!!!')).toBeNull();
  });

  it('handles meta lines in share payload', () => {
    const songWithMeta: Section[] = [
      {
        id: 's1',
        name: 'Verse',
        lines: [
          { id: 'l1', text: 'Normal line', rhymingSyllables: '', rhyme: '', syllables: 0, concept: '' },
          { id: 'l2', text: '[Guitar solo]', rhymingSyllables: '', rhyme: '', syllables: 0, concept: '', isMeta: true },
        ],
      },
    ];

    const url = buildShareUrl({ song: songWithMeta, title: 'Meta Test', topic: '', mood: '', songLanguage: '' });
    const payload = parseShareHash('#' + url.split('#')[1]!);
    expect(payload).not.toBeNull();
    // Meta line is included with "[meta]" prefix for round-trip fidelity
    expect(payload!.s[0]!.ls).toHaveLength(2);
    expect(payload!.s[0]!.ls[0]).toBe('Normal line');
    expect(payload!.s[0]!.ls[1]).toBe('[meta][Guitar solo]');

    const { song: restored } = sharePayloadToSong(payload!);
    expect(restored[0]!.lines[1]!.text).toBe('[Guitar solo]');
    expect(restored[0]!.lines[1]!.isMeta).toBe(true);
  });
});
