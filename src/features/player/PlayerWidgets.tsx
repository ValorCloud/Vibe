import { useRef, useEffect } from 'react';
import { LCARS } from './lcarsTheme';

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
  @keyframes bhPulse1 {
    0%   { r: 18; opacity: 0.72; stroke-width: 1.1; }
    68%  { r: 35; opacity: 0; stroke-width: 0.35; }
    100% { r: 35; opacity: 0; stroke-width: 0.35; }
  }
  @keyframes bhPulse2 {
    0%   { r: 23; opacity: 0.48; stroke-width: 0.9; }
    72%  { r: 41; opacity: 0; stroke-width: 0.25; }
    100% { r: 41; opacity: 0; stroke-width: 0.25; }
  }
  .bh-pulse-active .bh-ring1 { animation: bhPulse1 1.35s ease-out infinite; }
  .bh-pulse-active .bh-ring2 { animation: bhPulse2 1.35s ease-out 0.42s infinite; }
`;

let _pulseStyleInjected = false;
function injectPulseStyle() {
  if (_pulseStyleInjected) return;
  _pulseStyleInjected = true;
  const el = document.createElement('style');
  el.textContent = PULSE_STYLE;
  document.head.appendChild(el);
}

export function BlackHoleBadge({ active }: { active: boolean }) {
  useEffect(() => { injectPulseStyle(); }, []);
  const ringColor = active ? 'rgba(196,92,255,0.88)' : 'rgba(126,78,205,0.34)';
  const pulseClass = active ? 'bh-pulse-active' : 'bh-pulse-static';
  return (
    <svg
      width="72" height="72" viewBox="-36 -36 72 72"
      aria-label={active ? 'Black hole — accretion active' : 'Black hole — event horizon stable'}
      className={pulseClass}
      style={{ flexShrink: 0, overflow: 'visible', filter: active ? 'drop-shadow(0 0 16px rgba(184,92,255,0.72))' : 'drop-shadow(0 0 5px rgba(126,78,205,0.18))', transition: 'filter 600ms ease' }}
    >
      <circle className="bh-ring1" cx="0" cy="0" r="18" fill="none" stroke={ringColor} strokeWidth="1.1" />
      <circle className="bh-ring2" cx="0" cy="0" r="23" fill="none" stroke={ringColor} strokeWidth="0.9" />
      <circle cx="0" cy="0" r="28" fill="none" stroke={active ? 'rgba(184,92,255,0.24)' : 'rgba(126,78,205,0.12)'} strokeWidth="2.5" />
      <circle cx="0" cy="0" r="18" fill="none" stroke={active ? 'rgba(218,158,255,0.9)' : 'rgba(126,78,205,0.42)'} strokeWidth="1.7" />
      <circle cx="0" cy="0" r="10" fill="none" stroke="rgba(13,0,24,0.96)" strokeWidth="3.2" />
      {active && <ellipse cx="0" cy="0" rx="25" ry="6" fill="none" stroke="rgba(224,170,255,0.52)" strokeWidth="1.8" />}
    </svg>
  );
}
