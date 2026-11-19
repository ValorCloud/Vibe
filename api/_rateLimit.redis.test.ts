// Real Redis executes the production Lua. Only the Upstash HTTP transport is
// adapted to the disposable localhost CI service; no provider/account is used.
import { connect } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const port = Number(process.env.TEST_REDIS_PORT);
function evalRedis(command: string[]): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port });
    let received = '';
    socket.setTimeout(5000, () => socket.destroy(new Error('Redis test timeout')));
    socket.on('error', reject);
    socket.on('connect', () => socket.write(`*${command.length}\r\n` + command.map(value => `$${Buffer.byteLength(value)}\r\n${value}\r\n`).join('')));
    socket.on('data', chunk => {
      received += chunk.toString();
      if (received.startsWith('-') && received.endsWith('\r\n')) { socket.destroy(); reject(new Error(received)); }
      const match = received.match(/^\*2\r\n:(\d+)\r\n:(\d+)\r\n$/);
      if (match) { socket.end(); resolve([Number(match[1]), Number(match[2])]); }
    });
  });
}
describe.skipIf(!Number.isInteger(port) || port <= 0)('real Redis atomic quota', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test.invalid');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-only');
    vi.stubEnv('RATE_LIMIT_MAX', '2'); vi.stubEnv('RATE_LIMIT_GLOBAL_MAX', '3');
    vi.stubEnv('RATE_LIMIT_WINDOW_MS', '1000');
    const namespace = randomUUID();
    vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
      const command: string[] = JSON.parse(String(init.body));
      command[3] = namespace + command[3]; command[4] = namespace + command[4];
      return new Response(JSON.stringify({ result: await evalRedis(command) }));
    });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('admits only two concurrent calls from one client across module instances', async () => {
    const first = await import('./_rateLimit');
    vi.resetModules();
    const second = await import('./_rateLimit');
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? first : second).checkRateLimit('same-client')));
    expect(results.filter(value => value.allowed)).toHaveLength(2);
    expect(results.filter(value => !value.allowed).every(value => !value.allowed && value.reason === 'rate-limited')).toBe(true);
  });
  it('admits only three requests globally from different clients and expires the window', async () => {
    const { checkRateLimit } = await import('./_rateLimit');
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => checkRateLimit(String(index))));
    expect(results.filter(value => value.allowed)).toHaveLength(3);
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect((await checkRateLimit('after-expiry')).allowed).toBe(true);
  });
});
