import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MOOD, DEFAULT_TOPIC } from './songDefaults';

const storageMocks = vi.hoisted(() => ({
  safeGetItem: vi.fn<(key: string) => string | null>(),
  safeSetItem: vi.fn<(key: string, value: string) => boolean>(),
}));

vi.mock('./safeStorage', () => ({
  safeGetItem: storageMocks.safeGetItem,
  safeSetItem: storageMocks.safeSetItem,
}));

import {
  deleteAssetFromLibrary,
  extractImportPayloadFromText,
  loadAssetIntoEditor,
  mergeAssets,
  parseTextToSections,
  purgeLibrary,
  updateAssetInLibrary,
  type LibraryAsset,
} from './libraryUtils';

const makeLine = (id: string, text: string) => ({
  id,
  text,
  rhymingSyllables: '',
  rhyme: '',
  syllables: 0,
  concept: 'New line',
});

const makeAsset = (overrides: Partial<LibraryAsset> = {}): LibraryAsset => ({
  id: 'asset-1',
  title: 'Asset',
  timestamp: 100,
  type: 'lyrics',
  sections: [],
  ...overrides,
});

describe('parseTextToSections', () => {
  it('splits blank-line-separated text into sections', () => {
    const sections = parseTextToSections('Line one\nLine two\n\nLine three');

    expect(sections).toHaveLength(2);
    expect(sections.map(section => section.name)).toEqual(['Verse', 'Verse']);
    expect(sections[0]?.lines.map(line => line.text)).toEqual(['Line one', 'Line two']);
    expect(sections[1]?.lines.map(line => line.text)).toEqual(['Line three']);
  });

  it('uses bracket headers as section names without keeping the header line', () => {
    const sections = parseTextToSections('[Chorus]\nSing along\nShout it out');

    expect(sections).toHaveLength(1);
    expect(sections[0]?.name).toBe('Chorus');
    expect(sections[0]?.lines.map(line => line.text)).toEqual(['Sing along', 'Shout it out']);
  });

  it('supports markdown-style bracket headers', () => {
    const sections = parseTextToSections('**[Verse]**\nNeon dreams');

    expect(sections).toHaveLength(1);
    expect(sections[0]?.name).toBe('Verse');
    expect(sections[0]?.lines.map(line => line.text)).toEqual(['Neon dreams']);
  });

  it('ignores empty blocks and initializes imported lines consistently', () => {
    const sections = parseTextToSections('\n\n[Verse]\n\n\nFirst line\nSecond line\n\n   \n');

    expect(sections).toHaveLength(1);
    expect(sections[0]?.name).toBe('Verse');
    expect(sections[0]?.lines).toHaveLength(2);
    expect(sections[0]?.lines[0]).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^line_/),
      text: 'First line',
      rhymingSyllables: '',
      rhyme: '',
      syllables: 0,
    }));
    expect(sections[0]?.lines[1]).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^line_/),
      text: 'Second line',
      rhymingSyllables: '',
      rhyme: '',
      syllables: 0,
    }));
  });
});

describe('import metadata extraction', () => {
  it('restores plain text language metadata headers', () => {
    expect(extractImportPayloadFromText('\uFEFF# lang: ar\n\nTitle\n\n[Verse]\nLine').songLanguage).toBe('ar');
    expect(extractImportPayloadFromText('\uFEFF# lang: ar\n\nTitle\n\n[Verse]\nLine').text).toBe('Title\n\n[Verse]\nLine');
  });
});

