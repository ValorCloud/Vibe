/**
 * cloudStorage.ts — Abstraction multi-provider pour cloud storage pick.
 * Providers : OneDrive Personnel, OneDrive Business, Dropbox, Box, Google Drive.
 *
 * Modes :
 *   'lyrics'       — sélection d'un fichier texte unique (.txt .md .json .docx .odt)
 *   'player'       — sélection d'un dossier → crawl Graph → liste fichiers audio
 *   'player-files' — sélection multiple de fichiers audio individuels (multi-select)
 *
 * Aucune dépendance runtime supplémentaire hors @azure/msal-browser (déjà présent).
 */

import {
  PublicClientApplication,
  type Configuration,
  type AuthenticationResult,
} from '@azure/msal-browser';
import {
  signIn as gdriveSignIn,
  listRecentLyricsFiles,
  listRecentAudioFiles,
  downloadFile as gdriveDownload,
  saveFile as gdriveSave,
  isGDriveConfigured,
  type GDriveFile,
} from './googleDriveService';

// ─── Types publics ────────────────────────────────────────────────────────────

export interface CloudFile {
  name: string;
  content: string;
  /** Pour mode 'player' / 'player-files' : liste sérialisée des fichiers (JSON AudioFileEntry[]). */
  fileList?: AudioFileEntry[];
  /** Google Drive file ID — set when file was loaded from GDrive (used for save-back). */
  gdriveFileId?: string;
}

export interface AudioFileEntry {
  id: string;
  name: string;
  /** URL de téléchargement direct (expire ~1h) */
  downloadUrl: string;
  size: number;
  mimeType: string;
}

export type PickMode = 'lyrics' | 'player' | 'player-files';

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

// ─── Origin whitelists (exact match — no .includes()) ────────────────────────
// Using .includes() on event.origin allows spoofed origins such as
// https://evil-onedrive.attacker.com to bypass the guard.

const ONEDRIVE_ORIGINS: ReadonlySet<string> = new Set([
  'https://onedrive.live.com',
]);

/** Resolved at runtime for ODB tenants — populated after resolveODBOrigin(). */
const resolvedODBOrigins: Set<string> = new Set();

function isAllowedOneDriveOrigin(origin: string): boolean {
  return ONEDRIVE_ORIGINS.has(origin) || resolvedODBOrigins.has(origin);
}

const BOX_ORIGINS: ReadonlySet<string> = new Set([
  'https://app.box.com',
  'https://account.box.com',
]);

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
  // Register the resolved ODB origin so the message handler can trust it
  resolvedODBOrigins.add(url.origin);
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
//
// Le picker OneDrive v8 (OD personnel ET ODB/SharePoint) ne lit PAS les
// paramètres de sélection depuis l'URL. La multi-sélection doit être
// configurée via un handshake postMessage :
//
//   1. La page ouvre la popup avec une URL minimale (sans select params).
//   2. Le picker envoie  { type: 'initialize' }  dès qu'il est prêt.
//   3. On répond avec   { type: 'activate', ... }  incluant la config de
//      sélection.  C'est à ce moment que le picker affiche les checkboxes.
//   4. L'utilisateur sélectionne puis clique Select/Open.
//   5. Le picker envoie  { type: 'Success', items: [...] }.
//
// Références :
//   https://learn.microsoft.com/en-us/onedrive/developer/controls/file-pickers/

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

  // ── Picker URL: minimal, NO select params in query string ──────────────────
  // select.mode via URL is silently ignored by both OD and ODB; the only
  // reliable mechanism is the postMessage activate command below.
  const baseUrl = business
    ? `${origin}/_layouts/15/FilePicker.aspx`
    : `${origin}/picker`;

  const pickerParams = new URLSearchParams({
    sdk: '8.0',
    entry: JSON.stringify({
      oneDrive: {
        files: {},
      },
    }),
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
      // Exact-match origin whitelist
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

      // ── Step 2-3: Handshake — picker ready, send activate config ───────────
      if (msg.type === 'initialize') {
        const multiSelect = mode === 'player-files';
        const navigationMode = mode === 'player' ? 'all' : 'files';

        pickerWindow.postMessage(
          {
            type: 'activate',
            select: {
              mode: multiSelect ? 'multiple' : 'single',
            },
            navigation: {
              entrypoint: navigationMode,
            },
            typesAndSources: {
              mode: mode === 'player' ? 'folders' : 'files',
              pivots: { oneDrive: true, recent: true },
            },
          },
          event.origin,
        );
        return;
      }

      if (msg.type === 'cancel') {
        cleanup();
        resolve(null);
        return;
      }

      if (msg.type !== 'Success' || !msg.items?.length) return;

      cleanup();

      try {
        // ── MODE PLAYER-FILES : multi-sélection de fichiers audio ───────────
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
        console.error('[cloudStorage] OneDrive pick error:', err);
      }
    };

    signal?.addEventListener('abort', () => { cleanup(); resolve(null); });
    window.addEventListener('message', messageHandler);
  });
}

