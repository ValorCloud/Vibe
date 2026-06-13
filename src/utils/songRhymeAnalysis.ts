import { languageNameToCode, getAlgoFamily } from '../constants/langFamilyMap';
import type { Section } from '../types';
import { compareTextsWithIPA } from './ipaPipeline';
import { detectRhymeSchemeFromIPAPairs, detectRhymeSchemeLocally } from './rhymeSchemeUtils';
import {
  doLinesRhymeGraphemic,
  segmentVerseToRhymingUnit,
  splitRhymingSuffix,
} from './rhymeDetection';

/**
 * Local rhyme comparison for a pair of lyric lines.
 * `quality` mirrors the IPA rhyme classifier, `confidenceScore` is the normalized
 * 0–100 score used by the hook, and `isApproximated` flags mocked or downgraded
 * near-matches that should count below an exact pair of the same base similarity.
 * `crossSection` is true when the two lines come from different sections.
 * `rhymePosition` reflects the structural role detected by segmentVerseToRhymingUnit
 * ('end' | 'internal' | 'enjambed') so the UI can highlight accordingly.
 * `crossFamily` is true when the two lines were analyzed through different
 * language pipelines (code-switching pair).
 */
export type LocalRhymePairAnalysis = {
  lineIndexes: [number, number];
  lines: [string, string];
  quality: string;
  confidenceScore: number;
  usedIpa: boolean;
  isApproximated: boolean;
  crossSection?: boolean;
  rhymePosition?: 'end' | 'internal' | 'enjambed';
  crossFamily?: boolean;
};

/**
 * Per-section rhyme diagnostics built locally before any AI analysis.
 * `mode: "ipa"` means a supported language was analyzed through compareTextsWithIPA,
 * while `mode: "graphemic"` indicates an unsupported language or graceful fallback.
 * `isProxied` is true when the G2P family is handled by a proxy stub.
 */
export type LocalRhymeSectionAnalysis = {
  sectionId: string;
  sectionName: string;
  langCode?: string;
  detectedScheme: string | null;
  mode: 'ipa' | 'graphemic';
  isProxied: boolean;
  pairs: LocalRhymePairAnalysis[];
};

// ─── New helpers (also exported for rhymeSchemeUtils / UI consumers) ──────────

export interface RhymeGroup {
  /** Representative suffix shared by all lines in the group. */
  suffix: string;
  /** 0-based indices into the lyric-only lines array passed to buildRhymeGroups. */
  lineIndices: number[];
}

export interface RhymeOverlaySegment {
  before: string;
  rhyme: string;
  /** Structural position resolved by segmentVerseToRhymingUnit (Step-0). */
  position: 'end' | 'internal' | 'enjambed';
}

export interface SectionRhymeAnalysis {
  groups: RhymeGroup[];
  overlays: (RhymeOverlaySegment | null)[];
  scheme: string | null;
}

// ─── Families with a native G2P implementation ───────────────────────────────

const NATIVE_G2P_FAMILIES = new Set(['ALGO-ROM', 'ALGO-GER', 'ALGO-KWA', 'ALGO-CRV', 'ALGO-SEM']);

const toPairConfidenceScore = (similarity: { score?: number; isApproximated?: boolean }) => {
  const baseScore = typeof similarity.score === 'number' ? similarity.score : 0;
  const adjustedScore = similarity.isApproximated ? baseScore * 0.85 : baseScore;
  return Math.round(adjustedScore * 1000) / 10;
};

/**
 * Detect the language of a single line when it may differ from the section
 * language (code-switching).
 */
const detectLineLang = (
  lineText: string,
  sectionLang: string,
): { text: string; langCode: string } => {
  const INLINE_TAG = /^\[lang:([a-z]{2,3}(?:-[a-z]{2})?)\]\s*/i;
  const match = INLINE_TAG.exec(lineText);
  if (match) {
    return {
      text: lineText.slice(match[0].length),
      langCode: match[1]!.toLowerCase(),
    };
  }
  return { text: lineText, langCode: sectionLang };
};

