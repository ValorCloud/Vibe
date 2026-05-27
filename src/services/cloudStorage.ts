/**
 * cloudStorage.ts — Abstraction multi-provider pour cloud storage pick.
 * Providers : OneDrive Personnel, OneDrive Business, Dropbox, Box, Google Drive.
 *
 * Modes :
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
const DROPBOX_APP_KEY =
  (import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined) ?? '';
const BOX_CLIENT_ID =
  (import.meta.env.VITE_BOX_CLIENT_ID as string | undefined) ?? '';

// ─── Extensions acceptées par mode ───────────────────────────────────────────

export const LYRICS_EXTENSIONS = ['.txt', '.md', '.json', '.docx', '.odt'];
export const AUDIO_EXTENSIONS  = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.weba', '.webm'];

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
  const result = await (strategies[providerId]?.pick(mode, signal) ?? null);
  if (result) result.provider = providerId;
  return result;
}
