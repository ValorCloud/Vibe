import { useMemo, useState } from 'react';
import { PlayerControls } from './PlayerControls';
import { PlayerSidebar } from './PlayerSidebar';
import { SidebarProvider } from './SidebarContext';
import { LCARS } from './lcarsTheme';
import { SpotifyPlaylistPanel } from './SpotifyPlaylistPanel';
import { SpotifySearchPanel } from './SpotifySearchPanel';
import { ErrorBoundary } from '../../components/app/ErrorBoundary';
import { VoxNovaHeader } from './VoxNovaHeader';
import { VoxNovaArtwork, VoxNovaFrequencyPanel } from './VoxNovaArtwork';
import { VoxNovaLocalMemo, VoxNovaSpotifyMemo } from './VoxNovaLocalMemo';
import { SeekBar, VolumeControl } from './PlayerWidgets';
import { LCARSBackground, VoxNovaFooter } from './VoxNovaFooter';
import { useVoxNovaPlayer } from './useVoxNovaPlayer';
import { SPOTIFY_GREEN, LCARS_BOX_COLORS } from './playerConstants';
import { useSpotifyAuthActions } from '../../contexts/SpotifyAuthContext';

type SpotifyBrowserTab = 'playlists' | 'search';

// ─── SpotifyBrowserSection ────────────────────────────────────────────────────

