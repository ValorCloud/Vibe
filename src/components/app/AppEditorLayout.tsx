/**
 * AppEditorLayout
 * Shell: Left panel + Top ribbon + Editor zone + Right panel (conditional).
 *
 * Orchestrates exactly 2 hooks:
 *   - useEditorState    — all context reads + derived state
 *   - useEditorHandlers — all action/handler aggregation
 *
 * Props surface: 3 (isMobileOrTablet, playAudioFeedback, setIsStructureOpenAndClearLine)
 *
 * ComposerParamsProvider wraps the layout so that SongMetaForm (inside
 * LeftSettingsPanel) can source all song meta state without prop drilling.
 *
 * InsightsBarProvider is mounted here so that both InsightsBar and
 * AppEditorZone/LyricsView can consume isAnalyzing / isAdaptingLanguage /
 * targetLanguage without prop relay.
 *
 * SuggestionsProvider is mounted here so that SuggestionsPanel sources all
 * its data from context — no prop drilling from AppEditorLayout.
 *
 * Note: webSimilarityIndex is intentionally excluded from InsightsBarContext
 * to prevent re-rendering the entire InsightsBar subtree on every similarity
 * engine run. SimilarityButton reads index directly from SimilarityContext.
 *
 * Right-panel Suspense strategy:
 *   Each right panel (Analysis, Suggestions, Structure) has its own
 *   <Suspense> boundary so that a lazy-loading chunk never blocks the
 *   other two. AnimatePresence mode="wait" at the zone level ensures the
 *   exit animation completes before the next panel mounts.
 */
import React, { Suspense, lazy, useMemo } from 'react';
import { Spinner } from '@fluentui/react-components';
import { AnimatePresence } from 'motion/react';
import { ErrorBoundary } from './ErrorBoundary';
import { useEditorState } from '../../hooks/useEditorState';
import { useEditorHandlers } from '../../hooks/useEditorHandlers';
import { useTranslation } from '../../i18n';
import { AppEditorZone } from './AppEditorZone';
import { ComposerParamsProvider } from '../../contexts/ComposerParamsContext';
import { InsightsBarProvider } from '../../contexts/InsightsBarContext';
import { SuggestionsProvider } from '../../contexts/SuggestionsContext';
import type { InsightsBarContextValue } from '../../contexts/InsightsBarContext';

const LeftSettingsPanel = lazy(() =>
  import('./LeftSettingsPanel').then(m => ({ default: m.LeftSettingsPanel }))
);
const TopRibbon = lazy(() =>
  import('./TopRibbon').then(m => ({ default: m.TopRibbon }))
);
const StructureSidebar = lazy(() =>
  import('./StructureSidebar').then(m => ({ default: m.StructureSidebar }))
);
const SuggestionsPanel = lazy(() =>
  import('./SuggestionsPanel').then(m => ({ default: m.SuggestionsPanel }))
);
const AnalysisPanel = lazy(() =>
  import('./AnalysisPanel').then(m => ({ default: m.AnalysisPanel }))
);

const LazyFallback = React.memo(function LazyFallback() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t.common?.loading ?? 'Loading'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        width: '100%',
      }}
    >
      <Spinner size="small" />
    </div>
  );
});

/**
 * Minimal error fallback for right-side panels.
 * Renders a small inline error strip with a close button — never a full reload.
 * onClose resets the panel state in the parent so the user can reopen cleanly.
 */
function PanelErrorFallback({ label, onClose }: { label: string; onClose?: () => void }) {
  const { t } = useTranslation();
  const titleTpl = t.errorBoundary?.panelUnavailable ?? '{label} unavailable';
  const title = titleTpl.replace('{label}', label);
  const description = t.errorBoundary?.panelGeneric ?? 'An unexpected error occurred in this panel.';
  const closeLabel = t.errorBoundary?.closePanel ?? 'Close panel';
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0.5rem',
        padding: '1rem',
        background: 'var(--bg-card)',
        borderLeft: '2px solid var(--accent-error)',
        color: 'var(--text-primary)',
        fontSize: '0.75rem',
        fontFamily: 'var(--fontFamilyBase, sans-serif)',
        width: '100%',
      }}
    >
      <span style={{ fontWeight: 600 }}>{title}</span>
      <span style={{ color: 'var(--text-secondary)' }}>
        {description}
      </span>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            marginTop: '0.25rem',
            padding: '0.25rem 0.75rem',
            background: 'transparent',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
        >
          {closeLabel}
        </button>
      )}
    </div>
  );
}

