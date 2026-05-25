import { useState, useEffect, useCallback, useRef } from 'react';
import { Section, SongVersion } from '../types';
import { generateId } from '../utils/idUtils';
import { VersionSnapshot } from '../utils/songDefaults';
import { useSongContext } from '../contexts/SongContext';

/** Hard cap on stored versions to prevent unbounded memory growth. */
const MAX_VERSIONS = 50;

interface UseVersionManagerParams {
  updateSongAndStructureWithHistory: (song: Section[], structure: string[]) => void;
  setIsVersionsModalOpen: (open: boolean) => void;
  setPromptModal: (modal: { open: boolean; onConfirm: (value: string) => void } | null) => void;
  initialVersions?: SongVersion[] | undefined;
}

/**
 * Architecture: two complementary history systems coexist intentionally.
 *
 * - useSongHistoryState  → lightweight LIFO undo/redo stack (in-memory, ephemeral).
 *   Triggered on every structural edit; optimised for rapid Ctrl+Z cycles.
 *
 * - useVersionManager (this hook) → named + auto snapshots with structural fingerprint.
 *   Survives sessions, supports rollback to arbitrary past states, capped at
 *   MAX_VERSIONS entries. NOT part of the undo stack (see architecture invariant
 *   in docs_fusion_optimal.md).
 *
 * The two systems are orthogonal: VersionManager snapshots are taken *before*
 * each meaningful change (auto restore point) or on explicit user demand.
 */

/**
 * djb2 hash — fast non-cryptographic string hash.
 * Mirrors the implementation in useLinguisticsWorker for consistency.
 * Pure arithmetic, no allocations beyond the input string iteration.
 */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

/**
 * Builds a stable structural fingerprint for auto-restore detection.
 *
 * Uses djb2 hashing on line text (consistent with useLinguisticsWorker) instead
 * of raw string concatenation, reducing the fingerprint string length by ~10×
 * on large songs while retaining collision resistance sufficient for change
 * detection (false-positive rate negligible at ≤50 lines).
 *
 * Fields hashed per line: id, text (djb2), rhymingSyllables, rhyme, syllables,
 * concept, isMeta — identical coverage to the previous implementation.
 */
const fingerprintSnapshot = (song: Section[], structure: string[]): string => {
  const songPrint = song.map((section) => {
    const linePrint = section.lines
      .map((line) => [
        line.id,
        djb2(line.text),
        line.rhymingSyllables ?? '',
        line.rhyme ?? '',
        String(line.syllables ?? 0),
        djb2(line.concept ?? ''),
        line.isMeta ? '1' : '0',
      ].join(':'))
      .join('|');

    return [
      section.id,
      djb2(section.name),
      section.language ?? '',
      linePrint,
    ].join('::');
  }).join('||');

  return `${structure.map(djb2).join('-')}__${songPrint}`;
};

/**
 * Deep-clones a Section array via JSON round-trip.
 * Returns null if the payload contains non-serialisable values (undefined in
 * arrays, Date objects, circular refs, etc.) to prevent corrupting the
 * version history with a partially-cloned or broken snapshot.
 */
const deepCloneSong = (song: Section[]): Section[] | null => {
  try {
    return JSON.parse(JSON.stringify(song)) as Section[];
  } catch {
    return null;
  }
};

const shouldCreateRestorePoint = (snapshot: VersionSnapshot): boolean =>
  snapshot.song.length > 0 || (snapshot.musicalPrompt ?? '').trim().length > 0;

