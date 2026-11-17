import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '../../i18n/locales/en.json';
import { StatusBar } from './StatusBar';
import { useInterfacePreferences } from '../../hooks/useInterfacePreferences';

vi.mock('../../contexts/ComposerContext', () => ({ useComposerContext: () => ({ isGenerating: false, isSuggesting: false }) }));
vi.mock('../../hooks/useAppKpis', () => ({ useAppKpis: () => ({ sectionCount: 3, wordCount: 12, charCount: 67 }) }));
vi.mock('../../contexts/AppStateContext', () => ({ useAppNavigationContext: () => ({ activeTab: 'lyrics' }) }));
vi.mock('../../contexts/LibraryContext', () => ({ useOptionalLibraryContext: () => null }));
vi.mock('../ui/StorageGauge', () => ({ StorageGauge: () => null }));
vi.mock('../../i18n', () => ({
  useTranslation: () => ({ t: en, language: 'ui:en', setLanguage: vi.fn() }),
  stripInternalPrefix: (value: string) => value.replace('ui:', ''),
  getLanguageDisplay: () => ({ label: 'English', sign: '🇺🇸' }),
  SUPPORTED_UI_LOCALES: [{ langId: 'ui:en', code: 'en', label: 'English' }, { langId: 'ui:fr', code: 'fr', label: 'Français' }],
}));

function Harness() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [audioFeedback, setAudioFeedback] = useState(true);
  const display = useInterfacePreferences();
  return <div data-vibe-app>
    <div data-testid="workspace" style={{ zoom: display.zoom / 100 }}>Editor</div>
    <StatusBar hasApiKey={false} isAnalyzing={false} currentEditMode="markdown"
      theme={theme} setTheme={setTheme} audioFeedback={audioFeedback} setAudioFeedback={setAudioFeedback}
      zoom={display.zoom} setZoom={display.setZoom} animationsPaused={display.animationsPaused}
      setAnimationsPaused={display.setAnimationsPaused} systemReducedMotion={display.systemReducedMotion}
      onOpenAbout={() => {}} onOpenSettings={() => {}} />
  </div>;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('opens five zoom choices on mouse hover and preserves usable keyboard focus after selection and Escape', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Zoom · 100%' });
  const hover = new Event('pointerenter');
  Object.defineProperty(hover, 'pointerType', { value: 'mouse' });
  fireEvent(trigger.parentElement!, hover);
  const menu = screen.getByRole('group', { name: 'Zoom · 100%' });
  expect(within(menu).getAllByRole('button').map(button => button.textContent)).toEqual(['50%', '75%', '100%', '125%', '150%']);
  await user.click(within(menu).getByRole('button', { name: '50%' }));
  expect(screen.getByTestId('workspace').style.zoom).toBe('0.5');
  expect(localStorage.getItem('vibe_interface_zoom')).toBe('50');
  expect(trigger).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('button', { name: '50%' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it('lists only available themes and keeps pause immediately before the final interface audio command', async () => {
  const user = userEvent.setup();
  const { container } = render(<Harness />);
  const theme = screen.getByRole('button', { name: en.statusBar.theme });
  await user.click(theme);
  const menu = screen.getByRole('group', { name: en.statusBar.theme });
  expect(within(menu).getAllByRole('button').map(button => button.textContent)).toEqual([en.settings.theme.light, en.settings.theme.dark]);
  await user.click(within(menu).getByRole('button', { name: en.settings.theme.light }));
  await user.click(theme);
  expect(within(screen.getByRole('group', { name: en.statusBar.theme })).getByRole('button', { name: en.settings.theme.light })).toHaveAttribute('aria-pressed', 'true');
  await user.keyboard('{Escape}');
  const controls = container.querySelector('.vibe-status-controls')!;
  const buttons = within(controls as HTMLElement).getAllByRole('button');
  expect(buttons.at(-2)).toHaveAccessibleName(en.statusBar.pauseAnimations);
  expect(buttons.at(-1)).toHaveAccessibleName(en.tooltips.audioFeedback);
  await user.click(buttons.at(-2)!);
  expect(localStorage.getItem('vibe_animations_paused')).toBe('true');
  expect(document.documentElement.dataset.interfaceMotion).toBe('off');
  await user.click(buttons.at(-1)!);
  expect(buttons.at(-1)).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('3')).toBeInTheDocument();
});

it('targets native full screen at the whole app and preserves selected zoom after browser exit', async () => {
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: null });
  const request = vi.fn(async function (this: HTMLElement) {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: this });
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: request });
  const exit = vi.fn(async () => {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
  localStorage.setItem('vibe_interface_zoom', '125');
  const user = userEvent.setup();
  const { container } = render(<Harness />);
  await user.click(screen.getByRole('button', { name: en.statusBar.fullscreen }));
  expect(document.fullscreenElement).toBe(container.querySelector('[data-vibe-app]'));
  expect(screen.getByRole('button', { name: en.statusBar.exitFullscreen })).toHaveAttribute('aria-pressed', 'true');
  await act(exit);
  expect(screen.getByRole('button', { name: 'Zoom · 125%' })).toBeInTheDocument();
  delete (HTMLElement.prototype as Partial<HTMLElement>).requestFullscreen;
});
