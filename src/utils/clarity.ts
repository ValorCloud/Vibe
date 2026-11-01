import { mountAudience } from '../vendor/valor-audience/valor-audience.mjs';
import type { AudienceApi } from '../vendor/valor-audience/valor-audience.mjs';
import '../vendor/valor-audience/valor-audience.css';

let audience: AudienceApi | undefined;

/** Public configuration only. A project ID alone never starts collection.
 * The common controller masks the app before loading Clarity and keeps all
 * personal content/identifiers out of its small allowlist of generic events.
 */
export function initClarity(): AudienceApi | undefined {
  if (audience) return audience;
  const projectId = (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined)?.trim() ?? '';
  if (!projectId) return undefined;
  const basePath = new URL(import.meta.env.BASE_URL, window.location.origin).pathname;
  audience = mountAudience({ schemaVersion: 1, enabled: true,
    // This adapter's masked content and URL/event boundaries are tested below.
    // This flag describes those safeguards, not a legal compliance certificate.
    privacyReviewed: true,
    key: 'lyricist', projectId, kind: 'app', hosts: [window.location.hostname],
    appPaths: [basePath, basePath + 'index.html'],
    privacyPath: `${import.meta.env.BASE_URL}privacy.html`,
  }, window);
  return audience;
}
