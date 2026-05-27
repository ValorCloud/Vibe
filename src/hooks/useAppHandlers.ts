import { useCallback } from 'react';
import type { Section } from '../types';
import { useSongContext } from '../contexts/SongContext';
import type { AppTab } from './useUIState';
import { logger } from '../utils/logger';

interface UseAppHandlersParams {
  t: {
    tooltips: {
      aiUnavailableHelp: string;
    };
  };
  hasRealLyricContent: boolean;
  isMobileOrTablet: boolean;
  setApiErrorModal: (modal: { open: boolean; message: string }) => void;
  setConfirmModal: (modal: { open: boolean; onConfirm: () => void } | null) => void;
  setActiveTab: (tab: AppTab) => void;
  setIsLeftPanelOpen: (open: boolean) => void;
  setIsStructureOpen: (open: boolean) => void;
  generateSong: () => Promise<void>;
  scrollToSection: (section: Section) => void;
}

export function useAppHandlers({
  t,
  hasRealLyricContent,
  isMobileOrTablet,
  setApiErrorModal,
  setConfirmModal,
  setActiveTab,
  setIsLeftPanelOpen,
  setIsStructureOpen,
  generateSong,
  scrollToSection,
}: UseAppHandlersParams) {
  const { song, setTitle, setTitleOrigin } = useSongContext();

  const handleApiKeyHelp = useCallback(() => {
    setApiErrorModal({ open: true, message: t.tooltips.aiUnavailableHelp });
  }, [setApiErrorModal, t.tooltips.aiUnavailableHelp]);

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    setTitleOrigin('user');
  }, [setTitle, setTitleOrigin]);

  const handleGlobalRegenerate = useCallback(() => {
    const runGenerate = () => {
      generateSong().catch((err: unknown) => {
        logger.error('[generateSong] unhandled error', err);
        const message =
          err instanceof Error ? err.message : String(err ?? 'Unknown error');
        setApiErrorModal({ open: true, message });
      });
    };

    if (hasRealLyricContent) {
      setConfirmModal({
        open: true,
        onConfirm: () => {
          setConfirmModal(null);
          runGenerate();
        },
      });
    } else {
      runGenerate();
    }
  }, [hasRealLyricContent, setConfirmModal, generateSong, setApiErrorModal]);

  const handleScrollToSection = useCallback((sectionId: string) => {
    const sec = song.find((s: Section) => s.id === sectionId);
    if (sec) scrollToSection(sec);
  }, [song, scrollToSection]);

  const handleOpenNewGeneration = useCallback(() => {
    setActiveTab('lyrics');
    setIsLeftPanelOpen(true);
    if (isMobileOrTablet) setIsStructureOpen(false);
  }, [isMobileOrTablet, setActiveTab, setIsLeftPanelOpen, setIsStructureOpen]);

  return {
    handleApiKeyHelp,
    handleTitleChange,
    handleGlobalRegenerate,
    handleScrollToSection,
    handleOpenNewGeneration,
  };
}
