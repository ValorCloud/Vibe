import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SidebarProvider, useSidebarContext } from './SidebarContext';
import { LibraryProvider, useLibraryContext } from '../../contexts/LibraryContext';

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
    expect(result.current.scanProtocol).toEqual(['wav']);
    expect(result.current.scanPattern).toBe('');
    expect(result.current.cloudProvider).toBe('onedrive');
    expect(result.current.cloudUrl).toBe('');
    expect(result.current.cloudError).toBeNull();
    expect(typeof result.current.buildAccept).toBe('function');
  });

  it('updates scan protocol and pattern', () => {
    const { result } = renderHook(() => useSidebarContext(), { wrapper: wrap() });
    act(() => {
      result.current.setScanProtocol(['mp3', 'flac', 'webm']);
      result.current.setScanPattern('demo');
    });
    expect(result.current.scanProtocol).toEqual(['mp3', 'flac', 'webm']);
    expect(result.current.scanPattern).toBe('demo');
  });

  it('buildAccept produces the right accept string for each protocol', () => {
    const { result } = renderHook(() => useSidebarContext(), { wrapper: wrap() });
    expect(result.current.buildAccept(['wav'])).toContain('.wav');
    expect(result.current.buildAccept(['mp3'])).toContain('.mp3');
    expect(result.current.buildAccept(['m4a'])).toContain('.m4a');
    expect(result.current.buildAccept(['mp4'])).toContain('.mp4');
    expect(result.current.buildAccept(['flac', 'webm', 'mkv'])).toContain('.flac');
    expect(result.current.buildAccept(['flac', 'webm', 'mkv'])).toContain('video/webm');
    expect(result.current.buildAccept(['flac', 'webm', 'mkv'])).toContain('.mkv');
  });

  it('uses multiple selected protocols when uplink filters files', () => {
    const onLocalTracksAdded = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:test');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL;
    try {
      const { result } = renderHook(() => useSidebarContext(), { wrapper: wrap(onLocalTracksAdded) });
      act(() => result.current.setScanProtocol(['flac', 'webm']));
      const files = [
        new File(['x'], 'song.flac', { type: 'audio/flac' }),
        new File(['x'], 'clip.webm', { type: 'video/webm' }),
        new File(['x'], 'skip.mp3', { type: 'audio/mpeg' }),
      ];
      const event = {
        target: { files: files as unknown as FileList, value: '' },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => result.current.handleUplinkFiles(event));
      expect(createObjectURL).toHaveBeenCalledTimes(2);
      expect(onLocalTracksAdded).toHaveBeenCalledTimes(1);
    } finally {
      URL.createObjectURL = originalCreate;
    }
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

  it('adds a cloud track from a provider URL and clears the input', () => {
    const { result } = renderHook(() => {
      const sidebar = useSidebarContext();
      const library = useLibraryContext();
      return { sidebar, library };
    }, { wrapper: wrap() });
    act(() => {
      result.current.sidebar.setCloudProvider('dropbox');
      result.current.sidebar.setCloudUrl('https://www.dropbox.com/s/abcd1234/song.mp3?dl=0');
    });
    act(() => {
      result.current.sidebar.handleCloudTrackLink();
    });
    expect(result.current.sidebar.cloudError).toBeNull();
    expect(result.current.sidebar.cloudUrl).toBe('');
    expect(result.current.library.tracks).toHaveLength(1);
    expect(result.current.library.tracks[0]).toMatchObject({
      source: 'cloud',
      cloudProvider: 'dropbox',
      linked: true,
      isVideo: false,
    });
    expect(result.current.library.tracks[0]?.url).toContain('dl=1');
  });

  it('surfaces a validation error for invalid cloud URL input', () => {
    const { result } = renderHook(() => useSidebarContext(), { wrapper: wrap() });
    act(() => {
      result.current.setCloudUrl('not a url');
    });
    act(() => {
      result.current.handleCloudTrackLink();
    });
    expect(result.current.cloudError).toMatch(/invalid/i);
  });
});
