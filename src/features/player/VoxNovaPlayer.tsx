import { useEffect, useMemo, useRef, useState } from 'react';
import { WarpField } from './WarpField';
import { FrequencyVisualizer } from './FrequencyVisualizer';
import { PlayerControls } from './PlayerControls';
import { useAudioEngine } from './useAudioEngine';
import { useFrequencyAnalyser } from './useFrequencyAnalyser';
import { useLibrary } from './useLibrary';
import { LCARS } from './lcarsTheme';
import type { TrackEntry, ScanConfig } from './types';

type LibraryView = 'cloud' | 'local';

const LIBRARY_CAPACITY = 50;

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

/** Map ScanConfig.accept → native <input accept> string */
function buildAccept(protocol: ScanConfig['accept']): string {
  if (protocol === 'wav') return '.wav,audio/wav,audio/x-wav';
  if (protocol === 'mp3') return '.mp3,audio/mpeg';
  return '.wav,.mp3,.ogg,.flac,.aac,audio/*';
}

/** Filter a File list by protocol + pattern */
function filterFiles(
  files: File[],
  protocol: ScanConfig['accept'],
  pattern: string,
): File[] {
  return files.filter(f => {
    // Protocol filter
    if (protocol === 'wav' && !f.name.toLowerCase().endsWith('.wav')) return false;
    if (protocol === 'mp3' && !f.name.toLowerCase().endsWith('.mp3')) return false;
    // Pattern match (case-insensitive substring)
    const p = pattern.trim().toLowerCase();
    if (p && !f.name.toLowerCase().includes(p)) return false;
    return true;
  });
}

