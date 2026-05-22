import type { RefObject } from 'react';
import { LCARS } from './lcarsTheme';
import { GlobeIcon, DatabaseIcon, SparkleIcon, UploadIcon } from './PlayerWidgets';
import type { TrackEntry, ScanConfig } from './types';

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
}

export function SidebarButton({ label, color, textColor, onClick, icon, active }: SidebarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
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
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 16 }}>{icon ?? null}</span>
      <span>{label}</span>
    </button>
  );
}

type LibraryView = 'cloud' | 'local' | 'lyria';

const PROTOCOLS: Array<{ label: string; value: ScanConfig['accept'] }> = [
  { label: 'WAV', value: 'wav' },
  { label: 'MP3', value: 'mp3' },
  { label: 'ALL', value: 'all' },
];

export interface PlayerSidebarProps {
  view: LibraryView;
  setView: (v: LibraryView) => void;
  tracks: TrackEntry[];
  selectedId: string | null;
  onSelect: (track: TrackEntry) => void;
  onPurge: () => void;
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

export function PlayerSidebar({
  view, setView, tracks, selectedId, onSelect, onPurge,
  scanProtocol, setScanProtocol, scanPattern, setScanPattern,
  uploadInputRef, folderInputRef, buildAccept, handleUplinkFiles, handleScanFolder,
}: PlayerSidebarProps) {
  const visibleTracks = tracks.filter(t => t.source === view);

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
        overflow: 'hidden',
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
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 4,
          minHeight: 110,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          textAlign: 'right',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, lineHeight: 1 }}>VOX</div>
        <div style={{ fontSize: 10, letterSpacing: 2, marginTop: 4, opacity: 0.85 }}>NV-42 CORE</div>
      </div>

      <SidebarButton label="CLOUD" color={LCARS.purple} textColor="#0a0a10" active={view === 'cloud'} onClick={() => setView('cloud')} icon={<GlobeIcon />} />
      <SidebarButton label="LOCAL" color={LCARS.orange} textColor="#0a0a10" active={view === 'local'} onClick={() => setView('local')} icon={<DatabaseIcon />} />
      <SidebarButton label="LYRIA" color="#00c8a0" textColor="#000" active={view === 'lyria'} onClick={() => setView('lyria')} icon={<SparkleIcon />} />
      <SidebarButton label="PURGE" color={LCARS.red} textColor="#0a0a10" onClick={onPurge} />

      {/* Track list */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', marginTop: 12, paddingRight: 2 }}>
        {visibleTracks.length === 0 ? (
          <div style={{ color: LCARS.mutedText, fontSize: 10, letterSpacing: 1, padding: '8px 4px' }}>
            NO {view.toUpperCase()} SIGNALS
          </div>
        ) : visibleTracks.map(track => (
          <button
            key={track.id}
            type="button"
            onClick={() => onSelect(track)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 8px',
              marginBottom: 2,
              background: track.id === selectedId ? `${LCARS.peach}33` : 'transparent',
              border: 'none',
              borderLeft: `3px solid ${track.id === selectedId ? LCARS.peach : 'transparent'}`,
              color: track.id === selectedId ? LCARS.peach : LCARS.text,
              fontSize: 11,
              letterSpacing: 1,
              cursor: 'pointer',
              fontFamily: 'inherit',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={track.title}
          >
            {track.title}
          </button>
        ))}
      </div>

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
          background: `repeating-linear-gradient(
            135deg,
            ${LCARS.peach}22 0px,
            ${LCARS.peach}22 2px,
            transparent 2px,
            transparent 8px
          ), linear-gradient(180deg, ${LCARS.peach}44 0%, ${LCARS.peach}1a 100%)`,
          color: LCARS.peach,
          border: `2px solid ${LCARS.peach}`,
          borderRadius: 4,
          fontSize: 11,
          letterSpacing: 2,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        aria-label="Uplink audio files"
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 16 }}>
          <UploadIcon />
        </span>
        <span>UPLINK</span>
      </button>

      {/* SCAN SECTOR — filter block */}
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
          <div style={{ display: 'flex', gap: 4 }}>
            {PROTOCOLS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setScanProtocol(p.value)}
                style={{
                  flex: 1,
                  padding: '5px 4px',
                  background: scanProtocol === p.value ? LCARS.orange : 'transparent',
                  color: scanProtocol === p.value ? '#000' : LCARS.orange,
                  border: `1px solid ${LCARS.orange}`,
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 120ms, color 120ms',
                }}
                aria-pressed={scanProtocol === p.value}
              >
                {p.label}
              </button>
            ))}
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

      {/* SCAN SECTOR button — outside filter block */}
      <div
        style={{
          background: LCARS.orange,
          color: '#000',
          padding: '14px 8px 24px 14px',
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          borderBottomLeftRadius: 64,
          borderBottomRightRadius: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingLeft: 40,
          paddingRight: 14,
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
