import React from 'react';
import { History, Layout, Plus, Sparkles, Undo2, X } from '../../ui/icons';
import { Button } from '../../ui/Button';
import type { Section, SongVersion } from '../../../types';

type VersionsModalProps = {
  isOpen: boolean;
  versions: SongVersion[];
  onClose: () => void;
  onSaveCurrent: (name: string) => void;
  onRollback: (version: SongVersion) => void;
  onRollbackSection: (version: SongVersion, sectionId: string) => void;
  onRequestVersionName: (callback: (name: string) => void) => void;
  currentSong: Section[];
};

const sectionText = (section: Section) => section.lines.map(line => line.text).join('\n');

const getVersionDiff = (currentSong: Section[], version: SongVersion) => {
  let added = 0;
  let removed = 0;
  let changed = 0;
  const changedSections = version.song.filter(versionSection => {
    const currentSection = currentSong.find(section => section.id === versionSection.id || section.name === versionSection.name);
    if (!currentSection) {
      removed += versionSection.lines.length;
      return true;
    }
    const currentLines = currentSection.lines.map(line => line.text);
    const versionLines = versionSection.lines.map(line => line.text);
    added += Math.max(0, currentLines.length - versionLines.length);
    removed += Math.max(0, versionLines.length - currentLines.length);
    const overlap = Math.min(currentLines.length, versionLines.length);
    for (let i = 0; i < overlap; i++) {
      if (currentLines[i] !== versionLines[i]) changed++;
    }
    return sectionText(currentSection) !== sectionText(versionSection);
  });
  added += currentSong.filter(section => !version.song.some(versionSection => versionSection.id === section.id || versionSection.name === section.name))
    .reduce((total, section) => total + section.lines.length, 0);
  return { added, removed, changed, changedSections };
};

export const VersionsModal = ({
  isOpen,
  versions,
  onClose,
  onSaveCurrent,
  onRollback,
  onRollbackSection,
  onRequestVersionName,
  currentSong,
}: VersionsModalProps) => {
  const handleOpenSaveDialog = () => {
    onRequestVersionName((name) => {
      if (name) onSaveCurrent(name);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Gradient border wrapper — isolation prevents gradient from bleeding into interior */}
      <div
        className="lcars-gradient-outline relative w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[80vh] rounded-none sm:rounded-[24px_8px_24px_8px] animate-in zoom-in-95 duration-300"
        style={{
          padding: '2px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          isolation: 'isolate',
        }}
      >
        {/* Modal panel — dialog-surface ensures opaque dark background */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Song Versions"
          className="dialog-surface w-full h-full overflow-hidden flex flex-col rounded-none sm:rounded-[22px_6px_22px_6px]"
        >
          <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-sidebar)]">
            <h3 className="text-lg text-[var(--text-primary)] flex items-center gap-2.5">
              <History className="w-5 h-5 text-[var(--accent-color)]" />
              Song Versions
            </h3>
            <button
              onClick={onClose}
              aria-label="Close Song Versions"
              autoFocus
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)] rounded-md transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-[var(--text-secondary)]">Track your progress and rollback to any previous version of your song.</p>
              <Button
                onClick={handleOpenSaveDialog}
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Save Current
              </Button>
            </div>

            {versions.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-[var(--border-color)] rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-app)] flex items-center justify-center">
                  <History className="w-6 h-6 text-[var(--text-secondary)]" aria-hidden="true" />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">No versions saved yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version) => {
                  const diff = getVersionDiff(currentSong, version);
                  return (
                  <div key={version.id} className="group p-4 bg-[var(--bg-app)] hover:bg-[var(--bg-sidebar)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 rounded-xl transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-medium text-[var(--text-primary)]">{version.name}</h4>
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">{new Date(version.timestamp).toLocaleString()}</span>
                      </div>
                      <Button
                        onClick={() => onRollback(version)}
                        variant="text"
                        color="primary"
                        size="small"
                        startIcon={<Undo2 className="w-3.5 h-3.5" />}
                        sx={{ fontSize: '10px' }}
                      >
                        Rollback
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)]">
                      <div className="flex items-center gap-1">
                        <Layout className="w-3 h-3" aria-hidden="true" />
                        {version.song.length} Sections
                      </div>
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        {version.topic || 'No topic'}
                      </div>
                      <div aria-label={`${diff.changed} changed lines, ${diff.added} added lines, ${diff.removed} removed lines`}>
                        Δ {diff.changed} changed · +{diff.added} · -{diff.removed}
                      </div>
                      {version.musicalPrompt && (
                        <div title={version.musicalPrompt}>
                          Musical prompt: {version.musicalPrompt.slice(0, 48)}{version.musicalPrompt.length > 48 ? '…' : ''}
                        </div>
                      )}
                    </div>
                    {diff.changedSections.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Section versions</p>
                        <div className="flex flex-wrap gap-2">
                          {diff.changedSections.map(section => (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => onRollbackSection(version, section.id)}
                              className="ux-interactive rounded-[10px_3px_10px_3px] border border-[var(--border-color)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]"
                            >
                              Restore {section.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] flex justify-end">
            <Button onClick={onClose} variant="contained" color="inherit">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
