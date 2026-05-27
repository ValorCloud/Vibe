import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Sparkles, Undo2, Redo2, PanelRight, Menu, KeyboardRegular, WandSparkles, Check, Copy } from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';
import { IconButton } from '../ui/IconButton';
import { useTranslation } from '../../i18n';
import { useSongHistoryContext, useSongContext } from '../../contexts/SongContext';
import { useComposerContext } from '../../contexts/ComposerContext';
import { useAppNavigationContext } from '../../contexts/AppStateContext';
import { useTopRibbonActions } from '../../hooks/useTopRibbonActions';
import { useVoiceAssistantController } from '../../features/voice/useVoiceAssistantController';
import { RibbonMenuPanel } from './RibbonMenuPanel';
import { RibbonTabs } from './RibbonTabs';
import { copyToClipboard } from '../../utils/clipboard';
import type { EditMode } from '../../types';

/**
 * TopRibbon — assembly component.
 * Owns: burger state, right-side actions, centred voice assistant button.
 * Delegates: <RibbonMenuPanel> (menu), <RibbonTabs> (tab strip).
 */
interface Props {
  hasApiKey: boolean;
  handleApiKeyHelp: () => void;
  onOpenNewGeneration: () => void;
  onOpenNewEmpty: () => void;
  currentEditMode: EditMode;
}