describe('mergeAssets', () => {
  it('keeps all non-overlapping assets and sorts by timestamp descending', () => {
    const base = [
      makeAsset({ id: 'older', timestamp: 100 }),
      makeAsset({ id: 'oldest', timestamp: 50 }),
    ];
    const incoming = [makeAsset({ id: 'newer', timestamp: 200 })];

    expect(mergeAssets(base, incoming).map(asset => asset.id)).toEqual(['newer', 'older', 'oldest']);
  });

  it('prefers incoming assets on id conflicts', () => {
    const merged = mergeAssets(
      [makeAsset({ id: 'shared', title: 'Base title', timestamp: 100 })],
      [makeAsset({ id: 'shared', title: 'Incoming title', timestamp: 300 })],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe('Incoming title');
    expect(merged[0]?.timestamp).toBe(300);
  });

  it('returns incoming assets when the base array is empty', () => {
    const incoming = [makeAsset({ id: 'incoming', timestamp: 200 })];

    expect(mergeAssets([], incoming)).toEqual(incoming);
  });

  it('returns base assets when the incoming array is empty', () => {
    const base = [makeAsset({ id: 'base', timestamp: 100 })];

    expect(mergeAssets(base, [])).toEqual(base);
  });
});

describe('loadAssetIntoEditor', () => {
  it('restores missing syllable counts and infers rhyme schemes for loaded songs', () => {
    const asset: LibraryAsset = {
      id: 'asset-1',
      title: 'Loaded Song',
      timestamp: Date.now(),
      type: 'song',
      sections: [
        {
          id: 'section-1',
          name: 'Verse 1',
          rhymeScheme: 'FREE',
          lines: [
            { id: 'line-1', text: 'Tu veux des preuves, tu veux des certitudes', rhymingSyllables: '', rhyme: '', syllables: 0, concept: 'defiance' },
            { id: 'line-2', text: 'Mais rien n\'est sûr dans cette réalité', rhymingSyllables: '', rhyme: '', syllables: 0, concept: 'existential' },
          ],
        },
      ],
    };

    const loaded = loadAssetIntoEditor(asset);
    const lines = loaded.song[0]?.lines ?? [];

    expect(lines[0]?.syllables).toBeGreaterThan(0);
    expect(lines[1]?.syllables).toBeGreaterThan(0);
  });
});

describe('updateAssetInLibrary', () => {
  // libraryUtils stores its payload under this key (see LIBRARY_KEY).
  const STORAGE_KEY = 'lyricist_library';

  beforeEach(() => {
    storageMocks.safeGetItem.mockReset();
    storageMocks.safeSetItem.mockReset();
    storageMocks.safeSetItem.mockReturnValue(true);
  });

  function seedLibrary(assets: LibraryAsset[]) {
    // readStore expects a { version, assets } envelope validated by LibraryStoreSchema.
    storageMocks.safeGetItem.mockImplementation((key: string) =>
      key === STORAGE_KEY ? JSON.stringify({ version: 0, assets }) : null,
    );
  }

  function parseLastWrite(): LibraryAsset[] {
    const calls = storageMocks.safeSetItem.mock.calls as [string, string][];
    const lastCall = calls[calls.length - 1];
    if (!lastCall) throw new Error('safeSetItem was not called');
    const [, json] = lastCall;
    const parsed = JSON.parse(json) as { assets: LibraryAsset[] };
    return parsed.assets;
  }

  // Build a fully-typed SongVersion entry compatible with SongVersionSchema.
  const makeVersion = (label: string, ts: number) => ({
    id:          `ver-${label}`,
    timestamp:   ts,
    song:        [],
    structure:   [],
    title:       label,
    titleOrigin: 'user' as const,
    topic:       '',
    mood:        '',
    name:        label,
  });

  it('appends a prompt snapshot to an existing asset', async () => {
    const existing = makeAsset({ id: 'a1', versions: [] });
    seedLibrary([existing]);

    await updateAssetInLibrary('a1', { title: 'Updated' });

    const saved = parseLastWrite();
    const updated = saved.find(a => a.id === 'a1')!;

    expect(updated.title).toBe('Updated');
    expect(updated.versions).toHaveLength(1);
  });

  it('caps versions[] at MAX_ASSET_VERSIONS (50)', async () => {
    const versions = Array.from({ length: 55 }, (_, i) => makeVersion(`v${i}`, i));
    const existing = makeAsset({ id: 'a2', versions });
    seedLibrary([existing]);

    await updateAssetInLibrary('a2', { title: 'Capped' });

    const saved = parseLastWrite();
    const updated = saved.find(a => a.id === 'a2')!;

    // After appending 1 snapshot to 55 existing ones (56 total), slice(-50) keeps 50.
    expect(updated.versions).toHaveLength(50);
    // The oldest entries (v0…v5) should have been dropped.
    expect(updated.versions[0]?.title).toBe('v6');
  });

  it('caps promptSnapshots[] at MAX_PROMPT_SNAPSHOTS (100)', async () => {
    const promptSnapshots = Array.from({ length: 105 }, (_, i) => ({
      timestamp: i,
      prompt:    `p${i}`,
    }));
    // promptSnapshots live under asset.metadata, not at the top level.
    const existing = makeAsset({
      id:       'a3',
      metadata: { musicalPrompt: 'old', promptSnapshots },
    });
    seedLibrary([existing]);

    // Changing musicalPrompt triggers a new prompt snapshot for the old value.
    await updateAssetInLibrary('a3', { metadata: { musicalPrompt: 'new' } });

    const saved = parseLastWrite();
    const updated = saved.find(a => a.id === 'a3')!;
    const snapshots = updated.metadata?.promptSnapshots ?? [];

    expect(snapshots).toHaveLength(100);
    // The oldest entries (p0…p5) should have been dropped.
    expect(snapshots[0]?.prompt).toBe('p6');
  });

  it('does nothing when the id is not found in the library', async () => {
    seedLibrary([makeAsset({ id: 'other' })]);

    await updateAssetInLibrary('missing-id', { title: 'Ghost' });

    expect(storageMocks.safeSetItem).not.toHaveBeenCalled();
  });
});

describe('deleteAssetFromLibrary', () => {
  beforeEach(() => {
    storageMocks.safeGetItem.mockReset();
    storageMocks.safeSetItem.mockReset();
    storageMocks.safeSetItem.mockReturnValue(true);
  });

  it('removes the asset with the given id', async () => {
    storageMocks.safeGetItem.mockImplementation((key: string) =>
      key === 'lyricist_library'
        ? JSON.stringify({
            version: 0,
            assets:  [makeAsset({ id: 'to-delete' }), makeAsset({ id: 'keep' })],
          })
        : null,
    );

    await deleteAssetFromLibrary('to-delete');

    const calls = storageMocks.safeSetItem.mock.calls as [string, string][];
    const [, json] = calls[calls.length - 1]!;
    const saved = (JSON.parse(json) as { assets: LibraryAsset[] }).assets;

    expect(saved.map(a => a.id)).toEqual(['keep']);
  });
});

describe('purgeLibrary', () => {
  beforeEach(() => {
    storageMocks.safeGetItem.mockReset();
    storageMocks.safeSetItem.mockReset();
    storageMocks.safeSetItem.mockReturnValue(true);
  });

  it('writes an empty store to storage', async () => {
    await purgeLibrary();

    const [[key, json]] = storageMocks.safeSetItem.mock.calls as [[string, string]];

    expect(key).toBe('lyricist_library');
    expect(JSON.parse(json)).toEqual({ version: 0, assets: [] });
  });
});
