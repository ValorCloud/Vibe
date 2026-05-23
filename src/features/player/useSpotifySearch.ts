import { useCallback, useState } from 'react';
import { useSpotifyAuth } from '../../contexts/SpotifyAuthContext';
import { spotifyFetch, SpotifyApiError } from './spotifyApi';

export interface SpotifySearchTrack {
  id: string;
  uri: string;
  name: string;
  artists: string;
  durationMs: number;
  albumName: string;
  albumArtUrl: string | null;
}

interface SpotifySearchState {
  query: string;
  setQuery: (value: string) => void;
  searching: boolean;
  error: string | null;
  results: SpotifySearchTrack[];
  search: (q?: string) => Promise<void>;
}

/**
 * Strip characters that cause Spotify search API 400 errors.
 *
 * The Spotify search endpoint rejects unescaped reserved characters even when
 * URL-encoded inside the `q` value (notably `?`, `#`, `:`, `/`, `\`, `"`,
 * `[`, `]`, `@`). We collapse them to spaces so a user query like
 * `artist:foo` still produces a meaningful search instead of a 400.
 */
function sanitizeQuery(q: string): string {
  return q.replace(/[\/\\\":?#\[\]@]/g, ' ').replace(/\s+/g, ' ').trim();
}

interface SpotifySearchResponse {
  tracks?: {
    items?: Array<{
      id: string;
      uri: string;
      name: string;
      duration_ms: number;
      artists: Array<{ name: string }>;
      album: { name: string; images?: Array<{ url: string }> };
    }>;
  };
}

export function useSpotifySearch(): SpotifySearchState {
  const { status, getValidToken, forceRefreshToken } = useSpotifyAuth();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SpotifySearchTrack[]>([]);

  const search = useCallback(async (q?: string) => {
    const raw = (q ?? query).trim();
    const term = sanitizeQuery(raw);
    if (!term) {
      setResults([]);
      setError(null);
      return;
    }
    if (status !== 'authenticated') {
      setError('Connect Spotify to search.');
      setResults([]);
      return;
    }

    setSearching(true);
    setError(null);
    try {
      // `q` first per Spotify docs convention; type & limit follow.
      // Market omitted — the Bearer token scopes availability to the
      // user's account country natively.
      const endpoint = `https://api.spotify.com/v1/search?q=${encodeURIComponent(term)}&type=track&limit=25`;
      const data = await spotifyFetch<SpotifySearchResponse>(
        endpoint,
        { getValidToken, forceRefreshToken },
      );
      setResults((data.tracks?.items ?? []).map(item => ({
        id: item.id,
        uri: item.uri,
        name: item.name,
        artists: item.artists.map(a => a.name).join(', '),
        durationMs: item.duration_ms,
        albumName: item.album.name,
        albumArtUrl: item.album.images?.[0]?.url ?? null,
      })));
    } catch (err) {
      const e = err as Error;
      if (err instanceof SpotifyApiError) {
        if (err.status === 401) {
          setError('Spotify session expired — please reconnect.');
        } else {
          setError(`Spotify search failed (${err.status}): ${e.message}`);
        }
      } else {
        setError(e.message ?? 'Failed to search Spotify tracks');
      }
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [getValidToken, forceRefreshToken, query, status]);

  return { query, setQuery, searching, error, results, search };
}
