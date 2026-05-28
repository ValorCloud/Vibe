import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createRef } from 'react';
import { PlayerControls } from './PlayerControls';
import { LCARS } from './lcarsTheme';
import type { AudioEngineState } from './useAudioEngine';

function makeEngine(overrides: Partial<AudioEngineState> = {}): AudioEngineState {
  return {
    audioRef: createRef<HTMLMediaElement>(),
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.5,
    repeat: 'none',
    shuffle: false,
    autoplay: false,
    crossfadeMs: 0,
    sleepTimerEnd: null,
    trackInfo: null,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    togglePlay: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    loadTrack: vi.fn().mockResolvedValue(undefined),
    beep: vi.fn(),
    toggleRepeat: vi.fn(),
    toggleShuffle: vi.fn(),
    toggleAutoplay: vi.fn(),
    setCrossfadeMs: vi.fn(),
    setSleepTimer: vi.fn(),
    setOnTrackEnded: vi.fn(),
    attachVideoElement: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  // Clearing the DOM keeps assertions about ripple nodes reliable between
  // tests. The injected <style> is intentionally left in <head> because the
  // controls use a module-level idempotency flag.
  document.body.innerHTML = '';
});

describe('PlayerControls', () => {
  it('injects the controls stylesheet once into <head> (B1)', () => {
    const before = document.head.querySelectorAll('style').length;
    const { rerender, unmount } = render(<PlayerControls engine={makeEngine()} onPrev={vi.fn()} onNext={vi.fn()} />);
    const after = document.head.querySelectorAll('style').length;
    expect(after).toBeGreaterThanOrEqual(before);

    // A second mount must not inject a duplicate stylesheet.
    rerender(<PlayerControls engine={makeEngine({ shuffle: true })} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(document.head.querySelectorAll('style').length).toBe(after);
    unmount();
  });

  it('forwards transport actions to the engine', () => {
    const togglePlay = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<PlayerControls engine={makeEngine({ togglePlay })} onPrev={onPrev} onNext={onNext} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous track' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next track' }));

    expect(togglePlay).toHaveBeenCalledOnce();
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('removes the ripple node even when animationend never fires (B2)', () => {
    vi.useFakeTimers();
    render(<PlayerControls engine={makeEngine()} onPrev={vi.fn()} onNext={vi.fn()} />);

    const shuffle = screen.getByRole('button', { name: 'SHUFFLE' });
    act(() => { fireEvent.click(shuffle); });
    expect(shuffle.querySelector('.lcars-ripple')).not.toBeNull();

    // No animationend dispatched — the timeout fallback must still clean up.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(shuffle.querySelector('.lcars-ripple')).toBeNull();
  });

  it('uses the nominal transmit color (not alert red) while playing (U5)', () => {
    const { rerender } = render(<PlayerControls engine={makeEngine({ isPlaying: false })} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByText('STANDBY')).toBeInTheDocument();

    rerender(<PlayerControls engine={makeEngine({ isPlaying: true })} onPrev={vi.fn()} onNext={vi.fn()} />);
    const transmitting = screen.getByText('TRANSMITTING');
    expect(transmitting).toHaveStyle({ color: LCARS.transmit });
    expect(transmitting).not.toHaveStyle({ color: LCARS.alertRed });
  });
});
