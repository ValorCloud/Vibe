import type { AudioEngineState } from './useAudioEngine';
import { LCARS } from './lcarsTheme';

interface PlayerControlsProps {
  engine: AudioEngineState;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}

/**
 * LCARS transport: large orange circular play/pause flanked by dark
 * square previous / next buttons. Matches the canonical Vox Nova mockup.
 */
export function PlayerControls({ engine, onPrev, onNext, disabled }: PlayerControlsProps) {
  const { isPlaying, togglePlay } = engine;

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
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        padding: '8px 0',
      }}
    >
      <button
        type="button"
        aria-label="Previous track"
        onClick={onPrev}
        disabled={disabled}
        style={squareStyle}
      >
        {/* prev (skip-back) icon */}
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

      <button
        type="button"
        aria-label="Next track"
        onClick={onNext}
        disabled={disabled}
        style={squareStyle}
      >
        {/* next (skip-forward) icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16 6h2v12h-2zM4 6v12l10.5-6z" />
        </svg>
      </button>
    </div>
  );
}
