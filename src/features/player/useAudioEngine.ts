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
    case 'aif':
    case 'aiff': return 'AIFF';
    case 'wma':  return 'WMA';
    case 'm4a':  return 'AAC/M4A';
    case 'opus': return 'OPUS';
    case 'mp4':  return 'H.264+AAC';
    case 'webm': return 'VP9+Opus';
    case 'mov':  return 'H.264/MOV';
    case 'mkv':  return 'Matroska';
    case 'avi':  return 'AVI';
    case 'm4v':  return 'H.264/M4V';
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

const CLOUD_PROBE_BYTES = 64 * 1024;

function parseContentLength(headers: Headers): number | null {
  const len = Number(headers.get('content-length'));
  return Number.isFinite(len) && len >= 0 ? len : null;
}

function parseContentRangeSize(headers: Headers): number | null {
  const match = headers.get('content-range')?.match(/^bytes \d+-\d+\/(\d+)$/);
  if (!match) return null;
  const size = Number(match[1]);
  return Number.isFinite(size) ? size : null;
}

function calculateBitrate(fileSize: number | null, duration: number): number | null {
  return fileSize !== null && duration > 0
    ? Math.round((fileSize * 8) / duration / 1000)
    : null;
}

function determineFileSize(
  fileSizeBytes: number | null,
  headers: Headers,
  status: number,
  bufferLength: number,
): number | null {
  if (fileSizeBytes !== null) return fileSizeBytes;
  const rangeSize = parseContentRangeSize(headers);
  if (rangeSize !== null) return rangeSize;
  return status === 206 ? null : bufferLength;
}

async function cancelResponseBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch (error) {
    console.warn('[probeAudioFile] Failed to cancel oversized response:', error);
  }
}

async function probeAudioFile(
  url: string,
  fileSizeBytes: number | null,
  duration: number,
  maxProbeBytes?: number,
): Promise<Partial<TrackInfo>> {
  const fallbackBitrate = calculateBitrate(fileSizeBytes, duration);
  try {
    const res = await fetch(url, maxProbeBytes
      ? { headers: { Range: `bytes=0-${maxProbeBytes - 1}` } }
      : undefined);
    const contentLength = parseContentLength(res.headers);
    const declaredSize = contentLength ?? fileSizeBytes;
    if (maxProbeBytes && res.status !== 206 && declaredSize !== null && declaredSize > maxProbeBytes) {
      await cancelResponseBody(res);
      return { bitrateKbps: fallbackBitrate };
    }
    const buf = await res.arrayBuffer();
    if (maxProbeBytes && buf.byteLength > maxProbeBytes) {
      return { bitrateKbps: fallbackBitrate };
    }
    const AudioCtx = window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return { bitrateKbps: fallbackBitrate };
    const ctx = new AudioCtx();
    const decoded = await ctx.decodeAudioData(buf);
    await ctx.close();
    const ch = decoded.numberOfChannels;
    const sr = decoded.sampleRate;
    const size = determineFileSize(fileSizeBytes, res.headers, res.status, buf.byteLength);
    const bitrate = calculateBitrate(size, duration);
    return { channels: ch, sampleRate: sr, bitrateKbps: bitrate, channelLabel: channelLabel(ch), isVideo: false };
  } catch {
    return { bitrateKbps: fallbackBitrate };
  }
}

export function useAudioEngine(): AudioEngineState {
  const internalAudioRef = useRef<HTMLAudioElement>(new Audio());
  const activeMediaRef = useRef<HTMLMediaElement>(internalAudioRef.current);
  const audioRef = useRef<HTMLMediaElement>(internalAudioRef.current);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.5);
  const [repeat, setRepeat] = useState<RepeatMode>('none');
  const [shuffle, setShuffle] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [crossfadeMs, setCrossfadeMsState] = useState(0);
  const [sleepTimerEnd, setSleepTimerEndState] = useState<number | null>(null);
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);

  // Stores the current track title so attachVideoElement can call
  // codecFromTitle(title) instead of codecFromTitle(el.src) — el.src
  // is a blob: URL at runtime, not the original filename.
  const currentTrackTitleRef = useRef<string>('');

  useEffect(() => { internalAudioRef.current.volume = 0.5; }, []);

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
    setSleepTimerEndState(end);
    sleepTimerRef.current = setTimeout(() => {
      activeMediaRef.current.pause();
      setSleepTimerEndState(null);
      sleepTimerRef.current = null;
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
    audioRef.current = el;
    el.volume = volume;
    bindListeners(el);

    const onMeta = () => {
      // Use the track title (stored in ref by loadTrack) — el.src is a blob:
      // URL at runtime and yields a UUID fragment instead of an extension.
      const guessedCodec = codecFromTitle(currentTrackTitleRef.current);
      const info: TrackInfo = {
        channels: 2,
        sampleRate: null,
        bitrateKbps: null,
        channelLabel: 'STEREO',
        codec: guessedCodec,
        isVideo: true,
      };
      // Non-standard audioTracks API (Firefox / some Chromium builds).
      // Guard with Number.isFinite: the API can return undefined or NaN
      // on builds that expose the property but don't populate it.
      type MediaWithAudio = HTMLVideoElement & { audioTracks?: { length: number } };
      const at = (el as MediaWithAudio).audioTracks;
      const atLen = at?.length;
      if (Number.isFinite(atLen) && (atLen as number) > 0) {
        info.channels = (atLen as number) * 2;
      }
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
    // Always update the title ref first so attachVideoElement.onMeta
    // can read the correct filename when it fires.
    currentTrackTitleRef.current = track.title;
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
      const trackSize = track.oneDriveSize ?? null;
      const probeLimit = track.source === 'cloud' ? CLOUD_PROBE_BYTES : undefined;
      el.addEventListener('loadedmetadata', () => {
        const dur = el.duration || 0;
        probeAudioFile(srcUrl, trackSize, dur, probeLimit).then(info => {
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

  const beep = useCallback((freq = 440, type: OscillatorType = 'sine', beepDuration = 0.1) => {
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
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + beepDuration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + beepDuration);
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
