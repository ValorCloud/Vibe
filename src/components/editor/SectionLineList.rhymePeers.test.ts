import { describe, it, expect } from 'vitest';
import { buildConfirmedPairPeerMap } from './SectionLineList';

describe('buildConfirmedPairPeerMap', () => {
  it('adds both directions for each confirmed pair', () => {
    const peers = buildConfirmedPairPeerMap(
      [{ i: 8, j: 9 }],
      ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'A', 'A'],
    );

    expect([...peers.get(8) ?? []]).toEqual([9]);
    expect([...peers.get(9) ?? []]).toEqual([8]);
  });

  it('ignores pairs whose letters are not the same confirmed family', () => {
    const peers = buildConfirmedPairPeerMap(
      [{ i: 0, j: 1 }, { i: 2, j: 3 }, { i: 4, j: 5 }],
      ['A', 'A', 'A', 'B', 'X', 'X'],
    );

    expect([...peers.get(0) ?? []]).toEqual([1]);
    expect([...peers.get(1) ?? []]).toEqual([0]);
    expect(peers.get(2)).toBeUndefined();
    expect(peers.get(3)).toBeUndefined();
    expect(peers.get(4)).toBeUndefined();
    expect(peers.get(5)).toBeUndefined();
  });
});
