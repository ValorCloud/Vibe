import React, { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { Spinner } from '@fluentui/react-components';
import { ErrorBoundary } from './components/app/ErrorBoundary';
import { AppShell } from './components/app/AppShell';
import { StatusBar } from './components/app/StatusBar';
import { MobileBottomNav } from './components/app/MobileBottomNav';
import { MobileStatusChip } from './components/app/MobileStatusChip';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppOrchestration } from './hooks/useAppOrchestration';
import { useEditorPanelState } from './hooks/useEditorPanelState';
import { useMobileSession } from './hooks/useMobileSession';
import { useAutoSaveCoordinator } from './hooks/useAutoSaveCoordinator';
import { SimilarityProvider } from './contexts/SimilarityContext';
import { ModalProvider } from './contexts/ModalContext';
import { DragProvider } from './contexts/DragContext';
import { DragHandlersProvider } from './contexts/DragHandlersContext';
import { EditorProvider } from './contexts/EditorContext';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { RhymeProxyProvider } from './contexts/RhymeProxyContext';
import { AppStateProvider, useAppStateContext } from './contexts/AppStateContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { TranslationAdaptationProvider } from './contexts/TranslationAdaptationContext';
import { VersionProvider, useVersionContext } from './contexts/VersionContext';
import { useLanguage, useTranslation } from './i18n';
import { SongProvider, useSongContext } from './contexts/SongContext';
import { SongMutationProvider } from './contexts/SongMutationContext';
import { ComposerProvider, useComposerContext } from './contexts/ComposerContext';
import { loadSession, SESSION_SCHEMA_VERSION } from './lib/sessionPersistence';
import type { SessionSnapshot } from './lib/sessionPersistence';
import { parseShareHash, sharePayloadToSong } from './utils/exportUtils';
import { DEFAULT_RHYME_SCHEME } from './constants/editor';

// ── Lazy-loaded heavy panels (conditionally visible — keep out of initial bundle) ──
const AppEditorLayout = lazy(() =>
  import('./components/app/AppEditorLayout').then(m => ({ default: m.AppEditorLayout }))
);
const AppPanelOrchestrator = lazy(() =>
  import('./components/app/AppPanelOrchestrator').then(m => ({ default: m.AppPanelOrchestrator }))
);
const AppModalLayer = lazy(() =>
  import('./components/app/AppModalLayer').then(m => ({ default: m.AppModalLayer }))
);

// ── Splash shown while OPFS session loads ──────────────────────────────
function AppSplash() {
  const { t } = useTranslation();
  const ariaLabel = t.common?.appLoading ?? 'Application loading';
  const initLabel = t.common?.initializing ?? 'Initializing…';
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        width: '100dvw',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      <Spinner size="large" label={initLabel} labelPosition="below" />
    </div>
  );
}

// Minimal fallback for lazy panels — invisible (panels mount inside shell).
function PanelFallback() {
  return null;
}

function ModalShortcutBindings({
  isMobileOrTablet,
  closeMobilePanels,
  undo,
  redo,
}: {
  isMobileOrTablet: boolean;
  closeMobilePanels: () => void;
  undo: () => void;
  redo: () => void;
}) {
  useKeyboardShortcuts({ isMobileOrTablet, closeMobilePanels, undo, redo });
  return null;
}

