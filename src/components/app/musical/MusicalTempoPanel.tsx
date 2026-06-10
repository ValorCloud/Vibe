import React from 'react';
import { Activity, Drum, ListMusic, Play, Pause, ChevronDown } from '../../ui/icons';
import { GBPanel } from '../../ui/GBPanel';
import { useTranslation } from '../../../i18n';
import { useMetronome } from '../../../hooks/useMetronome';
import { BPM_PRESETS, RHYTHM_SUGGESTIONS, NARRATIVE_SUGGESTIONS } from '../../../constants/musicalData';

const AMBER_PRIMARY = 'var(--lcars-amber)';

interface Props {
  tempo: number;
  setTempo: (v: number) => void;
  rhythm: string;
  setRhythm: (v: string) => void;
  narrative: string;
  setNarrative: (v: string) => void;
  isRhythmDropdownOpen: boolean;
  setIsRhythmDropdownOpen: (v: boolean) => void;
  isNarrativeDropdownOpen: boolean;
  setIsNarrativeDropdownOpen: (v: boolean) => void;
}

export function MusicalTempoPanel({
  tempo, setTempo,
  rhythm, setRhythm,
  narrative, setNarrative,
  isRhythmDropdownOpen, setIsRhythmDropdownOpen,
  isNarrativeDropdownOpen, setIsNarrativeDropdownOpen,
}: Props) {
  const { t } = useTranslation();
  const m = t.musical;
  const bpmValue = tempo || 120;
  const bpmPercent = Math.min(100, Math.max(0, ((bpmValue - 40) / (220 - 40)) * 100));
  const metronome = useMetronome(bpmValue);

  return (
    <GBPanel>
      <div className="p-4 space-y-3">
        {/* Tempo header + controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: AMBER_PRIMARY }} aria-hidden="true" />
            <label htmlFor="tempo-input" className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">
              {m.tempo}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center px-2 py-1 text-sm font-mono font-bold border transition-all vibe-badge"
              role="status"
              aria-live="polite"
              aria-label={`Current tempo: ${bpmValue} beats per minute`}
              style={metronome.isBeat
                ? { color: AMBER_PRIMARY, borderColor: AMBER_PRIMARY, boxShadow: `0 0 8px var(--lcars-amber)88`, background: `var(--lcars-amber)22` }
                : { color: 'var(--text-primary)', borderColor: 'var(--border-color)', background: 'transparent' }}
            >
              {bpmValue}
            </span>
            <input
              id="tempo-input"
              type="number"
              value={tempo}
              onChange={e => setTempo(parseInt(e.target.value, 10) || 120)}
              min="40"
              max="220"
              aria-label="Tempo in beats per minute"
              className="w-16 bg-transparent border border-[var(--border-color)] px-2 py-1 text-sm text-center text-[var(--text-primary)] lcars-glow-focus transition-colors vibe-badge"
            />
            <span className="text-xs text-[var(--text-secondary)]" aria-hidden="true">BPM</span>
            <button
              onClick={metronome.toggle}
              aria-label={metronome.isPlaying ? m.metronomeStop : m.metronomeStart}
              aria-pressed={metronome.isPlaying}
              className={`ux-interactive flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium tracking-wide border vibe-tile ${metronome.isPlaying ? 'border-transparent metronome-active' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}
              style={metronome.isPlaying
                ? { background: AMBER_PRIMARY, borderColor: AMBER_PRIMARY, color: '#000' }
                : {}}
            >
              {metronome.isPlaying ? <Pause className="w-3 h-3" aria-hidden="true" /> : <Play className="w-3 h-3" aria-hidden="true" />}
              <span className="hidden sm:inline">{m.metronome}</span>
            </button>
          </div>
        </div>

        {/* BPM progress bar + range input */}
        <div className="relative h-2 bg-[var(--border-color)] rounded-full overflow-hidden" role="presentation">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all"
            style={{ width: `${bpmPercent}%`, background: AMBER_PRIMARY }}
            aria-hidden="true"
          />
        </div>
        <input
          type="range" min="40" max="220" value={bpmValue}
          onChange={e => setTempo(parseInt(e.target.value, 10) || 120)}
          className="w-full h-2 opacity-0 cursor-pointer -mt-4 relative z-10"
          aria-label="Tempo slider"
        />

        {/* BPM presets */}
        <div className="flex flex-wrap gap-1.5">
          {BPM_PRESETS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setTempo(value)}
              aria-label={`Set tempo to ${label}`}
              aria-pressed={tempo === value}
              className={`ux-interactive px-2.5 py-1 text-[10px] font-medium tracking-wide border vibe-badge ${tempo === value ? 'border-transparent' : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)]'}`}
              style={tempo === value ? { background: AMBER_PRIMARY, borderColor: AMBER_PRIMARY, color: '#000' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Rhythm & Groove */}
        <div className="pt-3 border-t border-[var(--border-color)] space-y-2">
          <div className="flex items-center gap-2">
            <Drum className="w-3.5 h-3.5" style={{ color: AMBER_PRIMARY }} aria-hidden="true" />
            <label htmlFor="rhythm-textarea" className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">
              {m.rhythm}
            </label>
            <button
              onClick={() => setIsRhythmDropdownOpen(!isRhythmDropdownOpen)}
              aria-label={isRhythmDropdownOpen ? 'Hide rhythm suggestions' : 'Show rhythm suggestions'}
              aria-expanded={isRhythmDropdownOpen}
              className="ml-auto p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isRhythmDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>
          {isRhythmDropdownOpen && (
            <div className="flex flex-wrap gap-1.5" role="list">
              {RHYTHM_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => { setRhythm(rhythm ? `${rhythm}, ${s}` : s); setIsRhythmDropdownOpen(false); }}
                  aria-label={`Add ${s} to rhythm`}
                  className="ux-interactive px-2 py-0.5 text-[9px] font-medium tracking-wide border bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent-color)]/40 hover:text-[var(--text-primary)] transition-colors vibe-badge"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <textarea
            id="rhythm-textarea"
            value={rhythm}
            onChange={e => setRhythm(e.target.value)}
            placeholder={m.rhythmPlaceholder}
            rows={2}
            aria-label="Rhythm and groove description"
            className="w-full bg-transparent border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] lcars-glow-focus transition-colors resize-none vibe-tile"
          />
        </div>

        {/* Narrative / Vibe */}
        <div className="pt-3 border-t border-[var(--border-color)] space-y-2">
          <div className="flex items-center gap-2">
            <ListMusic className="w-3.5 h-3.5" style={{ color: AMBER_PRIMARY }} aria-hidden="true" />
            <label htmlFor="narrative-textarea" className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">
              {m.narrative}
            </label>
            <button
              onClick={() => setIsNarrativeDropdownOpen(!isNarrativeDropdownOpen)}
              aria-label={isNarrativeDropdownOpen ? 'Hide narrative suggestions' : 'Show narrative suggestions'}
              aria-expanded={isNarrativeDropdownOpen}
              className="ml-auto p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isNarrativeDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>
          {isNarrativeDropdownOpen && (
            <div className="flex flex-wrap gap-1.5" role="list">
              {NARRATIVE_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => { setNarrative(narrative ? `${narrative}, ${s}` : s); setIsNarrativeDropdownOpen(false); }}
                  aria-label={`Add ${s} to narrative`}
                  className="ux-interactive px-2 py-0.5 text-[9px] font-medium tracking-wide border bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent-color)]/40 hover:text-[var(--text-primary)] transition-colors vibe-badge"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <textarea
            id="narrative-textarea"
            value={narrative}
            onChange={e => setNarrative(e.target.value)}
            placeholder={m.narrativePlaceholder}
            rows={2}
            aria-label="Narrative and vibe description"
            className="w-full bg-transparent border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] lcars-glow-focus transition-colors resize-none vibe-tile"
          />
        </div>
      </div>
    </GBPanel>
  );
}
