/**
 * Rhyme Engine v4 — Entry Point
 * rhymeScore(lineA, lineB, langA, langB, opts): RhymeResult
 * analyzeBlock(block, lang, opts): BlockAnalysisResult
 *
 * v4 additions:
 *  - morphoAwareNucleus wired for BNT family (TRK/FIN handle morpho internally)
 *  - lidSpanDetector auto-detects code-switching before routing
 *  - embeddingScorer (level 4) blended for TAI/VIET/YRB/KWA (CJK excluded: graphemic proxies)
 *  - tonalMatrix unified penalty applied to all tonal families
 *  - rhymePosition mode: end | internal | initial | all
 *
 * v4.1 fixes:
 *  - ROM nucleus now extracted from last word only (not full surface string)
 *  - charSpanA/charSpanB added to RhymeResult — UI consumes directly, no heuristic
 *  - scoreROM is lang-aware (FR/CA: vowel weight 0.85, others: 0.65)
 *
 * v4.2 fixes:
 *  - analyzeBlock now returns full BlockAnalysisResult with lineSpans populated
 *  - lineSpans derived from scheme.pairScores charSpanA/B — no heuristic fallback
 *  - Lines with no rhyming partner receive charSpanStart/End = -1
 *
 * v4.3 fixes:
 *  - charSpan now points to the nucleus suffix inside the token, not the full token
 *  - nucleus.charSpanStart/End (vowel onset within token) combined with token
 *    position in line → UI highlights exact rhyming suffix (esse, isse, ace…)
 */

import type {
  LangCode,
  RhymeNucleus,
  RhymeResult,
  RhymeCharSpan,
  SchemeResult,
  FamilyId,
  LineRhymeSpan,
  BlockAnalysisResult,
} from './types';
import { extractLineEndingUnit, normalizeInput } from './normalize';
import { routeToFamily } from './router';
import { categorize, scoreKWANormalized, scoreCRV, phonemeEditDistance } from './scoring';
import { extractNucleusKWA } from './algo-kwa';
import { extractNucleusCRV } from './algo-crv';
import { extractNucleusROM, scoreROM, lastRhymingToken } from './algo-rom';
import { extractNucleusGER, scoreGER } from './algo-ger';
import { extractNucleusBNT, scoreBNT } from './algo-bnt';
import { extractNucleusYRB, scoreYRB, type YRBNucleus } from './algo-yrb';
import { extractNucleusSLV, scoreSLV } from './algo-slv';
import { extractNucleusSEM, scoreSEM } from './algo-sem';
import { extractNucleusTAI, scoreTAI } from './algo-tai';
import { extractNucleusVIET, scoreVIET } from './algo-viet';
import { extractNucleusCJK, scoreCJK } from './algo-cjk';
import { extractNucleusTRK, scoreTRK, type TRKNucleus } from './algo-trk';
import { extractNucleusFIN, scoreFIN, type FINNucleus } from './algo-fin';
import { extractNucleusIIR, scoreIIR } from './algo-iir';
import { extractNucleusAUS, scoreAUS } from './algo-aus';
import { extractNucleusDRA, scoreDRA } from './algo-dra';
import { extractNucleusCRE, scoreCRE } from './algo-cre';
import { detectRhymeSchemeMultiLang } from './rhymeSchemeDetector';
// v4 imports
import { extractNucleus as morphoExtractNucleus } from './morphoNucleus';
import { detectCodeSwitch } from './lidSpanDetector';
import { embeddingScore, blendScores } from './embeddingScorer';
import { applyTonalPenalty } from './toneMatrix';
import {
  extractPositionUnits,
  multiSyllabicTail,
  POSITION_THRESHOLDS,
  type RhymePosition,
  type PositionOptions,
} from './rhymePosition';
import { segmentVerses } from './verseSegmenter';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface BlockAnalysisOptions {
  langs?: LangCode[];
  splitHemistich?: boolean;
  window?: number;
}

export interface RhymeScoreOptions extends PositionOptions {
  /** Enable level-4 embedding blend (async). Default false for sync compat. */
  useEmbedding?: boolean;
  /** Tonal penalty weight override (default 0.25) */
  tonalWeight?: number;
}

