import React, { useCallback, useMemo, useState } from 'react';
import { Music, Sparkles, Compass, Check, Copy } from '../../ui/icons';
import { Tooltip } from '../../ui/Tooltip';
import { GBPanel } from '../../ui/GBPanel';
import { useTranslation } from '../../../i18n';
import { copyToClipboard } from '../../../utils/clipboard';
import {
  VIBE_CATEGORIES,
  getSubStyleEntries,
  getSubStyleNames,
  buildGenreTooltip,
} from '../../../constants/musicalData';
import type { VibeTile, VibeCategory, SubStyleEntry } from '../../../constants/musicalData';

const AMBER_PRIMARY = 'var(--lcars-amber)';
const AMBER_SECONDARY = 'var(--lcars-cyan)';

interface Props {
  selectedVibeTile: VibeTile | null;
  selectedSubStyle: string;
  selectedCategory: VibeCategory | null;
  selectedAccent: string;
  genreBlueprint: string;
  suggestedSubStyles: string[];
  selectedSubStyleEntry: SubStyleEntry | null;
  onVibeTileSelect: (tile: VibeTile) => void;
  onSubStyleSelect: (subStyle: string) => void;
}

export function MusicalVibeBoard({
  selectedVibeTile,
  selectedSubStyle,
  selectedCategory,
  selectedAccent,
  genreBlueprint,
  suggestedSubStyles,
  selectedSubStyleEntry,
  onVibeTileSelect,
  onSubStyleSelect,
}: Props) {
  const { t } = useTranslation();
  const m = t.musical;
  const [referencesCopied, setReferencesCopied] = useState(false);

  const handleCopyReferences = useCallback(() => {
    if (!selectedCategory) return;
    const refs = selectedCategory.artists.join(', ');
    copyToClipboard(refs).then((ok) => {
      if (!ok) return;
      setReferencesCopied(true);
      setTimeout(() => setReferencesCopied(false), 1600);
    }).catch(() => {
      // copyToClipboard never rejects
    });
  }, [selectedCategory]);

  return (
    <GBPanel>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4" style={{ color: AMBER_PRIMARY }} aria-hidden="true" />
          <label className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">
            {m.vibeBoard}
          </label>
          {selectedVibeTile && (
            <span
              className="ml-auto flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 vibe-badge"
              style={{ background: `${selectedAccent}22`, color: selectedAccent }}
              role="status"
              aria-live="polite"
            >
              {selectedVibeTile.emoji} {genreBlueprint}
            </span>
          )}
        </div>
        <p className="text-[10px] text-[var(--text-secondary)] opacity-70">{m.vibeBoardDescription}</p>

        {/* Category grid */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
          {VIBE_CATEGORIES.map(category => (
            <div key={category.id}>
              <div className="mb-1.5 space-y-1 px-0.5">
                <div className="text-[9px] font-bold tracking-widest uppercase" style={{ color: category.color }}>
                  {category.label}
                </div>
                <p className="text-[10px] leading-4 text-[var(--text-secondary)] opacity-75">{category.summary}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {category.tiles.map(tile => {
                  const isSelected = selectedVibeTile?.name === tile.name;
                  return (
                    <Tooltip key={tile.name} title={buildGenreTooltip(category.summary, tile)} relationship="description">
                      <button
                        onClick={() => onVibeTileSelect(tile)}
                        className="ux-interactive flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium tracking-wide border vibe-tile"
                        aria-pressed={isSelected}
                        aria-label={`${isSelected ? 'Deselect' : 'Select'} ${tile.name} genre`}
                        style={isSelected
                          ? { background: `${category.color}22`, borderColor: category.color, color: category.color, boxShadow: `0 0 8px ${category.color}55`, transform: 'scale(1.04)' }
                          : { background: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                      >
                        <span aria-hidden="true">{tile.emoji}</span>
                        <span>{tile.name}</span>
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sub-style selection */}
        {selectedVibeTile && getSubStyleNames(selectedVibeTile.name).length > 0 && (
          <SubStyleSection
            selectedVibeTile={selectedVibeTile}
            selectedSubStyle={selectedSubStyle}
            selectedAccent={selectedAccent}
            selectedSubStyleEntry={selectedSubStyleEntry}
            subStyleLabel={m.subStyle}
            onSubStyleSelect={onSubStyleSelect}
          />
        )}

        {/* Reference cards */}
        {selectedVibeTile && selectedCategory && (
          <ReferenceCards
            selectedCategory={selectedCategory}
            selectedAccent={selectedAccent}
            suggestedSubStyles={suggestedSubStyles}
            referencesCopied={referencesCopied}
            onCopyReferences={handleCopyReferences}
          />
        )}
      </div>
    </GBPanel>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

interface SubStyleSectionProps {
  selectedVibeTile: VibeTile;
  selectedSubStyle: string;
  selectedAccent: string;
  selectedSubStyleEntry: SubStyleEntry | null;
  subStyleLabel: string;
  onSubStyleSelect: (subStyle: string) => void;
}

function SubStyleSection({
  selectedVibeTile, selectedSubStyle, selectedAccent,
  selectedSubStyleEntry, subStyleLabel, onSubStyleSelect,
}: SubStyleSectionProps) {
  const CYAN = 'var(--lcars-cyan)';
  return (
    <div className="pt-2 border-t border-[var(--border-color)] space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase vibe-badge"
          style={{ background: `${selectedAccent}1f`, color: selectedAccent }}
        >
          <Sparkles className="w-3 h-3" />
          Step 2
        </span>
        <div className="text-[9px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">{subStyleLabel}</div>
        <span className="ml-auto text-[10px] font-medium text-[var(--text-secondary)]">Pick a niche to unlock tailored cues.</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-1.5">
        {getSubStyleEntries(selectedVibeTile.name).map(entry => {
          const isSelected = selectedSubStyle === entry.name;
          return (
            <Tooltip
              key={entry.name}
              title={`${entry.name}\n${entry.description}\nMood: ${entry.mood} · BPM ${entry.bpmOffset >= 0 ? '+' : ''}${entry.bpmOffset}`}
              relationship="description"
            >
              <button
                onClick={() => onSubStyleSelect(entry.name)}
                className="ux-interactive w-full text-left border px-3 py-2.5 vibe-tile"
                aria-pressed={isSelected}
                aria-label={`${isSelected ? 'Deselect' : 'Select'} ${entry.name} sub-style`}
                style={isSelected
                  ? { background: `${selectedAccent}33`, borderColor: selectedAccent, color: 'var(--text-primary)', boxShadow: `0 0 10px ${selectedAccent}44` }
                  : { background: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: selectedAccent }} aria-hidden="true" />
                  <span className="text-[11px] font-semibold">{entry.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                  <span className="ml-auto px-2 py-0.5 text-[9px] font-bold tracking-wide vibe-pill" style={{ background: `${selectedAccent}1f`, color: selectedAccent }}>
                    {entry.mood}
                  </span>
                </div>
                <p className="text-[10px] leading-4 text-[var(--text-secondary)] mt-1">{entry.description}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[9px] text-[var(--text-secondary)]">
                  {entry.bpmOffset !== 0 && (
                    <span className="px-1.5 py-0.5 font-semibold vibe-badge" style={{ background: `${selectedAccent}22`, color: selectedAccent }}>
                      BPM {entry.bpmOffset > 0 ? `+${entry.bpmOffset}` : entry.bpmOffset}
                    </span>
                  )}
                  <span className="truncate" style={{ color: selectedAccent }}>{entry.signature}</span>
                </div>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Niche profile card */}
      {selectedSubStyleEntry && (
        <div
          className="mt-2 border px-3 py-2.5 space-y-2 vibe-card"
          style={{ background: `${selectedAccent}14`, borderColor: `${selectedAccent}40` }}
        >
          <div className="flex items-center gap-2">
            <div className="text-[9px] font-bold tracking-widest uppercase" style={{ color: selectedAccent }}>NICHE PROFILE</div>
            <span className="ml-auto px-2 py-0.5 text-[9px] font-bold tracking-wide vibe-pill" style={{ background: `${selectedAccent}22`, color: selectedAccent }}>
              {selectedSubStyleEntry.mood}
            </span>
          </div>
          <p className="text-[11px] leading-5 text-[var(--text-secondary)]">{selectedSubStyleEntry.description}</p>
          <div className="space-y-1">
            <div className="text-[9px] font-bold tracking-widest uppercase text-[var(--text-secondary)] opacity-70">SONIC SIGNATURE</div>
            <p className="text-[10px] leading-4 italic" style={{ color: selectedAccent }}>{selectedSubStyleEntry.signature}</p>
          </div>
          {selectedSubStyleEntry.addInstruments.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {selectedSubStyleEntry.addInstruments.map(inst => (
                <span key={inst} className="px-1.5 py-0.5 text-[9px] font-medium vibe-badge" style={{ background: `${selectedAccent}1a`, color: selectedAccent }}>
                  + {inst}
                </span>
              ))}
            </div>
          )}
          {selectedSubStyleEntry.bpmOffset !== 0 && (
            <div className="text-[10px] font-medium" style={{ color: CYAN }}>
              BPM {selectedSubStyleEntry.bpmOffset > 0 ? '↑' : '↓'} {Math.abs(selectedSubStyleEntry.bpmOffset)} from base
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ReferenceCardsProps {
  selectedCategory: VibeCategory;
  selectedAccent: string;
  suggestedSubStyles: string[];
  referencesCopied: boolean;
  onCopyReferences: () => void;
}

function ReferenceCards({ selectedCategory, selectedAccent, suggestedSubStyles, referencesCopied, onCopyReferences }: ReferenceCardsProps) {
  const CYAN = 'var(--lcars-cyan)';
  const cards = useMemo(() => [
    {
      title: 'Broad lane',
      color: selectedCategory.color,
      content: (
        <>
          <p className="mt-2 text-xs font-semibold text-[var(--text-primary)]">{selectedCategory.label}</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{selectedCategory.summary}</p>
        </>
      ),
    },
    {
      title: 'Sub-style clues',
      color: selectedAccent,
      content: (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestedSubStyles.map(sub => (
            <span key={sub} className="px-2 py-1 text-[10px] font-medium vibe-pill" style={{ background: `${selectedAccent}1c`, color: selectedAccent }}>
              {sub}
            </span>
          ))}
        </div>
      ),
    },
    {
      title: 'For fans of',
      color: CYAN,
      content: (
        <>
          <p className="mt-2 text-xs font-semibold text-[var(--text-primary)]">{selectedCategory.artists.join(' · ')}</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">Click below to copy these as your song references.</p>
          <button
            onClick={onCopyReferences}
            className="ux-interactive mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold tracking-wide border vibe-badge"
            style={referencesCopied
              ? { background: `${CYAN}33`, borderColor: CYAN, color: CYAN }
              : { borderColor: `${CYAN}55`, color: CYAN }}
          >
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-current text-[var(--text-secondary)]/70"
              style={referencesCopied ? { background: `${CYAN}22` } : {}}
              aria-hidden="true"
            >
              {referencesCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </span>
            <span>{referencesCopied ? 'Copied to clipboard' : 'Copy references'}</span>
          </button>
        </>
      ),
    },
    {
      title: 'Mood + era cues',
      color: selectedCategory.color,
      content: (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedCategory.moods.map(moodTag => (
              <span key={moodTag} className="px-2 py-1 text-[10px] font-medium vibe-pill" style={{ background: `${selectedCategory.color}1a`, color: selectedCategory.color }}>
                {moodTag}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{selectedCategory.era}</p>
        </>
      ),
    },
  ], [selectedCategory, selectedAccent, suggestedSubStyles, referencesCopied, onCopyReferences]);

  return (
    <div className="pt-2 border-t border-[var(--border-color)] space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase vibe-badge"
          style={{ background: `${selectedAccent}1f`, color: selectedAccent }}
        >
          <Compass className="w-3 h-3" />
          Step 3
        </span>
        <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
          Copy 2-3 artist references, then lock tempo and instruments.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-[9px] font-medium text-[var(--text-secondary)]">
        <span className="uppercase tracking-[0.18em] font-bold text-[var(--text-secondary)]/80">Reference tip:</span>
        <span>Tap "Copy references" below and paste them into the Musical Prompt under REFERENCES.</span>
      </div>
      <div className="grid gap-2 lg:grid-cols-4 sm:grid-cols-2">
        {cards.map(card => (
          <div
            key={card.title}
            className="border px-3 py-2.5 vibe-card"
            style={{ background: `${card.color}14`, borderColor: `${card.color}40` }}
          >
            <div className="text-[9px] font-bold tracking-widest uppercase" style={{ color: card.color }}>{card.title}</div>
            {card.content}
          </div>
        ))}
      </div>
    </div>
  );
}
