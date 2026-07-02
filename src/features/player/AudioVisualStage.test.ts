import { describe, expect, it } from 'vitest';
import { buildParams, hashSeed, makeRng } from './AudioVisualStage';

// ─── hashSeed ────────────────────────────────────────────────────────────────

describe('hashSeed', () => {
  it('is deterministic for the same input', () => {
    expect(hashSeed('track-42')).toBe(hashSeed('track-42'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashSeed('track-42')).not.toBe(hashSeed('track-43'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const s of ['', 'a', 'track-42', '🎵🎶']) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xFFFFFFFF);
    }
  });
});

// ─── makeRng ─────────────────────────────────────────────────────────────────

describe('makeRng', () => {
  it('produces a deterministic sequence for the same seed', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('produces different sequences for different seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('always yields values in [0, 1)', () => {
    const rng = makeRng(987654321);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('treats seed 0 as a valid seed (falls back to 1)', () => {
    const zero = makeRng(0);
    const one = makeRng(1);
    for (let i = 0; i < 10; i++) expect(zero()).toBe(one());
  });
});

// ─── buildParams ─────────────────────────────────────────────────────────────

describe('buildParams', () => {
  it('is fully deterministic per seed', () => {
    expect(buildParams('deterministic-seed')).toEqual(buildParams('deterministic-seed'));
  });

  it('produces params within documented bounds', () => {
    for (const seed of ['a', 'b', 'c', 'track-1', 'track-2', 'zz-top']) {
      const p = buildParams(seed);
      expect(['waves', 'bars', 'orbits', 'starfield']).toContain(p.mode);
      expect(p.hue).toBeGreaterThanOrEqual(0);
      expect(p.hue).toBeLessThan(360);
      expect(p.count).toBeGreaterThanOrEqual(24);
      expect(p.count).toBeLessThan(64);
      expect(p.speed).toBeGreaterThanOrEqual(0.5);
      expect(p.speed).toBeLessThanOrEqual(1.7);
      expect(p.phases).toHaveLength(64);
      for (const ph of p.phases) {
        expect(ph).toBeGreaterThanOrEqual(0);
        expect(ph).toBeLessThan(Math.PI * 2);
      }
    }
  });

  it('different seeds yield different randomizations', () => {
    expect(buildParams('seed-alpha')).not.toEqual(buildParams('seed-beta'));
  });
});
