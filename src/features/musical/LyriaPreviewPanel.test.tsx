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
    vi.clearAllMocks();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders keyboard-focusable musical badges with accessible labels', () => {
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

    expect(screen.getByLabelText('Genre: afrobeats').getAttribute('tabindex')).toBe('0');
    expect(screen.getByLabelText('Mood: joyful').getAttribute('tabindex')).toBe('0');
    expect(screen.getByLabelText('Tempo: 100 BPM').getAttribute('tabindex')).toBe('0');
    expect(screen.getByLabelText('Instrumentation: talking drum').getAttribute('tabindex')).toBe('0');
  });

  it('syncs the Lyria style prompt with instrumentation to the prompt container', async () => {
    const onPromptReady = vi.fn();

    render(
      <LanguageProvider>
        <LyriaPreviewPanel
          lyrics="Sing it"
          initialGenre="afrobeats"
          initialMood="joyful"
          initialTempo={100}
          initialInstrumentation="talking drum, bass"
          onPromptReady={onPromptReady}
        />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(onPromptReady).toHaveBeenCalledWith(expect.stringContaining('instruments: talking drum, bass'));
    });
  });

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

    await user.click(screen.getByRole('button', { name: 'Remove instrumentation from Lyria prompt' }));

    await waitFor(() => {
      expect(onPromptReady).toHaveBeenLastCalledWith(expect.not.stringContaining('talking drum'));
    });

    await user.click(screen.getByRole('button', { name: /Generate preview/i }));

    await waitFor(() => {
      expect(generateAndPoll).toHaveBeenCalled();
    });
    expect(generateAndPoll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        style: expect.not.objectContaining({ instruments: expect.any(String) }),
      }),
      expect.any(Object),
    );
  });

  it('relies on native audio controls without adding a second play button', async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <LyriaPreviewPanel lyrics="Sing it" initialGenre="afrobeats" />
      </LanguageProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Generate preview/i }));

    await screen.findByLabelText('Preview audio — Preview Clip');
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });
});
