export const APP_VERSION: string =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '1.40.0.27';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