function SpotifyBrowserSection({ contentWidth }: { contentWidth: string }) {
  const [browserTab, setBrowserTab] = useState<SpotifyBrowserTab>('playlists');
  return (
    <div style={{ alignSelf: 'center', width: contentWidth, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        >PLAYLISTS</button>
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
        >SEARCH</button>
      </div>
      <ErrorBoundary label="Spotify browser">
        {browserTab === 'playlists' ? <SpotifyPlaylistPanel /> : <SpotifySearchPanel />}
      </ErrorBoundary>
    </div>
  );
}

// ─── VoxNovaPlayerInner ───────────────────────────────────────────────────────

function VoxNovaPlayerInner() {
  const {
    engine,
    analyser,
    library,
    audioSource,
    setAudioSource,
    spotifyStatus,
    videoElRef,
    view,
    setView,
    selectedId,
    selectedTrack,
    handleSelect,
    handlePurge,
    isSpotify,
    activeEngine,
    spotifyPlayerState,
    spotifyTrack,
    spotifyArtists,
    spotifyAlbumArt,
    hasActiveTrack,
    sidebarHidden,
    handlePrevTrack,
    handleNextTrack,
    structuralIntegrity,
    neuralBuffer,
    memo,
    title,
  } = useVoxNovaPlayer();

  const { login: spotifyLogin } = useSpotifyAuthActions();

  const CONTENT_WIDTH = 'min(680px, 95%)';
  const WIDE_WIDTH = 'min(900px, 98%)';

  // Transport bindings for the in-stage overlay (play/pause, ±10s, seek, volume).
  const stageOverlay = useMemo(() => ({
    currentTime: activeEngine.currentTime,
    duration: activeEngine.duration,
    volume: activeEngine.volume,
    onTogglePlay: activeEngine.togglePlay,
    onSeek: activeEngine.seek,
    onVolumeChange: activeEngine.setVolume,
  }), [activeEngine.currentTime, activeEngine.duration, activeEngine.volume, activeEngine.togglePlay, activeEngine.seek, activeEngine.setVolume]);

  // The local stage (video or randomized visual) hosts the volume cursor, so
  // the transport panel only shows it when no stage is rendered.
  const stageHasVolume = !isSpotify && !!selectedTrack;

  return (
    <div className="lcars-lyrics-area" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', color: 'var(--text-primary)', fontFamily: '"Antonio", "Eurostile", "Helvetica Neue", Arial, sans-serif', overflow: 'hidden' }}>
      <LCARSBackground />
      <SidebarProvider onLocalTracksAdded={() => setView('local')}>
        {/* Sidebar hidden (not unmounted) while player is active — preserves refs and state */}
        <div
          aria-hidden={sidebarHidden}
          style={{
            display: sidebarHidden ? 'none' : 'contents',
            transition: 'width 280ms cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <PlayerSidebar
            view={view} setView={setView} tracks={library.tracks}
            selectedId={selectedId} onSelect={handleSelect} onPurge={handlePurge}
            onSpotifyActivate={() => void spotifyLogin()}
          />
        </div>
      </SidebarProvider>

      <main style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0, padding: '12px 16px 16px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <VoxNovaHeader
          audioSource={audioSource}
          onAudioSourceChange={setAudioSource}
          isSpotify={isSpotify}
          structuralIntegrity={structuralIntegrity}
          neuralBuffer={neuralBuffer}
        />

        {/* Stage */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 20, padding: '12px 24px 16px 24px', overflow: 'auto' }}>
          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ color: LCARS.subText, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase' }}>COMMS_ENCRYPTION: LEVEL 5</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: 700, textAlign: 'center', letterSpacing: 1, lineHeight: 1.05, textShadow: '0 0 32px rgba(255,255,255,0.25)', maxWidth: WIDE_WIDTH }}>{title}</h1>
            <div style={{ width: 120, height: 3, background: isSpotify ? SPOTIFY_GREEN : LCARS.peach, borderRadius: 2 }} aria-hidden="true" />
          </div>

          {/* MEMO LOG — local always shown; Spotify log always shown below (contains CONNECT button) */}
          {!isSpotify && (
            <VoxNovaLocalMemo
              contentWidth={CONTENT_WIDTH}
              memo={memo}
              selectedTrack={selectedTrack}
              trackInfo={engine.trackInfo}
              duration={engine.duration}
            />
          )}

          {/* Spotify memo log — always rendered; shows CONNECT when not authenticated */}
          <VoxNovaSpotifyMemo
            contentWidth={CONTENT_WIDTH}
            playerState={spotifyPlayerState}
            track={spotifyTrack}
          />

          {/* Video / Visual / Album-art stage */}
          <VoxNovaArtwork
            isSpotify={isSpotify}
            contentWidth={CONTENT_WIDTH}
            isPlaying={activeEngine.isPlaying}
            videoSrc={!isSpotify && selectedTrack?.isVideo ? selectedTrack.url : undefined}
            videoRef={!isSpotify && selectedTrack?.isVideo ? videoElRef : undefined}
            spotifyImageUrl={spotifyAlbumArt ?? undefined}
            spotifyTrackName={spotifyTrack?.name}
            spotifyArtistsLabel={spotifyArtists}
            overlay={!isSpotify ? stageOverlay : undefined}
            visualSeed={!isSpotify && selectedTrack && !selectedTrack.isVideo ? selectedTrack.id : undefined}
          />

          {/* Transport */}
          <div style={{ alignSelf: 'center', width: CONTENT_WIDTH,
            border: `1px solid ${isSpotify ? `${SPOTIFY_GREEN}55` : `${LCARS.peach}33`}`,
            borderRadius: 4, padding: '12px 16px',
            background: isSpotify ? 'rgba(29,185,84,0.06)' : LCARS_BOX_COLORS[2],
            display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SeekBar currentTime={activeEngine.currentTime} duration={activeEngine.duration} onSeek={activeEngine.seek} disabled={!hasActiveTrack} />
            <PlayerControls engine={activeEngine} onPrev={handlePrevTrack} onNext={handleNextTrack} disabled={!hasActiveTrack} />
            {!stageHasVolume && <VolumeControl volume={activeEngine.volume} onChange={activeEngine.setVolume} />}
          </div>

          <div style={{ flex: 1, minHeight: 0 }} aria-hidden="true" />

          {/* Frequency scan */}
          {!isSpotify && selectedTrack && (
            <VoxNovaFrequencyPanel
              wideWidth={WIDE_WIDTH}
              isVideo={selectedTrack.isVideo}
              isPlaying={engine.isPlaying}
              analyser={analyser}
              audioRef={engine.audioRef}
            />
          )}

          {/* Spotify browser — only when authenticated and in spotify mode */}
          {isSpotify && spotifyStatus === 'authenticated' && (
            <SpotifyBrowserSection contentWidth={CONTENT_WIDTH} />
          )}

          {/* Singularity status */}
          <VoxNovaFooter
            isPlaying={activeEngine.isPlaying}
            analyser={analyser}
            wideWidth={WIDE_WIDTH}
          />
        </div>
      </main>
    </div>
  );
}

/**
 * Public entry point. Wraps the whole player — including the audio-engine
 * hooks and their derived UI — in an ErrorBoundary so an uncaught failure in
 * the engine degrades gracefully instead of taking down the entire app shell.
 */
export function VoxNovaPlayer() {
  return (
    <ErrorBoundary label="Audio player">
      <VoxNovaPlayerInner />
    </ErrorBoundary>
  );
}
