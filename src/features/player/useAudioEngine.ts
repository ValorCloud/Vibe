import { useRef, useState, useCallback, useEffect } from 'react';
import type { TrackEntry } from './types';

export type RepeatMode = 'none' | 'one' | 'all';

export interface AudioEngineState {
  /** Ref to the underlying media element — may be <audio> or <video> */
  audioRef: React.RefObject<HTMLMediaElement>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeat: RepeatMode;
  shuffle: boolean;
  autoplay: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  loadTrack: (track: TrackEntry) => void;
  beep: (freq?: number, type?: OscillatorType, duration?: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  toggleAutoplay: () => void;
  /** Called by the player when a track ends (for repeat-all / shuffle handling) */
  onTrackEnded?: () => void;
  setOnTrackEnded: (cb: (() => void) | undefined) => void;
  /** Attach an external <video> element as the active media element */
  attachVideoElement: (el: HTMLVideoElement | null) => void;
}

export function useAudioEngine(): AudioEngineState {
  // Primary audio element for non-video tracks
  const internalAudioRef = useRef<HTMLAudioElement>(new Audio());
  // Points to either the internal Audio or an external <video> el
  const activeMediaRef = useRef<HTMLMediaElement>(internalAudioRef.current);
  // Exposed ref used by consumers (PlayerControls, FrequencyVisualizer, etc.)
  const audioRef = useRef<HTMLMediaElement>(internalAudioRef.current);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [repeat, setRepeat] = useState<RepeatMode>('none');
  const [shuffle, setShuffle] = useState(false);
  const [autoplay, setAutoplay] = useState(true);

  const repeatRef = useRef<RepeatMode>('none');
  const onTrackEndedRef = useRef<(() => void) | undefined>(undefined);

  const setOnTrackEnded = useCallback((cb: (() => void) | undefined) => {
    onTrackEndedRef.current = cb;
  }, []);

  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  // ── Wire event listeners to the currently active media element ─────────
  const boundEl = useRef<HTMLMediaElement | null>(null);

  const bindListeners = useCallback((el: HTMLMediaElement) => {
    if (boundEl.current === el) return;
    // Unbind previous
    if (boundEl.current) {
      const prev = boundEl.current;
      prev.removeEventListener('timeupdate', onTime);
      prev.removeEventListener('loadedmetadata', onDuration);
      prev.removeEventListener('ended', onEnded);
    }
    boundEl.current = el;
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onDuration);
    el.addEventListener('ended', onEnded);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTime(this: HTMLMediaElement) { setCurrentTime(this.currentTime); }
  function onDuration(this: HTMLMediaElement) { setDuration(this.duration || 0); }
  function onEnded(this: HTMLMediaElement) {
    if (repeatRef.current === 'one') {
      this.currentTime = 0;
      this.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      setIsPlaying(false);
      onTrackEndedRef.current?.();
    }
  }

  // Bind internal audio element on mount
  useEffect(() => {
    bindListeners(internalAudioRef.current);
    return () => {
      const el = boundEl.current;
      if (el) {
        el.removeEventListener('timeupdate', onTime);
        el.removeEventListener('loadedmetadata', onDuration);
        el.removeEventListener('ended', onEnded);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── attachVideoElement — called by VoxNovaPlayer when a video is selected ─
  const attachVideoElement = useCallback((el: HTMLVideoElement | null) => {
    if (!el) {
      // Revert to internal audio element
      activeMediaRef.current = internalAudioRef.current;
      audioRef.current = internalAudioRef.current;
      bindListeners(internalAudioRef.current);
      return;
    }
    activeMediaRef.current = el;
    audioRef.current = el;
    el.volume = activeMediaRef.current.volume;
    bindListeners(el);
  }, [bindListeners]);

  const play = useCallback(() => {
    activeMediaRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  }, []);

  const pause = useCallback(() => {
    activeMediaRef.current.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    const el = activeMediaRef.current;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  const seek = useCallback((t: number) => {
    activeMediaRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const setVolume = useCallback((v: number) => {
    activeMediaRef.current.volume = v;
    setVolumeState(v);
  }, []);

  const loadTrack = useCallback((track: TrackEntry) => {
    if (!track.url) return;
    // If the track is video, VoxNovaPlayer will call attachVideoElement first;
    // here we only handle audio tracks via the internal element.
    if (!track.isVideo) {
      const el = internalAudioRef.current;
      el.src = track.url;
      el.load();
      activeMediaRef.current = el;
      audioRef.current = el;
      bindListeners(el);
    }
    setCurrentTime(0);
    setIsPlaying(false);
  }, [bindListeners]);

  const toggleRepeat = useCallback(() => {
    setRepeat(r => r === 'none' ? 'one' : r === 'one' ? 'all' : 'none');
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle(s => !s);
  }, []);

  const toggleAutoplay = useCallback(() => {
    setAutoplay(a => !a);
  }, []);

  const beep = useCallback((
    freq = 440,
    type: OscillatorType = 'sine',
    duration = 0.1,
  ) => {
    try {
      const AudioCtx = window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }, []);

  return {
    audioRef, isPlaying, currentTime, duration, volume,
    repeat, shuffle, autoplay,
    play, pause, togglePlay, seek, setVolume, loadTrack, beep,
    toggleRepeat, toggleShuffle, toggleAutoplay,
    setOnTrackEnded, attachVideoElement,
  };
}
