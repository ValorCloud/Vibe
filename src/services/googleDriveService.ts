/**
 * googleDriveService.ts — Google Drive REST v3, OAuth2 PKCE (SPA)
 *
 * Auth flow : silent iframe refresh (prompt=none) → fallback popup (select_account)
 * OAuth2    : PKCE flow (Authorization Code with code_verifier/code_challenge)
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
 *
 * SECURITY: Uses OAuth2 PKCE flow (RFC 7636) instead of deprecated implicit flow.
 * code_verifier is generated client-side; code_challenge (SHA-256) is sent to auth endpoint.
 * Token exchange happens via /token endpoint with the verifier.
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
let _proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let _refreshToken: string | null = null;

function isTokenValid(): boolean {
  return !!_cachedToken && Date.now() < _tokenExpiry - 60_000;
}

function storeToken(token: string, expiresInSeconds: number): void {
  _cachedToken = token;
  _tokenExpiry = Date.now() + expiresInSeconds * 1000;

  // Proactive silent refresh 5 min before expiry to avoid mid-session 401s.
  if (_proactiveRefreshTimer !== null) clearTimeout(_proactiveRefreshTimer);
  _proactiveRefreshTimer = setTimeout(
    () => { void silentRefresh(SCOPE_READ).catch(() => {}); },
    Math.max(0, expiresInSeconds - 300) * 1000,
  );
}

export function clearToken(): void {
  _cachedToken = null;
  _tokenExpiry = 0;
  _refreshToken = null;
  if (_proactiveRefreshTimer !== null) {
    clearTimeout(_proactiveRefreshTimer);
    _proactiveRefreshTimer = null;
  }
}

export function getStoredToken(): string | null {
  return isTokenValid() ? _cachedToken : null;
}

// ---------------------------------------------------------------------------
// PKCE helpers (RFC 7636)
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure random code verifier.
 * Per RFC 7636: 43-128 characters from [A-Z, a-z, 0-9, -, ., _, ~]
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate code_challenge from code_verifier using SHA-256.
 * Per RFC 7636: BASE64URL(SHA256(ASCII(code_verifier)))
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(hash))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Exchange authorization code for access + refresh tokens via Google's /token endpoint.
 */
async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Token exchange failed ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
}

// ---------------------------------------------------------------------------
// Silent refresh via hidden iframe (prompt=none)
// ---------------------------------------------------------------------------

/**
 * Attempt a silent token refresh using a hidden iframe with PKCE.
 * Google resolves immediately if the user is already signed-in to the same
 * account; rejects with `access_denied` / `interaction_required` otherwise.
 * Times out after 8 s to avoid hanging.
 */
async function silentRefresh(scope: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    if (!CLIENT_ID) { reject(new Error('GDRIVE_NOT_CONFIGURED')); return; }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const redirectUri = `${window.location.origin}/gdrive-callback.html`;
    const params = new URLSearchParams({
      client_id:              CLIENT_ID,
      redirect_uri:           redirectUri,
      response_type:          'code',
      scope,
      include_granted_scopes: 'true',
      prompt:                 'none',
      code_challenge:         codeChallenge,
      code_challenge_method:  'S256',
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

    const messageHandler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; code?: string; error?: string };
      if (data.type !== 'GDRIVE_CODE') return;
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      if (data.error || !data.code) {
        reject(new Error(data.error ?? 'GDRIVE_NO_CODE'));
      } else {
        try {
          const tokenData = await exchangeCodeForToken(data.code, codeVerifier, redirectUri);
          storeToken(tokenData.access_token, tokenData.expires_in);
          if (tokenData.refresh_token) _refreshToken = tokenData.refresh_token;
          resolve(tokenData.access_token);
        } catch (err) {
          reject(err);
        }
      }
    };

    window.addEventListener('message', messageHandler);
  });
}

// ---------------------------------------------------------------------------
// OAuth2 popup (full interactive login)
// ---------------------------------------------------------------------------

/**
 * Complete an interactive OAuth2 popup sign-in with PKCE.
 *
 * iOS Safari fix: window.open() must be called synchronously inside the
 * user-gesture tick. signIn() pre-opens a blank window (about:blank) before
 * any async work and passes the handle here. We redirect it to the auth URL
 * once the URL is built. If the pre-opened handle is null (truly blocked),
 * we throw GDRIVE_POPUP_BLOCKED as before.
 *
 * Security:
 * - event.source is checked against the popup handle to prevent any
 *   same-origin frame from injecting a spoofed GDRIVE_CODE message.
 * - PKCE code_verifier is stored in memory and never exposed to the popup.
 * - Authorization code is exchanged for tokens via secure /token endpoint.
 *
 * @param scope   OAuth2 scope string.
 * @param preOpenedWindow  A pre-opened window handle obtained synchronously
 *                         in the user-gesture context. May be null if the
 *                         browser blocked the popup.
 */
