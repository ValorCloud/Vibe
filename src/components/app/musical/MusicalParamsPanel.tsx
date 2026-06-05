import React, { useState, useCallback, useMemo } from 'react';
import { Activity, Guitar, Drum, ListMusic, Play, Pause, Music, ChevronDown, Check, Sparkles, Compass, Copy, Search, X } from '../../ui/icons';
import { Tooltip } from '../../ui/Tooltip';
import { useTranslation } from '../../../i18n';
import { useMetronome } from '../../../hooks/useMetronome';
import { RHYTHM_BPM } from '../../../constants/rhythmBpm';
import { copyToClipboard } from '../../../utils/clipboard';
import {
  BPM_PRESETS,
  INSTRUMENT_FAMILIES,
  VIBE_CATEGORIES,
  RHYTHM_SUGGESTIONS,
  NARRATIVE_SUGGESTIONS,
  parseInstrumentation,
  getSubStyleEntries,
  getSubStyleNames,
  buildGenreTooltip,
} from '../../../constants/musicalData';
import type { VibeTile, VibeCategory } from '../../../constants/musicalData';

const AMBER_PRIMARY = '#f59e0b';

function GBPanel({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`lcars-gb-panel ${className}`} style={style}>{children}</div>;
}

interface Props {
  genre: string; setGenre: (v: string) => void;
  tempo: number; setTempo: (v: number) => void;
  instrumentation: string; setInstrumentation: (v: string) => void;
  rhythm: string; setRhythm: (v: string) => void;
  narrative: string; setNarrative: (v: string) => void;
  onWorkflowStepComplete?: (step: number) => void;
}

