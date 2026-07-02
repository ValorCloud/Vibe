import { withRetry, type RetryOptions } from './withRetry';
import { z } from 'zod';
import { VIBE_EVENTS } from '../constants/vibeEvents';
import { logger } from './logger';
import {
  getActiveAiOverride,
  AI_PROVIDER_LABELS,
  AI_PROVIDER_DEFAULT_MODELS,
} from './aiProviderSettings';

const getErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '');
  if (typeof error === 'string') return error;
  return '';
};

const getErrorCode = (error: unknown) => {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown; status?: unknown }).code ?? (error as { status?: unknown }).status;
    return code;
  }
  return undefined;
};

const sanitiseErrorMessage = (msg: string): string =>
  msg.replace(/\bat\s+\S+/g, '').trim().slice(0, 200);

export type GenerateContentParams = {
  model: string;
  contents: string;
  config?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type GenerateContentResponse = { text: string };

/** Zod schema validating the /api/generate proxy response shape. */
const GenerateContentResponseSchema = z.object({ text: z.string() });

/** Zod schema for /api/status response. */
const StatusResponseSchema = z.object({
  available: z.boolean(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

// ─── Runtime provider info (fetched once, cached) ────────────────────────────

interface ProviderInfo {
  available: boolean;
  provider: string;
  model: string;
}

let _providerInfoCache: ProviderInfo | null = null;
let _providerInfoPromise: Promise<ProviderInfo> | null = null;

async function fetchProviderInfo(): Promise<ProviderInfo> {
  if (_providerInfoCache) return _providerInfoCache;
  if (_providerInfoPromise) return _providerInfoPromise;

  _providerInfoPromise = fetch('/api/status')
    .then(r => r.json())
    .then((raw: unknown) => {
      const parsed = StatusResponseSchema.safeParse(raw);
      const info: ProviderInfo = parsed.success
        ? {
            available: parsed.data.available,
            provider: parsed.data.provider ?? 'gemini',
            model: parsed.data.model ?? 'gemini-2.5-flash',
          }
        : { available: false, provider: 'gemini', model: 'gemini-2.5-flash' };
      _providerInfoCache = info;
      return info;
    })
    .catch(() => {
      const fallback: ProviderInfo = { available: false, provider: 'gemini', model: 'gemini-2.5-flash' };
      _providerInfoCache = fallback;
      return fallback;
    });

  return _providerInfoPromise;
}

/** Prefetch at module load (non-blocking). */
void fetchProviderInfo();

/** Model-name prefixes accepted per provider (mirrors api/_aiProvider.ts). */
const PROVIDER_MODEL_PREFIXES: Record<'gemini' | 'openai' | 'anthropic', string[]> = {
  gemini: ['gemini-'],
  openai: ['gpt-', 'o1-', 'o3-', 'chatgpt-'],
  anthropic: ['claude-'],
};

/** Env var holding the server-side key per provider (informational only). */
const PROVIDER_KEY_ENV_VARS: Record<string, string> = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

/**
 * Returns human-readable provider name for UI display.
 * Reflects the user-configured override (Settings → AI Provider) when active,
 * otherwise the server-configured provider.
 * Falls back to 'Google Gemini' synchronously until cache is populated.
 */
export function getAiProviderName(): string {
  const override = getActiveAiOverride();
  if (override) return AI_PROVIDER_LABELS[override.provider];
  if (_providerInfoCache) {
    return AI_PROVIDER_LABELS[_providerInfoCache.provider as keyof typeof AI_PROVIDER_LABELS]
      ?? _providerInfoCache.provider;
  }
  return 'Google Gemini';
}

/**
 * Returns the active model name (override-aware). Falls back synchronously.
 */
export function getAiModelName(): string {
  const override = getActiveAiOverride();
  if (override) return AI_PROVIDER_DEFAULT_MODELS[override.provider];
  return _providerInfoCache?.model ?? 'gemini-2.5-flash';
}

/**
 * Returns a label describing where the active API key comes from,
 * for display in the About dialog.
 */
export function getAiKeySourceLabel(): string {
  const override = getActiveAiOverride();
  if (override) return 'User key (Settings)';
  const provider = _providerInfoCache?.provider ?? 'gemini';
  return PROVIDER_KEY_ENV_VARS[provider] ?? 'GEMINI_API_KEY';
}

/**
 * Returns whether the AI provider is available.
 * A user-configured override (provider + key in Settings) is always
 * considered available; otherwise defers to the server /api/status check.
 */
export async function isAiAvailable(): Promise<boolean> {
  if (getActiveAiOverride()) return true;
  const info = await fetchProviderInfo();
  return info.available;
}

// ─── Legacy exports (backward compat — keep for existing consumers) ──────────

/** @deprecated Use getAiProviderName() */
export const AI_PROVIDER_NAME = 'Google Gemini';
/** @deprecated Use getAiModelName() */
export const AI_MODEL_NAME = 'gemini-2.5-flash';
/** @deprecated */
export const AI_KEY_ENV_VAR = 'GEMINI_API_KEY';

// ─── Core AI call ─────────────────────────────────────────────────────────────

const proxyGenerateContent = async (params: GenerateContentParams): Promise<GenerateContentResponse> => {
  const { signal, ...body } = params;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Forward the user-configured provider/key override (Settings → AI Provider).
  // Callers pass models for the default provider; remap to the override
  // provider's default model when the requested model family doesn't match.
  const override = getActiveAiOverride();
  if (override) {
    headers['x-ai-provider'] = override.provider;
    headers['x-ai-key'] = override.apiKey;
    const prefixes = PROVIDER_MODEL_PREFIXES[override.provider];
    if (!prefixes.some(p => body.model.startsWith(p))) {
      body.model = AI_PROVIDER_DEFAULT_MODELS[override.provider];
    }
  }

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: signal ?? null,
  });
  if (!response.ok) {
    let errMsg = `Server error ${response.status}`;
    try {
      const errBody = await response.json() as { error?: string };
      if (errBody.error) errMsg = errBody.error;
    } catch { /* ignore */ }
    const err = new Error(errMsg) as Error & { code?: number };
    err.code = response.status;
    throw err;
  }
  let raw: unknown;
  try { raw = await response.json(); } catch { throw new Error('Failed to parse server response as JSON'); }
  const parsed = GenerateContentResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Unexpected response shape from /api/generate');
  return parsed.data;
};

export const getAi = () => ({ models: { generateContent: proxyGenerateContent } });

export const generateContentWithRetry = (
  params: GenerateContentParams,
  retryOptions?: RetryOptions,
) => withRetry(() => getAi().models.generateContent(params), retryOptions);

// ─── JSON utils ───────────────────────────────────────────────────────────────

export const safeJsonParse = <T>(
  text: string,
  fallback: T,
  schema?: z.ZodType<T, z.ZodTypeDef, unknown>,
): T => {
  try {
    const raw: unknown = JSON.parse(text);
    if (schema) {
      const result = schema.safeParse(raw);
      if (!result.success) { logger.warn('[safeJsonParse] Zod validation failed:', result.error); return fallback; }
      return result.data;
    }
    if (raw === null || (typeof raw !== 'object' && !Array.isArray(raw))) {
      logger.warn('[safeJsonParse] Unexpected primitive payload — returning fallback.');
      return fallback;
    }
    return raw as T;
  } catch (e) {
    logger.warn('[safeJsonParse] Failed to parse JSON response, using fallback.', e);
    return fallback;
  }
};

export const handleApiError = (error: unknown, defaultMessage: string) => {
  logger.error(defaultMessage, error);
  const errorMessage = getErrorMessage(error);
  const errorCode = getErrorCode(error);
  let message: string;
  if (
    errorCode === 429 || errorCode === 'RESOURCE_EXHAUSTED' ||
    errorMessage.includes('429') || errorMessage.includes('quota')
  ) {
    message = `You've exceeded your current ${getAiProviderName()} API quota. Please verify your plan/billing and API key in your local environment.`;
  } else if (errorMessage.includes('Requested entity was not found')) {
    message = `API key error. Please check your provider API key in your server environment.`;
  } else {
    message = sanitiseErrorMessage(errorMessage) || defaultMessage;
  }
  window.dispatchEvent(new CustomEvent(VIBE_EVENTS.API_ERROR, { detail: { message } }));
};
