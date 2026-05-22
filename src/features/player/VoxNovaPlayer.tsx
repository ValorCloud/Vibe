import { useEffect, useMemo, useRef, useState } from 'react';
import { FrequencyVisualizer } from './FrequencyVisualizer';
import { PlayerControls } from './PlayerControls';
import { PlayerSidebar } from './PlayerSidebar';
import { StatusBar, SeekBar, VolumeControl, BlackHoleBadge, ChipIcon, NetworkIcon } from './PlayerWidgets';
import { useAudioEngine } from './useAudioEngine';
import { useFrequencyAnalyser } from './useFrequencyAnalyser';
import { useLibraryContext } from '../../contexts/LibraryContext';
import { LCARS } from './lcarsTheme';
import type { TrackEntry, ScanConfig } from './types';

type LibraryView = 'cloud' | 'local' | 'lyria';

const LIBRARY_CAPACITY = 50;

const LCARS_BOX_COLORS = [
  'rgba(255,153,0,0.08)',
  'rgba(153,102,204,0.08)',
  'rgba(204,153,102,0.08)',
  'rgba(255,102,102,0.08)',
  'rgba(102,204,255,0.08)',
];

function genRegistry(): string {
  const buf = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function useSectorTime(): string {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      setT((performance.now() - start) / 100);
    }, 100);
    return () => window.clearInterval(id);
  }, []);
  const whole = Math.floor(t / 10).toString().padStart(4, '0');
  const dec = Math.floor(t % 10);
  return `${whole}.${dec}`;
}

function buildAccept(protocol: ScanConfig['accept']): string {
  if (protocol === 'wav') return '.wav,audio/wav,audio/x-wav';
  if (protocol === 'mp3') return '.mp3,audio/mpeg';
  return '.wav,.mp3,.ogg,.flac,.aac,audio/*';
}

function filterFiles(
  files: File[],
  protocol: ScanConfig['accept'],
  pattern: string,
): File[] {
  return files.filter(f => {
    if (protocol === 'wav' && !f.name.toLowerCase().endsWith('.wav')) return false;
    if (protocol === 'mp3' && !f.name.toLowerCase().endsWith('.mp3')) return false;
    const p = pattern.trim().toLowerCase();
    if (p && !f.name.toLowerCase().includes(p)) return false;
    return true;
  });
}

function immediateParentName(f: File): string {
  const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
  const segments = relPath.split('/');
  if (segments.length >= 3) {
    return segments[segments.length - 2] ?? f.name.replace(/\.[^/.]+$/, '');
  }
  if (segments.length === 2 && segments[1]) {
    return segments[0] ?? f.name.replace(/\.[^/.]+$/, '');
  }
  return f.name.replace(/\.[^/.]+$/, '');
}

