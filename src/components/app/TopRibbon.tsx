import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Sparkles, Undo2, Redo2, PanelRight, Menu, KeyboardRegular, WandSparkles, Check, Copy } from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';
import { IconButton } from '../ui/IconButton';
import { useTranslation } from '../../i18n';
import { useSongHistoryContext, useSongContext } from '../../contexts/SongContext';
import { useComposerContext } from '../../contexts/ComposerContext';
import { useAppNavigationContext } from '../../contexts/AppStateContext';
import { useTopRibbonActions } from '../../hooks/useTopRibbonActions';
import { RibbonMenuPanel } from './RibbonMenuPanel';
import { RibbonTabs } from './RibbonTabs';
import { copyToClipboard } from '../../utils/clipboard';

/**
 * TopRibbon — assembly component (~100 lines).
 * Owns: burger state, right-side actions.
 * Delegates: <RibbonMenuPanel> (menu), <RibbonTabs> (tab strip).
 */
interface Props {
  hasApiKey: boolean;
  handleApiKeyHelp: () => void;
  onOpenNewGeneration: () => void;
  onOpenNewEmpty: () => void;
}

export function TopRibbon({ hasApiKey, handleApiKeyHelp, onOpenNewGeneration, onOpenNewEmpty }: Props) {
  const { past, future, undo, redo } = useSongHistoryContext();
  const { isGenerating, clearSelection } = useComposerContext();
  const { song } = useSongContext();
  const { activeTab, setActiveTab, isLeftPanelOpen, setIsLeftPanelOpen, isStructureOpen, setIsStructureOpen } = useAppNavigationContext();
  const { openKeyboardShortcuts, isAnalyzing } = useTopRibbonActions();
  const { t } = useTranslation();

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const isBusy = isGenerating || isAnalyzing;
  const processingLabel = t.tooltips.processing ?? 'Processing…';
  const panelToggleLabel = isLeftPanelOpen
    ? (t.tooltips.closeLeftPanel ?? 'Close lyrics generation panel')
    : (t.tooltips.openLeftPanel ?? 'Open lyrics generation panel');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const lyriaSentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lyriaSent, setLyriaSent] = useState(false);
  const [lyricsCopied, setLyricsCopied] = useState(false);

  const lyricsText = useMemo(() => {
    if (!song || song.length === 0) return '';
    return song
      .map(section => {
        const header = section.name?.trim() ? `[${section.name.trim()}]` : '';
        const body = section.lines.map(l => l.text ?? '').join('\n');
        return header ? `${header}\n${body}` : body;
      })
      .join('\n\n')
      .trim();
  }, [song]);

  const handleCopyLyrics = useCallback(() => {
    if (!lyricsText) return;
    void copyToClipboard(lyricsText).then((ok) => {
      if (!ok) return;
      setLyricsCopied(true);
      setTimeout(() => setLyricsCopied(false), 2000);
    });
  }, [lyricsText]);

  const toggleLeftPanel = () => {
    if (!isLeftPanelOpen) { setActiveTab('lyrics'); setIsStructureOpen(false); }
    setIsLeftPanelOpen(!isLeftPanelOpen);
  };
  const toggleStructurePanel = () => {
    const next = !isStructureOpen;
    if (next) clearSelection();
    setIsStructureOpen(next);
  };

  useEffect(() => () => {
    if (lyriaSentTimeoutRef.current) clearTimeout(lyriaSentTimeoutRef.current);
  }, []);

  const handleSendToLyria = () => {
    // Switch to the Musical tab where the Lyria preview/full-song panels live.
    setActiveTab('musical');
    if (lyriaSentTimeoutRef.current) clearTimeout(lyriaSentTimeoutRef.current);
    setLyriaSent(true);
    lyriaSentTimeoutRef.current = setTimeout(() => {
      setLyriaSent(false);
    }, 2000);
  };

  const lyriaTooltip = lyriaSent
    ? (t.tooltips.sendToLyriaConfirm ?? 'Opening Musical…')
    : (t.tooltips.sendToLyria ?? 'Open the Musical tab to generate a preview with Lyria');

  const lyricsTooltip = lyricsCopied
    ? (t.tooltips.copyLyricsConfirm ?? 'Lyrics copied to clipboard')
    : (t.tooltips.copyLyrics ?? 'Copy lyrics');

  return (
    <div
      className="h-16 border-b border-fluent-border flex items-center justify-between px-4 lg:px-8 lcars-ribbon lcars-ribbon-rail rounded-none border-t-0 border-l-0 border-r-0"
      style={{ position: 'relative', overflow: 'visible', backgroundColor: 'var(--bg-app, #0c0c0c)', backdropFilter: 'none', WebkitBackdropFilter: 'none', zIndex: 20 }}
    >
      <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--lcars-amber) 0%, var(--lcars-cyan) 50%, var(--lcars-violet) 100%)', opacity: 0.85, pointerEvents: 'none', zIndex: 1 }} />

      <div className="flex items-center gap-3 lg:gap-6 pl-0">
        <div className="relative" style={{ zIndex: 60 }}>
          <Tooltip title={t.ribbon.menu ?? 'Menu'}>
            <button
              ref={menuButtonRef}
              onClick={() => setIsMenuOpen(v => !v)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-all duration-200"
              style={{ color: isMenuOpen ? 'var(--accent-color)' : 'var(--text-secondary)', backgroundColor: isMenuOpen ? 'color-mix(in srgb, var(--accent-color) 12%, transparent)' : undefined }}
              aria-label={t.ribbon.menuAria ?? 'Open main menu'}
              aria-expanded={isMenuOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
        {isMenuOpen && (
          <RibbonMenuPanel anchorRef={menuButtonRef} onClose={() => setIsMenuOpen(false)} onOpenNewGeneration={onOpenNewGeneration} onOpenNewEmpty={onOpenNewEmpty} />
        )}
        <div className="w-px h-6 bg-fluent-border opacity-40" />
        <RibbonTabs />
      </div>

      <div className="flex items-center gap-1 lg:gap-2">
        {isBusy && (
          <Tooltip title={processingLabel}>
            <span className="w-2 h-2 rounded-full bg-[var(--accent-color)] animate-pulse" aria-label={processingLabel.replace(/\u2026|\.{3}$/, '')} />
          </Tooltip>
        )}
        {!hasApiKey && (
          <Tooltip title={t.tooltips.aiUnavailableHelp}>
            <button onClick={handleApiKeyHelp} className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg hover:bg-amber-500/20 transition-all">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t.ribbon.aiUnavailable}</span>
            </button>
          </Tooltip>
        )}
        {/* Send to LYRIA button + Copy Lyrics (lyrics tab only) */}
        <div className="flex items-center gap-1">
          <Tooltip title={lyriaTooltip}>
            <button
              onClick={handleSendToLyria}
              disabled={lyriaSent}
              aria-label={t.ribbon.send_to_lyria ?? 'Send to LYRIA'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background: lyriaSent
                  ? 'color-mix(in srgb, var(--lcars-cyan, #4f98a3) 12%, transparent)'
                  : 'color-mix(in srgb, var(--lcars-violet, #a86fdf) 12%, transparent)',
                color: lyriaSent
                  ? 'var(--lcars-cyan, #4f98a3)'
                  : 'var(--lcars-violet, #a86fdf)',
                border: `1px solid ${
                  lyriaSent
                    ? 'color-mix(in srgb, var(--lcars-cyan, #4f98a3) 25%, transparent)'
                    : 'color-mix(in srgb, var(--lcars-violet, #a86fdf) 25%, transparent)'
                }`,
              }}
            >
              {lyriaSent
                ? <Check className="w-3.5 h-3.5" />
                : <Sparkles className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">{t.ribbon.send_to_lyria ?? 'Send to LYRIA'}</span>
            </button>
          </Tooltip>

          {activeTab === 'lyrics' && (
            <Tooltip title={lyricsTooltip}>
              <button
                onClick={handleCopyLyrics}
                disabled={!lyricsText}
                aria-label={t.ribbon.copy_lyrics ?? t.tooltips.copyLyrics ?? 'Copy Lyrics'}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wide border border-[var(--border-color)] text-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lyricsCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden lg:inline">{lyricsCopied ? (t.musical?.copied ?? 'Copied!') : (t.ribbon.copy_lyrics ?? 'Copy Lyrics')}</span>
              </button>
            </Tooltip>
          )}
        </div>
        <div className="w-px h-4 bg-[var(--border-color)] mx-1 hidden lg:block" />
        <Tooltip title={t.tooltips.undo}>
          <IconButton onClick={undo} disabled={!canUndo} size="small" style={{ color: canUndo ? 'var(--accent-color)' : 'var(--text-secondary)', minWidth: 36, minHeight: 36 }} className={canUndo ? 'bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20' : 'opacity-40 saturate-0 cursor-not-allowed'} aria-disabled={!canUndo} aria-label={t.tooltips.undo}>
            <Undo2 className="w-4 h-4" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t.tooltips.redo}>
          <IconButton onClick={redo} disabled={!canRedo} size="small" style={{ color: canRedo ? 'var(--accent-color)' : 'var(--text-secondary)', minWidth: 36, minHeight: 36 }} className={canRedo ? 'bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20' : 'opacity-40 saturate-0 cursor-not-allowed'} aria-disabled={!canRedo} aria-label={t.tooltips.redo}>
            <Redo2 className="w-4 h-4" />
          </IconButton>
        </Tooltip>
        <div className="w-px h-4 bg-[var(--border-color)] mx-1" />
        <Tooltip title={t.tooltips.keyboardShortcuts}>
          <button onClick={openKeyboardShortcuts} aria-label={t.tooltips.keyboardShortcuts} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md transition-colors" style={{ color: 'var(--text-secondary)' }}>
            <KeyboardRegular className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip title={panelToggleLabel}>
          <button onClick={toggleLeftPanel} aria-label={panelToggleLabel} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md transition-colors" style={{ color: isLeftPanelOpen ? 'var(--accent-color)' : 'var(--text-secondary)', backgroundColor: isLeftPanelOpen ? 'color-mix(in srgb, var(--accent-color) 10%, transparent)' : undefined }}>
            <WandSparkles className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip title={isStructureOpen ? t.tooltips.collapseRight : t.tooltips.showSidebar}>
          <button onClick={toggleStructurePanel} aria-label={isStructureOpen ? t.tooltips.collapseRight : t.tooltips.showSidebar} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md transition-colors" style={{ color: isStructureOpen ? 'var(--accent-color)' : 'var(--text-secondary)', backgroundColor: isStructureOpen ? 'color-mix(in srgb, var(--accent-color) 10%, transparent)' : undefined }}>
            <PanelRight className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
