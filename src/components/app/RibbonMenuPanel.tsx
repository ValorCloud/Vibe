/**
 * RibbonMenuPanel
 *
 * Renders the burger-menu dropdown for TopRibbon.
 * Owns:
 *   - fixed-position panel with LCARS gradient outline
 *   - outside-click / resize / scroll dismiss logic
 *   - all grouped menu sections (Create / Workspace / Tools / App)
 *
 * Parent (TopRibbon) owns isMenuOpen state and passes:
 *   - anchorRef   : ref to the trigger button (for position calculation)
 *   - onClose     : () => void  — called when panel should dismiss
 *   - All action callbacks
 */
import React, { useEffect, useRef } from 'react';
import {
  Download, Upload, Trash2, History,
  Library, FilePlus, Settings, Info, WandSparkles, ClipboardPaste, Heart,
  KeyboardRegular, Music, AlignLeft,
} from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';
import { useTranslation } from '../../i18n';
import { useSongContext } from '../../contexts/SongContext';
import { useAppNavigationContext } from '../../contexts/AppStateContext';
import { useTopRibbonActions } from '../../hooks/useTopRibbonActions';

const MENU_WIDTH = 280;
const MENU_VIEWPORT_PADDING = 12;
const MENU_VERTICAL_OFFSET = 6;
const MENU_BOTTOM_PADDING = 16;

export const menuActionClass =
  'flex w-full items-center gap-3 bg-transparent px-4 py-1.5 text-[12px] text-left ' +
  'transition-colors outline-none focus-visible:bg-[var(--accent-color)]/10 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent';

interface Props {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpenNewGeneration: () => void;
  onOpenNewEmpty: () => void;
}

