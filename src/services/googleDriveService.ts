/**
 * googleDriveService.ts — Google Drive REST v3, OAuth2 implicit (SPA, no backend)
 *
 * Auth flow : silent iframe refresh (prompt=none) → fallback popup (select_account)
 * Scopes    : https://www.googleapis.com/auth/drive.file
 *             (read+write files created by this app; cannot read arbitrary Drive files)
 *
 * For read-only pick of any file, scope drive.readonly is used instead.
 *
 * Env vars (Vite):
 *   VITE_GDRIVE_CLIENT_ID  — OAuth2 client ID (Web application, Authorized JS origins)
 *   VITE_GDRIVE_API_KEY    — API key (Picker API, optional)
 *
 * No external SDK dependency. Pure REST + window.open popup.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CLIENT_ID = (import.meta.env.VITE_GDRIVE_CLIENT_ID as string | undefined) ?? '';
const API_KEY   = (import.meta.env.VITE_GDRIVE_API_KEY   as string | undefined) ?? '';
// API_KEY kept for future Picker API use; not required for current REST flow.
void API_KEY;

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

export const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/flac',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/opus',
  'audio/webm',
  'video/webm',
];

export const GDRIVE_AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.weba', '.webm'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  /** Direct download link (requires auth header) */
  webContentLink?: string;
  size?: string;
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
// Silent refresh via hidden iframe (prompt=none)
// ---------------------------------------------------------------------------

/**
 * Attempt a silent token refresh using a hidden iframe.
 * Google resolves immediately if the user is already signed-in to the same
 * account; rejects with `access_denied` / `interaction_required` otherwise.
 * Times out after 8 s to avoid hanging.
 */
function silentRefresh(scope: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) { reject(new Error('GDRIVE_NOT_CONFIGURED')); return; }

    const redirectUri = `${window.location.origin}/gdrive-callback.html`;
    const params = new URLSearchParams({
      client_id:              CLIENT_ID,
      redirect_uri:           redirectUri,
      response_type:          'token',
      scope,
      include_granted_scopes: 'true',
      prompt:                 'none',
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    iframe.src = authUrl;
    document.body.appendChild(iframe);

    const TIMEOUT_MS = 8_000;
    let settled = false;

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      window.removeEventListener('message', messageHandler);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('GDRIVE_SILENT_TIMEOUT'));
    }, TIMEOUT_MS);

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; access_token?: string; expires_in?: number; error?: string };
      if (data.type !== 'GDRIVE_TOKEN') return;
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      if (data.error || !data.access_token) {
        reject(new Error(data.error ?? 'GDRIVE_NO_TOKEN'));
      } else {
        storeToken(data.access_token, data.expires_in ?? 3600);
        resolve(data.access_token);
      }
    };

    window.addEventListener('message', messageHandler);
  });
}

// ---------------------------------------------------------------------------
// OAuth2 popup (full interactive login)
// ---------------------------------------------------------------------------

function popupSignIn(scope: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) { reject(new Error('GDRIVE_NOT_CONFIGURED')); return; }

    const redirectUri = `${window.location.origin}/gdrive-callback.html`;
    const params = new URLSearchParams({
      client_id:              CLIENT_ID,
      redirect_uri:           redirectUri,
      response_type:          'token',
      scope,
      include_granted_scopes: 'true',
      prompt:                 'select_account',
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

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
// Public sign-in: silent first, popup fallback
// ---------------------------------------------------------------------------

/**
 * Obtain a valid Google OAuth2 access token.
 * Strategy:
 *   1. In-memory cache hit → return immediately (no network).
 *   2. Silent iframe refresh (prompt=none) → resolves if Google session active.
 *   3. Interactive popup (select_account) → user explicitly consents.
 *
 * Throws GDRIVE_AUTH_CANCELLED | GDRIVE_POPUP_BLOCKED on user abort.
 */
export async function signIn(write = false): Promise<string> {
  if (isTokenValid()) return _cachedToken!;
  if (!CLIENT_ID) throw new Error('[googleDriveService] VITE_GDRIVE_CLIENT_ID is not set.');

  const scope = write ? SCOPE_WRITE : SCOPE_READ;

  // 1. Try silent refresh
  try {
    return await silentRefresh(scope);
  } catch {
    // Silent failed (no active session, interaction_required, timeout) — fall through to popup
  }

  // 2. Interactive popup
  return popupSignIn(scope);
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
  files: Array<{ id: string; name: string; mimeType: string; webContentLink?: string; size?: string }>;
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

/**
 * List the 50 most recent audio files from Drive.
 * Uses drive.readonly scope — works with any file in the user's Drive.
 * Returns GDriveFile[] with webContentLink for direct download.
 */
export async function listRecentAudioFiles(token: string): Promise<GDriveFile[]> {
  const mimeQuery = AUDIO_MIME_TYPES.map(m => `mimeType='${m}'`).join(' or ');
  const q = encodeURIComponent(`(${mimeQuery}) and trashed=false`);
  const fields = encodeURIComponent('files(id,name,mimeType,webContentLink,size)');
  const data = await driveGet<DriveFileListResponse>(
    `/files?q=${q}&fields=${fields}&pageSize=50&orderBy=modifiedTime desc`,
    token,
  );
  return (data.files ?? []).filter(f =>
    GDRIVE_AUDIO_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
  ).map(f => ({
    id:             f.id,
    name:           f.name,
    mimeType:       f.mimeType,
    webContentLink: f.webContentLink,
    size:           f.size,
  }));
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

/**
 * Returns true if CLIENT_ID is configured.
 * API_KEY is optional (reserved for future Picker API use).
 */
export function isGDriveConfigured(): boolean {
  return !!CLIENT_ID;
}
