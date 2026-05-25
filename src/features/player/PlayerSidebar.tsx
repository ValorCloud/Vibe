import { LCARS } from './lcarsTheme';
import { GlobeIcon, DatabaseIcon, SparkleIcon, TrashIcon, UploadIcon } from './PlayerWidgets';
import { CLOUD_PROVIDER_OPTIONS, SCAN_PROTOCOLS, useSidebarContext } from './SidebarContext';
import type { TrackEntry, ScanProtocol } from './types';

const LCARS_BOX_COLORS = [
  'rgba(255,153,0,0.08)',
];

interface SidebarButtonProps {
  label: string;
  color: string;
  textColor: string;
  onClick: () => void;
  icon?: React.ReactNode;
  active?: boolean;
  title?: string;
}

export function SidebarButton({ label, color, textColor, onClick, icon, active, title }: SidebarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '10px 14px',
        background: color,
        color: textColor,
        border: 'none',
        borderRadius: 4,
        fontSize: 11,
        letterSpacing: 2,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        outline: active ? `2px solid ${color}` : 'none',
        outlineOffset: active ? 2 : 0,
      }}
      aria-pressed={active}
      aria-label={title ?? label}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 16 }}>{icon ?? null}</span>
      <span>{label}</span>
    </button>
  );
}

type LibraryView = 'cloud' | 'local' | 'lyria';

const PROTOCOLS: Array<{ label: string; value: ScanProtocol; group: 'AUDIO' | 'VIDEO' }> = [
  { label: 'WAV', value: 'wav', group: 'AUDIO' },
  { label: 'MP3', value: 'mp3', group: 'AUDIO' },
  { label: 'M4A', value: 'm4a', group: 'AUDIO' },
  { label: 'FLAC', value: 'flac', group: 'AUDIO' },
  { label: 'OGG', value: 'ogg', group: 'AUDIO' },
  { label: 'OPUS', value: 'opus', group: 'AUDIO' },
  { label: 'AAC', value: 'aac', group: 'AUDIO' },
  { label: 'AIFF', value: 'aiff', group: 'AUDIO' },
  { label: 'WMA', value: 'wma', group: 'AUDIO' },
  { label: 'MP4', value: 'mp4', group: 'VIDEO' },
  { label: 'WEBM', value: 'webm', group: 'VIDEO' },
  { label: 'MOV', value: 'mov', group: 'VIDEO' },
  { label: 'MKV', value: 'mkv', group: 'VIDEO' },
  { label: 'AVI', value: 'avi', group: 'VIDEO' },
  { label: 'M4V', value: 'm4v', group: 'VIDEO' },
];

export interface PlayerSidebarProps {
  view: LibraryView;
  setView: (v: LibraryView) => void;
  tracks: TrackEntry[];
  selectedId: string | null;
  onSelect: (track: TrackEntry) => void;
  onPurge: () => void;
}

