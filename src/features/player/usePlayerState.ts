/**
 * usePlayerState
 * All mutable state + side-effects for the Player panel.
 * No JSX — pure hook.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Track, LibraryTab, ScanType } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GCS_BASE = 'https://storage.googleapis.com/producer-app-public/clips/';
const STORAGE_KEY = 'voxnova_library';

const CLOUD_LIBRARY: Track[] = [
  { id: 'af979000-81a1-4620-89d7-41adb4ed9279', title: 'Nebula Flight',  source: 'cloud', memo: '', linked: true },
  { id: 'df02bd7a-908d-4e30-b6d0-ebf38c79c895', title: 'Stellar Voyage', source: 'cloud', memo: '', linked: true },
];

// ---------------------------------------------------------------------------
// Beep helper (fire-and-forget, no external dep)
// ---------------------------------------------------------------------------
function playBeep(freq = 440, type: OscillatorType = 'sine', duration = 0.1) {
  try {
    const ctx = new (window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------
function loadLibrary(): Track[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return CLOUD_LIBRARY;
    const parsed: Track[] = JSON.parse(raw);
    // Blob URLs expire on reload — mark local tracks as unlinked
    return parsed.map(t => ({ ...t, linked: t.source === 'cloud' }));
  } catch {
    return CLOUD_LIBRARY;
  }
}

function saveLibrary(lib: Track[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lib)); } catch { /* quota */ }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function usePlayerState() {
  const [library,      setLibrary]      = useState<Track[]>(() => loadLibrary());
  const [selectedTrack, setSelectedTrack] = useState<Track>(() => loadLibrary()[0]);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [libraryTab,   setLibraryTab]   = useState<LibraryTab>('cloud');
  const [scanType,     setScanType]     = useState<ScanType>('wav');
  const [scanPattern,  setScanPattern]  = useState('');

  const audioRef      = useRef<HTMLAudioElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Persist library
  useEffect(() => { saveLibrary(library); }, [library]);

  // Sync audio element
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.play().catch(console.error);
    else           audioRef.current.pause();
  }, [isPlaying, selectedTrack]);

  // ---------------------------------------------------------------------------
  // Derived helpers
  // ---------------------------------------------------------------------------
  const filteredTracks = library.filter(t => t.source === libraryTab);

  const getAudioUrl = useCallback((track: Track) => {
    if (track.source === 'local') return track.id; // blob URL
    return `${GCS_BASE}${track.id}.m4a`;
  }, []);

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  const togglePlay = useCallback(() => {
    playBeep(isPlaying ? 440 : 660);
    setIsPlaying(p => !p);
  }, [isPlaying]);

  const handleNext = useCallback(() => {
    playBeep(600);
    const idx = filteredTracks.findIndex(t => t.id === selectedTrack.id);
    if (idx !== -1 && filteredTracks.length > 0) {
      setSelectedTrack(filteredTracks[(idx + 1) % filteredTracks.length]);
      setIsPlaying(true);
    }
  }, [filteredTracks, selectedTrack]);

  const handlePrevious = useCallback(() => {
    playBeep(600);
    const idx = filteredTracks.findIndex(t => t.id === selectedTrack.id);
    if (idx !== -1 && filteredTracks.length > 0) {
      setSelectedTrack(filteredTracks[(idx - 1 + filteredTracks.length) % filteredTracks.length]);
      setIsPlaying(true);
    }
  }, [filteredTracks, selectedTrack]);

  const handleTrackSelect = useCallback((track: Track) => {
    if (!track.linked) { playBeep(200, 'square', 0.2); return; }
    playBeep(440 + Math.random() * 200);
    setSelectedTrack(track);
    setIsPlaying(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Library mutations
  // ---------------------------------------------------------------------------
  const purgeCloudMemory = useCallback(() => {
    playBeep(220, 'sawtooth', 0.3);
    setLibrary(prev => prev.filter(t => t.source !== 'cloud'));
    if (selectedTrack.source === 'cloud') {
      const first = library.find(t => t.source === 'local');
      if (first) setSelectedTrack(first);
    }
  }, [library, selectedTrack]);

  const updateMemo = useCallback((text: string) => {
    setLibrary(prev => prev.map(t => t.id === selectedTrack.id ? { ...t, memo: text } : t));
    setSelectedTrack(prev => ({ ...prev, memo: text }));
  }, [selectedTrack]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    playBeep(880, 'square', 0.05);
    const url = URL.createObjectURL(file);
    const newTrack: Track = {
      id: url, title: file.name.replace(/\.[^.]+$/, ''),
      source: 'local', memo: '', fileName: file.name, linked: true,
    };
    setLibrary(prev => [newTrack, ...prev.filter(t => t.fileName !== file.name)]);
    setSelectedTrack(newTrack);
    setIsPlaying(true);
    setLibraryTab('local');
  }, []);

  const handleFolderScan = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    playBeep(900, 'square', 0.1);
    setLibrary(prev => {
      const updated = [...prev];
      let firstScanned: Track | null = null;
      Array.from(files).forEach(file => {
        const name = file.name.toLowerCase();
        const matchType = scanType === 'all' || name.endsWith(`.${scanType}`);
        const matchPat  = !scanPattern || name.includes(scanPattern.toLowerCase());
        if (!matchType || !matchPat) return;
        const parts  = file.webkitRelativePath?.split('/') ?? [];
        const folder = parts.length > 1 ? parts[parts.length - 2] : 'SectorRoot';
        const url    = URL.createObjectURL(file);
        const existIdx = updated.findIndex(t => t.fileName === file.name);
        if (existIdx !== -1) {
          updated[existIdx] = { ...updated[existIdx], id: url, linked: true };
          if (!firstScanned) firstScanned = updated[existIdx];
        } else {
          const t: Track = {
            id: url, title: folder, source: 'local', fileName: file.name,
            memo: `LCARS_SCAN: ${file.name} [${scanType.toUpperCase()}]`, linked: true,
          };
          updated.unshift(t);
          if (!firstScanned) firstScanned = t;
        }
      });
      if (firstScanned) {
        playBeep(1200, 'sine', 0.05);
        setSelectedTrack(firstScanned);
        setIsPlaying(true);
        setLibraryTab('local');
      } else {
        playBeep(200, 'square', 0.5);
      }
      return updated;
    });
  }, [scanType, scanPattern]);

  return {
    library, selectedTrack, isPlaying, libraryTab, scanType, scanPattern,
    filteredTracks,
    audioRef, fileInputRef, folderInputRef,
    getAudioUrl, togglePlay, handleNext, handlePrevious,
    handleTrackSelect, purgeCloudMemory, updateMemo,
    handleFileChange, handleFolderScan,
    setLibraryTab, setScanType, setScanPattern, setIsPlaying,
  };
}
