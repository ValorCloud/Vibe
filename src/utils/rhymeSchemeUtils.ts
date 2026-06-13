import { doLinesRhymeGraphemic } from './rhymeDetection';
import type { LocalRhymePairAnalysis } from './songRhymeAnalysis';

export const RHYME_SCHEME_LETTERS = 'ABCDEFGH';

/**
 * Return the scheme letter at `index`, falling back to a generated uppercase
 * letter for indices beyond RHYME_SCHEME_LETTERS.
 * Centralises the String.fromCharCode(65 + n) logic so it is never duplicated.
 */
const schemeLetterAt = (index: number): string =>
  RHYME_SCHEME_LETTERS[index] ?? String.fromCharCode(65 + index);

export const finalizeDetectedRhymeScheme = (letters: (string | null)[]): string | null => {
  const letterCounts: Record<string, number> = {};
  for (const letter of letters) {
    if (letter) letterCounts[letter] = (letterCounts[letter] ?? 0) + 1;
  }

  const counts = new Map<string, number>(Object.entries(letterCounts));
  const remap = new Map<string, string>();
  let remapIndex = 0;
  const finalLetters = letters.map((letter) => {
    if (!letter || (counts.get(letter) ?? 0) < 2) return null;
    if (!remap.has(letter)) {
      remap.set(letter, schemeLetterAt(remapIndex));
      remapIndex++;
    }
    return remap.get(letter)!;
  });

  // FIX: relax guard from >= 2 to >= 1 — a single rhyme pair is a valid partial
  // scheme and must yield visible letters instead of null.
  if (!finalLetters.some(Boolean)) return null;
  return finalLetters.map(letter => letter ?? 'X').join('');
};

/**
 * Reconstruit le schéma de rimes depuis les paires IPA déjà calculées.
 * Évite tout second appel pipeline — les données sont consommées telles quelles.
 * @param lineCount - Nombre total de lignes de la section
 * @param pairs - Paires IPA issues de analyzeSongRhymes
 * @param threshold - Score minimum (0-100) pour qu'une paire compte comme rime
 */
export const detectRhymeSchemeFromIPAPairs = (
  lineCount: number,
  pairs: LocalRhymePairAnalysis[],
  threshold = 60,
): string | null => {
  if (lineCount < 2) return null;

  const pairMap = new Set<string>();
  for (const pair of pairs) {
    if (pair.confidenceScore >= threshold) {
      pairMap.add(`${pair.lineIndexes[0]}-${pair.lineIndexes[1]}`);
    }
  }

  const rhymes = (i: number, j: number): boolean =>
    pairMap.has(`${Math.min(i, j)}-${Math.max(i, j)}`);

  const letters: (string | null)[] = new Array(lineCount).fill(null);
  let nextLetter = 0;

  for (let i = 0; i < lineCount; i++) {
    if (letters[i] !== null) continue;
    let matchedLetter: string | null = null;
    for (let j = 0; j < i; j++) {
      if (rhymes(j, i)) {
        matchedLetter = letters[j] ?? null;
        break;
      }
    }
    if (matchedLetter) {
      letters[i] = matchedLetter;
    } else {
      letters[i] = schemeLetterAt(nextLetter);
      nextLetter++;
    }
    for (let k = i + 1; k < lineCount; k++) {
      if (letters[k] === null && rhymes(i, k)) {
        letters[k] = letters[i] ?? null;
      }
    }
  }

  return finalizeDetectedRhymeScheme(letters);
};

/**
 * Client-side rhyme scheme detector — permanent graphemic safety net.
 *
 * Used in two scenarios:
 * 1. Primary path when the section language is unknown / unsupported by IPA.
 * 2. Fallback when the IPA pipeline fails for any reason.
 *
 * NOTE: language-specific graphemic tweaks (Romance nasal digraphs, etc.) are
 * handled inside doLinesRhymeGraphemic / splitRhymingSuffix, which both
 * accept an optional langCode. This utility therefore remains language-agnostic
 * and must be passed the same langCode used by the rest of the pipeline to
 * keep behaviour aligned.
 */
export const detectRhymeSchemeLocally = (
  lines: string[],
  langCode?: string,
): string | null => {
  if (lines.length < 2) return null;

  const letters: (string | null)[] = new Array(lines.length).fill(null);
  let nextLetterIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]?.trim()) continue;
    if (letters[i] !== null) continue;

    let matchedExistingLetter: string | null = null;
    for (let j = 0; j < i; j++) {
      if (letters[j] && doLinesRhymeGraphemic(lines[i]!, lines[j]!, langCode, { forScheme: true })) {
        matchedExistingLetter = letters[j]!;
        break;
      }
    }

    if (matchedExistingLetter) {
      letters[i] = matchedExistingLetter;
    } else {
      letters[i] = schemeLetterAt(nextLetterIndex);
      nextLetterIndex++;
    }

    const currentLetter = letters[i]!;
    for (let k = i + 1; k < lines.length; k++) {
      if (!lines[k]?.trim() || letters[k] !== null) continue;
      if (doLinesRhymeGraphemic(lines[i]!, lines[k]!, langCode, { forScheme: true })) {
        letters[k] = currentLetter;
      }
    }
  }

  return finalizeDetectedRhymeScheme(letters);
};
