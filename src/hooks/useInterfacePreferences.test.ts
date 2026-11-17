import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInterfacePreferences } from './useInterfacePreferences';

let reduced = false;
const media = new EventTarget();
beforeEach(() => {
  localStorage.clear();
  reduced = false;
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reduced; },
    addEventListener: media.addEventListener.bind(media),
    removeEventListener: media.removeEventListener.bind(media),
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('interface preferences', () => {
  it('defaults absent, zero or invalid zoom to 100% without changing legacy font size', () => {
    localStorage.setItem('vibe_ui_scale', 'small');
    document.documentElement.style.fontSize = '12px';
    for (const stored of ['', '0', 'NaN', '200']) {
      localStorage.setItem('vibe_interface_zoom', stored);
      const { result, unmount } = renderHook(useInterfacePreferences);
      expect(result.current.zoom).toBe(100);
      expect(document.documentElement.style.fontSize).toBe('12px');
      expect(localStorage.getItem('vibe_ui_scale')).toBe('small');
      unmount();
    }
  });

  it('persists 50% and pause, restores both, and rejects an unsupported zoom', () => {
    const first = renderHook(useInterfacePreferences);
    act(() => { first.result.current.setZoom(50); first.result.current.setAnimationsPaused(true); });
    expect(first.result.current.zoom).toBe(50);
    expect(document.documentElement.dataset.interfaceMotion).toBe('off');
    act(() => first.result.current.setZoom(200));
    expect(first.result.current.zoom).toBe(50);
    first.unmount();
    const second = renderHook(useInterfacePreferences);
    expect(second.result.current.zoom).toBe(50);
    expect(second.result.current.animationsPaused).toBe(true);
    second.unmount();
    expect(document.documentElement.dataset.interfaceMotion).toBeUndefined();
  });

  it('responds to system reduced motion without replacing the saved personal preference', () => {
    const { result } = renderHook(useInterfacePreferences);
    act(() => { reduced = true; media.dispatchEvent(new Event('change')); });
    expect(result.current.motionDisabled).toBe(true);
    expect(result.current.animationsPaused).toBe(false);
    expect(document.documentElement.dataset.interfaceMotion).toBe('off');
    act(() => { reduced = false; media.dispatchEvent(new Event('change')); });
    expect(result.current.motionDisabled).toBe(false);
    expect(localStorage.getItem('vibe_animations_paused')).toBeNull();
  });
});
