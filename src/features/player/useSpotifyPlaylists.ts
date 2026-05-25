/**
 * useSpotifyPlaylists
 * Fetches the authenticated user's playlists and, lazily, their tracks.
 *
 * May 2026 (v1.31.0.68): kill the "X exclus" false positive on normal playlists
 *
 *   Root cause of the regression observed since the /tracks → /items migration
 *   (v1.31.0.53) and not solved by v1.31.0.65 / v1.31.0.67:
 *
 *     - The Zod schema declared `track: TRACK_ITEM_SCHEMA.nullable().optional()`,
 *       so when the API returned the track payload under any other shape (or
 *       under the `item` alias the legacy Web API briefly exposed for the
 *       `/items` endpoint), `entry.track` quietly resolved to `undefined`.
 *     - The downstream skip logic treated `!t` (and any missing `uri`) as
 *       "unsupported", so a benign data-shape mismatch was reported as
 *       "N autre(s) item(s) non supporté(s) exclus." for *every* track of every
 *       music playlist — even though those tracks are perfectly valid.
 *
 *   Fixes:
 *     1. Accept both `entry.item` and `entry.track` on every playlist item, so
 *        a payload shaped either way feeds the same code path.
 *     2. Only increment a skipped counter when the item is *positively*
 *        identified as a non-track (episode, local file, show, etc.). Items
 *        we cannot classify (null track, null uri, unknown shape) are skipped
 *        silently — they never inflate the user-visible counter.
 *
 *   Real local files (`spotify:local:`) and podcast episodes (`type === 'episode'`
 *   or `spotify:episode:` uri) are still counted exactly as before, so the
 *   discriminant message keeps its meaning when it does fire.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ZodError, z } from 'zod';
import { useSpotifyAuthState } from '../../contexts/SpotifyAuthContext';
import { useSpotifyApiClient } from './useSpotifyApiClient';
import { SpotifyApiError } from './spotifyApi';

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

export interface SpotifySkippedItems {
  local: number;
  podcast: number;
  unsupported: number;
}

export interface PlaylistsState {
  playlists: SpotifyPlaylist[];
  loading: boolean;
  error: string | null;
  tracks: Record<string, SpotifyTrackItem[]>;
  tracksLoading: Record<string, boolean>;
  tracksError: Record<string, string | null>;
  tracksSkipped: Record<string, number>;
  tracksSkippedByType: Record<string, SpotifySkippedItems>;
  fetchTracks: (playlistId: string) => void;
  reload: () => void;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export { formatMs };

const ME_SCHEMA = z.object({ id: z.string() });

const PLAYLIST_PAGE_SCHEMA = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      images: z.array(z.object({ url: z.string() })).nullable().optional(),
      tracks: z.object({ total: z.number() }).nullable().optional(),
      uri: z.string(),
      owner: z.object({ id: z.string() }),
    }),
  ),
  next: z.string().nullable(),
});

const TRACK_ITEM_SCHEMA = z
  .object({
    id: z.string().nullable(),
    // name/type/artists/album peuvent être null dans les réponses playlist
    name: z.string().nullable().optional(),
    uri: z.string().nullable(),
    type: z.string().nullable().optional(),
    duration_ms: z.number().optional().default(0),
    is_playable: z.boolean().optional(),
    artists: z.array(z.object({ name: z.string() })).nullable().optional().default([]),
    album: z
      .object({
        images: z.array(z.object({ url: z.string() })).optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const TRACK_PAGE_SCHEMA = z.object({
  next: z.string().nullable(),
  items: z.array(
    z.object({
      // Some Spotify deployments of the /items endpoint return the track payload
      // under `item` instead of `track`. Accept both so the hook is shape-agnostic.
      track: TRACK_ITEM_SCHEMA.nullable().optional(),
      item: TRACK_ITEM_SCHEMA.nullable().optional(),
    }).passthrough(),
  ),
});

type PlaylistPage = z.infer<typeof PLAYLIST_PAGE_SCHEMA>;
type TrackPage = z.infer<typeof TRACK_PAGE_SCHEMA>;

const PLAYLISTS_CACHE_TTL_MS = 2 * 60_000;

let playlistsCache: { value: SpotifyPlaylist[]; fetchedAt: number } | null = null;
const tracksCache = new Map<string, SpotifyTrackItem[]>();
let cacheAccessToken: string | null = null;

function syncCacheScope(accessToken: string | null): void {
  if (cacheAccessToken === accessToken) return;
  playlistsCache = null;
  tracksCache.clear();
  cacheAccessToken = accessToken;
}

function emptySkippedItems(): SpotifySkippedItems {
  return { local: 0, podcast: 0, unsupported: 0 };
}

const EXCLUDED_PLAYLIST_PATTERN =
  /^(My Shazam Tracks|Mes titres Shazam|Similaires (à|a)|Similar to|Discover Weekly|Release Radar|Daily Mix|On Repeat|Repeat Rewind)/i;

export function useSpotifyPlaylists(): PlaylistsState {
  const { status, accessToken } = useSpotifyAuthState();
  const { request, getErrorMessage } = useSpotifyApiClient();

  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Record<string, SpotifyTrackItem[]>>(
    () => Object.fromEntries(tracksCache.entries()),
  );
  const [tracksLoading, setTracksLoading] = useState<Record<string, boolean>>({});
  const [tracksError, setTracksError] = useState<Record<string, string | null>>({});
  const [tracksSkipped, setTracksSkipped] = useState<Record<string, number>>({});
  const [tracksSkippedByType, setTracksSkippedByType] = useState<Record<string, SpotifySkippedItems>>({});

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const tracksLoadingRef = useRef(tracksLoading);
  tracksLoadingRef.current = tracksLoading;

  const abortRef = useRef<AbortController | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => {
    playlistsCache = null;
    tracksCache.clear();
    setTracks({});
    setTracksLoading({});
    setTracksError({});
    setTracksSkipped({});
    setTracksSkippedByType({});
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    syncCacheScope(accessToken);
    setTracks(Object.fromEntries(tracksCache.entries()));
    setTracksLoading({});
    setTracksError({});
    setTracksSkipped({});
    setTracksSkippedByType({});
  }, [accessToken]);

  useEffect(() => {
    syncCacheScope(accessToken);

    if (status !== 'authenticated' || !accessToken) {
      setPlaylists([]);
      setLoading(false);
      return;
    }

    const hasFreshCache =
      tick === 0 &&
      playlistsCache !== null &&
      Date.now() - playlistsCache.fetchedAt < PLAYLISTS_CACHE_TTL_MS;
    if (hasFreshCache && playlistsCache) {
      setPlaylists(playlistsCache.value);
      setError(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    const fetchAll = async () => {
      const me = await request<{ id: string }>('https://api.spotify.com/v1/me', {
        signal: ctrl.signal,
        parse: (payload) => ME_SCHEMA.parse(payload),
      });
      const userId = me.id;

      const collected: SpotifyPlaylist[] = [];
      let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';

      while (url) {
        const page: PlaylistPage = await request<PlaylistPage>(url, {
          signal: ctrl.signal,
          parse: (payload) => PLAYLIST_PAGE_SCHEMA.parse(payload),
        });
        for (const item of page.items) {
          if (item.owner.id !== userId) continue;
          if (EXCLUDED_PLAYLIST_PATTERN.test(item.name)) continue;
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

      playlistsCache = { value: collected, fetchedAt: Date.now() };
      setPlaylists(collected);
      setLoading(false);
    };

    fetchAll().catch((err: unknown) => {
      if ((err as Error)?.name === 'AbortError') return;
      if (err instanceof ZodError) {
        setError('Spotify returned an unexpected playlists payload.');
      } else {
        setError(getErrorMessage(err, 'Failed to load playlists'));
      }
      setLoading(false);
    });

    return () => ctrl.abort();
  }, [status, accessToken, request, getErrorMessage, tick]);

  const fetchTracks = useCallback(
    (playlistId: string) => {
      syncCacheScope(accessToken);

      if (status !== 'authenticated' || !accessToken) return;
      if ((tracksRef.current[playlistId]?.length ?? 0) > 0) return;
      if (tracksLoadingRef.current[playlistId]) return;

      const cachedTracks = tracksCache.get(playlistId);
      if (cachedTracks && cachedTracks.length > 0) {
        setTracks((prev) => ({ ...prev, [playlistId]: cachedTracks }));
        return;
      }

      const ctrl = new AbortController();

      setTracksLoading((prev) => ({ ...prev, [playlistId]: true }));
      setTracksError((prev) => ({ ...prev, [playlistId]: null }));
      setTracksSkipped((prev) => ({ ...prev, [playlistId]: 0 }));
      setTracksSkippedByType((prev) => ({ ...prev, [playlistId]: emptySkippedItems() }));

      const fetchAll = async () => {
        const collected: SpotifyTrackItem[] = [];
        const skippedByType: SpotifySkippedItems = emptySkippedItems();
        let totalSkipped = 0;
        let url: string | null =
          `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=50`;

        while (url) {
          const page: TrackPage = await request<TrackPage>(url, {
            signal: ctrl.signal,
            parse: (payload) => TRACK_PAGE_SCHEMA.parse(payload),
          });
          for (const entry of page.items) {
            // Spotify returns the track payload under `track` (canonical) or
            // sometimes `item` on the /items endpoint. Honour both.
            const t = entry.item ?? entry.track;

            // Unknown shape (null track, missing uri, …): skip silently so we
            // never display a "X autre(s) item(s) non supporté(s) exclus."
            // counter for items we cannot positively classify. This is the fix
            // for the long-standing false positive on every music playlist.
            if (!t || !t.uri) {
              continue;
            }

            // Positively identified podcast episode.
            if (t.type === 'episode' || t.uri.startsWith('spotify:episode:')) {
              skippedByType.podcast++;
              totalSkipped++;
              continue;
            }

            // Positively identified local file.
            if (t.uri.startsWith('spotify:local:')) {
              skippedByType.local++;
              totalSkipped++;
              continue;
            }

            // Accept any spotify:track: uri regardless of whether id is null.
            // Spotify returns id=null for relinked tracks in playlist responses
            // while Search returns the same track with a populated id.
            if (t.uri.startsWith('spotify:track:')) {
              collected.push({
                id: t.id ?? t.uri,
                name: t.name ?? '',
                uri: t.uri,
                durationMs: t.duration_ms ?? 0,
                artists: (t.artists ?? []).map((a) => a.name).join(', '),
                albumArtUrl: t.album?.images?.[0]?.url ?? null,
                isPlayable: t.is_playable !== false,
              });
              continue;
            }

            // Any other positively-identified non-track uri (e.g. spotify:show:).
            skippedByType.unsupported++;
            totalSkipped++;
          }
          url = page.next;
        }

        if (collected.length > 0) {
          tracksCache.set(playlistId, collected);
        }
        setTracksSkipped((prev) => ({ ...prev, [playlistId]: totalSkipped }));
        setTracksSkippedByType((prev) => ({ ...prev, [playlistId]: skippedByType }));
        setTracks((prev) => ({ ...prev, [playlistId]: collected }));
        setTracksLoading((prev) => ({ ...prev, [playlistId]: false }));
      };

      fetchAll().catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        if (err instanceof SpotifyApiError && err.status === 403) {
          setTracksError((prev) => ({
            ...prev,
            [playlistId]: 'Playlist inaccessible — not available in Dev Mode.',
          }));
        } else if (err instanceof ZodError) {
          setTracksError((prev) => ({
            ...prev,
            [playlistId]: 'Spotify returned an unexpected tracks payload.',
          }));
        } else {
          setTracksError((prev) => ({
            ...prev,
            [playlistId]: getErrorMessage(err, 'Failed to load tracks'),
          }));
        }
        setTracksLoading((prev) => ({ ...prev, [playlistId]: false }));
      });
    },
    [status, accessToken, request, getErrorMessage],
  );

  return {
    playlists,
    loading,
    error,
    tracks,
    tracksLoading,
    tracksError,
    tracksSkipped,
    tracksSkippedByType,
    fetchTracks,
    reload,
  };
}
