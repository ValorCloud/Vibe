/**
 * aiProviderSettings.ts
 *
 * Persisted user-configurable AI provider settings ("Use any AI").
 * When the user selects an alternate provider and supplies an API key,
 * the client forwards them to /api/generate via x-ai-provider / x-ai-key
 * headers so the serverless proxy uses the user's key at runtime instead
 * of the server-configured one.
 *
 * Persistence follows the existing settings pattern (safeStorage keys).
 *
 * Security note: the user's API key is deliberately stored in plain
 * localStorage. It is a user-owned key, scoped to this device and origin,
 * and the Settings UI states this explicitly. Client-side encryption would
 * add no real protection since any decryption key would live in the same
 * origin (accepted CodeQL js/clear-text-storage-of-sensitive-data finding).
 */
import { safeGetItem, safeSetItem, safeRemoveItem } from './safeStorage';

/** 'default' — use the server-configured provider (no override). */
export type AiProviderChoice = 'default' | 'gemini' | 'openai' | 'anthropic';

export interface AiProviderSettings {
  provider: AiProviderChoice;
  apiKey: string;
}

const AI_PROVIDER_KEY = 'vibe_ai_provider';
const AI_API_KEY_KEY = 'vibe_ai_api_key';

export const AI_PROVIDER_CHOICES: readonly AiProviderChoice[] = ['default', 'gemini', 'openai', 'anthropic'] as const;

/** Human-readable provider names shared by Settings and About dialogs. */
export const AI_PROVIDER_LABELS: Record<Exclude<AiProviderChoice, 'default'>, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
};

/** Default model used per provider (mirrors api/_aiProvider.ts PROVIDER_DEFAULTS). */
export const AI_PROVIDER_DEFAULT_MODELS: Record<Exclude<AiProviderChoice, 'default'>, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
};

function parseChoice(raw: string | null): AiProviderChoice {
  return raw === 'gemini' || raw === 'openai' || raw === 'anthropic' ? raw : 'default';
}

/** Reads the persisted AI provider settings. */
export function getAiProviderSettings(): AiProviderSettings {
  return {
    provider: parseChoice(safeGetItem(AI_PROVIDER_KEY)),
    apiKey: safeGetItem(AI_API_KEY_KEY) ?? '',
  };
}

/** Persists the AI provider settings. */
export function setAiProviderSettings(settings: AiProviderSettings): void {
  if (settings.provider === 'default') {
    safeRemoveItem(AI_PROVIDER_KEY);
  } else {
    safeSetItem(AI_PROVIDER_KEY, settings.provider);
  }
  const key = settings.apiKey.trim();
  if (key) {
    safeSetItem(AI_API_KEY_KEY, key);
  } else {
    safeRemoveItem(AI_API_KEY_KEY);
  }
}

/**
 * Returns the active override (provider + key) to forward to /api/generate,
 * or null when the server-configured default provider should be used.
 * An override is only active when an alternate provider AND a key are set.
 */
export function getActiveAiOverride(): { provider: Exclude<AiProviderChoice, 'default'>; apiKey: string } | null {
  const { provider, apiKey } = getAiProviderSettings();
  if (provider === 'default' || !apiKey.trim()) return null;
  return { provider, apiKey: apiKey.trim() };
}
