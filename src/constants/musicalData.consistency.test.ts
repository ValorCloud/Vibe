import { describe, expect, it } from 'vitest';
import {
  VIBE_CATEGORIES,
  SUB_STYLE_DATA,
  TILE_SUBSTYLE_FALLBACK,
  getSubStyleEntries,
} from './musicalData';
import { RHYTHM_BPM } from './rhythmBpm';

const ALL_TILES = VIBE_CATEGORIES.flatMap(category => category.tiles);

// Genres explicitly called out as recently added — they must resolve to a real
// BPM and a non-empty sub-style list so selecting them never yields undefined/NaN.
const NEW_GENRE_TILES = [
  'Country', 'Folk', 'Ambient', 'Cinematic', 'Salsa',
  'Bachata', 'Cumbia', 'Latin', 'Lo-Fi',
];

describe('musical data consistency', () => {
  it('maps every vibe tile rhythm to a defined BPM (no NaN on selection)', () => {
    const missing = ALL_TILES
      .filter(tile => typeof RHYTHM_BPM[tile.rhythm] !== 'number')
      .map(tile => `${tile.name} → ${tile.rhythm}`);
    expect(missing).toEqual([]);
  });

  it('gives every vibe tile a finite, in-range BPM', () => {
    for (const tile of ALL_TILES) {
      const bpm = RHYTHM_BPM[tile.rhythm] ?? tile.bpm;
      expect(Number.isFinite(bpm)).toBe(true);
      expect(bpm).toBeGreaterThanOrEqual(40);
      expect(bpm).toBeLessThanOrEqual(220);
    }
  });

  it('resolves every TILE_SUBSTYLE_FALLBACK target to a real SUB_STYLE_DATA key', () => {
    const dangling = Object.entries(TILE_SUBSTYLE_FALLBACK)
      .filter(([, parent]) => !SUB_STYLE_DATA[parent])
      .map(([tile, parent]) => `${tile} → ${parent}`);
    expect(dangling).toEqual([]);
  });

  it('covers the newly added genres with both sub-styles and a BPM', () => {
    const tilesByName = new Map(ALL_TILES.map(tile => [tile.name, tile]));
    for (const name of NEW_GENRE_TILES) {
      const tile = tilesByName.get(name);
      expect(tile, `${name} should exist as a vibe tile`).toBeTruthy();
      expect(getSubStyleEntries(name).length, `${name} should expose sub-styles`).toBeGreaterThan(0);
      expect(typeof RHYTHM_BPM[tile!.rhythm]).toBe('number');
    }
  });

  it('never throws and always returns an array from getSubStyleEntries', () => {
    for (const tile of ALL_TILES) {
      const entries = getSubStyleEntries(tile.name);
      expect(Array.isArray(entries)).toBe(true);
    }
  });
});
