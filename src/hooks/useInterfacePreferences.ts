import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';
import { statusZoomLevels } from '../vendor/valor-configuration/controls.mjs';

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function subscribeReducedMotion(notify: () => void) {
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  media?.addEventListener('change', notify);
  return () => media?.removeEventListener('change', notify);
}

/** Display scale is independent of the existing small/medium/large font preference. */
export function useInterfacePreferences() {
  const [zoom, setZoomState] = useState(() => {
    const stored = Number(safeGetItem('vibe_interface_zoom'));
    return statusZoomLevels.includes(stored) ? stored : 100;
  });
  const [animationsPaused, setPausedState] = useState(() => safeGetItem('vibe_animations_paused') === 'true');
  const systemReducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotion, () => false);
  const motionDisabled = animationsPaused || systemReducedMotion;

  const setZoom = useCallback((value: number) => {
    if (!statusZoomLevels.includes(value)) return;
    setZoomState(value);
    safeSetItem('vibe_interface_zoom', String(value));
  }, []);
  const setAnimationsPaused = useCallback((value: boolean) => {
    setPausedState(value);
    safeSetItem('vibe_animations_paused', String(value));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.interfaceMotion;
    root.dataset.interfaceMotion = motionDisabled ? 'off' : 'on';
    return () => {
      if (previous === undefined) delete root.dataset.interfaceMotion;
      else root.dataset.interfaceMotion = previous;
    };
  }, [motionDisabled]);

  return { zoom, setZoom, animationsPaused, setAnimationsPaused, motionDisabled, systemReducedMotion };
}
