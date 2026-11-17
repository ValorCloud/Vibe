import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Info, Moon, Settings, Sun, FileText, Pause, Play, Volume2, VolumeX } from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';
import { StorageGauge } from '../ui/StorageGauge';
import { StatusBarLanguagePicker } from './StatusBarLanguagePicker';
import { useTranslation, stripInternalPrefix } from '../../i18n';
import { tPlural } from '../../i18n/plurals';
import { APP_VERSION_LABEL } from '../../version';
import { useComposerContext } from '../../contexts/ComposerContext';
import { useAppKpis } from '../../hooks/useAppKpis';
import { useAppNavigationContext } from '../../contexts/AppStateContext';
import { useOptionalLibraryContext } from '../../contexts/LibraryContext';
import type { SaveStatus } from '../../hooks/useSessionAutoSave';
import type { Translations } from '../../i18n/locales/types';
import type { EditMode } from '../../types';
import { mountFullscreen, nextZoom, statusZoomLevels, statusZoomPresets } from '../../vendor/valor-configuration/controls.mjs';
import { StatusChoice } from './StatusChoice';

interface Props {
  hasApiKey: boolean;
  isAnalyzing: boolean;
  currentEditMode: EditMode;
  theme: 'light' | 'dark';
  setTheme: (v: 'light' | 'dark') => void;
  audioFeedback: boolean;
  setAudioFeedback: (v: boolean) => void;
  zoom: number;
  setZoom: (value: number) => void;
  animationsPaused: boolean;
  setAnimationsPaused: (value: boolean) => void;
  systemReducedMotion: boolean;
  onOpenAbout: () => void;
  onOpenSettings: () => void;
  /** True when a valid OPFS session snapshot exists for this device. */
  hasSavedSession?: boolean;
  /** Real-time auto-save status (saving / saved / unsaved / error). */
  saveStatus?: SaveStatus;
  /** Timestamp of the most recent successful save (ms). */
  lastSavedAt?: number | null;
  /** Extra class applied to the root element (e.g. for mobile hide/show). */
  className?: string;
}

/**
 * Returns a safe BCP-47 locale code for use with Intl APIs.
 * Falls back to 'en' when the stripped code is empty or invalid.
 */
function safeLocale(language: string): string {
  const stripped = stripInternalPrefix(language);
  return stripped.length > 0 ? stripped : 'en';
}