async function popupSignIn(scope: string, preOpenedWindow: Window | null): Promise<string> {
  return new Promise(async (resolve, reject) => {
    if (!CLIENT_ID) { reject(new Error('GDRIVE_NOT_CONFIGURED')); return; }

    if (!preOpenedWindow) { reject(new Error('GDRIVE_POPUP_BLOCKED')); return; }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const redirectUri = `${window.location.origin}/gdrive-callback.html`;
    const params = new URLSearchParams({
      client_id:              CLIENT_ID,
      redirect_uri:           redirectUri,
      response_type:          'code',
      scope,
      include_granted_scopes: 'true',
      prompt:                 'select_account',
      code_challenge:         codeChallenge,
      code_challenge_method:  'S256',
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Redirect the pre-opened blank window to the actual auth URL.
    // This works because the window handle was obtained synchronously during
    // the user-gesture tick; only the URL assignment is deferred.
    preOpenedWindow.location.href = authUrl;
    const popup = preOpenedWindow;

    // `settled` guard prevents double-resolve/reject when both closedCheck
    // and messageHandler fire in the same tick (race condition on popup.close).
    let settled = false;

    const POPUP_TIMEOUT_MS = 90_000; // 90 seconds timeout for popup auth
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const closedCheck = setInterval(() => {
      if (!popup.closed) return;
      if (settled) { clearInterval(closedCheck); return; }
      settled = true;
      clearInterval(closedCheck);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      window.removeEventListener('message', messageHandler);
      reject(new Error('GDRIVE_AUTH_CANCELLED'));
    }, 500);

    // Add timeout to catch cases where popup doesn't close or communicate
    timeoutTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearInterval(closedCheck);
      window.removeEventListener('message', messageHandler);
      if (!popup.closed) {
        try { popup.close(); } catch { /* ignore */ }
      }
      reject(new Error('GDRIVE_AUTH_TIMEOUT: Authentication took too long. Please check your popup blocker settings and try again.'));
    }, POPUP_TIMEOUT_MS);

    const messageHandler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      // Guard against spoofed messages from other same-origin frames.
      if (event.source !== popup) return;
      const data = event.data as { type?: string; code?: string; error?: string };
      if (data.type !== 'GDRIVE_CODE') return;
      if (settled) return;
      settled = true;

      clearInterval(closedCheck);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      window.removeEventListener('message', messageHandler);

      if (data.error || !data.code) {
        reject(new Error(data.error ?? 'GDRIVE_NO_CODE'));
        return;
      }

      try {
        const tokenData = await exchangeCodeForToken(data.code, codeVerifier, redirectUri);
        storeToken(tokenData.access_token, tokenData.expires_in);
        if (tokenData.refresh_token) _refreshToken = tokenData.refresh_token;
        resolve(tokenData.access_token);
      } catch (err) {
        reject(err);
      }
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
 * iOS Safari: window.open() is blocked when called outside a synchronous
 * user-gesture context. To work around this, we pre-open a blank popup window
 * synchronously at the start of signIn() (before any await), then redirect it
 * to the auth URL inside popupSignIn() if silent refresh fails. If silent
 * refresh succeeds, the pre-opened window is closed immediately.
 *
 * Throws GDRIVE_AUTH_CANCELLED | GDRIVE_POPUP_BLOCKED on user abort.
 */
export async function signIn(write = false): Promise<string> {
  if (isTokenValid()) return _cachedToken as string;
  if (!CLIENT_ID) throw new Error('[googleDriveService] VITE_GDRIVE_CLIENT_ID is not set.');

  const scope = write ? SCOPE_WRITE : SCOPE_READ;

  // Pre-open a blank popup synchronously inside the user-gesture tick.
  // On iOS Safari, window.open() is only allowed synchronously during a
  // user-gesture handler. We open about:blank now and redirect later if needed.
  const preOpenedWindow = window.open('about:blank', 'GDriveAuth', 'width=520,height=640,toolbar=0,scrollbars=1');

  // null means the browser hard-blocked the popup.
  if (preOpenedWindow === null) {
    throw new Error('GDRIVE_POPUP_BLOCKED: Popup was blocked by the browser. Please allow popups for this site and try again.');
  }

  // 1. Try silent refresh
  try {
    const token = await silentRefresh(scope);
    // Silent succeeded — close the pre-opened window without user impact.
    if (!preOpenedWindow.closed) preOpenedWindow.close();
    return token;
  } catch {
    // Silent failed (no active session, interaction_required, timeout) — fall through to popup
  }

  // 2. Interactive popup — reuse the pre-opened window handle.
  return popupSignIn(scope, preOpenedWindow);
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
  return (await res.json()) as T;
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
 * Returns GDriveFile[] with id only (no webContentLink — use createAudioBlobUrl for streaming).
 */
export async function listRecentAudioFiles(token: string): Promise<GDriveFile[]> {
  const mimeQuery = AUDIO_MIME_TYPES.map(m => `mimeType='${m}'`).join(' or ');
  const q = encodeURIComponent(`(${mimeQuery}) and trashed=false`);
  const fields = encodeURIComponent('files(id,name,mimeType,size)');
  const data = await driveGet<DriveFileListResponse>(
    `/files?q=${q}&fields=${fields}&pageSize=50&orderBy=modifiedTime desc`,
    token,
  );
  return (data.files ?? [])
    .filter(f =>
      GDRIVE_AUDIO_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
    )
    .map(f => {
      const file: GDriveFile = { id: f.id, name: f.name, mimeType: f.mimeType };
      if (f.size !== undefined) file.size = f.size;
      return file;
    });
}

// ---------------------------------------------------------------------------
// Audio streaming via alt=media (Bearer token — not webContentLink)
// ---------------------------------------------------------------------------

/**
 * Download a Drive audio file as a Blob Object URL.
 * Uses alt=media with Authorization header — the only reliable method for
 * files under drive.readonly scope (webContentLink requires a Google session
 * cookie and fails in fetch() with CORS when the user is not logged in via
 * the browser).
 *
 * IMPORTANT: caller must call URL.revokeObjectURL(url) when done to free memory.
 */
export async function createAudioBlobUrl(fileId: string, token: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive audio download ${res.status}: ${body.slice(0, 200)}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
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

  return (await res.json()) as GDriveFile;
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