interface AppEditorLayoutProps {
  isMobileOrTablet: boolean;
  playAudioFeedback: (type: 'click' | 'success' | 'error' | 'drag' | 'drop') => Promise<void>;
  /**
   * Single source of truth from AppInnerContent.
   * Clears selectedLineId whenever the structure panel is opened.
   */
  setIsStructureOpenAndClearLine: (value: boolean | ((prev: boolean) => boolean)) => void;
}

export function AppEditorLayout({
  isMobileOrTablet,
  playAudioFeedback,
  setIsStructureOpenAndClearLine,
}: AppEditorLayoutProps) {
  const state = useEditorState();
  const handlers = useEditorHandlers({ state, isMobileOrTablet });

  const {
    // App state
    appState, hasApiKey, editMode,
    // Analysis
    isAnalyzing, isAdaptingLanguage, isDetectingLanguage,
    targetLanguage, setTargetLanguage,
    adaptSongLanguage, detectLanguage, analyzeCurrentSong,
    adaptationProgress, adaptationResult,
    canPasteLyrics,
    // Derived
    webBadgeLabel, isSuggestionsOpen,
    // Panels
    linguisticsWorker, spellCheck,
    switchEditMode,
    generateSong,
    song,
  } = state;

  const {
    isLeftPanelOpen, setIsLeftPanelOpen,
    isStructureOpen,
    libraryCount,
    isSectionDropdownOpen, setIsSectionDropdownOpen,
    setIsSimilarityModalOpen,
    isAnalysisPanelOpen,
  } = appState;

  const {
    handleGenerateSongFromLeftPanel,
    handleGlobalRegenerate,
    handleApiKeyHelp, handleOpenNewGeneration, handleCreateEmptySong,
    handleOpenPasteModal, handleOpenSaveToLibraryModal, handleOpenSearch,
    handleToggleAnalysisPanel,
    handleCloseAnalysisPanel, handleScrollToSection,
    addStructureItem, removeStructureItem, normalizeStructure,
  } = handlers;

  // ── InsightsBarContext value ──────────────────────────────────────────────
  const insightsBarValue = useMemo<InsightsBarContextValue>(() => ({
    targetLanguage,
    setTargetLanguage,
    isAdaptingLanguage,
    isDetectingLanguage,
    adaptSongLanguage,
    detectLanguage,
    adaptationProgress,
    adaptationResult: adaptationResult ?? null,
    isAnalyzing,
    analyzeCurrentSong,
    editMode,
    switchEditMode,
    webBadgeLabel,
    setIsSimilarityModalOpen,
    libraryCount,
    onOpenSearch: handleOpenSearch,
    onToggleAnalysisPanel: handleToggleAnalysisPanel,
    isAnalysisPanelOpen,
    hasApiKey,
  }), [
    targetLanguage, setTargetLanguage,
    isAdaptingLanguage, isDetectingLanguage,
    adaptSongLanguage, detectLanguage,
    adaptationProgress, adaptationResult,
    isAnalyzing, analyzeCurrentSong,
    editMode, switchEditMode,
    webBadgeLabel,
    setIsSimilarityModalOpen, libraryCount,
    handleOpenSearch, handleToggleAnalysisPanel,
    isAnalysisPanelOpen, hasApiKey,
  ]);

  const mobileOverlayClass = isMobileOrTablet
    ? { className: 'structure-sidebar-mobile-overlay' as const }
    : {};

  return (
    <ComposerParamsProvider>
      <InsightsBarProvider value={insightsBarValue}>
        <SuggestionsProvider spellCheck={spellCheck}>
          <div className="flex-1 flex overflow-hidden min-h-0 lcars-lyrics-area">
            {/* ── Left panel ────────────────────────────────────────────────────  */}
            {/* Hide lyrics generator sidebar in PLAYER mode */}
            {appState.activeTab !== 'player' && (
              <ErrorBoundary label="Left panel">
                <Suspense fallback={<LazyFallback />}>
                  <LeftSettingsPanel
                    isMobileOverlay={isMobileOrTablet}
                    isLeftPanelOpen={isLeftPanelOpen}
                    setIsLeftPanelOpen={setIsLeftPanelOpen}
                    onGenerateSong={handleGenerateSongFromLeftPanel}
                    onRegenerateSong={handleGlobalRegenerate}
                  />
                </Suspense>
              </ErrorBoundary>
            )}

            {/* ── Center column ───────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 bg-fluent-bg relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] bg-[var(--accent-color)]/5 blur-[120px] pointer-events-none rounded" />

              <ErrorBoundary label="Top ribbon">
                <Suspense fallback={<LazyFallback />}>
                  <TopRibbon
                    hasApiKey={hasApiKey}
                    handleApiKeyHelp={handleApiKeyHelp}
                    onOpenNewGeneration={handleOpenNewGeneration}
                    onOpenNewEmpty={handleCreateEmptySong}
                    currentEditMode={editMode}
                  />
                </Suspense>
              </ErrorBoundary>

              <ErrorBoundary label="Editor zone">
                <AppEditorZone
                  activeTab={appState.activeTab}
                  isMobileOrTablet={isMobileOrTablet}
                  hasApiKey={hasApiKey}
                  songHasContent={song.length > 0}
                  playAudioFeedback={playAudioFeedback}
                  canPasteLyrics={canPasteLyrics}
                  onOpenLibrary={handleOpenSaveToLibraryModal}
                  onPasteLyrics={handleOpenPasteModal}
                  onOpenSearch={handleOpenSearch}
                />
              </ErrorBoundary>
            </div>

            {/* ── Right panels ─────────────────────────────────────────────────── */}
            {/* AnimatePresence at zone level: exit animation fires before next panel mounts. */}
            {/* Each panel has its own Suspense so a loading chunk never blocks the others. */}
            <AnimatePresence mode="wait">
              {isAnalysisPanelOpen && (
                <ErrorBoundary
                  key="analysis"
                  label="Analysis panel"
                  fallback={
                    <PanelErrorFallback
                      label="Analysis panel"
                      onClose={handleCloseAnalysisPanel}
                    />
                  }
                >
                  <Suspense fallback={<LazyFallback />}>
                    <AnalysisPanel
                      result={linguisticsWorker.result}
                      isComputing={linguisticsWorker.isComputing}
                      error={linguisticsWorker.error}
                      onClose={handleCloseAnalysisPanel}
                      isMobileOverlay={isMobileOrTablet}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}
              {!isAnalysisPanelOpen && isSuggestionsOpen && (
                <ErrorBoundary
                  key="suggestions"
                  label="Suggestions panel"
                  fallback={<PanelErrorFallback label="Suggestions panel" />}
                >
                  <Suspense fallback={<LazyFallback />}>
                    <SuggestionsPanel
                      isMobileOverlay={isMobileOrTablet}
                      {...mobileOverlayClass}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}
              {!isAnalysisPanelOpen && !isSuggestionsOpen && (
                <ErrorBoundary
                  key="structure"
                  label="Structure sidebar"
                  fallback={<PanelErrorFallback label="Structure sidebar" />}
                >
                  <Suspense fallback={<LazyFallback />}>
                    <StructureSidebar
                      isMobileOverlay={isMobileOrTablet}
                      {...mobileOverlayClass}
                      isStructureOpen={isStructureOpen}
                      setIsStructureOpen={setIsStructureOpenAndClearLine}
                      isSectionDropdownOpen={isSectionDropdownOpen}
                      setIsSectionDropdownOpen={setIsSectionDropdownOpen}
                      addStructureItem={addStructureItem}
                      removeStructureItem={removeStructureItem}
                      normalizeStructure={normalizeStructure}
                      onScrollToSection={handleScrollToSection}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}
            </AnimatePresence>
          </div>
        </SuggestionsProvider>
      </InsightsBarProvider>
    </ComposerParamsProvider>
  );
}
