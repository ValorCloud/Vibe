import { useEffect, useMemo, useRef, useState } from 'react';
import { FrequencyVisualizer } from './FrequencyVisualizer';
import { PlayerControls } from './PlayerControls';
import { PlayerSidebar } from './PlayerSidebar';
import { SidebarProvider } from './SidebarContext';
import { StatusBar, SeekBar, VolumeControl, BlackHoleBadge, ChipIcon, NetworkIcon } from './PlayerWidgets';
import { useAudioEngine } from './useAudioEngine';
import { useFrequencyAnalyser } from './useFrequencyAnalyser';
import { useLibraryContext } from '../../contexts/LibraryContext';
import { usePlayerNavigation } from './usePlayerNavigation';
import { LCARS } from './lcarsTheme';
import type { TrackInfo } from './useAudioEngine';

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
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
  else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function useSectorTime(): string {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => setT((performance.now() - start) / 100), 100);
    return () => window.clearInterval(id);
  }, []);
  const whole = Math.floor(t / 10).toString().padStart(4, '0');
  const dec = Math.floor(t % 10);
  return `${whole}.${dec}`;
}

function LCARSBackground() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: 'radial-gradient(ellipse at 20% 40%, rgba(255,153,0,0.04) 0%, transparent 55%), radial-gradient(ellipse at 80% 60%, rgba(153,102,204,0.05) 0%, transparent 55%), radial-gradient(ellipse at 50% 0%, rgba(100,180,255,0.03) 0%, transparent 60%)' }}>
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 4px)',
        backgroundSize: '100% 4px' }} />
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,153,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,153,0,0.025) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 80%)' }} />
    </div>
  );
}

function TechSpecLine({ info, duration }: { info: TrackInfo | null; duration: number }) {
  if (!info) {
    return <span style={{ color: 'rgba(153,102,204,0.5)', fontStyle: 'italic' }}>[SIGNAL_ANALYSIS] Scanning...</span>;
  }
  const parts: Array<{ label: string; color: string }> = [];
  parts.push({ label: info.channelLabel, color: LCARS.amber });
  if (info.sampleRate) parts.push({ label: `${(info.sampleRate / 1000).toFixed(1)} kHz`, color: LCARS.purple });
  if (info.bitrateKbps) parts.push({ label: `~${info.bitrateKbps} kbps`, color: LCARS.purple });
  if (info.codec) parts.push({ label: info.codec, color: LCARS.peach });
  if (duration > 0) {
    const m = Math.floor(duration / 60);
    const s = Math.floor(duration % 60).toString().padStart(2, '0');
    parts.push({ label: `${m}:${s}`, color: LCARS.subText });
  }
  parts.push({ label: info.isVideo ? 'VIDEO+AUDIO' : 'AUDIO', color: info.isVideo ? LCARS.alertRed : LCARS.purple });
  return (
    <span>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span style={{ color: 'rgba(153,102,204,0.45)', margin: '0 6px' }}>│</span>}
          <span style={{ color: p.color }}>{p.label}</span>
        </span>
      ))}
    </span>
  );
}

interface VideoPlayerProps {
  src: string;
  isPlaying: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  contentWidth: string;
}

