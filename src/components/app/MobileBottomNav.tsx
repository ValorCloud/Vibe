import React from 'react';
import { Settings, BookOpen, Music, Menu, Sparkles, RefreshCw, Headphones } from '../ui/icons';
import { useTranslation } from '../../i18n';
import { useComposerContext } from '../../contexts/ComposerContext';
import { useSongContext } from '../../contexts/SongContext';
import type { AppTab } from '../../hooks/useUIState';

interface Props {
  isLeftPanelOpen: boolean;
  isStructureOpen: boolean;
  activeTab: AppTab;
  hasApiKey: boolean;
  setIsLeftPanelOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  setIsStructureOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  setActiveTab: (tab: AppTab) => void;
  /** Callback used when the user explicitly asks to (re)generate the song. */
  onGenerateSong?: () => void;
  /** Opens the Settings dialog (not the generation panel) */
  onOpenSettings?: () => void;
}

export function MobileBottomNav({
  isLeftPanelOpen, isStructureOpen, activeTab, hasApiKey,
  setIsLeftPanelOpen, setIsStructureOpen, setActiveTab,
  onGenerateSong,
  onOpenSettings,
}: Props) {
  const { isGenerating } = useComposerContext();
  const { song } = useSongContext();
  const { t } = useTranslation();

  // ── Contextual CTA: when no real lyric content exists, the centre button
  // opens the composer panel so the author can express intent before
  // generation. Once content exists, the button regenerates directly
  // (with confirmation modal handled upstream by handleGlobalRegenerate).
  const hasLyrics = song.some(
    section => section.lines.some(line => !line.isMeta && line.text.trim().length > 0),
  );
  const composeMode = !hasLyrics;

  const cta = composeMode
    ? {
        label: t.mobileNav.compose ?? 'Compose',
        ariaLabel: t.mobileNav.composeAria ?? t.tooltips.openLeftPanel ?? 'Open lyrics generation panel',
        icon: <Sparkles size={20} />,
        onClick: () => {
          setIsStructureOpen(false);
          setActiveTab('lyrics');
          setIsLeftPanelOpen(true);
        },
        disabled: false,
      }
    : {
        label: t.mobileNav.generateShort ?? 'Gen',
        ariaLabel: t.editor.regenerateLyrics ?? t.editor.emptyState.generateSong,
        icon: <RefreshCw size={20} />,
        onClick: () => {
          setIsLeftPanelOpen(false);
          setIsStructureOpen(false);
          onGenerateSong?.();
        },
        disabled: !hasApiKey,
      };

  return (
    <nav className="mobile-bottom-nav" aria-label={t.mobileNav.navigation}>
      {/* Settings — onOpenSettings called first so React batch preserves the modal open state */}
      <button
        className="mobile-bottom-nav-btn"
        onClick={() => {
          onOpenSettings?.();
          setIsLeftPanelOpen(false);
          setIsStructureOpen(false);
        }}
        aria-label={t.mobileNav.settings}
      >
        <Settings size={20} />
        <span>{t.mobileNav.settings}</span>
      </button>

      {/* Lyrics tab */}
      <button
        className={`mobile-bottom-nav-btn ${activeTab === 'lyrics' && !isLeftPanelOpen && !isStructureOpen ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('lyrics');
          setIsLeftPanelOpen(false);
          setIsStructureOpen(false);
        }}
        aria-label={t.mobileNav.lyrics}
        aria-pressed={activeTab === 'lyrics'}
        aria-current={activeTab === 'lyrics' && !isLeftPanelOpen && !isStructureOpen ? 'page' : undefined}
      >
        <BookOpen size={20} />
        <span>{t.mobileNav.lyrics}</span>
      </button>

      {/* Centre CTA — context aware: Compose (open form) or Gen (regenerate) */}
      <button
        className="mobile-bottom-nav-btn mobile-bottom-nav-generate"
        onClick={cta.onClick}
        disabled={cta.disabled || isGenerating}
        aria-label={cta.ariaLabel}
      >
        {isGenerating
          ? <span className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          : cta.icon}
        <span>{cta.label}</span>
      </button>

      {/* Musical tab */}
      <button
        className={`mobile-bottom-nav-btn ${activeTab === 'musical' && !isLeftPanelOpen && !isStructureOpen ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('musical');
          setIsLeftPanelOpen(false);
          setIsStructureOpen(false);
        }}
        aria-label={t.mobileNav.music}
        aria-pressed={activeTab === 'musical'}
        aria-current={activeTab === 'musical' && !isLeftPanelOpen && !isStructureOpen ? 'page' : undefined}
      >
        <Music size={20} />
        <span>{t.mobileNav.music}</span>
      </button>

      {/* Player tab */}
      <button
        className={`mobile-bottom-nav-btn ${activeTab === 'player' && !isLeftPanelOpen && !isStructureOpen ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('player');
          setIsLeftPanelOpen(false);
          setIsStructureOpen(false);
        }}
        aria-label={t.mobileNav.player ?? 'Player'}
        aria-pressed={activeTab === 'player'}
        aria-current={activeTab === 'player' && !isLeftPanelOpen && !isStructureOpen ? 'page' : undefined}
      >
        <Headphones size={20} />
        <span>{t.mobileNav.player ?? 'Player'}</span>
      </button>
    </nav>
  );
}
