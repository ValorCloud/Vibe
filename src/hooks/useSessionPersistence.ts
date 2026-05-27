import { useEffect, useRef } from 'react';
import { Section } from '../types';
import { cleanSectionName, normalizeLoadedSection } from '../utils/songUtils';
import { DEFAULT_STRUCTURE } from '../constants/editor';
import { safeSetItem, safeGetItem, safeRemoveItem } from '../utils/safeStorage';
import { isPristineDraft } from '../utils/songDefaults';
import { useSongContext } from '../contexts/SongContext';
import { SessionSchema } from '../schemas/sessionSchema';
import { logger } from '../utils/logger';

/** Debounce delay for session persistence writes (ms). */
const SAVE_DEBOUNCE_MS = 500;

interface UseSessionPersistenceParams {
  isSessionHydrated: boolean;
  setIsSessionHydrated: (v: boolean) => void;
  setHasSavedSession: (v: boolean) => void;
}

/**
 * Normalize a raw section from Zod passthrough output to Section.
 * SectionSchema uses .passthrough() so its inferred type is objectOutputType,
 * not Section — toRecord bridges the gap without an unsafe cast.
 */
const toRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizeStoredSection = (s: unknown): Section => normalizeLoadedSection(toRecord(s));

export function useSessionPersistence(params: UseSessionPersistenceParams): void {
  const {
    isSessionHydrated, setIsSessionHydrated, setHasSavedSession,
  } = params;
  const {
    song, structure, title, titleOrigin, topic, mood, rhymeScheme, targetSyllables,
    genre, tempo, instrumentation, rhythm, narrative, musicalPrompt, songLanguage,
    replaceStateWithoutHistory, clearHistory,
    setTitle, setTitleOrigin, setTopic, setMood, setRhymeScheme, setTargetSyllables,
    setGenre, setTempo, setInstrumentation, setRhythm, setNarrative, setMusicalPrompt,
    setSongLanguage,
  } = useSongContext();

  // Mount-only: hydrate state from localStorage.
  useEffect(() => {
    const savedRaw = safeGetItem('lyricist_session');
    if (savedRaw) {
      try {
        const rawParsed: unknown = JSON.parse(savedRaw);
        const result = SessionSchema.safeParse(rawParsed);

        if (!result.success) {
          // Schema validation failed — session is corrupted or from an
          // incompatible version. Purge the persisted blob so we don't
          // retry the same corrupted payload on every reload.
          if (import.meta.env.DEV) {
            logger.warn('[useSessionPersistence] Invalid session schema:', result.error.flatten());
          }
          safeRemoveItem('lyricist_session');
        } else {
          const parsed = result.data;

          // Guard: parsed.song must be a non-empty array before mapping.
          if (Array.isArray(parsed.song) && parsed.song.length > 0) {
            setHasSavedSession(true);
            // P5: normalizeStoredSection accepts unknown (Zod passthrough output)
            // via toRecord — no unsafe cast needed.
            const cleanedSong: Section[] = parsed.song.map(normalizeStoredSection);
            const nextStructure = cleanedSong.length > 0
              ? cleanedSong.map((s: Section) => s.name)
              : (parsed.structure
                ? parsed.structure.map((s: string) => cleanSectionName(s))
                : DEFAULT_STRUCTURE);
            replaceStateWithoutHistory(cleanedSong, nextStructure);

            if (parsed.title !== undefined)           setTitle(parsed.title);
            if (parsed.titleOrigin !== undefined)     setTitleOrigin(parsed.titleOrigin);
            if (parsed.topic !== undefined)            setTopic(parsed.topic);
            if (parsed.mood !== undefined)             setMood(parsed.mood);
            if (parsed.rhymeScheme !== undefined)     setRhymeScheme(parsed.rhymeScheme);
            if (parsed.targetSyllables !== undefined) setTargetSyllables(parsed.targetSyllables);
            if (parsed.genre !== undefined)            setGenre(parsed.genre);
            if (parsed.tempo !== undefined)            setTempo(parseInt(String(parsed.tempo), 10) || 120);
            if (parsed.instrumentation !== undefined) setInstrumentation(parsed.instrumentation);
            if (parsed.rhythm !== undefined)           setRhythm(parsed.rhythm);
            if (parsed.narrative !== undefined)        setNarrative(parsed.narrative);
            if (parsed.musicalPrompt !== undefined)   setMusicalPrompt(parsed.musicalPrompt);
            if (parsed.songLanguage !== undefined)    setSongLanguage(parsed.songLanguage);
            clearHistory();
          }
        }
      } catch (e) {
        logger.error('[useSessionPersistence] Failed to parse saved session', e);
        // Corrupted JSON — remove so subsequent loads start fresh instead of
        // looping the same parse error.
        safeRemoveItem('lyricist_session');
      }
    }
    setIsSessionHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only; all refs are stable dispatchers

  // Debounced save: avoid serialising the full song on every keystroke.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSessionHydrated || song.length === 0 || isPristineDraft(song, structure, rhymeScheme)) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const sessionData = {
        song, structure, title, titleOrigin, topic, mood, rhymeScheme, targetSyllables,
        genre, tempo, instrumentation, rhythm, narrative, musicalPrompt, songLanguage,
      };
      safeSetItem('lyricist_session', JSON.stringify(sessionData));
      setHasSavedSession(true);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    song, structure, title, titleOrigin, topic, mood, rhymeScheme, targetSyllables,
    genre, tempo, instrumentation, rhythm, narrative, musicalPrompt, songLanguage,
    isSessionHydrated, setHasSavedSession,
  ]);
}
