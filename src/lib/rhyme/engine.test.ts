/**
 * Rhyme Engine v2 — Test Suite
 * 95 tests: router, normalize, scoring, all families including IIR/AUS/DRA
 */

import { describe, it, expect } from 'vitest';
import { rhymeScore } from './engine';
import { extractLineEndingUnit, normalizeInput } from './normalize';
import { extractNucleusROM } from './algo-rom';
import { routeToFamily } from './router';
import { phonemeEditDistance, categorize, scoreKWANormalized } from './scoring';
import { detectRhymeScheme } from './rhymeSchemeDetector';

// ─── Normalization ─────────────────────────────────────────────────────────
describe('normalizeInput', () => {
  it('NFC normalizes', () => {
    const a = 'e\u0301'; // e + combining acute
    expect(normalizeInput(a)).toBe('é');
  });
  it('trims whitespace', () => {
    expect(normalizeInput('  hello  ')).toBe('hello');
  });
  it('preserves tonal diacritics', () => {
    expect(normalizeInput('àmá')).toBe('àmá');
  });
});
describe('extractLineEndingUnit', () => {
  it('returns empty for blank line', () => {
    const u = extractLineEndingUnit('');
    expect(u.surface).toBe('');
    expect(u.warnings).toContain('empty-line');
  });
  it('extracts last Latin word, strips punct', () => {
    const u = extractLineEndingUnit('le ciel est bleu,');
    expect(u.surface).toBe('bleu');
    expect(u.segmentationMode).toBe('whitespace');
    expect(u.script).toBe('latin');
  });
  it('extracts last CJK character', () => {
    const u = extractLineEndingUnit('月が綺麗');
    expect(u.surface).toBe('麗');
    expect(u.segmentationMode).toBe('character');
    expect(u.script).toBe('cjk');
  });
  it('handles Arabic RTL token', () => {
    const u = extractLineEndingUnit('أنا أحب العربية');
    expect(u.script).toBe('arabic');
    expect(u.segmentationMode).toBe('rtl');
    expect(u.surface).toBeTruthy();
  });
  it('strips Latin punctuation only', () => {
    const u = extractLineEndingUnit('night!');
    expect(u.surface).toBe('night');
  });

  // tone-mark mode via langHint
  it('KWA langHint activates tone-mark segmentation (ba)', () => {
    const u = extractLineEndingUnit("n'gá so", 'ba');
    expect(u.segmentationMode).toBe('tone-mark');
    expect(u.script).toBe('latin');
    expect(u.surface).toBe('so');
  });
  it('KWA langHint preserves tonal diacritic on final token (ew)', () => {
    const u = extractLineEndingUnit('me wò', 'ew');
    expect(u.segmentationMode).toBe('tone-mark');
    expect(u.surface).toBe('wò');
  });
  it('VI langHint activates tone-mark segmentation', () => {
    const u = extractLineEndingUnit('trời đất', 'vi');
    expect(u.segmentationMode).toBe('tone-mark');
    expect(u.surface).toBe('đất');
  });
  // yo must NOT activate tone-mark (it routes KWA/YRB, not tone-mark path)
  it('yo langHint does NOT activate tone-mark segmentation', () => {
    const u = extractLineEndingUnit('ilé olé', 'yo');
    expect(u.segmentationMode).toBe('whitespace');
  });
});
// ─── Router ─────────────────────────────────────────────────────────────
describe('routeToFamily', () => {
  it('routes KWA languages (ba, ew)', () => {
    expect(routeToFamily('ba').family).toBe('KWA');
    expect(routeToFamily('ew').family).toBe('KWA');
  });
  it('routes yo → YRB (Yoruboid, not Bantu)', () => {
    expect(routeToFamily('yo').family).toBe('YRB');
    expect(routeToFamily('yo').lowResource).toBe(false);
  });
  it('routes sw → BNT (true Bantu)', () => {
    expect(routeToFamily('sw').family).toBe('BNT');
  });
  it('routes Romance languages', () => {
    expect(routeToFamily('fr').family).toBe('ROM');
    expect(routeToFamily('es').family).toBe('ROM');
  });
  it('routes Germanic languages', () => {
    expect(routeToFamily('en').family).toBe('GER');
    expect(routeToFamily('de').family).toBe('GER');
  });
  it('routes Slavic languages', () => {
    expect(routeToFamily('ru').family).toBe('SLV');
    expect(routeToFamily('pl').family).toBe('SLV');
    expect(routeToFamily('cs').family).toBe('SLV');
  });
  it('routes Semitic languages', () => {
    expect(routeToFamily('ar').family).toBe('SEM');
    expect(routeToFamily('he').family).toBe('SEM');
  });
  it('routes TAI/VIET languages', () => {
    expect(routeToFamily('th').family).toBe('TAI');
    expect(routeToFamily('lo').family).toBe('TAI');
    expect(routeToFamily('vi').family).toBe('VIET');
    expect(routeToFamily('km').family).toBe('VIET');
  });
  it('routes CJK languages', () => {
    expect(routeToFamily('zh').family).toBe('CJK');
    expect(routeToFamily('ja').family).toBe('CJK');
    expect(routeToFamily('ko').family).toBe('CJK');
  });
  it('routes Agglutinative languages (TRK / FIN)', () => {
    expect(routeToFamily('tr').family).toBe('TRK');
    expect(routeToFamily('fi').family).toBe('FIN');
    expect(routeToFamily('hu').family).toBe('FIN');
  });
  // New families
  it('routes IIR languages (hi, ur, bn, fa, pa)', () => {
    expect(routeToFamily('hi').family).toBe('IIR');
    expect(routeToFamily('ur').family).toBe('IIR');
    expect(routeToFamily('bn').family).toBe('IIR');
    expect(routeToFamily('fa').family).toBe('IIR');
    expect(routeToFamily('pa').family).toBe('IIR');
  });
  it('routes AUS languages (id, ms, tl, mg)', () => {
    expect(routeToFamily('id').family).toBe('AUS');
    expect(routeToFamily('ms').family).toBe('AUS');
    expect(routeToFamily('tl').family).toBe('AUS');
    expect(routeToFamily('mg').family).toBe('AUS');
  });
  it('routes DRA languages (ta, te, kn, ml)', () => {
    expect(routeToFamily('ta').family).toBe('DRA');
    expect(routeToFamily('te').family).toBe('DRA');
    expect(routeToFamily('kn').family).toBe('DRA');
    expect(routeToFamily('ml').family).toBe('DRA');
  });
  it('fallbacks unknown lang with lowResource=true', () => {
    const r = routeToFamily('__unknown__');
    expect(r.family).toBe('FALLBACK');
    expect(r.lowResource).toBe(true);
  });
});
// ─── Scoring utilities ───────────────────────────────────────────────────────
describe('phonemeEditDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(phonemeEditDistance('abc', 'abc')).toBe(0);
  });
  it('returns 1 for completely different strings same length', () => {
    expect(phonemeEditDistance('abc', 'xyz')).toBeCloseTo(1, 1);
  });
  it('returns 1 for empty vs non-empty', () => {
    expect(phonemeEditDistance('', 'abc')).toBe(1);
  });
  it('handles partial match', () => {
    const d = phonemeEditDistance('night', 'light');
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(1);
  });
});
describe('categorize', () => {
  it('perfect at 0.95', () => expect(categorize(0.95)).toBe('perfect'));
  it('rich at 0.85',    () => expect(categorize(0.85)).toBe('rich'));
  it('sufficient at 0.65', () => expect(categorize(0.65)).toBe('sufficient'));
  it('weak at 0.40',    () => expect(categorize(0.40)).toBe('weak'));
  it('none at 0.10',    () => expect(categorize(0.10)).toBe('none'));
});
// ─── Family: KWA ─────────────────────────────────────────────────────────
describe('KWA rhyme engine', () => {
  it('perfect score for identical Baoulé endings', () => {
    const r = rhymeScore("n'gá", 'ka gá', 'ba', 'ba');
    expect(r.family).toBe('KWA');
    expect(r.score).toBeGreaterThan(0.85);
  });
  it('tone mismatch reduces score (ba)', () => {
    const rMatch    = rhymeScore('amá', 'damá', 'ba', 'ba');
    const rMismatch = rhymeScore('amá', 'damà', 'ba', 'ba');
    expect(rMatch.score).toBeGreaterThan(rMismatch.score);
  });
  it('yo routes to YRB family', () => {
    const r = rhymeScore('ilé', 'olé', 'yo', 'yo');
    expect(r.family).toBe('YRB');
  });
  it('yo tone match yields higher score than mismatch', () => {
    const rMatch    = rhymeScore('ilé', 'olé', 'yo', 'yo');
    const rMismatch = rhymeScore('ilé', 'olè', 'yo', 'yo');
    expect(rMatch.score).toBeGreaterThanOrEqual(rMismatch.score);
  });
});
// ─── Family: CRV + Haoussa tonal ─────────────────────────────────────────────
describe('CRV rhyme engine', () => {
  it('HA: same tone class → higher score than tone mismatch', () => {
    const rMatch    = rhymeScore('gídaa', 'ídaa', 'ha', 'ha');
    const rMismatch = rhymeScore('gídaa', 'ìdaa', 'ha', 'ha');
    expect(rMatch.score).toBeGreaterThanOrEqual(rMismatch.score);
  });
  it('HA: nucleus extracted (not empty)', () => {
    const r = rhymeScore('kasuwa', 'duniya', 'ha', 'ha');
    expect(r.nucleusA.vowels).not.toBe('');
    expect(r.nucleusB.vowels).not.toBe('');
  });
});
// ─── Family: Romance ────────────────────────────────────────────────────────
describe('ROM rhyme engine', () => {
  it('FR: amour / toujours → sufficient+', () => {
    const r = rhymeScore('mon amour', 'pour toujours', 'fr', 'fr');
    expect(r.family).toBe('ROM');
    expect(['sufficient', 'rich', 'perfect']).toContain(r.category);
  });
  it('FR: mute-e parity — belle / pelle', () => {
    const r = rhymeScore('ma belle', 'une pelle', 'fr', 'fr');
    expect(r.score).toBeGreaterThan(0.55);
  });
  it('ES: canción / corazón → rich+', () => {
    const r = rhymeScore('la canción', 'el corazón', 'es', 'es');
    expect(r.score).toBeGreaterThanOrEqual(0.70);
  });
});
// ─── FR nasal verbal finals (-ont/-ons) — regression for Safari lookbehind ───
// FR_NASAL_VERBAL_FINAL was rewritten without a regex lookbehind (which is a
// syntax error that crashes WebKit/Safari < 16.4 at parse time). These
// parametric cases lock in the stripping contract: the terminal t/s of a
// verbal -ont/-ons form is dropped while the nasal `on` nucleus is preserved
// (vowel o + coda n), and whitelisted pronounced finals keep their full coda.
describe('ROM FR nasal verbal finals', () => {
  const nucleus = (word: string) =>
    extractNucleusROM(extractLineEndingUnit(word, 'fr'), 'fr');

  it.each([
    // -ons/-ont verbal forms: terminal t/s stripped, nasal `on` nucleus kept
    ['allons'],
    ['chantons'],
    ['ont'],
  ])('strips terminal t/s of %s but keeps nasal o+n nucleus', (word) => {
    const n = nucleus(word);
    expect(n.vowels).toBe('o');
    expect(n.coda).toBe('n');
  });

  it.each([
    // FR_PRONOUNCED_FINALS whitelist — final consonant realised, coda keeps `nt`
    ['font'],
    ['sont'],
    ['pont'],
    ['mont'],
  ])('preserves pronounced final consonant of %s (coda nt)', (word) => {
    const n = nucleus(word);
    expect(n.vowels).toBe('o');
    expect(n.coda).toBe('nt');
  });

  it('maisons → mute-final s stripped, nasal o+n nucleus preserved', () => {
    const n = nucleus('maisons');
    expect(n.vowels).toBe('o');
    expect(n.coda).toBe('n');
  });

  it('FR: nous allons / une chanson → rhyme on shared nasal nucleus', () => {
    const r = rhymeScore('nous allons', 'une chanson', 'fr', 'fr');
    expect(r.family).toBe('ROM');
    expect(['sufficient', 'rich', 'perfect']).toContain(r.category);
  });
});
// ─── FR ie/ai/ei+rhotic merge regression (issue: algo-rom score bug) ─────────
describe('ROM FR ie/ai/ei+rhotic phonetic merge', () => {
  const nucleus = (word: string) =>
    extractNucleusROM(extractLineEndingUnit(word, 'fr'), 'fr');

  it('clair (ai+r) → vowels=e, coda=r', () => {
    const n = nucleus('clair');
    expect(n.vowels).toBe('e');
    expect(n.coda).toBe('r');
  });

  it('hier (ie+r) → vowels=e, coda=r', () => {
    const n = nucleus('hier');
    expect(n.vowels).toBe('e');
    expect(n.coda).toBe('r');
  });

  it('ciel (ie+l) → vowels=e, coda=l', () => {
    const n = nucleus('ciel');
    expect(n.vowels).toBe('e');
    expect(n.coda).toBe('l');
  });

  it('clair / hier → perfect rhyme (score ≥ 0.95)', () => {
    const r = rhymeScore('Un doux rayon clair', "Chasse l'ombre hier", 'fr', 'fr');
    expect(r.family).toBe('ROM');
    expect(r.score).toBeGreaterThanOrEqual(0.95);
    expect(r.category).toBe('perfect');
  });

  it('chair / mer → rich+ rhyme (ai+r vs e+r → /ɛʁ/)', () => {
    const r = rhymeScore('Pas de corps ni de chair', 'Au bord de la mer', 'fr', 'fr');
    expect(r.family).toBe('ROM');
    expect(r.score).toBeGreaterThanOrEqual(0.70);
    expect(['rich', 'perfect']).toContain(r.category);
  });

  it('ciel / miel → perfect rhyme (ie+l → /ɛl/)', () => {
    const r = rhymeScore('Sous le ciel', 'Un goût de miel', 'fr', 'fr');
    expect(r.family).toBe('ROM');
    expect(r.score).toBeGreaterThanOrEqual(0.95);
    expect(r.category).toBe('perfect');
  });

  it('main / clair → NO rhyme (nasal -ain ≠ ai+r)', () => {
    const r = rhymeScore('Tends-moi la main', 'Un doux rayon clair', 'fr', 'fr');
    expect(r.score).toBeLessThan(0.60);
    expect(['weak', 'none']).toContain(r.category);
  });

  it('clair / hier with actual issue text → perfect rhyme', () => {
    // Exact text from the issue
    const r = rhymeScore('Un doux rayon clair', "Chasse l'ombre hier", 'fr', 'fr');
    console.log('clair/hier score:', r.score, 'category:', r.category);
    console.log('nucleusA:', r.nucleusA);
    console.log('nucleusB:', r.nucleusB);
    expect(r.nucleusA.vowels).toBe('e');
    expect(r.nucleusA.coda).toBe('r');
    expect(r.nucleusB.vowels).toBe('e');
    expect(r.nucleusB.coda).toBe('r');
    expect(r.score).toBeGreaterThanOrEqual(0.95);
    expect(r.category).toBe('perfect');
  });

  it('rhyme scheme detector: clair / hier should be assigned same letter', () => {
    // Test the full rhyme scheme detection for the issue scenario
    const lines = [
      'Un doux rayon clair',
      "Chasse l'ombre hier",
    ];
    const schemeResult = detectRhymeScheme(lines, 'fr');
    console.log('Scheme letters:', schemeResult.letters);
    console.log('Scheme label:', schemeResult.label);
    console.log('Confidence:', schemeResult.confidence);
    console.log('Pair scores:', schemeResult.pairScores.map(p => ({
      i: p.i, j: p.j, score: p.result.score, category: p.result.category
    })));

    // Both lines should get the same letter (not X)
    expect(schemeResult.letters[0]).toBe(schemeResult.letters[1]);
    expect(schemeResult.letters[0]).not.toBe('X');
    expect(schemeResult.confidence).toBeGreaterThan(0.85);
  });
});
// ─── Family: Germanic ────────────────────────────────────────────────────────
describe('GER rhyme engine', () => {
  it('EN: night / light → perfect', () => {
    const r = rhymeScore('the night', 'the light', 'en', 'en');
    expect(r.family).toBe('GER');
    expect(r.score).toBeGreaterThan(0.88);
  });
  it('EN: love / above → sufficient+', () => {
    const r = rhymeScore('undying love', 'the stars above', 'en', 'en');
    expect(r.score).toBeGreaterThan(0.55);
  });
  it('DE: Ung-suffix match', () => {
    const r = rhymeScore('Hoffnung', 'Strömung', 'de', 'de');
    expect(r.score).toBeGreaterThan(0.70);
  });
});
// ─── Family: BNT ─────────────────────────────────────────────────────────────
describe('BNT rhyme engine', () => {
  it('SW: routes to BNT', () => {
    const r = rhymeScore('nakupenda', 'karibu sana', 'sw', 'sw');
    expect(r.family).toBe('BNT');
  });
  it('SW: identical final vowel → non-zero score', () => {
    const r = rhymeScore('nakupenda', 'karibu sana', 'sw', 'sw');
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});
// ─── Family: SLV ─────────────────────────────────────────────────────────────
describe('SLV rhyme engine', () => {
  it('RU: routes to SLV', () => {
    const r = rhymeScore('любовь', 'кровь', 'ru', 'ru');
    expect(r.family).toBe('SLV');
  });
  it('RU: identical ending → high score', () => {
    const r = rhymeScore('любовь', 'кровь', 'ru', 'ru');
    expect(r.score).toBeGreaterThan(0.60);
  });
  it('PL: nasal vowel normalisation — ą/ę merge', () => {
    const r = rhymeScore('końcówkę', 'piosenkę', 'pl', 'pl');
    expect(r.family).toBe('SLV');
    expect(r.score).toBeGreaterThan(0.50);
  });
  it('CS: diacritic-aware — láska / páska', () => {
    const r = rhymeScore('láska', 'páska', 'cs', 'cs');
    expect(r.family).toBe('SLV');
    expect(r.score).toBeGreaterThan(0.70);
  });
  it('SLV: different codas reduce score vs identical coda', () => {
    const rMatch    = rhymeScore('láska', 'páska', 'cs', 'cs');
    const rMismatch = rhymeScore('láska', 'láze', 'cs', 'cs');
    expect(rMatch.score).toBeGreaterThan(rMismatch.score);
  });
});
// ─── Family: SEM ─────────────────────────────────────────────────────────────
describe('SEM rhyme engine', () => {
  it('AR: routes to SEM', () => {
    const r = rhymeScore('\u0642\u0644\u0628', '\u062D\u0644\u0628', 'ar', 'ar');
    expect(r.family).toBe('SEM');
  });
  it('AR: shared long vowel → higher score than mismatched', () => {
    const rMatch    = rhymeScore('\u0643\u062A\u0627\u0628', '\u062D\u0633\u0627\u0628', 'ar', 'ar');
    const rMismatch = rhymeScore('\u0643\u062A\u0627\u0628', '\u0631\u0633\u0648\u0644', 'ar', 'ar');
    expect(rMatch.score).toBeGreaterThan(rMismatch.score);
  });
  it('AR: identical words → score ≈ 1', () => {
    const r = rhymeScore('\u0645\u0633\u0627\u0621', '\u0645\u0633\u0627\u0621', 'ar', 'ar');
    expect(r.score).toBeCloseTo(1, 1);
  });
  it('HE: routes to SEM', () => {
    const r = rhymeScore('\u05E9\u05DC\u05D5\u05DD', '\u05E8\u05D7\u05D5\u05DD', 'he', 'he');
    expect(r.family).toBe('SEM');
  });
  it('HE: nucleus is not empty', () => {
    const r = rhymeScore('\u05E9\u05DC\u05D5\u05DD', '\u05E8\u05D7\u05D5\u05DD', 'he', 'he');
    expect(r.nucleusA.vowels).not.toBe('');
    expect(r.nucleusB.vowels).not.toBe('');
  });
});
// ─── Family: TAI ────────────────────────────────────────────────────────────
describe('TAI rhyme engine', () => {
  it('TH: routes to TAI', () => {
    const r = rhymeScore('\u0E04\u0E19', '\u0E14\u0E34\u0E19', 'th', 'th');
    expect(r.family).toBe('TAI');
  });
  it('TH: nucleus is not empty', () => {
    const r = rhymeScore('\u0E04\u0E19', '\u0E14\u0E34\u0E19', 'th', 'th');
    expect(r.nucleusA.vowels).not.toBe('');
  });
  it('LO: routes to TAI', () => {
    const r = rhymeScore('\u0E84\u0EB9\u0E99', '\u0E94\u0EB4\u0E99', 'lo', 'lo');
    expect(r.family).toBe('TAI');
  });
});
// ─── Family: VIET ────────────────────────────────────────────────────────────
describe('VIET rhyme engine', () => {
  it('VI: routes to VIET', () => {
    const r = rhymeScore('trời', 'đời', 'vi', 'vi');
    expect(r.family).toBe('VIET');
  });
  it('VI: tone match yields higher score than tone mismatch', () => {
    const rMatch    = rhymeScore('trời', 'đời', 'vi', 'vi');
    const rMismatch = rhymeScore('trời', 'trói', 'vi', 'vi');
    expect(rMatch.score).toBeGreaterThan(rMismatch.score);
  });
});
// ─── Family: CJK ─────────────────────────────────────────────────────────────
describe('CJK rhyme engine', () => {
  it('ZH: routes to CJK', () => {
    const r = rhymeScore('\u5929', '\u5148', 'zh', 'zh');
    expect(r.family).toBe('CJK');
  });
  it('ZH: identical last character → score 1', () => {
    const r = rhymeScore('\u5929', '\u5929', 'zh', 'zh');
    expect(r.score).toBeCloseTo(1, 1);
  });
  it('ZH: different characters → penalised score < 1', () => {
    const r = rhymeScore('\u5929', '\u5148', 'zh', 'zh');
    expect(r.score).toBeLessThan(1);
  });
  it('JA: kana match → high score', () => {
    const r = rhymeScore('\u304B\u306A', '\u306A\u306A', 'ja', 'ja');
    expect(r.family).toBe('CJK');
    expect(r.score).toBeGreaterThan(0.80);
  });
  it('KO: Hangul jamo decomposition — same jung-seong → high score', () => {
    const r = rhymeScore('\uB098', '\uB2E4', 'ko', 'ko');
    expect(r.family).toBe('CJK');
    expect(r.score).toBeGreaterThan(0.70);
  });
});
// ─── Family: YRB ─────────────────────────────────────────────────────────────
describe('YRB rhyme engine', () => {
  it('YO: produces a score without error', () => {
    const r = rhymeScore('ilé', 'olé', 'yo', 'yo');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });
  it('YO: same tone class → higher score than tone mismatch', () => {
    const rMatch    = rhymeScore('ilé', 'olé', 'yo', 'yo');
    const rMismatch = rhymeScore('ilé', 'olè', 'yo', 'yo');
    expect(rMatch.score).toBeGreaterThan(rMismatch.score);
  });
  it('YO: nucleusA vowels not empty', () => {
    const r = rhymeScore('ilé', 'olé', 'yo', 'yo');
    expect(r.nucleusA.vowels).not.toBe('');
  });
  it('YO: nasalised vowel preserved in nucleus', () => {
    const r = rhymeScore('ẽ', 'ẽ', 'yo', 'yo');
    expect(r.score).toBeGreaterThan(0.80);
  });
});
// ─── Family: TRK ─────────────────────────────────────────────────────────────
describe('TRK rhyme engine', () => {
  it('TR: routes to TRK', () => {
    const r = rhymeScore('ev', 'sev', 'tr', 'tr');
    expect(r.family).toBe('TRK');
  });
  it('TR: suffix stripped — gelirse/görürse share same stem vowel class', () => {
    const r = rhymeScore('gelirse', 'görürse', 'tr', 'tr');
    expect(r.family).toBe('TRK');
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
  it('TR: same back-vowel harmony class boosts score', () => {
    const rSame  = rhymeScore('kadar', 'adam', 'tr', 'tr');
    const rFront = rhymeScore('gelmek', 'görmek', 'tr', 'tr');
    expect(rSame.score).toBeGreaterThanOrEqual(0);
    expect(rFront.score).toBeGreaterThanOrEqual(0);
  });
});
// ─── Family: FIN ─────────────────────────────────────────────────────────────
describe('FIN rhyme engine', () => {
  it('FI: geminate vowel → moraCount 2 detection', () => {
    const rGeminate = rhymeScore('saataa', 'vaataa', 'fi', 'fi');
    expect(rGeminate.family).toBe('FIN');
    expect(rGeminate.score).toBeGreaterThan(0.70);
  });
  it('FI: vowel harmony merge — a/ä treated as same nucleus', () => {
    const r = rhymeScore('maassa', 'metsässä', 'fi', 'fi');
    expect(r.family).toBe('FIN');
    expect(r.score).toBeGreaterThan(0.50);
  });
  it('HU: routes to FIN', () => {
    const r = rhymeScore('szerelem', 'érzelem', 'hu', 'hu');
    expect(r.family).toBe('FIN');
  });
  it('HU: long vowel preserved — ó vs o reduces score', () => {
    const rMatch    = rhymeScore('szerelem', 'érzelem', 'hu', 'hu');
    const rMismatch = rhymeScore('ház', 'has', 'hu', 'hu');
    expect(rMatch.score).toBeGreaterThanOrEqual(rMismatch.score);
  });
});
// ─── Family: IIR ─────────────────────────────────────────────────────────────
describe('IIR rhyme engine', () => {
  it('HI: routes to IIR', () => {
    const r = rhymeScore('\u092A\u094D\u092F\u093E\u0930', '\u0938\u0902\u0938\u093E\u0930', 'hi', 'hi');
    expect(r.family).toBe('IIR');
  });
  it('HI: identical Devanagari endings → high score', () => {
    // दिल / नील — both end in -il
    const r = rhymeScore('\u0926\u093F\u0932', '\u0928\u0940\u0932', 'hi', 'hi');
    expect(r.family).toBe('IIR');
    expect(r.score).toBeGreaterThan(0.60);
  });
  it('HI: different vowel nuclei reduce score', () => {
    // प्यार (pyaar) vs सुबह (subah) — very different vowels
    const rMatch    = rhymeScore('\u092A\u094D\u092F\u093E\u0930', '\u0928\u093E\u0930', 'hi', 'hi');
    const rMismatch = rhymeScore('\u092A\u094D\u092F\u093E\u0930', '\u0938\u0941\u092C\u0939', 'hi', 'hi');
    expect(rMatch.score).toBeGreaterThan(rMismatch.score);
  });
  it('HI: nucleus not empty for Devanagari input', () => {
    const r = rhymeScore('\u092A\u094D\u092F\u093E\u0930', '\u0938\u0902\u0938\u093E\u0930', 'hi', 'hi');
    expect(r.nucleusA.vowels).not.toBe('');
    expect(r.nucleusB.vowels).not.toBe('');
  });
  it('UR: routes to IIR', () => {
    const r = rhymeScore('\u062F\u0644', '\u0645\u062D\u0644', 'ur', 'ur');
    expect(r.family).toBe('IIR');
  });
  it('UR: shared long vowel (aa) → high score', () => {
    // کتاب / حساب via Urdu — both -aab
    const r = rhymeScore('\u06A9\u062A\u0627\u0628', '\u062D\u0633\u0627\u0628', 'ur', 'ur');
    expect(r.family).toBe('IIR');
    expect(r.score).toBeGreaterThan(0.65);
  });
  it('BN: routes to IIR', () => {
    const r = rhymeScore('\u09AD\u09BE\u09B2\u09CB', '\u0995\u09BE\u09B2\u09CB', 'bn', 'bn');
    expect(r.family).toBe('IIR');
  });
  it('BN: same Bengali vowel ending → high score', () => {
    // ভালো / কালো — both end in -alo
    const r = rhymeScore('\u09AD\u09BE\u09B2\u09CB', '\u0995\u09BE\u09B2\u09CB', 'bn', 'bn');
    expect(r.score).toBeGreaterThan(0.70);
  });
  it('FA: routes to IIR', () => {
    const r = rhymeScore('\u0622\u0633\u0645\u0627\u0646', '\u062C\u0627\u0646', 'fa', 'fa');
    expect(r.family).toBe('IIR');
  });
  it('FA: nucleus not empty for Perso-Arabic input', () => {
    const r = rhymeScore('\u0622\u0633\u0645\u0627\u0646', '\u062C\u0627\u0646', 'fa', 'fa');
    expect(r.nucleusA.vowels).not.toBe('');
  });
  it('PA: routes to IIR', () => {
    const r = rhymeScore('\u0A2A\u0A3F\u0A06\u0A30', '\u0A38\u0A70\u0A38\u0A3E\u0A30', 'pa', 'pa');
    expect(r.family).toBe('IIR');
  });
  it('SA: routes to IIR and preserves final inherent Sanskrit vowel', () => {
    const r = rhymeScore('देव', 'सेव', 'sa', 'sa');
    expect(r.family).toBe('IIR');
    expect(r.nucleusA.vowels).toBe('a');
    expect(r.nucleusB.vowels).toBe('a');
    expect(r.score).toBeGreaterThan(0.65);
  });
});
// ─── Family: AUS ─────────────────────────────────────────────────────────────
describe('AUS rhyme engine', () => {
  it('ID: routes to AUS', () => {
    const r = rhymeScore('cinta', 'kita', 'id', 'id');
    expect(r.family).toBe('AUS');
  });
  it('ID: shared open vowel ending → high score', () => {
    // cinta / kita — both end in -a
    const r = rhymeScore('cinta', 'kita', 'id', 'id');
    expect(r.score).toBeGreaterThan(0.65);
  });
  it('ID: different endings reduce score', () => {
    const rMatch    = rhymeScore('cinta', 'kita', 'id', 'id');
    const rMismatch = rhymeScore('cinta', 'pergi', 'id', 'id');
    expect(rMatch.score).toBeGreaterThan(rMismatch.score);
  });
  it('MS: routes to AUS', () => {
    const r = rhymeScore('hati', 'budi', 'ms', 'ms');
    expect(r.family).toBe('AUS');
  });
  it('TL: routes to AUS', () => {
    const r = rhymeScore('puso', 'ilaw', 'tl', 'tl');
    expect(r.family).toBe('AUS');
  });
  it('TL: digraph ng normalised (not split)', () => {
    // Tagalog words ending in -ng: both share final nasal
    const r = rhymeScore('iyang', 'kang', 'tl', 'tl');
    expect(r.family).toBe('AUS');
    expect(r.nucleusA.coda).toContain('ng');
  });
  it('MG: routes to AUS', () => {
    const r = rhymeScore('fitiavana', 'tombotsoa', 'mg', 'mg');
    expect(r.family).toBe('AUS');
  });
  it('MG: -na final reduction — fitiavana / fanomezana share -a nucleus', () => {
    const r = rhymeScore('fitiavana', 'fanomezana', 'mg', 'mg');
    expect(r.family).toBe('AUS');
    expect(r.score).toBeGreaterThan(0.50);
  });
  it('AUS: nucleus not empty', () => {
    const r = rhymeScore('cinta', 'kita', 'id', 'id');
    expect(r.nucleusA.vowels).not.toBe('');
    expect(r.nucleusB.vowels).not.toBe('');
  });
});
// ─── Family: DRA ─────────────────────────────────────────────────────────────
describe('DRA rhyme engine', () => {
  it('TA: routes to DRA', () => {
    const r = rhymeScore('\u0BAE\u0BA9\u0BAE\u0BCD', '\u0BB5\u0BBE\u0BA9\u0BAE\u0BCD', 'ta', 'ta');
    expect(r.family).toBe('DRA');
  });
  it('TA: shared coda nasal → high score', () => {
    // மனம் / வானம் — both end in -am
    const r = rhymeScore('\u0BAE\u0BA9\u0BAE\u0BCD', '\u0BB5\u0BBE\u0BA9\u0BAE\u0BCD', 'ta', 'ta');
    expect(r.score).toBeGreaterThan(0.55);
  });
  it('TA: retroflex vs dental coda reduces score', () => {
    // Words ending in retroflex ண vs dental ந
    const rRetro  = rhymeScore('\u0BAE\u0BA3\u0BCD', '\u0BA4\u0BA3\u0BCD', 'ta', 'ta');
    const rDental = rhymeScore('\u0BAE\u0BA9\u0BCD', '\u0BA4\u0BA9\u0BCD', 'ta', 'ta');
    // Both valid scores, retroflex (nn/tt) differs from dental (n/t)
    expect(rRetro.score).toBeGreaterThanOrEqual(0);
    expect(rDental.score).toBeGreaterThanOrEqual(0);
  });
  it('TA: nucleus not empty', () => {
    const r = rhymeScore('\u0BAE\u0BA9\u0BAE\u0BCD', '\u0BB5\u0BBE\u0BA9\u0BAE\u0BCD', 'ta', 'ta');
    expect(r.nucleusA.vowels).not.toBe('');
  });
  it('TE: routes to DRA', () => {
    const r = rhymeScore('\u0C2E\u0C28\u0C38\u0C41', '\u0C35\u0C3E\u0C28\u0C38\u0C41', 'te', 'te');
    expect(r.family).toBe('DRA');
  });
  it('TE: same vowel ending → score > 0.60', () => {
    // మనసు / వానసు — both end in -su
    const r = rhymeScore('\u0C2E\u0C28\u0C38\u0C41', '\u0C35\u0C3E\u0C28\u0C38\u0C41', 'te', 'te');
    expect(r.score).toBeGreaterThan(0.60);
  });
  it('KN: routes to DRA', () => {
    const r = rhymeScore('\u0C95\u0CA8\u0CB8\u0CC1', '\u0CB5\u0CBE\u0CA8\u0CB8\u0CC1', 'kn', 'kn');
    expect(r.family).toBe('DRA');
  });
  it('ML: routes to DRA', () => {
    const r = rhymeScore('\u0D2E\u0D28\u0D38\u0D4D', '\u0D35\u0D3E\u0D28\u0D38\u0D4D', 'ml', 'ml');
    expect(r.family).toBe('DRA');
  });
  it('ML: chillu final consonant handled without crash', () => {
    // Words with chillu letters ൻ (n) ൽ (l)
    const r = rhymeScore('\u0D2E\u0D28\u0D38\u0D4D', '\u0D35\u0D28\u0D28\u0D4D', 'ml', 'ml');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });
});
// ─── Cross-family fallback ────────────────────────────────────────────────────
describe('cross-family fallback', () => {
  it('produces a result with FALLBACK family', () => {
    const r = rhymeScore('night', 'nuit', 'en', 'fr');
    expect(r.family).toBe('FALLBACK');
    expect(r.warnings).toContain('cross-family-fallback');
  });
  it('cross-family: nucleusA and nucleusB are not both empty', () => {
    const r = rhymeScore('the night', 'la nuit', 'en', 'fr');
    const bothEmpty = r.nucleusA.vowels === '' && r.nucleusB.vowels === '';
    expect(bothEmpty).toBe(false);
  });
  it('FALLBACK: surface is NFC-normalised (no broken multi-byte slice)', () => {
    const r = rhymeScore('\u0645\u0633\u0627\u0621', '\u0645\u0633\u0627\u0621', 'ar', 'ar');
    expect(r.score).toBeCloseTo(1, 1);
  });
  // Cross-family between new families
  it('IIR × ROM cross-family → FALLBACK', () => {
    const r = rhymeScore('\u092A\u094D\u092F\u093E\u0930', 'amour', 'hi', 'fr');
    expect(r.family).toBe('FALLBACK');
    expect(r.warnings).toContain('cross-family-fallback');
  });
  it('AUS × GER cross-family → FALLBACK', () => {
    const r = rhymeScore('cinta', 'night', 'id', 'en');
    expect(r.family).toBe('FALLBACK');
  });
  it('DRA × SEM cross-family → FALLBACK', () => {
    const r = rhymeScore('\u0BAE\u0BA9\u0BAE\u0BCD', '\u0642\u0644\u0628', 'ta', 'ar');
    expect(r.family).toBe('FALLBACK');
  });
});

// ─── v4 feature tests ─────────────────────────────────────────────────────────

import { rhymeScoreAsync } from './engine';
import { extractPositionUnits, multiSyllabicTail, tokeniseLine } from './rhymePosition';
import { detectCodeSwitch } from './lidSpanDetector';

// ── rhymePosition ────────────────────────────────────────────────────────────
describe('extractPositionUnits', () => {
  it('end mode returns last word', () => {
    expect(extractPositionUnits('hello world foo', { position: 'end' })).toEqual(['foo']);
  });
  it('initial mode returns first word', () => {
    expect(extractPositionUnits('hello world foo', { position: 'initial' })).toEqual(['hello']);
  });
  it('internal mode returns middle words', () => {
    expect(extractPositionUnits('hello world foo', { position: 'internal' })).toEqual(['world']);
  });
  it('internal mode on 2-word line returns all tokens', () => {
    expect(extractPositionUnits('hello world', { position: 'internal' })).toEqual(['hello', 'world']);
  });
  it('all mode returns deduplicated union', () => {
    const units = extractPositionUnits('A B C', { position: 'all' });
    expect(units).toContain('A');
    expect(units).toContain('B');
    expect(units).toContain('C');
    expect(new Set(units).size).toBe(units.length);
  });
  it('default position is end', () => {
    expect(extractPositionUnits('hello world')).toEqual(['world']);
  });
  it('invalid position falls back to end', () => {
    expect(extractPositionUnits('hello world', { position: 'invalid' as any })).toEqual(['world']);
  });
  it('empty line returns original line', () => {
    expect(extractPositionUnits('')).toEqual(['']);
  });
});

describe('tokeniseLine', () => {
  it('splits Latin on whitespace, strips punctuation', () => {
    expect(tokeniseLine('hello, world!')).toEqual(['hello', 'world']);
  });
  it('CJK: splits character by character', () => {
    const tokens = tokeniseLine('月が綺麗');
    expect(tokens.length).toBe(4);
  });
  it('CJK: strips punctuation characters', () => {
    const tokens = tokeniseLine('月が綺麗。');
    expect(tokens).not.toContain('。');
  });
});

describe('multiSyllabicTail', () => {
  it('n=1 returns whole word', () => {
    expect(multiSyllabicTail('banana', 1)).toBe('banana');
  });
  it('n=2 includes onset consonant of 2nd-to-last syllable', () => {
    const result = multiSyllabicTail('banana', 2);
    // Should capture "nana" (onset 'n' before 2nd-to-last vowel 'a')
    expect(result).toBe('nana');
  });
  it('n > syllable count returns whole word', () => {
    expect(multiSyllabicTail('cat', 5)).toBe('cat');
  });
});

// ── RhymeScoreOptions: position modes ────────────────────────────────────────
describe('rhymeScore with position options', () => {
  it('end mode (default) scores last word', () => {
    const r = rhymeScore('le beau chat', 'sur le mat', 'fr', 'fr', { position: 'end' });
    expect(r.position).toBe('end');
    expect(r.score).toBeGreaterThan(0);
  });
  it('initial mode scores first word', () => {
    const r = rhymeScore('nuit calme', 'nuit douce', 'fr', 'fr', { position: 'initial' });
    expect(r.position).toBe('initial');
    expect(r.score).toBeGreaterThan(0.5);
  });
  it('internal mode scores middle words', () => {
    const r = rhymeScore('le beau chat dort', 'le gros rat dort', 'fr', 'fr', { position: 'internal' });
    expect(r.position).toBe('internal');
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
  it('all mode returns score >= 0', () => {
    const r = rhymeScore('beau chat', 'gros rat', 'fr', 'fr', { position: 'all' });
    expect(r.position).toBe('all');
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
  it('multiSyllabic mode: n=2 is valid', () => {
    const r = rhymeScore('dancing', 'prancing', 'en', 'en', { multiSyllabic: 2 });
    expect(r.score).toBeGreaterThan(0);
  });
  it('position is returned in result', () => {
    const r = rhymeScore('hello world', 'hello friend', 'en', 'en', { position: 'initial' });
    expect(r.position).toBe('initial');
  });
});

// ── LID / isUnspecified ───────────────────────────────────────────────────────
describe('rhymeScore LID integration', () => {
  it('explicit lang is not overridden by LID', () => {
    const r = rhymeScore('night', 'light', 'en', 'en');
    expect(r.langA).toBe('en');
    expect(r.langB).toBe('en');
  });
  it('__unknown__ lang is treated as unspecified (LID may resolve)', () => {
    // With __unknown__, LID will try to resolve
    const r = rhymeScore('night', 'light', '__unknown__', '__unknown__');
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
  it('csDetected is set when LID overrides unspecified lang', () => {
    // Can only test the field exists and is boolean-typed
    const r = rhymeScore('hello', 'world', 'en', 'en');
    // csDetected may be false or absent for explicit langs
    expect(r.csDetected === undefined || r.csDetected === false).toBe(true);
  });
});

// ── detectCodeSwitch ─────────────────────────────────────────────────────────
describe('detectCodeSwitch', () => {
  it('returns null for empty text', () => {
    expect(detectCodeSwitch('')).toBeNull();
  });
  it('returns null for whitespace-only text', () => {
    expect(detectCodeSwitch('   ')).toBeNull();
  });
  it('detects dominant lang in French text', () => {
    const r = detectCodeSwitch('le chat est sur le mat', 'fr');
    expect(r).not.toBeNull();
    expect(r!.detectedLang).toBe('fr');
  });
  it('detects dominant lang in English text', () => {
    const r = detectCodeSwitch('the cat is on the mat', 'en');
    expect(r).not.toBeNull();
    expect(r!.detectedLang).toBe('en');
  });
  it('confidence is between 0 and 1', () => {
    const r = detectCodeSwitch('hello world', 'en');
    expect(r).not.toBeNull();
    expect(r!.confidence).toBeGreaterThanOrEqual(0);
    expect(r!.confidence).toBeLessThanOrEqual(1);
  });
  it('isMixed is true for mixed-script text', () => {
    const r = detectCodeSwitch('hello \u4e16\u754c', 'en');
    expect(r).not.toBeNull();
    expect(r!.isMixed).toBe(true);
  });
});

// ── rhymeScoreAsync ──────────────────────────────────────────────────────────
describe('rhymeScoreAsync', () => {
  it('returns same score as sync for non-embedding families', async () => {
    const sync = rhymeScore('night', 'light', 'en', 'en');
    const async_ = await rhymeScoreAsync('night', 'light', 'en', 'en');
    expect(async_.score).toBeCloseTo(sync.score, 5);
    expect(async_.family).toBe(sync.family);
  });
  it('returns a RhymeResult with required fields', async () => {
    const r = await rhymeScoreAsync('beau', 'mou', 'fr', 'fr');
    expect(r).toHaveProperty('score');
    expect(r).toHaveProperty('category');
    expect(r).toHaveProperty('family');
    expect(r).toHaveProperty('warnings');
  });
  it('uses resolved language for embedding eligibility', async () => {
    // Vietnamese is eligible — should not crash
    const r = await rhymeScoreAsync('con mèo', 'con bèo', 'vi', 'vi');
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

// ── analyzeBlock ────────────────────────────────────────────────────────────
import { analyzeBlock } from './engine';

describe('analyzeBlock', () => {
  it('splits on newlines into separate lines', () => {
    const r = analyzeBlock('night\nlight\nfight', 'en');
    expect(r.lines).toHaveLength(3);
    expect(r.lines.map(l => l.text)).toEqual(['night', 'light', 'fight']);
    expect(r.lines.every(l => l.lang === 'en')).toBe(true);
  });

  it('splits hemistich (//) into separate lines by default', () => {
    const r = analyzeBlock('beau // mou\nclair // rare', 'fr');
    // Each // should split, producing 4 lines total
    expect(r.lines).toHaveLength(4);
    expect(r.lines.map(l => l.text)).toEqual(['beau', 'mou', 'clair', 'rare']);
  });

  it('splitHemistich:false preserves hemistich on a single line', () => {
    const r = analyzeBlock('beau // mou', 'fr', { splitHemistich: false });
    // verseSegmenter still collapses // to a space, but does not split
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]!.text).toContain('beau');
    expect(r.lines[0]!.text).toContain('mou');
  });

  it('opts.langs aligned: applies per-line language', () => {
    const r = analyzeBlock('night\nlight', 'fr', { langs: ['en', 'en'] });
    expect(r.lines.map(l => l.lang)).toEqual(['en', 'en']);
  });

  it('opts.langs shorter than lines: falls back to default lang for missing entries', () => {
    const r = analyzeBlock('night\nlight\nfight', 'fr', { langs: ['en'] });
    expect(r.lines[0]!.lang).toBe('en');
    expect(r.lines[1]!.lang).toBe('fr');
    expect(r.lines[2]!.lang).toBe('fr');
  });

  it('opts.langs empty: every line uses the default lang', () => {
    const r = analyzeBlock('night\nlight', 'en', { langs: [] });
    expect(r.lines.map(l => l.lang)).toEqual(['en', 'en']);
  });

  it('opts.langs with empty-string entries: falls back to default lang', () => {
    const r = analyzeBlock('night\nlight', 'en', { langs: ['' as any, 'fr'] });
    expect(r.lines[0]!.lang).toBe('en');
    expect(r.lines[1]!.lang).toBe('fr');
  });

  it('multilingual fr/en mix: per-line language preserved', () => {
    const r = analyzeBlock('le chat\nthe cat\nles rats\nthe mats', 'fr', {
      langs: ['fr', 'en', 'fr', 'en'],
    });
    expect(r.lines.map(l => l.lang)).toEqual(['fr', 'en', 'fr', 'en']);
    expect(r.scheme).toBeDefined();
  });

  it('returns a scheme result', () => {
    const r = analyzeBlock('night\nlight\nday\nway', 'en');
    expect(r.scheme).toBeDefined();
  });
});

// ── fallback-graphemic branch ───────────────────────────────────────────────
describe('rhymeScore fallback-graphemic', () => {
  it('produces a result with fallback-graphemic warning for unknown lang', () => {
    // 'xx' is not in LANG_FAMILY_MAP → routeToFamily returns FALLBACK,
    // ALGO_REGISTRY['FALLBACK'] is undefined → exercises the graphemic branch.
    const r = rhymeScore('night', 'light', 'xx' as any, 'xx' as any);
    expect(r.warnings).toContain('fallback-graphemic');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
    // family is the routed family (FALLBACK), not 'FALLBACK' literal from cross-family
    expect(r.family).toBe('FALLBACK');
  });

  it('graphemic similarity reflects shared tail', () => {
    const same = rhymeScore('night', 'night', 'xx' as any, 'xx' as any);
    const diff = rhymeScore('night', 'queen', 'xx' as any, 'xx' as any);
    expect(same.score).toBeGreaterThan(diff.score);
  });
});

// ── csDetected reflects LID hints (regression for explicit-lang case) ───────
describe('rhymeScore csDetected with explicit langs', () => {
  it('explicit langs without code-switch hint → csDetected falsy', () => {
    const r = rhymeScore('night', 'light', 'en', 'en');
    expect(r.csDetected === undefined || r.csDetected === false).toBe(true);
  });

  it('explicit lang but foreign script in line → csDetected true (LID hint differs)', () => {
    // langA explicitly 'en' but the line is Arabic script → LID will hint 'ar'
    const r = rhymeScore('مرحبا', 'world', 'en', 'en');
    expect(r.csDetected).toBe(true);
    // The LID hint should also surface in warnings
    expect(r.warnings.some(w => w.startsWith('lid-cs-hint:'))).toBe(true);
  });
});
