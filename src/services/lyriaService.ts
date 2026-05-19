/**
 * lyriaService.ts
 * Client-side Lyria service — talks exclusively to our own Vercel proxy.
 * Zero secrets in the bundle. Zero direct calls to Google GenAI.
 *
 * Proxy endpoints (same-origin):
 *   POST /api/lyria/generate  → starts a clip or full-song generation
 *   GET  /api/lyria/get?id=…  → polls generation status (clip mode only; not used for full)
 *
 * Mode switch (clip / full) is determined by LyriaGenerateParams.mode.
 *
 * Abort support: pass an AbortSignal to generateAndPoll to cancel polling
 * on component unmount.
 */

import type {
  LyriaGenerateParams,
  LyriaClip,
  LyriaKPISnapshot,
} from '../types/lyria';

// ─── KPI store ────────────────────────────────────────────────────────────────
let _kpi: LyriaKPISnapshot = {
  totalRequests: 0,
  successCount: 0,
  errorCount: 0,
  pendingCount: 0,
  lastGenerationMs: null,
  lastError: null,
};

export function getLyriaKPISnapshot(): LyriaKPISnapshot {
  return { ..._kpi };
}

function pending(delta: number): void {
  _kpi = { ..._kpi, pendingCount: Math.max(0, _kpi.pendingCount + delta) };
}

// ─── Internal token header ────────────────────────────────────────────────────
const INTERNAL_TOKEN: string | undefined = import.meta.env.VITE_LYRIA_INTERNAL_TOKEN;

function authHeaders(): Record<string, string> {
  return INTERNAL_TOKEN ? { 'X-Lyria-Token': INTERNAL_TOKEN } : {};
}

// ─── Internal fetch ───────────────────────────────────────────────────────────
async function proxyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  _kpi = { ..._kpi, totalRequests: _kpi.totalRequests + 1 };
  const t0 = performance.now();
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[Lyria] ${res.status}: ${text}`);
    }
    const json = (await res.json()) as T;
    _kpi = {
      ..._kpi,
      successCount: _kpi.successCount + 1,
      lastGenerationMs: Math.round(performance.now() - t0),
      lastError: null,
    };
    return json;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    _kpi = { ..._kpi, errorCount: _kpi.errorCount + 1, lastError: msg };
    throw err;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateClip(params: LyriaGenerateParams, signal?: AbortSignal): Promise<LyriaClip> {
  pending(+1);
  try {
    return await proxyFetch<LyriaClip>('/api/lyria/generate', {
      method: 'POST',
      body: JSON.stringify(params),
      signal: signal ?? null,
    });
  } finally {
    pending(-1);
  }
}

export async function getClipStatus(id: string, signal?: AbortSignal): Promise<LyriaClip> {
  return proxyFetch<LyriaClip>(`/api/lyria/get?id=${encodeURIComponent(id)}`, { signal: signal ?? null });
}

/**
 * Convenience: generate + poll until done or error.
 *
 * For `full` mode, /api/lyria/generate runs synchronously end-to-end and
 * always returns status 'complete' (or 'error'). Polling is skipped entirely.
 *
 * For `clip` mode, polling is used if the initial response is not yet complete.
 *
 * Pass opts.signal (from AbortController) to cancel on component unmount.
 */
export async function generateAndPoll(
  params: LyriaGenerateParams,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<LyriaClip> {
  const defaultTimeout = params.mode === 'clip' ? 120_000 : 360_000;
  const { intervalMs = 3_000, timeoutMs = defaultTimeout, signal } = opts;

  const clip = await generateClip(params, signal);

  // Both modes are synchronous — complete or error immediately.
  // Full mode never polls (GET /api/lyria/get is not implemented for it).
  if (clip.status === 'complete') return clip;
  if (clip.status === 'error') throw new Error(clip.errorMessage ?? '[Lyria] generation failed');
  if (params.mode === 'full') {
    // Should not happen if the server is correct, but guard anyway.
    throw new Error('[Lyria] Full-song generation did not complete synchronously. Check server logs.');
  }

  // Clip mode only: poll until complete
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException('Lyria poll aborted', 'AbortError');
    await new Promise<void>((r, reject) => {
      const t = setTimeout(r, intervalMs);
      signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Lyria poll aborted', 'AbortError')); }, { once: true });
    });
    const updated = await getClipStatus(clip.id, signal);
    if (updated.status === 'complete') return updated;
    if (updated.status === 'error') throw new Error(updated.errorMessage ?? '[Lyria] generation failed');
  }
  throw new Error('[Lyria] generateAndPoll: timeout exceeded');
}
