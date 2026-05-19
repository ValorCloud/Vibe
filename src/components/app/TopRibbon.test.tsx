import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TopRibbon } from './TopRibbon';

// ── Mutable state refs — mutated per-test, read by the mock factory ──────────
let mockPast: unknown[] = [];
let mockFuture: unknown[] = [];
let mockIsGenerating = false;
let mockIsAnalyzing = false;
let mockIsLeftPanelOpen = false;
let mockIsStructureOpen = false;
let mockMusicalPrompt = '';

const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockClearSelection = vi.fn();
const mockSetActiveTab = vi.fn();
const mockSetIsLeftPanelOpen = vi.fn();
const mockSetIsStructureOpen = vi.fn();
const mockOpenKeyboardShortcuts = vi.fn();
const mockInvokeVoiceAssistant = vi.fn();

vi.mock('../../contexts/SongContext', () => ({
  useSongHistoryContext: () => ({
    past: mockPast,
    future: mockFuture,
    undo: mockUndo,
    redo: mockRedo,
  }),
  useSongContext: () => ({
    musicalPrompt: mockMusicalPrompt,
  }),
}));

vi.mock('../../contexts/ComposerContext', () => ({
  useComposerContext: () => ({
    isGenerating: mockIsGenerating,
    clearSelection: mockClearSelection,
  }),
}));

vi.mock('../../contexts/AppStateContext', () => ({
  useAppNavigationContext: () => ({
    activeTab: 'lyrics' as const,
    setActiveTab: mockSetActiveTab,
    isLeftPanelOpen: mockIsLeftPanelOpen,
    setIsLeftPanelOpen: mockSetIsLeftPanelOpen,
    isStructureOpen: mockIsStructureOpen,
    setIsStructureOpen: mockSetIsStructureOpen,
  }),
}));

vi.mock('../../hooks/useTopRibbonActions', () => ({
  useTopRibbonActions: () => ({
    openKeyboardShortcuts: mockOpenKeyboardShortcuts,
    isAnalyzing: mockIsAnalyzing,
  }),
}));

vi.mock('../../features/voice/useVoiceAssistantController', () => ({
  useVoiceAssistantController: () => ({
    invoke: mockInvokeVoiceAssistant,
    uiState: 'idle',
    promptText: null,
    textFallback: null,
    errorText: null,
  }),
}));

vi.mock('../../i18n', () => ({
  useTranslation: () => ({
    t: {
      tooltips: {
        undo: 'Undo',
        redo: 'Redo',
        processing: 'Processing\u2026',
        aiUnavailableHelp: 'Configure API key',
        keyboardShortcuts: 'Keyboard shortcuts',
        closeLeftPanel: 'Close panel',
        openLeftPanel: 'Open panel',
        collapseRight: 'Collapse',
        showSidebar: 'Show sidebar',
        sendToLyria: 'Open the Musical tab to generate a preview with Lyria',
        sendToLyriaConfirm: 'Opening Musical…',
        quantizeLineDone: 'Line quantized',
      },
      ribbon: {
        aiUnavailable: 'AI unavailable',
        send_to_lyria: 'Send to LYRIA',
        copy_lyrics: 'Copy Lyrics',
        menu: 'Menu',
        menuAria: 'Open main menu',
      },
    },
  }),
}));

// Tooltip: transparent wrapper so aria-label on inner buttons is reachable
vi.mock('../ui/Tooltip', () => ({
  Tooltip: ({ children, title }: { children: React.ReactNode; title: string }) => <span title={title}>{children}</span>,
}));

vi.mock('./RibbonMenuPanel', () => ({
  RibbonMenuPanel: () => <div data-testid="ribbon-menu-panel" />,
}));
vi.mock('./RibbonTabs', () => ({
  RibbonTabs: () => <div data-testid="ribbon-tabs" />,
}));

// ── Default props ────────────────────────────────────────────────────────────
const defaultProps = {
  hasApiKey: true,
  handleApiKeyHelp: vi.fn(),
  onOpenNewGeneration: vi.fn(),
  onOpenNewEmpty: vi.fn(),
  currentEditMode: 'section' as const,
};

