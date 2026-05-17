import { useMemo } from 'react';
import { detectRhymeSchemeMultiLang } from '../lib/rhyme/rhymeSchemeDetector';
import { detectRhymeSchemeLocally } from '../utils/rhymeSchemeUtils';
import { toRhymeLangCode } from '../lib/rhyme/langCode';
import type { SchemeResult } from '../lib/rhyme/types';

export interface MultiLangLine {
  text: string;
  lang: string;
}

function isAABBPattern(letters: string[]): boolean {
  return letters.length % 2 === 0
    && letters.every((letter, index) => index % 2 === 0 || letter === letters[index - 1]);
}

export function getRhymeSchemeLabelFromLetters(letters: string[]): SchemeResult['label'] {
  const pattern = letters.join('');
  if (letters.length > 0 && new Set(letters).size === 1) return 'MONORHYME';
  if (pattern === 'AABB' || isAABBPattern(letters)) return 'AABB';
  if (pattern === 'ABAB' || /^([A-Z])([A-Z])(?:\1\2)+$/.test(pattern)) return 'ABAB';
  if (pattern === 'ABBA') return 'ABBA';
  if (pattern === 'ABCABC') return 'ABCABC';
  if (letters.filter(l => l === 'X').length > letters.length / 2) return 'FREE_VERSE';
  return 'CUSTOM';
}

/**
 * Expand a short repeatable scheme pattern to `targetCount` letters.
 *
 * Rules:
 * - Monorhyme (all same letter, e.g. "AAAA") → repeat that letter N times.
 * - Even-unit patterns (AABB, ABAB, ABBA, ABABAB…) → tile the base unit.
 * - Otherwise → return the original string unchanged (caller falls back to raw detection).
 */
function expandScheme(scheme: string, targetCount: number): string {
  if (!scheme || targetCount <= 0) return scheme;
  const letters = scheme.split('');
  if (letters.length === targetCount) return scheme;

  // Monorhyme
  const uniqueLetters = new Set(letters);
  if (uniqueLetters.size === 1) {
    return letters[0].repeat(targetCount);
  }

  // Find the shortest repeating unit (period)
  for (let period = 1; period <= Math.floor(letters.length / 2); period++) {
    const unit = letters.slice(0, period);
    const isRepeating = letters.every((l, i) => l === unit[i % period]);
    if (isRepeating) {
      // Tile the unit to targetCount, re-mapping letters to stay alphabetically consistent
      const result: string[] = [];
      for (let i = 0; i < targetCount; i++) {
        result.push(unit[i % period]);
      }
      return result.join('');
    }
  }

  return scheme;
}

export function applyLocalSchemeOverride(
  raw: SchemeResult,
  localScheme: string | null,
  expectedLineCount: number,
): SchemeResult {
  if (!localScheme) return raw;

  // Expand repeatable patterns to match actual line count before length check.
  const expandedScheme = expandScheme(localScheme, expectedLineCount);
  const localLetters = expandedScheme.split('');

  const hasConsistentLength =
    localLetters.length === expectedLineCount && raw.letters.length === expectedLineCount;
  const hasConsistentPairIndexes = raw.pairScores.every(
    ({ i, j }) => i >= 0 && j >= 0 && i < expectedLineCount && j < expectedLineCount,
  );

  if (!hasConsistentLength || !hasConsistentPairIndexes) return raw;

  return {
    ...raw,
    letters: localLetters,
    label: getRhymeSchemeLabelFromLetters(localLetters),
    confidence: Math.max(raw.confidence, 0.7),
  };
}

/**
 * Derives the rhyme scheme for a stanza where each line may have a different
 * language. Wraps `detectRhymeSchemeMultiLang` with memoisation, meta-line
 * filtering, safe fallback, and optional `forcedScheme` support.
 */
export function useRhymeSchemeMultiLang(
  lines: MultiLangLine[],
  isProxied?: boolean,
  forcedScheme?: string,
): SchemeResult | null {
  const serialised = lines.map(l => `${l.lang}\x01${l.text}`).join('\x00');

  const filtered = useMemo(
    () =>
      lines
        .filter(l => l.text.trim() && !l.text.trim().startsWith('['))
        .map(l => ({ text: l.text, lang: toRhymeLangCode(l.lang) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serialised],
  );

  const result = useMemo(() => {
    if (filtered.length < 2) return null;
    try {
      const raw = detectRhymeSchemeMultiLang(filtered);
      if (raw === null) return null;

      if (forcedScheme) {
        const overridden = applyLocalSchemeOverride(raw, forcedScheme, filtered.length);
        return isProxied !== undefined ? { ...overridden, isProxied } : overridden;
      }

      const firstLang = filtered[0]?.lang;
      const singleLang = filtered.every(line => line.lang === firstLang);
      const localScheme = singleLang && firstLang !== undefined && firstLang !== '__unknown__'
        ? detectRhymeSchemeLocally(filtered.map(line => line.text), firstLang)
        : null;
      const corrected = applyLocalSchemeOverride(raw, localScheme, filtered.length);
      return isProxied !== undefined ? { ...corrected, isProxied } : corrected;
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[useRhymeSchemeMultiLang] detection failed:', err);
      }
      return null;
    }
  }, [filtered, isProxied, forcedScheme]);

  return result;
}