function VideoPlayer({ src, isPlaying, videoRef, contentWidth }: VideoPlayerProps) {
  const [showControls, setShowControls] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMouseMove = () => {
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowControls(false), 2800);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div onMouseMove={handleMouseMove} onMouseLeave={() => setShowControls(false)}
      style={{
        alignSelf: 'center', width: contentWidth,
        border: `1px solid ${LCARS.purple}55`, borderRadius: 4, overflow: 'hidden',
        background: '#000', position: 'relative',
        boxShadow: `0 0 24px ${LCARS.purple}1a, 0 4px 16px rgba(0,0,0,0.5)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px 4px', background: 'rgba(0,0,0,0.7)', borderBottom: `1px solid ${LCARS.purple}33` }}>
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
      {/* FIX #2: fluid height via aspect-ratio, no hard maxHeight that crops */}
      <video
        ref={videoRef}
        src={src}
        style={{ width: '100%', display: 'block', maxHeight: 'clamp(180px, 38vh, 420px)', background: '#000', objectFit: 'contain' }}
        playsInline
        controls={showControls}
        preload="metadata"
        aria-label="Video player"
      />
      <div aria-hidden="true" style={{ position: 'absolute', top: 30, left: 0, width: 3, height: 36, background: LCARS.purple, borderRadius: '0 2px 2px 0', opacity: 0.55 }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: 30, right: 0, width: 3, height: 36, background: LCARS.orange, borderRadius: '2px 0 0 2px', opacity: 0.55 }} />
    </div>
  );
}

export function VoxNovaPlayer() {
  const engine = useAudioEngine();
  const analyser = useFrequencyAnalyser();
  const library = useLibraryContext();

  const videoElRef = useRef<HTMLVideoElement>(null);

  const registry = useMemo(() => genRegistry(), []);
  const sectorTime = useSectorTime();

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

  const handlePurge = () => {
    if (typeof window !== 'undefined' && !window.confirm('Purge all tracks from local cache?')) return;
    library.purgeAll(); setSelectedId(null); engine.pause();
  };

  const structuralIntegrity = Math.min(1, library.tracks.length / LIBRARY_CAPACITY);
  const neuralBuffer = engine.duration > 0 ? Math.min(1, engine.currentTime / engine.duration) : 0;
  const memo = selectedTrack?.memo || (selectedTrack ? `[LCARS_SCAN] Identified: ${selectedTrack.title} | Integrity: Nominal` : '[LCARS_SCAN] Standby \u2014 awaiting signal selection.');
  const title = selectedTrack?.title ?? 'Subspace Channel Idle';
  const CONTENT_WIDTH = 'min(680px, 95%)';
  const WIDE_WIDTH = 'min(900px, 98%)';

  const lyriaCount = library.tracks.filter(t => t.source === 'lyria').length;
  const prevLyriaCount = useRef(lyriaCount);
  useEffect(() => { if (lyriaCount > prevLyriaCount.current) setView('lyria'); prevLyriaCount.current = lyriaCount; }, [lyriaCount, setView]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', background: 'var(--bg-app)', color: LCARS.text, fontFamily: '"Antonio", "Eurostile", "Helvetica Neue", Arial, sans-serif', overflow: 'hidden' }}>
      <LCARSBackground />
      <SidebarProvider onLocalTracksAdded={() => setView('local')}>
        <PlayerSidebar
          view={view}
          setView={setView}
          tracks={library.tracks}
          selectedId={selectedId}
          onSelect={handleSelect}
          onPurge={handlePurge}
        />
      </SidebarProvider>

      <main style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0, padding: '12px 16px 16px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
          <div style={{ flex: 1, height: 36, background: LCARS.peach, color: '#000', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 12, fontWeight: 700, letterSpacing: 2, borderRadius: 4, justifyContent: 'space-between', gap: 12 }}>
            <span>USS VOX NOVA // REGISTRY {registry}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: LCARS.alertRed, boxShadow: `0 0 6px ${LCARS.alertRed}` }} aria-hidden="true" />
                <span style={{ fontSize: 11 }}>IMPULSE_ONLY</span>
              </span>
              <ChipIcon /><NetworkIcon />
            </span>
          </div>
          <div style={{ width: 60, height: 36, background: LCARS.purple, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: 18, borderBottomRightRadius: 18 }} aria-hidden="true" />
        </div>

        {/* Status bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 32, alignItems: 'start', padding: '4px 8px' }}>
          <StatusBar label="STRUCTURAL INTEGRITY" value={structuralIntegrity} color={LCARS.amber} />
          <StatusBar label="NEURAL BUFFER" value={neuralBuffer} color={LCARS.purple} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: LCARS.subText, fontSize: 10, letterSpacing: 2 }}>SECTOR TIME</div>
            <div style={{ color: LCARS.alertRed, fontSize: 20, fontFamily: 'monospace', letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>{sectorTime}</div>
          </div>
        </div>

        {/* Stage */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 20, padding: '12px 24px 16px 24px', overflow: 'auto' }}>
          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ color: LCARS.subText, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase' }}>COMMS_ENCRYPTION: LEVEL 5</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: 700, textAlign: 'center', letterSpacing: 1, lineHeight: 1.05, textShadow: '0 0 32px rgba(255,255,255,0.25)', color: LCARS.text }}>{title}</h1>
            <div style={{ width: 120, height: 3, background: LCARS.peach, borderRadius: 2 }} aria-hidden="true" />
          </div>

          {/* MEMO LOG */}
          <div style={{ alignSelf: 'center', width: CONTENT_WIDTH, border: `1px solid ${LCARS.purple}55`, borderRadius: 4, padding: '10px 14px', background: LCARS_BOX_COLORS[1] }}>
            <div style={{ color: LCARS.purple, fontSize: 10, letterSpacing: 3, marginBottom: 6 }}>LOCAL MEMO LOG</div>
            <div style={{ color: LCARS.text, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word', marginBottom: selectedTrack ? 8 : 0 }}>{memo}</div>
            {selectedTrack && (
              <div style={{ borderTop: `1px solid ${LCARS.purple}22`, paddingTop: 6, fontFamily: 'monospace', fontSize: 11, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: LCARS.subText, marginRight: 6 }}>SIGNAL_ANALYSIS</span>
                <TechSpecLine info={engine.trackInfo} duration={engine.duration} />
              </div>
            )}
          </div>

          {/* Video — between MEMO and controls */}
          {selectedTrack?.isVideo && (
            <VideoPlayer src={selectedTrack.url} isPlaying={engine.isPlaying} videoRef={videoElRef} contentWidth={CONTENT_WIDTH} />
          )}

          {/* Transport + seek */}
          <div style={{ alignSelf: 'center', width: CONTENT_WIDTH, border: `1px solid ${LCARS.peach}33`, borderRadius: 4, padding: '12px 16px', background: LCARS_BOX_COLORS[2], display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <PlayerControls engine={engine} onPrev={handlePrev} onNext={handleNext} disabled={!selectedTrack} />
            <SeekBar currentTime={engine.currentTime} duration={engine.duration} onSeek={engine.seek} disabled={!selectedTrack} />
          </div>

          {/* Volume */}
          <div style={{ alignSelf: 'center', width: CONTENT_WIDTH, border: `1px solid ${LCARS.amber}33`, borderRadius: 4, padding: '10px 16px', background: LCARS_BOX_COLORS[4] }}>
            <VolumeControl volume={engine.volume} onChange={engine.setVolume} />
          </div>

          <div style={{ flex: 1, minHeight: 0 }} aria-hidden="true" />

          {/* Singularity status */}
          <div style={{ alignSelf: 'center', width: WIDE_WIDTH, border: '1px solid rgba(100,100,200,0.25)', borderRadius: 4, padding: '10px 14px', background: 'rgba(0,0,20,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ color: 'rgba(100,150,255,0.7)', fontSize: 9, letterSpacing: 3, marginBottom: 4 }}>SINGULARITY STATUS</div>
              <div style={{ color: LCARS.subText, fontSize: 11, letterSpacing: 1 }}>{engine.isPlaying ? 'ACCRETION ACTIVE' : 'EVENT HORIZON STABLE'}</div>
            </div>
            <BlackHoleBadge active={engine.isPlaying} />
          </div>

          {/* Frequency scan — always shown when a track is selected */}
          {selectedTrack && (
            <div style={{ alignSelf: 'center', width: WIDE_WIDTH, border: `1px solid ${LCARS.red ?? '#cc3333'}33`, borderRadius: 4, padding: '8px', background: LCARS_BOX_COLORS[3] }}>
              <div style={{ color: LCARS.subText, fontSize: 9, letterSpacing: 3, marginBottom: 6, paddingLeft: 4 }}>
                SUBSPACE FREQUENCY SCAN{selectedTrack.isVideo ? ' \u2014 AUDIO TRACK' : ''}
              </div>
              <FrequencyVisualizer isPlaying={engine.isPlaying} analyser={analyser} audioRef={engine.audioRef} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
