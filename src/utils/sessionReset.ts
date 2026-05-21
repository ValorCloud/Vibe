// ---------------------------------------------------------------------------
// sessionReset.ts — canonical reset payload builder
// ---------------------------------------------------------------------------

import { safeRemoveItem } from './safeStorage';
import { createEmptySong, DEFAULT_TOPIC, DEFAULT_MOOD } from './songDefaults';
import { DEFAULT_STRUCTURE } from '../constants/editor';
import type { Section } from '../types';
import { clearSession } from '../lib/sessionPersistence';
import type { AppTab } from '../hooks/useUIState';

export interface ResetPayload {
  song: Section[];
  structure: string[];
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
  markupText: string;
  activeTab: AppTab;
  isLeftPanelOpen: boolean;
  similarityMatches: never[];
  hasSavedSession: boolean;
}

export const buildResetPayload = (rhymeScheme = 'AABB'): ResetPayload => ({
  song:             createEmptySong(DEFAULT_STRUCTURE, rhymeScheme),
  structure:        DEFAULT_STRUCTURE,
  title:            '',
  titleOrigin:      'user',
  topic:            DEFAULT_TOPIC,
  mood:             DEFAULT_MOOD,
  rhymeScheme,
  targetSyllables:  10,
  genre:            '',
  tempo:            120,
  instrumentation:  '',
  rhythm:           '',
  narrative:        '',
  musicalPrompt:    '',
  markupText:       '',
  activeTab:        'lyrics',
  isLeftPanelOpen:  true,
  similarityMatches: [],
  hasSavedSession:  false,
});

export const buildPartialResetPayload = (currentRhymeScheme: string): Pick<
  ResetPayload,
  'song' | 'structure' | 'title' | 'titleOrigin' | 'topic' | 'mood' | 'markupText' | 'similarityMatches' | 'hasSavedSession'
> => ({
  song:             createEmptySong(DEFAULT_STRUCTURE, currentRhymeScheme),
  structure:        DEFAULT_STRUCTURE,
  title:            '',
  titleOrigin:      'user',
  topic:            DEFAULT_TOPIC,
  mood:             DEFAULT_MOOD,
  markupText:       '',
  similarityMatches: [],
  hasSavedSession:  false,
});

/**
 * Wipes persisted session from localStorage AND OPFS.
 * Synchronous for localStorage; OPFS deletion is fire-and-forget.
 */
export const clearPersistedSession = (): void => {
  safeRemoveItem('lyricist_session');
  void clearSession(); // OPFS — async, non-blocking
};
