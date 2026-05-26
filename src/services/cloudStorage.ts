/**
 * cloudStorage.ts — Abstraction multi-provider pour cloud storage pick.
 * Providers : OneDrive Personnel, OneDrive Business, Dropbox, Box, Google Drive.
 *
 * Modes :
 *   'lyrics'  — sélection d'un fichier texte unique (.txt .md .json .docx .odt)
 *   'player'  — sélection d'un dossier → crawl Graph → liste fichiers audio
 *
 * Aucune dépendance runtime supplémentaire hors @azure/msal-browser (déjà présent).
 */

import {
  PublicClientApplication,
  type Configuration,
  type AuthenticationResult,
} from '@azure/msal-browser';

// ─── Types publics ────────────────────────────────────────────────────────────

export interface CloudFile {
  name: string;
  content: string;
  /** Pour mode 'player' : liste sérialisée des fichiers du dossier (JSON AudioFileEntry[]). */
  fileList?: AudioFileEntry[];
}

export interface AudioFileEntry {
  id: string;
  name: string;
  /** URL de téléchargement direct (expire ~1h) */
  downloadUrl: string;
  size: number;
  mimeType: string;
}

export type PickMode = 'lyrics' | 'player';

export type CloudProviderId =
  | 'onedrive'
  | 'onedrive-business'
  | 'dropbox'
  | 'box'
  | 'gdrive';

export interface CloudProviderMeta {
  id: CloudProviderId;
  label: string;
  /** Classe CSS couleur accent pour l'icône/badge */
  colorClass: string;
  available: boolean;
}

// ─── Config runtime (variables d'env Vite) ───────────────────────────────────

const MSAL_CLIENT_ID =
  (import.meta.env.VITE_MSGRAPH_CLIENT_ID as string | undefined) ?? '';
const MSAL_AUTHORITY =
  (import.meta.env.VITE_MSGRAPH_AUTHORITY as string | undefined) ??
  'https://login.microsoftonline.com/common';
const DROPBOX_APP_KEY =
  (import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined) ?? '';
const BOX_CLIENT_ID =
  (import.meta.env.VITE_BOX_CLIENT_ID as string | undefined) ?? '';
const GDRIVE_API_KEY =
  (import.meta.env.VITE_GDRIVE_API_KEY as string | undefined) ?? '';
const GDRIVE_CLIENT_ID =
  (import.meta.env.VITE_GDRIVE_CLIENT_ID as string | undefined) ?? '';

// ─── Extensions acceptées par mode ───────────────────────────────────────────

export const LYRICS_EXTENSIONS = ['.txt', '.md', '.json', '.docx', '.odt'];
export const AUDIO_EXTENSIONS  = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.weba', '.webm'];

function isLyricsFile(name: string): boolean {
  return LYRICS_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));
}

function isAudioFile(name: string): boolean {
  return AUDIO_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));
}

// ─── Helpers internes ────────────────────────────────────────────────────────

async function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

// ─── MSAL singleton ──────────────────────────────────────────────────────────

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

// ─── Résolution dynamique du tenant ODB ──────────────────────────────────────

async function resolveODBOrigin(token: string): Promise<string> {
  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me/drive?$select=webUrl',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Graph /me/drive failed: ${res.status}`);
  const data = await res.json() as { webUrl?: string };
  if (!data.webUrl) throw new Error('Cannot resolve ODB tenant: missing webUrl');
  const url = new URL(data.webUrl);
  return url.origin;
}

// ─── Graph : crawl récursif d'un dossier ─────────────────────────────────────

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
        // Récursion dans les sous-dossiers
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

// ─── OneDrive Personnel / Business ───────────────────────────────────────────

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

  // Picker v8 (SDK-less)
  // - LYRICS : navigation libre, pas de filtre extension (filtrer à réception)
  // - PLAYER : idem — l'utilisateur navigue jusqu'au dossier cible et le sélectionne
  //   Le picker v8 ne supporte pas la sélection de dossier directement,
  //   donc on laisse la navigation libre et on détecte le type de l'item retourné.
  const pickerUrl =
    `${origin}/picker?v=8&quantum=1` +
    `&entry.mode=files` +
    `&select.mode=single` +
    (mode === 'player' ? `&navigation=all` : '');

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
      // Accepter uniquement les messages du domaine du picker
      if (!event.origin.includes('onedrive') && !event.origin.includes('sharepoint')) return;

      const msg = event.data as {
        type?: string;
        items?: Array<{
          id?: string;
          name?: string;
          folder?: object;
          '@microsoft.graph.downloadUrl'?: string;
          file?: { mimeType?: string };
        }>;
      };

      if (msg.type === 'cancel') {
        cleanup();
        resolve(null);
        return;
      }

      if (msg.type !== 'Success' || !msg.items?.length) return;

      cleanup();
      const item = msg.items[0]!;

      try {
        // ── MODE PLAYER : item est un dossier → crawl ──────────────────────
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

        // ── MODE LYRICS : item est un fichier texte ────────────────────────
        // Si l'utilisateur a sélectionné un dossier en mode lyrics → ignorer
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
          // Fallback : Graph API
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
        console.error('[cloudStorage] OneDrive pick error:', err);
      }
    };

    // Abort signal
    signal?.addEventListener('abort', () => { cleanup(); resolve(null); });

    window.addEventListener('message', messageHandler);
  });
}