// ─── Embedding-eligible families ─────────────────────────────────────────────
// CJK excluded: Han/kana/jamo graphemic proxies are not in PHOIBLE vectors.
const EMBEDDING_FAMILIES = new Set(['TAI', 'VIET', 'YRB', 'KWA']);

// ─── lineSpans builder ───────────────────────────────────────────────────────
/**
 * Derives a per-line LineRhymeSpan array from scheme.pairScores.
 *
 * Strategy: for each line index i, scan all pairScores that involve i and
 * pick the one with the highest score.  Extract charSpanA when i === pair.i,
 * charSpanB when i === pair.j.  The span is relative to the FULL original
 * line string (engine.ts guarantees charSpanA/B are computed via
 * computeCharSpan(lineA/B, rhymeToken) — i.e. absolute offsets in the line).
 *
 * Lines with no rhyming pair (score < threshold, or no pair at all) receive
 * charSpanStart = charSpanEnd = -1 so the UI can skip highlighting safely.
 */
function buildLineSpans(
  lines: Array<{ text: string; lang: LangCode }>,
  scheme: SchemeResult
): LineRhymeSpan[] {
  const n = lines.length;
  // Track best (score, charSpan, surface) seen for each line index
  const best: Array<{
    score: number;
    span: RhymeCharSpan | undefined;
    surface: string;
  }> = Array.from({ length: n }, () => ({ score: -1, span: undefined, surface: '' }));

  for (const { i, j, result } of scheme.pairScores) {
    if (result.score > (best[i]?.score ?? -1)) {
      best[i] = {
        score: result.score,
        span: result.charSpanA,
        surface: result.unitA.surface,
      };
    }
    if (result.score > (best[j]?.score ?? -1)) {
      best[j] = {
        score: result.score,
        span: result.charSpanB,
        surface: result.unitB.surface,
      };
    }
  }

  return best.map((entry, lineIndex) => ({
    lineIndex,
    surface: entry.surface,
    charSpanStart: entry.span?.start ?? -1,
    charSpanEnd:   entry.span?.end   ?? -1,
  }));
}

// ─── analyzeBlock ────────────────────────────────────────────────────────────

export function analyzeBlock(
  block: string,
  lang: LangCode,
  opts: BlockAnalysisOptions = {}
): BlockAnalysisResult {
  const splitHemistich = opts.splitHemistich ?? true;

  const processedBlock = splitHemistich
    ? block.replace(/\s*\/\/\s*|\s+\/\s+/g, '\n')
    : block;

  const { lines: rawLines } = segmentVerses(processedBlock);

  const langsArr = Array.isArray(opts.langs) ? opts.langs : [];

  const lineItems = rawLines.map((vLine, i) => {
    const explicitLang = langsArr.length > i ? langsArr[i] : undefined;
    return {
      text: vLine.text,
      lang: (explicitLang && explicitLang.trim() !== '') ? explicitLang : lang,
    };
  });

  const scheme = detectRhymeSchemeMultiLang(lineItems, opts.window ?? 6);
  const lineSpans = buildLineSpans(lineItems, scheme);

  // Collect code-switching warnings from pairScores
  const csWarnings = scheme.warnings.filter(w => w.includes('lid-cs-hint'));

  return {
    lines: lineItems.map(l => l.text),
    lineLangs: lineItems.map(l => l.lang),
    lineSpans,
    scheme,
    csWarnings,
  };
}

// ─── Algorithm Registry ───────────────────────────────────────────────────────
type NucleusExtractor = (unit: RhymeResult['unitA'], lang: LangCode, lowResource: boolean) => RhymeNucleus;
type NucleusScorer = (nA: RhymeNucleus, nB: RhymeNucleus, langA: LangCode, langB: LangCode) => number;

interface AlgoRegistry {
  extract: NucleusExtractor;
  score: NucleusScorer;
}

