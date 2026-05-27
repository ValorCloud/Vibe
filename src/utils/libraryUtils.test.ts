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
            { id: 'line-1', text: 'Tu veux des preuves, tu veux des certitudes', rhymingSyllables: '', rhyme: '', syllables: 0, concept: 'Line 1' },
            { id: 'line-2', text: 'Tu confonds l\'amour avec la servitude', rhymingSyllables: '', rhyme: '', syllables: 0, concept: 'Line 2' },
          ],
        },
      ],
    };

    const loaded = loadAssetIntoEditor(asset);

    expect(loaded.song[0]?.rhymeScheme).toBe('AA');
    expect(loaded.rhymeScheme).toBe('AA');
    expect(loaded.song[0]?.lines[0]?.syllables).toBeGreaterThan(0);
    expect(loaded.song[0]?.lines[1]?.syllables).toBeGreaterThan(0);
  });

  it('maps full asset metadata into editor state', () => {
    const asset = makeAsset({
      id: 'asset-full',
      title: 'Loaded Song',
      type: 'song',
      sections: [
        {
          id: 'section-1',
          name: 'Verse 1',
          rhymeScheme: 'ABAB',
          targetSyllables: 12,
          lines: [makeLine('line-1', 'Sing along tonight')],
        },
      ],
      metadata: {
        topic: 'Midnight drive',
        mood: 'Hopeful',
        genre: 'Synthwave',
        tempo: 98,
        instrumentation: 'Analog synths',
        rhythm: 'Steady pulse',
        narrative: 'City escape',
        musicalPrompt: 'Warm pads and gated drums',
      },
    });

    const loaded = loadAssetIntoEditor(asset);

    expect(loaded.song[0]?.name).toBe('Verse 1');
    expect(loaded.song[0]?.lines[0]?.text).toBe('Sing along tonight');
    expect(loaded.structure).toEqual(['Verse 1']);
    expect(loaded.title).toBe('Loaded Song');
    expect(loaded.topic).toBe('Midnight drive');
    expect(loaded.mood).toBe('Hopeful');
    expect(loaded.rhymeScheme).toBe('ABAB');
    expect(loaded.targetSyllables).toBe(12);
    expect(loaded.genre).toBe('Synthwave');
    expect(loaded.tempo).toBe(98);
    expect(loaded.instrumentation).toBe('Analog synths');
    expect(loaded.rhythm).toBe('Steady pulse');
    expect(loaded.narrative).toBe('City escape');
    expect(loaded.musicalPrompt).toBe('Warm pads and gated drums');
  });

  it('applies editor defaults when asset metadata is missing', () => {
    const loaded = loadAssetIntoEditor(makeAsset({
      sections: [{ id: 'section-1', name: 'Verse 1', lines: [] }],
    }));

    expect(loaded.topic).toBe(DEFAULT_TOPIC);
    expect(loaded.mood).toBe(DEFAULT_MOOD);
    expect(loaded.rhymeScheme).toBe('AABB');
    expect(loaded.targetSyllables).toBe(10);
    expect(loaded.tempo).toBe(120);
  });

  it('converts legacy tempo metadata to a number', () => {
    const loaded = loadAssetIntoEditor(makeAsset({
      metadata: { tempo: 90 },
    }));

    expect(loaded.tempo).toBe(90);
  });
});

describe('deleteAssetFromLibrary and purgeLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.safeSetItem.mockReturnValue(true);
  });

  it('removes the matching asset id from the stored library', async () => {
    storageMocks.safeGetItem.mockReturnValue(JSON.stringify({
      version: 2,
      assets: [
        makeAsset({ id: 'keep', timestamp: 200 }),
        makeAsset({ id: 'remove', timestamp: 100 }),
      ],
    }));

    await deleteAssetFromLibrary('remove');

    expect(storageMocks.safeGetItem).toHaveBeenCalledWith('lyricist_library');
    expect(storageMocks.safeSetItem).toHaveBeenCalledWith('lyricist_library', JSON.stringify({
      version: 3,
      assets: [
        makeAsset({ id: 'keep', timestamp: 200 }),
      ],
    }));
  });

  it('writes an empty version-zero store when purging the library', async () => {
    await purgeLibrary();

    expect(storageMocks.safeSetItem).toHaveBeenCalledWith('lyricist_library', JSON.stringify({
      version: 0,
      assets: [],
    }));
  });
});

describe('updateAssetInLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.safeSetItem.mockReturnValue(true);
  });

  it('returns null when the asset id is not found', async () => {
    storageMocks.safeGetItem.mockReturnValue(JSON.stringify({
      version: 1,
      assets: [makeAsset({ id: 'other', timestamp: 100 })],
    }));

    const result = await updateAssetInLibrary('missing', { title: 'New title' });

    expect(result).toBeNull();
    expect(storageMocks.safeSetItem).not.toHaveBeenCalled();
  });

  it('appends a version snapshot on each update', async () => {
    storageMocks.safeGetItem.mockReturnValue(JSON.stringify({
      version: 1,
      assets: [makeAsset({ id: 'song-1', title: 'Original', timestamp: 100 })],
    }));

    const updated = await updateAssetInLibrary('song-1', { title: 'Updated' });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('Updated');
    expect(updated!.versions).toHaveLength(1);
    expect(updated!.versions![0]!.title).toBe('Original');
  });

  it('caps versions[] at 50 to prevent unbounded growth', async () => {
    // Build an asset that already has 50 versions
    const existingVersions = Array.from({ length: 50 }, (_, i) => ({
      id:          `ver_${i}`,
      timestamp:   i,
      song:        [],
      structure:   [],
      title:       `v${i}`,
      titleOrigin: 'user' as const,
      topic:       '',
      mood:        '',
      name:        `v${i}`,
    }));

    storageMocks.safeGetItem.mockReturnValue(JSON.stringify({
      version: 1,
      assets: [makeAsset({ id: 'song-cap', title: 'Cap test', timestamp: 100, versions: existingVersions })],
    }));

    const updated = await updateAssetInLibrary('song-cap', { title: 'After cap' });

    expect(updated).not.toBeNull();
    // Still exactly 50 — oldest dropped, newest appended
    expect(updated!.versions).toHaveLength(50);
    // The newly appended snapshot title matches the pre-update state
    expect(updated!.versions![49]!.title).toBe('Cap test');
  });
});
