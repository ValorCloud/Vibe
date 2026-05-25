/**
 * SpotifyAuthContext — PKCE OAuth 2.0 pur (sans proxy serveur).
 *
 * Fonctionnalités :
 *   - Redirect + code exchange directs vers accounts.spotify.com
 *   - State CSRF validé côté client
 *   - Refresh proactif via setTimeout (60s avant expiry)
 *   - Mutex refreshPromiseRef : 0 double-refresh concurrent
 *   - Storage : localStorage + memStore fallback (contextes sandboxés)
 *
 * v1.31.0.62 — Re-hydration post-mount :
 *   useState() init est synchrone ; si localStorage est bloqué, memStore
 *   est vide au premier render → status:'idle'. Un effet de re-sync au
 *   montage lit storeGet() après que le callback OAuth a pu peupler
 *   memStore, et flip vers 'authenticated' si un token valide est trouvé.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';
import type { SpotifyAuthState } from '../types/spotify';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const _rawClientId = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim();
if (!_rawClientId) {
  throw new Error(
    '[Spotify] VITE_SPOTIFY_CLIENT_ID is not set. ' +
    'Add it to your .env file (see .env.example).'
  );
}
const CLIENT_ID: string = _rawClientId;

const REDIRECT_URI = (() => {
  if (typeof window === 'undefined') return '';
  const { protocol, host } = window.location;
  return `${protocol}//${host}`;
})();

const SCOPES = [
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

const TOKEN_KEY    = 'spotify_access_token';
const REFRESH_KEY  = 'spotify_refresh_token';
const EXPIRY_KEY   = 'spotify_token_expiry';
const VERIFIER_KEY = 'spotify_pkce_verifier';
const STATE_KEY    = 'spotify_pkce_state';
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

// ---------------------------------------------------------------------------
// Storage helpers (localStorage + memStore fallback)
// ---------------------------------------------------------------------------

const memStore = new Map<string, string>();
function storeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { memStore.set(key, value); }
}
function storeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return memStore.get(key) ?? null; }
}
function storeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { memStore.delete(key); }
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateRandomString(length: number): string {
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

async function generateCodeChallenge(verifier: string): Promise<string> {
  return base64UrlEncode(await sha256(verifier));
}

// ---------------------------------------------------------------------------
// Token operations
// ---------------------------------------------------------------------------

async function exchangeCode(code: string, verifier: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
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

async function doRefresh(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
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

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SpotifyAuthContextValue extends SpotifyAuthState {
  login: () => Promise<void>;
  logout: () => void;
  getValidToken: () => Promise<string | null>;
  forceRefreshToken: () => Promise<string | null>;
}

type SpotifyAuthActionsContextValue = Omit<SpotifyAuthContextValue, keyof SpotifyAuthState>;

const SpotifyAuthContext = createContext<SpotifyAuthContextValue | null>(null);
const SpotifyAuthStateContext = createContext<SpotifyAuthState | null>(null);
const SpotifyAuthActionsContext = createContext<SpotifyAuthActionsContextValue | null>(null);

export function SpotifyAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SpotifyAuthState>(() => {
    const accessToken = storeGet(TOKEN_KEY);
    const expiresAt   = Number(storeGet(EXPIRY_KEY) ?? 0);
    const isValid     = Boolean(accessToken) && Date.now() < expiresAt;
    return {
      status:      isValid ? 'authenticated' : 'idle',
      accessToken: isValid ? accessToken     : null,
      expiresAt:   isValid ? expiresAt        : null,
      error:       null,
    };
  });

  const refreshTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const clearStorage = useCallback(() => {
    storeRemove(TOKEN_KEY);
    storeRemove(REFRESH_KEY);
    storeRemove(EXPIRY_KEY);
  }, []);

  const refreshWithMutex = useCallback(async (refreshToken: string): Promise<string | null> => {
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = doRefresh(refreshToken)
        .then((data) => {
          const newExpiry = Date.now() + data.expires_in * 1000;
          storeSet(TOKEN_KEY, data.access_token);
          if (data.refresh_token) storeSet(REFRESH_KEY, data.refresh_token);
          storeSet(EXPIRY_KEY, String(newExpiry));
          setState({
            status: 'authenticated',
            accessToken: data.access_token,
            expiresAt: newExpiry,
            error: null,
          });
          return data.access_token;
        })
        .catch(() => {
          clearStorage();
          setState({ status: 'error', accessToken: null, expiresAt: null, error: 'Token refresh failed. Please log in again.' });
          return null;
        })
        .finally(() => { refreshPromiseRef.current = null; });
    }

    return refreshPromiseRef.current;
  }, [clearStorage]);

  // ── Re-hydration post-mount ──────────────────────────────────────────────
  // useState() init is synchronous; if localStorage is sandboxed (Vercel
  // preview / iframe), memStore is empty at first render → status:'idle'.
  // The OAuth callback useEffect populates memStore asynchronously. This
  // effect runs once after mount and promotes to 'authenticated' if a valid
  // token is now available — without waiting for a full page reload.
  useEffect(() => {
    if (state.status !== 'idle') return;
    const accessToken = storeGet(TOKEN_KEY);
    const expiresAt   = Number(storeGet(EXPIRY_KEY) ?? 0);
    if (accessToken && Date.now() < expiresAt) {
      setState({ status: 'authenticated', accessToken, expiresAt, error: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── OAuth callback handler ───────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      const params      = new URLSearchParams(window.location.search);
      const code        = params.get('code');
      const stateParam  = params.get('state');
      const errorParam  = params.get('error');

      if (!code && !errorParam) return;

      if (errorParam) {
        setState({ status: 'error', accessToken: null, expiresAt: null, error: `Spotify auth denied: ${errorParam}` });
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      const storedState = storeGet(STATE_KEY);
      const verifier    = storeGet(VERIFIER_KEY);

      if (stateParam !== storedState) {
        setState({ status: 'error', accessToken: null, expiresAt: null, error: 'OAuth state mismatch — possible CSRF.' });
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      if (!verifier || !code) return;

      storeRemove(STATE_KEY);
      storeRemove(VERIFIER_KEY);
      window.history.replaceState({}, '', window.location.pathname);

      try {
        const tokens    = await exchangeCode(code, verifier);
        const expiresAt = Date.now() + tokens.expires_in * 1000;
        storeSet(TOKEN_KEY,   tokens.access_token);
        storeSet(REFRESH_KEY, tokens.refresh_token);
        storeSet(EXPIRY_KEY,  String(expiresAt));
        setState({ status: 'authenticated', accessToken: tokens.access_token, expiresAt, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setState({ status: 'error', accessToken: null, expiresAt: null, error: message });
      }
    };
    void run();
  }, []);

  // Schedule refresh in one place whenever the authenticated expiry changes.
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (state.status !== 'authenticated' || !state.expiresAt) return undefined;

    const delay = Math.max(0, state.expiresAt - Date.now() - TOKEN_EXPIRY_BUFFER_MS);
    const timer = setTimeout(() => {
      const refreshToken = storeGet(REFRESH_KEY);
      if (refreshToken) void refreshWithMutex(refreshToken);
    }, delay);
    refreshTimerRef.current = timer;

    return () => {
      clearTimeout(timer);
      if (refreshTimerRef.current === timer) refreshTimerRef.current = null;
    };
  }, [state.status, state.expiresAt, refreshWithMutex]);

  const login = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, status: 'authenticating', error: null }));
    const state    = generateRandomString(16);
    const verifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(verifier);
    storeSet(STATE_KEY,    state);
    storeSet(VERIFIER_KEY, verifier);

    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.set('response_type',        'code');
    authUrl.searchParams.set('client_id',            CLIENT_ID);
    authUrl.searchParams.set('scope',                SCOPES);
    authUrl.searchParams.set('redirect_uri',         REDIRECT_URI);
    authUrl.searchParams.set('state',                state);
    authUrl.searchParams.set('code_challenge_method','S256');
    authUrl.searchParams.set('code_challenge',       challenge);

    window.location.href = authUrl.toString();
  }, []);

  const logout = useCallback((): void => {
    clearStorage();
    refreshPromiseRef.current = null;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setState({ status: 'idle', accessToken: null, expiresAt: null, error: null });
  }, [clearStorage]);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const accessToken = storeGet(TOKEN_KEY);
    const expiresAt = Number(storeGet(EXPIRY_KEY) ?? 0);
    if (accessToken && Date.now() + TOKEN_EXPIRY_BUFFER_MS < expiresAt) return accessToken;

    const refreshToken = storeGet(REFRESH_KEY);
    if (!refreshToken) return null;
    return refreshWithMutex(refreshToken);
  }, [refreshWithMutex]);

  const forceRefreshToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = storeGet(REFRESH_KEY);
    if (!refreshToken) return null;
    return refreshWithMutex(refreshToken);
  }, [refreshWithMutex]);

  const actionsValue = useMemo<SpotifyAuthActionsContextValue>(
    () => ({ login, logout, getValidToken, forceRefreshToken }),
    [login, logout, getValidToken, forceRefreshToken],
  );

  const contextValue = useMemo<SpotifyAuthContextValue>(
    () => ({ ...state, ...actionsValue }),
    [state, actionsValue],
  );

  return (
    <SpotifyAuthStateContext.Provider value={state}>
      <SpotifyAuthActionsContext.Provider value={actionsValue}>
        <SpotifyAuthContext.Provider value={contextValue}>
          {children}
        </SpotifyAuthContext.Provider>
      </SpotifyAuthActionsContext.Provider>
    </SpotifyAuthStateContext.Provider>
  );
}

export function useSpotifyAuth(): SpotifyAuthContextValue {
  const ctx = useContext(SpotifyAuthContext);
  if (!ctx) throw new Error('useSpotifyAuth must be used within SpotifyAuthProvider');
  return ctx;
}

export function useSpotifyAuthState(): SpotifyAuthState {
  const ctx = useContext(SpotifyAuthStateContext);
  if (!ctx) throw new Error('useSpotifyAuthState must be used within SpotifyAuthProvider');
  return ctx;
}

export function useSpotifyAuthActions(): SpotifyAuthActionsContextValue {
  const ctx = useContext(SpotifyAuthActionsContext);
  if (!ctx) throw new Error('useSpotifyAuthActions must be used within SpotifyAuthProvider');
  return ctx;
}
