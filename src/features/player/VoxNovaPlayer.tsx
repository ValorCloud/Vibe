import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FrequencyVisualizer } from './FrequencyVisualizer';
import { PlayerControls } from './PlayerControls';
import { PlayerSidebar } from './PlayerSidebar';
import { SidebarProvider } from './SidebarContext';
import { StatusBar, SeekBar, VolumeControl, BlackHoleBadge, ChipIcon, NetworkIcon } from './PlayerWidgets';
import { useAudioEngine } from './useAudioEngine';
import { useFrequencyAnalyser } from './useFrequencyAnalyser';
import { useLibraryContext } from '../../contexts/LibraryContext';
import { usePlayerNavigation } from './usePlayerNavigation';
import { useSpotifyAuthActions, useSpotifyAuthState } from '../../contexts/SpotifyAuthContext';
import { useSpotifyEngine_ } from '../../contexts/SpotifyEngineContext';
import { LCARS } from './lcarsTheme';
import type { TrackInfo } from './useAudioEngine';
import type { TrackEntry } from './types';
import { SpotifyPlaylistPanel } from './SpotifyPlaylistPanel';
import { SpotifySearchPanel } from './SpotifySearchPanel';
import { useSpotifyAsEngine } from './useSpotifyAsEngine';
import { ErrorBoundary } from '../../components/app/ErrorBoundary';
import { formatCloudProviderLabel } from '../../utils/cloudProviders';

const LIBRARY_CAPACITY = 50;
// Raised from 0.08 → 0.18 for readability over textured background
const LCARS_BOX_COLORS = [
  'rgba(255,153,0,0.18)',
  'rgba(153,102,204,0.18)',
  'rgba(204,153,102,0.18)',
  'rgba(255,102,102,0.18)',
  'rgba(102,204,255,0.18)',
];
const SPOTIFY_GREEN = '#1DB954';
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9;

type AudioSource = 'local' | 'spotify';
type SpotifyBrowserTab = 'playlists' | 'search';

function genRegistry(): string {
  const buf = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
  else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function useSectorTime(): string {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let id: number | null = null;
    const tick = () => setT((performance.now() - start) / 100);
    const startInterval = () => { if (id !== null) return; id = window.setInterval(tick, 100); };
    const stopInterval = () => { if (id === null) return; window.clearInterval(id); id = null; };
    const onVisibility = () => { if (document.hidden) stopInterval(); else startInterval(); };
    if (!document.hidden) startInterval();
    document.addEventListener('visib