function renderRibbon(props: Partial<typeof defaultProps> = {}) {
  return render(<TopRibbon {...defaultProps} {...props} />);
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('TopRibbon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPast = [];
    mockFuture = [];
    mockIsGenerating = false;
    mockIsAnalyzing = false;
    mockMusicalPrompt = '';
    mockIsLeftPanelOpen = false;
    mockIsStructureOpen = false;
    mockInvokeVoiceAssistant.mockReset();
  });

  it('renders without crashing', () => {
    renderRibbon();
    expect(screen.getByRole('button', { name: 'Open main menu' })).toBeDefined();
  });

  it('undo button is disabled when no past', () => {
    renderRibbon();
    expect(screen.getByRole('button', { name: 'Undo' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('redo button is disabled when no future', () => {
    renderRibbon();
    expect(screen.getByRole('button', { name: 'Redo' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('undo fires callback when past is non-empty', () => {
    mockPast = [{}];
    renderRibbon();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(mockUndo).toHaveBeenCalledOnce();
  });

  it('redo fires callback when future is non-empty', () => {
    mockFuture = [{}];
    renderRibbon();
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(mockRedo).toHaveBeenCalledOnce();
  });

  it('shows AI-unavailable badge when hasApiKey=false', () => {
    renderRibbon({ hasApiKey: false });
    expect(screen.getByText('AI unavailable')).toBeDefined();
  });

  it('hides AI-unavailable badge when hasApiKey=true', () => {
    renderRibbon({ hasApiKey: true });
    expect(screen.queryByText('AI unavailable')).toBeNull();
  });

  it('calls handleApiKeyHelp when AI badge is clicked', () => {
    const handleApiKeyHelp = vi.fn();
    renderRibbon({ hasApiKey: false, handleApiKeyHelp });
    fireEvent.click(screen.getByText('AI unavailable'));
    expect(handleApiKeyHelp).toHaveBeenCalledOnce();
  });

  it('opens menu panel on burger click', () => {
    renderRibbon();
    expect(screen.queryByTestId('ribbon-menu-panel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open main menu' }));
    expect(screen.getByTestId('ribbon-menu-panel')).toBeDefined();
  });

  it('closes menu panel on second burger click', () => {
    renderRibbon();
    const burger = screen.getByRole('button', { name: 'Open main menu' });
    fireEvent.click(burger);
    fireEvent.click(burger);
    expect(screen.queryByTestId('ribbon-menu-panel')).toBeNull();
  });

  it('calls openKeyboardShortcuts on keyboard button click', () => {
    renderRibbon();
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(mockOpenKeyboardShortcuts).toHaveBeenCalledOnce();
  });

  it('invokes the voice assistant when the microphone control is clicked', () => {
    renderRibbon();
    fireEvent.click(screen.getByRole('button', { name: 'Voice assistant' }));
    expect(mockInvokeVoiceAssistant).toHaveBeenCalledOnce();
  });

  it('toggles left panel open', () => {
    renderRibbon();
    fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));
    expect(mockSetIsLeftPanelOpen).toHaveBeenCalledWith(true);
  });

  it('toggles structure panel and clears selection', () => {
    renderRibbon();
    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }));
    expect(mockClearSelection).toHaveBeenCalled();
    expect(mockSetIsStructureOpen).toHaveBeenCalledWith(true);
  });

  it('shows processing indicator when isGenerating=true', () => {
    mockIsGenerating = true;
    renderRibbon();
    expect(screen.getByLabelText('Processing')).toBeDefined();
  });

  it('shows processing indicator when isAnalyzing=true', () => {
    mockIsAnalyzing = true;
    renderRibbon();
    expect(screen.getByLabelText('Processing')).toBeDefined();
  });

  it('switches to the Musical tab when Send to LYRIA is clicked', () => {
    mockMusicalPrompt = 'a beautiful afro-pop ballad';
    renderRibbon();

    fireEvent.click(screen.getByRole('button', { name: 'Send to LYRIA' }));

    expect(mockSetActiveTab).toHaveBeenCalledWith('musical');
  });

  it('uses a distinct confirmation tooltip after Send to LYRIA', () => {
    renderRibbon();

    fireEvent.click(screen.getByRole('button', { name: 'Send to LYRIA' }));

    expect(screen.getByTitle('Opening Musical…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send to LYRIA' })).toBeDisabled();
  });
});
