import { useCallback, useState } from 'react';
import { ZodError, z } from 'zod';
import { useSpotifyAuthState } from '../../contexts/SpotifyAuthContext';
import { useSpotifyApiClient } from './useSpotifyApiClient';

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

const SpotifySearchResponseSchema = z.object({
  tracks: z.object({
    items: z.array(z.object({
      id: z.string(),
      uri: z.string(),
      name: z.string(),
      duration_ms: z.number(),
      artists: z.array(z.object({ name: z.string() })),
      album: z.object({
        name: z.string(),
        images: z.array(z.object({ url: z.string() })).optional(),
      }),
    })).optional(),
  }).optional(),
});

// Feb 2026: Spotify enforces limit ≤ 10 for apps in Development Mode.
const SEARCH_LIMIT = 10;

export function useSpotifySearch(): SpotifySearchState {
  const { status } = useSpotifyAuthState();
  const { request, getErrorMessage } = useSpotifyApiClient();
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
      // limit capped at 10 — Feb 2026 Spotify Dev Mode restriction.
      const endpoint = `https://api.spotify.com/v1/search?q=${encodeURIComponent(term)}&type=track&limit=${SEARCH_LIMIT}`;
      const data = await request(
        endpoint,
        { parse: (payload) => SpotifySearchResponseSchema.parse(payload) },
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
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        setError('Spotify returned an unexpected search payload.');
      } else {
        setError(getErrorMessage(err, 'Failed to search Spotify tracks'));
      }
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [getErrorMessage, query, request, status]);

  return { query, setQuery, searching, error, results, search };
}
