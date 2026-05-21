import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n';
import { LyriaPreviewPanel } from './LyriaPreviewPanel';
import { generateAndPoll } from '../../services/lyriaService';

vi.mock('../../services/lyriaService', () => ({
  getLyriaKPISnapshot: () => ({
    totalRequests: 1,
    successCount: 1,
    errorCount: 0,
    pendingCount: 0,
    lastGenerationMs: 1200,
    lastError: null,
  }),
  generateAndPoll: vi.fn().mockResolvedValue({
    id: 'clip-1',
    title: 'Preview Clip',
    status: 'complete',
    audioUrl: 'data:audio/wav;base64,abc',
    synthIdWatermarked: true,
    durationSeconds: null,
    model: 'lyria-3-clip-preview',
    prompt: 'prompt',
    createdAt: '2026-05-19T00:00:00.000Z',
    errorMessage: null,
  }),
}));

describe('LyriaPreviewPanel', () => {
  beforeEach(() => {
    vi.mocked(generateAndPoll).mockClear();
    vi.mocked(generateAndPoll).mockResolvedValue({
      id: 'clip-1',
      title: 'Preview Clip',
      status: 'complete',
      audioUrl: 'data:audio/wav;base64,abc',
      synthIdWatermarked: true,
      durationSeconds: null,
      model: 'lyria-3-clip-preview',
      prompt: 'prompt',
      createdAt: '2026-05-19T00:00:00.000Z',
      errorMessage: null,
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders musical badges with accessible labels and removal controls', () => {
    render(
      <LanguageProvider>
        <LyriaPreviewPanel
          lyrics="Sing it"
          initialGenre="afrobeats"
          initialMood="joyful"
          initialTempo={100}
          initialInstrumentation="talking drum"
        />
      </LanguageProvider>,
    );

    // Param badges render as `Label: value` with aria-label for accessibility.
    expect(screen.getByLabelText('Style: afrobeats')).toBeTruthy();
    expect(screen.getByLabelText('Mood: joyful')).toBeTruthy();
    expect(screen.getByLabelText('BPM: 100')).toBeTruthy();
    expect(screen.getByLabelText('Instrumentation: talking drum')).toBeTruthy();
    // Dismiss button aria-label is `Remove ${field}` (see renderParamBadge in LyriaPreviewPanel).
    expect(screen.getByRole('button', { name: 'Remove instrumentation' })).toBeTruthy();
  });

  // NOTE: 'syncs the Lyria style prompt with instrumentation to the prompt container'
  // test REMOVED — onPromptReady no longer fires on mount or param change.
  // It fires only in handleGenerate (explicit user action). See 'removes prompt badges' below.

  it('removes prompt badges from the next Lyria prompt', async () => {
    const user = userEvent.setup();
    const onPromptReady = vi.fn();

    render(
      <LanguageProvider>
        <LyriaPreviewPanel
          lyrics="Sing it"
          initialGenre="afrobeats"
          initialMood="joyful"
          initialTempo={100}
          initialInstrumentation="talking drum"
          onPromptReady={onPromptReady}
        />
      </LanguageProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Remove instrumentation' }));

    // onPromptReady not called yet — fires only on Generate
    expect(onPromptReady).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Alt+A to generate quickly' }));

    await waitFor(() => {
      expect(generateAndPoll).toHaveBeenCalled();
    });
    expect(generateAndPoll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        style: expect.not.stringContaining('talking drum'),
      }),
      expect.any(Object),
    );
    // onPromptReady called with style string that excludes instrumentation
    await waitFor(() => {
      expect(onPromptReady).toHaveBeenCalledWith(expect.not.stringContaining('talking drum'));
    });
  });

  // Chip-rendering contract: locks the `Label: value` chip format for every
  // structured-prompt field, including the visible label text (so an emoji-only
  // regression cannot pass with aria-label alone) and the 60-char narrative
  // truncation rule. Mirrors the structure of renderParamBadge in
  // LyriaPreviewPanel and the docstring "Style: …, Mood: …, BPM: …,
  // Instrumentation: …, Vocals: …" prompt format.
  it('renders structured chips with `Label: value` format and removes them on dismiss', async () => {
    const user = userEvent.setup();
    const longNarrative =
      'A windswept harbour at dusk where neon reflections fracture across the wet pier and the wind hums';
    // First 60 chars + ellipsis (\u2026 = …).
    const expectedNarrativeValue = longNarrative.slice(0, 60) + '\u2026';

    const { container } = render(
      <LanguageProvider>
        <LyriaPreviewPanel
          lyrics="Sing it"
          initialGenre="afrobeats"
          initialMood="joyful"
          initialTempo={100}
          initialInstrumentation="talking drum"
          initialRhythm="syncopated polyrhythm"
          initialNarrative={longNarrative}
        />
      </LanguageProvider>,
    );

    // aria-label contract for every structured field.
    expect(screen.getByLabelText('Style: afrobeats')).toBeTruthy();
    expect(screen.getByLabelText('Mood: joyful')).toBeTruthy();
    expect(screen.getByLabelText('BPM: 100')).toBeTruthy();
    expect(screen.getByLabelText('Instrumentation: talking drum')).toBeTruthy();
    expect(screen.getByLabelText('Rhythm: syncopated polyrhythm')).toBeTruthy();
    expect(screen.getByLabelText(`Narrative: ${expectedNarrativeValue}`)).toBeTruthy();

    // Visible-text contract: the `Label:` portion must appear in rendered DOM
    // text, not only in aria-label. Catches refactors that swap labels for
    // icons/emoji while leaving aria-label untouched.
    const text = container.textContent ?? '';
    for (const label of ['Style:', 'Mood:', 'BPM:', 'Instrumentation:', 'Rhythm:', 'Narrative:']) {
      expect(text).toContain(label);
    }
    expect(text).toContain('afrobeats');
    expect(text).toContain(expectedNarrativeValue);

    // Removal contract: clicking the per-chip Remove button drops both the
    // chip and its dismiss button from the DOM.
    await user.click(screen.getByRole('button', { name: 'Remove rhythm' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('Rhythm: syncopated polyrhythm')).toBeNull();
    });
    expect(screen.queryByRole('button', { name: 'Remove rhythm' })).toBeNull();
  });

  it('relies on native audio controls without adding a second play button', async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <LyriaPreviewPanel lyrics="Sing it" initialGenre="afrobeats" />
      </LanguageProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Alt+A to generate quickly' }));

    await waitFor(() => {
      expect(generateAndPoll).toHaveBeenCalled();
    });
    // aria-label matches `Preview — ${doneClip.title}` in LyriaPreviewPanel
    await screen.findByLabelText('Preview — Preview Clip');
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('calls onParamRemoved with the correct field when badge is dismissed', async () => {
    const user = userEvent.setup();
    const onParamRemoved = vi.fn();

    render(
      <LanguageProvider>
        <LyriaPreviewPanel
          lyrics="Sing it"
          initialGenre="afrobeats"
          initialMood="joyful"
          initialInstrumentation="talking drum"
          onParamRemoved={onParamRemoved}
        />
      </LanguageProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Remove genre' }));
    expect(onParamRemoved).toHaveBeenCalledWith('genre');
    expect(onParamRemoved).toHaveBeenCalledTimes(1);

    // Badge removed from DOM
    expect(screen.queryByLabelText('Style: afrobeats')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove genre' })).toBeNull();

    // Other badges unaffected
    expect(screen.getByLabelText('Mood: joyful')).toBeTruthy();
    expect(screen.getByLabelText('Instrumentation: talking drum')).toBeTruthy();
  });

  it('re-includes a badge when its live prop changes externally after dismiss', async () => {
    const user = userEvent.setup();
    const onParamRemoved = vi.fn();

    const { rerender } = render(
      <LanguageProvider>
        <LyriaPreviewPanel
          lyrics="Sing it"
          genre="afrobeats"
          onParamRemoved={onParamRemoved}
        />
      </LanguageProvider>,
    );

    // Dismiss genre badge
    await user.click(screen.getByRole('button', { name: 'Remove genre' }));
    expect(screen.queryByLabelText('Style: afrobeats')).toBeNull();

    // Parent pushes a new genre value (bidirectional sync v1.31.0.5)
    rerender(
      <LanguageProvider>
        <LyriaPreviewPanel
          lyrics="Sing it"
          genre="highlife"
          onParamRemoved={onParamRemoved}
        />
      </LanguageProvider>,
    );

    // useEffect([activeGenre]) re-includes 'genre' → badge reappears with new value
    await waitFor(() => {
      expect(screen.getByLabelText('Style: highlife')).toBeTruthy();
    });
  });
});
