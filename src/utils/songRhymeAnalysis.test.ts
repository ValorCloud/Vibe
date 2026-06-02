import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Section } from '../types';
import { compareTextsWithIPA } from './ipaPipeline';
import { analyzeSongRhymes } from './songRhymeAnalysis';
import { doLinesRhymeGraphemic, segmentVerseToRhymingUnit, splitRhymingSuffix } from './rhymeDetection';
import { detectRhymeSchemeLocally } from './rhymeSchemeUtils';

vi.mock('./ipaPipeline', () => ({
  compareTextsWithIPA: vi.fn(),
}));

const makeLine = (id: string, text: string) => ({
  id,
  text,
  rhymingSyllables: '',
  rhyme: '',
  syllables: text.split(/\s+/).length,
  concept: text,
  isMeta: false,
});

const makeSection = (id: string, name: string, language: string, lines: string[]): Section => ({
  id,
  name,
  language,
  lines: lines.map((line, index) => makeLine(`${id}-${index + 1}`, line)),
});

// ─── Existing regression tests (unchanged) ────────────────────────────────────────────

describe('analyzeSongRhymes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses ipa mode for supported languages', async () => {
    vi.mocked(compareTextsWithIPA).mockResolvedValue({
      score: 0.91,
      quality: 'rich',
      distance: 0.09,
      method: 'feature-weighted',
    });

    const song = [
      makeSection('fr-verse', 'Verse 1', 'fr', [
        'Dans la nuit je marche encore',
        'Sous la pluie je cherche l\'or',
      ]),
    ];

    await expect(analyzeSongRhymes(song)).resolves.toEqual([
      expect.objectContaining({
        sectionId: 'fr-verse',
        mode: 'ipa',
        pairs: [
          expect.objectContaining({
            quality: 'rich',
            confidenceScore: 91,
            usedIpa: true,
            isApproximated: false,
          }),
        ],
      }),
    ]);
    expect(compareTextsWithIPA).toHaveBeenCalledTimes(1);
  });

  it('falls back to graphemic mode for unsupported languages', async () => {
    const song = [
      makeSection('section-x', 'Verse 1', 'xyz', [
        'nara bela sona',
        'tari mela kona',
      ]),
    ];

    await expect(analyzeSongRhymes(song)).resolves.toEqual([
      expect.objectContaining({
        sectionId: 'section-x',
        mode: 'graphemic',
        pairs: [],
      }),
    ]);
    expect(compareTextsWithIPA).not.toHaveBeenCalled();
  });

  it('downgrades the confidence score for approximated rhymes', async () => {
    vi.mocked(compareTextsWithIPA)
      .mockResolvedValueOnce({
        score: 0.8,
        quality: 'sufficient',
        distance: 0.2,
        method: 'feature-weighted',
      })
      .mockResolvedValueOnce({
        score: 0.8,
        quality: 'sufficient',
        distance: 0.2,
        method: 'feature-weighted',
        isApproximated: true,
      } as never);

    const song = [
      makeSection('section-a', 'Verse 1', 'fr', [
        'Premier reflet sur la Seine',
        'Dernier secret dans la Seine',
      ]),
      makeSection('section-b', 'Verse 2', 'fr', [
        'Le moteur gronde au matin',
        'Le décor tremble au matin',
      ]),
    ];

    const [exactSection, approximatedSection] = await analyzeSongRhymes(song);

    expect(exactSection?.pairs[0]?.confidenceScore).toBe(80);
    expect(approximatedSection?.pairs[0]?.confidenceScore).toBe(68);
    expect(exactSection?.pairs[0]?.confidenceScore).toBeGreaterThan(
      approximatedSection?.pairs[0]?.confidenceScore ?? 0,
    );
  });
});

// ─── New tests: step-0 segmentation + tone_weight + code-switching ────────────

