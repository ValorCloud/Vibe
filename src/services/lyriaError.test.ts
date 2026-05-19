import { describe, it, expect } from 'vitest';
import { parseLyriaError } from './lyriaError';

describe('parseLyriaError', () => {
  it('maps 401 proxy errors to auth', () => {
    const out = parseLyriaError(new Error('[Lyria] 401: {"error":"Unauthorized"}'));
    expect(out.kind).toBe('auth');
    expect(out.statusCode).toBe(401);
  });

  it('maps 403 to auth', () => {
    const out = parseLyriaError(new Error('[Lyria] 403: forbidden'));
    expect(out.kind).toBe('auth');
    expect(out.statusCode).toBe(403);
  });

  it('maps 429 to rateLimit', () => {
    const out = parseLyriaError(new Error('[Lyria] 429: Too Many Requests'));
    expect(out.kind).toBe('rateLimit');
    expect(out.statusCode).toBe(429);
  });

  it('maps 5xx to server', () => {
    expect(parseLyriaError(new Error('[Lyria] 500: oops')).kind).toBe('server');
    expect(parseLyriaError(new Error('[Lyria] 502: upstream')).kind).toBe('server');
  });

  it('maps poll-timeout messages to timeout', () => {
    const out = parseLyriaError(new Error('[Lyria] generateAndPoll: timeout exceeded'));
    expect(out.kind).toBe('timeout');
    expect(out.statusCode).toBeNull();
  });

  it('maps "Failed to fetch" to network', () => {
    const out = parseLyriaError(new TypeError('Failed to fetch'));
    expect(out.kind).toBe('network');
  });

  it('falls back to unknown when nothing matches', () => {
    const out = parseLyriaError('some other error');
    expect(out.kind).toBe('unknown');
    expect(out.raw).toBe('some other error');
  });
});
