import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Minimal mock for @google/genai
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContent: vi.fn().mockResolvedValue({ text: 'mocked response' }),
      },
    };
  }),
}));

// Stub rate limiter to always allow
vi.mock('./_rateLimit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  resolveIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    body: { model: 'gemini-1.5-pro', contents: 'write a song' },
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes() {
  const ctx = { statusCode: 200, body: undefined as any };
  const res = {
    status: vi.fn().mockImplementation((code: number) => { ctx.statusCode = code; return res; }),
    json: vi.fn().mockImplementation((data: unknown) => { ctx.body = data; return res; }),
    setHeader: vi.fn(),
  } as unknown as VercelResponse;
  return { res, ctx };
}

describe('POST /api/generate', () => {
  let handler: (req: VercelRequest, res: VercelResponse) => Promise<void>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.GEMINI_API_KEY = 'test-key';
    const mod = await import('./generate');
    handler = mod.default;
  });

  it('rejects non-POST methods', async () => {
    const { res, ctx } = makeRes();
    await handler(makeReq({ method: 'GET' }), res);
    expect(ctx.statusCode).toBe(405);
  });

  it('rejects disallowed model prefix', async () => {
    const { res, ctx } = makeRes();
    await handler(makeReq({ body: { model: 'openai-gpt4', contents: 'hello' } }), res);
    expect(ctx.statusCode).toBe(400);
  });

  it('rejects contents exceeding max length', async () => {
    const { res, ctx } = makeRes();
    const longContents = 'x'.repeat(100_001);
    await handler(makeReq({ body: { model: 'gemini-1.5-pro', contents: longContents } }), res);
    expect(ctx.statusCode).toBe(400);
  });

  it('drops unknown config keys', async () => {
    const { GoogleGenAI } = await import('@google/genai');
    const mockGenerate = vi.fn().mockResolvedValue({ text: 'ok' });
    (GoogleGenAI as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        models: { generateContent: mockGenerate },
      };
    });
    const { res, ctx } = makeRes();
    await handler(
      makeReq({ body: { model: 'gemini-1.5-pro', contents: 'test', config: { temperature: 0.5, systemInstruction: 'evil' } } }),
      res
    );
    expect(ctx.statusCode).toBe(200);
    const callArg = mockGenerate.mock.calls[0]?.[0] as { config: Record<string, unknown> };
    expect(callArg?.config).not.toHaveProperty('systemInstruction');
    expect(callArg?.config).toHaveProperty('temperature', 0.5);
  });

  it('preserves responseSchema in config', async () => {
    const { GoogleGenAI } = await import('@google/genai');
    const mockGenerate = vi.fn().mockResolvedValue({ text: 'ok' });
    (GoogleGenAI as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        models: { generateContent: mockGenerate },
      };
    });
    const { res, ctx } = makeRes();
    await handler(
      makeReq({ body: { model: 'gemini-1.5-pro', contents: 'test', config: { responseSchema: { type: 'object' } } } }),
      res
    );
    expect(ctx.statusCode).toBe(200);
    const callArg = mockGenerate.mock.calls[0]?.[0] as { config: Record<string, unknown> };
    expect(callArg?.config).toHaveProperty('responseSchema');
    expect((callArg?.config?.responseSchema as any)?.type).toBe('object');
  });

  it('returns 200 with text on success', async () => {
    const { res, ctx } = makeRes();
    await handler(makeReq(), res);
    console.log('BODY:', ctx.body);
    expect(ctx.statusCode).toBe(200);
  });

  describe('runtime provider override (x-ai-provider / x-ai-key headers)', () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('uses the user-supplied OpenAI key without any server env key', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'openai says hi' } }] }),
      });
      vi.stubGlobal('fetch', fetchMock);
      try {
        const { res, ctx } = makeRes();
        await handler(makeReq({
          headers: { 'x-ai-provider': 'openai', 'x-ai-key': 'sk-user-key' },
          body: { model: 'gpt-4o-mini', contents: 'hello' },
        } as Partial<VercelRequest>), res);
        expect(ctx.statusCode).toBe(200);
        expect(ctx.body).toEqual({ text: 'openai says hi' });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('api.openai.com');
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ' + 'sk-user-key');
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('validates the model prefix against the override provider', async () => {
      const { res, ctx } = makeRes();
      await handler(makeReq({
        headers: { 'x-ai-provider': 'anthropic', 'x-ai-key': 'sk-ant-key' },
        body: { model: 'gemini-1.5-pro', contents: 'hello' },
      } as Partial<VercelRequest>), res);
      expect(ctx.statusCode).toBe(400);
    });

    it('returns 500 for an override provider without any key (header or env)', async () => {
      const { res, ctx } = makeRes();
      await handler(makeReq({
        headers: { 'x-ai-provider': 'openai' },
        body: { model: 'gpt-4o-mini', contents: 'hello' },
      } as Partial<VercelRequest>), res);
      expect(ctx.statusCode).toBe(500);
    });

    it('rejects malformed API keys (non-printable characters ignored)', async () => {
      const { res, ctx } = makeRes();
      await handler(makeReq({
        headers: { 'x-ai-provider': 'openai', 'x-ai-key': 'bad\r\nkey' },
        body: { model: 'gpt-4o-mini', contents: 'hello' },
      } as Partial<VercelRequest>), res);
      expect(ctx.statusCode).toBe(500);
    });
  });
});
