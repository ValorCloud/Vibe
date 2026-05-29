import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioEngine } from './useAudioEngine';
import { useFrequencyAnalyser } from './useFrequencyAnalyser';
import { useLibraryContext } from '../../contexts/LibraryContext';
import { usePlayerNavigation } from './usePlayerNavigation';
import { useSpotifyAuthState } from '../../contexts/SpotifyAuthContext';
import { useSpotifyEngine_ } from '../../contexts/SpotifyEngineContext';
import { useSpotifyAsEngine } from './useSpotifyAsEngine';
import type { AudioSource } from './VoxNovaHeader';
import { LIBRARY_CAPACITY } from './playerConstants';

function isEditableSpaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button';
}

/**
 * Orchestration hook for the VoxNova player. Owns all engine wiring, audio-source
 * state, derived UI values and keyboard/transport handlers so that VoxNovaPlayer
 * itself stays a thin presentational composition root.
 */
export function useVoxNovaPlayer() {
  const engine = useAudioEngine();
  const spotifyEngine = useSpotifyAsEngine();
  const { playerState: spotifyPlayerState, playbackState: spotifyPlaybackState, controls: spotifyControls } = useSpotifyEngine_();
  const analyser = useFrequencyAnalyser();
  const library = useLibraryContext();

  const [audioSource, setAudioSource] = useState<AudioSource>('local');

  const { status: spotifyStatus } = useSpotifyAuthState();
  const prevSpotifyStatus = useRef(spotifyStatus);
  useEffect(() => {
    // Auto-switch to Spotify on successful auth; do NOT force back to local on disconnect
    // — VoxNovaSpotifyMemo is always visible and shows CONNECT inline.
    if (
      prevSpotifyStatus.current !== 'authenticated'
      && spotifyStatus === 'authenticated'
      && spotifyPlaybackState !== null
    ) {
      setAudioSource('spotify');
    }
    prevSpotifyStatus.current = spotifyStatus;
  }, [spotifyStatus, spotifyPlaybackState]);

  const videoElRef = useRef<HTMLVideoElement>(null);

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

  const handlePurge = useCallback(() => {
    if (typeof window !== 'undefined' && !window.confirm('Purge all tracks from local cache?')) return;
    library.purgeAll(); setSelectedId(null); engine.pause();
  }, [library, setSelectedId, engine]);

  const isSpotify = audioSource === 'spotify';
  const activeEngine = useMemo(
    () => (isSpotify ? spotifyEngine : engine),
    [isSpotify, spotifyEngine, engine],
  );

  const spotifyTrack = spotifyPlaybackState?.track_window?.current_track;
  const spotifyArtists = (spotifyTrack?.artists ?? []).map(a => a.name).join(', ');
  const spotifyAlbumArt = spotifyTrack?.album?.images?.[0]?.url ?? null;

  const hasActiveTrack = isSpotify ? !!spotifyTrack : !!selectedTrack;

  // Sidebar is hidden while the player is active (playing)
  const sidebarHidden = activeEngine.isPlaying;

  const handleSpacePlayPause = useCallback((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.code !== 'Space' || isEditableSpaceTarget(event.target)) return;
    if (isSpotify) {
      if (!spotifyTrack) return;
      event.preventDefault();
      spotifyEngine.togglePlay();
    } else {
      if (!selectedTrack) return;
      event.preventDefault();
      engine.togglePlay();
    }
  }, [engine, spotifyEngine, selectedTrack, spotifyTrack, isSpotify]);

  const handlePrevTrack = useCallback(() => {
    if (isSpotify) { void spotifyControls.previousTrack(); return; }
    void handlePrev();
  }, [isSpotify, spotifyControls, handlePrev]);

  const handleNextTrack = useCallback(() => {
    if (isSpotify) { void spotifyControls.nextTrack(); return; }
    void handleNext();
  }, [isSpotify, spotifyControls, handleNext]);

  useEffect(() => {
    window.addEventListener('keydown', handleSpacePlayPause);
    return () => window.removeEventListener('keydown', handleSpacePlayPause);
  }, [handleSpacePlayPause]);

  const structuralIntegrity = isSpotify
    ? (hasActiveTrack ? 1 : 0)
    : Math.min(1, library.tracks.length / LIBRARY_CAPACITY);
  const neuralBuffer = activeEngine.duration > 0 ? Math.min(1, activeEngine.currentTime / activeEngine.duration) : 0;
  const memo = selectedTrack?.memo || (selectedTrack ? `[LCARS_SCAN] Identified: ${selectedTrack.title} | Integrity: Nominal` : '[LCARS_SCAN] Standby — awaiting signal selection.');
  const title = isSpotify
    ? (spotifyTrack?.name ?? 'Subspace Channel Idle')
    : (selectedTrack?.title ?? 'Subspace Channel Idle');

  const lyriaCount = library.tracks.filter(t => t.source === 'lyria').length;
  const prevLyriaCount = useRef(lyriaCount);
  useEffect(() => { if (lyriaCount > prevLyriaCount.current) setView('lyria'); prevLyriaCount.current = lyriaCount; }, [lyriaCount, setView]);

  return {
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
  };
}