const ALGO_REGISTRY: Partial<Record<string, AlgoRegistry>> = {
  KWA:  { extract: (u) => extractNucleusKWA(u), score: (nA, nB) => scoreKWANormalized(nA, nB) },
  CRV:  { extract: (u, _, lowRes) => extractNucleusCRV(u, lowRes, _), score: (nA, nB, lA) => scoreCRV(nA, nB, lA) },
  ROM:  {
    extract: (u, l) => {
      // Strip rhymeToken augmentation before returning plain RhymeNucleus
      const { rhymeToken: _rt, ...nucleus } = extractNucleusROM(u, l);
      void _rt;
      return nucleus;
    },
    score: (nA, nB, lA) => scoreROM(nA, nB, lA, phonemeEditDistance),
  },
  GER:  { extract: (u, l) => extractNucleusGER(u, l), score: (nA, nB) => scoreGER(nA, nB) },
  YRB:  { extract: (u) => extractNucleusYRB(u), score: (nA, nB) => scoreYRB(nA as YRBNucleus, nB as YRBNucleus) },
  SLV:  { extract: (u, l) => extractNucleusSLV(u, l), score: (nA, nB) => scoreSLV(nA, nB) },
  SEM:  { extract: (u, l) => extractNucleusSEM(u, l), score: (nA, nB) => scoreSEM(nA, nB) },
  TAI:  { extract: (u, l) => extractNucleusTAI(u, l), score: (nA, nB) => scoreTAI(nA, nB) },
  VIET: { extract: (u, l) => extractNucleusVIET(u, l), score: (nA, nB) => scoreVIET(nA, nB) },
  CJK:  { extract: (u, l) => extractNucleusCJK(u, l), score: (nA, nB) => scoreCJK(nA, nB) },
  TRK:  { extract: (u, l) => extractNucleusTRK(u, l), score: (nA, nB) => scoreTRK(nA as TRKNucleus, nB as TRKNucleus) },
  FIN:  { extract: (u, l) => extractNucleusFIN(u, l), score: (nA, nB) => scoreFIN(nA as FINNucleus, nB as FINNucleus) },
  IIR:  { extract: (u, l) => extractNucleusIIR(u, l), score: (nA, nB) => scoreIIR(nA, nB) },
  AUS:  { extract: (u, l) => extractNucleusAUS(u, l), score: (nA, nB) => scoreAUS(nA, nB) },
  DRA:  { extract: (u, l) => extractNucleusDRA(u, l), score: (nA, nB) => scoreDRA(nA, nB) },
  CRE:  { extract: (u, l) => extractNucleusCRE(u, l), score: (nA, nB) => scoreCRE(nA, nB) },
  BNT:  {
    extract: (u, l) => {
      const stem = morphoExtractNucleus(u.surface, 'BNT').stem;
      const mUnit = extractLineEndingUnit(stem, l);
      return extractNucleusBNT(mUnit, l);
    },
    score: (nA, nB, lA) => scoreBNT(nA, nB, lA),
  }
};

// ─── charSpan helper ─────────────────────────────────────────────────────────
/**
 * Locate `token` inside `line` (NFC-normalised, from the right) and return
 * the character span.  Returns undefined when not found.
 */
function computeCharSpan(line: string, token: string): RhymeCharSpan | undefined {
  if (!token) return undefined;
  const normLine  = line.normalize('NFC');
  const normToken = token.normalize('NFC');
  const idx = normLine.lastIndexOf(normToken);
  if (idx === -1) return undefined;
  return { start: idx, end: idx + normToken.length };
}

/**
 * Refine a word-level span to the exact nucleus suffix inside that word.
 *
 * `tokenSpan`  — absolute position of the rhyme token in the full line
 *                (from computeCharSpan).
 * `nucleus`    — nucleus extracted by the algo; charSpanStart/End are offsets
 *                relative to the token string (set by extractNucleusData).
 *
 * Returns the nucleus span in line-absolute coordinates, or `tokenSpan` when
 * nucleus offsets are absent/invalid (non-ROM families, fallback path).
 */
