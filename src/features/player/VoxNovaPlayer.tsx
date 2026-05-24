import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FrequencyVisualizer } from './FrequencyVisualizer';
import { PlayerControls } from './PlayerControls';
import { PlayerSidebar } from './PlayerSidebar';
import { SidebarProvider } from './SidebarContext';
import { StatusBar, SeekBar, VolumeControl, BlackHoleBadge, ChipIcon, NetworkIcon } from './PlayerWidgets';
import { useAudioEngine } from './useAudioEngine';
import { useFrequencyAnalyser } from './useFrequencyAnalyser';
import { useLibraryContext } from '../../contexts/LibraryContext';
import { usePlayerNavigation } from './usePlayerNavigation';
import { useSpotifyAuth } from '../../contexts/SpotifyAuthContext';
import { useSpotifyEngine_ } from '../../contexts/SpotifyEngineContext';
import { LCARS } from './lcarsTheme';
import type { TrackInfo } from './useAudioEngine';
import type { TrackEntry } from './types';
import { SpotifyPlaylistPanel } from './SpotifyPlaylistPanel';
import { SpotifySearchPanel } from './SpotifySearchPanel';
import { getStoredSpotifyVolume, SPOTIFY_VOLUME_STORAGE_KEY } from '../../hooks/useSpotifyEngine';
import { ErrorBoundary } from '../../components/app/ErrorBoundary';

const LIBRARY_CAPACITY = 50;
const LCARS_BOX_COLORS = [
  'rgba(255,153,0,0.08)',
  'rgba(153,102,204,0.08)',
  'rgba(204,153,102,0.08)',
  'rgba(255,102,102,0.08)',
  'rgba(102,204,255,0.08)',
];
const SPOTIFY_GREEN = '#1DB954';
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9;

type AudioSource = 'local' | 'spotify';
type SpotifyBrowserTab = 'playlists' | 'search';

function genRegistry(): string {
  const buf = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
  else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function useSectorTime(): string {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let id: number | null = null;
    const tick = () => setT((performance.now() - start) / 100);
    const startInterval = () => { if (id !== null) return; id = window.setInterval(tick, 100); };
    const stopInterval = () => { if (id === null) return; window.clearInterval(id); id = null; };
    const onVisibility = () => { if (document.hidden) stopInterval(); else startInterval(); };
    if (!document.hidden) startInterval();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); stopInterval(); };
  }, []);
  const whole = Math.floor(t / 10).toString().padStart(4, '0');
  const dec = Math.floor(t % 10);
  return `${whole}.${dec}`;
}

function LCARSBackground() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: 'radial-gradient(ellipse at 20% 40%, rgba(255,153,0,0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 60%, rgba(153,102,204,0.07) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(255,102,102,0.025) 0%, transparent 70%)' }}>
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.018) 2px, rgba(255,255,255,0.018) 4px), repeating-linear-gradient(90deg, rgba(245,176,107,0.018) 0, rgba(245,176,107,0.018) 1px, transparent 1px, transparent 18px)',
        backgroundSize: '100% 4px' }} />
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,153,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,153,0,0.025) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 80%)' }} />
    </div>
  );
}

function isEditableSpaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button';
}

function formatDate(value?: string): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString() : null;
}

