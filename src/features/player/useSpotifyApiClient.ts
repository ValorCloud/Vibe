import { useCallback, useMemo } from 'react';
import { useSpotifyAuthActions } from '../../contexts/SpotifyAuthContext';
import type { SpotifyTokenProvider } from '../../types/spotify';
import { spotifyFetch, SpotifyApiError, type SpotifyFetchOptions } from './spotifyApi';

export function useSpotifyApiClient() {
  const { getValidToken, forceRefreshToken } = useSpotifyAuthActions();

  const tokenProvider = useMemo<SpotifyTokenProvider>(
    () => ({ getValidToken, forceRefreshToken }),
    [getValidToken, forceRefreshToken],
  );

  const request = useCallback(
    <T>(url: string, options: SpotifyFetchOptions<T> = {}) => spotifyFetch<T>(url, tokenProvider, options),
    [tokenProvider],
  );

  const getErrorMessage = useCallback((error: unknown, fallback: string): string => {
    if (error instanceof SpotifyApiError) {
      return error.status === 401
        ? 'Spotify session expired — please reconnect.'
        : error.message || fallback;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }, []);

  return { request, tokenProvider, getErrorMessage };
}
