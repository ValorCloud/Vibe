import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildVoiceAssistantSystemPrompt,
  limitToTwoSentences,
  requestVoiceAssistantReply,
} from './voiceAssistantOrchestrator';

const mockGenerateContentWithRetry = vi.fn();

vi.mock('../../utils/aiUtils', () => ({
  generateContentWithRetry: (...args: unknown[]) => mockGenerateContentWithRetry(...args),
}));

describe('voiceAssistantOrchestrator', () => {
  beforeEach(() => {
    mockGenerateContentWithRetry.mockReset();
  });

  it('injects first-call onboarding instructions in the system prompt', () => {
    const prompt = buildVoiceAssistantSystemPrompt({
      page: 'lyrics',
      mode: 'section',
      isFirstCall: true,
    });

    expect(prompt).toContain('first time using the voice assistant');
    expect(prompt).toContain('maximum of 2 sentences');
  });

  it('injects direct-execution instruction after onboarding', () => {
    const prompt = buildVoiceAssistantSystemPrompt({
      page: 'musical',
      mode: 'markdown',
      isFirstCall: false,
    });

    expect(prompt).toContain('Bypass all greetings, pleasantries, and introductory fluff');
  });

  it('limits output to two sentences for spoken responses', () => {
    expect(limitToTwoSentences('Première phrase. Deuxième phrase. Troisième phrase.')).toBe('Première phrase. Deuxième phrase.');
  });

  it('requests AI reply and normalizes it for voice output', async () => {
    mockGenerateContentWithRetry.mockResolvedValue({
      text: 'Action one. Action two. Extra sentence.',
    });

    const reply = await requestVoiceAssistantReply('Calibre la ligne 3.', {
      page: 'lyrics',
      mode: 'section',
      isFirstCall: false,
    });

    expect(mockGenerateContentWithRetry).toHaveBeenCalledTimes(1);
    expect(reply).toBe('Action one. Action two.');
  });
});