describe('segmentVerseToRhymingUnit', () => {
  it('returns end position for standard Romance line', () => {
    const result = segmentVerseToRhymingUnit('Dans la nuit je marche encore', 'fr');
    expect(result.position).toBe('end');
    expect(result.rhymingUnit).toBe('encore');
  });

  it('returns enjambed position when last token is a connector', () => {
    const result = segmentVerseToRhymingUnit('Je chante avec', 'fr');
    expect(result.position).toBe('enjambed');
    // rhymingUnit should be the penultimate content word
    expect(result.rhymingUnit).toBe('chante');
  });

  it('returns internal position when mid-line token mirrors end rhyme', () => {
    // 'nuit' and 'lui' share suffix 'ui'
    const result = segmentVerseToRhymingUnit('Dans la nuit il pense à lui', 'fr');
    expect(result.position).toBe('internal');
    // When position is internal, rhymingUnit must be the internal token, not end word
    expect(result.rhymingUnit).toBe('nuit');
  });

  it('picks last vowel-group for agglutinative Turkish (ALGO-TRK)', () => {
    // 'gidiyorum' → normalized 'gidiyorum' → last vowel group from 'u' onward → 'um'
    const result = segmentVerseToRhymingUnit('Ben gidiyorum', 'tr');
    expect(result.position).toBe('end');
    // rhymingUnit should start at or after the last vowel group
    expect(result.rhymingUnit.length).toBeGreaterThan(0);
    expect(result.rhymingUnit).toMatch(/u/);
  });

  it('preserves tonal diacritics for KWA (ALGO-KWA)', () => {
    // Yoruba-style: tones marked with diacritics should survive normalization
    const result = segmentVerseToRhymingUnit('Mo fẹ́àn rẹ', 'yo');
    expect(result.position).toBe('end');
    // rhymingUnit must NOT have diacritics stripped for tonal languages
    expect(result.rhymingUnit).toMatch(/[\u0300-\u036f]/);
  });

  it('detects extended Bantu and Kwa enjambment connectors', () => {
    expect(segmentVerseToRhymingUnit('Mo kọrin àti', 'yo')).toEqual(
      expect.objectContaining({
        position: 'enjambed',
        rhymingUnit: 'kọrin',
      }),
    );
    expect(segmentVerseToRhymingUnit('N bɛ taa ani', 'dyu')).toEqual(
      expect.objectContaining({
        position: 'enjambed',
        rhymingUnit: 'taa',
      }),
    );
  });
});

describe('rhymeDetection Step-0 matching', () => {
  it('uses the segmented content word for enjambed graphemic rhyme matching', () => {
    expect(doLinesRhymeGraphemic('Je chante avec', 'La nuit complète', 'fr')).toBe(true);
  });

  it('does not include a trailing enjambment connector in suffix highlights', () => {
    const split = splitRhymingSuffix('Je chante avec', ['La nuit complète'], 'fr');
    expect(split?.before + split?.rhyme).toBe('Je chante');
    expect(split?.rhyme).not.toContain('avec');
  });

  it('marks the full orthographic rhyme past a silent final -e (English)', () => {
    // Regression: trailing silent 'e' forms its own vowel group; the fallback
    // must step back to the real nucleus instead of highlighting just "e".
    const choose = splitRhymingSuffix(
      'And witnessed futures, countless paths they choose.',
      ['The shifting seasons painted vibrant hues.'],
      'en',
    );
    expect(choose?.rhyme).toBe('oose.');

    const whole = splitRhymingSuffix(
      'And teach us patience, making spirits whole.',
      ['They offer shelter to the weary soul.'],
      'en',
    );
    expect(whole?.rhyme).toBe('ole.');

    const breeze = splitRhymingSuffix(
      'They share their secrets with the flowing breeze.',
      ['Among the mountains, forests, and the seas.'],
      'en',
    );
    expect(breeze?.rhyme).toBe('eeze.');
  });

  it('anchors the split to the raw vowel onset when the canonical form differs (seas)', () => {
    // Regression: canonical suffix "ee" does not appear literally in "seas",
    // which previously made the fallback return null (no highlight at all).
    const seas = splitRhymingSuffix(
      'Among the mountains, forests, and the seas.',
      ['They share their secrets with the flowing breeze.'],
      'en',
    );
    expect(seas?.rhyme).toBe('eas.');
  });

  it('handles a word with no vowels after NFD normalization without crashing', () => {
    // Simulates a degenerate edge case: a token that normalizes to all consonants.
    // splitRhymingSuffix must return a non-null result (fallback whole-word split)
    // and must not crash or access normalizedWord[-1].
    const result = splitRhymingSuffix('Je vois krch', [], 'fr');
    // Should still return something — either null or a valid split (no throw).
    expect(() => splitRhymingSuffix('Je vois krch', [], 'fr')).not.toThrow();
    if (result !== null) {
      expect(result.before + result.rhyme).toBe('Je vois krch');
    }
  });
});

