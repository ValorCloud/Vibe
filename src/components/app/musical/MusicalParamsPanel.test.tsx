import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { buildGenreTooltip } from '../../../constants/musicalData';
import { MusicalParamsPanel } from './MusicalParamsPanel';

describe('MusicalParamsPanel', () => {
  it('shows category summaries beneath the category title and builds genre hover details', () => {
    render(
      <LanguageProvider>
        <MusicalParamsPanel
          genre=""
          setGenre={vi.fn()}
          tempo={120}
          setTempo={vi.fn()}
          instrumentation=""
          setInstrumentation={vi.fn()}
          rhythm=""
          setRhythm={vi.fn()}
          narrative=""
          setNarrative={vi.fn()}
        />
      </LanguageProvider>,
    );

    const heading = screen.getByText('ÉLECTRONIQUE');
    const summary = screen.getByText('Synthetic textures, club energy, and precise pulse-driven production.');
    expect(heading.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(buildGenreTooltip('Synthetic textures, club energy, and precise pulse-driven production.', {
      name: 'House',
      bpm: 128,
      rhythm: 'Electronic (4/4)',
      instruments: ['Synthesizer', 'Sampler', 'TR-909'],
    })).toContain('128 BPM · Electronic (4/4)');
  });

  it('offers the expanded percussion instrument suggestions', () => {
    render(
      <LanguageProvider>
        <MusicalParamsPanel
          genre=""
          setGenre={vi.fn()}
          tempo={120}
          setTempo={vi.fn()}
          instrumentation=""
          setInstrumentation={vi.fn()}
          rhythm=""
          setRhythm={vi.fn()}
          narrative=""
          setNarrative={vi.fn()}
        />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Percussion/i }));

    expect(screen.getByRole('button', { name: 'Tambourine' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guiro' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Triangle' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shaker' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tubular Bells/i })).toBeTruthy();
  });

  it('filters instruments across families via the search field', () => {
    render(
      <LanguageProvider>
        <MusicalParamsPanel
          genre=""
          setGenre={vi.fn()}
          tempo={120}
          setTempo={vi.fn()}
          instrumentation=""
          setInstrumentation={vi.fn()}
          rhythm=""
          setRhythm={vi.fn()}
          narrative=""
          setNarrative={vi.fn()}
        />
      </LanguageProvider>,
    );

    fireEvent.change(screen.getByLabelText(/Search instruments/i), { target: { value: 'sitar' } });

    // Matching instrument is auto-revealed without expanding its family.
    expect(screen.getByRole('button', { name: 'Sitar' })).toBeTruthy();
    // Non-matching instruments are filtered out.
    expect(screen.queryByRole('button', { name: 'Trumpet' })).toBeNull();
  });

  it('shows selected instruments as removable chips and clears them all', () => {
    const setInstrumentation = vi.fn();
    render(
      <LanguageProvider>
        <MusicalParamsPanel
          genre=""
          setGenre={vi.fn()}
          tempo={120}
          setTempo={vi.fn()}
          instrumentation="Violin, Cello"
          setInstrumentation={setInstrumentation}
          rhythm=""
          setRhythm={vi.fn()}
          narrative=""
          setNarrative={vi.fn()}
        />
      </LanguageProvider>,
    );

    // Removing a single chip keeps the rest of the selection.
    fireEvent.click(screen.getByRole('button', { name: /Remove Violin/i }));
    expect(setInstrumentation).toHaveBeenCalledWith('Cello');

    // Clear all wipes the instrumentation string.
    fireEvent.click(screen.getByRole('button', { name: /Clear all/i }));
    expect(setInstrumentation).toHaveBeenCalledWith('');
  });
});
