import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TrackEntry } from './types';
import type { AudioEngineState } from './useAudioEngine';

export type LibraryView = 'cloud' | 'local' | 'lyria';

const CROSSFADE_STEP_COUNT = 8;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export interface PlayerNavigation {
  view: LibraryView;
  setView: (v: LibraryView) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedTrack: TrackEntry | undefined;
  visibleTracks: TrackEntry[];
  handleSelect: (track: TrackEntry) => Promise<void>;
  handlePrev: () => Promise<void>;
  handleNext: () => Promise<void>;
}

interface UsePlayerNavigationOptions {
  tracks: TrackEntry[];
  engine: AudioEngineState;
}

/**
 * usePlayerNavigation encapsulates the player's library view, track
 * selection, and prev/next/select handlers that were previously inlined
 * inside VoxNovaPlayer. Splitting it out keeps VoxNovaPlayer focused on
 * layout/composition.
 */
export function usePlayerNavigation({ tracks, engine }: UsePlayerNavigationOptions): PlayerNavigation {
  const [view, setView] = useState<LibraryView>('cloud');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedTrack = useMemo(() => tracks.find(t => t.id === selectedId), [tracks, selectedId]);
  const visibleTracks = useMemo(() => tracks.filter(t => t.source === view), [tracks, view]);

  // Keep latest engine flags accessible inside stable callbacks to avoid
  // re-binding the onTrackEnded handler on every render.
  const shuffleRef = useRef(engine.shuffle);
  const repeatRef = useRef(engine.repeat);
  const autoplayRef = useRef(engine.autoplay);
  useEffect(() => { shuffleRef.current = engine.shuffle; }, [engine.shuffle]);
  useEffect(() => { repeatRef.current = engine.repeat; }, [engine.repeat]);
  useEffect(() => { autoplayRef.current = engine.autoplay; }, [engine.autoplay]);

  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const fadeCurrentVolume = useCallback(async (from: number, to: number, durationMs: number) => {
    const steps = Math.max(1, CROSSFADE_STEP_COUNT);
    const stepMs = Math.max(16, durationMs / steps);
    for (let i = 1; i <= steps; i++) {
      engine.setVolume(from + ((to - from) * i) / steps);
      await wait(stepMs);
    }
  }, [engine]);

  const activateTrack = useCallback(async (track: TrackEntry, beepFrequency: number, useCrossfade: boolean) => {
    const restoreVolume = engine.volume;
    const shouldFade = useCrossfade && engine.crossfadeMs > 0 && engine.isPlaying && restoreVolume > 0;
    if (shouldFade) await fadeCurrentVolume(restoreVolume, 0, engine.crossfadeMs);
    setSelectedId(track.id);
    await engine.loadTrack(track);
    if (!track.isVideo) await engine.play();
    if (shouldFade) engine.setVolume(restoreVolume);
    engine.beep(beepFrequency, 'sine', 0.04);
  }, [engine, fadeCurrentVolume]);

  const handleNext = useCallback(async () => {
    if (!visibleTracks.length) return;
    const idx = visibleTracks.findIndex(t => t.id === selectedIdRef.current);
    let next: TrackEntry | undefined;
    if (shuffleRef.current) {
      const others = visibleTracks.filter(t => t.id !== selectedIdRef.current);
      next = others.length ? others[Math.floor(Math.random() * others.length)] : visibleTracks[0];
    } else {
      next = idx < 0 ? visibleTracks[0] : visibleTracks[idx >= visibleTracks.length - 1 ? 0 : idx + 1];
    }
    if (next) await activateTrack(next, 1100, true);
  }, [visibleTracks, activateTrack]);

  const handlePrev = useCallback(async () => {
    if (!visibleTracks.length) return;
    const idx = visibleTracks.findIndex(t => t.id === selectedIdRef.current);
    const prev = idx < 0 ? visibleTracks[0] : visibleTracks[idx === 0 ? visibleTracks.length - 1 : idx - 1];
    if (prev) await activateTrack(prev, 660, true);
  }, [visibleTracks, activateTrack]);

  const handleSelect = useCallback(async (track: TrackEntry) => {
    setSelectedId(track.id);
    if (track.isVideo) {
      engine.beep(880, 'sine', 0.05);
    } else {
      await engine.loadTrack(track);
      await engine.play();
      engine.beep(880, 'sine', 0.05);
    }
  }, [engine]);

  useEffect(() => {
    engine.setOnTrackEnded(() => {
      if (repeatRef.current !== 'none' || autoplayRef.current) handleNext();
    });
    return () => engine.setOnTrackEnded(undefined);
  }, [engine, handleNext]);

  return { view, setView, selectedId, setSelectedId, selectedTrack, visibleTracks, handleSelect, handlePrev, handleNext };
}
