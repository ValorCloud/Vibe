/**
 * SpotifyAuthContext — PKCE OAuth 2.0 pur (sans proxy serveur).
 *
 * Fonctionnalités :
 *   - Redirect + code exchange directs vers accounts.spotify.com
 *   - State CSRF validé côté client
 *   - Refresh proactif via setTimeout (60s avant expiry)
 *   - Mutex refreshPromiseRef : 0 double-refresh concurrent
 *   - Storage : localStorage + memStore fallback (contextes sandboxés)
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { SpotifyAuthState } from '../types/spotify';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;

const REDIRECT_URI = (() => {
  if (typeof window === 'undefined') return '';
  const { protocol, host } = window.location;
  // Dev: http://127.0.0.1:5173 | Prod: https://lyricist-emmanuelkerhozs-projects.vercel.app
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
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

const TOKEN_KEY    = 'spotify_access_token';
const REFRESH_KEY  = 'spotify_refresh_token';
const EXPIRY_KEY   = 'spotify_token_expiry';
const VERIFIER_KEY = 'spotify_pkce_verifier';
const STATE_KEY    = 'spotify_pkce_state';

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
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
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
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SpotifyAuthContextValue extends SpotifyAuthState {
  login: () => Promise<void>;
  logout: () => void;
}

const SpotifyAuthContext = createContext<SpotifyAuthContextValue | null>(null);

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
  // Mutex: évite les doubles refresh concurrents
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const clearStorage = useCallback(() => {
    storeRemove(TOKEN_KEY);
    storeRemove(REFRESH_KEY);
    storeRemove(EXPIRY_KEY);
  }, []);

  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max(0, expiresAt - Date.now() - 60_000);
    refreshTimerRef.current = setTimeout(async () => {
      const refreshToken = storeGet(REFRESH_KEY);
      if (!refreshToken) return;

      // Mutex
      if (refreshPromiseRef.current) return;
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
          scheduleRefresh(newExpiry);
        })
        .catch(() => {
          clearStorage();
          setState({ status: 'error', accessToken: null, expiresAt: null, error: 'Token refresh failed. Please log in again.' });
        })
        .finally(() => { refreshPromiseRef.current = null; });
    }, delay);
  }, [clearStorage]);

  // Gestion du callback OAuth au montage
  useEffect(() => {
    const run = async () => {
      const params      = new URLSearchParams(window.location.search);
      const code        = params.get('code');
      const stateParam  = params.get('state');
      const errorParam  = params.get('error');

      if (!code && !errorParam) return; // Pas un callback Spotify

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
        scheduleRefresh(expiresAt);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setState({ status: 'error', accessToken: null, expiresAt: null, error: message });
      }
    };
    void run();
  }, [scheduleRefresh]);

  // Planifier le refresh au montage si déjà authentifié
  useEffect(() => {
    if (state.status === 'authenticated' && state.expiresAt) {
      scheduleRefresh(state.expiresAt);
    }
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <SpotifyAuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </SpotifyAuthContext.Provider>
  );
}

export function useSpotifyAuth(): SpotifyAuthContextValue {
  const ctx = useContext(SpotifyAuthContext);
  if (!ctx) throw new Error('useSpotifyAuth must be used within SpotifyAuthProvider');
  return ctx;
}