function refineSpanWithNucleus(
  tokenSpan: RhymeCharSpan,
  nucleus: RhymeNucleus
): RhymeCharSpan {
  const nsStart = nucleus.charSpanStart ?? -1;
  const nsEnd   = nucleus.charSpanEnd   ?? -1;
  if (nsStart < 0 || nsEnd <= nsStart) return tokenSpan;
  return {
    start: tokenSpan.start + nsStart,
    end:   tokenSpan.start + nsEnd,
  };
}

// ─── Core pairwise scorer ─────────────────────────────────────────────────────
export function rhymeScore(
  lineA: string,
  lineB: string,
  langA: LangCode,
  langB: LangCode,
  opts: RhymeScoreOptions = {}
): RhymeResult {
  const warnings: string[] = [];
  const position: RhymePosition = opts.position ?? 'end';
  const multiSyl = opts.multiSyllabic ?? 1;

  // ── Step 0: LID — assistive only ─────────────────────────────────────────
  const csA = detectCodeSwitch(lineA, langA);
  const csB = detectCodeSwitch(lineB, langB);

  const isUnspecified = (l: LangCode | undefined): boolean => {
    if (!l) return true;
    const s = String(l).toLowerCase();
    return s === 'auto' || s === 'und' || s === 'unknown' || s === '' || s === '__unknown__';
  };

  const resolvedLangA: LangCode = isUnspecified(langA)
    ? ((csA?.detectedLang as LangCode) ?? langA)
    : langA;
  const resolvedLangB: LangCode = isUnspecified(langB)
    ? ((csB?.detectedLang as LangCode) ?? langB)
    : langB;

  if (csA?.detectedLang && csA.detectedLang !== langA) {
    warnings.push(`lid-cs-hint:${langA}->${csA.detectedLang}`);
  }
  if (csB?.detectedLang && csB.detectedLang !== langB) {
    warnings.push(`lid-cs-hint:${langB}->${csB.detectedLang}`);
  }

  const csDetected =
    (!!csA?.detectedLang && csA.detectedLang !== langA) ||
    (!!csB?.detectedLang && csB.detectedLang !== langB);

  // ── Step 1: Extract position unit ────────────────────────────────────────
  const unitsA = extractPositionUnits(lineA, opts);
  const unitsB = extractPositionUnits(lineB, opts);

  let bestUnitA: string;
  let bestUnitB: string;
  if (unitsA.length === 1 && unitsB.length === 1) {
    bestUnitA = unitsA[0]!;
    bestUnitB = unitsB[0]!;
  } else {
    let bestSim = -1;
    bestUnitA = unitsA[0]!;
    bestUnitB = unitsB[0]!;
    for (const ua of unitsA) {
      for (const ub of unitsB) {
        const na = normalizeInput(ua).toLowerCase();
        const nb = normalizeInput(ub).toLowerCase();
        const sim = 1 - phonemeEditDistance(na.slice(-5), nb.slice(-5));
        if (sim > bestSim) { bestSim = sim; bestUnitA = ua; bestUnitB = ub; }
      }
    }
  }

  const surfaceA = multiSyl > 1 ? multiSyllabicTail(bestUnitA, multiSyl) : bestUnitA;
  const surfaceB = multiSyl > 1 ? multiSyllabicTail(bestUnitB, multiSyl) : bestUnitB;

  const unitA = extractLineEndingUnit(surfaceA, resolvedLangA);
  const unitB = extractLineEndingUnit(surfaceB, resolvedLangB);

  warnings.push(...unitA.warnings.map(w => `A:${w}`));
  warnings.push(...unitB.warnings.map(w => `B:${w}`));

  const { family, lowResource } = routeToFamily(resolvedLangA);
  const familyB = routeToFamily(resolvedLangB).family;

  // ── Step 2: Cross-family fallback ────────────────────────────────────────
  if (family !== familyB) {
    warnings.push('cross-family-fallback');
    const nucleusA = extractBestNucleus(unitA, family, resolvedLangA, lowResource);
    const nucleusB = extractBestNucleus(unitB, familyB, resolvedLangB, routeToFamily(resolvedLangB).lowResource);
    const tailA = normalizeInput(unitA.surface).slice(-4).toLowerCase();
    const tailB = normalizeInput(unitB.surface).slice(-4).toLowerCase();
    const scoreRaw = 1 - phonemeEditDistance(tailA, tailB);
    // Route through build() so charSpanA/B are computed (from unit.surface) —
    // returning a raw object here left them undefined, silently desyncing the UI.
    return build({
      score: scoreRaw,
      family: 'FALLBACK',
      langA: resolvedLangA,
      langB: resolvedLangB,
      unitA,
      unitB,
      nucleusA,
      nucleusB,
      lowResourceFallback: true,
      warnings,
      position,
      csDetected,
      lineA,
      lineB,
    });
  }

  // ── Step 3: Family scoring ────────────────────────────────────────────────
  let baseScore = 0;
  let nucleusA: RhymeNucleus;
  let nucleusB: RhymeNucleus;
  let rhymeTokenA: string | undefined;
  let rhymeTokenB: string | undefined;

  const handler = ALGO_REGISTRY[family];
  if (handler) {
    nucleusA = handler.extract(unitA, resolvedLangA, lowResource);
    nucleusB = handler.extract(unitB, resolvedLangB, routeToFamily(resolvedLangB).lowResource);
    baseScore = handler.score(nucleusA, nucleusB, resolvedLangA, resolvedLangB);

    // ROM exposes the exact rhyming token (last word of the unit) so build()
    // can compute a precise charSpan. Extraction itself runs once via the
    // registry above; lastRhymingToken is a cheap re-derivation of just the
    // token (no second extractNucleusROM call).
    if (family === 'ROM') {
      rhymeTokenA = lastRhymingToken(unitA.surface);
      rhymeTokenB = lastRhymingToken(unitB.surface);
    }

    if (family === 'CRV' && lowResource) warnings.push('low-resource-fallback');
    if (family === 'CJK') warnings.push('cjk-graphemic-proxy');
  } else {
    // FALLBACK GRAPHEMIC
    const tailA = normalizeInput(unitA.surface).slice(-4).toLowerCase();
    const tailB = normalizeInput(unitB.surface).slice(-4).toLowerCase();
    baseScore = 1 - phonemeEditDistance(tailA, tailB);
    const dN: RhymeNucleus = { vowels: '', coda: '', tone: '', onset: '', moraCount: 1 };
    nucleusA = dN; nucleusB = dN;
    warnings.push('fallback-graphemic');
  }

  // ── Step 4: Tonal penalty ─────────────────────────────────────────────────
  if (nucleusA!.tone && nucleusB!.tone) {
    baseScore = applyTonalPenalty(
      baseScore, family as FamilyId, resolvedLangA,
      nucleusA!.tone, nucleusB!.tone,
      opts.tonalWeight ?? 0.25
    );
  }

  // ── Step 5: Embedding blend (sync path — embedding deferred) ─────────────
  if (opts.useEmbedding && EMBEDDING_FAMILIES.has(family)) {
    warnings.push('embedding-deferred:use-rhymeScoreAsync');
  }

  // ── Step 6: Position threshold annotation ────────────────────────────────
  const threshold = POSITION_THRESHOLDS[position];
  if (baseScore < threshold) warnings.push(`below-threshold:${position}:${threshold}`);

  const score = Math.max(0, Math.min(1, baseScore));
  return build({
    score,
    family,
    langA: resolvedLangA,
    langB: resolvedLangB,
    unitA,
    unitB,
    nucleusA: nucleusA!,
    nucleusB: nucleusB!,
    lowResourceFallback: lowResource,
    warnings,
    position,
    csDetected,
    lineA,
    lineB,
    ...(rhymeTokenA !== undefined ? { rhymeTokenA } : {}),
    ...(rhymeTokenB !== undefined ? { rhymeTokenB } : {}),
  });
}