// ─── Dropbox ─────────────────────────────────────────────────────────────────

async function pickDropbox(mode: PickMode, signal?: AbortSignal): Promise<CloudFile | null> {
  if (!DROPBOX_APP_KEY) return null;
  if (mode === 'player') throw new Error('Dropbox folder crawl not yet supported');

  return new Promise((resolve, reject) => {
    const options = {
      success: async (files: Array<{ name: string; link: string }>) => {
        if (signal?.aborted) { resolve(null); return; }
        try {
          const file = files[0];
          if (!file) { resolve(null); return; }
          if (!isLyricsFile(file.name)) { resolve(null); return; }
          const resp = await fetch(file.link);
          const blob = await resp.blob();
          const content = await readBlobAsText(blob);
          resolve({ name: file.name, content });
        } catch (err) { reject(err); }
      },
      cancel: () => resolve(null),
      linkType: 'direct' as const,
      multiselect: false,
      extensions: LYRICS_EXTENSIONS,
    };

    const dbx = (window as unknown as { Dropbox?: { choose: (o: typeof options) => void } }).Dropbox;
    if (!dbx) { resolve(null); return; }
    if (signal?.aborted) { resolve(null); return; }
    dbx.choose(options);
  });
}

// ─── Box ─────────────────────────────────────────────────────────────────────

async function pickBox(mode: PickMode, signal?: AbortSignal): Promise<CloudFile | null> {
  if (!BOX_CLIENT_ID) return null;
  if (mode === 'player') throw new Error('Box folder crawl not yet supported');

  return new Promise(resolve => {
    const popup = window.open(
      `https://app.box.com/api/oauth2/authorize?client_id=${BOX_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(window.location.origin)}`,
      'BoxAuth', 'width=600,height=700',
    );
    if (!popup) { resolve(null); return; }

    const handler = (e: MessageEvent) => {
      if (!e.origin.includes('box.com')) return;
      window.removeEventListener('message', handler);
      if (!popup.closed) popup.close();
      const token = (e.data as { access_token?: string }).access_token;
      if (!token) { resolve(null); return; }

      // Box Picker SDK minimal (non supporté sans SDK tiers)
      resolve(null);
    };
    signal?.addEventListener('abort', () => { if (!popup.closed) popup.close(); resolve(null); });
    window.addEventListener('message', handler);
  });
}

// ─── Google Drive ─────────────────────────────────────────────────────────────

async function pickGDrive(mode: PickMode, signal?: AbortSignal): Promise<CloudFile | null> {
  if (!GDRIVE_API_KEY || !GDRIVE_CLIENT_ID) return null;
  if (mode === 'player') throw new Error('Google Drive folder crawl not yet supported');

  return new Promise((resolve, reject) => {
    const gapi = (window as unknown as { gapi?: { load: (m: string, cb: () => void) => void; auth2?: unknown; picker?: unknown } }).gapi;
    if (!gapi) { resolve(null); return; }

    gapi.load('picker', () => {
      if (signal?.aborted) { resolve(null); return; }
      const picker = (window as unknown as {
        google?: {
          picker: {
            PickerBuilder: new () => {
              addView: (v: unknown) => unknown;
              setOAuthToken: (t: string) => unknown;
              setDeveloperKey: (k: string) => unknown;
              setCallback: (cb: (data: { action: string; docs?: Array<{ name: string; id: string }> }) => void) => unknown;
              build: () => { setVisible: (v: boolean) => void };
            };
            DocsView: new () => unknown;
            Action: { PICKED: string; CANCEL: string };
          };
        };
      }).google?.picker;
      if (!picker) { resolve(null); return; }

      // Nécessite un token OAuth2 Google — non implémenté sans GAPI auth
      resolve(null);
    });
  });
}

// ─── API publique ─────────────────────────────────────────────────────────────

export function getProvidersMeta(): CloudProviderMeta[] {
  return [
    {
      id: 'onedrive',
      label: 'OneDrive Personal',
      colorClass: 'text-blue-400',
      available: true, // Picker v8 public — aucune config requise
    },
    {
      id: 'onedrive-business',
      label: 'OneDrive Business',
      colorClass: 'text-blue-600',
      available: !!MSAL_CLIENT_ID,
    },
    {
      id: 'dropbox',
      label: 'Dropbox',
      colorClass: 'text-sky-400',
      available: !!DROPBOX_APP_KEY,
    },
    {
      id: 'box',
      label: 'Box',
      colorClass: 'text-blue-500',
      available: !!BOX_CLIENT_ID,
    },
    {
      id: 'gdrive',
      label: 'Google Drive',
      colorClass: 'text-yellow-400',
      available: !!(GDRIVE_API_KEY && GDRIVE_CLIENT_ID),
    },
  ];
}

export async function pickCloudFile(
  provider: CloudProviderId,
  signal?: AbortSignal,
  mode: PickMode = 'lyrics',
): Promise<CloudFile | null> {
  switch (provider) {
    case 'onedrive':          return pickOneDrive(false, mode, signal);
    case 'onedrive-business': return pickOneDrive(true,  mode, signal);
    case 'dropbox':           return pickDropbox(mode, signal);
    case 'box':               return pickBox(mode, signal);
    case 'gdrive':            return pickGDrive(mode, signal);
  }
}