export function PlayerSidebar({
  view, setView, tracks, selectedId, onSelect, onPurge,
}: PlayerSidebarProps) {
  const {
    scanProtocol, setScanProtocol, scanPattern, setScanPattern,
    uploadInputRef, folderInputRef, buildAccept, handleUplinkFiles, handleScanFolder,
    cloudProvider, setCloudProvider, cloudUrl, setCloudUrl, cloudError, handleCloudTrackLink,
  } = useSidebarContext();
  const visibleTracks = tracks.filter(t => t.source === view);
  const allProtocolsSelected = scanProtocol.length === SCAN_PROTOCOLS.length;
  const toggleProtocol = (value: ScanProtocol | 'all') => {
    if (value === 'all') {
      setScanProtocol(allProtocolsSelected ? ['wav'] : [...SCAN_PROTOCOLS]);
      return;
    }
    setScanProtocol(scanProtocol.includes(value)
      ? (scanProtocol.length > 1 ? scanProtocol.filter(p => p !== value) : scanProtocol)
      : [...scanProtocol, value]);
  };

  return (
    <aside
      style={{
        position: 'relative',
        zIndex: 1,
        width: 200,
        flexShrink: 0,
        padding: '12px 12px 12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* VOX / NV-42 CORE block */}
      <div
        style={{
          background: LCARS.peach,
          color: '#000',
          padding: '28px 14px 16px 14px',
          borderTopLeftRadius: 64,
          borderTopRightRadius: 4,
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          minHeight: 110,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          textAlign: 'right',
          position: 'relative',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, lineHeight: 1 }}>VOX</div>
        <div style={{ fontSize: 10, letterSpacing: 2, marginTop: 4, opacity: 0.85 }}>NV-42 CORE</div>
      </div>

      {/* CLOUD first, LYRIA directly below, then LOCAL, PURGE */}
      <SidebarButton label="CLOUD" title="Show cloud library signals" color={LCARS.purple} textColor="#0a0a10" active={view === 'cloud'} onClick={() => setView('cloud')} icon={<GlobeIcon />} />
      <SidebarButton label="LYRIA" title="Show Lyria generated signals" color="#00c8a0" textColor="#000" active={view === 'lyria'} onClick={() => setView('lyria')} icon={<SparkleIcon />} />
      <SidebarButton label="LOCAL" title="Show local memo log signals" color={LCARS.orange} textColor="#0a0a10" active={view === 'local'} onClick={() => setView('local')} icon={<DatabaseIcon />} />
      <SidebarButton label="PURGE" title="Purge loaded player library" color={LCARS.red} textColor="#0a0a10" onClick={onPurge} icon={<TrashIcon />} />

      {/* Track list */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', marginTop: 12, paddingRight: 2 }}>
        {visibleTracks.length === 0 ? (
          <div style={{ color: LCARS.mutedText, fontSize: 10, letterSpacing: 1, padding: '8px 4px' }}>
            NO {view.toUpperCase()} SIGNALS
          </div>
        ) : visibleTracks.map(track => {
          const mediaColor = track.isVideo ? LCARS.purple : LCARS.orange;
          const selected = track.id === selectedId;
          return (
          <button
            key={track.id}
            type="button"
            onClick={() => onSelect(track)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              textAlign: 'left',
              padding: '6px 8px',
              marginBottom: 2,
              background: selected ? `${mediaColor}24` : 'transparent',
              border: 'none',
              borderLeft: `3px solid ${selected ? mediaColor : `${mediaColor}66`}`,
              color: selected ? mediaColor : LCARS.text,
              fontSize: 11,
              letterSpacing: 1,
              cursor: 'pointer',
              fontFamily: 'inherit',
              overflow: 'hidden',
            }}
            title={track.title}
          >
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</span>
            <span style={{ flexShrink: 0, color: mediaColor, border: `1px solid ${mediaColor}88`, borderRadius: 2, padding: '1px 3px', fontSize: 7, fontWeight: 700, letterSpacing: 1 }}>
              {track.isVideo ? 'VID' : 'AUD'}
            </span>
          </button>
        );})}
      </div>

      {view === 'cloud' && (
        <div
          style={{
            border: `1px solid ${LCARS.purple}55`,
            borderRadius: 4,
            padding: '10px',
            background: 'rgba(156,140,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ color: LCARS.purple, fontSize: 9, letterSpacing: 2.5, fontWeight: 700 }}>CLOUD LINK</div>
          <select
            value={cloudProvider}
            onChange={e => setCloudProvider(e.target.value as typeof cloudProvider)}
            aria-label="Cloud provider"
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.45)',
              border: `1px solid ${LCARS.purple}55`,
              color: LCARS.text,
              borderRadius: 3,
              fontSize: 11,
              padding: '6px 8px',
              fontFamily: 'inherit',
            }}
          >
            {CLOUD_PROVIDER_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={cloudUrl}
            onChange={e => setCloudUrl(e.target.value)}
            placeholder="https://..."
            aria-label="Cloud file URL"
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.5)',
              border: `1px solid ${LCARS.purple}55`,
              borderRadius: 3,
              color: LCARS.text,
              fontFamily: 'monospace',
              fontSize: 11,
              padding: '6px 8px',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={handleCloudTrackLink}
            style={{
              border: `1px solid ${LCARS.purple}`,
              borderRadius: 3,
              background: `${LCARS.purple}22`,
              color: LCARS.purple,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2,
              padding: '6px 8px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            LINK CLOUD
          </button>
          {cloudError && (
            <div role="alert" style={{ color: LCARS.alertRed, fontSize: 10, letterSpacing: 1 }}>
              {cloudError}
            </div>
          )}
        </div>
      )}

      {/* UPLINK button */}
      <button
        type="button"
        onClick={() => uploadInputRef.current?.click()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 14px',
          background: `linear-gradient(
              180deg,
              ${LCARS.peach}55 0%,
              ${LCARS.peach}22 60%,
              ${LCARS.peach}0a 100%
            )`,
          color: LCARS.peach,
          border: `2px solid ${LCARS.peach}cc`,
          borderRadius: 4,
          fontSize: 11,
          letterSpacing: 2,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: `0 0 8px ${LCARS.peach}44, inset 0 1px 0 ${LCARS.peach}33`,
        }}
        aria-label="Uplink audio files"
        title="Uplink local audio or video files"
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 16 }}>
          <UploadIcon />
        </span>
        <span>UPLINK</span>
      </button>

      {/* SCAN SECTOR filter block */}
      <div
        style={{
          border: `1px solid ${LCARS.orange}55`,
          borderRadius: 4,
          padding: '10px 10px 8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: LCARS_BOX_COLORS[0],
        }}
      >
        <div>
          <div style={{ color: LCARS.orange, fontSize: 9, letterSpacing: 3, marginBottom: 6 }}>AUDIO PROTOCOL</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => toggleProtocol('all')}
              style={{
                flex: '1 1 100%',
                padding: '4px',
                background: allProtocolsSelected ? LCARS.orange : 'rgba(0,0,0,0.32)',
                color: allProtocolsSelected ? '#000' : LCARS.orange,
                border: `1px solid ${LCARS.orange}`,
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 120ms, color 120ms',
              }}
              aria-pressed={allProtocolsSelected}
              title="Toggle every supported audio and video protocol"
            >
              ALL CODECS
            </button>
            {PROTOCOLS.map(p => {
              const selected = scanProtocol.includes(p.value);
              return (
              <button
                key={p.value}
                type="button"
                onClick={() => toggleProtocol(p.value)}
                style={{
                  flex: '1 1 39px',
                  padding: '4px 3px',
                  background: selected ? (p.group === 'VIDEO' ? LCARS.purple : LCARS.orange) : 'transparent',
                  color: selected ? '#000' : (p.group === 'VIDEO' ? LCARS.purple : LCARS.orange),
                  border: `1px solid ${p.group === 'VIDEO' ? LCARS.purple : LCARS.orange}`,
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 1,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 120ms, color 120ms',
                }}
                aria-pressed={selected}
                title={`${selected ? 'Remove' : 'Add'} ${p.label} ${p.group.toLowerCase()} protocol`}
              >
                {p.label}
              </button>
            );})}
          </div>
          <div style={{ color: LCARS.subText, fontSize: 8, letterSpacing: 1.2, textAlign: 'right' }}>
            {scanProtocol.length} SELECTED
          </div>
        </div>
        <div>
          <div style={{ color: LCARS.orange, fontSize: 9, letterSpacing: 3, marginBottom: 6 }}>PATTERN MATCH</div>
          <input
            type="text"
            value={scanPattern}
            onChange={e => setScanPattern(e.target.value)}
            placeholder=""
            aria-label="Pattern match filter"
            title="Filter scanned files by filename"
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.5)',
              border: `1px solid ${LCARS.orange}55`,
              borderRadius: 3,
              color: LCARS.text,
              fontFamily: 'monospace',
              fontSize: 12,
              padding: '5px 8px',
              letterSpacing: 1,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* SCAN SECTOR button — outside filter block, text right-aligned */}
      <div
        style={{
          background: LCARS.orange,
          color: '#000',
          padding: '14px 20px 24px 14px',
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          borderBottomLeftRadius: 64,
          borderBottomRightRadius: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
        }}
        role="button"
        tabIndex={0}
        onClick={() => folderInputRef.current?.click()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            folderInputRef.current?.click();
          }
        }}
        aria-label="Scan sector folder"
        title="Scan a folder for selected audio and video protocols"
      >
        <DatabaseIcon />
        <span style={{ fontSize: 11, letterSpacing: 2, fontWeight: 600 }}>SCAN SECTOR</span>
      </div>

      <input ref={uploadInputRef} type="file" multiple accept={buildAccept(scanProtocol)} style={{ display: 'none' }} onChange={handleUplinkFiles} aria-hidden="true" />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept={buildAccept(scanProtocol)}
        // @ts-expect-error — webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        style={{ display: 'none' }}
        onChange={handleScanFolder}
        aria-hidden="true"
      />
    </aside>
  );
}
