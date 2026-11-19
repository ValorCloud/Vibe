import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Re-import after resetModules to get a fresh in-memory Map.

describe('resolveIp', () => {
  it('returns first x-forwarded-for entry', async () => {
    const { resolveIp } = await import('./_rateLimit');
    expect(resolveIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })).toBe('1.2.3.4');
  });

  it('returns first of array x-forwarded-for', async () => {
    const { resolveIp } = await import('./_rateLimit');
    expect(resolveIp({ 'x-forwarded-for': ['9.9.9.9', '8.8.8.8'] })).toBe('9.9.9.9');
  });

  it('falls back to socketAddress', async () => {
    const { resolveIp } = await import('./_rateLimit');
    expect(resolveIp({}, '127.0.0.1')).toBe('127.0.0.1');
  });

  it('returns unknown when no IP available', async () => {
    const { resolveIp } = await import('./_rateLimit');
    expect(resolveIp({})).toBe('unknown');
  });
});

describe('checkRateLimit — in-memory sliding window (no Upstash)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('VERCEL_ENV', '');
    // Ensure Upstash env vars are absent so the in-memory path is exercised.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('allows requests up to MAX within window', async () => {
    const { checkRateLimit } = await import('./_rateLimit');
    for (let i = 0; i < 20; i++) {
      expect((await checkRateLimit('ip-a')).allowed).toBe(true);
    }
  });

  it('blocks the 21st request', async () => {
    const { checkRateLimit } = await import('./_rateLimit');
    for (let i = 0; i < 20; i++) await checkRateLimit('ip-b');
    const result = await checkRateLimit('ip-b');
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.retryAfterSec).toBeGreaterThan(0);
  });

  it('allows again after window expires', async () => {
    const { checkRateLimit } = await import('./_rateLimit');
    for (let i = 0; i < 20; i++) await checkRateLimit('ip-c');
    vi.advanceTimersByTime(61_000);
    expect((await checkRateLimit('ip-c')).allowed).toBe(true);
  });

  it('isolates buckets per IP', async () => {
    const { checkRateLimit } = await import('./_rateLimit');
    for (let i = 0; i < 20; i++) await checkRateLimit('ip-x');
    expect((await checkRateLimit('ip-y')).allowed).toBe(true);
  });
});

describe('checkRateLimit — distributed admission refuses uncertainty', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('refuses a lost response without retry or fallback', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('response lost'));
    vi.stubGlobal('fetch', fetcher);
    const { checkRateLimit } = await import('./_rateLimit');
    expect(await checkRateLimit('ip-fallback')).toMatchObject({ allowed: false, reason: 'quota-unavailable' });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([{ error: 'denied' }, { result: [1, 10] }, { result: [0, 0] }, { result: [2, 0] }, { result: 'OK' }])('rejects invalid Redis result %j', async value => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value))));
    const { checkRateLimit } = await import('./_rateLimit');
    expect(await checkRateLimit('ip')).toMatchObject({ allowed: false, reason: 'quota-unavailable' });
  });
  it('uses one EVAL with different members for calls at the same instant', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ result: [1, 0] })));
    vi.stubGlobal('fetch', fetcher);
    const { checkRateLimit } = await import('./_rateLimit');
    await Promise.all([checkRateLimit('ip'), checkRateLimit('ip'), checkRateLimit('ip')]);
    const commands = fetcher.mock.calls.map(call => JSON.parse(call[1].body));
    expect(commands.every(command => command[0] === 'EVAL' && command[2] === '2')).toBe(true);
    expect(new Set(commands.map(command => command.at(-1))).size).toBe(3);
    expect(commands[0][3]).not.toContain('ip');
  });
  it('refuses cloud use without durable quota configuration', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('VERCEL', '1');
    const { checkRateLimit } = await import('./_rateLimit');
    expect(await checkRateLimit('ip')).toMatchObject({ allowed: false, reason: 'quota-unavailable' });
  });
  it('also bounds different clients with a global local-development limit', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', ''); vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RATE_LIMIT_GLOBAL_MAX', '2');
    const { checkRateLimit } = await import('./_rateLimit');
    expect((await checkRateLimit('one')).allowed).toBe(true);
    expect((await checkRateLimit('two')).allowed).toBe(true);
    expect(await checkRateLimit('three')).toMatchObject({ allowed: false, reason: 'rate-limited' });
  });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
