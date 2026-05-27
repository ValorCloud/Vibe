/**
 * Centralized logger.
 *
 * In production builds (`import.meta.env.DEV === false`), `debug` is silenced
 * and `warn`/`error` still write to the console so issues remain observable
 * but verbose internal traces (payloads, schema errors, IPA pipeline traces,
 * etc.) don't leak to end users' browser consoles.
 *
 * Always prefer `logger.warn` / `logger.error` over `console.*` so we can:
 *  - filter noise by build target (dev vs prod);
 *  - swap to a remote sink later (Sentry, App Insights…) in one place;
 *  - keep a single, greppable surface for security audits.
 */

type Args = readonly unknown[];

const isDev = (() => {
  try {
    // import.meta.env is provided by Vite. In test environments it may be
    // undefined; default to true so tests keep seeing debug output.
    return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? true);
  } catch {
    return true;
  }
})();

export interface Logger {
  debug(...args: Args): void;
  info(...args: Args): void;
  warn(...args: Args): void;
  error(...args: Args): void;
}

export const logger: Logger = {
  debug: (...args) => {
    if (isDev) console.debug(...args);
  },
  info: (...args) => {
    if (isDev) console.info(...args);
  },
  warn: (...args) => {
    console.warn(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
};

export default logger;
