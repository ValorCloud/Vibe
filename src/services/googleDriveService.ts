/**
 * googleDriveService.ts — Google Drive REST v3, OAuth2 implicit (SPA, no backend)
 *
 * Auth flow : popup window → Google OAuth2 → token in URL hash → postMessage back
 * Scopes    : https://www.googleapis.com/auth/drive.file
 *             (read+write files created by this app; cannot read arbitrary Drive files)
 *
 * For read-only pick of any file, scope drive.readonly is used instead.
 *
 * Env vars (Vite):
 *   VITE_GDRIVE_CLIENT_ID  — OAuth2 client ID (Web application, Authorized JS origins)
 *   VITE_GDRIVE_API_KEY    — API key (Picker API)
 *
 * No external SDK dependency. Pure REST + window.open popup.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CLIENT_ID = (import.meta.env.VITE_GDRIVE_CLIENT_ID as string | undefined) ?? '';
const API_KEY   = (import.meta.env.VITE_GDRIVE_API_KEY   as string | undefined) ?? '';

const SCOPE_READ  = 'https://www.googleapis.com/auth/drive.readonly';
const SCOPE_WRITE = 'https://www.googleapis.com/auth/drive.file';

const LYRICS_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
];

const LYRICS_EXTENSIONS = ['.txt', '.md', '.json', '.docx', '.odt'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
}

// ---------------------------------------------------------------------------
// Token cache (in-memory, SPA session)
// ---------------------------------------------------------------------------

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

function isTokenValid(): boolean {
  return !!_cachedToken && Date.now() < _tokenExpiry - 60_000;
}

function storeToken(token: string, expiresInSeconds: number): void {
  _cachedToken = token;
  _tokenExpiry = Date.now() + expiresInSeconds * 1000;
}

export function clearToken(): void {
  _cachedToken = null;
  _tokenExpiry = 0;
}

export function getStoredToken(): string | null {
  return isTokenValid() ? _cachedToken : null;
}

// ---------------------------------------------------------------------------
// OAuth2 implicit grant via popup
// ---------------------------------------------------------------------------

/**
 * Open a Google OAuth2 popup and resolve with the access token.
 * Uses the implicit grant (token in fragment) — suitable for SPAs.
 */
export async function signIn(write = false): Promise<string> {
  if (isTokenValid()) return _cachedToken!;
  if (!CLIENT_ID) throw new Error('[googleDriveService] VITE_GDRIVE_CLIENT_ID is not set.');

  const scope     = write ? SCOPE_WRITE : SCOPE_READ;
  const redirectUri = `${window.location.origin}/gdrive-callback.html`;

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'token',
    scope,
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, 'GDriveAuth', 'width=520,height=640,toolbar=0,scrollbars=1');
    if (!popup) { reject(new Error('GDRIVE_POPUP_BLOCKED')); return; }

    const closedCheck = setInterval(() => {
      if (popup.closed) {
        clearInterval(closedCheck);
        window.removeEventListener('message', messageHandler);
        reject(new Error('GDRIVE_AUTH_CANCELLED'));
      }
    }, 500);

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; access_token?: string; expires_in?: number; error?: string };
      if (data.type !== 'GDRIVE_TOKEN') return;

      clearInterval(closedCheck);
      window.removeEventListener('message', messageHandler);

      if (data.error || !data.access_token) {
        reject(new Error(data.error ?? 'GDRIVE_NO_TOKEN'));
        return;
      }
      storeToken(data.access_token, data.expires_in ?? 3600);
      resolve(data.access_token);
    };

    window.addEventListener('message', messageHandler);
  });
}

// ---------------------------------------------------------------------------
// Drive REST helpers
// ---------------------------------------------------------------------------

async function driveGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive GET ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Picker — list recent lyrics files and let user pick one
// ---------------------------------------------------------------------------

interface DriveFileListResponse {
  files: Array<{ id: string; name: string; mimeType: string }>;
  nextPageToken?: string;
}

/**
 * List the 30 most recent Drive files matching lyrics extensions.
 * Returns them sorted by name for display.
 */
export async function listRecentLyricsFiles(token: string): Promise<GDriveFile[]> {
  const mimeQuery = LYRICS_MIME_TYPES.map(m => `mimeType='${m}'`).join(' or ');
  const q = encodeURIComponent(`(${mimeQuery}) and trashed=false`);
  const fields = encodeURIComponent('files(id,name,mimeType)');
  const data = await driveGet<DriveFileListResponse>(
    `/files?q=${q}&fields=${fields}&pageSize=30&orderBy=modifiedTime desc`,
    token,
  );
  return (data.files ?? []).filter(f =>
    LYRICS_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
  );
}

// ---------------------------------------------------------------------------
// Load (download) a file by ID
// ---------------------------------------------------------------------------

/**
 * Download file content as text.
 * For Google Docs, exports as plain text; for binary files uses alt=media.
 */
export async function downloadFile(fileId: string, token: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive download ${res.status}: ${body.slice(0, 200)}`);
  }
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

// ---------------------------------------------------------------------------
// Save (upload / update) a file
// ---------------------------------------------------------------------------

/**
 * Upload text content to Drive.
 * - If fileId is provided → update existing file (PATCH multipart).
 * - Otherwise → create new file in app root (POST multipart).
 * Returns the GDriveFile metadata of the created/updated file.
 */
export async function saveFile(
  content: string,
  fileName: string,
  mimeType = 'text/plain',
  fileId?: string,
): Promise<GDriveFile> {
  const token = await signIn(true); // write scope

  const metadata = JSON.stringify({
    name:     fileName,
    mimeType,
    ...(fileId ? {} : { parents: ['root'] }),
  });

  const boundary = '-------314159265358979323846';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,mimeType`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType';

  const method = fileId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Drive ${method} ${res.status}: ${errBody.slice(0, 200)}`);
  }

  return res.json() as Promise<GDriveFile>;
}

// ---------------------------------------------------------------------------
// Capability check
// ---------------------------------------------------------------------------

export function isGDriveConfigured(): boolean {
  return !!(CLIENT_ID && API_KEY);
}
