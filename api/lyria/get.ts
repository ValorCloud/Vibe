/**
 * api/lyria/get.ts
 * Vercel Serverless Function — GET /api/lyria/get?id=…
 *
 * Polls a Lyria Pro async job status.
 *
 * NOTE: Google GenAI SDK does not yet expose a stable async job-status
 * endpoint for Lyria 3 Pro. Until it does, full-song generation is handled
 * synchronously in generate.ts (the model blocks until done, or times out).
 * This endpoint is kept for forward-compatibility with the polling pattern
 * and returns a structured "not implemented" error so callers fail fast
 * instead of spinning until timeout.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const id = typeof req.query['id'] === 'string' ? req.query['id'] : null;

  if (!id) {
    res.status(400).json({ error: 'Missing required query param: id' });
    return;
  }

  // Google GenAI async job polling not yet available in SDK.
  // Return 501 so generateAndPoll throws immediately rather than timing out.
  res.status(501).json({
    error: 'Lyria async job polling not yet implemented. Full-song generation runs synchronously in /api/lyria/generate.',
    id,
  });
}
