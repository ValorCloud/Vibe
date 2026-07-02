import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAiProviderSettings,
  setAiProviderSettings,
  getActiveAiOverride,
} from './aiProviderSettings';

describe('aiProviderSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default settings when nothing is stored', () => {
    expect(getAiProviderSettings()).toEqual({ provider: 'default', apiKey: '' });
    expect(getActiveAiOverride()).toBeNull();
  });

  it('persists and reads back an alternate provider with a key', () => {
    setAiProviderSettings({ provider: 'openai', apiKey: ' sk-test-123 ' });
    expect(getAiProviderSettings()).toEqual({ provider: 'openai', apiKey: 'sk-test-123' });
    expect(getActiveAiOverride()).toEqual({ provider: 'openai', apiKey: 'sk-test-123' });
  });

  it('is not an active override without an API key', () => {
    setAiProviderSettings({ provider: 'anthropic', apiKey: '' });
    expect(getAiProviderSettings().provider).toBe('anthropic');
    expect(getActiveAiOverride()).toBeNull();
  });

  it('clears stored values when reset to default with an empty key', () => {
    setAiProviderSettings({ provider: 'gemini', apiKey: 'my-key' });
    setAiProviderSettings({ provider: 'default', apiKey: '' });
    expect(localStorage.getItem('vibe_ai_provider')).toBeNull();
    expect(localStorage.getItem('vibe_ai_api_key')).toBeNull();
    expect(getActiveAiOverride()).toBeNull();
  });

  it('ignores invalid stored provider values', () => {
    localStorage.setItem('vibe_ai_provider', 'skynet');
    expect(getAiProviderSettings().provider).toBe('default');
  });
});
