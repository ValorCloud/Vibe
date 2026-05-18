import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSongHistoryState } from '../useSongHistoryState';
import type { Section } from '../../types';

const makeSection = (id: string, name: string): Section => ({
  id,
  name,
  lines: [],
});

const S1 = makeSection('s1', 'Verse 1');
const S2 = makeSection('s2', 'Chorus');
const S3 = makeSection('s3', 'Bridge');

describe('useSongHistoryState', () => {
  it('initialises with provided song and structure', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1, S2], ['Verse 1', 'Chorus'])
    );
    expect(result.current.song).toHaveLength(2);
    expect(result.current.structure).toEqual(['Verse 1', 'Chorus']);
    expect(result.current.past).toHaveLength(0);
    expect(result.current.future).toHaveLength(0);
  });

  it('updateSongWithHistory pushes to past and clears future', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.updateSongWithHistory([S1, S2]));
    expect(result.current.song).toHaveLength(2);
    expect(result.current.past).toHaveLength(1);
    expect(result.current.future).toHaveLength(0);
  });

  it('undo restores previous state', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.updateSongWithHistory([S1, S2]));
    act(() => result.current.undo());
    expect(result.current.song).toHaveLength(1);
    expect(result.current.past).toHaveLength(0);
    expect(result.current.future).toHaveLength(1);
  });

  it('redo re-applies undone state', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.updateSongWithHistory([S1, S2]));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.song).toHaveLength(2);
    expect(result.current.future).toHaveLength(0);
  });

  it('undo is a no-op when past is empty', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.undo());
    expect(result.current.song).toHaveLength(1);
    expect(result.current.past).toHaveLength(0);
  });

  it('redo is a no-op when future is empty', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.redo());
    expect(result.current.future).toHaveLength(0);
  });

  it('new update after undo clears future', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.updateSongWithHistory([S1, S2]));
    act(() => result.current.undo());
    act(() => result.current.updateSongWithHistory([S1, S3]));
    expect(result.current.song[1]?.id).toBe('s3');
    expect(result.current.future).toHaveLength(0);
  });

  it('replaceStateWithoutHistory does not push to past', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.replaceStateWithoutHistory([S1, S2], ['Verse 1', 'Chorus']));
    expect(result.current.past).toHaveLength(0);
    expect(result.current.song).toHaveLength(2);
  });

  it('clearHistory empties past and future', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.updateSongWithHistory([S1, S2]));
    act(() => result.current.undo());
    act(() => result.current.clearHistory());
    expect(result.current.past).toHaveLength(0);
    expect(result.current.future).toHaveLength(0);
  });

  it('updateSongAndStructureWithHistory updates both atomically', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() =>
      result.current.updateSongAndStructureWithHistory([S1, S2], ['Verse 1', 'Chorus'])
    );
    expect(result.current.song).toHaveLength(2);
    expect(result.current.structure).toEqual(['Verse 1', 'Chorus']);
    expect(result.current.past).toHaveLength(1);
  });

  it('normalises section names on insert', () => {
    const dirty = makeSection('s4', '  Verse 2  ');
    const { result } = renderHook(() =>
      useSongHistoryState([dirty], ['  Verse 2  '])
    );
    expect(result.current.song[0]?.name).toBe('Verse 2');
    expect(result.current.structure[0]).toBe('Verse 2');
  });

  it('normalises legacy loaded lines with missing ids and stale meta flags', () => {
    const legacySong = [{
      id: '',
      name: ' Intro ',
      lines: [
        {
          id: '',
          text: '[Haunting] Cold stone towers piercing through the grey mist',
          rhymingSyllables: 'mist',
          rhyme: '',
          syllables: 10,
          concept: 'intro',
          isMeta: true,
        },
        {
          id: '',
          text: '[Harmonica answer]',
          rhymingSyllables: '',
          rhyme: '',
          syllables: 0,
          concept: '',
          isMeta: false,
        },
      ],
    }] as Section[];

    const { result } = renderHook(() =>
      useSongHistoryState(legacySong, [' Intro '])
    );

    expect(result.current.song[0]?.id).toBeTruthy();
    expect(result.current.song[0]?.name).toBe('Intro');
    expect(result.current.song[0]?.lines[0]?.id).toBeTruthy();
    expect(result.current.song[0]?.lines[0]?.isMeta).toBe(false);
    expect(result.current.song[0]?.lines[0]?.concept).toBe('intro');
    expect(result.current.song[0]?.lines[1]?.isMeta).toBe(true);
    expect(result.current.song[0]?.lines[1]?.concept).toBe('');
  });

  it('updateStructureWithHistory updates only structure and preserves song', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1, S2], ['Verse 1', 'Chorus'])
    );
    act(() => result.current.updateStructureWithHistory(['Chorus', 'Verse 1']));
    expect(result.current.structure).toEqual(['Chorus', 'Verse 1']);
    expect(result.current.song).toHaveLength(2);
    expect(result.current.past).toHaveLength(1);
  });

  it('updateState with recipe function updates both song and structure', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.updateState((current) => ({
      song: [...current.song, S2],
      structure: [...current.structure, 'Chorus'],
    })));
    expect(result.current.song).toHaveLength(2);
    expect(result.current.structure).toEqual(['Verse 1', 'Chorus']);
    expect(result.current.past).toHaveLength(1);
  });

  it('ignores duplicate updates that result in identical fingerprint', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.updateSongWithHistory([S1]));
    expect(result.current.past).toHaveLength(0);
  });

  it('caps history at MAX_HISTORY entries', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    // Add 52 updates (exceeds MAX_HISTORY of 50)
    for (let i = 0; i < 52; i++) {
      act(() => result.current.updateSongWithHistory([
        ...result.current.song,
        makeSection(`s${i + 10}`, `Section ${i}`),
      ]));
    }
    expect(result.current.past.length).toBeLessThanOrEqual(50);
  });

  it('handles empty initial state', () => {
    const { result } = renderHook(() => useSongHistoryState([], []));
    expect(result.current.song).toEqual([]);
    expect(result.current.structure).toEqual([]);
    expect(result.current.past).toHaveLength(0);
    expect(result.current.future).toHaveLength(0);
  });

  it('applySnapshot respects trackHistory option', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );
    act(() => result.current.updateSongWithHistory([S1, S2]));
    expect(result.current.past).toHaveLength(1);

    // replaceStateWithoutHistory uses applySnapshot with trackHistory: false,
    // which resets the full history (past and future are cleared) so callers
    // always start from a clean undo stack after a silent replacement.
    act(() => result.current.replaceStateWithoutHistory([S1, S2, S3], ['Verse 1', 'Chorus', 'Bridge']));
    expect(result.current.past).toHaveLength(0);
    expect(result.current.song).toHaveLength(3);
  });

  it('handles sections with lines correctly', () => {
    const sectionWithLines: Section = {
      id: 's1',
      name: 'Verse 1',
      lines: [
        {
          id: 'l1',
          text: 'Hello world',
          rhymingSyllables: 'world',
          rhyme: 'A',
          syllables: 3,
          concept: 'greeting',
          isMeta: false,
        },
      ],
    };
    const { result } = renderHook(() =>
      useSongHistoryState([sectionWithLines], ['Verse 1'])
    );
    expect(result.current.song[0]?.lines).toHaveLength(1);
    expect(result.current.song[0]?.lines[0]?.text).toBe('Hello world');
  });

  it('generates IDs for sections and lines missing them', () => {
    const sectionNoId = {
      id: '',
      name: 'Test',
      lines: [
        {
          id: '',
          text: 'line 1',
          rhymingSyllables: '',
          rhyme: '',
          syllables: 2,
          concept: 'test',
          isMeta: false,
        },
      ],
    } as Section;

    const { result } = renderHook(() =>
      useSongHistoryState([sectionNoId], ['Test'])
    );

    expect(result.current.song[0]?.id).not.toBe('');
    expect(result.current.song[0]?.lines[0]?.id).not.toBe('');
  });

  it('defaults missing line properties to safe values', () => {
    const incompleteSection = {
      id: 's1',
      name: 'Test',
      lines: [
        {
          id: 'l1',
          text: undefined,
        } as any,
      ],
    } as Section;

    const { result } = renderHook(() =>
      useSongHistoryState([incompleteSection], ['Test'])
    );

    const line = result.current.song[0]?.lines[0];
    expect(line?.text).toBe('');
    expect(line?.rhymingSyllables).toBe('');
    expect(line?.rhyme).toBe('');
    expect(line?.syllables).toBe(0);
  });
});

