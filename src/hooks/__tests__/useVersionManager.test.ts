/**
 * useVersionManager — behavioural tests
 *
 * Strategy: test the pure createVersion logic and the stateful hook
 * (save, rollback, auto-restore, duplicate dedup) without mounting a
 * full React tree. SongContext is mocked via vi.mock so the hook
 * receives controlled song/structure/title/topic/mood values.
 */
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Section } from '../../types';

// ── SongContext mock ──────────────────────────────────────────────────────────
const mockSongCtx = {
  song: [] as Section[],
  structure: [] as string[],
  title: 'Untitled',
  titleOrigin: 'user' as const,
  topic: '',
  mood: '',
  setTitle: vi.fn(),
  setTitleOrigin: vi.fn(),
  setTopic: vi.fn(),
  setMood: vi.fn(),
  musicalPrompt: '',
  setMusicalPrompt: vi.fn(),
};

vi.mock('../../contexts/SongContext', () => ({
  useSongContext: () => mockSongCtx,
}));

vi.mock('../../utils/idUtils', () => ({
  generateId: (() => {
    let n = 0;
    return () => `id-${++n}`;
  })(),
}));

import { useVersionManager } from '../useVersionManager';

const makeLine = (id: string, text: string) => ({
  id, text,
  rhymingSyllables: '', rhyme: '',
  syllables: 2, concept: text, isMeta: false,
});

const makeSection = (id: string, lines: string[]): Section => ({
  id, name: 'Verse', language: 'en',
  lines: lines.map((t, i) => makeLine(`${id}-${i}`, t)),
});

const makeParams = () => ({
  updateSongAndStructureWithHistory: vi.fn(),
  setIsVersionsModalOpen: vi.fn(),
  setPromptModal: vi.fn(),
});

describe('useVersionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSongCtx.song = [];
    mockSongCtx.structure = [];
    mockSongCtx.title = 'Untitled';
    mockSongCtx.titleOrigin = 'user';
    mockSongCtx.topic = '';
    mockSongCtx.mood = '';
    mockSongCtx.musicalPrompt = '';
  });

  it('starts with an empty versions list', () => {
    const { result } = renderHook(() => useVersionManager(makeParams()));
    expect(result.current.versions).toHaveLength(0);
  });

  it('saveVersion adds a version with the given name', () => {
    const { result } = renderHook(() => useVersionManager(makeParams()));
    act(() => { result.current.saveVersion('My first version'); });
    expect(result.current.versions).toHaveLength(1);
    expect(result.current.versions[0]?.name).toBe('My first version');
  });

  it('saveVersion with allowDuplicate=true does NOT deduplicate', () => {
    const { result } = renderHook(() => useVersionManager(makeParams()));
    act(() => { result.current.saveVersion('v1'); });
    act(() => { result.current.saveVersion('v2'); }); // same song state
    // Both saved (saveVersion always passes allowDuplicate: true)
    expect(result.current.versions).toHaveLength(2);
  });

  it('rollbackToVersion calls updateSongAndStructureWithHistory with versioned data', () => {
    const params = makeParams();
    const { result, rerender } = renderHook(() => useVersionManager(params));
    const section = makeSection('s1', ['Hello world']);
    act(() => {
      result.current.saveVersion('before', {
        song: [section],
        structure: ['Verse'],
        title: 'Draft',
        titleOrigin: 'user',
        topic: 'love',
        mood: 'sad',
        musicalPrompt: 'warm piano ballad',
      });
    });
    const saved = result.current.versions[0]!;
    act(() => { result.current.rollbackToVersion(saved); });
    expect(params.updateSongAndStructureWithHistory).toHaveBeenCalledWith(
      saved.song, saved.structure,
    );
    expect(mockSongCtx.setTitle).toHaveBeenCalledWith('Draft');
    expect(mockSongCtx.setTopic).toHaveBeenCalledWith('love');
    expect(mockSongCtx.setMood).toHaveBeenCalledWith('sad');
    expect(mockSongCtx.setMusicalPrompt).toHaveBeenCalledWith('warm piano ballad');
    expect(params.setIsVersionsModalOpen).toHaveBeenCalledWith(false);
  });

  it('restores one section from a saved version without replacing the full song', () => {
    const params = makeParams();
    const verse = makeSection('verse', ['Old verse']);
    const chorus = makeSection('chorus', ['Old chorus']);
    const { result, rerender } = renderHook(() => useVersionManager(params));
    act(() => {
      result.current.saveVersion('section snapshot', {
        song: [verse, chorus],
        structure: ['Verse', 'Chorus'],
        title: 'Draft',
        titleOrigin: 'user',
        topic: '',
        mood: '',
      });
    });
    mockSongCtx.song = [makeSection('verse', ['New verse']), makeSection('chorus', ['New chorus'])];
    rerender();
    act(() => {
      result.current.rollbackSectionToVersion(result.current.versions[0]!, 'chorus');
    });
    expect(params.updateSongAndStructureWithHistory).toHaveBeenCalledWith(
      [mockSongCtx.song[0], chorus],
      ['Verse', 'Verse'],
    );
  });

  it('auto-restore-point is created when song content changes', () => {
    const { result, rerender } = renderHook(() => useVersionManager(makeParams()));
    // Initial render — captures snapshot, no version yet
    expect(result.current.versions).toHaveLength(0);

    // Mutate song in context
    mockSongCtx.song = [makeSection('s1', ['New line'])];
    mockSongCtx.structure = ['Verse'];
    rerender();

    // Auto restore point should have fired for the previous (empty) snapshot
    // but only when previous song.length > 0 — so still 0 for empty→non-empty
    expect(result.current.versions).toHaveLength(0);

    // Now mutate again with a non-empty previous state
    mockSongCtx.song = [makeSection('s1', ['Changed line'])];
    rerender();
    expect(result.current.versions).toHaveLength(1);
    expect(result.current.versions[0]?.name).toBe('Auto Restore Point');
  });

  it('auto-restore-point is created when the musical prompt changes', () => {
    mockSongCtx.musicalPrompt = 'STYLE: acoustic';
    const { result, rerender } = renderHook(() => useVersionManager(makeParams()));

    mockSongCtx.musicalPrompt = 'STYLE: synthwave';
    rerender();

    expect(result.current.versions).toHaveLength(1);
    expect(result.current.versions[0]?.musicalPrompt).toBe('STYLE: acoustic');
  });

  it('handleRequestVersionName calls setPromptModal with open:true', () => {
    const params = makeParams();
    const { result } = renderHook(() => useVersionManager(params));
    const cb = vi.fn();
    act(() => { result.current.handleRequestVersionName(cb); });
    expect(params.setPromptModal).toHaveBeenCalledWith(
      expect.objectContaining({ open: true }),
    );
  });

  it('auto-restore-point does NOT fire when fingerprint is unchanged', () => {
    const section = makeSection('s1', ['Stable line']);
    mockSongCtx.song = [section];
    mockSongCtx.structure = ['Verse'];
    const { result, rerender } = renderHook(() => useVersionManager(makeParams()));
    // Rerender with identical reference → fingerprint unchanged
    rerender();
    rerender();
    // 0 auto-restore versions (only the initial capture)
    expect(result.current.versions.filter(v => v.name === 'Auto Restore Point')).toHaveLength(0);
  });
});
