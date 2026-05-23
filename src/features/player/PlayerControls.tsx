import { useState, useRef, useEffect } from 'react';
import type { AudioEngineState, RepeatMode } from './useAudioEngine';
import { LCARS } from './lcarsTheme';

interface PlayerControlsProps {
  engine: AudioEngineState;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}

const CONTROLS_CSS = `
  @keyframes lcarsLedPulse {
    0%   { opacity: 1;    box-shadow: 0 0 7px currentColor, 0 0 14px currentColor; }
    40%  { opacity: 0.35; box-shadow: 0 0 2px currentColor; }
    55%  { opacity: 0.9;  box-shadow: 0 0 9px currentColor, 0 0 18px currentColor; }
    100% { opacity: 1;    box-shadow: 0 0 7px currentColor, 0 0 14px currentColor; }
  }
  @keyframes lcarsRipple {
    0%   { transform: scale(0); opacity: 0.55; }
    100% { transform: scale(2.6); opacity: 0; }
  }
  @keyframes lcarsShuffleDot {
    0%, 100% { transform: translateX(0); }
    50%       { transform: translateX(4px); }
  }
  .lcars-led-active { animation: lcarsLedPulse 2.1s cubic-bezier(0.4,0,0.6,1) infinite; }
  .lcars-shuffle-dot-active { animation: lcarsShuffleDot 1.4s ease-in-out infinite; }
  .lcars-btn { position: relative; overflow: hidden; }
  .lcars-btn::after {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle at center, currentColor 0%, transparent 70%);
    opacity: 0;
    transition: opacity 200ms;
    pointer-events: none;
    border-radius: inherit;
  }
  .lcars-btn:hover:not(:disabled)::after { opacity: 0.06; }
  .lcars-btn:hover:not(:disabled) { filter: brightness(1.18); }
  .lcars-btn:active:not(:disabled) { transform: scale(0.95); filter: brightness(0.92); }
  .lcars-transport { position: relative; overflow: hidden; }
  .lcars-transport:hover:not(:disabled) { filter: brightness(1.25); transform: scale(1.06); }
  .lcars-transport:active:not(:disabled) { transform: scale(0.93); }
  .lcars-play:hover:not(:disabled) {
    box-shadow: 0 0 48px var(--lcars-play-glow, #f5b06b88) !important;
    filter: brightness(1.12);
  }
  .lcars-play:active:not(:disabled) { transform: scale(0.95) !important; }
  .lcars-ripple {
    position: absolute;
    border-radius: 50%;
    width: 20px; height: 20px;
    margin-top: -10px; margin-left: -10px;
    background: currentColor;
    animation: lcarsRipple 480ms ease-out forwards;
    pointer-events: none;
  }
  .lcars-popover {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    background: #0a0a14;
    border: 1px solid rgba(255,153,0,0.35);
    border-radius: 6px;
    padding: 12px 14px;
    min-width: 180px;
    box-shadow: 0 0 24px rgba(255,153,0,0.15), 0 8px 32px rgba(0,0,0,0.7);
  }
  .lcars-mode-grid {
    display: flex;
    flex-wrap: nowrap;
    gap: 6px;
    justify-content: center;
    align-items: stretch;
    width: 100%;
    overflow-x: auto;
    padding-bottom: 2px;
  }
  @media (max-width: 480px) {
    .lcars-mode-grid { justify-content: flex-start; }
  }
`;

let _cssInjected = false;
function injectControlsCSS() {
  if (_cssInjected) return;
  _cssInjected = true;
  const el = document.createElement('style');
  el.textContent = CONTROLS_CSS;
  document.head.appendChild(el);
}

function spawnRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const r = document.createElement('span');
  r.className = 'lcars-ripple';
  r.style.top  = `${e.clientY - rect.top}px`;
  r.style.left = `${e.clientX - rect.left}px`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

function IconShuffle({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      {active && (
        <circle cx="4" cy="20" r="2.2" fill="currentColor" stroke="none"
          className="lcars-shuffle-dot-active" />
      )}
    </svg>
  );
}

