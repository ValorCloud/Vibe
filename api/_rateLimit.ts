/**
 * Shared sliding-window admission. Redis checks/reserves the client and global
 * windows in ONE atomic script; a lost response never triggers a second attempt.
 * Memory is only for local development without Redis, never a cloud fallback.
 */
import { createHash, randomUUID } from 'node:crypto';

export type RateLimitResult = { allowed: true } | {
  allowed: false; retryAfterSec: number; reason: 'rate-limited' | 'quota-unavailable';
};
const integer = (name: string, fallback: number, maximum: number) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 && value <= maximum ? value : null;
};
const MAX = integer('RATE_LIMIT_MAX', 20, 100_000);
const GLOBAL_MAX = integer('RATE_LIMIT_GLOBAL_MAX', 200, 1_000_000);
const WINDOW_MS = integer('RATE_LIMIT_WINDOW_MS', 60_000, 86_400_000);
const unavailable = (): RateLimitResult => ({ allowed: false, retryAfterSec: 60, reason: 'quota-unavailable' });

// TIME is supplied by Redis so serverless replicas cannot disagree on the clock.
// Refused requests reserve nothing. Unique members distinguish same-ms calls.
export const RATE_LIMIT_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local window = tonumber(ARGV[1])
local limits = {tonumber(ARGV[2]), tonumber(ARGV[3])}
local retry = 0
for i, key in ipairs(KEYS) do
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
  if redis.call('ZCARD', key) >= limits[i] then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    retry = math.max(retry, tonumber(oldest[2]) + window - now)
  end
end
if retry > 0 then return {0, math.max(1, math.ceil(retry / 1000))} end
for _, key in ipairs(KEYS) do
  redis.call('ZADD', key, now, ARGV[4])
  redis.call('PEXPIRE', key, window)
end
return {1, 0}
`;

const buckets = new Map<string, number[]>();
function localCheck(key: string): RateLimitResult {
  if (!MAX || !GLOBAL_MAX || !WINDOW_MS) return unavailable();
  const now = Date.now(), keys = [key, 'global'];
  for (const [name, values] of buckets) {
    const current = values.filter(value => value > now - WINDOW_MS);
    if (current.length) buckets.set(name, current); else buckets.delete(name);
  }
  for (const [index, name] of keys.entries()) {
    const values = buckets.get(name) ?? [];
    if (values.length >= (index === 0 ? MAX : GLOBAL_MAX)) return {
      allowed: false, retryAfterSec: Math.max(1, Math.ceil((values[0]! + WINDOW_MS - now) / 1000)), reason: 'rate-limited',
    };
  }
  for (const name of keys) buckets.set(name, [...(buckets.get(name) ?? []), now]);
  return { allowed: true };
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (!MAX || !GLOBAL_MAX || !WINDOW_MS) return unavailable();
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const key = 'vibe_rl:v2:client:' + createHash('sha256').update(ip).digest('hex');
  if (!url && !token) {
    return process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.VERCEL_ENV
      ? unavailable() : localCheck(key);
  }
  if (!url || !token) return unavailable();
  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') return unavailable();
    const response = await fetch(endpoint.href, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EVAL', RATE_LIMIT_SCRIPT, '2', key, 'vibe_rl:v2:global', String(WINDOW_MS), String(MAX), String(GLOBAL_MAX), randomUUID()]),
      signal: AbortSignal.timeout(3_000), redirect: 'error',
    });
    if (!response.ok) return unavailable();
    const text = await response.text();
    if (text.length > 2048) return unavailable();
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || 'error' in data || !('result' in data)) return unavailable();
    const result = data.result;
    if (!Array.isArray(result) || result.length !== 2 || ![0, 1].includes(result[0]) || !Number.isSafeInteger(result[1]) || result[1] < 0 || result[1] > Math.ceil(WINDOW_MS / 1000)) return unavailable();
    if (result[0] === 1 && result[1] === 0) return { allowed: true };
    return result[0] === 0 && result[1] > 0
      ? { allowed: false, retryAfterSec: result[1], reason: 'rate-limited' } : unavailable();
  } catch {
    // No in-memory fallback, no retry: the reservation may already be committed.
    return unavailable();
  }
}

export function resolveIp(headers: Record<string, string | string[] | undefined>, socketAddress?: string): string {
  const forwarded = headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(',')[0]?.trim() || socketAddress?.trim() || 'unknown').slice(0, 45);
}
