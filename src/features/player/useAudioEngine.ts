import { useRef, useState, useCallback, useEffect } from 'react';
import type { TrackEntry } from './types';

export type RepeatMode = 'none' | 'one' | 'all';

export interface TrackInfo {
  channels: number | null;
  sampleRate: number | null;
  bitrateKbps: number | null;
  channelLabel: string;
  codec: string | null;
  isVideo: boolean;
}

export interface AudioEngineState {
  audioRef: React.RefObject<HTMLMediaElement>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeat: RepeatMode;
  shuffle: boolean;
  autoplay: boolean;
  crossfadeMs: number;
  sleepTimerEnd: number | null;
  trackInfo: TrackInfo | null;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  loadTrack: (track: TrackEntry) => Promise<void>;
  beep: (freq?: number, type?: OscillatorType, duration?: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  toggleAutoplay: () => void;
  setCrossfadeMs: (ms: number) => void;
  setSleepTimer: (ms: number | null) => void;
  onTrackEnded?: () => void;
  setOnTrackEnded: (cb: (() => void) | undefined) => void;
  attachVideoElement: (el: HTMLVideoElement | null) => void;
}

function channelLabel(n: number): string {
  if (n === 1) return 'MONO';
  if (n === 2) return 'STEREO';
  if (n === 6) return '5.1 SURROUND';
  if (n === 8) return '7.1 SURROUND';
  return `${n}CH`;
}

/** Infer codec label from file extension */
function codecFromTitle(title: string): string | null {
  const ext = title.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp3':  return 'MP3';
    case 'wav':  return 'PCM/WAV';
    case 'flac': return 'FLAC';
    case 'ogg':  return 'Vorbis/OGG';
    case 'aac':  return 'AAC';
    case 'm4a':  return 'AAC/M4A';
    case 'opus': return 'OPUS';
    case 'mp4':  return 'H.264+AAC';
    case 'webm': return 'VP9+Opus';
    case 'mov':  return 'H.264/MOV';
    case 'mkv':  return 'MKV';
    default:     return ext ? ext.toUpperCase() : null;
  }
}

function waitForMediaReady(el: HTMLMediaElement): Promise<void> {
  if (el.readyState >= 3) return Promise.resolve();

  return new Promise(resolve => {
    const finish = () => {
      el.removeEventListener('canplay', finish);
      el.removeEventListener('loadedmetadata', finish);
      el.removeEventListener('error', finish);
      resolve();
    };

    el.addEventListener('canplay', finish);
    el.addEventListener('loadedmetadata', finish);
    el.addEventListener('error', finish);
  });
}

async function probeAudioFile(
  url: string,
  fileSizeBytes: number | null,
  duration: number,
): Promise<Partial<TrackInfo>> {
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const AudioCtx = window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return {};
    const ctx = new AudioCtx();
    const decoded = await ctx.decodeAudioData(buf);
    await ctx.close();
    const ch = decoded.numberOfChannels;
    const sr = decoded.sampleRate;
    const size = fileSizeBytes ?? buf.byteLength;
    const bitrate = duration > 0 ? Math.round((size * 8) / duration / 1000) : null;
    return { channels: ch, sampleRate: sr, bitrateKbps: bitrate, channelLabel: channelLabel(ch), isVideo: false };
  } catch {
    return {};
  }
}