export function VoxNovaPlayer() {
  const engine = useAudioEngine();
  const analyser = useFrequencyAnalyser();
  const library = useLibrary();

  const [view, setView] = useState<LibraryView>('cloud');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Scan filter state ─────────────────────────────────────────────────────
  const [scanProtocol, setScanProtocol] = useState<ScanConfig['accept']>('all');
  const [scanPattern, setScanPattern] = useState('');

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const registry = useMemo(() => genRegistry(), []);
  const sectorTime = useSectorTime();

  const selectedTrack = library.tracks.find(t => t.id === selectedId);
  const visibleTracks = library.tracks.filter(t => t.source === view);

  // ── Track handlers ─────────────────────────────────────────────────────────
  const handleSelect = (track: TrackEntry) => {
    setSelectedId(track.id);
    engine.loadTrack(track);
    engine.beep(880, 'sine', 0.05);
  };

  const handlePrev = () => {
    if (!visibleTracks.length) return;
    const idx = visibleTracks.findIndex(t => t.id === selectedId);
    const prev = idx < 0
      ? visibleTracks[0]
      : visibleTracks[idx === 0 ? visibleTracks.length - 1 : idx - 1];
    if (prev) handleSelect(prev);
  };

  const handleNext = () => {
    if (!visibleTracks.length) return;
    const idx = visibleTracks.findIndex(t => t.id === selectedId);
    const next = idx < 0
      ? visibleTracks[0]
      : visibleTracks[idx >= visibleTracks.length - 1 ? 0 : idx + 1];
    if (next) handleSelect(next);
  };

  // ── File uplink ────────────────────────────────────────────────────────────
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

  // ── Folder scan ────────────────────────────────────────────────────────────
  const handleScanFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = filterFiles(
      Array.from(e.target.files ?? []).filter(f => f.type.startsWith('audio/')),
      scanProtocol,
      scanPattern,
    );
    const added: Omit<TrackEntry, 'id'>[] = files.map(f => {
      const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
      const firstSegment = relPath.split('/')[0];
      const folderName = relPath.includes('/') && firstSegment
        ? firstSegment
        : f.name.replace(/\.[^/.]+$/, '');
      return {
        title: folderName,
        source: 'local',
        url: URL.createObjectURL(f),
        memo: `[LCARS_SCAN] Identified: ${f.name} | Protocol: ${scanProtocol.toUpperCase()} | Integrity: Nominal`,
        linked: true,
      };
    });
    if (added.length) {
      library.addTracks(added);
      setView('local');
    }
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // ── PURGE ──────────────────────────────────────────────────────────────────
  const handlePurge = () => {
    if (typeof window !== 'undefined' && !window.confirm('Purge all tracks from local cache?')) return;
    library.purgeAll();
    setSelectedId(null);
    engine.pause();
  };

  // ── Derived UI values ──────────────────────────────────────────────────────
  const structuralIntegrity = Math.min(1, library.tracks.length / LIBRARY_CAPACITY);
  const neuralBuffer = engine.duration > 0 ? Math.min(1, engine.currentTime / engine.duration) : 0;

  const memo = selectedTrack?.memo
    || (selectedTrack
      ? `[LCARS_SCAN] Identified: ${selectedTrack.title} | Integrity: Nominal`
      : '[LCARS_SCAN] Standby — awaiting signal selection.');

  const title = selectedTrack?.title ?? 'Subspace Channel Idle';

  const PROTOCOLS: Array<{ label: string; value: ScanConfig['accept'] }> = [
    { label: 'WAV', value: 'wav' },
    { label: 'MP3', value: 'mp3' },
    { label: 'ALL', value: 'all' },
  ];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        background: LCARS.void,
        color: LCARS.text,
        fontFamily: '"Antonio", "Eurostile", "Helvetica Neue", Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <WarpField isPlaying={engine.isPlaying} />

      {/* ═══════════════════ LEFT LCARS SIDEBAR ═══════════════════ */}
      <aside
        style={{
          position: 'relative',
          zIndex: 1,
          width: 200,
          flexShrink: 0,
          padding: '12px 12px 12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {/* VOX / NV-42 CORE block */}
        <div
          style={{
            background: LCARS.peach,
            color: '#000',
            padding: '28px 14px 16px 14px',
            borderTopLeftRadius: 64,
            borderTopRightRadius: 4,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 4,
            minHeight: 110,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, lineHeight: 1 }}>VOX</div>
          <div style={{ fontSize: 10, letterSpacing: 2, marginTop: 4, opacity: 0.85 }}>NV-42 CORE</div>
        </div>

        <SidebarButton
          label="CLOUD"
          color={LCARS.purple}
          textColor="#0a0a10"
          active={view === 'cloud'}
          onClick={() => setView('cloud')}
          icon={<GlobeIcon />}
        />
        <SidebarButton
          label="LOCAL"
          color={LCARS.orange}
          textColor="#0a0a10"
          active={view === 'local'}
          onClick={() => setView('local')}
          icon={<DatabaseIcon />}
        />
        <SidebarButton
          label="PURGE"
          color={LCARS.red}
          textColor="#0a0a10"
          onClick={handlePurge}
        />

        {/* Track list */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            marginTop: 12,
            paddingRight: 2,
          }}
        >
          {visibleTracks.length === 0 ? (
            <div style={{ color: LCARS.mutedText, fontSize: 10, letterSpacing: 1, padding: '8px 4px' }}>
              NO {view.toUpperCase()} SIGNALS
            </div>
          ) : visibleTracks.map(track => (
            <button
              key={track.id}
              type="button"
              onClick={() => handleSelect(track)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 8px',
                marginBottom: 2,
                background: track.id === selectedId ? `${LCARS.peach}33` : 'transparent',
                border: 'none',
                borderLeft: `3px solid ${track.id === selectedId ? LCARS.peach : 'transparent'}`,
                color: track.id === selectedId ? LCARS.peach : LCARS.text,
                fontSize: 11,
                letterSpacing: 1,
                cursor: 'pointer',
                fontFamily: 'inherit',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={track.title}
            >
              {track.title}
            </button>
          ))}
        </div>

        {/* ── SCAN SECTOR panel with AUDIO PROTOCOL + PATTERN MATCH ── */}
        <div
          style={{
            border: `1px solid ${LCARS.orange}55`,
            borderRadius: 4,
            padding: '10px 10px 8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* AUDIO PROTOCOL selector */}
          <div>
            <div
              style={{
                color: LCARS.orange,
                fontSize: 9,
                letterSpacing: 3,
                marginBottom: 6,
              }}
            >
              AUDIO PROTOCOL
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {PROTOCOLS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setScanProtocol(p.value)}
                  style={{
                    flex: 1,
                    padding: '5px 4px',
                    background: scanProtocol === p.value ? LCARS.orange : 'transparent',
                    color: scanProtocol === p.value ? '#000' : LCARS.orange,
                    border: `1px solid ${LCARS.orange}`,
                    borderRadius: 3,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 120ms, color 120ms',
                  }}
                  aria-pressed={scanProtocol === p.value}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <SidebarButton
                label="UPLINK"
                color={LCARS.peach}
                textColor="#0a0a10"
                onClick={() => uploadInputRef.current?.click()}
                icon={<UploadIcon />}
                outlined
              />
            </div>
          </div>

          {/* PATTERN MATCH input */}
          <div>
            <div
              style={{
                color: LCARS.orange,
                fontSize: 9,
                letterSpacing: 3,
                marginBottom: 6,
              }}
            >
              PATTERN MATCH
            </div>
            <input
              type="text"
              value={scanPattern}
              onChange={e => setScanPattern(e.target.value)}
              placeholder=""
              aria-label="Pattern match filter"
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.6)',
                border: `1px solid ${LCARS.orange}55`,
                borderRadius: 3,
                color: LCARS.text,
                fontFamily: 'monospace',
                fontSize: 12,
                padding: '5px 8px',
                letterSpacing: 1,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div
            style={{
              background: LCARS.orange,
              color: '#000',
              padding: '14px 14px 24px 14px',
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              borderBottomLeftRadius: 64,
              borderBottomRightRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
            role="button"
            tabIndex={0}
            onClick={() => folderInputRef.current?.click()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                folderInputRef.current?.click();
              }
            }}
          >
            <DatabaseIcon />
            <span style={{ fontSize: 11, letterSpacing: 2, fontWeight: 600 }}>SCAN SECTOR</span>
          </div>
        </div>

        {/* Hidden inputs — accept driven by scanProtocol */}
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          accept={buildAccept(scanProtocol)}
          style={{ display: 'none' }}
          onChange={handleUplinkFiles}
          aria-hidden="true"
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          accept={buildAccept(scanProtocol)}
          // @ts-expect-error — webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          style={{ display: 'none' }}
          onChange={handleScanFolder}
          aria-hidden="true"
        />
      </aside>

      {/* ═══════════════════ MAIN PANEL ═══════════════════ */}
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
            padding: '4px 8px 4px 8px',
          }}
        >
          <StatusBar label="STRUCTURAL INTEGRITY" value={structuralIntegrity} color={LCARS.amber} />
          <StatusBar label="NEURAL BUFFER" value={neuralBuffer} color={LCARS.purple} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: LCARS.subText, fontSize: 10, letterSpacing: 2 }}>SECTOR TIME</div>
            <div
              style={{
                color: LCARS.alertRed,
                fontSize: 20,
                fontFamily: 'monospace',
                letterSpacing: 2,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
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
            gap: 24,
            padding: '12px 24px 16px 24px',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                color: LCARS.subText,
                fontSize: 12,
                letterSpacing: 4,
                textTransform: 'uppercase',
              }}
            >
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

          <div
            style={{
              alignSelf: 'center',
              width: 'min(560px, 90%)',
              border: `1px solid ${LCARS.peach}55`,
              borderRadius: 4,
              padding: '10px 14px',
              background: 'rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ color: LCARS.peach, fontSize: 10, letterSpacing: 3, marginBottom: 6 }}>
              LOCAL MEMO LOG
            </div>
            <div
              style={{
                color: LCARS.text,
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {memo}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <PlayerControls engine={engine} onPrev={handlePrev} onNext={handleNext} disabled={!selectedTrack} />
            <SeekBar
              currentTime={engine.currentTime}
              duration={engine.duration}
              onSeek={engine.seek}
              disabled={!selectedTrack}
            />
          </div>

          <VolumeControl volume={engine.volume} onChange={engine.setVolume} />

          <div>
            <FrequencyVisualizer
              isPlaying={engine.isPlaying}
              analyser={analyser}
              audioRef={engine.audioRef}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// ───────────────────────── Subcomponents ─────────────────────────

interface SidebarButtonProps {
  label: string;
  color: string;
  textColor: string;
  onClick: () => void;
  icon?: React.ReactNode;
  active?: boolean;
  outlined?: boolean;
}

function SidebarButton({ label, color, textColor, onClick, icon, active, outlined }: SidebarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '10px 14px',
        background: outlined ? 'transparent' : color,
        color: outlined ? color : textColor,
        border: outlined ? `2px solid ${color}` : 'none',
        borderRadius: 4,
        fontSize: 11,
        letterSpacing: 2,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        outline: active ? `2px solid ${color}` : 'none',
        outlineOffset: active ? 2 : 0,
      }}
      aria-pressed={active}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 16 }}>
        {icon ?? null}
      </span>
      <span>{label}</span>
    </button>
  );
}

