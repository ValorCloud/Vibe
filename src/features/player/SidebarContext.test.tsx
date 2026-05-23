import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SidebarProvider, useSidebarContext } from './SidebarContext';
import { LibraryProvider } from '../../contexts/LibraryContext';

function wrap(onLocalTracksAdded?: () => void) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LibraryProvider>
        <SidebarProvider onLocalTracksAdded={onLocalTracksAdded}>{children}</SidebarProvider>
      </LibraryProvider>
    );
  };
}

describe('SidebarContext', () => {
  it('throws when used outside its provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSidebarContext())).toThrow(/SidebarProvider/);
    spy.mockRestore();
  });

  it('exposes default scan protocol and pattern', () => {
    const { result } = renderHook(() => useSidebarContext(), { wrapper: wrap() });
    expect(result.current.scanProtocol).toBe('wav');
    expect(result.current.scanPattern).toBe('');
    expect(typeof result.current.buildAccept).toBe('function');
  });

  it('updates scan protocol and pattern', () => {
    const { result } = renderHook(() => useSidebarContext(), { wrapper: wrap() });
    act(() => {
      result.current.setScanProtocol('mp3');
      result.current.setScanPattern('demo');
    });
    expect(result.current.scanProtocol).toBe('mp3');
    expect(result.current.scanPattern).toBe('demo');
  });

  it('buildAccept produces the right accept string for each protocol', () => {
    const { result } = renderHook(() => useSidebarContext(), { wrapper: wrap() });
    expect(result.current.buildAccept('wav')).toContain('.wav');
    expect(result.current.buildAccept('mp3')).toContain('.mp3');
    expect(result.current.buildAccept('m4a')).toContain('.m4a');
    expect(result.current.buildAccept('mp4')).toContain('.mp4');
    expect(result.current.buildAccept('all')).toContain('audio/*');
  });

  it('notifies onLocalTracksAdded when uplink adds tracks', () => {
    const onLocalTracksAdded = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:test');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL;
    try {
      const { result } = renderHook(() => useSidebarContext(), { wrapper: wrap(onLocalTracksAdded) });
      const file = new File(['x'], 'song.wav', { type: 'audio/wav' });
      const event = {
        target: { files: [file] as unknown as FileList, value: '' },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => result.current.handleUplinkFiles(event));
      expect(onLocalTracksAdded).toHaveBeenCalledTimes(1);
    } finally {
      URL.createObjectURL = originalCreate;
    }
  });

  it('does not notify when uplink adds nothing', () => {
    const onLocalTracksAdded = vi.fn();
    const { result } = renderHook(() => useSidebarContext(), { wrapper: wrap(onLocalTracksAdded) });
    const event = {
      target: { files: [] as unknown as FileList, value: '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    act(() => result.current.handleUplinkFiles(event));
    expect(onLocalTracksAdded).not.toHaveBeenCalled();
  });
});
