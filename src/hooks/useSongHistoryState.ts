import { useCallback, useState } from 'react';
import type { Section } from '../types';
import { generateId } from '../utils/idUtils';
import { isPureMetaLine } from '../utils/metaUtils';
import { cleanSectionName } from '../utils/songUtils';

const MAX_HISTORY = 50;

export type SongMeta = {
  title: string;
  titleOrigin: 'user' | 'ai';
  topic: string;
  mood: string;
  rhymeScheme: string;
  targetSyllables: number;
  genre: string;
  tempo: number;
  instrumentation: string;
  rhythm: string;
  narrative: string;
  musicalPrompt: string;
};

type SongMetaSetters = {
  setTitle: (value: string) => void;
  setTitleOrigin: (value: SongMeta['titleOrigin']) => void;
  setTopic: (value: string) => void;
  setMood: (value: string) => void;
  setRhymeScheme: (value: string) => void;
  setTargetSyllables: (value: number) => void;
  setGenre: (value: string) => void;
  setTempo: (value: number) => void;
  setInstrumentation: (value: string) => void;
  setRhythm: (value: string) => void;
  setNarrative: (value: string) => void;
  setMusicalPrompt: (value: string) => void;
};

type SongMetaRestorer = ((meta: SongMeta) => void) | SongMetaSetters;

type SongHistorySnapshot = {
  song: Section[];
  structure: string[];
  /** Present only on snapshots created by navigation actions (New Song, Load Song). */
  meta?: SongMeta;
};

export type UpdateSongAndStructureWithHistory = (
  newSong: Section[],
  newStructure: string[],
) => void;

type SongHistoryState = SongHistorySnapshot & {
  past: SongHistorySnapshot[];
  future: SongHistorySnapshot[];
};

const cleanSong = (song: Section[]): Section[] => song.map((section) => ({
  ...section,
  id: section.id || generateId(),
  name: cleanSectionName(section.name),
  lines: (section.lines ?? []).map((line) => {
    const text = line.text ?? '';
    const isMeta = isPureMetaLine(text);
    return {
      ...line,
      id: line.id || generateId(),
      text,
      rhymingSyllables: line.rhymingSyllables ?? '',
      rhyme: line.rhyme ?? '',
      syllables: typeof line.syllables === 'number' ? line.syllables : 0,
      concept: line.concept ?? (isMeta ? 'Meta' : 'New line'),
      isMeta,
    };
  }),
}));

const cleanStructure = (structure: string[]): string[] =>
  structure.map(name => cleanSectionName(name));

const normalizeSnapshot = (snapshot: SongHistorySnapshot): SongHistorySnapshot => ({
  song: cleanSong(snapshot.song),
  structure: cleanStructure(snapshot.structure),
  ...(snapshot.meta ? { meta: snapshot.meta } : {}),
});

const cappedPast = (past: SongHistorySnapshot[]): SongHistorySnapshot[] =>
  past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past;

const cappedFuture = (future: SongHistorySnapshot[]): SongHistorySnapshot[] =>
  future.length > MAX_HISTORY ? future.slice(0, MAX_HISTORY) : future;

// ─── Delta helpers ────────────────────────────────────────────────────────────

const sectionFingerprint = (s: Section): string => {
  const lines = s.lines ?? [];
  const lineCount = lines.length;
  const lineDigest = lines.map(l => `${l.id}:${l.text}:${l.syllables}`).join('|');
  return `${s.id}:${s.name}:${lineCount}:${lineDigest}`;
};

const snapshotFingerprint = (snap: SongHistorySnapshot): string => {
  const sectionCount = snap.song.length;
  const structureKey = snap.structure.join(',');
  const songKey = snap.song.map(sectionFingerprint).join('//');
  return `${sectionCount}|${structureKey}||${songKey}`;
};

