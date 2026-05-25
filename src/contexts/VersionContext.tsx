import React, { createContext, useContext, type ReactNode } from 'react';
import { useVersionManager } from '../hooks/useVersionManager';
import { useAppStateContext } from './AppStateContext';
import { useSongContext } from './SongContext';
import type { SongVersion } from '../types';
import type { VersionSnapshot } from '../utils/songDefaults';

interface VersionContextValue {
  versions: SongVersion[];
  saveVersion: (name: string, snapshot?: VersionSnapshot) => void;
  rollbackToVersion: (version: SongVersion) => void;
  rollbackSectionToVersion: (version: SongVersion, sectionId: string) => void;
  replaceVersions: (versions: SongVersion[]) => void;
  handleRequestVersionName: (callback: (name: string) => void) => void;
}

const VersionContext = createContext<VersionContextValue | null>(null);

export function VersionProvider({ children, initialVersions }: { children: ReactNode; initialVersions?: SongVersion[] | undefined }) {
  const { appState } = useAppStateContext();
  const { setIsVersionsModalOpen, setPromptModal } = appState;
  const { updateSongAndStructureWithHistory } = useSongContext();

  const {
    versions,
    saveVersion,
    rollbackToVersion,
    rollbackSectionToVersion,
    replaceVersions,
    handleRequestVersionName,
  } = useVersionManager({
    updateSongAndStructureWithHistory,
    setIsVersionsModalOpen,
    setPromptModal,
    initialVersions,
  });

  return (
    <VersionContext.Provider value={{ versions, saveVersion, rollbackToVersion, rollbackSectionToVersion, replaceVersions, handleRequestVersionName }}>
      {children}
    </VersionContext.Provider>
  );
}

export function useVersionContext(): VersionContextValue {
  const ctx = useContext(VersionContext);
  if (!ctx) throw new Error('useVersionContext must be used inside <VersionProvider>');
  return ctx;
}

export function useOptionalVersionContext(): VersionContextValue | null {
  return useContext(VersionContext);
}