export function formatConsolidatedDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function StatusBar({
  hasApiKey: _hasApiKey,
  isAnalyzing,
  currentEditMode: _currentEditMode,
  theme, setTheme, audioFeedback, setAudioFeedback,
  zoom, setZoom, animationsPaused, setAnimationsPaused, systemReducedMotion,
  onOpenAbout, onOpenSettings, hasSavedSession,
  saveStatus = 'idle', lastSavedAt = null,
  className,
}: Props) {
  const { isGenerating, isSuggesting } = useComposerContext();
  const { sectionCount, wordCount, charCount } = useAppKpis();
  const { t, language } = useTranslation();
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const fullscreen = useRef<ReturnType<typeof mountFullscreen> | null>(null);
  const fullscreenLabels = useRef({ enter: t.statusBar.fullscreen, exit: t.statusBar.exitFullscreen });
  const [fullscreenError, setFullscreenError] = useState(false);
  useEffect(() => {
    fullscreenLabels.current = { enter: t.statusBar.fullscreen, exit: t.statusBar.exitFullscreen };
    fullscreen.current?.update();
  }, [t.statusBar.fullscreen, t.statusBar.exitFullscreen]);
  useEffect(() => {
    const target = document.querySelector<HTMLElement>('[data-vibe-app]');
    if (!target || !fullscreenButton.current) return;
    const controller = mountFullscreen({
      target, button: fullscreenButton.current,
      enterLabel: () => fullscreenLabels.current.enter,
      exitLabel: () => fullscreenLabels.current.exit,
      onChange: active => { if (active) setFullscreenError(false); },
      onError: () => setFullscreenError(true),
    });
    fullscreen.current = controller;
    return () => { controller.dispose(); fullscreen.current = null; };
  }, []);
  const { activeTab } = useAppNavigationContext();
  const library = useOptionalLibraryContext();

  const isBusy = isGenerating || isAnalyzing || isSuggesting;
  const statusLabel = isGenerating ? t.statusBar.generating
    : isAnalyzing ? t.statusBar.analyzing
    : isSuggesting ? t.statusBar.suggesting
    : t.statusBar.ready;

  const statusBarDict = t.statusBar as Record<string, string | undefined>;

  // ── Persistence indicator ────────────────────────────────────────────────
  const isPersistenceActive = saveStatus !== 'idle';
  const persistenceVisible = isPersistenceActive || hasSavedSession;
  const persistenceState: SaveStatus = isPersistenceActive
    ? saveStatus
    : (hasSavedSession ? 'saved' : 'idle');

  const persistenceLabel =
    persistenceState === 'saving'  ? (t.statusBar.saving   ?? 'saving\u2026')
    : persistenceState === 'unsaved' ? (t.statusBar.unsaved  ?? 'unsaved')
    : persistenceState === 'error'   ? (t.statusBar.saveError ?? 'save error')
    : (t.statusBar.sessionSavedBadge ?? 'saved');

  const persistenceTooltip =
    persistenceState === 'saving'  ? (t.statusBar.saving   ?? 'Saving\u2026')
    : persistenceState === 'unsaved' ? (t.statusBar.unsaved  ?? 'Unsaved changes')
    : persistenceState === 'error'   ? (t.statusBar.saveError ?? 'Save error')
    : lastSavedAt
      ? `${t.statusBar.sessionSavedTooltip ?? 'Session auto-saved to this device'} \u2014 ${new Date(lastSavedAt).toLocaleTimeString(safeLocale(language))}`
      : (t.statusBar.sessionSavedTooltip ?? 'Session auto-saved to this device');

  // ── Persistence dot — CSS tokens only ────────────────────────────────────
  const persistenceDotClass =
    persistenceState === 'saving'  ? 'mobile-status-dot mobile-status-dot--saving'
    : persistenceState === 'unsaved' ? 'mobile-status-dot mobile-status-dot--unsaved'
    : persistenceState === 'error'   ? 'mobile-status-dot mobile-status-dot--error'
    : 'mobile-status-dot mobile-status-dot--saved';

  const persistenceTextStyle: React.CSSProperties =
    persistenceState === 'saving'
      ? { color: 'var(--accent-warning)' }
      : persistenceState === 'unsaved'
      ? { color: 'var(--text-secondary)' }
      : persistenceState === 'error'
      ? { color: 'var(--accent-error, #ef4444)' }
      : { color: 'var(--accent-success, #10b981)' };

  const selectZoom = useCallback((value: string) => setZoom(Number(value)), [setZoom]);
  const selectTheme = useCallback((value: string) => {
    if (value === 'light' || value === 'dark') setTheme(value);
  }, [setTheme]);

  const insights: Translations['insights'] = t.insights;
  const isPlayerTab = activeTab === 'player';
  const loadedSongs = library?.tracks.length ?? 0;
  const totalDuration = library?.tracks.reduce((sum, track) => sum + (track.durationSeconds ?? 0), 0) ?? 0;
  const songsLabel = loadedSongs === 1
    ? (statusBarDict.song ?? 'Song')
    : (statusBarDict.songs ?? 'Songs');
  const durationLabel = statusBarDict.duration ?? 'Duration';

  return (
    <div dir="ltr" className={`relative lcars-status-bar border-t border-fluent-border flex items-center justify-between px-3 lg:px-6 z-40 text-xs${className ? ` ${className}` : ''}`}>
      {/* Left: system status, storage gauge and product KPIs */}
      <div className="vibe-status-kpis flex items-center gap-2 lg:gap-4">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
            isBusy
              ? 'bg-[var(--accent-warning)] animate-pulse'
              : 'bg-[var(--accent-color)] lcars-pulse'
          }`} />
          <span className="telemetry-text uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
            {statusLabel}
          </span>
          {isBusy && <span className="lcars-cursor-blink text-[var(--accent-warning)]" />}
        </div>

        {/* Session persistence indicator */}
        {persistenceVisible && (
          <Tooltip title={persistenceTooltip}>
            <div
              className="flex items-center gap-1 cursor-default"
              role="status"
              aria-live="polite"
            >
              <span className={persistenceDotClass} />
              <span
                className="telemetry-text uppercase tracking-wider hidden sm:inline"
                style={persistenceTextStyle}
              >
                {persistenceLabel}
              </span>
            </div>
          </Tooltip>
        )}

        <div className="lcars-divider" />
        <StorageGauge />
        <div className="lcars-divider hidden lg:block" />

        {/* KPI counters */}
        {isPlayerTab ? (
          <>
            <span className="hidden lg:inline telemetry-text" style={{ color: 'var(--text-primary)' }}>
              {loadedSongs}{' '}
              <span className="uppercase" style={{ color: 'var(--text-secondary)' }}>
                {songsLabel}
              </span>
            </span>
            <span className="hidden lg:inline telemetry-text" style={{ color: 'var(--text-primary)' }}>
              {formatConsolidatedDuration(totalDuration)}{' '}
              <span className="uppercase" style={{ color: 'var(--text-secondary)' }}>
                {durationLabel}
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="hidden lg:inline telemetry-text" style={{ color: 'var(--text-primary)' }}>
              {sectionCount}{' '}
              <span className="uppercase" style={{ color: 'var(--text-secondary)' }}>
                {tPlural(statusBarDict, 'sections', sectionCount, language)}
              </span>
            </span>
            <span className="hidden lg:inline telemetry-text" style={{ color: 'var(--text-primary)' }}>
              {wordCount}{' '}
              <span className="uppercase" style={{ color: 'var(--text-secondary)' }}>
                {tPlural(statusBarDict, 'words', wordCount, language)}
              </span>
            </span>
            <span className="hidden lg:inline telemetry-text" style={{ color: 'var(--text-primary)' }}>
              {charCount}{' '}
              <span className="uppercase" style={{ color: 'var(--text-secondary)' }}>
                {insights?.characters}
              </span>
            </span>
          </>
        )}
      </div>

      {/* Center: Legal links (hidden on mobile) */}
      <div className="hidden lg:flex items-center gap-3">
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Privacy Policy"
          className="lcars-meta-btn flex items-center gap-1 text-[10px] uppercase tracking-widest"
        >
          <Info className="w-3 h-3" />
          <span>Privacy</span>
        </a>
        <a
          href="/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Terms of Service"
          className="lcars-meta-btn flex items-center gap-1 text-[10px] uppercase tracking-widest"
        >
          <FileText className="w-3 h-3" />
          <span>Terms</span>
        </a>
      </div>

      {/* Right: configuration controls, with animation and audio last */}
      <div className="vibe-status-controls flex items-center gap-1">
        <Tooltip title={t.statusBar.settingsTooltip ?? t.statusBar.settings}>
          <button
            onClick={onOpenSettings}
            aria-label={t.statusBar.settings}
            className="lcars-meta-btn min-h-[44px] lg:min-h-0"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.statusBar.settings}</span>
          </button>
        </Tooltip>
        <div className="vibe-status-zoom" role="group" aria-label={t.statusBar.zoom}>
          <button type="button" className="lcars-meta-btn" aria-label={t.statusBar.zoomOut}
            disabled={zoom <= 50} onClick={() => setZoom(nextZoom(zoom, -1, statusZoomLevels))}>−</button>
          <StatusChoice label={`${t.statusBar.zoom} · ${zoom}%`} value={String(zoom)}
            options={statusZoomPresets.map(value => ({ value: String(value), label: `${value}%` }))} onSelect={selectZoom}>
            {zoom}%
          </StatusChoice>
          <button type="button" className="lcars-meta-btn" aria-label={t.statusBar.zoomIn}
            disabled={zoom >= 150} onClick={() => setZoom(nextZoom(zoom, 1, statusZoomLevels))}>+</button>
        </div>
        <button ref={fullscreenButton} type="button" className="lcars-meta-btn" hidden
          aria-label={t.statusBar.fullscreen}>⛶</button>
        {fullscreenError && <span role="status">{t.statusBar.fullscreenUnavailable}</span>}
        <StatusBarLanguagePicker />
        <StatusChoice label={t.statusBar.theme} value={theme} onSelect={selectTheme}
          options={[{ value: 'light', label: t.settings.theme.light }, { value: 'dark', label: t.settings.theme.dark }]}>
          {theme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </StatusChoice>
        <Tooltip title={t.tooltips.appInfo}>
          <button
            onClick={onOpenAbout}
            aria-label={t.settings.about.version}
            className="lcars-meta-btn lcars-app-id min-h-[44px] lg:min-h-0"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{APP_VERSION_LABEL}</span>
          </button>
        </Tooltip>
        <div className="vibe-status-media">
          <button type="button" className="lcars-meta-btn"
            onClick={() => setAnimationsPaused(!animationsPaused)}
            aria-label={systemReducedMotion ? t.statusBar.reducedMotion : animationsPaused ? t.statusBar.resumeAnimations : t.statusBar.pauseAnimations}
            title={systemReducedMotion ? t.statusBar.reducedMotion : animationsPaused ? t.statusBar.resumeAnimations : t.statusBar.pauseAnimations}
            aria-pressed={animationsPaused || systemReducedMotion} disabled={systemReducedMotion}>
            {animationsPaused || systemReducedMotion ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button type="button" className="lcars-meta-btn" onClick={() => setAudioFeedback(!audioFeedback)}
            aria-label={t.tooltips.audioFeedback} title={t.tooltips.audioFeedback} aria-pressed={!audioFeedback}>
            {audioFeedback ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