// ─── buildRhymeGroups ─────────────────────────────────────────────────────────

/**
 * Build rhyme groups for a flat list of lyric-only line texts.
 *
 * FIX: inner loop now skips already-assigned lines (groupIndex[j] !== null)
 * to prevent the same line from appearing in multiple groups.
 */
export const buildRhymeGroups = (lines: string[], langCode?: string): RhymeGroup[] => {
  const n = lines.length;
  const groupIndex = new Array<number | null>(n).fill(null);
  const groups: RhymeGroup[] = [];

  for (let i = 0; i < n; i++) {
    if (groupIndex[i] !== null) continue;
    if (!lines[i]?.trim()) continue;

    const members: number[] = [i];
    for (let j = i + 1; j < n; j++) {
      if (groupIndex[j] !== null) continue;
      if (!lines[j]?.trim()) continue;
      if (doLinesRhymeGraphemic(lines[i]!, lines[j]!, langCode)) {
        members.push(j);
      }
    }

    if (members.length < 2) continue;

    const gIdx = groups.length;
    for (const idx of members) groupIndex[idx] = gIdx;

    const firstPeerIndex = members[1];
    if (firstPeerIndex === undefined) continue;

    const split = splitRhymingSuffix(lines[i]!, [lines[firstPeerIndex]!], langCode);
    groups.push({
      suffix: split?.rhyme ?? '',
      lineIndices: members,
    });
  }

  return groups;
};

// ─── buildRhymeOverlays ───────────────────────────────────────────────────────

export const buildRhymeOverlays = (
  lines: string[],
  groups: RhymeGroup[],
  langCode?: string,
): (RhymeOverlaySegment | null)[] => {
  const lineToGroup = new Map<number, RhymeGroup>();
  for (const group of groups) {
    for (const idx of group.lineIndices) lineToGroup.set(idx, group);
  }

  return lines.map((line, i) => {
    const group = lineToGroup.get(i);
    if (!group) return null;

    const peerLines = group.lineIndices
      .filter(idx => idx !== i)
      .map(idx => lines[idx]!)
      .filter(Boolean);

    const split = splitRhymingSuffix(line, peerLines, langCode);
    if (!split) return null;

    const { position } = segmentVerseToRhymingUnit(line, langCode);
    return { before: split.before, rhyme: split.rhyme, position };
  });
};

// ─── buildRhymeScheme ─────────────────────────────────────────────────────────

export const buildRhymeScheme = (lineCount: number, groups: RhymeGroup[]): string | null => {
  if (groups.length < 1) return null;

  const letters = new Array<string>(lineCount).fill('X');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let nextLetter = 0;

  for (const group of groups) {
    const letter = alphabet[nextLetter % alphabet.length] ?? String.fromCharCode(65 + nextLetter);
    nextLetter++;
    for (const idx of group.lineIndices) {
      if (idx < lineCount) letters[idx] = letter;
    }
  }

  // FIX: a single rhyme group (one pair) is a valid partial scheme — relax guard
  // from >= 2 to >= 1 so free-verse sections with a single rhyming pair emit
  // schema letters rather than null / X for all lines.
  const distinctRhyming = new Set(letters.filter(l => l !== 'X'));
  return distinctRhyming.size >= 1 ? letters.join('') : null;
};

// ─── analyseSection / analyseSong ────────────────────────────────────────────

export const analyseSection = (
  section: Section,
  langCode?: string,
): SectionRhymeAnalysis => {
  const allLines = section.lines ?? [];

  const lyricEntries: { idx: number; text: string }[] = [];
  allLines.forEach((l, idx) => {
    if (!l.isMeta && l.text?.trim()) lyricEntries.push({ idx, text: l.text });
  });

  const lyricTexts = lyricEntries.map(e => e.text);
  const groups = buildRhymeGroups(lyricTexts, langCode);
  const lyricOverlays = buildRhymeOverlays(lyricTexts, groups, langCode);
  const scheme = buildRhymeScheme(lyricTexts.length, groups);

  const overlays: (RhymeOverlaySegment | null)[] = new Array(allLines.length).fill(null);
  lyricEntries.forEach(({ idx }, lyricIdx) => {
    overlays[idx] = lyricOverlays[lyricIdx] ?? null;
  });

  return { groups, overlays, scheme };
};

