import { useEffect, useRef } from 'react';
import { LCARS } from './lcarsTheme';

// ─── StageOverlay ─────────────────────────────────────────────────────────────
// YouTube-style transport overlay rendered *inside* the playing stage (video or
// audio-visual). Hosts the most used controls: centre play/pause + ±10s skip,
// bottom seek bar with time display, and the volume cursor.

/** Number of seconds skipped by the ±10s overlay buttons. */
export const STAGE_SKIP_SECONDS = 10;

/** Transport bindings wired from the active engine into the stage overlay. */
export interface StageOverlayBindings {
  currentTime: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onVolumeChange: (v: number) => void;
}

export interface StageOverlayProps extends StageOverlayBindings {
  visible: boolean;
  isPlaying: boolean;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function SkipIcon({ forward }: { forward: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"
      style={{ transform: forward ? 'scaleX(-1)' : undefined }}>
      <path d="M12 5a7 7 0 1 1-6.4 4.2" strokeLinecap="round" />
      <path d="M5 3v6h6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fill="currentColor" stroke="none"
        fontWeight="700" fontFamily="inherit" transform={forward ? 'scale(-1,1) translate(-24,0)' : undefined}>10</text>
    </svg>
  );
}

function PlayPauseIcon({ isPlaying }: { isPlaying: boolean }) {
  return isPlaying
    ? <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
    : <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>;
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 10v4h4l5 4V6L7 10H3z" fill="currentColor" />
      {muted ? <path d="M16 9l6 6M22 9l-6 6" /> : <path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" />}
    </svg>
  );
}

const ROUND_BTN: React.CSSProperties = {
  background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', cursor: 'pointer',
  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 160ms ease, transform 160ms ease',
};

export function StageOverlay({
  visible, isPlaying, currentTime, duration, volume,
  onTogglePlay, onSeek, onVolumeChange,
}: StageOverlayProps) {
  const muted = volume <= 0;
  const lastVolumeRef = useRef(volume > 0 ? volume : 1);
  useEffect(() => { if (volume > 0) lastVolumeRef.current = volume; }, [volume]);

  // Seek range upper bound — falls back gracefully while duration is unknown.
  const seekMax = duration > 0 ? duration : Math.max(1, currentTime);

  const skip = (delta: number) => {
    onSeek(Math.max(0, Math.min(seekMax, currentTime + delta)));
  };

  return (
    <div
      style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 26%, transparent 45%)',
        opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 220ms ease',
      }}
    >
      {/* Centre transport cluster — skip back / play-pause / skip forward */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        display: 'flex', alignItems: 'center', gap: 28 }}>
        <button type="button" onClick={() => skip(-STAGE_SKIP_SECONDS)} aria-label={`Skip back ${STAGE_SKIP_SECONDS} seconds`}
          title={`Back ${STAGE_SKIP_SECONDS}s`} style={{ ...ROUND_BTN, width: 44, height: 44, background: 'transparent' }}>
          <SkipIcon forward={false} />
        </button>
        <button type="button" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'} style={{ ...ROUND_BTN, width: 64, height: 64 }}>
          <PlayPauseIcon isPlaying={isPlaying} />
        </button>
        <button type="button" onClick={() => skip(STAGE_SKIP_SECONDS)} aria-label={`Skip forward ${STAGE_SKIP_SECONDS} seconds`}
          title={`Forward ${STAGE_SKIP_SECONDS}s`} style={{ ...ROUND_BTN, width: 44, height: 44, background: 'transparent' }}>
          <SkipIcon forward />
        </button>
      </div>

      {/* Bottom bar — seek, time display and volume cursor */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px 8px' }}>
        <input type="range" min={0} max={seekMax} step={0.1} value={Math.min(currentTime, seekMax)}
          onChange={e => onSeek(Number(e.target.value))} aria-label="Seek"
          style={{ width: '100%', accentColor: LCARS.peach, cursor: 'pointer', height: 4 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12, fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" onClick={() => onVolumeChange(muted ? (lastVolumeRef.current || 0.5) : 0)}
              aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Restore volume' : 'Mute volume'}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              <VolumeIcon muted={muted} />
            </button>
            <input type="range" min={0} max={1} step={0.01} value={volume}
              onChange={e => onVolumeChange(Number(e.target.value))} aria-label="Volume"
              title={`Volume ${Math.round(Math.max(0, Math.min(1, volume)) * 100)}%`}
              style={{ width: 90, accentColor: LCARS.purple, cursor: 'pointer', height: 4 }} />
          </span>
        </div>
      </div>
    </div>
  );
}
