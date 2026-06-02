import React from 'react';
import { Info, Moon, Settings, Sun, FileText } from '../ui/icons';
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

interface Props {
  hasApiKey: boolean;
  isAnalyzing: boolean;
  currentEditMode: EditMode;
  theme: 'light' | 'dark';
  setTheme: (v: 'light' | 'dark') => void;
  audioFeedback: boolean;
  setAudioFeedback: (v: boolean) => void;
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
  theme, setTheme, audioFeedback: _audioFeedback, setAudioFeedback: _setAudioFeedback,
  onOpenAbout, onOpenSettings, hasSavedSession,
  saveStatus = 'idle', lastSavedAt = null,
  className,
}: Props) {
  const { isGenerating, isSuggesting } = useComposerContext();
  const { sectionCount, wordCount, charCount } = useAppKpis();
  const { t, language } = useTranslation();
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

  const themeAriaLabel = theme === 'dark'
    ? (t.statusBar.themeSwitchToLight ?? `${t.statusBar.theme} \u2014 ${t.settings.theme.light}`)
    : (t.statusBar.themeSwitchToDark  ?? `${t.statusBar.theme} \u2014 ${t.settings.theme.dark}`);

  const insights: Translations['insights'] = t.insights;
  const isPlayerTab = activeTab === 'player';
  const loadedSongs = library?.tracks.length ?? 0;
  const totalDuration = library?.tracks.reduce((sum, track) => sum + (track.durationSeconds ?? 0), 0) ?? 0;
  const songsLabel = loadedSongs === 1
    ? (statusBarDict.song ?? 'Song')
    : (statusBarDict.songs ?? 'Songs');
  const durationLabel = statusBarDict.duration ?? 'Duration';

  return (
    <div className={`relative lcars-status-bar h-10 border-t border-fluent-border flex items-center justify-between px-3 lg:px-6 z-40 text-xs${className ? ` ${className}` : ''}`}>
      {/* Left: system status + storage gauge + KPIs (desktop only) */}
      <div className="flex items-center gap-2 lg:gap-4">
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

      {/* Right: settings + theme + version */}
      <div className="flex items-center gap-1">
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
        <Tooltip title={t.tooltips.theme}>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={themeAriaLabel}
            aria-pressed={theme === 'dark'}
            className="lcars-meta-btn min-h-[44px] lg:min-h-0"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {theme === 'dark' ? t.settings.theme.light : t.settings.theme.dark}
            </span>
          </button>
        </Tooltip>
        <StatusBarLanguagePicker />
        <Tooltip title={t.tooltips.appInfo}>
          <button
            onClick={onOpenAbout}
            aria-label={t.settings.about.version}
            className="lcars-meta-btn lcars-app-id min-h-[44px] lg:min-h-0"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{APP_VERSION_LABEL}</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
