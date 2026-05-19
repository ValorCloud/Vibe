import { generateContentWithRetry } from '../../utils/aiUtils';
import type { EditMode } from '../../types';

export interface VoiceAssistantContext {
  page: 'lyrics' | 'musical';
  mode: EditMode;
  isFirstCall: boolean;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

export function buildVoiceAssistantSystemPrompt(context: VoiceAssistantContext): string {
  const stateInstruction = context.isFirstCall
    ? 'Because this is the user\'s first time using the voice assistant, begin with a very brief, friendly 1-sentence introduction of your capabilities before answering their query.'
    : 'Bypass all greetings, pleasantries, and introductory fluff. Deliver the direct answer immediately.';

  return [
    'You are a contextual songwriting voice assistant embedded in a lyric editor.',
    `The user is currently in ${context.page} using ${context.mode}.`,
    '',
    'CRITICAL RULES:',
    'Your response will be spoken aloud. Use natural, conversational language. Do not use markdown, bullet points, or complex formatting.',
    'Provide concise, highly actionable guidance based ONLY on the user\'s current context.',
    'Keep the default response to a maximum of 2 sentences and prioritize direct action verbs.',
    stateInstruction,
  ].join('\n');
}

function stripVoiceUnsafeFormatting(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function limitToTwoSentences(text: string): string {
  const normalized = stripVoiceUnsafeFormatting(text);
  if (!normalized) return '';
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map(part => part.trim())
    .filter(Boolean);
  if (sentences.length <= 2) return normalized;
  return sentences.slice(0, 2).join(' ');
}

export async function requestVoiceAssistantReply(query: string, context: VoiceAssistantContext): Promise<string> {
  const prompt = buildVoiceAssistantSystemPrompt(context);
  const response = await generateContentWithRetry({
    model: DEFAULT_MODEL,
    contents: `${prompt}\n\nUser request: ${query}`,
    config: {
      temperature: 0.35,
      maxOutputTokens: 180,
    },
  });
  return limitToTwoSentences(response.text);
}
