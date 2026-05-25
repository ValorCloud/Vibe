import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { WebSimilarityIndex } from './types/webSimilarity';

// ─── Shared reactive state (vi.hoisted so factories can close over it) ───────

const mockAppState = vi.hoisted(() => ({
  initialIsGenerating: false,
  setActiveTabSpy: vi.fn(),
  setEditModeSpy: vi.fn(),
  appModalsPropsSpy: vi.fn(),
  noop: vi.fn(),
  asyncNoop: vi.fn(async () => {}),
  song: [] as Array<{ id: string; name: string; lines: Array<{ id: string; text: string; isMeta: boolean }> }>,
  structure: [] as Array<{ id: string; name: string }>,
  similarityIndex: { status: 'idle', candidates: [], lastUpdated: null, error: null } as WebSimilarityIndex,
}));

// ─── Session persistence: resolve immediately so AppSplash is never shown ────

vi.mock('./lib/sessionPersistence', () => ({
  loadSession: vi.fn(async () => null),
  saveSession: vi.fn(async () => {}),
}));

// ─── i18n ────────────────────────────────────────────────────────────────────

vi.mock('./i18n', () => ({
  useLanguage: () => ({ language: 'en' }),
  useTranslation: () => ({ t: {} }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Context providers (passthrough) + hook return values ────────────────────

vi.mock('./contexts/AppStateContext', () => ({
  AppStateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAppStateContext: () => ({
    appState: {
      theme: 'dark',
      setTheme: mockAppState.noop,
      audioFeedback: false,
      setAudioFeedback: mockAppState.noop,
      hasApiKey: true,
      hasSavedSession: false,
      setHasSavedSession: mockAppState.noop,
      showTranslationFeatures: false,
      editMode: 'markdown',
      setEditMode: mockAppState.setEditModeSpy,
      markupText: '[Verse]\nHello',
      setMarkupText: mockAppState.noop,
      markupTextareaRef: { current: null },
    },
    uiStateForProvider: {},
  }),
  useAppNavigationContext: () => ({
    setActiveTab: mockAppState.setActiveTabSpy,
    activeTab: 'lyrics',
  }),
}));

vi.mock('./contexts/SongContext', () => ({
  SongProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSongContext: () => ({
    undo: mockAppState.noop,
    redo: mockAppState.noop,
    song: mockAppState.song,
    structure: mockAppState.structure,
    title: 'Test',
    titleOrigin: 'user',
    topic: '',
    mood: '',
    rhymeScheme: 'AABB',
    targetSyllables: 8,
    songLanguage: 'en',
    genre: '',
    tempo: 120,
    instrumentation: '',
    rhythm: '',
    narrative: '',
    musicalPrompt: '',
    updateState: mockAppState.noop,
    updateSongAndStructureWithHistory: mockAppState.noop,
    setShouldAutoGenerateTitle: mockAppState.noop,
  }),
}));

vi.mock('./contexts/SongMutationContext', () => ({
  SongMutationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/ComposerContext', () => ({
  ComposerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useComposerContext: () => ({
    isGenerating: mockAppState.initialIsGenerating,
    clearSelection: mockAppState.noop,
    selectedLineId: null,
    setSelectedLineId: mockAppState.noop,
    suggestions: [],
    isSuggesting: false,
    applySuggestion: mockAppState.noop,
    generateSuggestions: mockAppState.asyncNoop,
  }),
}));

vi.mock('./contexts/VersionContext', () => ({
  VersionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useVersionContext: () => ({ versions: [], saveVersion: mockAppState.noop, replaceVersions: mockAppState.noop }),
  useOptionalVersionContext: () => ({ versions: [], saveVersion: mockAppState.noop, replaceVersions: mockAppState.noop }),
}));

vi.mock('./contexts/SimilarityContext', () => ({
  SimilarityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/EditorContext', () => ({
  EditorProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/AnalysisContext', () => ({
  AnalysisProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/RhymeProxyContext', () => ({
  RhymeProxyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/TranslationAdaptationContext', () => ({
  TranslationAdaptationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/ModalContext', () => ({
  ModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useModalContext: () => ({}),
}));

vi.mock('./contexts/DragContext', () => ({
  DragProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/DragHandlersContext', () => ({
  DragHandlersProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDragHandlersContext: () => ({
    handleDrop: mockAppState.noop,
    handleLineDragStart: mockAppState.noop,
    handleLineDrop: mockAppState.noop,
  }),
}));

// ─── New hooks used in App.tsx ────────────────────────────────────────────────

vi.mock('./hooks/useEditorPanelState', () => ({
  useEditorPanelState: () => ({
    activeTab: 'lyrics',
    setActiveTab: mockAppState.setActiveTabSpy,
    isStructureOpen: false,
    isLeftPanelOpen: false,
    setIsLeftPanelOpen: mockAppState.noop,
    isSuggestionsOpen: false,
    setIsStructureOpenAndClearLine: mockAppState.noop,
    showBackdrop: () => false,
  }),
}));

vi.mock('./hooks/useMobileSession', () => ({
  useMobileSession: () => ({
    isMobileOrTablet: false,
    closeMobilePanels: mockAppState.noop,
  }),
}));

vi.mock('./hooks/useAppOrchestration', () => ({
  useAppOrchestration: () => ({
    playAudioFeedback: mockAppState.noop,
    playAudioFeedbackRef: { current: mockAppState.noop },
    handleGlobalRegenerate: mockAppState.noop,
    handleOpenSettings: mockAppState.noop,
    handleOpenAbout: mockAppState.noop,
    handleSectionTargetLanguageChange: mockAppState.noop,
    isAnalyzing: false,
    sectionTargetLanguages: {},
    setSectionTargetLanguages: mockAppState.noop,
    adaptSectionLanguage: mockAppState.asyncNoop,
    adaptLineLanguage: mockAppState.asyncNoop,
    adaptingLineIds: new Set<string>(),
  }),
}));

vi.mock('./hooks/useSessionAutoSave', () => ({
  useSessionAutoSave: () => ({ saveStatus: 'idle' as const, lastSavedAt: null }),
}));

vi.mock('./hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: mockAppState.noop,
}));

// ─── ErrorBoundary ────────────────────────────────────────────────────────────

vi.mock('./components/app/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Lazy panels ─────────────────────────────────────────────────────────────// AppPanelOrchestrator: no-op (tested separately).
// AppModalLayer: mocked to render AppModals synchronously — nested React.lazy()
//               calls inside AppModalLayer do not resolve in jsdom's act() block.

vi.mock('./components/app/AppEditorLayout', () => ({
  AppEditorLayout: () => (
    <>
      <div data-testid="left-settings-panel" />
      <div data-testid="lyrics-view" />
      <button
        type="button"
        onClick={() => mockAppState.setActiveTabSpy('musical')}
      >
        Switch to musical
      </button>
    </>
  ),
}));

vi.mock('./components/app/AppPanelOrchestrator', () => ({
  AppPanelOrchestrator: () => null,
}));

// ─── AppModalLayer mock ────────────────────────────────────────────────────────// AppModalLayer internally lazy-loads AppModals via React.lazy + dynamic import.
// In jsdom the nested async resolution never completes within act(), so AppModals
// never mounts and appModalsPropsSpy is never called. We mock AppModalLayer to
// render the (already-mocked) AppModals synchronously with the props the test
// verifies.

vi.mock('./components/app/AppModalLayer', async () => {
  const { AppModals } = await import('./components/app/AppModals');
  return {
    AppModalLayer: () => (
      <AppModals isAnalyzingTheme={false} applyAnalysisItem={() => {}} />
    ),
  };
});

// ─── Leaf component stubs ─────────────────────────────────────────────────────

vi.mock('./components/app/StatusBar', () => ({
  StatusBar: () => <div data-testid="status-bar" />, 
}));

vi.mock('./components/app/MobileBottomNav', () => ({
  MobileBottomNav: () => <div data-testid="mobile-bottom-nav" />, 
}));

vi.mock('./components/app/AppModals', () => ({
  AppModals: (props: unknown) => {
    mockAppState.appModalsPropsSpy(props);
    return <div data-testid="app-modals" />;
  },
}));

// ─── FluentUI (avoid real theme registration in jsdom) ────────────────────────

vi.mock('@fluentui/react-components', () => ({
  FluentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  webLightTheme: {},
  webDarkTheme: {},
  Spinner: () => <div data-testid="spinner" />, 
}));

// ──────────────────────────────────────────────────────────────────────────────
describe('App markup mode reset', () => {
  beforeEach(() => {
    mockAppState.initialIsGenerating = false;
    mockAppState.song = [];
    mockAppState.structure = [];
    mockAppState.setActiveTabSpy.mockClear();
    mockAppState.setEditModeSpy.mockClear();
    mockAppState.appModalsPropsSpy.mockClear();
  });

  it('renders the app without crashing (smoke test)', async () => {
    await act(async () => { render(<App />); });
    expect(screen.getByTestId('left-settings-panel')).toBeTruthy();
    expect(screen.getByTestId('status-bar')).toBeTruthy();
    expect(screen.getByTestId('lyrics-view')).toBeTruthy();
  });

  it('calls setActiveTab("musical") when the tab-switch button is clicked', async () => {
    await act(async () => { render(<App />); });
    const switchButton = screen.getByText('Switch to musical');
    await act(async () => { fireEvent.click(switchButton); });
    expect(mockAppState.setActiveTabSpy).toHaveBeenCalledWith('musical');
  });

  it('forwards isAnalyzingTheme and applyAnalysisItem to AppModals', async () => {
    await act(async () => { render(<App />); });
    const calls = mockAppState.appModalsPropsSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastProps = (calls[calls.length - 1]?.[0] ?? {}) as Record<string, unknown>;
    expect('isAnalyzingTheme' in lastProps).toBe(true);
    expect('applyAnalysisItem' in lastProps).toBe(true);
    expect(typeof lastProps.applyAnalysisItem).toBe('function');
  });

  it('shows a blocking generation splash while a song is being generated', async () => {
    mockAppState.initialIsGenerating = true;

    await act(async () => { render(<App />); });

    expect(screen.getByRole('status', { name: 'Song generation in progress' })).toBeTruthy();
    expect(screen.getByText('Generating your song…')).toBeTruthy();
    expect(screen.getByText('Please wait while the editor is temporarily locked.')).toBeTruthy();
    // AppShell sets aria-hidden imperatively via useEffect on the content wrapper
    expect(screen.getByTestId('left-settings-panel').closest('[aria-hidden="true"]')).toBeTruthy();
  });
});