/**
 * normalize.ts — unit tests
 * Covers: normalizeInput, extractLineEndingUnit
 */

import { describe, it, expect } from 'vitest';
import { normalizeInput, extractLineEndingUnit } from './normalize';

// ─── normalizeInput ───────────────────────────────────────────────────────────

describe('normalizeInput', () => {
  it('trims whitespace', () => {
    expect(normalizeInput('  hello  ')).toBe('hello');
  });
  it('NFC normalization — combining diacritics preserved', () => {
    // é = U+00E9 (NFC), or e + U+0301 (NFD); result must be NFC
    const nfd = 'e\u0301';
    expect(normalizeInput(nfd)).toBe('\u00E9');
  });
  it('empty string stays empty', () => {
    expect(normalizeInput('')).toBe('');
  });
  it('Vietnamese tone marks preserved', () => {
    expect(normalizeInput('không')).toBe('không');
  });
});

// ─── extractLineEndingUnit — script detection ─────────────────────────────────

describe('extractLineEndingUnit — script & segmentation', () => {
  it('empty line → empty-line warning', () => {
    const r = extractLineEndingUnit('');
    expect(r.warnings).toContain('empty-line');
    expect(r.surface).toBe('');
  });

  it('Latin line → script: latin', () => {
    const r = extractLineEndingUnit('Le vent souffle', 'fr');
    expect(r.script).toBe('latin');
  });

  it('Arabic line → script: arabic', () => {
    const r = extractLineEndingUnit('القمر في السماء', 'ar');
    expect(r.script).toBe('arabic');
  });

  it('CJK line → script: cjk', () => {
    const r = extractLineEndingUnit('月光如水照缁衣', 'zh');
    expect(r.script).toBe('cjk');
  });

  it('Thai line → script: thai', () => {
    const r = extractLineEndingUnit('แสงจันทร์', 'th');
    expect(r.script).toBe('thai');
  });

  it('Devanagari line → script: devanagari', () => {
    const r = extractLineEndingUnit('आसमान में चाँद', 'hi');
    expect(r.script).toBe('devanagari');
  });
});

// ─── extractLineEndingUnit — surface extraction ───────────────────────────────

describe('extractLineEndingUnit — surface token', () => {
  it('Latin: extracts last word', () => {
    const r = extractLineEndingUnit('Dans la forêt profonde', 'fr');
    expect(r.surface).toBe('profonde');
  });

  it('Latin: strips trailing punctuation', () => {
    const r = extractLineEndingUnit('Le vent souffle fort!', 'fr');
    expect(r.surface).toBe('fort');
  });

  it('Latin: strips trailing comma', () => {
    const r = extractLineEndingUnit('mon cœur, mon âme,', 'fr');
    expect(r.surface).toBe('âme');
  });

  it('CJK: extracts last character (non-punct)', () => {
    const r = extractLineEndingUnit('月光如水照', 'zh');
    expect(r.surface).toBe('照');
  });

  it('Vietnamese (tone-mark mode): preserves tone diacritics', () => {
    const r = extractLineEndingUnit('Trăng sáng vằng vặc', 'vi');
    expect(r.segmentationMode).toBe('tone-mark');
    expect(r.surface).toBe('vặc');
  });

  it('Baoulé (tone-mark mode)', () => {
    const r = extractLineEndingUnit("n'gá so", 'ba');
    expect(r.segmentationMode).toBe('tone-mark');
    expect(r.surface).toBe('so');
  });

  it('Arabic: extracts last RTL token', () => {
    const r = extractLineEndingUnit('القمر في السماء', 'ar');
    expect(r.segmentationMode).toBe('rtl');
    expect(r.surface).toBe('السماء');
  });

  it('single word line returns that word', () => {
    const r = extractLineEndingUnit('soleil', 'fr');
    expect(r.surface).toBe('soleil');
  });
});

// ─── extractLineEndingUnit — segmentation mode resolution ────────────────────

describe('extractLineEndingUnit — segmentationMode', () => {
  it('fr → whitespace', () => {
    expect(extractLineEndingUnit('bonjour', 'fr').segmentationMode).toBe('whitespace');
  });
  it('vi → tone-mark', () => {
    expect(extractLineEndingUnit('xin chào', 'vi').segmentationMode).toBe('tone-mark');
  });
  it('zh → character', () => {
    expect(extractLineEndingUnit('你好', 'zh').segmentationMode).toBe('character');
  });
  it('th → tonal-syllable', () => {
    expect(extractLineEndingUnit('สวัสดี', 'th').segmentationMode).toBe('tonal-syllable');
  });
  it('ar → rtl', () => {
    expect(extractLineEndingUnit('مرحبا', 'ar').segmentationMode).toBe('rtl');
  });
});

// ─── extractLineEndingUnit — annotation stripping (regression) ───────────────
// Parenthetical / bracketed annotations (backing vocals, chorus cues, harmony,
// CJK asides) must be removed BEFORE token extraction so they never pollute the
// rhyme surface. Parametric + multilingual to guard against silent regressions.
describe('extractLineEndingUnit — annotation stripping', () => {
  it.each([
    // line                                           lang   expected surface
    ['Je chante la nuit (backing vocals)',            'fr',  'nuit'],
    ['Walking in the light [chorus]',                 'en',  'light'],
    ['Le ciel est bleu {harmony}',                    'fr',  'bleu'],
    ['Pure parenthese (au milieu) du vers',           'fr',  'vers'],
    ['未来は明るい（コーラス）',                          'ja',  'い'],
    ['우리의 길【반복】',                                'ko',  '길'],
  ])('strips annotation from %s', (line, lang, expected) => {
    expect(extractLineEndingUnit(line, lang).surface).toBe(expected);
  });

  it('returns original token when stripping would empty the line', () => {
    // Whole line is an annotation → fallback keeps content rather than blanking.
    const r = extractLineEndingUnit('(intro only)', 'en');
    expect(r.surface).toBe('only');
  });
});
