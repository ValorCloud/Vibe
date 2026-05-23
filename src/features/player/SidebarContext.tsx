import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLibraryContext } from '../../contexts/LibraryContext';
import type { ScanConfig, TrackEntry } from './types';

const VIDEO_EXT = /\.(mp4|webm|mov|mkv)$/i;

function buildAccept(protocol: ScanConfig['accept']): string {
  if (protocol === 'wav') return '.wav,audio/wav,audio/x-wav';
  if (protocol === 'mp3') return '.mp3,audio/mpeg';
  if (protocol === 'm4a') return '.m4a,audio/mp4,audio/x-m4a';
  if (protocol === 'mp4') return '.mp4,video/mp4,audio/mp4';
  return '.wav,.mp3,.m4a,.mp4,.webm,.mov,.ogg,.flac,.aac,audio/*,video/*';
}

function filterFiles(files: File[], protocol: ScanConfig['accept'], pattern: string): File[] {
  return files.filter(f => {
    if (protocol === 'wav' && !f.name.toLowerCase().endsWith('.wav')) return false;
    if (protocol === 'mp3' && !f.name.toLowerCase().endsWith('.mp3')) return false;
    if (protocol === 'm4a' && !f.name.toLowerCase().endsWith('.m4a')) return false;
    if (protocol === 'mp4' && !f.name.toLowerCase().endsWith('.mp4')) return false;
    const p = pattern.trim().toLowerCase();
    if (p && !f.name.toLowerCase().includes(p)) return false;
    return true;
  });
}

function immediateParentName(f: File): string {
  const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
  const segments = relPath.split('/');
  if (segments.length >= 3) return segments[segments.length - 2] ?? f.name.replace(/\.[^/.]+$/, '');
  if (segments.length === 2 && segments[1]) return segments[0] ?? f.name.replace(/\.[^/.]+$/, '');
  return f.name.replace(/\.[^/.]+$/, '');
}

export interface SidebarContextValue {
  scanProtocol: ScanConfig['accept'];
  setScanProtocol: (p: ScanConfig['accept']) => void;
  scanPattern: string;
  setScanPattern: (p: string) => void;
  uploadInputRef: RefObject<HTMLInputElement>;
  folderInputRef: RefObject<HTMLInputElement>;
  buildAccept: (p: ScanConfig['accept']) => string;
  handleUplinkFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleScanFolder: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

interface SidebarProviderProps {
  /** Called after local tracks are added so the player can switch to the LOCAL view. */
  onLocalTracksAdded?: () => void;
  children: ReactNode;
}

/**
 * SidebarProvider owns the file-scan / upload state that the LCARS sidebar
 * needs. Previously these nine concerns (refs, state, handlers, buildAccept)
 * were prop-drilled into PlayerSidebar from VoxNovaPlayer; lifting them into
 * a context dramatically thins the PlayerSidebar prop surface.
 */
export function SidebarProvider({ onLocalTracksAdded, children }: SidebarProviderProps) {
  const library = useLibraryContext();
  const [scanProtocol, setScanProtocol] = useState<ScanConfig['accept']>('wav');
  const [scanPattern, setScanPattern] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleUplinkFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = filterFiles(
      Array.from(e.target.files ?? []).filter(f => f.type.startsWith('audio/') || f.type.startsWith('video/')),
      scanProtocol,
      scanPattern,
    );
    const added: Omit<TrackEntry, 'id'>[] = files.map(f => ({
      title: f.name.replace(/\.[^/.]+$/, ''),
      source: 'local',
      url: URL.createObjectURL(f),
      memo: `[UPLINK] ${f.name} | Integrity: Nominal`,
      linked: true,
      isVideo: VIDEO_EXT.test(f.name),
    }));
    if (added.length) {
      library.addTracks(added);
      onLocalTracksAdded?.();
    }
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  }, [library, scanProtocol, scanPattern, onLocalTracksAdded]);

  const handleScanFolder = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = filterFiles(
      Array.from(e.target.files ?? []).filter(f => f.type.startsWith('audio/') || f.type.startsWith('video/')),
      scanProtocol,
      scanPattern,
    );
    const added: Omit<TrackEntry, 'id'>[] = files.map(f => ({
      title: immediateParentName(f),
      source: 'local',
      url: URL.createObjectURL(f),
      memo: `[LCARS_SCAN] Identified: ${f.name} | Protocol: ${scanProtocol.toUpperCase()} | Integrity: Nominal`,
      linked: true,
      isVideo: VIDEO_EXT.test(f.name),
    }));
    if (added.length) {
      library.addTracks(added);
      onLocalTracksAdded?.();
    }
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, [library, scanProtocol, scanPattern, onLocalTracksAdded]);

  const value = useMemo<SidebarContextValue>(() => ({
    scanProtocol,
    setScanProtocol,
    scanPattern,
    setScanPattern,
    uploadInputRef,
    folderInputRef,
    buildAccept,
    handleUplinkFiles,
    handleScanFolder,
  }), [scanProtocol, scanPattern, handleUplinkFiles, handleScanFolder]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarContext(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebarContext must be used inside <SidebarProvider>');
  return ctx;
}
