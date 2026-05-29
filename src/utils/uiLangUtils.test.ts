import { describe, expect, it } from 'vitest';
import { resolveUiLanguageName } from './uiLangUtils';

describe('resolveUiLanguageName', () => {
  it('resolves canonical ui: langIds', () => {
    expect(resolveUiLanguageName('ui:fr')).toBe('French');
    expect(resolveUiLanguageName('ui:es')).toBe('Spanish');
  });

  it('resolves locale-style language codes', () => {
    expect(resolveUiLanguageName('fr-FR')).toBe('French');
    expect(resolveUiLanguageName('pt_BR')).toBe('Portuguese');
  });

  it('falls back to English for unknown values', () => {
    expect(resolveUiLanguageName('ui:xx')).toBe('English');
    expect(resolveUiLanguageName('')).toBe('English');
  });
});