export const analyseSong = (
  sections: Section[],
  langCode?: string,
): SectionRhymeAnalysis[] => sections.map(section => analyseSection(section, langCode));

// ─── analyzeSongRhymes (original async API — preserved for consumers) ─────────

export const analyzeSongRhymes = async (
  song: Section[],
  detectCrossSectionBoundary = false,
): Promise<LocalRhymeSectionAnalysis[]> => {
  const results = await Promise.all(song.map(async (section, sectionIndex) => {
    const rawLyricLines = section.lines
      .filter(line => !line.isMeta)
      .map(line => line.text.trim())
      .filter(Boolean);

    const sectionLangCode = languageNameToCode(section.language ?? '');

    // Use statically-imported getAlgoFamily — no dynamic import needed
    const family = sectionLangCode ? getAlgoFamily(sectionLangCode) : undefined;
    const isProxied = family ? !NATIVE_G2P_FAMILIES.has(family) : false;

    const segmented = rawLyricLines.map(rawLine => {
      const resolved = sectionLangCode
        ? detectLineLang(rawLine, sectionLangCode)
        : { text: rawLine, langCode: sectionLangCode ?? '' };
      const segment = segmentVerseToRhymingUnit(resolved.text, resolved.langCode || undefined);
      return {
        rawText: resolved.text,
        langCode: resolved.langCode,
        rhymingUnit: segment.rhymingUnit,
        position: segment.position,
      };
    });

    const lyricLines = segmented.map(s => s.rawText);
    const graphemicScheme = detectRhymeSchemeLocally(lyricLines, sectionLangCode);

    if (!sectionLangCode || lyricLines.length < 2) {
      return {
        sectionId: section.id,
        sectionName: section.name,
        ...(sectionLangCode !== undefined ? { langCode: sectionLangCode } : {}),
        detectedScheme: graphemicScheme,
        mode: 'graphemic' as const,
        isProxied,
        pairs: [] as LocalRhymePairAnalysis[],
        _sectionIndex: sectionIndex,
        _lyricLines: lyricLines,
        _segmented: segmented,
      };
    }

    try {
      const pairs: LocalRhymePairAnalysis[] = [];

      for (let firstIndex = 0; firstIndex < segmented.length; firstIndex++) {
        for (let secondIndex = firstIndex + 1; secondIndex < segmented.length; secondIndex++) {
          const first = segmented[firstIndex]!;
          const second = segmented[secondIndex]!;
          const isCrossFamily = first.langCode !== second.langCode;
          const inputA = first.rhymingUnit || first.rawText;
          const inputB = second.rhymingUnit || second.rawText;

          const similarity = await compareTextsWithIPA(
            inputA,
            inputB,
            first.langCode,
            isCrossFamily ? { langCode2: second.langCode } : undefined,
          );

          pairs.push({
            lineIndexes: [firstIndex, secondIndex],
            lines: [first.rawText, second.rawText],
            quality: similarity.quality,
            confidenceScore: toPairConfidenceScore(similarity as { score?: number; isApproximated?: boolean }),
            usedIpa: true,
            isApproximated: Boolean((similarity as { isApproximated?: boolean }).isApproximated),
            rhymePosition: first.position,
            ...(isCrossFamily && { crossFamily: true }),
          });
        }
      }

      const ipaScheme = detectRhymeSchemeFromIPAPairs(lyricLines.length, pairs);

      const graphemicPairs: LocalRhymePairAnalysis[] = [];
      for (let i = 0; i < lyricLines.length; i++) {
        for (let j = i + 1; j < lyricLines.length; j++) {
          if (doLinesRhymeGraphemic(lyricLines[i]!, lyricLines[j]!, sectionLangCode, { forScheme: true })) {
            graphemicPairs.push({
              lineIndexes: [i, j],
              lines: [lyricLines[i]!, lyricLines[j]!],
              quality: 'sufficient',
              confidenceScore: 100,
              usedIpa: false,
              isApproximated: false,
            });
          }
        }
      }
      const combinedPairs = [...pairs];
      const seenKeys = new Set(pairs
        .filter(p => p.confidenceScore >= 60)
        .map(p => `${p.lineIndexes[0]}-${p.lineIndexes[1]}`));
      for (const gp of graphemicPairs) {
        const key = `${gp.lineIndexes[0]}-${gp.lineIndexes[1]}`;
        if (!seenKeys.has(key)) combinedPairs.push(gp);
      }
      const mergedScheme = detectRhymeSchemeFromIPAPairs(lyricLines.length, combinedPairs);

      return {
        sectionId: section.id,
        sectionName: section.name,
        ...(sectionLangCode !== undefined ? { langCode: sectionLangCode } : {}),
        detectedScheme: mergedScheme ?? ipaScheme ?? graphemicScheme,
        mode: 'ipa' as const,
        isProxied,
        pairs,
        _sectionIndex: sectionIndex,
        _lyricLines: lyricLines,
        _segmented: segmented,
      };
    } catch {
      return {
        sectionId: section.id,
        sectionName: section.name,
        ...(sectionLangCode !== undefined ? { langCode: sectionLangCode } : {}),
        detectedScheme: graphemicScheme,
        mode: 'graphemic' as const,
        isProxied,
        pairs: [] as LocalRhymePairAnalysis[],
        _sectionIndex: sectionIndex,
        _lyricLines: lyricLines,
        _segmented: segmented,
      };
    }
  }));

  if (detectCrossSectionBoundary && results.length >= 2) {
    for (let i = 0; i < results.length - 1; i++) {
      const current = results[i]!;
      const next = results[i + 1]!;
      const lastLine = current._lyricLines[current._lyricLines.length - 1];
      const firstLine = next._lyricLines[0];
      if (!lastLine || !firstLine) continue;
      const langCode = current.langCode;
      try {
        if (langCode) {
          const lastSeg = current._segmented[current._segmented.length - 1];
          const firstSeg = next._segmented?.[0];
          const isCrossFamily = lastSeg && firstSeg && lastSeg.langCode !== firstSeg.langCode;
          const inputA = lastSeg?.rhymingUnit || lastLine;
          const inputB = firstSeg?.rhymingUnit || firstLine;
          const langA = lastSeg?.langCode || langCode;
          const langB = firstSeg?.langCode || next.langCode || langCode;
          const similarity = await compareTextsWithIPA(
            inputA, inputB, langA,
            isCrossFamily ? { langCode2: langB } : undefined,
          );
          current.pairs.push({
            lineIndexes: [current._lyricLines.length - 1, -1],
            lines: [lastLine, firstLine],
            quality: similarity.quality,
            confidenceScore: toPairConfidenceScore(similarity as { score?: number; isApproximated?: boolean }),
            usedIpa: true,
            isApproximated: Boolean((similarity as { isApproximated?: boolean }).isApproximated),
            crossSection: true,
            rhymePosition: lastSeg?.position ?? 'end',
            ...(isCrossFamily && { crossFamily: true }),
          });
        } else {
          if (doLinesRhymeGraphemic(lastLine, firstLine)) {
            current.pairs.push({
              lineIndexes: [current._lyricLines.length - 1, -1],
              lines: [lastLine, firstLine],
              quality: 'graphemic',
              confidenceScore: 70,
              usedIpa: false,
              isApproximated: true,
              crossSection: true,
              rhymePosition: 'end',
            });
          }
        }
      } catch {
        // best-effort
      }
    }
  }

  return results.map(({ _sectionIndex: _si, _lyricLines: _ll, _segmented: _sg, ...rest }) => rest);
};
