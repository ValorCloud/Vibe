/**
 * _aiProvider.ts
 * Resolves the active AI provider and exposes a unified generateContent()
 * interface consumed by generate.ts.
 *
 * The provider is resolved from (highest priority first):
 *   1. A per-request runtime override (user-supplied provider + API key,
 *      forwarded by the client via x-ai-provider / x-ai-key headers).
 *   2. The AI_PROVIDER environment variable.
 *   3. Default: gemini.
 *
 * Supported providers:
 *   gemini     — Google Gemini via @google/genai  (default)
 *   openai     — OpenAI Chat Completions REST API
 *   anthropic  — Anthropic Messages REST API
 *
 * Per-provider env vars (server-configured keys):
 *   GEMINI_API_KEY      — required for gemini
 *   OPENAI_API_KEY      — required for openai
 *   ANTHROPIC_API_KEY   — required for anthropic
 *
 * AI_MODEL overrides the default model for the active provider.
 */

export type ProviderName = 'gemini' | 'openai' | 'anthropic';

export interface ProviderInfo {
  provider: ProviderName;
  model: string;
  available: boolean;
}

export interface GenerateParams {
  model: string;
  contents: string;
  config?: Record<string, unknown>;
  abortSignal?: AbortSignal;
}

/** Per-request runtime override (user-supplied provider and/or API key). */
export interface ProviderOverride {
  provider?: ProviderName;
  apiKey?: string;
}

const TIMEOUT_MS = 55_000;

// ─── Per-provider defaults ────────────────────────────────────────────────────

export const PROVIDER_DEFAULTS: Record<ProviderName, { model: string; keyEnv: string; prefixes: string[] }> = {
  gemini:    { model: 'gemini-2.5-flash', keyEnv: 'GEMINI_API_KEY',    prefixes: ['gemini-'] },
  openai:    { model: 'gpt-4o-mini',      keyEnv: 'OPENAI_API_KEY',    prefixes: ['gpt-', 'o1-', 'o3-', 'chatgpt-'] },
  anthropic: { model: 'claude-3-5-haiku-20241022', keyEnv: 'ANTHROPIC_API_KEY', prefixes: ['claude-'] },
};

/** Parses an arbitrary value into a supported ProviderName, or undefined. */
export function parseProviderName(raw: unknown): ProviderName | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.toLowerCase().trim();
  return v === 'gemini' || v === 'openai' || v === 'anthropic' ? v : undefined;
}

function resolveProvider(override?: ProviderName): ProviderName {
  if (override) return override;
  return parseProviderName(process.env.AI_PROVIDER) ?? 'gemini';
}

export function getProviderInfo(override?: ProviderOverride): ProviderInfo {
  const provider = resolveProvider(override?.provider);
  const defaults = PROVIDER_DEFAULTS[provider];
  const model = override?.provider
    ? defaults.model
    : (process.env.AI_MODEL || defaults.model);
  const available = Boolean(override?.apiKey) || Boolean(process.env[defaults.keyEnv]);
  return { provider, model, available };
}

export function getAllowedModelPrefixes(override?: ProviderName): string[] {
  return PROVIDER_DEFAULTS[resolveProvider(override)].prefixes;
}

// ─── Allowed SDK config keys (shared across providers) ───────────────────────

export const ALLOWED_CONFIG_KEYS = new Set([
  'temperature', 'topP', 'topK', 'maxOutputTokens', 'stopSequences',
  'candidateCount', 'presencePenalty', 'frequencyPenalty', 'seed',
  'responseMimeType',
  'responseSchema', // required for Gemini structured JSON output
] as const);

// ─── Shared timeout helper ────────────────────────────────────────────────────

function timeoutSignal(external?: AbortSignal): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  external?.addEventListener('abort', () => controller.abort(), { once: true });
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

// ─── Provider-specific generate implementations ──────────────────────────────

async function generateGemini(apiKey: string, params: GenerateParams): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai') as typeof import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const { signal, cancel } = timeoutSignal(params.abortSignal);
  let response;
  try {
    response = await ai.models.generateContent({
      model: params.model,
      contents: params.contents,
      config: { ...(params.config ?? {}), abortSignal: signal },
    });
  } finally {
    cancel();
  }
  if (signal.aborted) throw Object.assign(new DOMException('Aborted', 'AbortError'));
  return response.text ?? '';
}

/** Extracts an error message from a non-OK provider REST response. */
async function restError(response: Response, provider: string): Promise<Error> {
  let detail = '';
  try {
    const body = await response.json() as { error?: { message?: string } };
    if (typeof body?.error?.message === 'string') detail = body.error.message;
  } catch { /* not JSON */ }
  const err = new Error(detail || `${provider} request failed (${response.status})`) as Error & { status?: number };
  err.status = response.status;
  return err;
}

async function generateOpenAI(apiKey: string, params: GenerateParams): Promise<string> {
  const { signal, cancel } = timeoutSignal(params.abortSignal);
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: params.model,
        messages: [{ role: 'user', content: params.contents }],
        ...(typeof params.config?.temperature === 'number' && { temperature: params.config.temperature }),
        ...(typeof params.config?.maxOutputTokens === 'number' && { max_completion_tokens: params.config.maxOutputTokens }),
        ...(params.config?.responseMimeType === 'application/json' && { response_format: { type: 'json_object' } }),
      }),
      signal,
    });
  } finally {
    cancel();
  }
  if (!response.ok) throw await restError(response, 'OpenAI');
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

async function generateAnthropic(apiKey: string, params: GenerateParams): Promise<string> {
  const { signal, cancel } = timeoutSignal(params.abortSignal);
  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: (params.config?.maxOutputTokens as number | undefined) ?? 4096,
        messages: [{ role: 'user', content: params.contents }],
        ...(typeof params.config?.temperature === 'number' && { temperature: params.config.temperature }),
      }),
      signal,
    });
  } finally {
    cancel();
  }
  if (!response.ok) throw await restError(response, 'Anthropic');
  const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  const block = data.content?.[0];
  return block?.type === 'text' ? (block.text ?? '') : '';
}

// ─── Public generate entry point ─────────────────────────────────────────────

export async function providerGenerate(params: GenerateParams, override?: ProviderOverride): Promise<string> {
  const provider = resolveProvider(override?.provider);
  const defaults = PROVIDER_DEFAULTS[provider];
  const apiKey = override?.apiKey || process.env[defaults.keyEnv];
  if (!apiKey) throw new Error(`${defaults.keyEnv} is not configured on the server.`);

  switch (provider) {
    case 'gemini':    return generateGemini(apiKey, params);
    case 'openai':    return generateOpenAI(apiKey, params);
    case 'anthropic': return generateAnthropic(apiKey, params);
  }
}