interface StatusBarProps {
  label: string;
  value: number;
  color: string;
}

function StatusBar({ label, value, color }: StatusBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div>
      <div style={{ color, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          width: '100%',
          height: 4,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            transition: 'width 200ms linear',
          }}
        />
      </div>
    </div>
  );
}

interface SeekBarProps {
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
  disabled?: boolean;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function SeekBar({ currentTime, duration, onSeek, disabled }: SeekBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: 'min(420px, 80%)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          color: LCARS.subText,
          fontFamily: 'monospace',
          fontSize: 11,
          minWidth: 36,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatTime(currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={e => onSeek(Number(e.target.value))}
        disabled={disabled}
        aria-label="Seek"
        style={{
          flex: 1,
          accentColor: LCARS.peach,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      />
      <span
        style={{
          color: LCARS.subText,
          fontFamily: 'monospace',
          fontSize: 11,
          minWidth: 36,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatTime(duration)}
      </span>
    </div>
  );
}

interface VolumeControlProps {
  volume: number;
  onChange: (v: number) => void;
}

function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const pct = Math.round(Math.max(0, Math.min(1, volume)) * 100);
  const muted = volume <= 0;
  const lastVolumeRef = useRef(volume > 0 ? volume : 1);
  useEffect(() => {
    if (volume > 0) lastVolumeRef.current = volume;
  }, [volume]);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: 'min(420px, 80%)',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(muted ? (lastVolumeRef.current || 1) : 0)}
        aria-label={muted ? 'Unmute' : 'Mute'}
        style={{
          background: 'transparent',
          border: 'none',
          color: LCARS.peach,
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <VolumeIcon muted={muted} />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={e => onChange(Number(e.target.value))}
        aria-label="Volume"
        style={{
          flex: 1,
          accentColor: LCARS.peach,
          cursor: 'pointer',
        }}
      />
      <span
        style={{
          color: LCARS.subText,
          fontFamily: 'monospace',
          fontSize: 11,
          minWidth: 36,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 10v4h4l5 4V6L7 10H3z" fill="currentColor" />
      {muted ? (
        <path d="M16 9l6 6M22 9l-6 6" />
      ) : (
        <path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" />
      )}
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v12M6 9l6-6 6 6M4 21h16" />
    </svg>
  );
}

function ChipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M3 9h3M3 15h3M18 9h3M18 15h3M9 3v3M15 3v3M9 18v3M15 18v3" />
    </svg>
  );
}

function NetworkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v4M12 11l-6 6M12 11l6 6" />
    </svg>
  );
}
