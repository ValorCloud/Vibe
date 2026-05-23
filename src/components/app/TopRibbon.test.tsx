import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TopRibbon } from './TopRibbon';

// ── Mutable state refs — mutated per-test, read by the mock factory ──────────
let mockPast: unknown[] = [];
let mockFuture: unknown[] = [];
let mockIsGenerating = false;
let mockIsAnalyzing = false;
let mockIsLeftPanelOpen = false;
let mockIsStructureOpen = false;
let mockActiveTab: 'lyrics' | 'musical' | 'player' = 'lyrics';
let mockMusicalPrompt = '';

const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockClearSelection = vi.fn();
const mockSetActiveTab = vi.fn();
const mockSetIsLeftPanelOpen = vi.fn();
const mockSetIsStructureOpen = vi.fn();
const mockOpenKeyboardShortcuts = vi.fn();
const mockCopyToClipboard = vi.fn(() => Promise.resolve(true));

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
    activeTab: mockActiveTab,
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

vi.mock('../../utils/clipboard', () => ({
  copyToClipboard: (text: string) => mockCopyToClipboard(text),
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
        playerSidebarDisabled: 'Sidebar is disabled in Player mode',
        sendToLyria: 'Open the Musical tab to generate a preview with Lyria',
        sendToLyriaConfirm: 'Opening Musical…',
        quantizeLineDone: 'Line quantized',
        copyMusicalPrompt: 'Copy musical prompt',
        copyMusicalPromptConfirm: 'Musical prompt copied to clipboard',
      },
      ribbon: {
        aiUnavailable: 'AI unavailable',
        send_to_lyria: 'Send to LYRIA',
        copy_lyrics: 'Copy Lyrics',
        copy_musical_prompt: 'Copy Musical Prompt',
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
    mockActiveTab = 'lyrics';
    mockIsLeftPanelOpen = false;
    mockIsStructureOpen = false;
    mockCopyToClipboard.mockClear();
    mockCopyToClipboard.mockResolvedValue(true);
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

  it('disables the structure panel button in player mode', () => {
    mockActiveTab = 'player';
    renderRibbon();
    const button = screen.getByRole('button', { name: 'Sidebar is disabled in Player mode' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mockClearSelection).not.toHaveBeenCalled();
    expect(mockSetIsStructureOpen).not.toHaveBeenCalled();
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


  it('shows Copy Musical Prompt button only in musical mode', () => {
    renderRibbon();
    expect(screen.queryByRole('button', { name: 'Copy Musical Prompt' })).toBeNull();

    mockActiveTab = 'musical';
    mockMusicalPrompt = 'STYLE: synth pop';
    renderRibbon();
    expect(screen.getByRole('button', { name: 'Copy Musical Prompt' })).toBeEnabled();
  });

  it('disables Copy Musical Prompt when the prompt is empty', () => {
    mockActiveTab = 'musical';
    mockMusicalPrompt = '';
    renderRibbon();
    expect(screen.getByRole('button', { name: 'Copy Musical Prompt' })).toBeDisabled();
  });

  it('copies the musical prompt from the top ribbon', async () => {
    mockActiveTab = 'musical';
    mockMusicalPrompt = 'STYLE: dark ambient';
    renderRibbon();

    fireEvent.click(screen.getByRole('button', { name: 'Copy Musical Prompt' }));

    await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalledWith('STYLE: dark ambient'));
  });

  // NOTE: "Send to LYRIA" button was removed from TopRibbon per UX decision
  // (commit 9e6d8e8, v1.31.0.34). The corresponding tests were removed alongside it.
});
