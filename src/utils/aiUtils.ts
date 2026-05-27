import { withRetry, type RetryOptions } from './withRetry';
import { z } from 'zod';
import { VIBE_EVENTS } from '../constants/vibeEvents';

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

/**
 * Returns human-readable provider name for UI display.
 * Falls back to 'Google Gemini' synchronously until cache is populated.
 */
export function getAiProviderName(): string {
  if (_providerInfoCache) {
    const map: Record<string, string> = {
      gemini: 'Google Gemini',
      openai: 'OpenAI',
      anthropic: 'Anthropic Claude',
    };
    return map[_providerInfoCache.provider] ?? _providerInfoCache.provider;
  }
  return 'Google Gemini';
}

/**
 * Returns the active model name. Falls back synchronously.
 */
export function getAiModelName(): string {
  return _providerInfoCache?.model ?? 'gemini-2.5-flash';
}

/**
 * Returns whether the AI provider is available.
 * Triggers a fetch if the cache is cold; returns false until resolved.
 */
export async function isAiAvailable(): Promise<boolean> {
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
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      if (!result.success) { console.warn('[safeJsonParse] Zod validation failed:', result.error); return fallback; }
      return result.data;
    }
    if (raw === null || (typeof raw !== 'object' && !Array.isArray(raw))) {
      console.warn('[safeJsonParse] Unexpected primitive payload — returning fallback.');
      return fallback;
    }
    return raw as T;
  } catch (e) {
    console.warn('[safeJsonParse] Failed to parse JSON response, using fallback.', e);
    return fallback;
  }
};

export const handleApiError = (error: unknown, defaultMessage: string) => {
  console.error(defaultMessage, error);
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
