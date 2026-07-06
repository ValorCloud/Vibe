/**
 * Microsoft Clarity bootstrap.
 *
 * Injects the Clarity tracking script only when VITE_CLARITY_PROJECT_ID is
 * set at build time, so local dev and CI builds without the variable stay
 * tracking-free. Clarity provides far richer visitor analytics (sessions,
 * heatmaps, devices, referrers) than GitHub traffic statistics.
 */

interface ClarityWindow extends Window {
  clarity?: { (...args: unknown[]): void; q?: unknown[] };
}

export function initClarity(): void {
  const projectId = (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined)?.trim();
  if (!projectId || !/^[a-z0-9]+$/i.test(projectId)) return;

  const w = window as ClarityWindow;
  if (w.clarity) return; // already initialized

  w.clarity = function (...args: unknown[]) {
    (w.clarity!.q = w.clarity!.q ?? []).push(args);
  };
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${projectId}`;
  const first = document.getElementsByTagName('script')[0];
  first?.parentNode?.insertBefore(script, first);
}