// ─── Dropbox ─────────────────────────────────────────────────────────────────

async function pickDropbox(mode: PickMode, signal?: AbortSignal): Promise<CloudFile | null> {
  if (!DROPBOX_APP_KEY) return null;
  if (mode === 'player') throw new Error('Dropbox folder crawl not yet supported');

  return new Promise((resolve, reject) => {
    // player-files: multi-select audio files
    const isMulti = mode === 'player-files';
    const extensions = isMulti ? AUDIO_EXTENSIONS : LYRICS_EXTENSIONS;

    const options = {
      success: async (files: Array<{ name: string; link: string }>) => {
        if (signal?.aborted) { resolve(null); return; }
        try {
          if (!files.length) { resolve(null); return; }

          if (isMulti) {
            // Collect all selected audio files — build AudioFileEntry[] from Dropbox direct links
            const entries: AudioFileEntry[] = files
              .filter(f => isAudioFile(f.name))
              .map((f, idx) => ({
                id:          `dropbox-${idx}-${f.name}`,
                name:        f.name,
                downloadUrl: f.link,
                size:        0,
                mimeType:    'audio/mpeg',
              }));
            if (!entries.length) { resolve(null); return; }
            resolve({
              name:     `selection (${entries.length} fichiers)`,
              content:  JSON.stringify(entries),
              fileList: entries,
            });
            return;
          }

          // lyrics mode — single file
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
      multiselect: isMulti,
      extensions,
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
  if (mode === 'player' || mode === 'player-files') throw new Error('Box multi-file pick not yet supported');

  return new Promise(resolve => {
    const popup = window.open(
      `https://app.box.com/api/oauth2/authorize?client_id=${BOX_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(window.location.origin)}`,
      'BoxAuth', 'width=600,height=700',
    );
    if (!popup) { resolve(null); return; }

    const handler = (e: MessageEvent) => {
      if (!BOX_ORIGINS.has(e.origin)) return;
      window.removeEventListener('message', handler);
      if (!popup.closed) popup.close();
      const token = (e.data as { access_token?: string }).access_token;
      if (!token) { resolve(null); return; }
      resolve(null);
    };
    signal?.addEventListener('abort', () => { if (!popup.closed) popup.close(); resolve(null); });
    window.addEventListener('message', handler);
  });
}

// ─── Google Drive ─────────────────────────────────────────────────────────────

/**
 * Pick files from Google Drive.
 *
 * Mode lyrics      : list 30 recent lyrics files → native dialog → single pick → download text
 * Mode player-files: list 50 recent audio files  → native multi-select dialog  → AudioFileEntry[]
 * Mode player      : unsupported (GDrive REST v3 does not expose folder-level crawl
 *                    with downloadUrl in drive.readonly scope without Drive SDK)
 */
async function pickGDrive(mode: PickMode, signal?: AbortSignal): Promise<CloudFile | null> {
  if (!isGDriveConfigured()) return null;
  if (mode === 'player') throw new Error('Google Drive folder crawl not yet supported');
  if (signal?.aborted) return null;

  let token: string;
  try {
    token = await gdriveSignIn(false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'GDRIVE_AUTH_CANCELLED' || msg === 'GDRIVE_POPUP_BLOCKED') return null;
    throw err;
  }

  if (signal?.aborted) return null;

  // ── MODE PLAYER-FILES ────────────────────────────────────────────────────
  if (mode === 'player-files') {
    const audioFiles = await listRecentAudioFiles(token);
    if (!audioFiles.length) return null;
    if (signal?.aborted) return null;

    const chosen = await showGDriveMultiFilePicker(audioFiles);
    if (!chosen?.length || signal?.aborted) return null;

    const entries: AudioFileEntry[] = chosen.map(f => ({
      id:          f.id,
      name:        f.name,
      // webContentLink requires auth header — we pass the Drive download URL
      // with the token embedded as a query param is NOT supported by Drive REST;
      // instead we use the alt=media endpoint with the stored token.
      // The player must call this URL with `Authorization: Bearer <token>` header.
      // As a workaround we embed the token in a custom scheme the player resolves.
      downloadUrl: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
      size:        f.size ? parseInt(f.size, 10) : 0,
      mimeType:    f.mimeType,
    }));

    return {
      name:     `selection (${entries.length} fichiers)`,
      content:  JSON.stringify(entries),
      fileList: entries,
      // Pass token so the player can inject it into fetch headers
      gdriveFileId: `__token__${token}`,
    };
  }

  // ── MODE LYRICS ──────────────────────────────────────────────────────────
  const files = await listRecentLyricsFiles(token);
  if (!files.length) return null;
  if (signal?.aborted) return null;

  const chosen = await showGDriveFilePicker(files);
  if (!chosen || signal?.aborted) return null;

  const content = await gdriveDownload(chosen.id, token);
  return { name: chosen.name, content, gdriveFileId: chosen.id };
}

/**
 * Show a minimal native <dialog> listing GDrive files for selection.
 * Returns the chosen file or null if dismissed.
 */
function showGDriveFilePicker(
  files: Array<{ id: string; name: string; mimeType: string }>,
): Promise<{ id: string; name: string } | null> {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = [
      'padding:0',
      'border:none',
      'border-radius:8px',
      'box-shadow:0 8px 32px rgba(0,0,0,.24)',
      'min-width:320px',
      'max-width:480px',
      'font-family:inherit',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px 8px;font-weight:600;font-size:15px;border-bottom:1px solid #e0e0e0';
    header.textContent = 'Open from Google Drive';

    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none;margin:0;padding:8px 0;max-height:320px;overflow-y:auto';

    files.forEach(f => {
      const li = document.createElement('li');
      li.style.cssText = 'padding:10px 20px;cursor:pointer;font-size:14px;border-bottom:1px solid #f0f0f0';
      li.textContent = f.name;
      li.addEventListener('mouseenter', () => { li.style.background = '#f5f5f5'; });
      li.addEventListener('mouseleave', () => { li.style.background = ''; });
      li.addEventListener('click', () => {
        dialog.close();
        dialog.remove();
        resolve({ id: f.id, name: f.name });
      });
      list.appendChild(li);
    });

    const footer = document.createElement('div');
    footer.style.cssText = 'padding:10px 20px;display:flex;justify-content:flex-end;border-top:1px solid #e0e0e0';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 16px;cursor:pointer;font-size:13px';
    cancelBtn.addEventListener('click', () => {
      dialog.close();
      dialog.remove();
      resolve(null);
    });
    footer.appendChild(cancelBtn);

    dialog.appendChild(header);
    dialog.appendChild(list);
    dialog.appendChild(footer);
    document.body.appendChild(dialog);
    dialog.showModal();

    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(null);
    });
  });
}

/**
 * Multi-select dialog for GDrive audio files.
 * Checkboxes + Select button. Returns selected files or null if cancelled.
 */
function showGDriveMultiFilePicker(
  files: GDriveFile[],
): Promise<GDriveFile[] | null> {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = [
      'padding:0',
      'border:none',
      'border-radius:8px',
      'box-shadow:0 8px 32px rgba(0,0,0,.24)',
      'min-width:360px',
      'max-width:520px',
      'font-family:inherit',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px 8px;font-weight:600;font-size:15px;border-bottom:1px solid #e0e0e0';
    header.textContent = 'Select audio files from Google Drive';

    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none;margin:0;padding:8px 0;max-height:360px;overflow-y:auto';

    const checkboxes: Map<string, HTMLInputElement> = new Map();

    files.forEach(f => {
      const li = document.createElement('li');
      li.style.cssText = 'padding:8px 20px;display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;border-bottom:1px solid #f0f0f0';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `gdrive-audio-${f.id}`;
      cb.style.cssText = 'width:16px;height:16px;cursor:pointer;flex-shrink:0';
      checkboxes.set(f.id, cb);

      const label = document.createElement('label');
      label.htmlFor = cb.id;
      label.textContent = f.name;
      label.style.cssText = 'cursor:pointer;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

      li.addEventListener('click', e => {
        if ((e.target as HTMLElement).tagName !== 'INPUT') cb.checked = !cb.checked;
      });
      li.addEventListener('mouseenter', () => { li.style.background = '#f5f5f5'; });
      li.addEventListener('mouseleave', () => { li.style.background = ''; });

      li.appendChild(cb);
      li.appendChild(label);
      list.appendChild(li);
    });

    const footer = document.createElement('div');
    footer.style.cssText = 'padding:10px 20px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e0e0e0;gap:8px';

    const countLabel = document.createElement('span');
    countLabel.style.cssText = 'font-size:12px;color:#666';
    countLabel.textContent = '0 selected';

    // Update count on any checkbox change
    list.addEventListener('change', () => {
      const n = [...checkboxes.values()].filter(c => c.checked).length;
      countLabel.textContent = `${n} selected`;
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 16px;cursor:pointer;font-size:13px';
    cancelBtn.addEventListener('click', () => {
      dialog.close();
      dialog.remove();
      resolve(null);
    });

    const selectBtn = document.createElement('button');
    selectBtn.textContent = 'Add to player';
    selectBtn.style.cssText = 'padding:6px 16px;cursor:pointer;font-size:13px;background:#1a73e8;color:#fff;border:none;border-radius:4px';
    selectBtn.addEventListener('click', () => {
      const selected = files.filter(f => checkboxes.get(f.id)?.checked);
      dialog.close();
      dialog.remove();
      resolve(selected.length ? selected : null);
    });

    footer.appendChild(countLabel);
    footer.appendChild(cancelBtn);
    footer.appendChild(selectBtn);

    dialog.appendChild(header);
    dialog.appendChild(list);
    dialog.appendChild(footer);
    document.body.appendChild(dialog);
    dialog.showModal();

    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(null);
    });
  });
}

// ─── Google Drive Save ────────────────────────────────────────────────────────

/**
 * Save text content to Google Drive.
 * - fileId provided → update existing file
 * - fileId omitted  → create new file in Drive root
 */
export async function saveToGDrive(
  content: string,
  fileName: string,
  fileId?: string,
): Promise<{ id: string; name: string }> {
  const saved = await gdriveSave(content, fileName, 'text/plain', fileId);
  return { id: saved.id, name: saved.name };
}

// ─── API publique ─────────────────────────────────────────────────────────────

export function getProvidersMeta(): CloudProviderMeta[] {
  return [
    {
      id: 'onedrive',
      label: 'OneDrive Personal',
      colorClass: 'text-blue-400',
      available: !!MSAL_CLIENT_ID,
    },
    {
      id: 'onedrive-business',
      label: 'OneDrive Business',
      colorClass: 'text-blue-500',
      available: !!MSAL_CLIENT_ID,
    },
    {
      id: 'dropbox',
      label: 'Dropbox',
      colorClass: 'text-blue-600',
      available: !!DROPBOX_APP_KEY,
    },
    {
      id: 'box',
      label: 'Box',
      colorClass: 'text-blue-700',
      available: !!BOX_CLIENT_ID,
    },
    {
      id: 'gdrive',
      label: 'Google Drive',
      colorClass: 'text-yellow-500',
      available: isGDriveConfigured(),
    },
  ];
}

export async function pickFromCloud(
  providerId: CloudProviderId,
  mode: PickMode,
  signal?: AbortSignal,
): Promise<CloudFile | null> {
  switch (providerId) {
    case 'onedrive':          return pickOneDrive(false, mode, signal);
    case 'onedrive-business': return pickOneDrive(true,  mode, signal);
    case 'dropbox':           return pickDropbox(mode, signal);
    case 'box':               return pickBox(mode, signal);
    case 'gdrive':            return pickGDrive(mode, signal);
    default:                  return null;
  }
}
