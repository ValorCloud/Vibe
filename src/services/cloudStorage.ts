/**
 * cloudStorage.ts — Abstraction multi-provider pour cloud storage pick + save.
 * Providers : OneDrive Personnel, OneDrive Business, Dropbox, Box, Google Drive.
 *
 * Modes (pick) :
 *   'lyrics'       — sélection d'un fichier texte unique (.txt .md .json .docx .odt)
 *   'player'       — sélection d'un dossier → crawl Graph → liste fichiers audio
 *   'player-files' — sélection multiple de fichiers audio individuels (multi-select)
 *
 * Provider logic is implemented in src/services/cloudProviders/.
 * This file exposes the public API only.
 */

import {
  saveFile as gdriveSave,
  isGDriveConfigured,
} from './googleDriveService';
import { strategies } from './cloudProviders';
import {
  PublicClientApplication,
  type Configuration,
} from '@azure/msal-browser';

// ─── Types publics ────────────────────────────────────────────────────────────

export interface CloudFile {
  name: string;
  content: string;
  /** Pour mode 'player' / 'player-files' : liste sérialisée des fichiers (JSON AudioFileEntry[]). */
  fileList?: AudioFileEntry[];
  /** Google Drive file ID — set when file was loaded from GDrive (used for save-back). */
  gdriveFileId?: string;
  /** Provider that produced this file — stamped by `pickFromCloud` so downstream
   *  consumers (e.g. player listeners) know how to attribute the tracks. */
  provider?: CloudProviderId;
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

/** Providers supporting save/export (subset of CloudProviderId). */
export type SaveCloudProvider = 'onedrive' | 'gdrive';

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

// ─── Extensions acceptées par mode ───────────────────────────────────────────

export const LYRICS_EXTENSIONS = ['.txt', '.md', '.json', '.docx', '.odt'];
export const AUDIO_EXTENSIONS  = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.weba', '.webm'];

// ─── MSAL singleton (shared for save operations) ────────────────────────────

let _msalSaveApp: PublicClientApplication | null = null;

function getMsalSaveApp(): PublicClientApplication | null {
  if (!MSAL_CLIENT_ID) return null;
  if (!_msalSaveApp) {
    const config: Configuration = {
      auth: { clientId: MSAL_CLIENT_ID, authority: MSAL_AUTHORITY },
      cache: { cacheLocation: 'sessionStorage' },
    };
    _msalSaveApp = new PublicClientApplication(config);
  }
  return _msalSaveApp;
}

async function getMsalWriteToken(): Promise<string | null> {
  const app = getMsalSaveApp();
  if (!app) return null;
  await app.initialize();
  const scopes = ['Files.ReadWrite', 'User.Read', 'openid', 'profile'];
  const accounts = app.getAllAccounts();
  try {
    if (accounts.length > 0) {
      const result = await app.acquireTokenSilent({ scopes, account: accounts[0]! });
      return result.accessToken;
    }
    const result = await app.acquireTokenPopup({ scopes });
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

// ─── OneDrive Save via Graph API ──────────────────────────────────────────────

/**
 * Save text content to OneDrive root via Graph API PUT simple upload.
 * - If the file already exists it is overwritten.
 * - Returns the saved file name.
 * Requires Files.ReadWrite scope — prompts MSAL login if no session.
 */
export async function saveToOneDrive(
  content: string,
  fileName: string,
): Promise<{ name: string }> {
  const token = await getMsalWriteToken();
  if (!token) throw new Error('ONEDRIVE_AUTH_FAILED');

  const encodedName = encodeURIComponent(fileName);
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedName}:/content`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: content,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OneDrive PUT ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { name?: string };
  return { name: data.name ?? fileName };
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

// ─── Generic cloud save dispatcher ───────────────────────────────────────────

/**
 * Save text content to the given cloud provider.
 * Returns the saved file name (and id for GDrive).
 */
export async function saveToCloud(
  provider: SaveCloudProvider,
  content: string,
  fileName: string,
  gdriveFileId?: string,
): Promise<{ name: string; id?: string }> {
  if (provider === 'gdrive') {
    return saveToGDrive(content, fileName, gdriveFileId);
  }
  // onedrive (personal — business uses same Graph endpoint with same token)
  return saveToOneDrive(content, fileName);
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
  const result = await (strategies[providerId]?.pick(mode, signal) ?? null);
  if (result) result.provider = providerId;
  return result;
}
