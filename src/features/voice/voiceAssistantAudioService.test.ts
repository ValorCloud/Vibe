import { describe, it, expect } from 'vitest';
import { uiLocaleToBcp47 } from './voiceAssistantAudioService';

describe('uiLocaleToBcp47', () => {
  it('maps bare UI locale codes to full BCP-47 tags', () => {
    expect(uiLocaleToBcp47('fr')).toBe('fr-FR');
    expect(uiLocaleToBcp47('en')).toBe('en-US');
    expect(uiLocaleToBcp47('pt')).toBe('pt-PT');
    expect(uiLocaleToBcp47('ar')).toBe('ar-SA');
    expect(uiLocaleToBcp47('zh')).toBe('zh-CN');
    expect(uiLocaleToBcp47('ko')).toBe('ko-KR');
  });

  it('strips the ui: namespace prefix', () => {
    expect(uiLocaleToBcp47('ui:fr')).toBe('fr-FR');
    expect(uiLocaleToBcp47('UI:DE')).toBe('de-DE');
  });

  it('respects an explicit region verbatim', () => {
    expect(uiLocaleToBcp47('pt-BR')).toBe('pt-BR');
    expect(uiLocaleToBcp47('ui:en-GB')).toBe('en-GB');
  });

  it('falls back to en-US for empty input and passes through unknown codes', () => {
    expect(uiLocaleToBcp47('')).toBe('en-US');
    expect(uiLocaleToBcp47('xx')).toBe('xx');
  });
});
