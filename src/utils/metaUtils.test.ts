import { describe, it, expect } from 'vitest';
import {
  isPureMetaLine,
  isSectionHeader,
  tokenizeMetaInline,
  unwrapBracketToken,
  isEmptyBracketLine,
} from './metaUtils';

describe('isPureMetaLine', () => {
  it('returns true for a single non-header meta token', () => {
    expect(isPureMetaLine('[Rhythmic Upbeat | Alto harmonica riff]')).toBe(true);
    expect(isPureMetaLine('[Guitar solo]')).toBe(true);
    expect(isPureMetaLine('[Epic]')).toBe(true);
  });

  it('returns true for multi-token lines mixing section headers and meta', () => {
    expect(isPureMetaLine('[Intro][Deep dry kicks]')).toBe(true);
    expect(isPureMetaLine('[Pre-Chorus][Soft Women choir answers]')).toBe(true);
    expect(isPureMetaLine('[Chorus][Alto harmonica answers]')).toBe(true);
  });

  it('returns true for pure section-header lines (issue: never as lyrics)', () => {
    // Per the product requirement: nothing inside [] may remain a lyric.
    expect(isPureMetaLine('[Verse 1]')).toBe(true);
    expect(isPureMetaLine('[Chorus]')).toBe(true);
    expect(isPureMetaLine('[hook]')).toBe(true);
    expect(isPureMetaLine('[Bridge]')).toBe(true);
    expect(isPureMetaLine('[verse 1]')).toBe(true);
  });

  it('returns false for plain lyric lines', () => {
    expect(isPureMetaLine('Si ton amour est comme une transaction.')).toBe(false);
    expect(isPureMetaLine('City lights glow')).toBe(false);
    expect(isPureMetaLine('')).toBe(false);
    expect(isPureMetaLine('   ')).toBe(false);
  });

  it('returns false for lines with text outside brackets', () => {
    expect(isPureMetaLine('Hello [Chorus] world')).toBe(false);
    expect(isPureMetaLine('[Verse 1] some lyrics')).toBe(false);
    expect(isPureMetaLine('lyrics [Guitar solo]')).toBe(false);
  });

  it('handles non-ASCII bracket variants', () => {
    expect(isPureMetaLine('【Verse 1】')).toBe(true);
    expect(isPureMetaLine('【Guitar solo】')).toBe(true);
  });
});

describe('isSectionHeader', () => {
  it('recognizes common section header keywords', () => {
    expect(isSectionHeader('Verse 1')).toBe(true);
    expect(isSectionHeader('Chorus')).toBe(true);
    expect(isSectionHeader('hook')).toBe(true);
    expect(isSectionHeader('Bridge')).toBe(true);
    expect(isSectionHeader('Outro')).toBe(true);
  });

  it('rejects non-header content', () => {
    expect(isSectionHeader('Guitar solo')).toBe(false);
    expect(isSectionHeader('Epic')).toBe(false);
    expect(isSectionHeader('Whispered')).toBe(false);
  });
});

describe('unwrapBracketToken', () => {
  it('returns inner content for bracketed lines', () => {
    expect(unwrapBracketToken('[Verse 1]')).toBe('Verse 1');
    expect(unwrapBracketToken('[Guitar solo]')).toBe('Guitar solo');
  });

  it('returns null for plain text', () => {
    expect(unwrapBracketToken('hello')).toBeNull();
  });
});

describe('isEmptyBracketLine', () => {
  it('identifies empty brackets', () => {
    expect(isEmptyBracketLine('[]')).toBe(true);
    expect(isEmptyBracketLine('[ ]')).toBe(true);
  });

  it('rejects non-empty brackets', () => {
    expect(isEmptyBracketLine('[Chorus]')).toBe(false);
  });
});

describe('tokenizeMetaInline', () => {
  it('renders a single non-header meta token', () => {
    expect(tokenizeMetaInline('[Guitar solo]')).toEqual([
      { text: 'Guitar solo', isMeta: true },
    ]);
  });

  it('skips section-header tokens when mixed with non-header meta tokens', () => {
    // Avoid duplicate display of the section name already shown above lyrics.
    expect(tokenizeMetaInline('[Intro][Deep dry kicks]')).toEqual([
      { text: 'Deep dry kicks', isMeta: true },
    ]);
  });

  it('still renders section-header tokens when they are the only content', () => {
    // Otherwise a stray [Verse 1] line would render as an empty/invisible meta
    // line, hiding it from the user. Per the issue, it must be visible and
    // recognized as non-lyric content.
    expect(tokenizeMetaInline('[Verse 1]')).toEqual([
      { text: 'Verse 1', isMeta: true },
    ]);
    expect(tokenizeMetaInline('[Chorus]')).toEqual([
      { text: 'Chorus', isMeta: true },
    ]);
  });

  it('renders multiple header-only tokens together', () => {
    expect(tokenizeMetaInline('[Verse 1][Chorus]')).toEqual([
      { text: 'Verse 1', isMeta: true },
      { text: 'Chorus', isMeta: true },
    ]);
  });

  it('falls back to wrapping plain text without brackets as meta', () => {
    expect(tokenizeMetaInline('whispered ad-lib')).toEqual([
      { text: 'whispered ad-lib', isMeta: true },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(tokenizeMetaInline('')).toEqual([]);
    expect(tokenizeMetaInline('   ')).toEqual([]);
  });
});
