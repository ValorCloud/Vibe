/**
 * spotifyPkce — Pure (React-free) building blocks for the Spotify PKCE flow.
 *
 * Extracted from SpotifyAuthContext so the OAuth primitives can be tested and
 * reasoned about in isolation:
 *   - Configuration constants (client id, redirect uri, scopes, storage keys)
 *   - Storage helpers (localStorage + memStore fallback for sandboxed contexts)
 *   - PKCE helpers (verifier/challenge generation)
 *   - Token operations (code exchange + refresh) with Zod payload validation
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPOTIFY_CLIENT_ID_ERROR =
  '[Spotify] VITE_SPOTIFY_CLIENT_ID is not set. ' +
  'Add it to your .env file (see .env.example).';

export const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim() ?? '';
export const isSpotifyConfigured = (): boolean => CLIENT_ID.length > 0;

export function assertSpotifyConfigured(): void {
  if (!isSpotifyConfigured()) {
    throw new Error(SPOTIFY_CLIENT_ID_ERROR);
  }
}

export const REDIRECT_URI = (() => {
  if (typeof window === 'undefined') return '';
  const { protocol, host } = window.location;
  return `${protocol}//${host}`;
})();

export const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

export const TOKEN_KEY    = 'spotify_access_token';
export const REFRESH_KEY  = 'spotify_refresh_token';
export const EXPIRY_KEY   = 'spotify_token_expiry';
export const VERIFIER_KEY = 'spotify_pkce_verifier';
export const STATE_KEY    = 'spotify_pkce_state';
export const TOKEN_EXPIRY_BUFFER_MS = 60_000;

// ---------------------------------------------------------------------------
// Storage helpers (localStorage + memStore fallback)
// ---------------------------------------------------------------------------

const memStore = new Map<string, string>();
export function storeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { memStore.set(key, value); }
}
export function storeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return memStore.get(key) ?? null; }
}
export function storeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { memStore.delete(key); }
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

export function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => charset[v % charset.length]).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  return base64UrlEncode(await sha256(verifier));
}

// ---------------------------------------------------------------------------
// Token operations
// ---------------------------------------------------------------------------

const spotifyTokenBaseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

const spotifyExchangeTokenSchema = spotifyTokenBaseSchema.extend({
  refresh_token: z.string().min(1),
});

const spotifyRefreshTokenSchema = spotifyTokenBaseSchema.extend({
  refresh_token: z.string().min(1).optional(),
});

async function parseTokenResponse<T>(
  res: Response,
  schema: z.ZodSchema<T>,
  label: string,
): Promise<T> {
  const payload: unknown = await res.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`${label} returned an invalid payload`);
  }
  return parsed.data;
}

export async function exchangeCode(code: string, verifier: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  assertSpotifyConfigured();
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status}`);
  return parseTokenResponse(res, spotifyExchangeTokenSchema, 'Spotify token exchange');
}

export async function doRefresh(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  assertSpotifyConfigured();
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`);
  const data = await parseTokenResponse(res, spotifyRefreshTokenSchema, 'Spotify token refresh');
  return data.refresh_token
    ? { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in }
    : { access_token: data.access_token, expires_in: data.expires_in };
}
