/**
 * lyriaError.ts
 * Maps raw Lyria proxy / network errors into a small, UX-friendly shape:
 *   { kind, statusCode?, raw }
 *
 * The proxy throws messages of the form `[Lyria] <status>: <body>`
 * (see lyriaService.proxyFetch). Generation timeouts surface as
 * `[Lyria] generateAndPoll: timeout exceeded` or `[Lyria] Full-song …`.
 * Anything else is treated as a network error.
 *
 * Used by LyriaPreviewPanel and LyriaFullSongPanel to render localised,
 * actionable error banners instead of the raw proxy string.
 */

export type LyriaErrorKind =
  | 'auth'        // 401 / 403
  | 'rateLimit'   // 429
  | 'server'      // 5xx
  | 'timeout'     // poll timeout / synchronous timeout
  | 'network'     // fetch rejected, offline, DNS, etc.
  | 'unknown';

export interface ParsedLyriaError {
  kind: LyriaErrorKind;
  statusCode: number | null;
  /** Raw message from the underlying error — kept for the details/devtools surface. */
  raw: string;
}

const STATUS_RE = /\[Lyria\]\s+(\d{3})\b/;
const TIMEOUT_RE = /timeout/i;

export function parseLyriaError(err: unknown): ParsedLyriaError {
  const raw = err instanceof Error ? err.message : String(err);

  const match = STATUS_RE.exec(raw);
  if (match) {
    const statusCode = Number(match[1]);
    if (statusCode === 401 || statusCode === 403) {
      return { kind: 'auth', statusCode, raw };
    }
    if (statusCode === 429) {
      return { kind: 'rateLimit', statusCode, raw };
    }
    if (statusCode >= 500 && statusCode <= 599) {
      return { kind: 'server', statusCode, raw };
    }
    return { kind: 'unknown', statusCode, raw };
  }

  if (TIMEOUT_RE.test(raw)) {
    return { kind: 'timeout', statusCode: null, raw };
  }

  if (raw.toLowerCase().includes('failed to fetch') || raw.toLowerCase().includes('networkerror')) {
    return { kind: 'network', statusCode: null, raw };
  }

  return { kind: 'unknown', statusCode: null, raw };
}
