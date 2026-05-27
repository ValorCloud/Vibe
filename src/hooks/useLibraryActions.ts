import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { z } from 'zod';
import type { Section } from '../types';
import type { SimilarityMatch } from '../utils/similarityUtils';
import {
  findSimilarAssetsInLibrary,
  loadLibraryAssets,
  deleteAssetFromLibrary,
  purgeLibrary,
  type LibraryAsset,
} from '../utils/libraryUtils';
import { safeJsonParse } from '../utils/safeStorage';
import { useSongContext } from '../contexts/SongContext';
import { useLibrarySongActions } from './useLibrarySongActions';
import { logger } from '../utils/logger';

const lyricalKey = (song: Section[]): string => {
  return song
    .map(section => section.lines.filter(line => !line.isMeta).map(line => line.text).join('|'))
    .join('//');
};

/** Minimal schema for the library count initialisation — validates array shape only. */
const LibraryRawArraySchema = z.array(z.unknown());

type UseLibraryActionsParams = {
  setSimilarityMatches: Dispatch<SetStateAction<SimilarityMatch[]>>;
  setLibraryCount: Dispatch<SetStateAction<number>>;
  setLibraryAssets: Dispatch<SetStateAction<LibraryAsset[]>>;
  setIsSavingToLibrary: (v: boolean) => void;
  setIsSaveToLibraryModalOpen: (v: boolean) => void;
};

export const useLibraryActions = ({
  setSimilarityMatches,
  setLibraryCount,
  setLibraryAssets,
  setIsSavingToLibrary,
  setIsSaveToLibraryModalOpen,
}: UseLibraryActionsParams) => {
  const { song } = useSongContext();
  const [saveLibraryError, setSaveLibraryError] = useState<string | null>(null);

  const { handleSaveToLibrary, handleLoadLibraryAsset } = useLibrarySongActions({
    setIsSavingToLibrary,
    setIsSaveToLibraryModalOpen,
    setLibraryCount,
    setLibraryAssets,
    setSaveError: setSaveLibraryError,
  });

  const currentLyricalKey = useMemo(() => lyricalKey(song), [song]);
  const similarityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSimilarityKeyRef = useRef('');

  useEffect(() => {
    if (currentLyricalKey === lastSimilarityKeyRef.current) return;
    if (similarityDebounceRef.current) clearTimeout(similarityDebounceRef.current);
    let isCancelled = false;
    similarityDebounceRef.current = setTimeout(() => {
      lastSimilarityKeyRef.current = currentLyricalKey;
      const runSimilarity = async () => {
        if (song.length === 0) {
          setSimilarityMatches([]);
          return;
        }
        const matches = await findSimilarAssetsInLibrary(song, 0, 3);
        if (!isCancelled) setSimilarityMatches(matches);
      };
      void runSimilarity();
    }, 800);
    return () => {
      isCancelled = true;
      if (similarityDebounceRef.current) clearTimeout(similarityDebounceRef.current);
    };
  }, [currentLyricalKey, song, setSimilarityMatches]);

  useEffect(() => {
    const assets = safeJsonParse('lyricist_library', LibraryRawArraySchema);
    if (assets !== null) setLibraryCount(assets.length);
  }, [setLibraryCount]);

  const handleDeleteLibraryAsset = useCallback(async (versionId: string) => {
    try {
      await deleteAssetFromLibrary(versionId);
      setLibraryAssets(prev => prev.filter(asset => asset.id !== versionId));
      setSimilarityMatches(prev => prev.filter(match => match.versionId !== versionId));
      setLibraryCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      logger.error('Failed to delete library asset:', error);
      setSaveLibraryError('Failed to delete asset from library');
    }
  }, [setLibraryAssets, setLibraryCount, setSimilarityMatches]);

  const handlePurgeLibrary = useCallback(async () => {
    try {
      await purgeLibrary();
      setLibraryAssets([]);
      setSimilarityMatches([]);
      setLibraryCount(0);
    } catch (error) {
      logger.error('Failed to purge library:', error);
      setSaveLibraryError('Failed to purge library');
    }
  }, [setLibraryAssets, setLibraryCount, setSimilarityMatches]);

  const handleOpenSaveToLibraryModal = useCallback(async () => {
    setLibraryAssets(await loadLibraryAssets());
    setIsSaveToLibraryModalOpen(true);
  }, [setIsSaveToLibraryModalOpen, setLibraryAssets]);

  return {
    handleSaveToLibrary,
    handleLoadLibraryAsset,
    handleDeleteLibraryAsset,
    handlePurgeLibrary,
    handleOpenSaveToLibraryModal,
    saveLibraryError,
    clearSaveLibraryError: () => setSaveLibraryError(null),
  };
};