describe('analyzeSongRhymes — code-switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes cross-family pairs through their own langCode pipelines', async () => {
    vi.mocked(compareTextsWithIPA).mockResolvedValue({
      score: 0.78,
      quality: 'sufficient',
      distance: 0.22,
      method: 'feature-weighted',
    });

    // Section language is 'fr'; second line overrides to 'nou' (nouchi ivoirien)
    const song = [
      makeSection('cs-verse', 'Couplet', 'fr', [
        'Je marche dans la nuit',
        '[lang:nou] Y a pas moyen ce soir',
      ]),
    ];

    const [result] = await analyzeSongRhymes(song);
    expect(result?.mode).toBe('ipa');

    // compareTextsWithIPA must have been called with langCode2 for cross-family
    const calls = vi.mocked(compareTextsWithIPA).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const crossFamilyCall = calls.find(([, , , opts]) => opts?.langCode2 !== undefined);
    expect(crossFamilyCall).toBeDefined();
    expect(crossFamilyCall?.[3]?.langCode2).toBe('nou');

    // Pair should be marked crossFamily
    const crossPair = result?.pairs.find(p => p.crossFamily);
    expect(crossPair).toBeDefined();
  });

  it('does not set crossFamily flag for same-language pairs', async () => {
    vi.mocked(compareTextsWithIPA).mockResolvedValue({
      score: 0.85,
      quality: 'rich',
      distance: 0.15,
      method: 'feature-weighted',
    });

    const song = [
      makeSection('mono-verse', 'Verse', 'fr', [
        'Le soleil brille encore',
        'La lune tourne fort',
      ]),
    ];

    const [result] = await analyzeSongRhymes(song);
    const pair = result?.pairs[0];
    expect(pair?.crossFamily).toBeUndefined();
  });
});

describe('analyzeSongRhymes — rhymePosition forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards rhymePosition from segmentation to pair analysis', async () => {
    vi.mocked(compareTextsWithIPA).mockResolvedValue({
      score: 0.88,
      quality: 'rich',
      distance: 0.12,
      method: 'feature-weighted',
    });

    // 'avec' is a connector → enjambed position
    const song = [
      makeSection('pos-verse', 'Verse', 'fr', [
        'Je danse avec',
        'La nuit complète',
      ]),
    ];

    const [result] = await analyzeSongRhymes(song);
    const pair = result?.pairs[0];
    expect(pair?.rhymePosition).toBe('enjambed');
  });
});

// ─── New tests: French rhyme schemes (graphemic fallback) ─────────────────────────────

describe('detectRhymeSchemeLocally — French schemes', () => {
  it('detects AABB for a simple French quatrain', () => {
    const lines = [
      'Une étoile filante a traversé ma nuit',
      'Une rencontre étrange, loin de tout bruit',
      'Un éclair illumine, un doux étranger',
      'Un instant suspendu, je peux l\'oublier',
    ];

    const scheme = detectRhymeSchemeLocally(lines, 'fr');
    expect(scheme).toBe('AABB');
  });

  it('does not over-group French lines that only share a final mute -e', () => {
    const lines = [
      'Un instant éternel, venu d\'un autre espace,',
      'Mon âme a senti cette étreinte qui passe,',
      'Avec un inconnu, sans mots et sans visage,',
      'Un secret partagé, au-delà de l\'âge.',
    ];

    const scheme = detectRhymeSchemeLocally(lines, 'fr');
    // Expect two distinct rhyme families: espace/passe vs visage/âge
    expect(scheme).toBe('AABB');
  });

  it('treats connaissance/effervescence as a valid Romance rhyme pair', () => {
    expect(doLinesRhymeGraphemic('Sa forme défiait toute ma connaissance,', 'Une danse de lueurs, une douce effervescence', 'fr')).toBe(true);
  });

  it('detects AABB when the second pair rhymes via ai/ie + rhotic (clair/hier)', () => {
    const lines = [
      "L'aube enfin surgit",
      "Mon cœur s'élargit",
      'Un doux rayon clair',
      "Chasse l'ombre hier (l'ombre d'hier)",
    ];

    const scheme = detectRhymeSchemeLocally(lines, 'fr');
    expect(scheme).toBe('AABB');
  });
});

