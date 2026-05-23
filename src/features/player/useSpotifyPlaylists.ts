/**
 * useSpotifyPlaylists
 * Fetches the authenticated user's playlists and, lazily, their tracks.
 *
 * - Uses the accessToken from SpotifyAuthContext (no proxy needed — PKCE public client).
 * - AbortController cancels in-flight requests on unmount / token change.
 * - Playlist tracks are loaded on-demand when a playlist is expanded.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpotifyAuth } from '../../contexts/SpotifyAuthContext';
import { spotifyFetch, SpotifyApiError } from './spotifyApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  totalTracks: number;
  uri: string;
}

export interface SpotifyTrackItem {
  id: string;
  name: string;
  uri: string;
  durationMs: number;
  artists: string;
  albumArtUrl: string | null;
  isPlayable: boolean;
}

export interface PlaylistsState {
  playlists: SpotifyPlaylist[];
  loading: boolean;
  error: string | null;
  /** tracks keyed by playlist id */
  tracks: Record<string, SpotifyTrackItem[]>;
  tracksLoading: Record<string, boolean>;
  tracksError: Record<string, string | null>;
  fetchTracks: (playlistId: string) => void;
  reload: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export { formatMs };

async function apiFetch<T>(
  url: string,
  tokens: { getValidToken: () => Promise<string | null>; forceRefreshToken: () => Promise<string | null> },
  signal: AbortSignal,
): Promise<T> {
  return spotifyFetch<T>(url, tokens, { signal });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSpotifyPlaylists(): PlaylistsState {
  const { status, accessToken, getValidToken, forceRefreshToken } = useSpotifyAuth();

  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Record<string, SpotifyTrackItem[]>>({});
  const [tracksLoading, setTracksLoading] = useState<Record<string, boolean>>({});
  const [tracksError, setTracksError] = useState<Record<string, string | null>>({});

  const abortRef = useRef<AbortController | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick(t => t + 1), []);
  const tokens = { getValidToken, forceRefreshToken };

  // ── Fetch playlist list ────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'authenticated' || !accessToken) {
      setPlaylists([]);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    const fetchAll = async () => {
      const collected: SpotifyPlaylist[] = [];
      let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';

      while (url) {
        type RawPage = {
          items: Array<{
            id: string;
            name: string;
            description: string | null;
            images: Array<{ url: string }> | null;
            tracks: { total: number } | null;
            uri: string;
          }>;
          next: string | null;
        };
        const page: RawPage = await apiFetch<RawPage>(url, tokens, ctrl.signal);
        for (const item of page.items) {
          if (!item) continue;
          collected.push({
            id: item.id,
            name: item.name,
            description: item.description || null,
            imageUrl: item.images?.[0]?.url ?? null,
            totalTracks: item.tracks?.total ?? 0,
            uri: item.uri,
          });
        }
        url = page.next;
      }

      setPlaylists(collected);
      setLoading(false);
    };

    fetchAll().catch((err: unknown) => {
      if ((err as Error)?.name === 'AbortError') return;
      const e = err as Error;
      const status = err instanceof SpotifyApiError ? err.status : 0;
      // Persistent 401 after force-refresh means the refresh token is no
      // longer accepted; reflect that as an actionable error.
      const message = status === 401
        ? 'Spotify session expired — please reconnect.'
        : e?.message ?? 'Failed to load playlists';
      setError(message);
      setLoading(false);
    });

    return () => ctrl.abort();
  }, [status, accessToken, getValidToken, forceRefreshToken, tick]);

  // ── Fetch tracks for a single playlist (on demand) ─────────────────────
  const fetchTracks = useCallback((playlistId: string) => {
    if (status !== 'authenticated' || !accessToken || tracks[playlistId] || tracksLoading[playlistId]) return;

    const ctrl = new AbortController();

    setTracksLoading(prev => ({ ...prev, [playlistId]: true }));
    setTracksError(prev => ({ ...prev, [playlistId]: null }));

    const fetchAll = async () => {
      const collected: SpotifyTrackItem[] = [];
      // market omitted: the Bearer token scopes availability to the user's account country
      let url: string | null =
        `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50`;

      while (url) {
        // Per Spotify Web API docs (GET /playlists/{id}/tracks), each
        // PlaylistTrackObject has a `track` field (TrackObject | EpisodeObject).
        // There is no `item` field; the previous fallback was a misreading of
        // the spec. Episodes are filtered out by the `spotify:track:` prefix check.
        type RawTrackObject = {
          id: string;
          name: string;
          uri: string;
          duration_ms: number;
          is_playable?: boolean;
          artists: Array<{ name: string }>;
          album: { images: Array<{ url: string }> };
        } | null;

        type RawTrackPage = {
          next: string | null;
          items: Array<{ track: RawTrackObject }>;
        };

        const page: RawTrackPage = await apiFetch<RawTrackPage>(url, tokens, ctrl.signal);
        for (const entry of page.items) {
          const t = entry.track;
          if (!t || !t.uri || !t.uri.startsWith('spotify:track:')) continue;
          collected.push({
            id: t.id,
            name: t.name,
            uri: t.uri,
            durationMs: t.duration_ms,
            artists: t.artists.map(a => a.name).join(', '),
            albumArtUrl: t.album?.images?.[0]?.url ?? null,
            isPlayable: t.is_playable !== false,
          });
        }
        url = page.next;
      }

      setTracks(prev => ({ ...prev, [playlistId]: collected }));
      setTracksLoading(prev => ({ ...prev, [playlistId]: false }));
    };

    fetchAll().catch((err: unknown) => {
      if ((err as Error)?.name === 'AbortError') return;
      const e = err as Error;
      const status = err instanceof SpotifyApiError ? err.status : 0;
      const message = status === 401
        ? 'Spotify session expired — please reconnect.'
        : e?.message ?? 'Failed to load tracks';
      setTracksError(prev => ({ ...prev, [playlistId]: message }));
      setTracksLoading(prev => ({ ...prev, [playlistId]: false }));
    });
  }, [status, accessToken, getValidToken, forceRefreshToken, tracks, tracksLoading]);

  return { playlists, loading, error, tracks, tracksLoading, tracksError, fetchTracks, reload };
}
