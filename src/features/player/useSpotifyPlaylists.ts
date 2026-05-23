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

async function apiFetch<T>(url: string, getToken: () => Promise<string | null>, signal: AbortSignal): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Spotify token unavailable');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) throw new Error(`Spotify API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSpotifyPlaylists(): PlaylistsState {
  const { status, accessToken, getValidToken } = useSpotifyAuth();

  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Record<string, SpotifyTrackItem[]>>({});
  const [tracksLoading, setTracksLoading] = useState<Record<string, boolean>>({});
  const [tracksError, setTracksError] = useState<Record<string, string | null>>({});

  const abortRef = useRef<AbortController | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick(t => t + 1), []);

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
        const page: RawPage = await apiFetch<RawPage>(url, getValidToken, ctrl.signal);
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
      setError((err as Error)?.message ?? 'Failed to load playlists');
      setLoading(false);
    });

    return () => ctrl.abort();
  }, [status, accessToken, getValidToken, tick]);

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
        // `item` is the current field; `track` is deprecated but kept as fallback
        // per Spotify Web API docs (GET /playlists/{id}/tracks)
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
          items: Array<{
            item?: RawTrackObject;
            track?: RawTrackObject;
          }>;
        };

        const page: RawTrackPage = await apiFetch<RawTrackPage>(url, getValidToken, ctrl.signal);
        for (const entry of page.items) {
          // Prefer `item` (current API field), fall back to deprecated `track`
          const t = entry.item ?? entry.track;
          if (!t || !t.uri.startsWith('spotify:track:')) continue;
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
      setTracksError(prev => ({ ...prev, [playlistId]: (err as Error)?.message ?? 'Failed to load tracks' }));
      setTracksLoading(prev => ({ ...prev, [playlistId]: false }));
    });
  }, [status, accessToken, getValidToken, tracks, tracksLoading]);

  return { playlists, loading, error, tracks, tracksLoading, tracksError, fetchTracks, reload };
}
