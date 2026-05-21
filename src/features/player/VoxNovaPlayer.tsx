import { useState } from 'react';
import {
  TabList, Tab, tokens,
} from '@fluentui/react-components';
import {
  Cloud24Regular,
  FolderOpen24Regular,
  ArrowUpload24Regular,
} from '@fluentui/react-icons';
import { WarpField } from './WarpField';
import { FrequencyVisualizer } from './FrequencyVisualizer';
import { PlayerControls } from './PlayerControls';
import { TrackList } from './TrackList';
import { UploadPanel } from './UploadPanel';
import { useAudioEngine } from './useAudioEngine';
import { useFrequencyAnalyser } from './useFrequencyAnalyser';
import { useLibrary } from './useLibrary';
import type { TrackEntry } from './types';

type LibraryTab = 'cloud' | 'local' | 'upload';

export function VoxNovaPlayer() {
  const engine = useAudioEngine();
  const analyser = useFrequencyAnalyser();
  const library = useLibrary();
  const [activeTab, setActiveTab] = useState<LibraryTab>('cloud');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedTrack = library.tracks.find(t => t.id === selectedId);

  const handleSelect = (track: TrackEntry) => {
    setSelectedId(track.id);
    engine.loadTrack(track);
    engine.beep(880, 'sine', 0.05);
  };

  const handlePrev = () => {
    const idx = library.tracks.findIndex(t => t.id === selectedId);
    const prev = library.tracks[idx - 1];
    if (prev) handleSelect(prev);
  };

  const handleNext = () => {
    const idx = library.tracks.findIndex(t => t.id === selectedId);
    const next = library.tracks[idx + 1];
    if (next) handleSelect(next);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#000008',
        fontFamily: 'monospace',
      }}
    >
      <WarpField isPlaying={engine.isPlaying} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: tokens.spacingVerticalM }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalS, borderBottom: '1px solid rgba(153,204,255,0.15)', paddingBottom: tokens.spacingVerticalS }}>
          <span style={{ color: '#99ccff', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7 }}>COMMS_ENCRYPTION: ENABLED</span>
          <span style={{ marginLeft: 'auto', color: '#99ccff', fontSize: 10, opacity: 0.4 }}>VOX NOVA v2.0</span>
        </div>

        <div style={{ position: 'relative' }}>
          <FrequencyVisualizer
            isPlaying={engine.isPlaying}
            analyser={analyser}
            audioRef={engine.audioRef}
          />
        </div>

        <PlayerControls
          engine={engine}
          onPrev={handlePrev}
          onNext={handleNext}
          trackTitle={selectedTrack?.title ?? ''}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}` }}>
          <TabList
            selectedValue={activeTab}
            onTabSelect={(_, d) => setActiveTab(d.value as LibraryTab)}
            size="small"
          >
            <Tab value="cloud" icon={<Cloud24Regular />}>Neural Cloud</Tab>
            <Tab value="local" icon={<FolderOpen24Regular />}>Local Sector</Tab>
            <Tab value="upload" icon={<ArrowUpload24Regular />}>Uplink</Tab>
          </TabList>

          <div style={{ flex: 1, overflow: 'auto', marginTop: tokens.spacingVerticalS }}>
            {activeTab === 'cloud' && (
              <TrackList
                tracks={library.tracks.filter(t => t.source === 'cloud')}
                selectedId={selectedId ?? undefined}
                onSelect={handleSelect}
                onRemove={library.removeTrack}
                onUpdateUrl={library.updateUrl}
              />
            )}
            {activeTab === 'local' && (
              <TrackList
                tracks={library.tracks.filter(t => t.source === 'local')}
                selectedId={selectedId ?? undefined}
                onSelect={handleSelect}
                onRemove={library.removeTrack}
                onUpdateUrl={library.updateUrl}
              />
            )}
            {activeTab === 'upload' && (
              <UploadPanel onTracksAdded={library.addTracks} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
