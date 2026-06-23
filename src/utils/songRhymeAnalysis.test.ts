import { describe, expect, it } from 'vitest';
import { buildRhymeGroups, buildRhymeScheme } from './songRhymeAnalysis';

describe('buildRhymeGroups', () => {
  it('returns empty array for empty input', () => {
    expect(buildRhymeGroups([])).toEqual([]);
  });

  it('returns empty array when no lines rhyme', () => {
    expect(buildRhymeGroups(['hello', 'world', 'orange'])).toEqual([]);
  });

  it('ignores sparse entries and does not throw', () => {
    const lines = ['night', '', 'light', '', 'bright'];
    const groups = buildRhymeGroups(lines);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]?.lineIndices).toEqual([0, 2, 4]);
  });

  it('skips exact repeated lines when grouping rhymes', () => {
    const groups = buildRhymeGroups(['stay', 'stay', 'day']);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.lineIndices).toEqual([0, 2]);
  });
});

describe('buildRhymeScheme', () => {
  it('returns null when no groups exist', () => {
    expect(buildRhymeScheme(4, [])).toBeNull();
  });

  it('returns a partial scheme for a single rhyme group', () => {
    const scheme = buildRhymeScheme(4, [{ suffix: 'ight', lineIndices: [0, 2] }]);
    expect(scheme).toBe('AXAX');
  });

  it('ignores out-of-bounds indices', () => {
    const scheme = buildRhymeScheme(3, [{ suffix: 'ay', lineIndices: [0, 10] }]);
    expect(scheme).toBe('AXX');
  });

  it('generates unique labels beyond 26 groups', () => {
    const groups = Array.from({ length: 28 }, (_, index) => ({
      suffix: `s${index}`,
      lineIndices: [index],
    }));
    const scheme = buildRhymeScheme(28, groups);
    expect(scheme).toContain('Z');
    expect(scheme).toContain('A1');
    expect(scheme).toContain('B1');
  });
});
