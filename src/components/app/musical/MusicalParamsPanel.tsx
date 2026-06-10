import React, { useState, useCallback, useMemo } from 'react';
import { RHYTHM_BPM } from '../../../constants/rhythmBpm';
import {
  VIBE_CATEGORIES,
  parseInstrumentation,
  getSubStyleEntries,
  getSubStyleNames,
} from '../../../constants/musicalData';
import type { VibeTile, VibeCategory, SubStyleEntry } from '../../../constants/musicalData';
import { MusicalVibeBoard } from './MusicalVibeBoard';
import { MusicalTempoPanel } from './MusicalTempoPanel';
import { MusicalInstrumentsPanel } from './MusicalInstrumentsPanel';

interface Props {
  genre: string; setGenre: (v: string) => void;
  tempo: number; setTempo: (v: number) => void;
  instrumentation: string; setInstrumentation: (v: string) => void;
  rhythm: string; setRhythm: (v: string) => void;
  narrative: string; setNarrative: (v: string) => void;
  onWorkflowStepComplete?: (step: number) => void;
}

export function MusicalParamsPanel({
  genre, setGenre,
  tempo, setTempo,
  instrumentation, setInstrumentation,
  rhythm, setRhythm,
  narrative, setNarrative,
  onWorkflowStepComplete,
}: Props) {
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [instrumentQuery, setInstrumentQuery] = useState('');
  const [selectedVibeTile, setSelectedVibeTile] = useState<VibeTile | null>(null);
  const [selectedSubStyle, setSelectedSubStyle] = useState<string>('');
  const [isRhythmDropdownOpen, setIsRhythmDropdownOpen] = useState(false);
  const [isNarrativeDropdownOpen, setIsNarrativeDropdownOpen] = useState(false);

  const selectedCategory = useMemo<VibeCategory | null>(
    () => selectedVibeTile
      ? VIBE_CATEGORIES.find(cat => cat.tiles.some(tile => tile.name === selectedVibeTile.name)) ?? null
      : null,
    [selectedVibeTile],
  );

  const selectedAccent = useMemo(
    () => selectedCategory?.color ?? 'var(--lcars-amber)',
    [selectedCategory],
  );

  const genreBlueprint = useMemo(
    () => selectedVibeTile
      ? (selectedSubStyle ? `${selectedVibeTile.name} / ${selectedSubStyle}` : selectedVibeTile.name)
      : genre,
    [selectedVibeTile, selectedSubStyle, genre],
  );

  const suggestedSubStyles = useMemo(
    () => selectedVibeTile ? getSubStyleNames(selectedVibeTile.name) : [],
    [selectedVibeTile],
  );

  const selectedSubStyleEntry = useMemo<SubStyleEntry | null>(
    () => selectedVibeTile && selectedSubStyle
      ? getSubStyleEntries(selectedVibeTile.name).find(e => e.name === selectedSubStyle) ?? null
      : null,
    [selectedVibeTile, selectedSubStyle],
  );

  const selectedInstruments = useMemo(() => parseInstrumentation(instrumentation), [instrumentation]);

  const handleVibeTileSelect = useCallback((tile: VibeTile) => {
    if (selectedVibeTile?.name === tile.name) {
      setSelectedVibeTile(null);
      setSelectedSubStyle('');
      return;
    }
    setSelectedVibeTile(tile);
    setSelectedSubStyle('');
    setGenre(tile.name);
    setTempo(RHYTHM_BPM[tile.rhythm] ?? tile.bpm);
    setRhythm(tile.rhythm);
    setInstrumentation(tile.instruments.join(', '));
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
    if (next) onWorkflowStepComplete?.(2);
  }, [selectedSubStyle, selectedVibeTile, setGenre, setRhythm, setTempo, setInstrumentation, onWorkflowStepComplete]);

  const toggleInstrument = useCallback((instrument: string) => {
    const current = parseInstrumentation(instrumentation);
    const idx = current.indexOf(instrument);
    setInstrumentation(idx >= 0
      ? current.filter(i => i !== instrument).join(', ')
      : [...current, instrument].join(', '));
  }, [instrumentation, setInstrumentation]);

  const removeInstrument = useCallback((instrument: string) => {
    setInstrumentation(parseInstrumentation(instrumentation).filter(i => i !== instrument).join(', '));
  }, [instrumentation, setInstrumentation]);

  const clearInstruments = useCallback(() => setInstrumentation(''), [setInstrumentation]);

  return (
    <div className="space-y-5">
      <MusicalVibeBoard
        selectedVibeTile={selectedVibeTile}
        selectedSubStyle={selectedSubStyle}
        selectedCategory={selectedCategory}
        selectedAccent={selectedAccent}
        genreBlueprint={genreBlueprint}
        suggestedSubStyles={suggestedSubStyles}
        selectedSubStyleEntry={selectedSubStyleEntry}
        onVibeTileSelect={handleVibeTileSelect}
        onSubStyleSelect={handleSubStyleSelect}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MusicalTempoPanel
          tempo={tempo} setTempo={setTempo}
          rhythm={rhythm} setRhythm={setRhythm}
          narrative={narrative} setNarrative={setNarrative}
          isRhythmDropdownOpen={isRhythmDropdownOpen}
          setIsRhythmDropdownOpen={setIsRhythmDropdownOpen}
          isNarrativeDropdownOpen={isNarrativeDropdownOpen}
          setIsNarrativeDropdownOpen={setIsNarrativeDropdownOpen}
        />
        <MusicalInstrumentsPanel
          instrumentation={instrumentation}
          selectedInstruments={selectedInstruments}
          instrumentQuery={instrumentQuery}
          setInstrumentQuery={setInstrumentQuery}
          expandedFamily={expandedFamily}
          setExpandedFamily={setExpandedFamily}
          onToggleInstrument={toggleInstrument}
          onRemoveInstrument={removeInstrument}
          onClearInstruments={clearInstruments}
          setInstrumentation={setInstrumentation}
        />
      </div>
    </div>
  );
}
