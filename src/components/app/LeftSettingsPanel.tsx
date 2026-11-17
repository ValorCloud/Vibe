/**
 * LeftSettingsPanel — pure layout shell.
 *
 * Owns: drawer geometry (desktop animated sidebar / mobile fixed overlay),
 * LCARS decorations, focus trap, aria dialog attributes.
 *
 * Contains zero data props — all song meta state is sourced by SongMetaForm
 * via ComposerParamsContext. Receives only 5 props:
 *   isLeftPanelOpen / setIsLeftPanelOpen  — panel open state
 *   isMobileOverlay                        — layout mode
 *   onGenerateSong / onRegenerateSong      — layout-intent callbacks
 */
import React, { useId, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { SongMetaForm } from './SongMetaForm';
import { useInterfaceMotionDisabled } from '../../contexts/InterfaceMotionContext';

interface Props {
  isLeftPanelOpen: boolean;
  setIsLeftPanelOpen: (v: boolean | ((v: boolean) => boolean)) => void;
  isMobileOverlay?: boolean;
  onGenerateSong: () => void;
  onRegenerateSong?: () => void;
}

const SOLID_BG_DARK = 'var(--bg-app, #0c0c0c)';
const LCARS_SEPARATOR = (
  <div style={{
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: '2px',
    background: 'linear-gradient(180deg, var(--lcars-amber) 0%, var(--lcars-cyan) 50%, var(--lcars-violet) 100%)',
    opacity: 0.85, pointerEvents: 'none', zIndex: 10,
  }} />
);

export function LeftSettingsPanel({
  isLeftPanelOpen,
  setIsLeftPanelOpen,
  isMobileOverlay,
  onGenerateSong,
  onRegenerateSong,
}: Props) {
  const motionDisabled = useInterfaceMotionDisabled();
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const handleClose = () => setIsLeftPanelOpen(false);
  useFocusTrap(panelRef, !!(isMobileOverlay && isLeftPanelOpen), handleClose);

  // Build formProps without props absent from SongMetaFormProps.
  // onRegenerateSong is optional — only spread it when defined to satisfy
  // exactOptionalPropertyTypes (passing `undefined` explicitly is an error).
  const formProps = {
    onGenerateSong,
    setIsLeftPanelOpen,
    headingId,
    ...(onRegenerateSong !== undefined ? { onRegenerateSong } : {}),
  };

  // ── Mobile/tablet: fixed overlay ──────────────────────────────────────────
  if (isMobileOverlay) {
    return (
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`flex flex-col shadow-2xl lcars-panel
          fixed left-0 top-0 z-[80] w-[min(22rem,85vw)]
          transition-transform duration-300 ease-in-out
          ${isLeftPanelOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'}`}
        style={{
          bottom: 'calc(56px + var(--sab, 0px))',
          position: 'fixed',
          overflow: 'hidden',
          backgroundColor: 'color-mix(in srgb, var(--bg-app, #0c0c0c) 98%, transparent)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        }}
      >
        {LCARS_SEPARATOR}
        <SongMetaForm {...formProps} />
      </div>
    );
  }

  // ── Desktop: animated inline sidebar ──────────────────────────────────────
  return (
    <AnimatePresence initial={false}>
      {isLeftPanelOpen && (
        <motion.div
          key="left-panel-desktop"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 352, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={motionDisabled ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 220 }}
          className="shrink-0 h-full flex flex-col relative lcars-panel"
          style={{
            overflow: 'hidden',
            backgroundColor: SOLID_BG_DARK,
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            minWidth: 0,
          }}
        >
          {LCARS_SEPARATOR}
          <div style={{ width: 352, minWidth: 352, flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <SongMetaForm {...formProps} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
