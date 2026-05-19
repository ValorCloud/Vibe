/**
 * api/lyria/generate.ts
 * Vercel Serverless Function — POST /api/lyria/generate
 *
 * Accepts a LyriaGenerateParams body, builds a Lyria prompt,
 * calls Google GenAI Lyria 3 (clip) or Lyria 3 Pro (full),
 * and returns a LyriaClip to the client.
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

  // Lyrics are delimited to prevent prompt injection from user-controlled content
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
  const modelId = params.mode === 'full' ? 'lyria-3-pro' : 'lyria-3';
  const prompt = buildPrompt(params);
  const clipId = `lyria_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(params.seed != null ? { generationConfig: { seed: params.seed } } : {}),
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];

    // Synchronous audio response (clip mode)
    if (part && 'inlineData' in part && part.inlineData?.data) {
      const audioDataUri = `data:${part.inlineData.mimeType ?? 'audio/wav'};base64,${part.inlineData.data}`;
      const clip: LyriaClip = {
        id: clipId,
        title: params.title ?? 'Lyria Preview',
        status: 'complete',
        audioUrl: audioDataUri,
        synthIdWatermarked: true,
        durationSeconds: params.mode === 'clip' ? 30 : null,
        model: modelId,
        prompt,
        createdAt: new Date().toISOString(),
        errorMessage: null,
      };
      res.status(200).json(clip);
      return;
    }

    // Async job (Pro / full mode)
    function hasFileData(p: unknown): p is { fileData: string } {
      return typeof p === 'object' && p !== null && typeof (p as Record<string, unknown>)['fileData'] === 'string';
    }
    const jobUri = hasFileData(part) ? part.fileData : undefined;

    const clip: LyriaClip = {
      id: clipId,
      title: params.title ?? 'Lyria Full Song',
      status: jobUri ? 'processing' : 'submitted',
      audioUrl: jobUri ?? null,
      synthIdWatermarked: true,
      durationSeconds: null,
      model: modelId,
      prompt,
      createdAt: new Date().toISOString(),
      errorMessage: null,
    };
    res.status(202).json(clip);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const clip: LyriaClip = {
      id: clipId,
      title: params.title ?? 'Lyria Generation',
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