function AppInnerContent() {
  const { undo, redo } = useSongContext();
  const { isGenerating } = useComposerContext();
  const { appState } = useAppStateContext();
  const {
    theme, setTheme, audioFeedback, setAudioFeedback, hasApiKey,
    hasSavedSession, setHasSavedSession,
  } = appState;

  const {
    activeTab, setActiveTab,
    isStructureOpen, isLeftPanelOpen, setIsLeftPanelOpen,
    isSuggestionsOpen,
    setIsStructureOpenAndClearLine,
    showBackdrop,
  } = useEditorPanelState();

  const { isMobileOrTablet, closeMobilePanels } = useMobileSession({
    setIsLeftPanelOpen,
    setIsStructureOpen: setIsStructureOpenAndClearLine,
  });

  const {
    playAudioFeedback,
    playAudioFeedbackRef,
    handleGlobalRegenerate,
    handleOpenSettings,
    handleOpenAbout,
    handleSectionTargetLanguageChange,
    isAnalyzing,
    sectionTargetLanguages,
    setSectionTargetLanguages,
    adaptSectionLanguage,
    adaptLineLanguage,
    adaptingLineIds,
  } = useAppOrchestration(isMobileOrTablet);

  // ── Auto-save to OPFS — song fields read internally by the coordinator ─
  const { saveStatus, lastSavedAt } = useAutoSaveCoordinator({
    activeTab,
    isStructureOpen,
    isLeftPanelOpen,
    onSaved: hasSavedSession ? undefined : () => setHasSavedSession(true),
  });

  return (
    <TranslationAdaptationProvider
      sectionTargetLanguages={sectionTargetLanguages}
      onSectionTargetLanguageChange={handleSectionTargetLanguageChange}
      adaptSectionLanguage={adaptSectionLanguage}
      adaptLineLanguage={adaptLineLanguage}
      adaptingLineIds={adaptingLineIds}
      showTranslationFeatures={appState.showTranslationFeatures}
    >
      <DragHandlersProvider playAudioFeedbackRef={playAudioFeedbackRef}>
        <ErrorBoundary label="Panels">
          <Suspense fallback={<PanelFallback />}>
            <AppPanelOrchestrator />
          </Suspense>
        </ErrorBoundary>
        <ModalShortcutBindings
          isMobileOrTablet={isMobileOrTablet}
          closeMobilePanels={closeMobilePanels}
          undo={undo}
          redo={redo}
        />
        <AppShell
          theme={theme}
          isMobileOrTablet={isMobileOrTablet}
          showBackdrop={showBackdrop(isMobileOrTablet)}
          isGenerating={isGenerating}
          onBackdropClick={closeMobilePanels}
        >
          <ErrorBoundary label="Editor">
            <Suspense fallback={<PanelFallback />}>
              <AppEditorLayout
                isMobileOrTablet={isMobileOrTablet}
                playAudioFeedback={playAudioFeedback}
                setIsStructureOpenAndClearLine={setIsStructureOpenAndClearLine}
              />
            </Suspense>
          </ErrorBoundary>

          <StatusBar
            className="lcars-status-bar-desktop"
            hasApiKey={hasApiKey}
            isAnalyzing={isAnalyzing}
            currentEditMode={appState.editMode}
            hasSavedSession={hasSavedSession}
            saveStatus={saveStatus}
            lastSavedAt={lastSavedAt}
            theme={theme} setTheme={setTheme}
            audioFeedback={audioFeedback} setAudioFeedback={setAudioFeedback}
            onOpenAbout={handleOpenAbout}
            onOpenSettings={handleOpenSettings}
          />

          {isMobileOrTablet && (
            <>
              <MobileStatusChip
                hasApiKey={hasApiKey}
                saveStatus={saveStatus}
                lastSavedAt={lastSavedAt}
              />
              <MobileBottomNav
                isLeftPanelOpen={isLeftPanelOpen} isStructureOpen={isStructureOpen}
                activeTab={activeTab}
                hasApiKey={hasApiKey}
                setIsLeftPanelOpen={setIsLeftPanelOpen} setIsStructureOpen={setIsStructureOpenAndClearLine}
                setActiveTab={setActiveTab} onGenerateSong={handleGlobalRegenerate}
                onOpenSettings={handleOpenSettings}
              />
            </>
          )}

          <ErrorBoundary label="Modals">
            <Suspense fallback={<PanelFallback />}>
              <AppModalLayer />
            </Suspense>
          </ErrorBoundary>
        </AppShell>
      </DragHandlersProvider>
    </TranslationAdaptationProvider>
  );
}

