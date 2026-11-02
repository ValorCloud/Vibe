import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, resolveIp } from './_rateLimit';

const MAX_QUERY_LENGTH = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // --- Rate limiting (shared window with /api/generate) ---
  const ip = resolveIp(
    req.headers as Record<string, string | string[] | undefined>,
    req.socket?.remoteAddress
  );
  const rl = await checkRateLimit(ip);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    res.status(rl.reason === 'quota-unavailable' ? 503 : 429).json({ error: rl.reason === 'quota-unavailable' ? 'Request admission is temporarily unavailable. Please try again later.' : `Rate limit exceeded. Retry after ${rl.retryAfterSec}s.` });
    return;
  }

  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    res.status(400).json({ error: 'Missing required query parameter: q (string)' });
    return;
  }

  if (q.length > MAX_QUERY_LENGTH) {
    res.status(400).json({ error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` });
    return;
  }

  try {
    const encoded = encodeURIComponent(q);
    const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LyricistPro/1.0 (similarity-check)' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      res.status(502).json({ error: `DuckDuckGo upstream error: ${response.status}` });
      return;
    }

    const data = await response.json() as unknown;
    res.status(200).json(data);
  } catch (error: unknown) {
    const isTimeout =
      error instanceof DOMException && error.name === 'TimeoutError';
    if (isTimeout) {
      res.status(504).json({ error: 'DuckDuckGo request timed out.' });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unknown server error';
    res.status(500).json({ error: message });
  }
}
