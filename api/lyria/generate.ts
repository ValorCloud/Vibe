/**
 * api/lyria/generate.ts
 * Vercel Serverless Function — POST /api/lyria/generate
 *
 * Accepts a LyriaGenerateParams body, builds a Lyria prompt,
 * calls Google GenAI via generateContent:
 *   clip mode → lyria-3-clip-preview  (~30s, synchronous inlineData response)
 *   full mode → lyria-3-pro-preview   (synchronous; may return inlineData or fileData)
 *
 * Secret: GOOGLE_GENAI_API_KEY (Vercel env — never in bundle)
 *
 * Security:
 *   - Internal token guard: LYRIA_INTERNAL_TOKEN env var must match
 *     X-Lyria-Token request header (set by lyriaService client).
 *   - Lyrics are wrapped in an XML-like delimiter block to prevent
 *     prompt injection from user-controlled content.
 *   - req.body validated structurally before use.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import type { LyriaGenerateParams, LyriaClip, LyriaStyleDescriptor } from '../../src/types/lyria';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY ?? '' });

/** Official Gemini API model IDs for Lyria 3 (as of May 2026) */
const LYRIA_MODEL = {
  clip: 'lyria-3-clip-preview',
  full: 'lyria-3-pro-preview',
} as const;

// ─── Auth guard ───────────────────────────────────────────────────────────────
function isAuthorized(req: VercelRequest): boolean {
  const expected = process.env.LYRIA_INTERNAL_TOKEN;
  if (!expected) return true; // token not configured → open (dev mode)
  const provided = req.headers['x-lyria-token'];
  return provided === expected;
}

// ─── Input validation ─────────────────────────────────────────────────────────
function isValidParams(body: unknown): body is LyriaGenerateParams {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b['lyrics'] === 'string' && b['lyrics'].trim().length > 0 &&
    (typeof b['style'] === 'string' || (typeof b['style'] === 'object' && b['style'] !== null)) &&
    (b['mode'] === 'clip' || b['mode'] === 'full')
  );
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(params: LyriaGenerateParams): string {
  const style: string =
    typeof params.style === 'string'
      ? params.style
      : styleDescriptorToString(params.style);

  const MAX_LYRICS = 4_000;
  const safeLyrics = params.lyrics.trim().slice(0, MAX_LYRICS);
  const lyricsBlock = safeLyrics
    ? `\n\n<lyrics>\n${safeLyrics}\n</lyrics>`
    : '';

  const negBlock = params.negativePrompt
    ? `\n\nAvoid: ${params.negativePrompt.slice(0, 500)}`
    : '';

  return `${style}${lyricsBlock}${negBlock}`.trim();
}

function styleDescriptorToString(s: LyriaStyleDescriptor): string {
  const parts: string[] = [s.genre];
  if (s.mood) parts.push(s.mood);
  if (s.tempo) parts.push(`${s.tempo} bpm`);
  if (s.instruments) parts.push(`instruments: ${s.instruments}`);
  if (s.vocalStyle) parts.push(`vocals: ${s.vocalStyle}`);
  if (s.era) parts.push(`era: ${s.era}`);
  return parts.join(', ');
}

function hasInlineData(p: unknown): p is { inlineData: { data: string; mimeType?: string } } {
  return (
    typeof p === 'object' && p !== null &&
    typeof (p as Record<string, unknown>)['inlineData'] === 'object' &&
    typeof ((p as Record<string, unknown>)['inlineData'] as Record<string, unknown>)?.['data'] === 'string'
  );
}

function hasFileData(p: unknown): p is { fileData: { fileUri: string } } {
  return (
    typeof p === 'object' && p !== null &&
    typeof (p as Record<string, unknown>)['fileData'] === 'object' &&
    typeof ((p as Record<string, unknown>)['fileData'] as Record<string, unknown>)?.['fileUri'] === 'string'
  );
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!isValidParams(req.body)) {
    res.status(400).json({ error: 'Missing or invalid required fields: lyrics (string), style (string|object), mode (clip|full)' });
    return;
  }

  const params = req.body;
  const modelId = LYRIA_MODEL[params.mode];
  const prompt = buildPrompt(params);
  const clipId = `lyria_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const title = params.title ?? (params.mode === 'full' ? 'Lyria Full Song' : 'Lyria Preview');

  try {
    // Lyria expects a flat string prompt, not the chat-style {role, parts} format.
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      ...(params.seed != null ? { generationConfig: { seed: params.seed } } : {}),
    });

    // Scan ALL parts — Lyria may return a text part before the audio part.
    const parts: unknown[] = response.candidates?.[0]?.content?.parts ?? [];

    const inlinePart = parts.find(hasInlineData);
    if (inlinePart) {
      const audioDataUri = `data:${inlinePart.inlineData.mimeType ?? 'audio/wav'};base64,${inlinePart.inlineData.data}`;
      const clip: LyriaClip = {
        id: clipId,
        title,
        status: 'complete',
        audioUrl: audioDataUri,
        synthIdWatermarked: true,
        durationSeconds: null,
        model: modelId,
        prompt,
        createdAt: new Date().toISOString(),
        errorMessage: null,
      };
      res.status(200).json(clip);
      return;
    }

    const filePart = parts.find(hasFileData);
    if (filePart) {
      const clip: LyriaClip = {
        id: clipId,
        title,
        status: 'complete',
        audioUrl: filePart.fileData.fileUri,
        synthIdWatermarked: true,
        durationSeconds: null,
        model: modelId,
        prompt,
        createdAt: new Date().toISOString(),
        errorMessage: null,
      };
      res.status(200).json(clip);
      return;
    }

    // No usable audio part in the response
    const clip: LyriaClip = {
      id: clipId,
      title,
      status: 'error',
      audioUrl: null,
      synthIdWatermarked: false,
      durationSeconds: null,
      model: modelId,
      prompt,
      createdAt: new Date().toISOString(),
      errorMessage: 'No audio data returned by Lyria API.',
    };
    res.status(502).json(clip);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const clip: LyriaClip = {
      id: clipId,
      title,
      status: 'error',
      audioUrl: null,
      synthIdWatermarked: false,
      durationSeconds: null,
      model: modelId,
      prompt,
      createdAt: new Date().toISOString(),
      errorMessage: message,
    };
    res.status(500).json(clip);
  }
}