export function MusicalParamsPanel({ genre, setGenre, tempo, setTempo, instrumentation, setInstrumentation, rhythm, setRhythm, narrative, setNarrative, onWorkflowStepComplete }: Props) {
  const { t } = useTranslation();
  const m = t.musical;
  const AMBER_SECONDARY = '#38bdf8';
  const AMBER_MUTED = '#c4b5fd';

  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [instrumentQuery, setInstrumentQuery] = useState('');
  const [selectedVibeTile, setSelectedVibeTile] = useState<VibeTile | null>(null);
  const [selectedSubStyle, setSelectedSubStyle] = useState<string>('');
  const [isRhythmDropdownOpen, setIsRhythmDropdownOpen] = useState(false);
  const [isNarrativeDropdownOpen, setIsNarrativeDropdownOpen] = useState(false);
  const [referencesCopied, setReferencesCopied] = useState(false);

  const selectedCategory = selectedVibeTile ? VIBE_CATEGORIES.find(cat => cat.tiles.some(tile => tile.name === selectedVibeTile.name)) ?? null : null;
  const selectedAccent = selectedCategory?.color ?? AMBER_PRIMARY;
  const genreBlueprint = selectedVibeTile ? (selectedSubStyle ? `${selectedVibeTile.name} / ${selectedSubStyle}` : selectedVibeTile.name) : genre;
  const suggestedSubStyles = selectedVibeTile ? getSubStyleNames(selectedVibeTile.name) : [];
  const selectedSubStyleEntry = selectedVibeTile && selectedSubStyle
    ? getSubStyleEntries(selectedVibeTile.name).find(e => e.name === selectedSubStyle) ?? null
    : null;

  const bpmValue = tempo || 120;
  const metronome = useMetronome(bpmValue);
  const bpmPercent = Math.min(100, Math.max(0, ((bpmValue - 40) / (220 - 40)) * 100));
  const selectedInstruments = useMemo(() => parseInstrumentation(instrumentation), [instrumentation]);

  const toggleInstrument = useCallback((instrument: string) => {
    const current = parseInstrumentation(instrumentation);
    const idx = current.indexOf(instrument);
    setInstrumentation(idx >= 0 ? current.filter(i => i !== instrument).join(', ') : [...current, instrument].join(', '));
  }, [instrumentation, setInstrumentation]);

  const removeInstrument = useCallback((instrument: string) => {
    setInstrumentation(parseInstrumentation(instrumentation).filter(i => i !== instrument).join(', '));
  }, [instrumentation, setInstrumentation]);

  const clearInstruments = useCallback(() => setInstrumentation(''), [setInstrumentation]);

  // Filter instrument families by the live search query. An empty query keeps
  // every family; a non-empty query keeps only matching instruments (and the
  // families that contain at least one match), and is matched case-insensitively
  // against the family label too so "perc" reveals the whole Percussion family.
  const normalizedQuery = instrumentQuery.trim().toLowerCase();
  const filteredFamilies = useMemo(() => (
    normalizedQuery
      ? INSTRUMENT_FAMILIES
          .map(family => {
            const familyMatches = family.label.toLowerCase().includes(normalizedQuery);
            const instruments = familyMatches
              ? family.instruments
              : family.instruments.filter(i => i.name.toLowerCase().includes(normalizedQuery));
            return { ...family, instruments };
          })
          .filter(family => family.instruments.length > 0)
      : INSTRUMENT_FAMILIES
  ), [normalizedQuery]);

  const handleVibeTileSelect = useCallback((tile: VibeTile) => {
    if (selectedVibeTile?.name === tile.name) { setSelectedVibeTile(null); setSelectedSubStyle(''); return; }
    setSelectedVibeTile(tile); setSelectedSubStyle('');
    setGenre(tile.name);
    setTempo(RHYTHM_BPM[tile.rhythm] ?? tile.bpm);
    setRhythm(tile.rhythm);
    setInstrumentation(tile.instruments.join(', '));
    // Step 1 complete: Genre selected
    onWorkflowStepComplete?.(1);
  }, [selectedVibeTile, setGenre, setTempo, setRhythm, setInstrumentation, onWorkflowStepComplete]);

  const handleSubStyleSelect = useCallback((subStyle: string) => {
    const next = selectedSubStyle === subStyle ? '' : subStyle;
    setSelectedSubStyle(next);
    if (selectedVibeTile) setGenre(next ? `${selectedVibeTile.name} / ${next}` : selectedVibeTile.name);
    setRhythm(next || (selectedVibeTile?.rhythm ?? ''));
    if (next && selectedVibeTile) {
      const entry = getSubStyleEntries(selectedVibeTile.name).find(e => e.name === next);
      if (entry) {
        const baseBpm = RHYTHM_BPM[selectedVibeTile.rhythm] ?? selectedVibeTile.bpm;
        setTempo(Math.max(40, Math.min(220, baseBpm + entry.bpmOffset)));
        if (entry.addInstruments.length > 0) {
          const current = selectedVibeTile.instruments;
          const merged = [...current, ...entry.addInstruments.filter(i => !current.includes(i))];
          setInstrumentation(merged.join(', '));
        }
      }
    } else if (!next && selectedVibeTile) {
      setTempo(RHYTHM_BPM[selectedVibeTile.rhythm] ?? selectedVibeTile.bpm);
      setInstrumentation(selectedVibeTile.instruments.join(', '));
    }
    // Step 2 complete: Sub-style selected
    if (next) onWorkflowStepComplete?.(2);
  }, [selectedSubStyle, selectedVibeTile, setGenre, setRhythm, setTempo, setInstrumentation, onWorkflowStepComplete]);

  const handleCopyReferences = useCallback(() => {
    if (!selectedCategory) return;
    const refs = selectedCategory.artists.join(', ');
    // Use the shared clipboard helper — `navigator.clipboard?.writeText(...).then(...)`
    // crashes with `TypeError: undefined.then` when `clipboard` is undefined
    // (non-secure context, sandboxed iframe, older browsers).
    void copyToClipboard(refs).then((ok) => {
      if (!ok) return;
      setReferencesCopied(true);
      setTimeout(() => setReferencesCopied(false), 1600);
    });
  }, [selectedCategory]);

  return (
    <div className="space-y-5">
      {/* Vibe Board */}
      <GBPanel>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4" style={{ color: AMBER_PRIMARY }} />
            <label className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">{m.vibeBoard ?? 'VIBE BOARD'}</label>
            {selectedVibeTile && (
              <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5" style={{ borderRadius: '8px 2px 8px 2px', background: `${selectedAccent}22`, color: selectedAccent }}>
                {selectedVibeTile.emoji} {genreBlueprint}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] opacity-70">{m.vibeBoardDescription ?? 'Select your genre to auto-set BPM & instruments'}</p>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {VIBE_CATEGORIES.map(category => (
                <div key={category.id}>
                  <div className="mb-1.5 space-y-1 px-0.5">
                    <div className="text-[9px] font-bold tracking-widest uppercase" style={{ color: category.color }}>{category.label}</div>
                    <p className="text-[10px] leading-4 text-[var(--text-secondary)] opacity-75">{category.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {category.tiles.map(tile => {
                      const isSelected = selectedVibeTile?.name === tile.name;
                      return (
                        <Tooltip
                          key={tile.name}
                          title={buildGenreTooltip(category.summary, tile)}
                          relationship="description"
                        >
                          <button onClick={() => handleVibeTileSelect(tile)}
                            className="ux-interactive flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium tracking-wide border"
                            style={isSelected
                              ? { borderRadius: '12px 4px 12px 4px', background: `${category.color}22`, borderColor: category.color, color: category.color, boxShadow: `0 0 8px ${category.color}55`, transform: 'scale(1.04)' }
                              : { borderRadius: '12px 4px 12px 4px', background: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                          >
                            <span>{tile.emoji}</span><span>{tile.name}</span>
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
              </div>
            ))}
          </div>
          {selectedVibeTile && getSubStyleNames(selectedVibeTile.name).length > 0 && (
            <div className="pt-2 border-t border-[var(--border-color)] space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase" style={{ borderRadius: '10px 3px 10px 3px', background: `${selectedAccent}1f`, color: selectedAccent }}>
                  <Sparkles className="w-3 h-3" />
                  Step 2
                </span>
                <div className="text-[9px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">{m.subStyle ?? 'SUB-STYLE'}</div>
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
                        onClick={() => handleSubStyleSelect(entry.name)}
                        className="ux-interactive w-full text-left border px-3 py-2.5"
                        style={isSelected
                          ? { borderRadius: '12px 4px 12px 4px', background: `${selectedAccent}33`, borderColor: selectedAccent, color: 'var(--text-primary)', boxShadow: `0 0 10px ${selectedAccent}44` }
                          : { borderRadius: '12px 4px 12px 4px', background: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: selectedAccent }} aria-hidden="true" />
                          <span className="text-[11px] font-semibold">{entry.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                          <span className="ml-auto px-2 py-0.5 text-[9px] font-bold tracking-wide" style={{ borderRadius: '999px', background: `${selectedAccent}1f`, color: selectedAccent }}>{entry.mood}</span>
                        </div>
                        <p className="text-[10px] leading-4 text-[var(--text-secondary)] mt-1">{entry.description}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[9px] text-[var(--text-secondary)]">
                          {entry.bpmOffset !== 0 && (
                            <span className="px-1.5 py-0.5 font-semibold" style={{ borderRadius: '8px 2px 8px 2px', background: `${selectedAccent}22`, color: selectedAccent }}>
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
              {selectedSubStyleEntry && (
                <div className="mt-2 border px-3 py-2.5 space-y-2" style={{ borderRadius: '14px 4px 14px 4px', background: `${selectedAccent}14`, borderColor: `${selectedAccent}40` }}>
                  <div className="flex items-center gap-2">
                    <div className="text-[9px] font-bold tracking-widest uppercase" style={{ color: selectedAccent }}>NICHE PROFILE</div>
                    <span className="ml-auto px-2 py-0.5 text-[9px] font-bold tracking-wide" style={{ borderRadius: '999px', background: `${selectedAccent}22`, color: selectedAccent }}>{selectedSubStyleEntry.mood}</span>
                  </div>
                  <p className="text-[11px] leading-5 text-[var(--text-secondary)]">{selectedSubStyleEntry.description}</p>
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold tracking-widest uppercase text-[var(--text-secondary)] opacity-70">SONIC SIGNATURE</div>
                    <p className="text-[10px] leading-4 italic" style={{ color: selectedAccent }}>{selectedSubStyleEntry.signature}</p>
                  </div>
                  {selectedSubStyleEntry.addInstruments.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedSubStyleEntry.addInstruments.map(inst => (
                        <span key={inst} className="px-1.5 py-0.5 text-[9px] font-medium" style={{ borderRadius: '6px 2px 6px 2px', background: `${selectedAccent}1a`, color: selectedAccent }}>+ {inst}</span>
                      ))}
                    </div>
                  )}
                  {selectedSubStyleEntry.bpmOffset !== 0 && (
                    <div className="text-[10px] font-medium" style={{ color: AMBER_SECONDARY }}>
                      BPM {selectedSubStyleEntry.bpmOffset > 0 ? '↑' : '↓'} {Math.abs(selectedSubStyleEntry.bpmOffset)} from base
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {selectedVibeTile && selectedCategory && (
            <div className="pt-2 border-t border-[var(--border-color)] space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase" style={{ borderRadius: '10px 3px 10px 3px', background: `${selectedAccent}1f`, color: selectedAccent }}>
                  <Compass className="w-3 h-3" />
                  Step 3
                </span>
                <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Copy 2-3 artist references, then lock tempo and instruments.</span>
              </div>
              {selectedCategory && (
                <div className="flex flex-wrap items-center gap-1 text-[9px] font-medium text-[var(--text-secondary)]">
                  <span className="uppercase tracking-[0.18em] font-bold text-[var(--text-secondary)]/80">Reference tip:</span>
                  <span>Tap “Copy references” below and paste them into the Musical Prompt under REFERENCES.</span>
                </div>
              )}
              <div className="grid gap-2 lg:grid-cols-4 sm:grid-cols-2">
                {[{ title: 'Broad lane', color: selectedCategory.color, content: <><p className="mt-2 text-xs font-semibold text-[var(--text-primary)]">{selectedCategory.label}</p><p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{selectedCategory.summary}</p></> },
                  { title: 'Sub-style clues', color: selectedAccent, content: <div className="mt-2 flex flex-wrap gap-1.5">{suggestedSubStyles.map(sub => <span key={sub} className="px-2 py-1 text-[10px] font-medium" style={{ borderRadius: '999px', background: `${selectedAccent}1c`, color: selectedAccent }}>{sub}</span>)}</div> },
                  { title: 'For fans of', color: AMBER_SECONDARY, content: <><p className="mt-2 text-xs font-semibold text-[var(--text-primary)]">{selectedCategory.artists.join(' · ')}</p><p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">Click below to copy these as your song references.</p><button onClick={handleCopyReferences} className="ux-interactive mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold tracking-wide border" style={referencesCopied ? { borderRadius: '8px 2px 8px 2px', background: `${AMBER_SECONDARY}33`, borderColor: AMBER_SECONDARY, color: AMBER_SECONDARY } : { borderRadius: '8px 2px 8px 2px', borderColor: `${AMBER_SECONDARY}55`, color: AMBER_SECONDARY }}><span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-current text-[var(--text-secondary)]/70" style={referencesCopied ? { background: `${AMBER_SECONDARY}22` } : {}} aria-hidden="true">{referencesCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</span><span>{referencesCopied ? 'Copied to clipboard' : 'Copy references'}</span></button></> },
                  { title: 'Mood + era cues', color: selectedCategory.color, content: <><div className="mt-2 flex flex-wrap gap-1.5">{selectedCategory.moods.map(moodTag => <span key={moodTag} className="px-2 py-1 text-[10px] font-medium" style={{ borderRadius: '999px', background: `${selectedCategory.color}1a`, color: selectedCategory.color }}>{moodTag}</span>)}</div><p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{selectedCategory.era}</p></> },
                ].map(card => (
                  <div key={card.title} className="border px-3 py-2.5" style={{ borderRadius: '14px 4px 14px 4px', background: `${card.color}14`, borderColor: `${card.color}40` }}>
                    <div className="text-[9px] font-bold tracking-widest uppercase" style={{ color: card.color }}>{card.title}</div>
                    {card.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </GBPanel>

      {/* Tempo + Instruments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GBPanel>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: AMBER_PRIMARY }} />
                <label className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">{m.tempo}</label>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center px-2 py-1 text-sm font-mono font-bold border transition-all"
                  style={metronome.isBeat
                    ? { borderRadius: '8px 2px 8px 2px', color: AMBER_PRIMARY, borderColor: AMBER_PRIMARY, boxShadow: `0 0 8px ${AMBER_PRIMARY}88`, background: `${AMBER_PRIMARY}22` }
                    : { borderRadius: '8px 2px 8px 2px', color: 'var(--text-primary)', borderColor: 'var(--border-color)', background: 'transparent' }}>
                  {bpmValue}
                </span>
                <input type="number" value={tempo} onChange={e => setTempo(parseInt(e.target.value, 10) || 120)} min="40" max="220"
                  className="w-16 bg-transparent border border-[var(--border-color)] px-2 py-1 text-sm text-center text-[var(--text-primary)] lcars-glow-focus transition-colors"
                  style={{ borderRadius: '8px 2px 8px 2px' }}
                />
                <span className="text-xs text-[var(--text-secondary)]">BPM</span>
                <button onClick={metronome.toggle}
                  className={`ux-interactive flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium tracking-wide border ${metronome.isPlaying ? 'border-transparent metronome-active' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                  style={metronome.isPlaying ? { borderRadius: '10px 3px 10px 3px', background: AMBER_PRIMARY, borderColor: AMBER_PRIMARY, color: '#000' } : { borderRadius: '10px 3px 10px 3px' }}
                >
                  {metronome.isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span className="hidden sm:inline">{m.metronome ?? 'Metronome'}</span>
                </button>
              </div>
            </div>
            <div className="relative h-2 bg-[var(--border-color)] rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${bpmPercent}%`, background: AMBER_PRIMARY }} />
            </div>
            <input type="range" min="40" max="220" value={bpmValue} onChange={e => setTempo(parseInt(e.target.value, 10) || 120)} className="w-full h-2 opacity-0 cursor-pointer -mt-4 relative z-10" />
            <div className="flex flex-wrap gap-1.5">
              {BPM_PRESETS.map(({ label, value }) => (
                <button key={value} onClick={() => setTempo(value)}
                  className={`ux-interactive px-2.5 py-1 text-[10px] font-medium tracking-wide border ${tempo === value ? 'border-transparent' : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)]'}`}
                  style={tempo === value ? { borderRadius: '8px 2px 8px 2px', background: AMBER_PRIMARY, borderColor: AMBER_PRIMARY, color: '#000' } : { borderRadius: '8px 2px 8px 2px' }}
                >{label}</button>
              ))}
            </div>
            {/* Rhythm & Groove */}
            <div className="pt-3 border-t border-[var(--border-color)] space-y-2">
              <div className="flex items-center gap-2">
                <Drum className="w-3.5 h-3.5" style={{ color: AMBER_PRIMARY }} />
                <label className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">{m.rhythm}</label>
                <button
                  onClick={() => setIsRhythmDropdownOpen(!isRhythmDropdownOpen)}
                  className="ml-auto p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isRhythmDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {isRhythmDropdownOpen && (
                <div className="flex flex-wrap gap-1.5">
                  {RHYTHM_SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => { setRhythm(rhythm ? `${rhythm}, ${s}` : s); setIsRhythmDropdownOpen(false); }}
                      className="ux-interactive px-2 py-0.5 text-[9px] font-medium tracking-wide border bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent-color)]/40 hover:text-[var(--text-primary)] transition-colors"
                      style={{ borderRadius: '8px 2px 8px 2px' }}
                    >{s}</button>
                  ))}
                </div>
              )}
              <textarea value={rhythm} onChange={e => setRhythm(e.target.value)} placeholder={m.rhythmPlaceholder} rows={2}
                className="w-full bg-transparent border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] lcars-glow-focus transition-colors resize-none"
                style={{ borderRadius: '10px 3px 10px 3px' }}
              />
            </div>
            {/* Narrative / Vibe */}
            <div className="pt-3 border-t border-[var(--border-color)] space-y-2">
              <div className="flex items-center gap-2">
                <ListMusic className="w-3.5 h-3.5" style={{ color: AMBER_PRIMARY }} />
                <label className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">{m.narrative}</label>
                <button
                  onClick={() => setIsNarrativeDropdownOpen(!isNarrativeDropdownOpen)}
                  className="ml-auto p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isNarrativeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {isNarrativeDropdownOpen && (
                <div className="flex flex-wrap gap-1.5">
                  {NARRATIVE_SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => { setNarrative(narrative ? `${narrative}, ${s}` : s); setIsNarrativeDropdownOpen(false); }}
                      className="ux-interactive px-2 py-0.5 text-[9px] font-medium tracking-wide border bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent-color)]/40 hover:text-[var(--text-primary)] transition-colors"
                      style={{ borderRadius: '8px 2px 8px 2px' }}
                    >{s}</button>
                  ))}
                </div>
              )}
              <textarea value={narrative} onChange={e => setNarrative(e.target.value)} placeholder={m.narrativePlaceholder} rows={2}
                className="w-full bg-transparent border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] lcars-glow-focus transition-colors resize-none"
                style={{ borderRadius: '10px 3px 10px 3px' }}
              />
            </div>
          </div>
        </GBPanel>

        <GBPanel>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Guitar className="w-4 h-4" style={{ color: AMBER_PRIMARY }} />
              <label className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">{m.instruments ?? 'INSTRUMENTS'}</label>
              {selectedInstruments.length > 0 && (
                <>
                  <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5" style={{ borderRadius: '6px 2px 6px 2px', background: `${AMBER_PRIMARY}22`, color: AMBER_PRIMARY }}>{selectedInstruments.length}</span>
                  <button
                    onClick={clearInstruments}
                    aria-label={m.clearAllInstruments ?? 'Clear all instruments'}
                    className="ux-interactive text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 border text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] transition-colors"
                    style={{ borderRadius: '6px 2px 6px 2px' }}
                  >{m.clearAll ?? 'Clear all'}</button>
                </>
              )}
            </div>

            {/* Selected instruments — removable chips so users can see and prune
                their full instrumentation at a glance without scanning families. */}
            {selectedInstruments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedInstruments.map(name => (
                  <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border" style={{ borderRadius: '8px 2px 8px 2px', background: `${AMBER_PRIMARY}1f`, borderColor: `${AMBER_PRIMARY}55`, color: AMBER_PRIMARY }}>
                    <span>{name}</span>
                    <button onClick={() => removeInstrument(name)} aria-label={`${m.removeInstrument ?? 'Remove'} ${name}`} className="ux-interactive inline-flex items-center justify-center hover:opacity-70 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Instrument search — filters all families at once so the expanded
                instrument library stays navigable. */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
              <input
                type="text"
                value={instrumentQuery}
                onChange={e => setInstrumentQuery(e.target.value)}
                placeholder={m.searchInstruments ?? 'Search instruments...'}
                aria-label={m.searchInstruments ?? 'Search instruments'}
                className="w-full bg-transparent border border-[var(--border-color)] pl-8 pr-7 py-1.5 text-[11px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] lcars-glow-focus transition-colors"
                style={{ borderRadius: '10px 3px 10px 3px' }}
              />
              {instrumentQuery && (
                <button onClick={() => setInstrumentQuery('')} aria-label={m.clearSearch ?? 'Clear search'} className="ux-interactive absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {filteredFamilies.length === 0 && (
                <p className="text-[10px] text-[var(--text-secondary)] opacity-70 px-1 py-2">{m.noInstrumentsFound ?? 'No instruments match your search.'}</p>
              )}
              {filteredFamilies.map(family => {
                // While searching, force-expand every matching family so results
                // are visible without an extra click.
                const isExpanded = normalizedQuery ? true : expandedFamily === family.label;
                const familySelected = family.instruments.filter(i => selectedInstruments.includes(i.name));
                return (
                  <div key={family.label}>
                    <button onClick={() => { if (!normalizedQuery) setExpandedFamily(isExpanded ? null : family.label); }}
                      className="ux-interactive w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-medium tracking-wide border text-left"
                      style={familySelected.length > 0 ? { borderRadius: '10px 3px 10px 3px', background: `${AMBER_PRIMARY}1a`, borderColor: `${AMBER_PRIMARY}55`, color: AMBER_PRIMARY } : { borderRadius: '10px 3px 10px 3px', background: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                    >
                      <span>{family.emoji}</span><span>{family.label}</span>
                      {familySelected.length > 0 && <span className="ml-1 text-[9px] font-bold px-1" style={{ borderRadius: '4px', background: AMBER_PRIMARY, color: '#000' }}>{familySelected.length}</span>}
                      <span className="ml-auto opacity-50">{isExpanded ? '▾' : '▸'}</span>
                    </button>
                    {isExpanded && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5 pl-2">
                        {family.instruments.map(instrument => {
                          const sel = selectedInstruments.includes(instrument.name);
                          return (
                            <button key={instrument.name} onClick={() => toggleInstrument(instrument.name)}
                              className={`ux-interactive flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium tracking-wide border ${sel ? 'border-transparent' : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)]'}`}
                              style={sel ? { borderRadius: '8px 2px 8px 2px', background: `${AMBER_PRIMARY}33`, borderColor: AMBER_PRIMARY, color: AMBER_PRIMARY } : { borderRadius: '8px 2px 8px 2px' }}
                            >
                              <span
                                aria-hidden="true"
                                className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-sidebar)] text-xs"
                                style={sel ? { borderColor: AMBER_PRIMARY, color: AMBER_PRIMARY, background: `${AMBER_PRIMARY}15` } : undefined}
                              >
                                {instrument.icon || family.emoji}
                              </span>
                              <span>{instrument.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <textarea value={instrumentation} onChange={e => setInstrumentation(e.target.value)} placeholder={m.instrumentationPlaceholder} rows={2}
              className="w-full bg-transparent border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] lcars-glow-focus transition-colors resize-none"
              style={{ borderRadius: '10px 3px 10px 3px' }}
            />
          </div>
        </GBPanel>
      </div>
    </div>
  );
}
