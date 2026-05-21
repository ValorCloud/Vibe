import { useState, useCallback } from 'react';
import type { TrackEntry, TrackSource } from './types';

// Use browser crypto — no external dep needed
const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const SEED_TRACKS: TrackEntry[] = [
  { id: newId(), title: 'Nebula Flight', source: 'cloud', memo: '', linked: false },
  { id: newId(), title: 'Stellar Voyage', source: 'cloud', memo: '', linked: false },
];

export interface LibraryState {
  tracks: TrackEntry[];
  addTracks: (entries: Omit<TrackEntry, 'id'>[]) => void;
  removeTrack: (id: string) => void;
  updateMemo: (id: string, memo: string) => void;
  updateUrl: (id: string, url: string) => void;
  purgeAll: () => void;
}

export function useLibrary(): LibraryState {
  const [tracks, setTracks] = useState<TrackEntry[]>(SEED_TRACKS);

  const addTracks = useCallback((entries: Omit<TrackEntry, 'id'>[]) => {
    setTracks(prev => [
      ...prev,
      ...entries.map(e => ({ ...e, id: newId() })),
    ]);
  }, []);

  const removeTrack = useCallback((id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateMemo = useCallback((id: string, memo: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, memo } : t));
  }, []);

  const updateUrl = useCallback((id: string, url: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, url, linked: true } : t));
  }, []);

  const purgeAll = useCallback(() => {
    setTracks(prev => {
      // Revoke blob URLs to free memory
      prev.forEach(t => {
        if (t.url && t.url.startsWith('blob:')) {
          try { URL.revokeObjectURL(t.url); } catch (_) { /* noop */ }
        }
      });
      return [];
    });
  }, []);

  return { tracks, addTracks, removeTrack, updateMemo, updateUrl, purgeAll };
}
