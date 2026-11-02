import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSessionAutoSave } from '../useSessionAutoSave';

const save = vi.hoisted(() => vi.fn());
vi.mock('../../lib/sessionPersistence', () => ({ saveSession: save }));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn() } }));
const payload = () => ({ song: [], structure: [], title: 'draft', titleOrigin: 'user' as const,
  topic: '', mood: '', rhymeScheme: '', targetSyllables: 8, songLanguage: 'en', genre: '', tempo: 120,
  songDurationSeconds: 180, timeSignature: [4, 4] as [number, number], instrumentation: '', rhythm: '',
  narrative: '', musicalPrompt: '', versions: [], sectionVersions: {}, activeTab: 'lyrics' as const,
  isStructureOpen: true, isLeftPanelOpen: true, onSaved: vi.fn() });
beforeEach(() => { vi.useFakeTimers(); save.mockReset(); });
afterEach(() => vi.useRealTimers());

it('reports storage errors without losing the draft or announcing saved', async () => {
  save.mockRejectedValue(new Error('disk full'));
  const draft = payload();
  const { result } = renderHook(() => useSessionAutoSave(draft));
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(result.current).toEqual({ saveStatus: 'error', lastSavedAt: null });
  expect(draft.onSaved).not.toHaveBeenCalled();
  expect(draft.title).toBe('draft');
});
it('does not mark a newer edit saved when an older write finishes', async () => {
  let release!: () => void;
  save.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  const draft = payload();
  const { result, rerender } = renderHook(value => useSessionAutoSave(value), { initialProps: draft });
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(result.current.saveStatus).toBe('saving');
  rerender({ ...draft, title: 'new edit' });
  await act(async () => release());
  expect(result.current).toEqual({ saveStatus: 'unsaved', lastSavedAt: null });
  save.mockResolvedValue(undefined);
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(result.current.saveStatus).toBe('saved');
  expect(draft.onSaved).toHaveBeenCalledOnce();
});
it('notifies successful persistence once and ignores completions after unmount', async () => {
  save.mockResolvedValue(undefined);
  const draft = payload();
  const { rerender, unmount } = renderHook(value => useSessionAutoSave(value), { initialProps: draft });
  await act(() => vi.advanceTimersByTimeAsync(2000));
  rerender({ ...draft, title: 'second' });
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(draft.onSaved).toHaveBeenCalledOnce();
  let release!: () => void;
  save.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  rerender({ ...draft, title: 'third' });
  await act(() => vi.advanceTimersByTimeAsync(2000));
  unmount(); await act(async () => release());
  expect(draft.onSaved).toHaveBeenCalledOnce();
});
