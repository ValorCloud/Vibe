import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLibraryContext } from '../../contexts/LibraryContext';
import { SCAN_PROTOCOLS, type ScanConfig, type ScanProtocol, type TrackEntry } from './types';
import {
  CLOUD_PROVIDER_OPTIONS,
  cloudTrackTitle,
  detectCloudProvider,
  isCloudVideoUrl,
  normalizeCloudUrl,
  type CloudProviderId,
} from '../../utils/cloudProviders';

const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi|m4v)$/i;
const PROTOCOL_ACCEPT: Record<ScanProtocol, string[]> = {
  wav: ['.wav', 'audio/wav', 'audio/x-wav'],
  mp3: ['.mp3', 'audio/mpeg', 'audio/mp3'],
  m4a: ['.m4a', 'audio/mp4', 'audio/x-m4a'],
  flac: ['.flac', 'audio/flac', 'audio/x-flac'],
  ogg: ['.ogg', 'audio/ogg', 'video/ogg', 'application/ogg'],
  opus: ['.opus', 'audio/opus'],
  aac: ['.aac', 'audio/aac'],
  aiff: ['.aif', '.aiff', 'audio/aiff', 'audio/x-aiff'],
  wma: ['.wma', 'audio/x-ms-wma'],
  mp4: ['.mp4', 'video/mp4', 'audio/mp4'],
  webm: ['.webm', 'video/webm', 'audio/webm'],
  mov: ['.mov', 'video/quicktime'],
  mkv: ['.mkv', 'video/x-matroska'],
  avi: ['.avi', 'video/x-msvideo'],
  m4v: ['.m4v', 'video/x-m4v'],
};

function buildAccept(protocol: ScanConfig['accept']): string {
  return Array.from(new Set(protocol.flatMap(p => PROTOCOL_ACCEPT[p]))).join(',');
}

function filterFiles(files: File[], protocol: ScanConfig['accept'], pattern: string): File[] {
  return files.filter(f => {
    const lowerName = f.name.toLowerCase();
    const lowerType = f.type.toLowerCase();
    const matchesProtocol = protocol.some(p => PROTOCOL_ACCEPT[p].some(token => (
      token.startsWith('.') ? lowerName.endsWith(token) : lowerType === token
    )));
    if (!matchesProtocol) return false;
    const p = pattern.trim().toLowerCase();
    if (p && !lowerName.includes(p)) return false;
    return true;
  });
}

function formatModified(lastModified: number): string {
  return Number.isFinite(lastModified) && lastModified > 0
    ? new Date(lastModified).toLocaleDateString()
    : 'unknown date';
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
  cloudProvider: CloudProviderId;
  setCloudProvider: (provider: CloudProviderId) => void;
  cloudUrl: string;
  setCloudUrl: (url: string) => void;
  cloudError: string | null;
  handleCloudTrackLink: () => void;
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
  const [scanProtocol, setScanProtocol] = useState<ScanConfig['accept']>(['wav']);
  const [scanPattern, setScanPattern] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [cloudProvider, setCloudProvider] = useState<CloudProviderId>('onedrive');
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudError, setCloudError] = useState<string | null>(null);

  const handleUplinkFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = filterFiles(
      Array.from(e.target.files ?? []),
      scanProtocol,
      scanPattern,
    );
    const added: Omit<TrackEntry, 'id'>[] = files.map(f => ({
      title: f.name.replace(/\.[^/.]+$/, ''),
      source: 'local',
      url: URL.createObjectURL(f),
      memo: `[UPLINK] ${f.name} | Modified: ${formatModified(f.lastModified)} | Integrity: Nominal`,
      linked: true,
      isVideo: VIDEO_EXT.test(f.name),
      oneDriveSize: f.size,
      oneDriveLastModified: new Date(f.lastModified || Date.now()).toISOString(),
    }));
    if (added.length) {
      library.addTracks(added);
      onLocalTracksAdded?.();
    }
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  }, [library, scanProtocol, scanPattern, onLocalTracksAdded]);

  const handleScanFolder = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = filterFiles(
      Array.from(e.target.files ?? []),
      scanProtocol,
      scanPattern,
    );
    const added: Omit<TrackEntry, 'id'>[] = files.map(f => ({
      title: immediateParentName(f),
      source: 'local',
      url: URL.createObjectURL(f),
      memo: `[LCARS_SCAN] Identified: ${f.name} | Modified: ${formatModified(f.lastModified)} | Integrity: Nominal`,
      linked: true,
      isVideo: VIDEO_EXT.test(f.name),
      oneDriveSize: f.size,
      oneDriveLastModified: new Date(f.lastModified || Date.now()).toISOString(),
    }));
    if (added.length) {
      library.addTracks(added);
      onLocalTracksAdded?.();
    }
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, [library, scanProtocol, scanPattern, onLocalTracksAdded]);

  const handleCloudTrackLink = useCallback(() => {
    const requestedUrl = cloudUrl.trim();
    if (!requestedUrl) {
      setCloudError('Please enter a cloud file URL.');
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(requestedUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        setCloudError('Cloud URL must start with http:// or https://');
        return;
      }
    } catch {
      setCloudError('Cloud URL is invalid.');
      return;
    }
    const normalizedProvider = cloudProvider === 'direct-url'
      ? detectCloudProvider(requestedUrl)
      : cloudProvider;
    const normalizedUrl = normalizeCloudUrl(requestedUrl, normalizedProvider);
    const title = cloudTrackTitle(normalizedUrl);
    library.addTracks([{
      title,
      source: 'cloud',
      url: normalizedUrl,
      memo: `[CLOUD] ${normalizedProvider.toUpperCase()} | Linked: ${parsed.hostname}`,
      linked: true,
      isVideo: isCloudVideoUrl(normalizedUrl),
      cloudProvider: normalizedProvider,
      oneDriveLastModified: new Date().toISOString(),
    }]);
    setCloudError(null);
    setCloudUrl('');
  }, [cloudProvider, cloudUrl, library]);

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
    cloudProvider,
    setCloudProvider,
    cloudUrl,
    setCloudUrl,
    cloudError,
    handleCloudTrackLink,
  }), [
    scanProtocol,
    scanPattern,
    handleUplinkFiles,
    handleScanFolder,
    cloudProvider,
    cloudUrl,
    cloudError,
    handleCloudTrackLink,
  ]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarContext(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebarContext must be used inside <SidebarProvider>');
  return ctx;
}

export { buildAccept, filterFiles, SCAN_PROTOCOLS };
export { CLOUD_PROVIDER_OPTIONS };
