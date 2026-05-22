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
    0%, 100% { opacity: 1; box-shadow: 0 0 6px currentColor; }
    50%       { opacity: 0.55; box-shadow: 0 0 2px currentColor; }
  }
  .lcars-led-active  { animation: lcarsLedPulse 1.8s ease-in-out infinite; }
  .lcars-btn:hover:not(:disabled) { filter: brightness(1.18); }
  .lcars-btn:active:not(:disabled) { transform: scale(0.96); }
  .lcars-transport:hover:not(:disabled) { filter: brightness(1.22); transform: scale(1.05); }
  .lcars-transport:active:not(:disabled) { transform: scale(0.94); }
  .lcars-play:hover:not(:disabled) { box-shadow: 0 0 48px var(--lcars-play-glow, #f5b06b88) !important; filter: brightness(1.12); }
  .lcars-play:active:not(:disabled) { transform: scale(0.95) !important; }
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
`;

let _cssInjected = false;
function injectControlsCSS() {
  if (_cssInjected) return;
  _cssInjected = true;
  const el = document.createElement('style');
  el.textContent = CONTROLS_CSS;
  document.head.appendChild(el);
}

function IconShuffle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}

function IconRepeat({ mode }: { mode: RepeatMode }) {
  if (mode === 'one') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        <text x="9.5" y="14.5" fontSize="6.5" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="monospace">1</text>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconAutoplay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
      <line x1="19" y1="3" x2="19" y2="21" />
    </svg>
  );
}

function IconCrossfade() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6 Q12 18 20 6" />
      <path d="M4 18 Q12 6 20 18" />
      <circle cx="4" cy="6" r="2" fill="currentColor" />
      <circle cx="20" cy="6" r="2" fill="currentColor" />
      <circle cx="4" cy="18" r="2" fill="currentColor" />
      <circle cx="20" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

function IconSleep() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  sublabel?: string;
  active: boolean;
  disabled?: boolean;
  color: string;
  dimColor?: string;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}

function LCARSModeButton({
  label, sublabel, active, disabled, color, dimColor, onClick, title, children,
}: LCARSModeButtonProps) {
  const dim = dimColor ?? 'rgba(255,255,255,0.18)';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label + (sublabel ? ' — ' + sublabel : '')}
      aria-pressed={active}
      className="lcars-btn"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '10px 14px 8px',
        minWidth: 72,
        borderRadius: 6,
        border: `1px solid ${active ? color + 'cc' : color + '28'}`,
        background: active
          ? `linear-gradient(160deg, ${color}1a 0%, ${color}08 100%)`
          : 'rgba(0,0,0,0.28)',
        color: active ? color : dim,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.28 : 1,
        boxShadow: active
          ? `0 0 14px ${color}33, inset 0 1px 0 ${color}22, 0 1px 0 rgba(0,0,0,0.4)`
          : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(0,0,0,0.4)',
        transition: 'all 160ms cubic-bezier(0.16,1,0.3,1)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <span className={active ? 'lcars-led-active' : undefined}
        style={{ position: 'absolute', top: 6, right: 7, width: 5, height: 5, borderRadius: '50%',
          background: active ? color : 'rgba(255,255,255,0.12)', color: color,
          transition: 'background 200ms ease' }}
        aria-hidden="true"
      />
      <span style={{ lineHeight: 0 }}>{children}</span>
      <span style={{ fontSize: 8, letterSpacing: 1.8, fontWeight: 700, fontFamily: 'inherit', lineHeight: 1, textTransform: 'uppercase' }}>
        {label}
      </span>
      {sublabel && (
        <span style={{ fontSize: 7, letterSpacing: 1.2, fontWeight: 600,
          color: active ? color : 'rgba(255,255,255,0.25)',
          background: active ? color + '22' : 'transparent',
          padding: '1px 4px', borderRadius: 3, lineHeight: 1.2, transition: 'all 160ms ease' }}>
          {sublabel}
        </span>
      )}
    </button>
  );
}

function VertDivider() {
  return (
    <div aria-hidden="true" style={{
      width: 1, height: 32,
      background: `linear-gradient(to bottom, transparent, ${LCARS.orange}30, transparent)`,
      flexShrink: 0,
    }} />
  );
}

const XFADE_PRESETS = [0, 500, 1000, 2000, 3000, 5000];

interface CrossfadePopoverProps {
  crossfadeMs: number;
  setCrossfadeMs: (ms: number) => void;
  onClose: () => void;
}

function CrossfadePopover({ crossfadeMs, setCrossfadeMs, onClose }: CrossfadePopoverProps) {
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
      <input
        type="range"
        min={0}
        max={6000}
        step={100}
        value={crossfadeMs}
        onChange={e => setCrossfadeMs(Number(e.target.value))}
        aria-label="Crossfade duration in milliseconds"
        style={{ width: '100%', accentColor: LCARS.orange, marginBottom: 8 }}
      />
      <div style={{ color: LCARS.peach, fontSize: 14, fontVariantNumeric: 'tabular-nums', textAlign: 'center', letterSpacing: 2, marginBottom: 10 }}>
        {crossfadeMs === 0 ? 'OFF' : `${(crossfadeMs / 1000).toFixed(1)}s`}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {XFADE_PRESETS.map(p => (
          <button key={p} type="button"
            onClick={() => setCrossfadeMs(p)}
            style={{
              flex: '1 1 auto', padding: '4px 6px', fontSize: 9, letterSpacing: 1, fontWeight: 700,
              fontFamily: 'inherit', borderRadius: 3, cursor: 'pointer',
              background: crossfadeMs === p ? LCARS.orange : 'transparent',
              color: crossfadeMs === p ? '#000' : LCARS.orange,
              border: `1px solid ${LCARS.orange}`,
              transition: 'all 120ms',
            }}
            aria-pressed={crossfadeMs === p}
          >
            {p === 0 ? 'OFF' : `${p / 1000}s`}
          </button>
        ))}
      </div>
    </div>
  );
}

const SLEEP_PRESETS: Array<{ label: string; ms: number }> = [
  { label: '5 MIN',  ms: 5 * 60 * 1000 },
  { label: '15 MIN', ms: 15 * 60 * 1000 },
  { label: '30 MIN', ms: 30 * 60 * 1000 },
  { label: '1 HR',   ms: 60 * 60 * 1000 },
  { label: '2 HR',   ms: 120 * 60 * 1000 },
];

interface SleepPopoverProps {
  sleepTimerEnd: number | null;
  setSleepTimer: (ms: number | null) => void;
  onClose: () => void;
}

function formatRemaining(end: number): string {
  const rem = Math.max(0, end - Date.now());
  const m = Math.floor(rem / 60000);
  const s = Math.floor((rem % 60000) / 1000).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function SleepPopover({ sleepTimerEnd, setSleepTimer, onClose }: SleepPopoverProps) {
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
          <button key={p.ms} type="button"
            onClick={() => { setSleepTimer(p.ms); onClose(); }}
            style={{
              padding: '6px 10px', fontSize: 10, letterSpacing: 2, fontWeight: 700,
              fontFamily: 'inherit', borderRadius: 3, cursor: 'pointer', textAlign: 'left',
              background: 'transparent',
              color: LCARS.purple,
              border: `1px solid ${LCARS.purple}55`,
              transition: 'all 120ms',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {sleepTimerEnd && (
        <button type="button"
          onClick={() => { setSleepTimer(null); onClose(); }}
          style={{
            width: '100%', padding: '6px', fontSize: 9, letterSpacing: 2, fontWeight: 700,
            fontFamily: 'inherit', borderRadius: 3, cursor: 'pointer',
            background: LCARS.alertRed + '22', color: LCARS.alertRed,
            border: `1px solid ${LCARS.alertRed}55`,
          }}
        >
          CANCEL TIMER
        </button>
      )}
    </div>
  );
}

const REPEAT_SUBLABEL: Record<RepeatMode, string | undefined> = {
  none: undefined,
  one: 'TRACK',
  all: 'ALL',
};

const REPEAT_TITLE: Record<RepeatMode, string> = {
  none: 'Repeat OFF — click for REPEAT·1',
  one: 'Repeat TRACK — click for REPEAT·ALL',
  all: 'Repeat ALL — click to disable',
};

export function PlayerControls({ engine, onPrev, onNext, disabled }: PlayerControlsProps) {
  injectControlsCSS();

  const { isPlaying, togglePlay, repeat, shuffle, autoplay, crossfadeMs, sleepTimerEnd,
    toggleRepeat, toggleShuffle, toggleAutoplay, setCrossfadeMs, setSleepTimer } = engine;

  const [xfadeOpen, setXfadeOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);

  // exactOptionalPropertyTypes-safe: only spread sublabel when it is a string
  const repeatButtonProps = REPEAT_SUBLABEL[repeat]
    ? { sublabel: REPEAT_SUBLABEL[repeat] as string }
    : {};
  const xfadeButtonProps = crossfadeMs > 0
    ? { sublabel: `${(crossfadeMs / 1000).toFixed(1)}s` }
    : {};
  const sleepButtonProps = sleepTimerEnd !== null
    ? { sublabel: '◉' }
    : {};

  const transportSquare: React.CSSProperties = {
    width: 52, height: 52, borderRadius: 8,
    background: LCARS.panelDark,
    border: `1px solid ${LCARS.peach}28`,
    color: LCARS.peach,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 140ms cubic-bezier(0.16,1,0.3,1)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.4)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '10px 0 4px', width: '100%' }}>

      {/* ── Mode strip ── */}
      <div role="group" aria-label="Playback modes"
        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>

        <LCARSModeButton label="SHUFFLE" active={shuffle} color={LCARS.peach}
          title="Randomise playback order" onClick={toggleShuffle}>
          <IconShuffle />
        </LCARSModeButton>

        <VertDivider />

        <LCARSModeButton
          label="REPEAT"
          active={repeat !== 'none'}
          color={LCARS.orange}
          title={REPEAT_TITLE[repeat]}
          onClick={toggleRepeat}
          {...repeatButtonProps}
        >
          <IconRepeat mode={repeat} />
        </LCARSModeButton>

        <VertDivider />

        <LCARSModeButton label="AUTOPLAY" active={autoplay} color="#b0c8ff"
          title="Auto-advance to next track on end" onClick={toggleAutoplay}>
          <IconAutoplay />
        </LCARSModeButton>

        <VertDivider />

        <div style={{ position: 'relative' }}>
          <LCARSModeButton
            label="XFADE"
            active={crossfadeMs > 0}
            color={LCARS.amber}
            title="Configure crossfade duration"
            onClick={() => { setXfadeOpen(o => !o); setSleepOpen(false); }}
            {...xfadeButtonProps}
          >
            <IconCrossfade />
          </LCARSModeButton>
          {xfadeOpen && (
            <CrossfadePopover
              crossfadeMs={crossfadeMs}
              setCrossfadeMs={setCrossfadeMs}
              onClose={() => setXfadeOpen(false)}
            />
          )}
        </div>

        <VertDivider />

        <div style={{ position: 'relative' }}>
          <LCARSModeButton
            label="SLEEP"
            active={sleepTimerEnd !== null}
            color={LCARS.purple}
            title="Set sleep timer"
            onClick={() => { setSleepOpen(o => !o); setXfadeOpen(false); }}
            {...sleepButtonProps}
          >
            <IconSleep />
          </LCARSModeButton>
          {sleepOpen && (
            <SleepPopover
              sleepTimerEnd={sleepTimerEnd}
              setSleepTimer={setSleepTimer}
              onClose={() => setSleepOpen(false)}
            />
          )}
        </div>
      </div>

      {/* ── LCARS status strip ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ height: 2, width: 40, background: LCARS.peach, borderRadius: 1, opacity: 0.5 }} aria-hidden="true" />
        <span style={{ fontSize: 8, letterSpacing: 3, color: isPlaying ? LCARS.alertRed : LCARS.subText, transition: 'color 300ms ease' }}>
          {isPlaying ? 'TRANSMITTING' : 'STANDBY'}
        </span>
        <div style={{ height: 2, width: 40, background: LCARS.peach, borderRadius: 1, opacity: 0.5 }} aria-hidden="true" />
      </div>

      {/* ── Transport ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onPrev} disabled={disabled} aria-label="Previous track"
          className="lcars-transport" style={transportSquare}>
          <IconPrev />
        </button>

        <button type="button" onClick={togglePlay} disabled={disabled} aria-label={isPlaying ? 'Pause' : 'Play'}
          className="lcars-play"
          style={{
            width: 68, height: 68, borderRadius: 12,
            background: isPlaying
              ? `linear-gradient(145deg, ${LCARS.orange}, ${LCARS.peach})`
              : `linear-gradient(145deg, ${LCARS.peach}cc, ${LCARS.orange}88)`,
            border: 'none',
            color: '#000',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.35 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isPlaying
              ? `0 0 28px ${LCARS.orange}66, 0 4px 16px rgba(0,0,0,0.5)`
              : `0 0 12px ${LCARS.peach}33, 0 4px 16px rgba(0,0,0,0.5)`,
            transition: 'all 160ms cubic-bezier(0.16,1,0.3,1)',
            '--lcars-play-glow': LCARS.orange + '88',
          } as React.CSSProperties}
        >
          {isPlaying ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        <button type="button" onClick={onNext} disabled={disabled} aria-label="Next track"
          className="lcars-transport" style={transportSquare}>
          <IconNext />
        </button>
      </div>

    </div>
  );
}