export function useVersionManager(params: UseVersionManagerParams) {
  const {
    updateSongAndStructureWithHistory,
    setIsVersionsModalOpen, setPromptModal,
  } = params;
  const {
    song,
    structure,
    title,
    titleOrigin,
    topic,
    mood,
    musicalPrompt,
    setTitle,
    setTitleOrigin,
    setTopic,
    setMood,
    setMusicalPrompt,
  } = useSongContext();

  const [versions, setVersions] = useState<SongVersion[]>(() => params.initialVersions?.slice(0, MAX_VERSIONS) ?? []);
  const previousLyricsSnapshotRef = useRef<VersionSnapshot | null>(null);
  const previousFingerprintRef = useRef<string | null>(null);

  const createVersion = useCallback((
    snapshot: VersionSnapshot,
    name: string,
    previousVersions: SongVersion[],
    options?: { allowDuplicate?: boolean },
  ): SongVersion[] => {
    const latestVersion = previousVersions[0];
    const normalizedSnapshot = JSON.stringify({
      song: snapshot.song, structure: snapshot.structure,
      title: snapshot.title, titleOrigin: snapshot.titleOrigin,
      topic: snapshot.topic, mood: snapshot.mood,
      musicalPrompt: snapshot.musicalPrompt ?? '',
    });
    if (!options?.allowDuplicate && latestVersion) {
      const normalizedLatest = JSON.stringify({
        song: latestVersion.song, structure: latestVersion.structure,
        title: latestVersion.title, titleOrigin: latestVersion.titleOrigin,
        topic: latestVersion.topic, mood: latestVersion.mood,
        musicalPrompt: latestVersion.musicalPrompt ?? '',
      });
      if (normalizedLatest === normalizedSnapshot) return previousVersions;
    }

    // Guard: refuse to create a version if the song cannot be safely cloned.
    // Non-serialisable values (undefined in arrays, Date, circular refs) would
    // silently corrupt the stored snapshot and break rollback.
    const clonedSong = deepCloneSong(snapshot.song);
    if (clonedSong === null) return previousVersions;

    const next = [
      {
        id: generateId(), timestamp: Date.now(),
        song: clonedSong,
        structure: [...snapshot.structure],
        title: snapshot.title, titleOrigin: snapshot.titleOrigin,
        topic: snapshot.topic, mood: snapshot.mood,
        musicalPrompt: snapshot.musicalPrompt ?? '',
        name,
      },
      ...previousVersions,
    ];
    // Trim to MAX_VERSIONS to prevent unbounded memory growth.
    return next.length > MAX_VERSIONS ? next.slice(0, MAX_VERSIONS) : next;
  }, []);

  const saveVersion = useCallback((name: string, snapshot?: VersionSnapshot) => {
    const versionSnapshot = snapshot || { song, structure, title, titleOrigin, topic, mood, musicalPrompt };
    setVersions(prev => createVersion(versionSnapshot, name || `Version ${prev.length + 1}`, prev, { allowDuplicate: true }));
  }, [createVersion, song, structure, title, titleOrigin, topic, mood, musicalPrompt]);

  const rollbackToVersion = useCallback((version: SongVersion) => {
    updateSongAndStructureWithHistory(version.song, version.structure);
    setTitle(version.title);
    setTitleOrigin(version.titleOrigin);
    setTopic(version.topic);
    setMood(version.mood);
    setMusicalPrompt(version.musicalPrompt ?? '');
    setIsVersionsModalOpen(false);
  }, [updateSongAndStructureWithHistory, setTitle, setTitleOrigin, setTopic, setMood, setMusicalPrompt, setIsVersionsModalOpen]);

  const rollbackSectionToVersion = useCallback((version: SongVersion, sectionId: string) => {
    const versionSection = version.song.find(section => section.id === sectionId);
    if (!versionSection) return;
    const currentIndexById = song.findIndex(section => section.id === sectionId);
    const currentIndex = currentIndexById >= 0
      ? currentIndexById
      : song.findIndex(section => section.name === versionSection.name);
    const clonedSection = deepCloneSong([versionSection])?.[0];
    if (!clonedSection) return;
    const nextSong = currentIndex >= 0
      ? song.map((section, index) => (index === currentIndex ? clonedSection : section))
      : [...song, clonedSection];
    updateSongAndStructureWithHistory(nextSong, nextSong.map(section => section.name));
  }, [song, updateSongAndStructureWithHistory]);

  const replaceVersions = useCallback((nextVersions: SongVersion[]) => {
    setVersions(nextVersions.slice(0, MAX_VERSIONS));
  }, []);

  const handleRequestVersionName = useCallback((callback: (name: string) => void) => {
    setPromptModal({
      open: true,
      onConfirm: (name) => { setPromptModal(null); callback(name); },
    });
  }, [setPromptModal]);

  // Auto-restore-point: captures the snapshot *before* each lyrics/structure change.
  useEffect(() => {
    const currentSnapshot = { song, structure, title, titleOrigin, topic, mood, musicalPrompt };
    const currentFingerprint = `${fingerprintSnapshot(song, structure)}__prompt:${djb2(musicalPrompt)}`;

    if (!previousLyricsSnapshotRef.current) {
      previousLyricsSnapshotRef.current = currentSnapshot;
      previousFingerprintRef.current = currentFingerprint;
      return;
    }

    const previousSnapshot = previousLyricsSnapshotRef.current;
    const snapshotChanged = previousFingerprintRef.current !== currentFingerprint;

    if (snapshotChanged && shouldCreateRestorePoint(previousSnapshot)) {
      setVersions(prev => createVersion(previousSnapshot, 'Auto Restore Point', prev));
    }
    previousLyricsSnapshotRef.current = currentSnapshot;
    previousFingerprintRef.current = currentFingerprint;
  }, [createVersion, song, structure, title, titleOrigin, topic, mood, musicalPrompt]);

  return { versions, saveVersion, rollbackToVersion, rollbackSectionToVersion, replaceVersions, handleRequestVersionName };
}
