/**
 * SpotifyPlaylistPanel
 * Accordion list of the user's Spotify playlists.
 * Expanding a row loads and shows its tracks; clicking a track plays it
 * via context_uri so Spotify handles shuffle / repeat / radio natively.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSpotifyPlaylists, formatMs } from './useSpotifyPlaylists';
import { useSpotifyEngine_ } from '../../contexts/SpotifyEngineContext';
import { LCARS } from './lcarsTheme';

const SPOTIFY_GREEN = '#1DB954';

function SkeletonRow({ width = '60%' }: { width?: string }) {
  return (
    <div style={{
      height: 12, borderRadius: 3,
      background: `linear-gradient(90deg, ${LCARS.void} 25%, rgba(255,255,255,0.06) 50%, ${LCARS.void} 75%)`,
      backgroundSize: '200% 100%',
      animation: 'spotify-shimmer 1.4s ease-in-out infinite',
      width,
    }} aria-hidden="true" />
  );
}

interface TrackRowProps {
  uri: string;
  name: string;
  artists: string;
  durationMs: number;
  albumArtUrl: string | null;
  isPlayable: boolean;
  isActive: boolean;
  onPlay: (trackUri: string) => void;
}

function TrackRow({ uri, name, artists, durationMs, albumArtUrl, isPlayable, isActive, onPlay }: TrackRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => isPlayable && onPlay(uri)}
      disabled={!isPlayable}
      aria-label={`Play ${name} by ${artists}`}
      aria-pressed={isActive}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', background: isActive
          ? `rgba(29,185,84,0.12)` : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: 'none', borderRadius: 3, padding: '5px 8px',
        cursor: isPlayable ? 'pointer' : 'default',
        opacity: isPlayable ? 1 : 0.4,
        transition: 'background 120ms ease',
        textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      {albumArtUrl ? (
        <img src={albumArtUrl} alt="" width={28} height={28}
          style={{ borderRadius: 2, flexShrink: 0, border: `1px solid ${SPOTIFY_GREEN}22` }}
          loading="lazy" />
      ) : (
        <div style={{ width: 28, height: 28, borderRadius: 2, flexShrink: 0, background: 'rgba(255,255,255,0.06)' }} aria-hidden="true" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: isActive ? SPOTIFY_GREEN : LCARS.text,
          fontSize: 11, fontWeight: isActive ? 700 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          letterSpacing: 0.3,
        }}>
          {isActive && <span aria-hidden="true" style={{ marginRight: 4 }}>▶</span>}
          {name}
        </div>
        <div style={{ color: LCARS.subText, fontSize: 9, letterSpacing: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {artists}
        </div>
      </div>
      <span style={{ color: LCARS.mutedText, fontSize: 9, letterSpacing: 1, flexShrink: 0, fontFamily: 'monospace' }}>
        {formatMs(durationMs)}
      </span>
    </button>
  );
}

interface PlaylistRowProps {
  name: string;
  imageUrl: string | null;
  totalTracks: number;
  index: number;
  isOpen: boolean;
  headerId: string;
  panelId: string;
  onToggle: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  registerButton: (index: number, element: HTMLButtonElement | null) => void;
}

function PlaylistRow({
  name,
  imageUrl,
  totalTracks,
  index,
  isOpen,
  headerId,
  panelId,
  onToggle,
  onKeyDown,
  registerButton,
}: PlaylistRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      id={headerId}
      onClick={onToggle}
      onKeyDown={(event) => onKeyDown(event, index)}
      ref={(element) => registerButton(index, element)}
      aria-expanded={isOpen}
      aria-controls={panelId}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', background: isOpen
          ? `rgba(29,185,84,0.08)` : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: 'none', borderBottom: `1px solid rgba(255,255,255,0.05)`,
        padding: '7px 10px',
        cursor: 'pointer', transition: 'background 120ms ease',
        textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" width={32} height={32}
          style={{ borderRadius: 3, flexShrink: 0, border: `1px solid ${SPOTIFY_GREEN}33` }}
          loading="lazy" />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: 3, flexShrink: 0,
          background: 'rgba(29,185,84,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill={SPOTIFY_GREEN} opacity="0.6">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
          </svg>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: isOpen ? SPOTIFY_GREEN : LCARS.text, fontSize: 11, fontWeight: 600,
          letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </div>
        <div style={{ color: LCARS.subText, fontSize: 9, letterSpacing: 1 }}>
          {totalTracks > 0 ? `${totalTracks} TRACKS` : 'TAP TO LOAD'}
        </div>
      </div>
      <svg width="10" height="10" viewBox="0 0 24 24" fill={LCARS.subText}
        style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 180ms ease' }}
        aria-hidden="true">
        <path d="M7 10l5 5 5-5z"/>
      </svg>
    </button>
  );
}

function renderSkippedMessage(local: number, podcast: number, unsupported: number): string {
  const parts: string[] = [];
  if (local > 0) parts.push(`${local} fichier(s) locaux`);
  if (podcast > 0) parts.push(`${podcast} podcast(s)`);
  if (unsupported > 0) parts.push(`${unsupported} autre(s) item(s) non supporté(s)`);
  return parts.length > 0 ? `${parts.join(' · ')} exclus.` : 'This playlist is empty.';
}

export function SpotifyPlaylistPanel() {
  const {
    playlists,
    loading,
    error,
    tracks,
    tracksLoading,
    tracksError,
    tracksSkippedByType,
    fetchTracks,
    reload,
  } = useSpotifyPlaylists();
  const { controls, playbackState } = useSpotifyEngine_();
  const [openId, setOpenId] = useState<string | null>(null);
  const headerButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    headerButtonRefs.current = headerButtonRefs.current.slice(0, playlists.length);
  }, [playlists.length]);

  const currentUri = playbackState?.track_window?.current_track?.uri ?? null;

  const handleToggle = (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    fetchTracks(id);
  };

  const handlePlay = (trackUri: string) => {
    const playlist = playlists.find(pl => pl.id === openId);
    if (!playlist) {
      void controls.play({ uris: [trackUri] });
      return;
    }
    void controls.play({
      contextUri: `spotify:playlist:${playlist.id}`,
      offsetUri: trackUri,
    });
  };

  const registerButton = (index: number, element: HTMLButtonElement | null) => {
    headerButtonRefs.current[index] = element;
  };

  const focusHeaderAt = (index: number) => {
    const target = headerButtonRefs.current[index];
    if (target) target.focus();
  };

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (playlists.length === 0) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusHeaderAt((index + 1) % playlists.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusHeaderAt((index - 1 + playlists.length) % playlists.length);
        break;
      case 'Home':
        event.preventDefault();
        focusHeaderAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusHeaderAt(playlists.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <>
      <style>{`@keyframes spotify-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>

      <div style={{
        alignSelf: 'center', width: 'min(680px, 95%)',
        border: `1px solid ${SPOTIFY_GREEN}33`,
        borderRadius: 4,
        background: 'rgba(29,185,84,0.04)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px 7px',
          borderBottom: `1px solid ${SPOTIFY_GREEN}22`,
          background: 'rgba(29,185,84,0.06)',
        }}>
          <span style={{ color: SPOTIFY_GREEN, fontSize: 9, letterSpacing: 3, fontWeight: 700 }}>
            YOUR PLAYLISTS
          </span>
          <button
            onClick={reload}
            aria-label="Reload playlists"
            style={{
              background: 'transparent', border: 'none', color: LCARS.subText,
              cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center',
              transition: 'color 150ms ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
        </div>

        {loading && (
          <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[70, 55, 80, 60, 75].map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 3, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} aria-hidden="true" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <SkeletonRow width={`${w}%`} />
                  <SkeletonRow width="30%" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div role="alert" style={{ padding: '10px 12px', color: LCARS.alertRed, fontSize: 10, fontFamily: 'monospace' }}>
            ⚠ {error}
            <button onClick={reload} style={{ marginLeft: 8, color: SPOTIFY_GREEN, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', textDecoration: 'underline' }}>Retry</button>
          </div>
        )}

        {!loading && !error && playlists.length === 0 && (
          <div style={{ padding: '16px 12px', color: LCARS.subText, fontSize: 10, textAlign: 'center', letterSpacing: 1 }}>
            No playlists found in your Spotify library.
          </div>
        )}

        {!loading && !error && playlists.length > 0 && (
          <div style={{ maxHeight: 420, overflowY: 'auto' }} role="list">
            {playlists.map((pl, index) => {
              const headerId = `spotify-playlist-header-${pl.id}`;
              const panelId = `spotify-playlist-panel-${pl.id}`;
              const skipped = tracksSkippedByType[pl.id] ?? { local: 0, podcast: 0, unsupported: 0 };
              return (
                <div key={pl.id} role="listitem">
                  <PlaylistRow
                    name={pl.name}
                    imageUrl={pl.imageUrl}
                    totalTracks={pl.totalTracks}
                    index={index}
                    isOpen={openId === pl.id}
                    headerId={headerId}
                    panelId={panelId}
                    onToggle={() => handleToggle(pl.id)}
                    onKeyDown={handleHeaderKeyDown}
                    registerButton={registerButton}
                  />

                  {openId === pl.id && (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={headerId}
                      style={{ background: 'rgba(0,0,0,0.2)', padding: '4px 4px 4px 8px' }}
                    >
                      {tracksLoading[pl.id] && (
                        <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {[65, 80, 50, 70].map((w, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 2, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} aria-hidden="true" />
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <SkeletonRow width={`${w}%`} />
                                <SkeletonRow width="35%" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {tracksError[pl.id] && (
                        <div role="alert" style={{ padding: '6px 8px', color: LCARS.alertRed, fontSize: 10, fontFamily: 'monospace' }}>
                          ⚠ {tracksError[pl.id]}
                        </div>
                      )}

                      {!tracksLoading[pl.id] && !tracksError[pl.id] && tracks[pl.id]?.length === 0 && (
                        <div style={{ padding: '8px', color: LCARS.subText, fontSize: 10, letterSpacing: 1 }}>
                          {renderSkippedMessage(skipped.local, skipped.podcast, skipped.unsupported)}
                        </div>
                      )}

                      {!tracksLoading[pl.id] && tracks[pl.id]?.map(track => (
                        <TrackRow
                          key={track.id}
                          uri={track.uri}
                          name={track.name}
                          artists={track.artists}
                          durationMs={track.durationMs}
                          albumArtUrl={track.albumArtUrl}
                          isPlayable={track.isPlayable}
                          isActive={track.uri === currentUri}
                          onPlay={handlePlay}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