// ─── undo / redo + meta ────────────────────────────────────────────────────────

const makeMeta = (title: string) => ({
  title,
  titleOrigin: 'user' as const,
  topic: 'test-topic',
  mood: 'happy',
  rhymeScheme: 'AABB',
  targetSyllables: 8,
  genre: 'pop',
  tempo: 120,
  instrumentation: 'guitar',
  rhythm: '4/4',
  narrative: 'story',
  musicalPrompt: '',
});

describe('useSongHistoryState — undo/redo with meta', () => {
  it('undo calls all metaSetters when previous snapshot carries meta', () => {
    const setTitle = vi.fn();
    const setTitleOrigin = vi.fn();
    const setTopic = vi.fn();
    const setMood = vi.fn();
    const metaSetters = {
      setTitle, setTitleOrigin, setTopic, setMood,
      setRhymeScheme: vi.fn(),
      setTargetSyllables: vi.fn(),
      setGenre: vi.fn(),
      setTempo: vi.fn(),
      setInstrumentation: vi.fn(),
      setRhythm: vi.fn(),
      setNarrative: vi.fn(),
      setMusicalPrompt: vi.fn(),
    };

    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'], metaSetters)
    );

    const prevMeta = makeMeta('Old Song');

    // Simulate a navigation (new-song) that pushes a snapshot with meta
    act(() => result.current.navigateWithHistory([S2], ['Chorus'], prevMeta));

    // Undo should restore the previous snapshot and call metaSetters
    act(() => result.current.undo());

    expect(result.current.song).toHaveLength(1);
    expect(setTitle).toHaveBeenCalledWith('Old Song');
    expect(setTitleOrigin).toHaveBeenCalledWith('user');
    expect(setTopic).toHaveBeenCalledWith('test-topic');
    expect(setMood).toHaveBeenCalledWith('happy');
  });

  it('undo does not call metaSetters when previous snapshot has no meta', () => {
    const setTitle = vi.fn();
    const metaSetters = {
      setTitle,
      setTitleOrigin: vi.fn(),
      setTopic: vi.fn(),
      setMood: vi.fn(),
      setRhymeScheme: vi.fn(),
      setTargetSyllables: vi.fn(),
      setGenre: vi.fn(),
      setTempo: vi.fn(),
      setInstrumentation: vi.fn(),
      setRhythm: vi.fn(),
      setNarrative: vi.fn(),
      setMusicalPrompt: vi.fn(),
    };

    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'], metaSetters)
    );

    // Regular song update — no meta in the snapshot
    act(() => result.current.updateSongWithHistory([S1, S2]));
    act(() => result.current.undo());

    expect(setTitle).not.toHaveBeenCalled();
  });

  it('undo is safe when metaSetters are not provided and snapshot has meta', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );

    const prevMeta = makeMeta('No Crash');

    // navigateWithHistory stores meta; undo should not throw even without metaSetters
    act(() => result.current.navigateWithHistory([S2], ['Chorus'], prevMeta));
    expect(() => act(() => result.current.undo())).not.toThrow();
    expect(result.current.song).toHaveLength(1);
  });

  it('redo does not call metaSetters for non-navigation future snapshots', () => {
    const setTitle = vi.fn();
    const metaSetters = {
      setTitle,
      setTitleOrigin: vi.fn(),
      setTopic: vi.fn(),
      setMood: vi.fn(),
      setRhymeScheme: vi.fn(),
      setTargetSyllables: vi.fn(),
      setGenre: vi.fn(),
      setTempo: vi.fn(),
      setInstrumentation: vi.fn(),
      setRhythm: vi.fn(),
      setNarrative: vi.fn(),
      setMusicalPrompt: vi.fn(),
    };

    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'], metaSetters)
    );

    const prevMeta = makeMeta('Redo Song');
    act(() => result.current.navigateWithHistory([S2], ['Chorus'], prevMeta));

    // undo: restores [S1], pushes {song:[S2]} (no meta) to future
    act(() => result.current.undo());
    setTitle.mockClear();

    // redo: future snapshot has no meta — setTitle must NOT be called
    act(() => result.current.redo());
    expect(setTitle).not.toHaveBeenCalled();
    expect(result.current.song).toHaveLength(1);
  });

  it('future stack is capped at MAX_HISTORY after many undos', () => {
    const { result } = renderHook(() =>
      useSongHistoryState([S1], ['Verse 1'])
    );

    // Build up 55 history entries (exceeds MAX_HISTORY of 50)
    for (let i = 0; i < 55; i++) {
      act(() => result.current.updateSongWithHistory([
        ...result.current.song,
        makeSection(`extra${i}`, `Extra ${i}`),
      ]));
    }

    // Undo all available entries — future should be capped at MAX_HISTORY (50)
    for (let i = 0; i < 55; i++) {
      act(() => result.current.undo());
    }

    expect(result.current.future.length).toBeLessThanOrEqual(50);
  });
});