export function RibbonMenuPanel({
  anchorRef,
  onClose,
  onOpenNewGeneration,
  onOpenNewEmpty,
}: Props) {
  const { song } = useSongContext();
  const { setActiveTab } = useAppNavigationContext();
  const {
    openVersionsModal, openResetModal, openImport, openExport,
    openLibrary, openSettings, openAbout, openKeyboardShortcuts,
    openPasteModal, canPasteLyrics,
  } = useTopRibbonActions();
  const { t } = useTranslation();

  const panelRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = React.useState({
    left: MENU_VIEWPORT_PADDING,
    top: MENU_VERTICAL_OFFSET,
  });

  useEffect(() => {
    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({
        left: Math.max(
          MENU_VIEWPORT_PADDING,
          Math.min(rect.left, window.innerWidth - MENU_VIEWPORT_PADDING - MENU_WIDTH),
        ),
        top: rect.bottom + MENU_VERTICAL_OFFSET,
      });
    };
    updatePosition();

    const handleOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', handleOutside);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [anchorRef, onClose]);

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={panelRef}
      className="lcars-gradient-outline rounded-[18px_6px_18px_6px] shadow-2xl py-1.5 overflow-x-hidden overflow-y-auto"
      style={{
        position: 'fixed',
        left: `${menuPosition.left}px`,
        top: `${menuPosition.top}px`,
        width: `${MENU_WIDTH}px`,
        maxHeight: `calc(100dvh - ${menuPosition.top}px - var(--mobile-nav-h, 56px) - var(--sab, 0px) - ${MENU_BOTTOM_PADDING}px)`,
        backgroundColor: 'var(--bg-app, #111)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.06)',
        zIndex: 70,
      }}
    >
      {/* ── Create ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.24em] text-[var(--text-secondary)]">{t.menu?.create ?? 'Create'}</div>
      <Tooltip title={t.tooltips.newLyricsGeneration ?? 'Generate new lyrics using AI'}>
        <button onClick={() => run(onOpenNewGeneration)} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <WandSparkles className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.menu?.newLyricsGeneration ?? 'New Lyrics Generation'}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.newSong ?? 'Create a new empty song'}>
        <button onClick={() => run(onOpenNewEmpty)} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <FilePlus className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.menu?.newSong ?? 'New Song'}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.import}>
        <button onClick={() => run(openImport)} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <Upload className="w-4 h-4 text-[var(--accent-color)]" />
          {t.ribbon.load_import ?? 'Load / Import'}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.export}>
        <button onClick={() => run(openExport)} disabled={song.length === 0} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10 disabled:opacity-50`}>
          <Download className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.ribbon.save_export ?? 'Save / Export'}
        </button>
      </Tooltip>
      <Tooltip title={canPasteLyrics ? (t.tooltips.pasteAvailable ?? 'Paste lyrics from clipboard') : (t.tooltips.pasteUnavailable ?? 'No lyrics detected in clipboard')}>
        <button disabled={!canPasteLyrics} onClick={() => run(openPasteModal)} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <ClipboardPaste className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.editor.emptyState.pasteLyrics}
        </button>
      </Tooltip>

      {/* ── Workspace ──────────────────────────────────────────────────── */}
      <div className="h-px bg-[var(--border-color)] mx-3 my-1" />
      <div className="px-4 pt-1 pb-1 text-[10px] uppercase tracking-[0.24em] text-[var(--text-secondary)]">{t.menu?.workspace ?? 'Workspace'}</div>
      <Tooltip title={t.tooltips.lyricsTab ?? 'Open the lyrics editor'}>
        <button onClick={() => run(() => setActiveTab('lyrics'))} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <AlignLeft className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.ribbon?.lyrics ?? 'Lyrics Editor'}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.musicalTab}>
        <button onClick={() => run(() => setActiveTab('musical'))} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <Music className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.ribbon.musical}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.browseLibrary ?? 'Save or browse your song library'}>
        <button onClick={() => run(openLibrary)} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <Library className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.saveToLibrary.title}
        </button>
      </Tooltip>

      {/* ── Tools ──────────────────────────────────────────────────────── */}
      <div className="h-px bg-[var(--border-color)] mx-3 my-1" />
      <div className="px-4 pt-1 pb-1 text-[10px] uppercase tracking-[0.24em] text-[var(--text-secondary)]">{t.menu?.tools ?? 'Tools'}</div>
      <Tooltip title={t.tooltips.versions}>
        <button onClick={() => run(openVersionsModal)} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <History className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.ribbon.versions}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.openSettings ?? 'Open application settings'}>
        <button onClick={() => run(openSettings)} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <Settings className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.statusBar.settings}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.reset}>
        <button onClick={() => run(openResetModal)} disabled={song.length === 0} className={`${menuActionClass} text-red-400 hover:bg-red-500/10 disabled:opacity-50`}>
          <Trash2 className="w-4 h-4" />
          {t.ribbon.reset}
        </button>
      </Tooltip>

      {/* ── App ────────────────────────────────────────────────────────── */}
      <div className="h-px bg-[var(--border-color)] mx-3 my-1" />
      <div className="px-4 pt-1 pb-1 text-[10px] uppercase tracking-[0.24em] text-[var(--text-secondary)]">{t.menu?.app ?? 'App'}</div>
      <Tooltip title={t.tooltips.appInfo}>
        <button onClick={() => run(openAbout)} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <Info className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.menu?.about ?? 'About'}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.keyboardShortcuts}>
        <button onClick={() => run(openKeyboardShortcuts)} className={`${menuActionClass} text-[var(--text-primary)] hover:bg-[var(--accent-color)]/10`}>
          <KeyboardRegular className="w-4 h-4 text-[var(--text-secondary)]" />
          {t.keyboardShortcuts.title}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.sponsor ?? 'Support the developer'}>
        <button
          onClick={() => run(() => window.open('https://github.com/sponsors/EmmanuelKerhoz', '_blank', 'noopener,noreferrer'))}
          className={`${menuActionClass} text-pink-400 hover:bg-pink-500/10`}
        >
          <Heart className="w-4 h-4" />
          {t.menu?.sponsor ?? 'Sponsor'}
        </button>
      </Tooltip>
    </div>
  );
}
