export const CLOUD_PROVIDER_OPTIONS = [
  { id: 'onedrive', label: 'OneDrive' },
  { id: 'onedrive-business', label: 'OneDrive Business' },
  { id: 'dropbox', label: 'Dropbox' },
  { id: 'box', label: 'Box' },
  { id: 'google-drive', label: 'Google Drive' },
  { id: 'direct-url', label: 'Direct URL' },
] as const;

export type CloudProviderId = typeof CLOUD_PROVIDER_OPTIONS[number]['id'];

const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi|m4v)(?:$|\?)/i;
const GOOGLE_DRIVE_FILE_PATH = /\/file\/d\/([^/]+)/i;

function setSearchParam(rawUrl: string, key: string, value: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function normalizeGoogleDriveUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const pathMatch = parsed.pathname.match(GOOGLE_DRIVE_FILE_PATH);
    const fileId = pathMatch?.[1] ?? parsed.searchParams.get('id');
    if (!fileId) return rawUrl;
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  } catch {
    return rawUrl;
  }
}

export function normalizeCloudUrl(rawUrl: string, provider: CloudProviderId): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  switch (provider) {
    case 'dropbox':
      return setSearchParam(trimmed, 'dl', '1');
    case 'box':
      return setSearchParam(trimmed, 'download', '1');
    case 'google-drive':
      return normalizeGoogleDriveUrl(trimmed);
    case 'onedrive':
    case 'onedrive-business':
      return setSearchParam(trimmed, 'download', '1');
    case 'direct-url':
      return trimmed;
  }
}

export function isCloudVideoUrl(url: string): boolean {
  return VIDEO_EXT.test(url);
}

export function detectCloudProvider(url: string): CloudProviderId {
  const lower = url.trim().toLowerCase();
  if (!lower) return 'direct-url';
  if (lower.includes('dropbox.com')) return 'dropbox';
  if (lower.includes('box.com')) return 'box';
  if (lower.includes('drive.google.com')) return 'google-drive';
  if (lower.includes('1drv.ms') || lower.includes('onedrive.live.com')) return 'onedrive';
  if (lower.includes('.sharepoint.com') || lower.includes('-my.sharepoint.com')) return 'onedrive-business';
  return 'direct-url';
}

export function cloudTrackTitle(url: string): string {
  try {
    const parsed = new URL(url);
    const fileId = parsed.searchParams.get('id');
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? '';
    if (last && last !== 'view') return decodeURIComponent(last).replace(/\.[^/.]+$/, '');
    if (fileId) return `cloud-${fileId.slice(0, 8)}`;
    return parsed.hostname;
  } catch {
    return 'cloud-track';
  }
}
