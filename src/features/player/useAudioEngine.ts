import { useRef, useState, useCallback, useEffect } from 'react';
import type { TrackEntry } from './types';

export type RepeatMode = 'none' | 'one' | 'all';

export interface AudioEngineState {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeat: RepeatMode;
  shuffle: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  loadTrack: (track: TrackEntry) => void;
  beep: (freq?: number, type?: OscillatorType, duration?: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  /** Called by the player when a track ends (for repeat-all / shuffle handling) */
  onTrackEnded?: () => void;
  setOnTrackEnded: (cb: (() => void) | undefined) => void;
}

export function useAudioEngine(): AudioEngineState {
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [repeat, setRepeat] = useState<RepeatMode>('none');
  const [shuffle, setShuffle] = useState(false);

  // Mutable ref so onEnded closure always reads latest values without re-registering
  const repeatRef = useRef<RepeatMode>('none');
  const onTrackEndedRef = useRef<(() => void) | undefined>(undefined);

  const setOnTrackEnded = useCallback((cb: (() => void) | undefined) => {
    onTrackEndedRef.current = cb;
  }, []);

  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  useEffect(() => {
    const el = audioRef.current;
    const onTime = () => setCurrentTime(el.currentTime);
    const onDuration = () => setDuration(el.duration || 0);
    const onEnded = () => {
      if (repeatRef.current === 'one') {
        el.currentTime = 0;
        el.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        setIsPlaying(false);
        onTrackEndedRef.current?.();
      }
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onDuration);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onDuration);
      el.removeEventListener('ended', onEnded);
    };
  }, []);

  const play = useCallback(() => {
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  const seek = useCallback((t: number) => {
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const setVolume = useCallback((v: number) => {
    audioRef.current.volume = v;
    setVolumeState(v);
  }, []);

  const loadTrack = useCallback((track: TrackEntry) => {
    if (!track.url) return;
    const el = audioRef.current;
    el.src = track.url;
    el.load();
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeat(r => r === 'none' ? 'one' : r === 'one' ? 'all' : 'none');
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle(s => !s);
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
    repeat, shuffle,
    play, pause, togglePlay, seek, setVolume, loadTrack, beep,
    toggleRepeat, toggleShuffle,
    setOnTrackEnded,
  };
}
