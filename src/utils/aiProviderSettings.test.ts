import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAiProviderSettings,
  setAiProviderSettings,
  getActiveAiOverride,
} from './aiProviderSettings';

describe('aiProviderSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns default settings when nothing is stored', () => {
    expect(getAiProviderSettings()).toEqual({ provider: 'default', apiKey: '', keyPersistence: 'local' });
    expect(getActiveAiOverride()).toBeNull();
  });

  it('persists and reads back an alternate provider with a key', () => {
    setAiProviderSettings({ provider: 'openai', apiKey: ' sk-test-123 ' });
    expect(getAiProviderSettings()).toEqual({ provider: 'openai', apiKey: 'sk-test-123', keyPersistence: 'local' });
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

  it('stores the key in sessionStorage when persistence is session', () => {
    setAiProviderSettings({ provider: 'openai', apiKey: 'sk-session', keyPersistence: 'session' });
    expect(sessionStorage.getItem('vibe_ai_api_key')).toBe('sk-session');
    expect(localStorage.getItem('vibe_ai_api_key')).toBeNull();
    expect(getAiProviderSettings()).toEqual({ provider: 'openai', apiKey: 'sk-session', keyPersistence: 'session' });
    expect(getActiveAiOverride()).toEqual({ provider: 'openai', apiKey: 'sk-session' });
  });

  it('moves the key back to localStorage when switching persistence to local', () => {
    setAiProviderSettings({ provider: 'openai', apiKey: 'sk-abc', keyPersistence: 'session' });
    setAiProviderSettings({ provider: 'openai', apiKey: 'sk-abc', keyPersistence: 'local' });
    expect(localStorage.getItem('vibe_ai_api_key')).toBe('sk-abc');
    expect(sessionStorage.getItem('vibe_ai_api_key')).toBeNull();
    expect(getAiProviderSettings().keyPersistence).toBe('local');
  });

  it('clears the key from both storages when reset with an empty key', () => {
    setAiProviderSettings({ provider: 'openai', apiKey: 'sk-abc', keyPersistence: 'session' });
    setAiProviderSettings({ provider: 'default', apiKey: '' });
    expect(localStorage.getItem('vibe_ai_api_key')).toBeNull();
    expect(sessionStorage.getItem('vibe_ai_api_key')).toBeNull();
    expect(getActiveAiOverride()).toBeNull();
  });
});
