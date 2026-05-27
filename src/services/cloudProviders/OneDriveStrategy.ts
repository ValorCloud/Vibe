/**
 * OneDriveStrategy.ts — OneDrive Personal + Business pick via MSAL + Graph picker v8.
 *
 * Handles both personal (onedrive.live.com) and business (ODB/SharePoint) tenants.
 * Business tenant origin is resolved dynamically via /me/drive webUrl.
 */

import {
  PublicClientApplication,
  type Configuration,
  type AuthenticationResult,
} from '@azure/msal-browser';
import type { PickStrategy } from './PickStrategy';
import type { CloudFile, PickMode, AudioFileEntry } from '../cloudStorage';
import { logger } from '../../utils/logger';

// ─── Config ──────────────────────────────────────────────────────────────────

const MSAL_CLIENT_ID =
  (import.meta.env.VITE_MSGRAPH_CLIENT_ID as string | undefined) ?? '';
const MSAL_AUTHORITY =
  (import.meta.env.VITE_MSGRAPH_AUTHORITY as string | undefined) ??
  'https://login.microsoftonline.com/common';

export const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.weba', '.webm'];
export const LYRICS_EXTENSIONS = ['.txt', '.md', '.json', '.docx', '.odt'];

function isLyricsFile(name: string): boolean {
  return LYRICS_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));
}

function isAudioFile(name: string): boolean {
  return AUDIO_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));
}

async function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

// ─── MSAL singleton (shared across personal + business instances) ─────────────

let _msalApp: PublicClientApplication | null = null;

function getMsalApp(): PublicClientApplication | null {
  if (!MSAL_CLIENT_ID) return null;
  if (!_msalApp) {
    const config: Configuration = {
      auth: { clientId: MSAL_CLIENT_ID, authority: MSAL_AUTHORITY },
      cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
    };
    _msalApp = new PublicClientApplication(config);
  }
  return _msalApp;
}

async function getMsalToken(scopes: string[]): Promise<string | null> {
  const app = getMsalApp();
  if (!app) return null;
  await app.initialize();
  const accounts = app.getAllAccounts();
  try {
    let result: AuthenticationResult;
    if (accounts.length > 0) {
      const account = accounts[0]!;
      result = await app.acquireTokenSilent({ scopes, account });
    } else {
      result = await app.acquireTokenPopup({ scopes });
    }
    return result.accessToken;
  } catch {
    try {
      const result = await app.acquireTokenPopup({ scopes });
      return result.accessToken;
    } catch {
      return null;
    }
  }
}

// ─── ODB tenant resolution ────────────────────────────────────────────────────

const ONEDRIVE_ORIGINS: ReadonlySet<string> = new Set(['https://onedrive.live.com']);
const resolvedODBOrigins: Set<string> = new Set();

function isAllowedOneDriveOrigin(origin: string): boolean {
  return ONEDRIVE_ORIGINS.has(origin) || resolvedODBOrigins.has(origin);
}

async function resolveODBOrigin(token: string): Promise<string> {
  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me/drive?$select=webUrl',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Graph /me/drive failed: ${res.status}`);
  const data = await res.json() as { webUrl?: string };
  if (!data.webUrl) throw new Error('Cannot resolve ODB tenant: missing webUrl');
  const url = new URL(data.webUrl);
  resolvedODBOrigins.add(url.origin);
  return url.origin;
}

// ─── Graph folder crawl ───────────────────────────────────────────────────────

interface GraphDriveItem {
  id: string;
  name: string;
  size?: number;
  file?: { mimeType?: string };
  folder?: object;
  '@microsoft.graph.downloadUrl'?: string;
}

