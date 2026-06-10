import React from 'react';
import { Guitar, Search, X } from '../../ui/icons';
import { GBPanel } from '../../ui/GBPanel';
import { useTranslation } from '../../../i18n';
import { INSTRUMENT_FAMILIES } from '../../../constants/musicalData';

const AMBER_PRIMARY = 'var(--lcars-amber)';

interface Props {
  instrumentation: string;
  selectedInstruments: string[];
  instrumentQuery: string;
  setInstrumentQuery: (v: string) => void;
  expandedFamily: string | null;
  setExpandedFamily: (v: string | null) => void;
  onToggleInstrument: (name: string) => void;
  onRemoveInstrument: (name: string) => void;
  onClearInstruments: () => void;
  setInstrumentation: (v: string) => void;
}

export function MusicalInstrumentsPanel({
  instrumentation,
  selectedInstruments,
  instrumentQuery,
  setInstrumentQuery,
  expandedFamily,
  setExpandedFamily,
  onToggleInstrument,
  onRemoveInstrument,
  onClearInstruments,
  setInstrumentation,
}: Props) {
  const { t } = useTranslation();
  const m = t.musical;

  const normalizedQuery = instrumentQuery.trim().toLowerCase();
  const filteredFamilies = normalizedQuery
    ? INSTRUMENT_FAMILIES
        .map(family => {
          const familyMatches = family.label.toLowerCase().includes(normalizedQuery);
          const instruments = familyMatches
            ? family.instruments
            : family.instruments.filter(i => i.name.toLowerCase().includes(normalizedQuery));
          return { ...family, instruments };
        })
        .filter(family => family.instruments.length > 0)
    : INSTRUMENT_FAMILIES;

  return (
    <GBPanel>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Guitar className="w-4 h-4" style={{ color: AMBER_PRIMARY }} aria-hidden="true" />
          <label htmlFor="instrumentation-textarea" className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">
            {m.instruments}
          </label>
          {selectedInstruments.length > 0 && (
            <>
              <span
                className="ml-auto text-[10px] font-medium px-1.5 py-0.5 vibe-badge"
                style={{ background: `${AMBER_PRIMARY}22`, color: AMBER_PRIMARY }}
                role="status"
                aria-live="polite"
                aria-label={`${selectedInstruments.length} instruments selected`}
              >
                {selectedInstruments.length}
              </span>
              <button
                onClick={onClearInstruments}
                aria-label={m.clearAllInstruments}
                className="ux-interactive text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 border text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] transition-colors vibe-badge"
              >
                {m.clearAll}
              </button>
            </>
          )}
        </div>

        {/* Selected instrument chips */}
        {selectedInstruments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedInstruments.map(name => (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border vibe-badge"
                style={{ background: `${AMBER_PRIMARY}1f`, borderColor: `${AMBER_PRIMARY}55`, color: AMBER_PRIMARY }}
              >
                <span>{name}</span>
                <button
                  onClick={() => onRemoveInstrument(name)}
                  aria-label={`${m.removeInstrument} ${name}`}
                  className="ux-interactive inline-flex items-center justify-center hover:opacity-70 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
          <input
            type="text"
            value={instrumentQuery}
            onChange={e => setInstrumentQuery(e.target.value)}
            placeholder={m.searchInstruments}
            aria-label={m.searchInstruments}
            className="w-full bg-transparent border border-[var(--border-color)] pl-8 pr-7 py-1.5 text-[11px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] lcars-glow-focus transition-colors vibe-tile"
          />
          {instrumentQuery && (
            <button
              onClick={() => setInstrumentQuery('')}
              aria-label={m.clearSearch}
              className="ux-interactive absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Instrument family tree */}
        <div className="space-y-1.5">
          {filteredFamilies.length === 0 && (
            <p className="text-[10px] text-[var(--text-secondary)] opacity-70 px-1 py-2">{m.noInstrumentsFound}</p>
          )}
          {filteredFamilies.map(family => {
            const isExpanded = normalizedQuery ? true : expandedFamily === family.label;
            const familySelected = family.instruments.filter(i => selectedInstruments.includes(i.name));
            return (
              <div key={family.label}>
                <button
                  onClick={() => { if (!normalizedQuery) setExpandedFamily(isExpanded ? null : family.label); }}
                  aria-expanded={isExpanded}
                  aria-label={`${family.label} instrument family. ${familySelected.length} selected`}
                  className="ux-interactive w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-medium tracking-wide border text-left vibe-tile"
                  style={familySelected.length > 0
                    ? { background: `${AMBER_PRIMARY}1a`, borderColor: `${AMBER_PRIMARY}55`, color: AMBER_PRIMARY }
                    : { background: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  <span aria-hidden="true">{family.emoji}</span>
                  <span>{family.label}</span>
                  {familySelected.length > 0 && (
                    <span
                      className="ml-1 text-[9px] font-bold px-1"
                      style={{ borderRadius: '4px', background: AMBER_PRIMARY, color: '#000' }}
                      aria-hidden="true"
                    >
                      {familySelected.length}
                    </span>
                  )}
                  <span className="ml-auto opacity-50" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                </button>
                {isExpanded && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 pl-2">
                    {family.instruments.map(instrument => {
                      const sel = selectedInstruments.includes(instrument.name);
                      return (
                        <button
                          key={instrument.name}
                          onClick={() => onToggleInstrument(instrument.name)}
                          aria-pressed={sel}
                          aria-label={`${sel ? 'Deselect' : 'Select'} ${instrument.name}`}
                          className={`ux-interactive flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium tracking-wide border vibe-badge ${sel ? 'border-transparent' : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)]'}`}
                          style={sel ? { background: `${AMBER_PRIMARY}33`, borderColor: AMBER_PRIMARY, color: AMBER_PRIMARY } : {}}
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

        {/* Free-text instrumentation override */}
        <textarea
          id="instrumentation-textarea"
          value={instrumentation}
          onChange={e => setInstrumentation(e.target.value)}
          placeholder={m.instrumentationPlaceholder}
          rows={2}
          aria-label="Instrumentation description"
          className="w-full bg-transparent border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] lcars-glow-focus transition-colors resize-none vibe-tile"
        />
      </div>
    </GBPanel>
  );
}
