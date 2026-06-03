import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLibraryContext } from '../../contexts/LibraryContext';
import { SCAN_PROTOCOLS, type ScanConfig, type ScanProtocol, type TrackEntry } from './types';
import {
  CLOUD_PROVIDER_OPTIONS,
  cloudTrackTitle,
  detectCloudProvider,
  formatCloudProviderLabel,
  isCloudVideoUrl,
  normalizeCloudUrl,
  type CloudProviderId,
} from '../../utils/cloudProviders';
import { pickFromCloud, type CloudFile, type AudioFileEntry, type CloudProviderId as ServiceCloudProviderId } from '../../services/cloudStorage';
import { VIBE_EVENTS } from '../../constants/vibeEvents';

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

/**
 * Map the cloud-service provider identifiers (`services/cloudStorage`) to the
 * player-side identifiers (`utils/cloudProviders`). They differ for Google Drive
 * (`gdrive` vs `google-drive`); other ids match 1:1.
 */
function mapServiceProviderToPlayer(id: ServiceCloudProviderId | undefined): CloudProviderId {
  if (id === 'gdrive') return 'google-drive';
  if (id === 'onedrive' || id === 'onedrive-business' || id === 'dropbox' || id === 'box') return id;
  return 'onedrive';
}

function immediateParentName(f: File): string {
  const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
  const segments = relPath.split('/');
  if (segments.length >= 3) return segments[segments.length - 2] ?? f.name.replace(/\.[^/.]+$/, '');
  if (segments.length === 2 && segments[1]) return segments[0] ?? f.name.replace(/\.[^/.]+$/, '');
  return f.name.replace(/\.[^/.]+$/, '');
}

export type OneDriveScanStatus = 'idle' | 'scanning' | 'error';

