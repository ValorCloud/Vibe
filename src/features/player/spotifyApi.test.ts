import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { spotifyFetch, SpotifyApiError } from './spotifyApi';
import type { SpotifyTokenProvider } from '../../types/spotify';

describe('spotifyFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns parsed payload when first request succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: 'ok' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const tokens: SpotifyTokenProvider = {
      getValidToken: vi.fn(async () => 'token-1'),
      forceRefreshToken: vi.fn(async () => 'token-2'),
    };
    const schema = z.object({ value: z.string() });

    const result = await spotifyFetch('https://api.spotify.com/v1/me', tokens, {
      parse: (payload) => schema.parse(payload),
    });

    expect(result.value).toBe('ok');
    expect(tokens.forceRefreshToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once with force-refreshed token after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'expired access token' } }), { status: 401 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 'retry-ok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const tokens: SpotifyTokenProvider = {
      getValidToken: vi.fn(async () => 'token-1'),
      forceRefreshToken: vi.fn(async () => 'token-2'),
    };

    const result = await spotifyFetch<{ value: string }>('https://api.spotify.com/v1/me', tokens);

    expect(result.value).toBe('retry-ok');
    expect(tokens.forceRefreshToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.spotify.com/v1/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-2' }),
      }),
    );
  });

  it('deduplicates concurrent force refresh calls for the same provider', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
      if (auth === 'Bearer initial-token') {
        return new Response(JSON.stringify({ error: { message: 'expired access token' } }), { status: 401 });
      }
      return new Response(JSON.stringify({ value: 'ok' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const forceRefreshToken = vi.fn(
      async () =>
        await new Promise<string>((resolve) => {
          setTimeout(() => resolve('fresh-token'), 0);
        }),
    );
    const tokens: SpotifyTokenProvider = {
      getValidToken: vi.fn(async () => 'initial-token'),
      forceRefreshToken,
    };

    const [left, right] = await Promise.all([
      spotifyFetch<{ value: string }>('https://api.spotify.com/v1/me', tokens),
      spotifyFetch<{ value: string }>('https://api.spotify.com/v1/me', tokens),
    ]);

    expect(left.value).toBe('ok');
    expect(right.value).toBe('ok');
    expect(forceRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('throws SpotifyApiError when refresh is unavailable after 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'invalid token' } }), { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const tokens: SpotifyTokenProvider = {
      getValidToken: vi.fn(async () => 'token-1'),
      forceRefreshToken: vi.fn(async () => null),
    };

    await expect(spotifyFetch('https://api.spotify.com/v1/me', tokens)).rejects.toMatchObject({
      name: 'SpotifyApiError',
      status: 401,
      message: 'invalid token',
    } satisfies Partial<SpotifyApiError>);
  });
});