export const useSongHistoryState = (
  initialSong: Section[] = [],
  initialStructure: string[] = [],
  onMetaRestore?: SongMetaRestorer,
) => {
  const [state, setState] = useState<SongHistoryState>(() => ({
    ...normalizeSnapshot({ song: initialSong, structure: initialStructure }),
    past: [],
    future: [],
  }));

  const applySnapshot = useCallback((nextSnapshot: SongHistorySnapshot, options?: { trackHistory?: boolean }) => {
    const normalizedNext = normalizeSnapshot(nextSnapshot);
    setState(current => {
      if (options?.trackHistory === false) {
        return {
          song: normalizedNext.song,
          structure: normalizedNext.structure,
          past: [],
          future: [],
        };
      }
      const currentFp = snapshotFingerprint({ song: current.song, structure: current.structure });
      const nextFp = snapshotFingerprint(normalizedNext);
      if (currentFp === nextFp) return current;
      return {
        song: normalizedNext.song,
        structure: normalizedNext.structure,
        past: cappedPast([...current.past, { song: current.song, structure: current.structure }]),
        future: [],
      };
    });
  }, []);

  const updateState = useCallback((recipe: (current: SongHistorySnapshot) => SongHistorySnapshot) => {
    setState(current => {
      const nextSnapshot = normalizeSnapshot(recipe({ song: current.song, structure: current.structure }));
      const currentFp = snapshotFingerprint({ song: current.song, structure: current.structure });
      const nextFp = snapshotFingerprint(nextSnapshot);
      if (currentFp === nextFp) return current;
      return {
        song: nextSnapshot.song,
        structure: nextSnapshot.structure,
        past: cappedPast([...current.past, { song: current.song, structure: current.structure }]),
        future: [],
      };
    });
  }, []);

  const updateSongWithHistory = useCallback((newSong: Section[]) => {
    updateState(current => ({ song: newSong, structure: current.structure }));
  }, [updateState]);

  const updateStructureWithHistory = useCallback((newStructure: string[]) => {
    updateState(current => ({ song: current.song, structure: newStructure }));
  }, [updateState]);

  const updateSongAndStructureWithHistory: UpdateSongAndStructureWithHistory = useCallback((newSong, newStructure) => {
    updateState(() => ({ song: newSong, structure: newStructure }));
  }, [updateState]);

  /**
   * Push a navigation snapshot (song + structure + meta) into history,
   * then replace current state with the new snapshot.
   * Used by New Song / Load Song so that Undo restores the previous song
   * including its metadata, and Redo returns to the new state.
   */
  const navigateWithHistory = useCallback((
    newSong: Section[],
    newStructure: string[],
    currentMeta: SongMeta,
  ) => {
    const normalizedNew = normalizeSnapshot({ song: newSong, structure: newStructure });
    setState(current => {
      const currentFp = snapshotFingerprint({ song: current.song, structure: current.structure });
      const nextFp = snapshotFingerprint(normalizedNew);
      if (currentFp === nextFp) return current;
      return {
        song: normalizedNew.song,
        structure: normalizedNew.structure,
        past: cappedPast([
          ...current.past,
          { song: current.song, structure: current.structure, meta: currentMeta },
        ]),
        future: [],
      };
    });
  }, []);

  const replaceStateWithoutHistory = useCallback((newSong: Section[], newStructure: string[]) => {
    applySnapshot({ song: newSong, structure: newStructure }, { trackHistory: false });
  }, [applySnapshot]);

  const clearHistory = useCallback(() => {
    setState(current => ({ ...current, past: [], future: [] }));
  }, []);

  const applyMeta = useCallback((meta: SongMeta) => {
    if (!onMetaRestore) return;
    if (!('setTitle' in onMetaRestore)) {
      onMetaRestore(meta);
      return;
    }

    onMetaRestore.setTitle(meta.title);
    onMetaRestore.setTitleOrigin(meta.titleOrigin);
    onMetaRestore.setTopic(meta.topic);
    onMetaRestore.setMood(meta.mood);
    onMetaRestore.setRhymeScheme(meta.rhymeScheme);
    onMetaRestore.setTargetSyllables(meta.targetSyllables);
    onMetaRestore.setGenre(meta.genre);
    onMetaRestore.setTempo(meta.tempo);
    onMetaRestore.setInstrumentation(meta.instrumentation);
    onMetaRestore.setRhythm(meta.rhythm);
    onMetaRestore.setNarrative(meta.narrative);
    onMetaRestore.setMusicalPrompt(meta.musicalPrompt);
  }, [onMetaRestore]);

  const undo = useCallback(() => {
    setState(current => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      if (!previous) return current;
      if (previous.meta) applyMeta(previous.meta);
      return {
        song: previous.song,
        structure: previous.structure,
        past: current.past.slice(0, -1),
        future: cappedFuture([{ song: current.song, structure: current.structure }, ...current.future]),
      };
    });
  }, [applyMeta]);

  const redo = useCallback(() => {
    setState(current => {
      if (current.future.length === 0) return current;
      const next = current.future[0];
      if (!next) return current;
      if (next.meta) applyMeta(next.meta);
      return {
        song: next.song,
        structure: next.structure,
        past: cappedPast([...current.past, { song: current.song, structure: current.structure }]),
        future: current.future.slice(1),
      };
    });
  }, [applyMeta]);

  return {
    song: state.song,
    structure: state.structure,
    past: state.past,
    future: state.future,
    updateState,
    updateSongWithHistory,
    updateStructureWithHistory,
    updateSongAndStructureWithHistory,
    navigateWithHistory,
    replaceStateWithoutHistory,
    clearHistory,
    undo,
    redo,
  };
};
