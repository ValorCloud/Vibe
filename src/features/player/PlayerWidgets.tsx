import { useRef, useEffect, useState, useMemo } from 'react';
import { LCARS } from './lcarsTheme';
import type { FrequencyAnalyserState } from './useFrequencyAnalyser';

// ─── Icons ───────────────────────────────────────────────────────────────────

export function GlobeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
}

export function DatabaseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>;
}

export function SparkleIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>;
}

export function UploadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12M6 9l6-6 6 6M4 21h16" /></svg>;
}

export function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" /></svg>;
}

export function ChipIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1" /><rect x="9" y="9" width="6" height="6" /><path d="M3 9h3M3 15h3M18 9h3M18 15h3M9 3v3M15 3v3M9 18v3M15 18v3" /></svg>;
}

export function NetworkIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M12 7v4M12 11l-6 6M12 11l6 6" /></svg>;
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 10v4h4l5 4V6L7 10H3z" fill="currentColor" />
      {muted ? <path d="M16 9l6 6M22 9l-6 6" /> : <path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" />}
    </svg>
  );
}

// ─── StatusBar ───────────────────────────────────────────────────────────────

export interface StatusBarProps { label: string; value: number; color: string; }

export function StatusBar({ label, value, color }: StatusBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div>
      <div style={{ color, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>{label}</div>
      <div
        style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}
        role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, boxShadow: `0 0 6px ${color}`, transition: 'width 200ms linear' }} />
      </div>
    </div>
  );
}

// ─── SeekBar ─────────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export interface SeekBarProps { currentTime: number; duration: number; onSeek: (t: number) => void; disabled?: boolean; }

