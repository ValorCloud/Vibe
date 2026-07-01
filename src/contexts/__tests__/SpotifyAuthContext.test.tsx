import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const TOKEN_KEY = 'spotify_access_token';
const REFRESH_KEY = 'spotify_refresh_token';
const EXPIRY_KEY = 'spotify_token_expiry';

async function loadSpotifyAuthContext() {
  vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'spotify-client-id');
  return import('../SpotifyAuthContext');
}

afterEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('SpotifyAuthContext', () => {
  it('does not crash when Spotify is not configured and surfaces an auth error on login', async () => {
    vi.unstubAllEnvs();

    const { SpotifyAuthProvider, useSpotifyAuthActions, useSpotifyAuthState } = await import('../SpotifyAuthContext');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SpotifyAuthProvider>{children}</SpotifyAuthProvider>
    );
    const { result } = renderHook(() => ({
      actions: useSpotifyAuthActions(),
      state: useSpotifyAuthState(),
    }), { wrapper });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.error).toBeNull();

    await act(async () => {
      await result.current.actions.login();
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toContain('VITE_SPOTIFY_CLIENT_ID is not set');
  });

  it('rehydrates a token that becomes available after the initial state read', async () => {
    const expiresAt = Date.now() + 120_000;
    localStorage.setItem(TOKEN_KEY, 'stored-token');
    localStorage.setItem(REFRESH_KEY, 'stored-refresh');
    localStorage.setItem(EXPIRY_KEY, String(expiresAt));

    const realGetItem = Storage.prototype.getItem;
    let initialReads = 0;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(key: string) {
      if ((key === TOKEN_KEY || key === EXPIRY_KEY) && initialReads < 2) {
        initialReads += 1;
        return null;
      }
      return realGetItem.call(this, key);
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { SpotifyAuthProvider, useSpotifyAuthState } = await loadSpotifyAuthContext();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SpotifyAuthProvider>{children}</SpotifyAuthProvider>
    );

    const { result } = renderHook(() => useSpotifyAuthState(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.accessToken).toBe('stored-token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deduplicates a scheduled refresh racing with a manual refresh', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T00:00:00.000Z'));
    localStorage.setItem(TOKEN_KEY, 'stale-token');
    localStorage.setItem(REFRESH_KEY, 'refresh-token');
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + 60_000));

    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    const { SpotifyAuthProvider, useSpotifyAuthActions, useSpotifyAuthState } = await loadSpotifyAuthContext();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SpotifyAuthProvider>{children}</SpotifyAuthProvider>
    );
    const { result } = renderHook(() => ({
      actions: useSpotifyAuthActions(),
      state: useSpotifyAuthState(),
    }), { wrapper });

    await act(async () => {
      const manualRefresh = result.current.actions.forceRefreshToken();
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      resolveFetch?.(new Response(JSON.stringify({
        access_token: 'fresh-token',
        refresh_token: 'fresh-refresh-token',
        expires_in: 3600,
      }), { status: 200 }));
      await expect(manualRefresh).resolves.toBe('fresh-token');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh-token');
    expect(result.current.state.accessToken).toBe('fresh-token');
  });

  it('rejects invalid Spotify refresh payloads at runtime', async () => {
    localStorage.setItem(REFRESH_KEY, 'refresh-token');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: 'missing-expiry' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { SpotifyAuthProvider, useSpotifyAuthActions, useSpotifyAuthState } = await loadSpotifyAuthContext();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SpotifyAuthProvider>{children}</SpotifyAuthProvider>
    );
    const { result } = renderHook(() => ({
      actions: useSpotifyAuthActions(),
      state: useSpotifyAuthState(),
    }), { wrapper });

    await act(async () => {
      await expect(result.current.actions.forceRefreshToken()).resolves.toBeNull();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe('Token refresh failed. Please log in again.');
  });
});