/**
 * Async variant — runs full level-4 embedding blend for eligible families.
 */
export async function rhymeScoreAsync(
  lineA: string,
  lineB: string,
  langA: LangCode,
  langB: LangCode,
  opts: RhymeScoreOptions = {}
): Promise<RhymeResult> {
  const syncResult = rhymeScore(lineA, lineB, langA, langB, { ...opts, useEmbedding: false });
  const { family } = routeToFamily(syncResult.langA);

  if (!EMBEDDING_FAMILIES.has(family)) return syncResult;

  const phonesA = syncResult.nucleusA.vowels.split('').concat(syncResult.nucleusA.coda.split(''));
  const phonesB = syncResult.nucleusB.vowels.split('').concat(syncResult.nucleusB.coda.split(''));

  // `family` here is a `FamilyId` (router-side type), but `embeddingScore`
  // accepts `LangFamily` (morphoNucleus-side type). The two enums overlap
  // (KWA/TAI/...) but are not structurally identical; the union of both is
  // safe here because the embedding backend short-circuits to a phonetic
  // fallback for unknown families. Use a named alias rather than an inline
  // `Parameters<…>` cast so renaming embeddingScore stays explicit.
  type EmbeddingFamily = Parameters<typeof embeddingScore>[2];
  const embResult = await embeddingScore(
    phonesA,
    phonesB,
    family as unknown as EmbeddingFamily,
    syncResult.langA,
  );
  const blended = blendScores(syncResult.score, embResult.score, 0.4);
  const warnings = [...syncResult.warnings, `embedding:${embResult.backend}`];

  return {
    ...syncResult,
    score: Math.max(0, Math.min(1, blended)),
    category: categorize(blended),
    warnings,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractBestNucleus(
  unit: RhymeResult['unitA'],
  family: RhymeResult['family'],
  lang: LangCode,
  lowResource: boolean
): RhymeNucleus {
  const handler = ALGO_REGISTRY[family];
  if (handler) return handler.extract(unit, lang, lowResource);
  return { vowels: '', coda: '', tone: '', onset: '', moraCount: 1 };
}

interface BuildOptions {
  score: number;
  family: RhymeResult['family'];
  langA: LangCode;
  langB: LangCode;
  unitA: RhymeResult['unitA'];
  unitB: RhymeResult['unitB'];
  nucleusA: RhymeNucleus;
  nucleusB: RhymeNucleus;
  lowResourceFallback: boolean;
  warnings: string[];
  position?: RhymeResult['position'];
  csDetected?: boolean;
  lineA?: string;
  lineB?: string;
  rhymeTokenA?: string;
  rhymeTokenB?: string;
}

function build({
  score,
  family,
  langA,
  langB,
  unitA,
  unitB,
  nucleusA,
  nucleusB,
  lowResourceFallback,
  warnings,
  position,
  csDetected,
  lineA,
  lineB,
  rhymeTokenA,
  rhymeTokenB,
}: BuildOptions): RhymeResult {
  const result: RhymeResult = {
    score: Math.max(0, Math.min(1, score)),
    category: categorize(score),
    family, langA, langB, unitA, unitB, nucleusA, nucleusB, lowResourceFallback, warnings,
  };
  if (position   !== undefined) result.position   = position;
  if (csDetected !== undefined) result.csDetected = csDetected;

  // ── charSpan computation ─────────────────────────────────────────────────
  // Step 1: locate the rhyme token in the full line (word-level span).
  // Step 2: refine to the nucleus suffix within that token using
  //         nucleus.charSpanStart/End (vowel-onset offsets set by
  //         extractNucleusData / algo-rom normalizeFR).
  // This ensures the UI highlights the exact rhyming suffix (esse, isse,
  // ace…) rather than the full word, fixing the missing-colour regression
  // on monoryme sections (FR lines 12, 22, etc.).
  if (lineA) {
    const tokenA = rhymeTokenA ?? unitA.surface;
    const rawSpanA = computeCharSpan(lineA, tokenA);
    if (rawSpanA) {
      result.charSpanA = refineSpanWithNucleus(rawSpanA, nucleusA);
    }
  }
  if (lineB) {
    const tokenB = rhymeTokenB ?? unitB.surface;
    const rawSpanB = computeCharSpan(lineB, tokenB);
    if (rawSpanB) {
      result.charSpanB = refineSpanWithNucleus(rawSpanB, nucleusB);
    }
  }

  return result;
}