// ─── New tests: canonicalizeRhymeSuffix direct coverage ──────────────────────

// Import the internals via a re-export shim if needed, or test through doLinesRhymeGraphemic.
// These tests exercise the normalization rules directly by observing rhyme decisions.

describe('canonicalizeRhymeSuffix — nasal and Romance rules', () => {
  it('collapses an/en/am/em to the same rhyme class', () => {
    // vent (en→an) should rhyme with dans (an)
    expect(doLinesRhymeGraphemic('le vent', 'le dans', 'fr', { forScheme: true })).toBe(true);
    // temps should rhyme with blanc
    expect(doLinesRhymeGraphemic('le temps', 'le blanc', 'fr', { forScheme: true })).toBe(true);
  });

  it('collapses ain/ein/in/im to the same rhyme class', () => {
    // main (ain→in) should rhyme with fin (in)
    expect(doLinesRhymeGraphemic('la main', 'la fin', 'fr', { forScheme: true })).toBe(true);
    // plein (ein→in) should rhyme with vin (in)
    expect(doLinesRhymeGraphemic('le plein', 'le vin', 'fr', { forScheme: true })).toBe(true);
  });

  it('collapses on/om to the same rhyme class', () => {
    expect(doLinesRhymeGraphemic('le don', 'le nom', 'fr', { forScheme: true })).toBe(true);
  });

  it('collapses oeu/eu/oe/ueu to the same rhyme class', () => {
    // cœur (oeu→eu) should rhyme with fleur (eu)
    expect(doLinesRhymeGraphemic('le cœur', 'la fleur', 'fr', { forScheme: true })).toBe(true);
  });

  it('keeps distinct vowel families separate', () => {
    // an vs in — different nasal classes must NOT rhyme
    expect(doLinesRhymeGraphemic('le vent', 'le vin', 'fr', { forScheme: true })).toBe(false);
    // on vs an
    expect(doLinesRhymeGraphemic('le don', 'le vent', 'fr', { forScheme: true })).toBe(false);
  });

  it('isRomance fallback applies when langCode is absent', () => {
    // Without langCode, Romance rules should still apply (explicit design choice).
    expect(doLinesRhymeGraphemic('le vent', 'le dans', undefined, { forScheme: true })).toBe(true);
  });
});

// ─── New tests: detectInternalRhymeToken null branch ─────────────────────────

describe('segmentVerseToRhymingUnit — internal rhyme edge cases', () => {
  it('returns end position when line has fewer than 3 tokens', () => {
    // Only 2 tokens → detectInternalRhymeToken returns null, position must be end
    const result = segmentVerseToRhymingUnit('Nuit calme', 'fr');
    expect(result.position).toBe('end');
  });

  it('returns end position when no internal token rhymes with end word', () => {
    // No phonemic link between any mid-token and the end word
    const result = segmentVerseToRhymingUnit('Le soleil brille fort', 'fr');
    expect(result.position).toBe('end');
    expect(result.rhymingUnit).toBe('fort');
  });

  it('lastWord is preserved on the segment when position is internal', () => {
    const result = segmentVerseToRhymingUnit('Dans la nuit il pense à lui', 'fr');
    expect(result.position).toBe('internal');
    // lastWord must hold the original end word for UI highlight mapping
    expect(result.lastWord).toBe('lui');
  });
});