async function crawlFolder(
  token: string,
  itemId: string,
  signal: AbortSignal,
  results: AudioFileEntry[] = [],
): Promise<AudioFileEntry[]> {
  if (signal.aborted) return results;

  let url: string | null =
    `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/children` +
    `?$select=id,name,size,file,folder,@microsoft.graph.downloadUrl&$top=200`;

  while (url) {
    if (signal.aborted) break;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Graph children failed: ${res.status}`);
    const data = await res.json() as { value: GraphDriveItem[]; '@odata.nextLink'?: string };

    for (const item of data.value) {
      if (signal.aborted) break;
      if (item.folder) {
        await crawlFolder(token, item.id, signal, results);
      } else if (item.file && isAudioFile(item.name)) {
        results.push({
          id:          item.id,
          name:        item.name,
          downloadUrl: item['@microsoft.graph.downloadUrl'] ?? '',
          size:        item.size ?? 0,
          mimeType:    item.file.mimeType ?? 'audio/mpeg',
        });
      }
    }
    url = data['@odata.nextLink'] ?? null;
  }

  return results;
}

// ─── pickOneDrive ─────────────────────────────────────────────────────────────

async function pickOneDrive(
  business: boolean,
  mode: PickMode,
  signal?: AbortSignal,
): Promise<CloudFile | null> {
  const scopes = ['Files.Read', 'User.Read', 'openid', 'profile'];
  const token = await getMsalToken(scopes);
  if (!token) return null;
  if (signal?.aborted) return null;

  const origin = business
    ? await resolveODBOrigin(token)
    : 'https://onedrive.live.com';

  if (signal?.aborted) return null;

  const baseUrl = business
    ? `${origin}/_layouts/15/FilePicker.aspx`
    : `${origin}/picker`;

  const pickerParams = new URLSearchParams({
    sdk: '8.0',
    entry: JSON.stringify({ oneDrive: { files: {} } }),
  });

  const pickerUrl = `${baseUrl}?${pickerParams.toString()}`;

  return new Promise(resolve => {
    const pickerWindow = window.open(
      pickerUrl,
      'OneDrivePicker',
      'width=800,height=600,toolbar=0,scrollbars=1',
    );

    if (!pickerWindow) { resolve(null); return; }

    const cleanup = () => {
      window.removeEventListener('message', messageHandler);
      if (!pickerWindow.closed) pickerWindow.close();
      clearInterval(closedCheck);
    };

    const closedCheck = setInterval(() => {
      if (pickerWindow.closed) { cleanup(); resolve(null); }
    }, 500);

    const messageHandler = async (event: MessageEvent) => {
      if (!isAllowedOneDriveOrigin(event.origin)) return;

      const msg = event.data as {
        type?: string;
        items?: Array<{
          id?: string;
          name?: string;
          folder?: object;
          '@microsoft.graph.downloadUrl'?: string;
          file?: { mimeType?: string };
          size?: number;
        }>;
      };

      if (msg.type === 'initialize') {
        const multiSelect = mode === 'player-files';
        const navigationMode = mode === 'player' ? 'all' : 'files';
        pickerWindow.postMessage(
          {
            type: 'activate',
            select: { mode: multiSelect ? 'multiple' : 'single' },
            navigation: { entrypoint: navigationMode },
            typesAndSources: {
              mode: mode === 'player' ? 'folders' : 'files',
              pivots: { oneDrive: true, recent: true },
            },
          },
          event.origin,
        );
        return;
      }

      if (msg.type === 'cancel') { cleanup(); resolve(null); return; }
      if (msg.type !== 'Success' || !msg.items?.length) return;

      cleanup();

      try {
        if (mode === 'player-files') {
          const entries: AudioFileEntry[] = (msg.items ?? [])
            .filter(i => i.name && isAudioFile(i.name))
            .map(i => ({
              id:          i.id ?? '',
              name:        i.name ?? '',
              downloadUrl: i['@microsoft.graph.downloadUrl'] ?? '',
              size:        i.size ?? 0,
              mimeType:    i.file?.mimeType ?? 'audio/mpeg',
            }));
          if (!entries.length) { resolve(null); return; }
          resolve({
            name:     `selection (${entries.length} fichiers)`,
            content:  JSON.stringify(entries),
            fileList: entries,
          });
          return;
        }

        const item = msg.items[0]!;

        if (mode === 'player') {
          if (!item.id) { resolve(null); return; }
          const ac = signal ?? new AbortController().signal;
          const entries = await crawlFolder(token, item.id, ac);
          resolve({
            name:     item.name ?? 'folder',
            content:  JSON.stringify(entries),
            fileList: entries,
          });
          return;
        }

        if (item.folder) { resolve(null); return; }
        if (!item.name || !isLyricsFile(item.name)) { resolve(null); return; }

        const downloadUrl = item['@microsoft.graph.downloadUrl'];
        if (downloadUrl) {
          const resp = await fetch(downloadUrl);
          if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
          const blob = await resp.blob();
          const content = await readBlobAsText(blob);
          resolve({ name: item.name, content });
        } else if (item.id) {
          const resp = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${item.id}/content`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!resp.ok) throw new Error(`Graph download failed: ${resp.status}`);
          const blob = await resp.blob();
          const content = await readBlobAsText(blob);
          resolve({ name: item.name, content });
        } else {
          resolve(null);
        }
      } catch (err) {
        resolve(null);
        logger.error('[OneDriveStrategy] pick error:', err);
      }
    };

    signal?.addEventListener('abort', () => { cleanup(); resolve(null); });
    window.addEventListener('message', messageHandler);
  });
}

// ─── Strategy exports ─────────────────────────────────────────────────────────

export class OneDrivePersonalStrategy implements PickStrategy {
  pick(mode: PickMode, signal?: AbortSignal): Promise<CloudFile | null> {
    return pickOneDrive(false, mode, signal);
  }
}

export class OneDriveBusinessStrategy implements PickStrategy {
  pick(mode: PickMode, signal?: AbortSignal): Promise<CloudFile | null> {
    return pickOneDrive(true, mode, signal);
  }
}