export function VoxNovaPlayer() {
  const engine = useAudioEngine();
  const analyser = useFrequencyAnalyser();
  const library = useLibraryContext();

  const [view, setView] = useState<LibraryView>('cloud');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanProtocol, setScanProtocol] = useState<ScanConfig['accept']>('all');
  const [scanPattern, setScanPattern] = useState('');

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const registry = useMemo(() => genRegistry(), []);
  const sectorTime = useSectorTime();

  const selectedTrack = library.tracks.find(t => t.id === selectedId);
  const visibleTracks = library.tracks.filter(t => t.source === view);

  const handleSelect = (track: TrackEntry) => {
    setSelectedId(track.id);
    engine.loadTrack(track);
    engine.play();
    engine.beep(880, 'sine', 0.05);
  };

  const handlePrev = () => {
    if (!visibleTracks.length) return;
    const idx = visibleTracks.findIndex(t => t.id === selectedId);
    const prev = idx < 0
      ? visibleTracks[0]
      : visibleTracks[idx === 0 ? visibleTracks.length - 1 : idx - 1];
    if (prev) {
      setSelectedId(prev.id);
      engine.loadTrack(prev);
      engine.play();
      engine.beep(660, 'sine', 0.04);
    }
  };

  const handleNext = () => {
    if (!visibleTracks.length) return;
    const idx = visibleTracks.findIndex(t => t.id === selectedId);
    const next = idx < 0
      ? visibleTracks[0]
      : visibleTracks[idx >= visibleTracks.length - 1 ? 0 : idx + 1];
    if (next) {
      setSelectedId(next.id);
      engine.loadTrack(next);
      engine.play();
      engine.beep(1100, 'sine', 0.04);
    }
  };

  const handleUplinkFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = filterFiles(
      Array.from(e.target.files ?? []).filter(f => f.type.startsWith('audio/')),
      scanProtocol,
      scanPattern,
    );
    const added: Omit<TrackEntry, 'id'>[] = files.map(f => ({
      title: f.name.replace(/\.[^/.]+$/, ''),
      source: 'local',
      url: URL.createObjectURL(f),
      memo: `[UPLINK] ${f.name} | Integrity: Nominal`,
      linked: true,
    }));
    if (added.length) {
      library.addTracks(added);
      setView('local');
    }
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const handleScanFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = filterFiles(
      Array.from(e.target.files ?? []).filter(f => f.type.startsWith('audio/')),
      scanProtocol,
      scanPattern,
    );
    const added: Omit<TrackEntry, 'id'>[] = files.map(f => ({
      title: immediateParentName(f),
      source: 'local',
      url: URL.createObjectURL(f),
      memo: `[LCARS_SCAN] Identified: ${f.name} | Protocol: ${scanProtocol.toUpperCase()} | Integrity: Nominal`,
      linked: true,
    }));
    if (added.length) {
      library.addTracks(added);
      setView('local');
    }
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handlePurge = () => {
    if (typeof window !== 'undefined' && !window.confirm('Purge all tracks from local cache?')) return;
    library.purgeAll();
    setSelectedId(null);
    engine.pause();
  };

  const structuralIntegrity = Math.min(1, library.tracks.length / LIBRARY_CAPACITY);
  const neuralBuffer = engine.duration > 0 ? Math.min(1, engine.currentTime / engine.duration) : 0;

  const memo = selectedTrack?.memo
    || (selectedTrack
      ? `[LCARS_SCAN] Identified: ${selectedTrack.title} | Integrity: Nominal`
      : '[LCARS_SCAN] Standby — awaiting signal selection.');

  const title = selectedTrack?.title ?? 'Subspace Channel Idle';

  const CONTENT_WIDTH = 'min(680px, 95%)';
  const WIDE_WIDTH = 'min(900px, 98%)';

  // Hide left sidebar when player is active (playing)
  const sidebarVisible = !engine.isPlaying;

  const lyriaCount = library.tracks.filter(t => t.source === 'lyria').length;
  const prevLyriaCount = useRef(lyriaCount);
  useEffect(() => {
    if (lyriaCount > prevLyriaCount.current) setView('lyria');
    prevLyriaCount.current = lyriaCount;
  }, [lyriaCount]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        background: 'var(--bg-app)',
        color: LCARS.text,
        fontFamily: '"Antonio", "Eurostile", "Helvetica Neue", Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {sidebarVisible && (
        <PlayerSidebar
          view={view}
          setView={setView}
          tracks={library.tracks}
          selectedId={selectedId}
          onSelect={handleSelect}
          onPurge={handlePurge}
          scanProtocol={scanProtocol}
          setScanProtocol={setScanProtocol}
          scanPattern={scanPattern}
          setScanPattern={setScanPattern}
          uploadInputRef={uploadInputRef}
          folderInputRef={folderInputRef}
          buildAccept={buildAccept}
          handleUplinkFiles={handleUplinkFiles}
          handleScanFolder={handleScanFolder}
        />
      )}

      {/* MAIN PANEL */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minWidth: 0,
          padding: '12px 16px 16px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
          <div
            style={{
              flex: 1,
              height: 36,
              background: LCARS.peach,
              color: '#000',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              borderRadius: 4,
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span>USS VOX NOVA // REGISTRY {registry}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: LCARS.alertRed,
                    boxShadow: `0 0 6px ${LCARS.alertRed}`,
                  }}
                  aria-hidden="true"
                />
                <span style={{ fontSize: 11 }}>IMPULSE_ONLY</span>
              </span>
              <ChipIcon />
              <NetworkIcon />
            </span>
          </div>
          <div
            style={{
              width: 60,
              height: 36,
              background: LCARS.purple,
              borderTopLeftRadius: 4,
              borderBottomLeftRadius: 4,
              borderTopRightRadius: 18,
              borderBottomRightRadius: 18,
            }}
            aria-hidden="true"
          />
        </div>

        {/* Status bars row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: 32,
            alignItems: 'start',
            padding: '4px 8px',
          }}
        >
          <StatusBar label="STRUCTURAL INTEGRITY" value={structuralIntegrity} color={LCARS.amber} />
          <StatusBar label="NEURAL BUFFER" value={neuralBuffer} color={LCARS.purple} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: LCARS.subText, fontSize: 10, letterSpacing: 2 }}>SECTOR TIME</div>
            <div style={{ color: LCARS.alertRed, fontSize: 20, fontFamily: 'monospace', letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>
              {sectorTime}
            </div>
          </div>
        </div>

        {/* Stage */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 20,
            padding: '12px 24px 16px 24px',
            overflow: 'auto',
          }}
        >
          {/* Track title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ color: LCARS.subText, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase' }}>
              COMMS_ENCRYPTION: LEVEL 5
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(32px, 4.5vw, 56px)',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: 1,
                lineHeight: 1.05,
                textShadow: '0 0 32px rgba(255,255,255,0.25)',
                color: LCARS.text,
              }}
            >
              {title}
            </h1>
            <div style={{ width: 120, height: 3, background: LCARS.peach, borderRadius: 2 }} aria-hidden="true" />
          </div>

          {/* LOCAL MEMO LOG */}
          <div
            style={{
              alignSelf: 'center',
              width: CONTENT_WIDTH,
              border: `1px solid ${LCARS.purple}55`,
              borderRadius: 4,
              padding: '10px 14px',
              background: LCARS_BOX_COLORS[1],
            }}
          >
            <div style={{ color: LCARS.purple, fontSize: 10, letterSpacing: 3, marginBottom: 6 }}>LOCAL MEMO LOG</div>
            <div style={{ color: LCARS.text, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word' }}>
              {memo}
            </div>
          </div>

          {/* Transport controls + seekbar */}
          <div
            style={{
              alignSelf: 'center',
              width: CONTENT_WIDTH,
              border: `1px solid ${LCARS.peach}33`,
              borderRadius: 4,
              padding: '12px 16px',
              background: LCARS_BOX_COLORS[2],
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <PlayerControls engine={engine} onPrev={handlePrev} onNext={handleNext} disabled={!selectedTrack} />
            <SeekBar currentTime={engine.currentTime} duration={engine.duration} onSeek={engine.seek} disabled={!selectedTrack} />
          </div>

          {/* Volume */}
          <div
            style={{
              alignSelf: 'center',
              width: CONTENT_WIDTH,
              border: `1px solid ${LCARS.amber}33`,
              borderRadius: 4,
              padding: '10px 16px',
              background: LCARS_BOX_COLORS[4],
            }}
          >
            <VolumeControl volume={engine.volume} onChange={engine.setVolume} />
          </div>

          <div style={{ flex: 1, minHeight: 0 }} aria-hidden="true" />

          {/* SINGULARITY STATUS */}
          <div
            style={{
              alignSelf: 'center',
              width: WIDE_WIDTH,
              border: `1px solid rgba(100,100,200,0.25)`,
              borderRadius: 4,
              padding: '10px 14px',
              background: 'rgba(0,0,20,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ color: 'rgba(100,150,255,0.7)', fontSize: 9, letterSpacing: 3, marginBottom: 4 }}>SINGULARITY STATUS</div>
              <div style={{ color: LCARS.subText, fontSize: 11, letterSpacing: 1 }}>
                {engine.isPlaying ? 'ACCRETION ACTIVE' : 'EVENT HORIZON STABLE'}
              </div>
            </div>
            <BlackHoleBadge active={engine.isPlaying} />
          </div>

          {/* SUBSPACE FREQUENCY SCAN — equalizer */}
          <div
            style={{
              alignSelf: 'center',
              width: WIDE_WIDTH,
              border: `1px solid ${LCARS.red ?? '#cc3333'}33`,
              borderRadius: 4,
              padding: '8px',
              background: LCARS_BOX_COLORS[3],
            }}
          >
            <div style={{ color: LCARS.subText, fontSize: 9, letterSpacing: 3, marginBottom: 6, paddingLeft: 4 }}>
              SUBSPACE FREQUENCY SCAN
            </div>
            <FrequencyVisualizer isPlaying={engine.isPlaying} analyser={analyser} audioRef={engine.audioRef} />
          </div>
        </div>
      </main>
    </div>
  );
}