function AppProviders({ initialSession }: { initialSession: SessionSnapshot | null }) {
  const { language } = useLanguage();
  const {
    updateState,
    updateSongAndStructureWithHistory,
    setShouldAutoGenerateTitle,
  } = useSongContext();
  const { isGenerating, clearSelection } = useComposerContext();
  const { appState, uiStateForProvider } = useAppStateContext();
  const { saveVersion } = useVersionContext();

  const isGeneratingRef = React.useRef(isGenerating);
  isGeneratingRef.current = isGenerating;

  const markupDirection = useMemo(
    () =>
      appState.markupText
        ? (/[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/.test(appState.markupText) ? 'rtl' : 'ltr')
        : 'ltr',
    [appState.markupText],
  );

  return (
    <EditorProvider
      editMode={appState.editMode}
      setEditMode={appState.setEditMode}
      markupText={appState.markupText}
      setMarkupText={appState.setMarkupText}
      markupTextareaRef={appState.markupTextareaRef}
      markupDirection={markupDirection}
    >
      <ErrorBoundary label="Analysis">
        <ModalProvider uiState={uiStateForProvider}>
          <AnalysisProvider
            uiLanguage={language}
            isGeneratingRef={isGeneratingRef}
            hasApiKey={appState.hasApiKey}
            saveVersion={saveVersion}
            updateState={updateState}
            updateSongAndStructureWithHistory={updateSongAndStructureWithHistory}
            clearLineSelection={clearSelection}
            requestAutoTitleGeneration={() => setShouldAutoGenerateTitle(true)}
          >
            <RhymeProxyProvider>
              <ErrorBoundary>
                <AppInnerContent />
              </ErrorBoundary>
            </RhymeProxyProvider>
          </AnalysisProvider>
        </ModalProvider>
      </ErrorBoundary>
    </EditorProvider>
  );
}

function AppInner() {
  const [initialSession, setInitialSession] = useState<SessionSnapshot | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const safetyTimer = setTimeout(() => {
      if (!cancelled) setInitialSession(null);
    }, 3000);

    // Detect a shared song in the URL hash before loading the local OPFS session.
    const sharePayload = parseShareHash(window.location.hash);
    if (sharePayload) {
      // Remove the hash so the shared song isn't re-loaded on refresh.
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
      const songData = sharePayloadToSong(sharePayload);
      const session: SessionSnapshot = {
        schemaVersion: SESSION_SCHEMA_VERSION,
        savedAt: Date.now(),
        ...songData,
        titleOrigin: 'user',
        rhymeScheme: DEFAULT_RHYME_SCHEME,
        targetSyllables: 0,
        genre: '',
        tempo: 120,
        instrumentation: '',
        rhythm: '',
        narrative: '',
        musicalPrompt: '',
        versions: [],
        activeTab: 'lyrics',
        isStructureOpen: false,
        isLeftPanelOpen: true,
      };
      clearTimeout(safetyTimer);
      setInitialSession(session);
      return;
    }

    loadSession()
      .then(data => { if (!cancelled) setInitialSession(data); })
      .catch(() => { if (!cancelled) setInitialSession(null); })
      .finally(() => {
        clearTimeout(safetyTimer);
        cancelled = true;
      });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  if (initialSession === undefined) return <AppSplash />;

  return (
    <AppStateProvider initialSession={initialSession}>
      <LibraryProvider>
        <DragProvider>
          <SongProvider initialSession={initialSession}>
            <SongMutationProvider>
              <ComposerProvider>
              <VersionProvider initialVersions={initialSession?.versions}>
                  <SimilarityProvider>
                    <AppProviders initialSession={initialSession} />
                  </SimilarityProvider>
                </VersionProvider>
              </ComposerProvider>
            </SongMutationProvider>
          </SongProvider>
        </DragProvider>
      </LibraryProvider>
    </AppStateProvider>
  );
}

export default function App() {
  return <AppInner />;
}
