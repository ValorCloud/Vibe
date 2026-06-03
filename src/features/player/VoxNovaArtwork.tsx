import { memo, useEffect, useRef, useState } from 'react';
import { FrequencyVisualizer } from './FrequencyVisualizer';
import { LCARS } from './lcarsTheme';
import { SPOTIFY_GREEN, DEFAULT_VIDEO_ASPECT_RATIO, LCARS_BOX_COLORS } from './playerConstants';
import type { FrequencyAnalyserState } from './useFrequencyAnalyser';

// ─── VideoPlayer ──────────────────────────────────────────────────────────────

interface VideoPlayerProps {
  src: string;
  isPlaying: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
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

// ─── SpotifyAlbumArtStage ─────────────────────────────────────────────────────

interface SpotifyAlbumArtStageProps {
  contentWidth: string;
  imageUrl: string;
  trackName: string;
  artistsLabel: string;
  isPlaying: boolean;
}

function SpotifyAlbumArtStage({ contentWidth, imageUrl, trackName, artistsLabel, isPlaying }: SpotifyAlbumArtStageProps) {
  return (
    <div style={{
      alignSelf: 'center', width: contentWidth,
      border: `1px solid ${SPOTIFY_GREEN}55`, borderRadius: 4,
      background: '#000', position: 'relative',
      boxShadow: `0 0 24px ${SPOTIFY_GREEN}1a, 0 4px 16px rgba(0,0,0,0.5)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px 4px', background: 'rgba(0,0,0,0.7)', borderBottom: `1px solid ${SPOTIFY_GREEN}33`,
        borderRadius: '4px 4px 0 0' }}>
        <span style={{ color: SPOTIFY_GREEN, fontSize: 9, letterSpacing: 3, fontWeight: 700 }}>SPOTIFY STREAM</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5,
          color: isPlaying ? SPOTIFY_GREEN : LCARS.subText, fontSize: 9, letterSpacing: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%',
            background: isPlaying ? SPOTIFY_GREEN : LCARS.subText,
            boxShadow: isPlaying ? `0 0 6px ${SPOTIFY_GREEN}` : 'none' }} aria-hidden="true" />
          {isPlaying ? 'STREAMING' : 'STANDBY'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 14,
        background: 'linear-gradient(135deg, rgba(29,185,84,0.08), rgba(0,0,0,0.6))', borderRadius: '0 0 4px 4px' }}>
        <img src={imageUrl} alt={trackName ? `Album art for ${trackName}` : 'Album art'}
          width={120} height={120}
          style={{ borderRadius: 4, flexShrink: 0, border: `1px solid ${SPOTIFY_GREEN}55`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: LCARS.text, fontSize: 18, fontWeight: 700, letterSpacing: 0.5,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trackName}</div>
          <div style={{ color: LCARS.subText, fontSize: 12, letterSpacing: 1, marginTop: 4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artistsLabel}</div>
        </div>
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', top: 30, left: 0, width: 3, height: 36, background: SPOTIFY_GREEN, borderRadius: '0 2px 2px 0', opacity: 0.55 }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: 30, right: 0, width: 3, height: 36, background: LCARS.peach, borderRadius: '2px 0 0 2px', opacity: 0.55 }} />
    </div>
  );
}

// ─── VoxNovaArtwork ───────────────────────────────────────────────────────────

export interface VoxNovaArtworkProps {
  isSpotify: boolean;
  contentWidth: string;
  isPlaying: boolean;
  /** Present when isSpotify=false and the track is a video file. */
  videoSrc?: string | undefined;
  videoRef?: React.RefObject<HTMLVideoElement | null> | undefined;
  /** Present when isSpotify=true and a track is playing. */
  spotifyImageUrl?: string | undefined;
  spotifyTrackName?: string | undefined;
  spotifyArtistsLabel?: string | undefined;
}

function VoxNovaArtworkImpl({
  isSpotify,
  contentWidth,
  isPlaying,
  videoSrc,
  videoRef,
  spotifyImageUrl,
  spotifyTrackName,
  spotifyArtistsLabel,
}: VoxNovaArtworkProps): React.ReactElement | null {
  if (isSpotify) {
    if (!spotifyImageUrl || !spotifyTrackName) return null;
    return (
      <SpotifyAlbumArtStage
        contentWidth={contentWidth}
        imageUrl={spotifyImageUrl}
        trackName={spotifyTrackName}
        artistsLabel={spotifyArtistsLabel ?? ''}
        isPlaying={isPlaying}
      />
    );
  }
  if (!videoSrc || !videoRef) return null;
  return (
    <VideoPlayer
      src={videoSrc}
      isPlaying={isPlaying}
      videoRef={videoRef}
      contentWidth={contentWidth}
    />
  );
}

/**
 * Album-art / video stage. Memoized: it only re-renders when one of its props
 * changes (track image/name, video source, playback state, layout width), so
 * unrelated parent re-renders (e.g. the ticking SECTOR TIME clock) don't force
 * the artwork — and the embedded <video> element — to re-render needlessly.
 */
export const VoxNovaArtwork = memo(VoxNovaArtworkImpl);

// ─── VoxNovaFrequencyPanel ────────────────────────────────────────────────────

export interface VoxNovaFrequencyPanelProps {
  wideWidth: string;
  isVideo?: boolean | undefined;
  isPlaying: boolean;
  analyser: FrequencyAnalyserState;
  audioRef: React.RefObject<HTMLMediaElement | null>;
}

export function VoxNovaFrequencyPanel({
  wideWidth,
  isVideo,
  isPlaying,
  analyser,
  audioRef,
}: VoxNovaFrequencyPanelProps) {
  return (
    <div style={{ alignSelf: 'center', width: wideWidth, border: `1px solid ${LCARS.red ?? '#cc3333'}33`, borderRadius: 4, padding: '8px',     background: LCARS_BOX_COLORS[3] }}>
      <div style={{ color: LCARS.subText, fontSize: 9, letterSpacing: 3, marginBottom: 6, paddingLeft: 4 }}>
        SUBSPACE FREQUENCY SCAN{isVideo ? ' — AUDIO TRACK' : ''}
      </div>
      <FrequencyVisualizer isPlaying={isPlaying} analyser={analyser} audioRef={audioRef} />
    </div>
  );
}