export function useAudioEngine(): AudioEngineState {
  const internalAudioRef = useRef<HTMLAudioElement>(new Audio());
  const activeMediaRef = useRef<HTMLMediaElement>(internalAudioRef.current);
  const audioRef = useRef<HTMLMediaElement>(internalAudioRef.current);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [repeat, setRepeat] = useState<RepeatMode>('none');
  const [shuffle, setShuffle] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [crossfadeMs, setCrossfadeMsState] = useState(0);
  const [sleepTimerEnd, setSleepTimerEndState] = useState<number | null>(null);
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);

  const repeatRef = useRef<RepeatMode>('none');
  const onTrackEndedRef = useRef<(() => void) | undefined>(undefined);
  const setOnTrackEnded = useCallback((cb: (() => void) | undefined) => { onTrackEndedRef.current = cb; }, []);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  // Sleep timer — fire onTrackEnded (i.e. stop) when time is up
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSleepTimer = useCallback((ms: number | null) => {
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
    if (ms === null) { setSleepTimerEndState(null); return; }
    const end = Date.now() + ms;
    const media = activeMediaRef.current;
    setSleepTimerEndState(end);
    sleepTimerRef.current = setTimeout(() => {
      media.pause();
      setSleepTimerEndState(null);
    }, ms);
  }, []);

  // Cleanup sleep timer on unmount
  useEffect(() => () => { if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current); }, []);

  const setCrossfadeMs = useCallback((ms: number) => { setCrossfadeMsState(ms); }, []);

  const boundEl = useRef<HTMLMediaElement | null>(null);

  // FIX #3: add 'play' and 'pause' events so isPlaying reflects native <video> state
  const bindListeners = useCallback((el: HTMLMediaElement) => {
    if (boundEl.current === el) return;
    if (boundEl.current) {
      const prev = boundEl.current;
      prev.removeEventListener('timeupdate', onTime);
      prev.removeEventListener('loadedmetadata', onDuration);
      prev.removeEventListener('ended', onEnded);
      prev.removeEventListener('play', onPlay);
      prev.removeEventListener('pause', onPause);
    }
    boundEl.current = el;
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onDuration);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTime(this: HTMLMediaElement) { setCurrentTime(this.currentTime); }
  function onDuration(this: HTMLMediaElement) { setDuration(this.duration || 0); }
  function onPlay() { setIsPlaying(true); }
  function onPause() { setIsPlaying(false); }
  function onEnded(this: HTMLMediaElement) {
    if (repeatRef.current === 'one') {
      this.currentTime = 0;
      this.play().catch(() => {});
    } else {
      onTrackEndedRef.current?.();
    }
  }

  useEffect(() => {
    bindListeners(internalAudioRef.current);
    return () => {
      const el = boundEl.current;
      if (el) {
        el.removeEventListener('timeupdate', onTime);
        el.removeEventListener('loadedmetadata', onDuration);
        el.removeEventListener('ended', onEnded);
        el.removeEventListener('play', onPlay);
        el.removeEventListener('pause', onPause);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIX #1: attachVideoElement — wire play/pause + probe codec + keep audioRef for EQ
  const attachVideoElement = useCallback((el: HTMLVideoElement | null) => {
    if (!el) {
      activeMediaRef.current = internalAudioRef.current;
      audioRef.current = internalAudioRef.current;
      bindListeners(internalAudioRef.current);
      return;
    }
    activeMediaRef.current = el;
    // NOTE: audioRef stays pointing to internalAudioRef so FrequencyVisualizer
    // can still analyse audio via the WebAudio graph (video cannot be piped
    // through createMediaElementSource twice). The EQ animates from the
    // internal audio element which mirrors the video's audio track via
    // the analyser initialised in FrequencyVisualizer.
    // We DO update audioRef so the visualiser re-inits on the video element.
    audioRef.current = el;
    el.volume = volume;
    bindListeners(el);

    const onMeta = () => {
      // FIX #4: infer codec from the src filename stored on the element
      const srcName = el.src ?? '';
      const guessedCodec = codecFromTitle(srcName);
      const info: TrackInfo = {
        channels: 2,
        sampleRate: null,
        bitrateKbps: null,
        channelLabel: 'STEREO',
        codec: guessedCodec,
        isVideo: true,
      };
      // Non-standard audioTracks API (Firefox / some Chromium builds)
      type MediaWithAudio = HTMLVideoElement & { audioTracks?: { length: number } };
      const at = (el as MediaWithAudio).audioTracks;
      if (at && at.length) info.channels = at.length * 2;
      if (info.channels) info.channelLabel = channelLabel(info.channels);
      setTrackInfo(info);
    };
    el.addEventListener('loadedmetadata', onMeta, { once: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindListeners]);

  const play = useCallback(async () => {
    try {
      await activeMediaRef.current.play();
    } catch {}
  }, []);
  const pause = useCallback(() => { activeMediaRef.current.pause(); }, []);
  const togglePlay = useCallback(() => {
    if (activeMediaRef.current.paused) activeMediaRef.current.play().catch(() => {});
    else activeMediaRef.current.pause();
  }, []);
  const seek = useCallback((t: number) => { activeMediaRef.current.currentTime = t; setCurrentTime(t); }, []);
  const setVolume = useCallback((v: number) => { activeMediaRef.current.volume = v; setVolumeState(v); }, []);

  const loadTrack = useCallback(async (track: TrackEntry) => {
    if (!track.url) return;
    if (!track.isVideo) {
      const el = internalAudioRef.current;
      el.src = track.url;
      el.load();
      const ready = waitForMediaReady(el);
      activeMediaRef.current = el;
      audioRef.current = el;
      bindListeners(el);
      setTrackInfo(null);
      const srcUrl = track.url;
      const trackTitle = track.title;
      el.addEventListener('loadedmetadata', () => {
        const dur = el.duration || 0;
        probeAudioFile(srcUrl, null, dur).then(info => {
          setTrackInfo({
            channels: info.channels ?? null,
            sampleRate: info.sampleRate ?? null,
            bitrateKbps: info.bitrateKbps ?? null,
            channelLabel: info.channelLabel ?? (info.channels === 1 ? 'MONO' : 'STEREO'),
            // FIX #4: codec from file title extension
            codec: codecFromTitle(trackTitle),
            isVideo: false,
          });
        });
      }, { once: true });
      setCurrentTime(0);
      await ready;
    } else {
      setCurrentTime(0);
    }
  }, [bindListeners]);

  const toggleRepeat = useCallback(() => { setRepeat(r => r === 'none' ? 'one' : r === 'one' ? 'all' : 'none'); }, []);
  const toggleShuffle = useCallback(() => { setShuffle(s => !s); }, []);
  const toggleAutoplay = useCallback(() => { setAutoplay(a => !a); }, []);

  const beep = useCallback((freq = 440, type: OscillatorType = 'sine', duration = 0.1) => {
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
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }, []);

  return {
    audioRef, isPlaying, currentTime, duration, volume,
    repeat, shuffle, autoplay, crossfadeMs, sleepTimerEnd, trackInfo,
    play, pause, togglePlay, seek, setVolume, loadTrack, beep,
    toggleRepeat, toggleShuffle, toggleAutoplay, setCrossfadeMs, setSleepTimer,
    setOnTrackEnded, attachVideoElement,
  };
}
