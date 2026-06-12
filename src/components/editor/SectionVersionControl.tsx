import React, { useState, useRef, useEffect, useCallback } from 'react';
import { History, Undo2, X, Trash2 } from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';
import { useTranslation } from '../../i18n';
import { useOptionalSectionVersionContext } from '../../contexts/SectionVersionContext';
import type { Section, SectionVersion } from '../../types';
import { useSongContext } from '../../contexts/SongContext';

interface SectionVersionControlProps {
  section: Section;
  sectionIndex: number;
}

/**
 * Version button + dropdown for a section.
 *
 * - Button label = latest saved version name (e.g. VERSE-v003) or plain count.
 * - No manual save dialog — versions are saved automatically on section blur.
 * - Dropdown lists all saved versions with restore / delete actions.
 */
export const SectionVersionControl = React.memo(function SectionVersionControl({
  section,
  sectionIndex: _sectionIndex,
}: SectionVersionControlProps) {
  const { t } = useTranslation();
  const versionContext = useOptionalSectionVersionContext();
  const { song, updateSongAndStructureWithHistory } = useSongContext();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const versions = versionContext?.getSectionVersions(section.id) ?? [];
  const versionCount = versionContext?.getSectionVersionCount(section.id) ?? 0;
  const latestVersion = versions[0];

  // Button label: latest version name if available, otherwise count
  const buttonLabel = latestVersion ? latestVersion.name : String(versionCount);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleRestoreVersion = useCallback((version: SectionVersion) => {
    const restoredSection: Section = { ...version.section, id: section.id };
    const newSong = song.map(s => s.id === section.id ? restoredSection : s);
    updateSongAndStructureWithHistory(newSong, newSong.map(s => s.name));
    setIsOpen(false);
  }, [section.id, song, updateSongAndStructureWithHistory]);

  const handleDeleteVersion = useCallback((e: React.MouseEvent, versionId: string) => {
    e.stopPropagation();
    versionContext?.deleteSectionVersion(section.id, versionId);
  }, [section.id, versionContext]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!versionContext) return null;

  return (
    <div className="relative" ref={menuRef}>
      <Tooltip title={t.tooltips?.sectionVersions ?? 'Section version history'}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={[
            'flex items-center gap-1 px-2 py-0.5 rounded',
            'text-[10px] font-semibold uppercase tracking-[0.15em]',
            'border transition-colors duration-150',
            'border-[var(--lcars-orange)]/60 text-[var(--lcars-orange)]',
            'hover:bg-[var(--lcars-orange)]/10',
            versionCount > 0 ? 'opacity-100' : 'opacity-60',
          ].join(' ')}
          aria-label={`${versionCount} version${versionCount !== 1 ? 's' : ''} saved`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <History className="h-3 w-3" />
          <span>{buttonLabel}</span>
        </button>
      </Tooltip>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-1 w-80 max-h-96 overflow-y-auto bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg shadow-xl z-50 custom-scrollbar"
          role="listbox"
          aria-label="Section version history"
        >
          {/* Header */}
          <div className="sticky top-0 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] p-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--lcars-orange)]" />
              {section.name} Versions
            </h4>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Hint */}
          <div className="px-3 py-2 border-b border-[var(--border-color)]">
            <p className="text-[10px] text-[var(--text-secondary)] italic">
              {t.editor?.versionAutoSaveHint ?? 'Versions are saved automatically when you move to another section.'}
            </p>
          </div>

          {/* Version list */}
          <div className="p-2">
            {versions.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
                {t.editor?.noVersionsSaved ?? 'No versions saved yet'}
              </div>
            ) : (
              <div className="space-y-1" role="group">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="group p-2 bg-[var(--bg-app)] hover:bg-[var(--bg-sidebar)] border border-[var(--border-color)] hover:border-[var(--lcars-orange)]/30 rounded transition-all"
                    role="option"
                    aria-selected={false}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-mono font-semibold text-[var(--lcars-orange)] truncate">
                            {version.name}
                          </p>
                          {version.isAutoSave && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] uppercase tracking-wider">
                              Auto
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                          {formatTimestamp(version.timestamp)}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                          {version.section.lines.length} {t.editor?.lines ?? 'lines'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tooltip title={t.tooltips?.restoreVersion ?? 'Restore this version'}>
                          <button
                            type="button"
                            onClick={() => handleRestoreVersion(version)}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--lcars-orange)] hover:bg-[var(--lcars-orange)]/10 rounded transition-colors"
                            aria-label={`Restore ${version.name}`}
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                        <Tooltip title={t.tooltips?.deleteVersion ?? 'Delete this version'}>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteVersion(e, version.id)}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            aria-label={`Delete ${version.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