export interface SidebarContextValue {
  scanProtocol: ScanConfig['accept'];
  setScanProtocol: (p: ScanConfig['accept']) => void;
  scanPattern: string;
  setScanPattern: (p: string) => void;
  uploadInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  buildAccept: (p: ScanConfig['accept']) => string;
  handleUplinkFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleScanFolder: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cloudProvider: CloudProviderId;
  setCloudProvider: (provider: CloudProviderId) => void;
  cloudUrl: string;
  setCloudUrl: (url: string) => void;
  cloudError: string | null;
  handleCloudTrackLink: () => void;
  /** Triggers OneDrive picker in folder-scan mode, crawls Graph, adds tracks as source:'cloud'. */
  handleOneDriveScanFolder: () => void;
  oneDriveScanStatus: OneDriveScanStatus;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

interface SidebarProviderProps {
  /** Called after local tracks are added so the player can switch to the LOCAL view. */
  onLocalTracksAdded?: () => void;
  /** Called after cloud tracks are added so the player can switch to the CLOUD view. */
  onCloudTracksAdded?: () => void;
  children: ReactNode;
}

/**
 * SidebarProvider owns the file-scan / upload state that the LCARS sidebar
 * needs. Previously these nine concerns (refs, state, handlers, buildAccept)
 * were prop-drilled into PlayerSidebar from VoxNovaPlayer; lifting them into
 * a context dramatically thins the PlayerSidebar prop surface.
 */
export function SidebarProvider({ onLocalTracksAdded, onCloudTracksAdded, children }: SidebarProviderProps) {
  const library = useLibraryContext();
  const [scanProtocol, setScanProtocol] = useState<ScanConfig['accept']>(['wav', 'aac', 'mp4']);
  const [scanPattern, setScanPattern] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [cloudProvider, setCloudProvider] = useState<CloudProviderId>('onedrive');
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [oneDriveScanStatus, setOneDriveScanStatus] = useState<OneDriveScanStatus>('idle');

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
      memo: `[CLOUD] ${formatCloudProviderLabel(normalizedProvider)} | Linked: ${parsed.hostname}`,
      linked: true,
      isVideo: isCloudVideoUrl(normalizedUrl),
      cloudProvider: normalizedProvider,
      oneDriveLastModified: new Date().toISOString(),
    }]);
    setCloudError(null);
    setCloudUrl('');
  }, [cloudProvider, cloudUrl, library]);

  const handleOneDriveScanFolder = useCallback(() => {
    if (oneDriveScanStatus === 'scanning') return;
    setOneDriveScanStatus('scanning');
    const ac = new AbortController();
    pickFromCloud('onedrive', 'player', ac.signal)
      .then((result: CloudFile | null) => {
        if (!result?.fileList?.length) {
          setOneDriveScanStatus('idle');
          return;
        }
        const added: Omit<TrackEntry, 'id'>[] = result.fileList.map((entry: AudioFileEntry) => ({
          title: entry.name.replace(/\.[^/.]+$/, ''),
          source: 'cloud' as const,
          url: entry.downloadUrl,
          memo: `[OD_SCAN] ${entry.name} | Size: ${Math.round(entry.size / 1024)} KB | Type: ${entry.mimeType}`,
          linked: true,
          isVideo: VIDEO_EXT.test(entry.name),
          cloudProvider: 'onedrive' as CloudProviderId,
          oneDriveItemId: entry.id,
          oneDriveSize: entry.size,
          oneDriveLastModified: new Date().toISOString(),
        }));
        library.addTracks(added);
        onCloudTracksAdded?.();
        setOneDriveScanStatus('idle');
      })
      .catch(() => {
        setOneDriveScanStatus('error');
        setTimeout(() => setOneDriveScanStatus('idle'), 3000);
      });
  }, [oneDriveScanStatus, library, onCloudTracksAdded]);

  // Consume PLAYER_FOLDER_LOADED events dispatched by AppModalLayer when the
  // ribbon "Open Audio Folder from Cloud" / "Add Audio Files from Cloud" picker
  // resolves. Without this listener the new ribbon entries would silently
  // succeed but never add tracks (regression introduced when the cloud picker
  // was split into lyrics / player / player-files modes — see commits
  // 9b0189c → 814d130).
  useEffect(() => {
    const handler = (e: Event) => {
      const file = (e as CustomEvent<CloudFile | undefined>).detail;
      if (!file?.fileList?.length) return;
      const provider = mapServiceProviderToPlayer(file.provider);
      const providerLabel = formatCloudProviderLabel(provider);
      const added: Omit<TrackEntry, 'id'>[] = file.fileList.map((entry: AudioFileEntry) => {
        const base: Omit<TrackEntry, 'id'> = {
          title:         entry.name.replace(/\.[^/.]+$/, ''),
          source:        'cloud',
          url:           entry.downloadUrl,
          memo:          `[CLOUD_PICK] ${providerLabel} | ${entry.name} | Size: ${Math.round(entry.size / 1024)} KB | Type: ${entry.mimeType}`,
          linked:        true,
          isVideo:       VIDEO_EXT.test(entry.name),
          cloudProvider: provider,
        };
        if (provider === 'onedrive' || provider === 'onedrive-business') {
          base.oneDriveItemId = entry.id;
        }
        base.oneDriveSize = entry.size;
        return base;
      });
      if (added.length) {
        library.addTracks(added);
        onCloudTracksAdded?.();
      }
    };
    window.addEventListener(VIBE_EVENTS.PLAYER_FOLDER_LOADED, handler as EventListener);
    return () => window.removeEventListener(VIBE_EVENTS.PLAYER_FOLDER_LOADED, handler as EventListener);
  }, [library, onCloudTracksAdded]);

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
    handleOneDriveScanFolder,
    oneDriveScanStatus,
  }), [
    scanProtocol,
    scanPattern,
    handleUplinkFiles,
    handleScanFolder,
    cloudProvider,
    cloudUrl,
    cloudError,
    handleCloudTrackLink,
    handleOneDriveScanFolder,
    oneDriveScanStatus,
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
