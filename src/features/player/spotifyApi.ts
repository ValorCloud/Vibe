import type { SpotifyTokenProvider } from '../../types/spotify';

/**
 * Shared helpers for Spotify Web API REST calls.
 *
 * Two responsibilities the previous code lacked:
 *
 *  1) **401 recovery** — When Spotify rejects a cached access token (server-side
 *     revocation, refresh-token rotation race, clock skew, scope change), the
 *     first call simply throws and the user is stuck. `spotifyFetch` retries
 *     once with a force-refreshed token before giving up. This is the standard
 *     Spotify SDK pattern and fixes the recurring 401 on `/playlists/{id}/tracks`
 *     even though the Web Playback SDK is happily connected with the same
 *     credentials.
 *
 *  2) **Rich error messages** — Spotify error responses are JSON of shape
 *     `{ error: { status, message } }`. Surfacing `error.message` turns an
 *     opaque "Spotify API 400" into actionable info ("invalid id", "malformed
 *     query", etc.) for both users and the dev console.
 */

export interface SpotifyFetchOptions<T = unknown> {
  signal?: AbortSignal;
  /** Defaults to GET. */
  method?: string;
  /** JSON-serializable body for PUT/POST. */
  body?: unknown;
  /** Optional JSON response parser/validator (e.g., Zod). */
  parse?: (payload: unknown) => T;
}

/**
 * Custom error carrying the HTTP status so callers can branch on it
 * (e.g. logout on persistent 401).
 */
export class SpotifyApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'SpotifyApiError';
    this.status = status;
  }
}

async function extractErrorMessage(res: Response): Promise<string> {
  // Spotify returns `{ error: { status, message } }` for most failures.
  // Falls back to statusText then a generic label so we never lose context.
  try {
    const data = await res.clone().json() as { error?: { message?: string } };
    const msg = data?.error?.message;
    if (msg && typeof msg === 'string') return msg;
  } catch {
    // not JSON — fall through
  }
  try {
    const text = await res.text();
    if (text) return text.slice(0, 200);
  } catch {
    // ignore
  }
  return res.statusText || 'request failed';
}

const forceRefreshInFlight = new WeakMap<SpotifyTokenProvider, Promise<string | null>>();

function forceRefreshTokenOnce(tokens: SpotifyTokenProvider): Promise<string | null> {
  const existing = forceRefreshInFlight.get(tokens);
  if (existing) return existing;
  const pending = tokens
    .forceRefreshToken()
    .finally(() => {
      forceRefreshInFlight.delete(tokens);
    });
  forceRefreshInFlight.set(tokens, pending);
  return pending;
}

/**
 * Performs a Spotify Web API call with one automatic 401 retry after a
 * forced token refresh. Throws `SpotifyApiError` on non-2xx responses.
 */
export async function spotifyFetch<T>(
  url: string,
  tokens: SpotifyTokenProvider,
  options: SpotifyFetchOptions<T> = {},
): Promise<T> {
  const { signal, method = 'GET', body, parse } = options;

  const doOne = async (token: string): Promise<Response> => {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const init: RequestInit = { method, headers };
    if (signal) init.signal = signal;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return fetch(url, init);
  };

  let token = await tokens.getValidToken();
  if (!token) throw new SpotifyApiError(401, 'Spotify token unavailable');

  let res = await doOne(token);

  // 401 → cached token rejected; force a refresh and retry exactly once.
  if (res.status === 401) {
    const refreshed = await forceRefreshTokenOnce(tokens);
    if (!refreshed) {
      const msg = await extractErrorMessage(res);
      throw new SpotifyApiError(401, msg);
    }
    token = refreshed;
    res = await doOne(token);
  }

  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new SpotifyApiError(res.status, msg);
  }

  // 204 No Content (e.g. PUT /me/player/play) — caller decides what to do.
  if (res.status === 204) return undefined as unknown as T;
  const payload: unknown = await res.json();
  return parse ? parse(payload) : (payload as T);
}
