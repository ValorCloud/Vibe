/**
 * SpotifyAuthContext — PKCE OAuth 2.0 pur (sans proxy serveur).
 *
 * Fonctionnalités :
 *   - Redirect + code exchange directs vers accounts.spotify.com
 *   - State CSRF validé côté client
 *   - Refresh proactif via setTimeout (60s avant expiry) — voir useSpotifyTokenRefresh
 *   - Mutex refreshPromiseRef : 0 double-refresh concurrent — voir useSpotifyTokenRefresh
 *   - Storage : localStorage + memStore fallback (contextes sandboxés) — voir spotifyPkce
 *
 * Les primitives PKCE/storage/token vivent dans spotifyPkce.ts (sans React) et
 * la boucle de refresh dans useSpotifyTokenRefresh.ts. Ce module orchestre
 * l'état, la ré-hydratation post-mount, le callback OAuth et les contextes.
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
  useState,
} from 'react';
import type { SpotifyAuthState } from '../types/spotify';
import {
  exchangeCode,
  generateCodeChallenge,
  generateRandomString,
  storeGet,
  storeRemove,
  storeSet,
  CLIENT_ID,
  EXPIRY_KEY,
  REDIRECT_URI,
  REFRESH_KEY,
  SCOPES,
  STATE_KEY,
  TOKEN_KEY,
  TOKEN_EXPIRY_BUFFER_MS,
  VERIFIER_KEY,
  assertSpotifyConfigured,
} from './spotifyPkce';
import { useSpotifyTokenRefresh } from './useSpotifyTokenRefresh';

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

  const { refreshWithMutex, clearStorage, resetRefresh } = useSpotifyTokenRefresh({
    status: state.status,
    expiresAt: state.expiresAt,
    setState,
  });

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

  const login = useCallback(async (): Promise<void> => {
    try {
      assertSpotifyConfigured();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Spotify is not configured.';
      setState({ status: 'error', accessToken: null, expiresAt: null, error: message });
      return;
    }

    setState(prev => ({ ...prev, status: 'authenticating', error: null }));
    const oauthState = generateRandomString(16);
    const verifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(verifier);
    storeSet(STATE_KEY,    oauthState);
    storeSet(VERIFIER_KEY, verifier);

    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.set('response_type',        'code');
    authUrl.searchParams.set('client_id',            CLIENT_ID);
    authUrl.searchParams.set('scope',                SCOPES);
    authUrl.searchParams.set('redirect_uri',         REDIRECT_URI);
    authUrl.searchParams.set('state',                oauthState);
    authUrl.searchParams.set('code_challenge_method','S256');
    authUrl.searchParams.set('code_challenge',       challenge);

    window.location.href = authUrl.toString();
  }, []);

  const logout = useCallback((): void => {
    clearStorage();
    resetRefresh();
    setState({ status: 'idle', accessToken: null, expiresAt: null, error: null });
  }, [clearStorage, resetRefresh]);

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