export function TopRibbon({ hasApiKey, handleApiKeyHelp, onOpenNewGeneration, onOpenNewEmpty, currentEditMode }: Props) {
  const { past, future, undo, redo } = useSongHistoryContext();
  const { isGenerating, clearSelection } = useComposerContext();
  const { song, musicalPrompt } = useSongContext();
  const { activeTab, setActiveTab: _setActiveTab, isLeftPanelOpen, setIsLeftPanelOpen, isStructureOpen, setIsStructureOpen } = useAppNavigationContext();
  const { openKeyboardShortcuts, isAnalyzing } = useTopRibbonActions();
  const { t } = useTranslation();

  // ── Voice assistant ───────────────────────────────────────────────────────
  const {
    invoke: invokeVoiceAssistant,
    uiState: voiceUiState,
    promptText: voicePromptText,
    textFallback: voiceTextFallback,
    errorText: voiceErrorText,
  } = useVoiceAssistantController({
    enabled: hasApiKey,
    page: activeTab,
    mode: currentEditMode,
  });

  const voiceLabel =
    voiceUiState === 'listening'
      ? (t.tooltips?.voiceListening ?? 'Listening\u2026')
      : voiceUiState === 'processing'
        ? (t.tooltips?.voiceProcessing ?? 'Processing your request\u2026')
        : voiceUiState === 'speaking'
          ? (t.tooltips?.voiceSpeaking ?? 'Speaking\u2026')
          : (t.tooltips?.voiceAssistant ?? 'Voice assistant');

  const voiceActive = voiceUiState !== 'idle';

  const VoiceIcon = () => {
    if (voiceUiState === 'listening') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      );
    }
    if (voiceUiState === 'processing' || voiceUiState === 'speaking') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    );
  };

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const isBusy = isGenerating || isAnalyzing;
  const processingLabel = t.tooltips.processing ?? 'Processing\u2026';
  const panelToggleLabel = isLeftPanelOpen
    ? (t.tooltips.closeLeftPanel ?? 'Close lyrics generation panel')
    : (t.tooltips.openLeftPanel ?? 'Open lyrics generation panel');
  const tooltipDict = t.tooltips as Record<string, string | undefined>;
  const isPlayerMode = activeTab === 'player';
  const structureToggleLabel = isPlayerMode
    ? (tooltipDict.playerSidebarDisabled ?? 'Sidebar is disabled in Player mode')
    : isStructureOpen
      ? t.tooltips.collapseRight
      : t.tooltips.showSidebar;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [lyricsCopied, setLyricsCopied] = useState(false);
  const [musicalPromptCopied, setMusicalPromptCopied] = useState(false);

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

  const handleCopyMusicalPrompt = useCallback(() => {
    if (!musicalPrompt) return;
    void copyToClipboard(musicalPrompt).then((ok) => {
      if (!ok) return;
      setMusicalPromptCopied(true);
      setTimeout(() => setMusicalPromptCopied(false), 2000);
    });
  }, [musicalPrompt]);

  const toggleLeftPanel = () => {
    if (!isLeftPanelOpen) { setIsStructureOpen(false); }
    setIsLeftPanelOpen(!isLeftPanelOpen);
  };
  const toggleStructurePanel = () => {
    if (isPlayerMode) return;
    const next = !isStructureOpen;
    if (next) clearSelection();
    setIsStructureOpen(next);
  };

  const lyricsTooltip = lyricsCopied
    ? (t.tooltips.copyLyricsConfirm ?? 'Lyrics copied to clipboard')
    : (t.tooltips.copyLyrics ?? 'Copy lyrics');
  const musicalPromptTooltip = musicalPromptCopied
    ? (t.tooltips.copyMusicalPromptConfirm ?? 'Musical prompt copied to clipboard')
    : (t.tooltips.copyMusicalPrompt ?? 'Copy musical prompt');

  return (
    <div
      className="h-16 border-b border-fluent-border flex items-center justify-between px-4 lg:px-8 lcars-ribbon lcars-ribbon-rail rounded-none border-t-0 border-l-0 border-r-0"
      style={{ position: 'relative', overflow: 'visible', backgroundColor: 'var(--bg-app, #0c0c0c)', backdropFilter: 'none', WebkitBackdropFilter: 'none', zIndex: 20 }}
    >
      <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--lcars-amber) 0%, var(--lcars-cyan) 50%, var(--lcars-violet) 100%)', opacity: 0.85, pointerEvents: 'none', zIndex: 1 }} />

      {/* Left: menu + tabs */}
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

      {/* Centre: Voice assistant pill — absolutely centred, z-index above tab strip */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5" style={{ zIndex: 30 }}>
        <Tooltip title={voiceLabel}>
          <button
            onClick={invokeVoiceAssistant}
            disabled={!hasApiKey}
            aria-label={voiceLabel}
            aria-pressed={voiceActive}
            className="flex items-center gap-2 px-4 h-8 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: voiceActive ? 'var(--lcars-cyan, #4f98a3)' : 'var(--text-secondary)',
              background: voiceActive
                ? 'color-mix(in srgb, var(--lcars-cyan, #4f98a3) 14%, transparent)'
                : 'color-mix(in srgb, var(--text-secondary) 6%, transparent)',
              border: `1px solid ${voiceActive
                ? 'color-mix(in srgb, var(--lcars-cyan, #4f98a3) 30%, transparent)'
                : 'color-mix(in srgb, var(--text-secondary) 15%, transparent)'}`,
              boxShadow: voiceActive
                ? '0 0 10px color-mix(in srgb, var(--lcars-cyan, #4f98a3) 25%, transparent)'
                : 'none',
            }}
          >
            <VoiceIcon />
            <span className="hidden sm:inline">{voiceLabel}</span>
          </button>
        </Tooltip>
        {/* Inline voice feedback strip */}
        {(voicePromptText || voiceTextFallback || voiceErrorText) && (
          <div
            role={voiceErrorText ? 'alert' : 'status'}
            aria-live={voiceErrorText ? 'assertive' : 'polite'}
            className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)] shadow z-50"
          >
            {voiceErrorText ?? voiceTextFallback ?? voicePromptText}
          </div>
        )}
      </div>

      {/* Right: actions */}
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
        {activeTab === 'musical' && (
          <Tooltip title={musicalPromptTooltip}>
            <button
              onClick={handleCopyMusicalPrompt}
              disabled={!musicalPrompt}
              aria-label={t.ribbon.copy_musical_prompt ?? t.tooltips.copyMusicalPrompt ?? 'Copy Musical Prompt'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wide border border-[var(--border-color)] text-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {musicalPromptCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">{musicalPromptCopied ? (t.musical?.copied ?? 'Copied!') : (t.ribbon.copy_musical_prompt ?? 'Copy Musical Prompt')}</span>
            </button>
          </Tooltip>
        )}
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
        <Tooltip title={structureToggleLabel}>
          <button onClick={toggleStructurePanel} disabled={isPlayerMode} aria-disabled={isPlayerMode} aria-label={structureToggleLabel} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md transition-colors disabled:opacity-35 disabled:cursor-not-allowed" style={{ color: isStructureOpen && !isPlayerMode ? 'var(--accent-color)' : 'var(--text-secondary)', backgroundColor: isStructureOpen && !isPlayerMode ? 'color-mix(in srgb, var(--accent-color) 10%, transparent)' : undefined }}>
            <PanelRight className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