function OneDriveMetaLine({ track }: { track: TrackEntry }) {
  const items: Array<{ label: string; value: string; color: string }> = [];
  items.push({
    label: 'SOURCE',
    value: track.source.toUpperCase(),
    color: track.source === 'local' ? LCARS.orange : track.source === 'lyria' ? '#00c8a0' : LCARS.purple,
  });
  const modified = formatDate(track.oneDriveLastModified);
  if (modified) items.push({ label: 'MODIFIED', value: modified, color: LCARS.subText });
  items.push({
    label: 'LINK',
    value: track.linked ? 'RESOLVED' : 'PENDING',
    color: track.linked ? LCARS.peach : LCARS.mutedText,
  });
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 0', marginBottom: 6 }}>
      {items.map((item, i) => (
        <span key={item.label} style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 }}>
          {i > 0 && <span style={{ color: 'rgba(153,102,204,0.45)', margin: '0 6px' }}>│</span>}
          <span style={{ color: LCARS.subText }}>{item.label}:</span>{' '}
          <span style={{ color: item.color }}>{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function TechSpecLine({ info, duration }: { info: TrackInfo | null; duration: number }) {
  if (!info) {
    return <span style={{ color: 'rgba(153,102,204,0.5)', fontStyle: 'italic' }}>[SIGNAL_ANALYSIS] Scanning...</span>;
  }
  const parts: Array<{ label: string; color: string }> = [];
  parts.push({ label: info.channelLabel, color: LCARS.amber });
  if (info.sampleRate) parts.push({ label: `${(info.sampleRate / 1000).toFixed(1)} kHz`, color: LCARS.purple });
  if (info.bitrateKbps) parts.push({ label: `~${info.bitrateKbps} kbps`, color: LCARS.purple });
  if (info.codec) parts.push({ label: info.codec, color: LCARS.peach });
  if (duration > 0) {
    const m = Math.floor(duration / 60);
    const s = Math.floor(duration % 60).toString().padStart(2, '0');
    parts.push({ label: `${m}:${s}`, color: LCARS.subText });
  }
  parts.push({ label: info.isVideo ? 'VIDEO+AUDIO' : 'AUDIO', color: info.isVideo ? LCARS.alertRed : LCARS.purple });
  return (
    <span>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span style={{ color: 'rgba(153,102,204,0.45)', margin: '0 6px' }}>│</span>}
          <span style={{ color: p.color }}>{p.label}</span>
        </span>
      ))}
    </span>
  );
}

interface VideoPlayerProps {
  src: string;
  isPlaying: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  contentWidth: string;
}