export function SeekBar({ currentTime, duration, onSeek, disabled }: SeekBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', opacity: disabled ? 0.5 : 1 }}>
      <span style={{ color: LCARS.subText, fontFamily: 'monospace', fontSize: 11, minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>{formatTime(currentTime)}</span>
      <input type="range" min={0} max={duration || 1} step={0.1} value={currentTime} onChange={e => onSeek(Number(e.target.value))} disabled={disabled} aria-label="Seek" style={{ flex: 1, accentColor: LCARS.peach, cursor: disabled ? 'not-allowed' : 'pointer' }} />
      <span style={{ color: LCARS.subText, fontFamily: 'monospace', fontSize: 11, minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatTime(duration)}</span>
    </div>
  );
}

// ─── VolumeControl ───────────────────────────────────────────────────────────

export interface VolumeControlProps { volume: number; onChange: (v: number) => void; }

export function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const pct = Math.round(Math.max(0, Math.min(1, volume)) * 100);
  const muted = volume <= 0;
  const lastVolumeRef = useRef(volume > 0 ? volume : 1);
  useEffect(() => { if (volume > 0) lastVolumeRef.current = volume; }, [volume]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
      <button type="button" onClick={() => onChange(muted ? (lastVolumeRef.current || 0.5) : 0)} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Restore volume' : 'Mute volume'}
        style={{ background: 'transparent', border: 'none', color: LCARS.purple, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
      >
        <VolumeIcon muted={muted} />
      </button>
      <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => onChange(Number(e.target.value))} aria-label="Volume" title={`Volume ${pct}%`} style={{ flex: 1, accentColor: LCARS.purple, cursor: 'pointer' }} />
      <span style={{ color: LCARS.subText, fontFamily: 'monospace', fontSize: 11, minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
    </div>
  );
}

// ─── BlackHoleBadge ──────────────────────────────────────────────────────────

const PULSE_STYLE = `
  @keyframes bhBeatPulse {
    0%   { transform: scale(0.55); opacity: 0; stroke-width: 1.6; }
    18%  { opacity: 0.85; }
    100% { transform: scale(1.95); opacity: 0; stroke-width: 0.25; }
  }
  @keyframes bhBlobMorph {
    0%   { transform: scale(0.55) rotate(0deg); }
    100% { transform: scale(1.95) rotate(24deg); }
  }
  .bh-beat-pulse {
    transform-box: fill-box;
    transform-origin: center;
    animation: bhBeatPulse 1.4s cubic-bezier(0.2, 0.7, 0.3, 1) forwards,
               bhBlobMorph 1.4s linear forwards;
  }
`;

let _pulseStyleInjected = false;
function injectPulseStyle() {
  if (_pulseStyleInjected) return;
  _pulseStyleInjected = true;
  const el = document.createElement('style');
  el.textContent = PULSE_STYLE;
  document.head.appendChild(el);
}

/**
 * Deterministic-ish PRNG for blob generation so each pulse is consistent during
 * its lifetime but different from neighbours.
 */
function makeRng(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Build a closed biomorphic blob path centred on (0,0) using N points around a
 * circle of given radius, with smoothed quadratic curves through midpoints so
 * the shape stays organic and asymmetric rather than a perfect circle.
 */
function blobPath(radius: number, points: number, jitter: number, seed: number): string {
  const rng = makeRng(seed);
  const phase = rng() * Math.PI * 2;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points; i++) {
    const angle = phase + (i / points) * Math.PI * 2;
    const rr = radius * (1 + (rng() - 0.5) * jitter * 2);
    pts.push([Math.cos(angle) * rr, Math.sin(angle) * rr]);
  }
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  let d = '';
  for (let i = 0; i < points; i++) {
    const cur = pts[i]!;
    const next = pts[(i + 1) % points]!;
    const after = pts[(i + 2) % points]!;
    const m = mid(cur, next);
    if (i === 0) d += `M${m[0].toFixed(2)},${m[1].toFixed(2)}`;
    const nm = mid(next, after);
    d += ` Q${next[0].toFixed(2)},${next[1].toFixed(2)} ${nm[0].toFixed(2)},${nm[1].toFixed(2)}`;
  }
  d += 'Z';
  return d;
}

interface Pulse {
  id: number;
  path: string;
  hue: number;
}

const PULSE_LIFETIME_MS = 1400;
const BEAT_COOLDOWN_MS = 220;
// Fallback cadence when no analyser data is available but audio is playing
// (e.g. CORS-restricted media). Kept slow so it never feels metronomic.
const FALLBACK_BEAT_MS = 900;
// Cap concurrent pulses so the SVG stays readable and cheap to render.
const MAX_CONCURRENT_PULSES = 4;
// Extra delay before removing a pulse so the CSS animation can fully settle.
const PULSE_CLEANUP_BUFFER_MS = 40;

export function BlackHoleBadge({
  active,
  analyser,
}: {
  active: boolean;
  analyser?: FrequencyAnalyserState;
}) {
  useEffect(() => { injectPulseStyle(); }, []);

  const [pulses, setPulses] = useState<Pulse[]>([]);
  const idRef = useRef(0);
  const lastBeatRef = useRef(0);
  const energyAvgRef = useRef(0);

  // Drive pulses from the audio analyser, falling back to a slow cadence when
  // analyser data is unavailable. Only runs while playback is active so the
  // badge is completely still when nothing is playing.
  useEffect(() => {
    if (!active) {
      setPulses([]);
      energyAvgRef.current = 0;
      lastBeatRef.current = 0;
      return;
    }

    let rafId: number;
    const emitPulse = (now: number) => {
      lastBeatRef.current = now;
      const id = ++idRef.current;
      const pulse: Pulse = {
        id,
        path: blobPath(16, 9, 0.22, id),
        hue: 268 + ((id * 37) % 30) - 15,
      };
      setPulses((prev) => [...prev.slice(-(MAX_CONCURRENT_PULSES - 1)), pulse]);
      window.setTimeout(() => {
        setPulses((prev) => prev.filter((p) => p.id !== id));
      }, PULSE_LIFETIME_MS + PULSE_CLEANUP_BUFFER_MS);
    };

    const tick = () => {
      const now = performance.now();
      const analyserNode = analyser?.analyserRef.current;
      const data = analyser?.dataArrayRef.current;
      let beat = false;

      if (analyserNode && data) {
        analyserNode.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
        // Bass-heavy window: first ~10% of bins captures kick/low energy.
        const bassEnd = Math.max(4, Math.floor(data.length * 0.1));
        let sum = 0;
        for (let i = 0; i < bassEnd; i++) sum += data[i]!;
        const energy = sum / bassEnd;
        // Exponential moving average as a noise floor.
        const avg = energyAvgRef.current;
        energyAvgRef.current = avg === 0 ? energy : avg * 0.92 + energy * 0.08;
        const threshold = Math.max(28, energyAvgRef.current * 1.35);
        if (
          energy > threshold &&
          now - lastBeatRef.current > BEAT_COOLDOWN_MS
        ) {
          beat = true;
        }
      } else if (now - lastBeatRef.current > FALLBACK_BEAT_MS) {
        beat = true;
      }

      if (beat) emitPulse(now);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [active, analyser]);

  const coreColor = active ? 'rgba(218,158,255,0.9)' : 'rgba(126,78,205,0.42)';
  const haloColor = active ? 'rgba(184,92,255,0.24)' : 'rgba(126,78,205,0.12)';
  // A single static biomorphic outline around the event horizon so the badge
  // still reads as organic when paused.
  const staticOutline = useMemo(() => blobPath(28, 11, 0.08, 7), []);

  return (
    <svg
      width="72" height="72" viewBox="-36 -36 72 72"
      aria-label={active ? 'Black hole — accretion active' : 'Black hole — event horizon stable'}
      style={{
        flexShrink: 0,
        overflow: 'visible',
        filter: active
          ? 'drop-shadow(0 0 16px rgba(184,92,255,0.72))'
          : 'drop-shadow(0 0 5px rgba(126,78,205,0.18))',
        transition: 'filter 600ms ease',
      }}
    >
      {/* Beat-driven biomorphic pulses — only present while audio is playing. */}
      {active && pulses.map((p) => (
        <path
          key={p.id}
          className="bh-beat-pulse"
          d={p.path}
          fill="none"
          stroke={`hsla(${p.hue}, 88%, 72%, 0.85)`}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      ))}
      {/* Static body */}
      <path d={staticOutline} fill="none" stroke={haloColor} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="0" cy="0" r="18" fill="none" stroke={coreColor} strokeWidth="1.7" />
      <circle cx="0" cy="0" r="10" fill="none" stroke="rgba(13,0,24,0.96)" strokeWidth="3.2" />
      {active && <ellipse cx="0" cy="0" rx="25" ry="6" fill="none" stroke="rgba(224,170,255,0.52)" strokeWidth="1.8" />}
    </svg>
  );
}
