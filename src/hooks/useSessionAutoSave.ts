/**
 * useSessionAutoSave
 *
 * Watches song + meta state and persists a SessionSnapshot to OPFS
 * with a 2-second debounce.  Calls onSaved() after the first successful write.
 *
 * Exposes a `saveStatus` so the UI can render a real-time persistence
 * indicator (saving / saved / unsaved / error).
 */
import { useEffect, useRef, useState } from 'react';
import { saveSession } from '../lib/sessionPersistence';
import type { SessionSnapshot } from '../lib/sessionPersistence';
import type { Section } from '../types';
import type { AppTab } from './useUIState';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

interface AutoSavePayload {
  song: Section[];
  structure: string[];
  title: string;
  titleOrigin: 'user' | 'ai';
  topic: string;
  mood: string;
  rhymeScheme: string;
  targetSyllables: number;
  songLanguage: string;
  genre: string;
  tempo: number;
  songDurationSeconds: number;
  timeSignature: [number, number];
  instrumentation: string;
  rhythm: string;
  narrative: string;
  musicalPrompt: string;
  activeTab: AppTab;
  isStructureOpen: boolean;
  isLeftPanelOpen: boolean;
  /** Called once after the first successful OPFS write. */
  onSaved?: () => void;
}

export interface SessionAutoSaveResult {
  /** Real-time persistence status for the UI indicator. */
  saveStatus: SaveStatus;
  /** Timestamp (ms) of the last successful save, or null if none yet. */
  lastSavedAt: number | null;
}

export function useSessionAutoSave(payload: AutoSavePayload): SessionAutoSaveResult {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payloadRef = useRef<AutoSavePayload>(payload);
  payloadRef.current = payload;
  const isFirstRunRef = useRef(true);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useEffect(() => {
    // Skip the very first effect tick: it fires from initial hydration and
    // would mis-flag the freshly-loaded session as "unsaved".
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
    } else {
      setSaveStatus('unsaved');
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const p = payloadRef.current;
      const snapshot: SessionSnapshot = {
        schemaVersion: 1,
        savedAt: Date.now(),
        song: p.song,
        structure: p.structure,
        title: p.title,
        titleOrigin: p.titleOrigin,
        topic: p.topic,
        mood: p.mood,
        rhymeScheme: p.rhymeScheme,
        targetSyllables: p.targetSyllables,
        songLanguage: p.songLanguage,
        genre: p.genre,
        tempo: p.tempo,
        songDurationSeconds: p.songDurationSeconds,
        timeSignature: p.timeSignature,
        instrumentation: p.instrumentation,
        rhythm: p.rhythm,
        narrative: p.narrative,
        musicalPrompt: p.musicalPrompt,
        activeTab: p.activeTab,
        isStructureOpen: p.isStructureOpen,
        isLeftPanelOpen: p.isLeftPanelOpen,
      };
      setSaveStatus('saving');
      try {
        await saveSession(snapshot);
        setSaveStatus('saved');
        setLastSavedAt(snapshot.savedAt);
        payloadRef.current.onSaved?.();
      } catch (err) {
        console.error('[useSessionAutoSave] failed to persist session', err);
        setSaveStatus('error');
      }
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    payload.song,
    payload.structure,
    payload.title,
    payload.titleOrigin,
    payload.topic,
    payload.mood,
    payload.rhymeScheme,
    payload.targetSyllables,
    payload.songLanguage,
    payload.genre,
    payload.tempo,
    payload.songDurationSeconds,
    payload.timeSignature,
    payload.instrumentation,
    payload.rhythm,
    payload.narrative,
    payload.musicalPrompt,
    payload.activeTab,
    payload.isStructureOpen,
    payload.isLeftPanelOpen,
  ]);

  return { saveStatus, lastSavedAt };
}