function VideoPlayer({ src, isPlaying, videoRef, contentWidth }: VideoPlayerProps) {
  const [showControls, setShowControls] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_VIDEO_ASPECT_RATIO);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = () => {
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowControls(false), 2800);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  useEffect(() => { setAspectRatio(DEFAULT_VIDEO_ASPECT_RATIO); }, [src]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.videoWidth && v.videoHeight) setAspectRatio(v.videoWidth / v.videoHeight);
  };

  return (
    <div onMouseMove={handleMouseMove} onMouseLeave={() => setShowControls(false)}
      style={{
        alignSelf: 'center', width: contentWidth,
        border: `1px solid ${LCARS.purple}55`, borderRadius: 4,
        background: '#000', position: 'relative',
        boxShadow: `0 0 24px ${LCARS.purple}1a, 0 4px 16px rgba(0,0,0,0.5)`,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px 4px', background: 'rgba(0,0,0,0.7)', borderBottom: `1px solid ${LCARS.purple}33`,
        borderRadius: '4px 4px 0 0' }}>
        <span style={{ color: LCARS.purple, fontSize: 9, letterSpacing: 3, fontWeight: 700 }}>VIDEO STREAM</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5,
          color: isPlaying ? LCARS.alertRed : LCARS.subText, fontSize: 9, letterSpacing: 2, transition: 'color 200ms ease' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%',
            background: isPlaying ? LCARS.alertRed : LCARS.subText,
            boxShadow: isPlaying ? `0 0 6px ${LCARS.alertRed}` : 'none',
            transition: 'background 200ms ease, box-shadow 200ms ease' }} aria-hidden="true" />
          {isPlaying ? 'ACTIVE' : 'STANDBY'}
        </span>
      </div>
      <div style={{ aspectRatio, width: '100%', background: '#000', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
        <video ref={videoRef} src={src}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill' }}
          playsInline controls={showControls} preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          aria-label={isPlaying ? 'Video player – playing' : 'Video player – paused'} />
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', top: 30, left: 0, width: 3, height: 36, background: LCARS.purple, borderRadius: '0 2px 2px 0', opacity: 0.55 }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: 30, right: 0, width: 3, height: 36, background: LCARS.orange, borderRadius: '2px 0 0 2px', opacity: 0.55 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spotify source panel
// ---------------------------------------------------------------------------

function SpotifySourcePanel() {
  const { status, login, logout, error } = useSpotifyAuth();
  const { playerState, playbackState, controls } = useSpotifyEngine_();
  const setSpotifyVolume = controls.setVolume;
  const [volume, setVolume] = useState<number>(() => getStoredSpotifyVolume());
  const [browserTab, setBrowserTab] = useState<SpotifyBrowserTab>('playlists');

  const track = playbackState?.track_window?.current_track;
  const isPlaying = !(playbackState?.paused ?? true);
  const posMs = playbackState?.position ?? 0;
  const durMs = track?.duration_ms ?? 0;

  useEffect(() => {
    void setSpotifyVolume(volume);
  }, [setSpotifyVolume, volume]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SPOTIFY_VOLUME_STORAGE_KEY) return;
      setVolume(getStoredSpotifyVolume());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const statusColor =
    playerState === 'ready' || playerState === 'playing' ? SPOTIFY_GREEN
    : playerState === 'error' ? LCARS.alertRed
    : LCARS.subText;

  const statusLabel =
    playerState === 'idle' ? 'STANDBY'
    : playerState === 'loading' ? 'INITIALIZING…'
    : playerState === 'ready' ? 'DEVICE READY'
    : playerState === 'playing' ? 'STREAMING'
    : 'ERROR';

  return (
    <div style={{
      alignSelf: 'center', width: 'min(680px, 95%)',
      border: `1px solid ${SPOTIFY_GREEN}44`,
      borderRadius: 4, padding: '12px 16px',
      background: 'rgba(29,185,84,0.06)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Spotify logo mark */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill={SPOTIFY_GREEN} aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill={SPOTIFY_GREEN} opacity="0.15" />
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 01-.277-1.215c3.809-.87 7.077-.496 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.786-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.519-.973c3.632-1.102 8.147-.568 11.234 1.328a.78.78 0 01.257 1.073zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 11-.543-1.794c3.525-1.07 9.386-.863 13.087 1.306a.938.938 0 01-.927 1.645z" fill={SPOTIFY_GREEN} />
          </svg>
          <span style={{ color: SPOTIFY_GREEN, fontSize: 10, letterSpacing: 3, fontWeight: 700 }}>SPOTIFY STREAM</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: playerState === 'playing' ? `0 0 6px ${SPOTIFY_GREEN}` : 'none' }} aria-hidden="true" />
          <span style={{ color: statusColor, fontSize: 9, letterSpacing: 2 }}>{statusLabel}</span>
        </div>

        {/* Auth button */}
        {status === 'authenticated'
          ? (
            <button
              onClick={logout}
              aria-label="Disconnect Spotify"
              style={{
                background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.3)',
                borderRadius: 3, color: LCARS.alertRed, fontSize: 9, letterSpacing: 2,
                padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
              }}
            >
              DISCONNECT
            </button>
          ) : (
            <button
              onClick={() => void login()}
              disabled={status === 'authenticating'}
              aria-label="Connect to Spotify"
              style={{
                background: status === 'authenticating' ? 'rgba(29,185,84,0.08)' : `${SPOTIFY_GREEN}22`,
                border: `1px solid ${SPOTIFY_GREEN}55`,
                borderRadius: 3, color: SPOTIFY_GREEN, fontSize: 9, letterSpacing: 2,
                padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                opacity: status === 'authenticating' ? 0.6 : 1,
              }}
            >
              {status === 'authenticating' ? 'CONNECTING…' : 'CONNECT'}
            </button>
          )
        }
      </div>

      {/* Error */}
      {error && (
        <div role="alert" style={{ color: LCARS.alertRed, fontSize: 10, fontFamily: 'monospace', letterSpacing: 1 }}>
          ⚠ {error}
        </div>
      )}

      {/* Now playing */}
      {track && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {track.album?.images?.[0]?.url && (
            <img
              src={track.album.images[0].url}
              alt={track.album.name ?? 'Album art'}
              width={48} height={48}
              style={{ borderRadius: 3, flexShrink: 0, border: `1px solid ${SPOTIFY_GREEN}33` }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: LCARS.text, fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {track.name}
            </div>
            <div style={{ color: LCARS.subText, fontSize: 10, letterSpacing: 1, marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {track.artists?.map(a => a.name).join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* Seek + transport */}
      {status === 'authenticated' && (
        <>
          <SeekBar
            currentTime={posMs / 1000}
            duration={durMs / 1000}
            onSeek={(s) => void controls.seek(s * 1000)}
            disabled={!track}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <button
              onClick={() => void controls.previousTrack()}
              disabled={!track}
              aria-label="Previous track"
              style={transportBtnStyle(!track)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
            </button>
            <button
              onClick={() => void (isPlaying ? controls.pause() : controls.resume())}
              disabled={!track}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              style={{
                ...transportBtnStyle(!track),
                width: 36, height: 36, borderRadius: '50%',
                background: track ? `${SPOTIFY_GREEN}22` : 'transparent',
                border: `1px solid ${SPOTIFY_GREEN}55`,
                color: SPOTIFY_GREEN,
              }}
            >
              {isPlaying
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              }
            </button>
            <button
              onClick={() => void controls.nextTrack()}
              disabled={!track}
              aria-label="Next track"
              style={transportBtnStyle(!track)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6 8.5 6V6z" /><path d="M16 6h2v12h-2z"/></svg>
            </button>
          </div>
          <VolumeControl
            volume={volume}
            onChange={setVolume}
          />
        </>
      )}

      {/* Not connected CTA */}
      {status !== 'authenticated' && status !== 'authenticating' && (
        <div style={{ color: LCARS.subText, fontSize: 10, fontFamily: 'monospace', letterSpacing: 1, textAlign: 'center' }}>
          Connect your Spotify Premium account to stream directly in this player.
        </div>
      )}

      {status === 'authenticated' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => setBrowserTab('playlists')}
              aria-pressed={browserTab === 'playlists'}
              style={{
                background: browserTab === 'playlists' ? `${SPOTIFY_GREEN}22` : 'transparent',
                color: browserTab === 'playlists' ? SPOTIFY_GREEN : LCARS.subText,
                border: `1px solid ${browserTab === 'playlists' ? `${SPOTIFY_GREEN}66` : `${LCARS.subText}33`}`,
                borderRadius: 3, fontSize: 9, letterSpacing: 2, fontWeight: 700, padding: '4px 8px', cursor: 'pointer',
              }}
            >
              PLAYLISTS
            </button>
            <button
              type="button"
              onClick={() => setBrowserTab('search')}
              aria-pressed={browserTab === 'search'}
              style={{
                background: browserTab === 'search' ? `${SPOTIFY_GREEN}22` : 'transparent',
                color: browserTab === 'search' ? SPOTIFY_GREEN : LCARS.subText,
                border: `1px solid ${browserTab === 'search' ? `${SPOTIFY_GREEN}66` : `${LCARS.subText}33`}`,
                borderRadius: 3, fontSize: 9, letterSpacing: 2, fontWeight: 700, padding: '4px 8px', cursor: 'pointer',
              }}
            >
              SEARCH
            </button>
          </div>
          <ErrorBoundary label="Spotify browser">
            {browserTab === 'playlists' ? <SpotifyPlaylistPanel /> : <SpotifySearchPanel />}
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

function transportBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    color: disabled ? LCARS.mutedText : LCARS.subText,
    cursor: disabled ? 'default' : 'pointer',
    padding: 6,
    borderRadius: 3,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
    transition: 'opacity 150ms ease, color 150ms ease',
  };
}

// ---------------------------------------------------------------------------
// Source toggle pill
// ---------------------------------------------------------------------------

function SourceToggle({ source, onChange }: { source: AudioSource; onChange: (s: AudioSource) => void }) {
  return (
    <div role="group" aria-label="Audio source" style={{ display: 'flex', alignItems: 'center', gap: 2,
      background: 'rgba(0,0,0,0.35)', borderRadius: 20, padding: '2px 3px',
      border: '1px solid rgba(255,255,255,0.08)' }}>
      {(['local', 'spotify'] as AudioSource[]).map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-pressed={source === s}
          style={{
            background: source === s
              ? (s === 'spotify' ? `${SPOTIFY_GREEN}22` : `${LCARS.peach}22`)
              : 'transparent',
            border: source === s
              ? `1px solid ${s === 'spotify' ? SPOTIFY_GREEN : LCARS.peach}55`
              : '1px solid transparent',
            borderRadius: 16, padding: '2px 10px',
            color: source === s ? (s === 'spotify' ? SPOTIFY_GREEN : LCARS.peach) : LCARS.subText,
            fontSize: 9, letterSpacing: 2, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 150ms ease',
          }}
        >
          {s.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main player
// ---------------------------------------------------------------------------

export function VoxNovaPlayer() {
  const engine = useAudioEngine();
  const analyser = useFrequencyAnalyser();
  const library = useLibraryContext();

  const [audioSource, setAudioSource] = useState<AudioSource>('local');

  // Auto-switch to Spotify source when the user authenticates
  const { status: spotifyStatus } = useSpotifyAuth();
  const prevSpotifyStatus = useRef(spotifyStatus);
  useEffect(() => {
    if (prevSpotifyStatus.current !== 'authenticated' && spotifyStatus === 'authenticated') {
      setAudioSource('spotify');
    }
    // Revert to local when user disconnects
    if (prevSpotifyStatus.current === 'authenticated' && spotifyStatus !== 'authenticated') {
      setAudioSource('local');
    }
    prevSpotifyStatus.current = spotifyStatus;
  }, [spotifyStatus]);

  const videoElRef = useRef<HTMLVideoElement>(null);
  const registry = useMemo(() => genRegistry(), []);
  const sectorTime = useSectorTime();

  const {
    view, setView, selectedId, setSelectedId, selectedTrack,
    handleSelect, handlePrev, handleNext,
  } = usePlayerNavigation({ tracks: library.tracks, engine });

  useEffect(() => {
    if (!selectedTrack?.isVideo) { engine.attachVideoElement(null); return; }
    const el = videoElRef.current;
    if (!el) return;
    engine.attachVideoElement(el);
    el.src = selectedTrack.url;
    el.load();
    el.play().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrack?.id, selectedTrack?.isVideo]);

  useEffect(() => {
    if (selectedId && engine.duration > 0) library.updateDuration(selectedId, engine.duration);
  }, [engine.duration, library, selectedId]);

  const handlePurge = () => {
    if (typeof window !== 'undefined' && !window.confirm('Purge all tracks from local cache?')) return;
    library.purgeAll(); setSelectedId(null); engine.pause();
  };

  const handleSpacePlayPause = useCallback((event: KeyboardEvent) => {
    if (audioSource !== 'local') return;
    if (event.defaultPrevented || event.code !== 'Space' || !selectedTrack || isEditableSpaceTarget(event.target)) return;
    event.preventDefault();
    engine.togglePlay();
  }, [engine, selectedTrack, audioSource]);

  const handleLocalPrev = useCallback(() => {
    if (audioSource !== 'local') return;
    void handlePrev();
  }, [audioSource, handlePrev]);

  const handleLocalNext = useCallback(() => {
    if (audioSource !== 'local') return;
    void handleNext();
  }, [audioSource, handleNext]);

  useEffect(() => {
    window.addEventListener('keydown', handleSpacePlayPause);
    return () => window.removeEventListener('keydown', handleSpacePlayPause);
  }, [handleSpacePlayPause]);

  const structuralIntegrity = Math.min(1, library.tracks.length / LIBRARY_CAPACITY);
  const neuralBuffer = engine.duration > 0 ? Math.min(1, engine.currentTime / engine.duration) : 0;
  const memo = selectedTrack?.memo || (selectedTrack ? `[LCARS_SCAN] Identified: ${selectedTrack.title} | Integrity: Nominal` : '[LCARS_SCAN] Standby — awaiting signal selection.');
  const title = selectedTrack?.title ?? 'Subspace Channel Idle';
  const CONTENT_WIDTH = 'min(680px, 95%)';
  const WIDE_WIDTH = 'min(900px, 98%)';

  const lyriaCount = library.tracks.filter(t => t.source === 'lyria').length;
  const prevLyriaCount = useRef(lyriaCount);
  useEffect(() => { if (lyriaCount > prevLyriaCount.current) setView('lyria'); prevLyriaCount.current = lyriaCount; }, [lyriaCount, setView]);

  return (
    <div className="lcars-lyrics-area" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', backgroundColor: LCARS.void, color: LCARS.text, fontFamily: '"Antonio", "Eurostile", "Helvetica Neue", Arial, sans-serif', overflow: 'hidden' }}>
      <LCARSBackground />
      <SidebarProvider onLocalTracksAdded={() => setView('local')}>
        <PlayerSidebar
          view={view} setView={setView} tracks={library.tracks}
          selectedId={selectedId} onSelect={handleSelect} onPurge={handlePurge}
        />
      </SidebarProvider>

      <main style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0, padding: '12px 16px 16px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
          <div style={{ flex: 1, height: 36, background: LCARS.peach, color: '#000', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 12, fontWeight: 700, letterSpacing: 2, borderTopLeftRadius: 18, borderBottomLeftRadius: 18, justifyContent: 'space-between' }}>
            <span>USS VOX NOVA // REGISTRY {registry}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Source toggle — lives in the header bar */}
              <SourceToggle source={audioSource} onChange={setAudioSource} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: LCARS.alertRed, boxShadow: `0 0 6px ${LCARS.alertRed}` }} aria-hidden="true" />
                <span style={{ fontSize: 11 }}>IMPULSE_ONLY</span>
              </span>
              <ChipIcon /><NetworkIcon />
            </div>
          </div>
          <div style={{ width: 60, height: 36, background: LCARS.purple, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: 18, borderBottomRightRadius: 18 }} aria-hidden="true" />
        </div>

        {/* Status bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 32, alignItems: 'start', padding: '4px 8px' }}>
          <StatusBar label="STRUCTURAL INTEGRITY" value={structuralIntegrity} color={LCARS.amber} />
          <StatusBar label="NEURAL BUFFER" value={neuralBuffer} color={LCARS.purple} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: LCARS.subText, fontSize: 10, letterSpacing: 2 }}>SECTOR TIME</div>
            <div style={{ color: LCARS.alertRed, fontSize: 20, fontFamily: 'monospace', letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>{sectorTime}</div>
          </div>
        </div>

        {/* Stage */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 20, padding: '12px 24px 16px 24px', overflow: 'auto' }}>

          {audioSource === 'spotify' ? (
            // ── SPOTIFY MODE ──────────────────────────────────────────────
            <SpotifySourcePanel />
          ) : (
            // ── LOCAL MODE ────────────────────────────────────────────────
            <>
              {/* Title */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ color: LCARS.subText, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase' }}>COMMS_ENCRYPTION: LEVEL 5</div>
                <h1 style={{ margin: 0, fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: 700, textAlign: 'center', letterSpacing: 1, lineHeight: 1.05, textShadow: '0 0 32px rgba(255,255,255,0.25)', maxWidth: WIDE_WIDTH }}>{title}</h1>
                <div style={{ width: 120, height: 3, background: LCARS.peach, borderRadius: 2 }} aria-hidden="true" />
              </div>

              {/* MEMO LOG */}
              <div style={{ alignSelf: 'center', width: CONTENT_WIDTH, border: `1px solid ${LCARS.purple}55`, borderRadius: 4, padding: '10px 14px', background: LCARS_BOX_COLORS[1] }}>
                <div style={{ color: LCARS.purple, fontSize: 10, letterSpacing: 3, marginBottom: 6 }}>LOCAL MEMO LOG</div>
                <div style={{ color: LCARS.text, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word', marginBottom: selectedTrack ? 8 : 0 }}>{memo}</div>
                {selectedTrack && <OneDriveMetaLine track={selectedTrack} />}
                {selectedTrack && (
                  <div style={{ borderTop: `1px solid ${LCARS.purple}22`, paddingTop: 6, fontFamily: 'monospace', fontSize: 11, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: LCARS.subText, marginRight: 6 }}>SIGNAL_ANALYSIS</span>
                    <TechSpecLine info={engine.trackInfo} duration={engine.duration} />
                  </div>
                )}
              </div>

              {/* Video */}
              {selectedTrack?.isVideo && (
                <VideoPlayer src={selectedTrack.url} isPlaying={engine.isPlaying} videoRef={videoElRef} contentWidth={CONTENT_WIDTH} />
              )}

              {/* Transport */}
              <div style={{ alignSelf: 'center', width: CONTENT_WIDTH, border: `1px solid ${LCARS.peach}33`, borderRadius: 4, padding: '12px 16px', background: LCARS_BOX_COLORS[2], display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SeekBar currentTime={engine.currentTime} duration={engine.duration} onSeek={engine.seek} disabled={!selectedTrack} />
                <PlayerControls engine={engine} onPrev={handleLocalPrev} onNext={handleLocalNext} disabled={!selectedTrack} />
                <VolumeControl volume={engine.volume} onChange={engine.setVolume} />
              </div>

              <div style={{ flex: 1, minHeight: 0 }} aria-hidden="true" />

              {/* Frequency scan */}
              {selectedTrack && (
                <div style={{ alignSelf: 'center', width: WIDE_WIDTH, border: `1px solid ${LCARS.red ?? '#cc3333'}33`, borderRadius: 4, padding: '8px', background: LCARS_BOX_COLORS[3] }}>
                  <div style={{ color: LCARS.subText, fontSize: 9, letterSpacing: 3, marginBottom: 6, paddingLeft: 4 }}>
                    SUBSPACE FREQUENCY SCAN{selectedTrack.isVideo ? ' — AUDIO TRACK' : ''}
                  </div>
                  <FrequencyVisualizer isPlaying={engine.isPlaying} analyser={analyser} audioRef={engine.audioRef} />
                </div>
              )}

              {/* Singularity status */}
              <div style={{ alignSelf: 'center', width: WIDE_WIDTH, border: '1px solid rgba(100,100,200,0.25)', borderRadius: 4, padding: '10px 14px', background: 'rgba(0,0,20,0.35)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'rgba(100,150,255,0.7)', fontSize: 9, letterSpacing: 3, marginBottom: 4 }}>SINGULARITY STATUS</div>
                  <div style={{ color: LCARS.subText, fontSize: 11, letterSpacing: 1 }}>{engine.isPlaying ? 'ACCRETION ACTIVE' : 'EVENT HORIZON STABLE'}</div>
                </div>
                <BlackHoleBadge active={engine.isPlaying} analyser={analyser} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
