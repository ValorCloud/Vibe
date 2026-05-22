import type { AudioEngineState, RepeatMode } from './useAudioEngine';
import { LCARS } from './lcarsTheme';

interface PlayerControlsProps {
  engine: AudioEngineState;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}

// ── SVG icons ──────────────────────────────────────────────────────────────
function IconShuffle({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      {active && <circle cx="21" cy="3" r="2" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function IconRepeatOne() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      <text x="10" y="14" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="monospace">1</text>
    </svg>
  );
}

function IconRepeatAll() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconRepeatNone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" opacity="0.45">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconCrossfade() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" opacity="0.3">
      <path d="M4 4 Q12 12 20 4" />
      <path d="M4 20 Q12 12 20 20" />
      <circle cx="4" cy="4" r="1.5" fill="currentColor" />
      <circle cx="20" cy="4" r="1.5" fill="currentColor" />
    </svg>
  );
}

// ── Mode chip ───────────────────────────────────────────────────────────────
function ModeChip({
  label, active, onClick, children, title, disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      aria-pressed={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 4,
        border: `1px solid ${active ? LCARS.orange + 'cc' : LCARS.orange + '28'}`,
        background: active
          ? `linear-gradient(135deg, ${LCARS.orange}22 0%, ${LCARS.orange}0a 100%)`
          : 'rgba(0,0,0,0.25)',
        color: active ? LCARS.orange : LCARS.subText,
        fontSize: 9,
        letterSpacing: 2,
        fontWeight: 700,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        boxShadow: active ? `0 0 10px ${LCARS.orange}44, inset 0 1px 0 ${LCARS.orange}22` : 'none',
        transition: 'all 150ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

// ── Repeat icon selector ───────────────────────────────────────────────────
function RepeatIcon({ mode }: { mode: RepeatMode }) {
  if (mode === 'one') return <IconRepeatOne />;
  if (mode === 'all') return <IconRepeatAll />;
  return <IconRepeatNone />;
}

const REPEAT_LABELS: Record<RepeatMode, string> = {
  none: 'REPEAT',
  one: 'REPEAT·1',
  all: 'REPEAT·∞',
};

// ── Main component ─────────────────────────────────────────────────────────
export function PlayerControls({ engine, onPrev, onNext, disabled }: PlayerControlsProps) {
  const { isPlaying, togglePlay, repeat, shuffle, toggleRepeat, toggleShuffle } = engine;

  const squareStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: 8,
    background: LCARS.panelDark,
    border: 'none',
    color: LCARS.peach,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 120ms ease',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0', width: '100%' }}>

      {/* ── Mode chips row ── */}
      <div
        role="group"
        aria-label="Playback modes"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'rgba(0,0,0,0.18)',
          borderRadius: 6,
          border: `1px solid ${LCARS.orange}18`,
        }}
      >
        {/* Shuffle */}
        <ModeChip
          label="SHUFFLE"
          active={shuffle}
          onClick={toggleShuffle}
          title={shuffle ? 'Shuffle ON — click to disable' : 'Shuffle OFF — click to enable'}
        >
          <IconShuffle active={shuffle} />
        </ModeChip>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: `${LCARS.orange}22` }} aria-hidden="true" />

        {/* Repeat (cycles none→one→all) */}
        <ModeChip
          label={REPEAT_LABELS[repeat]}
          active={repeat !== 'none'}
          onClick={toggleRepeat}
          title={`Repeat: ${repeat} — click to cycle`}
        >
          <RepeatIcon mode={repeat} />
        </ModeChip>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: `${LCARS.orange}22` }} aria-hidden="true" />

        {/* Crossfade — stub, disabled */}
        <ModeChip
          label="XFADE"
          active={false}
          onClick={() => {}}
          disabled
          title="Crossfade — coming soon"
        >
          <IconCrossfade />
        </ModeChip>
      </div>

      {/* ── Transport row ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <button type="button" aria-label="Previous track" onClick={onPrev} disabled={disabled} style={squareStyle}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 6h2v12H6zM9.5 12L20 6v12z" />
          </svg>
        </button>

        <button
          type="button"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={togglePlay}
          disabled={disabled}
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: LCARS.peach,
            border: 'none',
            color: '#000',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 32px ${LCARS.peach}55`,
            transition: 'transform 120ms ease',
          }}
        >
          {isPlaying ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button type="button" aria-label="Next track" onClick={onNext} disabled={disabled} style={squareStyle}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16 6h2v12h-2zM4 6v12l10.5-6z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
