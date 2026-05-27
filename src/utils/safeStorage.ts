/**
 * Unified safe localStorage helpers.
 * Handles QuotaExceededError, NS_ERROR_DOM_QUOTA_REACHED, and private-browsing
 * silently so the app never crashes on storage operations.
 *
 * Replaces both safeStorage.ts and storageUtils.ts — import from here only.
 */
import type { ZodSchema } from 'zod';
import { logger } from './logger';

export const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeSetItem = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      logger.warn(`[safeStorage] localStorage quota exceeded for key: "${key}"`);
    } else {
      logger.warn(`[safeStorage] Could not persist "${key}":`, e);
    }
    return false;
  }
};

export const safeRemoveItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
};

/**
 * Type-safe localStorage reader.
 * Parses the stored JSON and validates it against the provided Zod schema.
 * Returns `null` on missing key, JSON parse error, or schema validation failure.
 *
 * Usage:
 *   const session = safeJsonParse('my_key', SessionSchema);
 *   // session is SessionData | null — fully validated, no cast
 */
export const safeJsonParse = <T>(key: string, schema: ZodSchema<T>): T | null => {
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

export const safeJsonSet = <T>(key: string, value: T): boolean =>
  safeSetItem(key, JSON.stringify(value));