function IconRepeat({ mode }: { mode: RepeatMode }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      {mode === 'one' && (
        <text x="9.5" y="14.8" fontSize="6.5" fontWeight="bold"
          fill="currentColor" stroke="none" fontFamily="monospace">1</text>
      )}
    </svg>
  );
}

function IconAutoplay() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
      <line x1="19" y1="3" x2="19" y2="21" />
    </svg>
  );
}

function IconCrossfade() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6 Q12 18 20 6" />
      <path d="M4 18 Q12 6 20 18" />
      <circle cx="4"  cy="6"  r="2" fill="currentColor" />
      <circle cx="20" cy="6"  r="2" fill="currentColor" />
      <circle cx="4"  cy="18" r="2" fill="currentColor" />
      <circle cx="20" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

function IconSleep() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconPrev() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 6h2v12H6zM9.5 12L20 6v12z" />
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16 6h2v12h-2zM4 6v12l10.5-6z" />
    </svg>
  );
}

interface LCARSModeButtonProps {
  label: string;
  badge?: string;
  badgeColor?: string;
  active: boolean;
  disabled?: boolean;
  color: string;
  dimColor?: string;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}

/** Compact secondary mode button — smaller than transport controls */
function LCARSModeButton({
  label, badge, badgeColor, active, disabled, color, dimColor, onClick, title, children,
}: LCARSModeButtonProps) {
  const dim = dimColor ?? 'rgba(255,255,255,0.18)';
  const bc  = badgeColor ?? color;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    spawnRipple(e);
    onClick();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      aria-label={label + (badge ? ' — ' + badge : '')}
      aria-pressed={active}
      className="lcars-btn"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '6px 10px',
        minWidth: 56,
        borderRadius: 5,
        border: `1px solid ${active ? color + 'cc' : color + '28'}`,
        background: active
          ? `linear-gradient(155deg, ${color}20 0%, ${color}0a 100%)`
          : 'rgba(0,0,0,0.28)',
        color: active ? color : dim,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.28 : 1,
        boxShadow: active
          ? `0 0 12px ${color}38, 0 0 3px ${color}18, inset 0 1px 0 ${color}22, 0 1px 0 rgba(0,0,0,0.4)`
          : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(0,0,0,0.4)',
        transition: 'all 160ms cubic-bezier(0.16,1,0.3,1)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* LED indicator */}
      <span
        className={active ? 'lcars-led-active' : undefined}
        style={{
          position: 'absolute', top: 4, right: 5,
          width: 4, height: 4, borderRadius: '50%',
          background: active ? color : 'rgba(255,255,255,0.10)',
          color: color,
          transition: 'background 200ms ease',
        }}
        aria-hidden="true"
      />

      {badge !== undefined && (
        <span style={{
          position: 'absolute', top: 3, left: 4,
          fontSize: 6, letterSpacing: 0.8, fontWeight: 800,
          fontFamily: 'inherit', lineHeight: 1,
          padding: '1px 2px', borderRadius: 3,
          background: active ? bc + '30' : 'rgba(255,255,255,0.06)',
          color: active ? bc : 'rgba(255,255,255,0.28)',
          border: `1px solid ${active ? bc + '55' : 'rgba(255,255,255,0.10)'}`,
          transition: 'all 160ms ease',
          textTransform: 'uppercase',
        }}>
          {badge}
        </span>
      )}

      <span style={{ lineHeight: 0 }}>{children}</span>

      <span style={{
        fontSize: 7, letterSpacing: 1.6, fontWeight: 700,
        fontFamily: 'inherit', lineHeight: 1, textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </button>
  );
}

function ActiveModesLine({
  shuffle, repeat, autoplay, crossfadeMs, sleepTimerEnd, isPlaying,
}: {
  shuffle: boolean; repeat: RepeatMode; autoplay: boolean;
  crossfadeMs: number; sleepTimerEnd: number | null; isPlaying: boolean;
}) {
  const tokens: string[] = [];
  if (shuffle)           tokens.push('SHF');
  if (repeat !== 'none') tokens.push(repeat === 'one' ? 'RPT·1' : 'RPT·ALL');
  if (autoplay)          tokens.push('APL');
  if (crossfadeMs > 0)   tokens.push(`XFD·${(crossfadeMs / 1000).toFixed(1)}s`);
  if (sleepTimerEnd !== null) tokens.push('SLP');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 14, minWidth: 0 }}>
      <div style={{ height: 2, width: 32, flexShrink: 0, background: LCARS.peach, borderRadius: 1, opacity: 0.45 }} aria-hidden="true" />
      <span style={{
        fontSize: 8, letterSpacing: 3, fontWeight: 700,
        color: isPlaying ? LCARS.alertRed : LCARS.subText,
        transition: 'color 300ms ease',
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {isPlaying ? 'TRANSMITTING' : 'STANDBY'}
      </span>
      {tokens.length > 0 && (
        <>
          <div style={{ height: 1, width: 12, flexShrink: 0, background: LCARS.orange, opacity: 0.4 }} aria-hidden="true" />
          <span style={{ fontSize: 7, letterSpacing: 2, fontWeight: 700, color: LCARS.orange, opacity: 0.85, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {tokens.join('·')}
          </span>
        </>
      )}
      <div style={{ height: 2, width: 32, flexShrink: 0, background: LCARS.peach, borderRadius: 1, opacity: 0.45 }} aria-hidden="true" />
    </div>
  );
}

const XFADE_PRESETS = [0, 500, 1000, 2000, 3000, 5000];

function CrossfadePopover({ crossfadeMs, setCrossfadeMs, onClose }: {
  crossfadeMs: number; setCrossfadeMs: (ms: number) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);
  return (
    <div ref={ref} className="lcars-popover" role="dialog" aria-label="Crossfade settings">
      <div style={{ color: LCARS.orange, fontSize: 9, letterSpacing: 3, marginBottom: 10 }}>XFADE DURATION</div>
      <input type="range" min={0} max={6000} step={100} value={crossfadeMs}
        onChange={e => setCrossfadeMs(Number(e.target.value))}
        aria-label="Crossfade duration in milliseconds"
        style={{ width: '100%', accentColor: LCARS.orange, marginBottom: 8 }} />
      <div style={{ color: LCARS.peach, fontSize: 14, fontVariantNumeric: 'tabular-nums', textAlign: 'center', letterSpacing: 2, marginBottom: 10 }}>
        {crossfadeMs === 0 ? 'OFF' : `${(crossfadeMs / 1000).toFixed(1)}s`}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {XFADE_PRESETS.map(p => (
          <button key={p} type="button" onClick={() => setCrossfadeMs(p)}
            style={{
              flex: '1 1 auto', padding: '4px 6px', fontSize: 9, letterSpacing: 1, fontWeight: 700,
              fontFamily: 'inherit', borderRadius: 3, cursor: 'pointer',
              background: crossfadeMs === p ? LCARS.orange : 'transparent',
              color: crossfadeMs === p ? '#000' : LCARS.orange,
              border: `1px solid ${LCARS.orange}`, transition: 'all 120ms',
            }} aria-pressed={crossfadeMs === p}>
            {p === 0 ? 'OFF' : `${p / 1000}s`}
          </button>
        ))}
      </div>
    </div>
  );
}

const SLEEP_PRESETS: Array<{ label: string; ms: number }> = [
  { label: '5 MIN',  ms: 5  * 60 * 1000 },
  { label: '15 MIN', ms: 15 * 60 * 1000 },
  { label: '30 MIN', ms: 30 * 60 * 1000 },
  { label: '1 HR',   ms: 60 * 60 * 1000 },
  { label: '2 HR',   ms: 120 * 60 * 1000 },
];

function formatRemaining(end: number): string {
  const rem = Math.max(0, end - Date.now());
  const m = Math.floor(rem / 60000);
  const s = Math.floor((rem % 60000) / 1000).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function SleepPopover({ sleepTimerEnd, setSleepTimer, onClose }: {
  sleepTimerEnd: number | null; setSleepTimer: (ms: number | null) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState(sleepTimerEnd ? formatRemaining(sleepTimerEnd) : '');
  useEffect(() => {
    if (!sleepTimerEnd) return;
    const id = window.setInterval(() => setRemaining(formatRemaining(sleepTimerEnd)), 1000);
    return () => window.clearInterval(id);
  }, [sleepTimerEnd]);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);
  return (
    <div ref={ref} className="lcars-popover" role="dialog" aria-label="Sleep timer settings">
      <div style={{ color: LCARS.purple, fontSize: 9, letterSpacing: 3, marginBottom: 10 }}>SLEEP TIMER</div>
      {sleepTimerEnd && (
        <div style={{ color: LCARS.alertRed, fontSize: 13, fontVariantNumeric: 'tabular-nums', textAlign: 'center', letterSpacing: 3, marginBottom: 10 }}>
          ◉ {remaining}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {SLEEP_PRESETS.map(p => (
          <button key={p.ms} type="button" onClick={() => { setSleepTimer(p.ms); onClose(); }}
            style={{
              padding: '6px 10px', fontSize: 10, letterSpacing: 2, fontWeight: 700,
              fontFamily: 'inherit', borderRadius: 3, cursor: 'pointer', textAlign: 'left',
              background: 'transparent', color: LCARS.purple,
              border: `1px solid ${LCARS.purple}55`, transition: 'all 120ms',
            }}>
            {p.label}
          </button>
        ))}
      </div>
      {sleepTimerEnd && (
        <button type="button" onClick={() => { setSleepTimer(null); onClose(); }}
          style={{
            width: '100%', padding: '6px', fontSize: 9, letterSpacing: 2, fontWeight: 700,
            fontFamily: 'inherit', borderRadius: 3, cursor: 'pointer',
            background: LCARS.alertRed + '22', color: LCARS.alertRed,
            border: `1px solid ${LCARS.alertRed}55`,
          }}>
          CANCEL TIMER
        </button>
      )}
    </div>
  );
}

const REPEAT_BADGE: Record<RepeatMode, string | undefined> = { none: undefined, one: '×1', all: 'ALL' };
const REPEAT_TITLE: Record<RepeatMode, string> = {
  none: 'Repeat OFF — click for REPEAT·1',
  one:  'Repeat TRACK — click for REPEAT·ALL',
  all:  'Repeat ALL — click to disable',
};

export function PlayerControls({ engine, onPrev, onNext, disabled }: PlayerControlsProps) {
  injectControlsCSS();

  const {
    isPlaying, togglePlay,
    repeat, shuffle, autoplay, crossfadeMs, sleepTimerEnd,
    toggleRepeat, toggleShuffle, toggleAutoplay, setCrossfadeMs, setSleepTimer,
  } = engine;

  const [xfadeOpen, setXfadeOpen] = useState(false);
  const [sleepOpen,  setSleepOpen]  = useState(false);

  const repeatBadge = REPEAT_BADGE[repeat];
  const xfadeBadge  = crossfadeMs > 0 ? `${(crossfadeMs / 1000).toFixed(1)}s` : undefined;
  const sleepBadge  = sleepTimerEnd !== null ? '◉' : undefined;

  const transportBase: React.CSSProperties = {
    width: 52, height: 52, borderRadius: 8,
    background: LCARS.panelDark,
    border: shuffle ? `1px solid ${LCARS.peach}55` : `1px solid ${LCARS.peach}28`,
    color: LCARS.peach,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 140ms cubic-bezier(0.16,1,0.3,1)',
    boxShadow: shuffle
      ? `0 0 8px ${LCARS.peach}28, inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 4px rgba(0,0,0,0.4)`
      : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.4)',
  };

  function handlePrev(e: React.MouseEvent<HTMLButtonElement>) { spawnRipple(e); onPrev(); }
  function handleNext(e: React.MouseEvent<HTMLButtonElement>) { spawnRipple(e); onNext(); }
  function handlePlay(e: React.MouseEvent<HTMLButtonElement>) { spawnRipple(e); togglePlay(); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0', width: '100%' }}>

      {/* ── 1. Transport (main controls — top) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={handlePrev} disabled={disabled}
          aria-label="Previous track" title="Previous track"
          className="lcars-transport" style={transportBase}>
          <IconPrev />
        </button>

        <button type="button" onClick={handlePlay} disabled={disabled}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause playback' : 'Start playback'}
          className="lcars-play"
          style={{
            width: 68, height: 68, borderRadius: 12,
            background: isPlaying
              ? `linear-gradient(145deg, ${LCARS.orange}, ${LCARS.peach})`
              : `linear-gradient(145deg, ${LCARS.peach}cc, ${LCARS.orange}88)`,
            border: 'none', color: '#000',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.35 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isPlaying
              ? `0 0 28px ${LCARS.orange}66, 0 4px 16px rgba(0,0,0,0.5)`
              : `0 0 12px ${LCARS.peach}33, 0 4px 16px rgba(0,0,0,0.5)`,
            transition: 'all 160ms cubic-bezier(0.16,1,0.3,1)',
            position: 'relative', overflow: 'hidden',
            '--lcars-play-glow': LCARS.orange + '88',
          } as React.CSSProperties}>
          {isPlaying ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6"  y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        <button type="button" onClick={handleNext} disabled={disabled}
          aria-label="Next track" title="Next track"
          className="lcars-transport" style={transportBase}>
          <IconNext />
        </button>
      </div>

      {/* ── 2. Status codeline ── */}
      <ActiveModesLine
        shuffle={shuffle} repeat={repeat} autoplay={autoplay}
        crossfadeMs={crossfadeMs} sleepTimerEnd={sleepTimerEnd} isPlaying={isPlaying}
      />

      {/* ── 3. Mode grid (secondary, compact — below transport) ── */}
      <div role="group" aria-label="Playback modes" className="lcars-mode-grid">
        <LCARSModeButton label="SHUFFLE" active={shuffle} color={LCARS.peach}
          title="Randomise playback order" onClick={toggleShuffle}>
          <IconShuffle active={shuffle} />
        </LCARSModeButton>

        <LCARSModeButton label="REPEAT"
          {...(repeatBadge !== undefined ? { badge: repeatBadge } : {})}
          active={repeat !== 'none'} color={LCARS.orange}
          title={REPEAT_TITLE[repeat]} onClick={toggleRepeat}>
          <IconRepeat mode={repeat} />
        </LCARSModeButton>

        <LCARSModeButton label="AUTOPLAY" active={autoplay} color="#b0c8ff"
          title="Auto-advance to next track on end" onClick={toggleAutoplay}>
          <IconAutoplay />
        </LCARSModeButton>

        <div style={{ position: 'relative', display: 'flex' }}>
          <LCARSModeButton label="XFADE"
            {...(xfadeBadge !== undefined ? { badge: xfadeBadge } : {})}
            active={crossfadeMs > 0} color={LCARS.amber}
            title="Configure crossfade duration"
            onClick={() => { setXfadeOpen(o => !o); setSleepOpen(false); }}>
            <IconCrossfade />
          </LCARSModeButton>
          {xfadeOpen && (
            <CrossfadePopover crossfadeMs={crossfadeMs} setCrossfadeMs={setCrossfadeMs} onClose={() => setXfadeOpen(false)} />
          )}
        </div>

        <div style={{ position: 'relative', display: 'flex' }}>
          <LCARSModeButton label="SLEEP"
            {...(sleepBadge !== undefined ? { badge: sleepBadge } : {})}
            active={sleepTimerEnd !== null} color={LCARS.purple}
            title="Set sleep timer"
            onClick={() => { setSleepOpen(o => !o); setXfadeOpen(false); }}>
            <IconSleep />
          </LCARSModeButton>
          {sleepOpen && (
            <SleepPopover sleepTimerEnd={sleepTimerEnd} setSleepTimer={setSleepTimer} onClose={() => setSleepOpen(false)} />
          )}
        </div>
      </div>

    </div>
  );
}
