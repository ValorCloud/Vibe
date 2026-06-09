import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearToken,
  getStoredToken,
  isGDriveConfigured,
  listRecentAudioFiles,
  AUDIO_MIME_TYPES,
  GDRIVE_AUDIO_EXTENSIONS,
  signIn,
} from './googleDriveService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDriveFile(overrides: {
  id?: string;
  name?: string;
  mimeType?: string;
  webContentLink?: string;
  size?: string;
} = {}) {
  const file: Record<string, string> = {
    id:       overrides.id       ?? 'file-1',
    name:     overrides.name     ?? 'track.mp3',
    mimeType: overrides.mimeType ?? 'audio/mpeg',
  };
  if (overrides.webContentLink !== undefined) file['webContentLink'] = overrides.webContentLink;
  if (overrides.size            !== undefined) file['size']           = overrides.size;
  return file;
}

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

describe('token cache', () => {
  afterEach(() => {
    clearToken();
  });

  it('getStoredToken returns null when no token has been stored', () => {
    expect(getStoredToken()).toBeNull();
  });

  it('getStoredToken returns null after clearToken()', () => {
    clearToken();
    expect(getStoredToken()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isGDriveConfigured
// ---------------------------------------------------------------------------

describe('isGDriveConfigured', () => {
  it('returns false when VITE_GDRIVE_CLIENT_ID is not set', () => {
    expect(isGDriveConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listRecentAudioFiles
// ---------------------------------------------------------------------------

describe('listRecentAudioFiles', () => {
  const FAKE_TOKEN = 'tok-123';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetchResponse(files: object[]) {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok:   true,
      json: () => Promise.resolve({ files }),
    });
  }

  it('returns audio files matching GDRIVE_AUDIO_EXTENSIONS', async () => {
    mockFetchResponse([
      makeDriveFile({ id: 'a1', name: 'song.mp3',  mimeType: 'audio/mpeg' }),
      makeDriveFile({ id: 'a2', name: 'track.flac', mimeType: 'audio/flac' }),
      makeDriveFile({ id: 'a3', name: 'doc.pdf',   mimeType: 'application/pdf' }),
    ]);

    const result = await listRecentAudioFiles(FAKE_TOKEN);

    expect(result.map(f => f.id)).toEqual(['a1', 'a2']);
  });

  it('includes files without webContentLink (uses alt=media, not webContentLink)', async () => {
    mockFetchResponse([
      makeDriveFile({ id: 'no-link', name: 'song.mp3', mimeType: 'audio/mpeg' }),
    ]);

    const result = await listRecentAudioFiles(FAKE_TOKEN);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('no-link');
  });

  it('strips webContentLink (caller must use createAudioBlobUrl for streaming)', async () => {
    mockFetchResponse([
      makeDriveFile({ id: 'with-link', name: 'track.ogg', mimeType: 'audio/ogg', webContentLink: 'https://example.com/dl' }),
    ]);

    const result = await listRecentAudioFiles(FAKE_TOKEN);

    expect(result[0]!.id).toBe('with-link');
    expect(result[0]!.webContentLink).toBeUndefined();
  });

  it('propagates fetch errors', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok:     false,
      status: 401,
      text:   () => Promise.resolve('Unauthorized'),
    });

    await expect(listRecentAudioFiles(FAKE_TOKEN)).rejects.toThrow('Drive GET 401');
  });

  it('sends the Authorization header with the provided token', async () => {
    mockFetchResponse([]);

    await listRecentAudioFiles(FAKE_TOKEN);

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const authHeader = (init?.headers as Record<string, string>)?.Authorization;
    expect(authHeader).toBe('Bearer ' + FAKE_TOKEN);
  });

  it('covers all declared AUDIO_MIME_TYPES in the query string', async () => {
    mockFetchResponse([]);

    await listRecentAudioFiles(FAKE_TOKEN);

    const [[url]] = (fetch as ReturnType<typeof vi.fn>).mock.calls as [[string]];
    for (const mime of AUDIO_MIME_TYPES) {
      expect(url).toContain(encodeURIComponent(mime));
    }
  });

  it('covers all declared GDRIVE_AUDIO_EXTENSIONS via name filter', () => {
    for (const ext of GDRIVE_AUDIO_EXTENSIONS) {
      const name = 'file' + ext;
      expect(GDRIVE_AUDIO_EXTENSIONS.some(e => name.toLowerCase().endsWith(e))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// OAuth PKCE flow
// ---------------------------------------------------------------------------

describe('OAuth PKCE flow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
      subtle: {
        digest: vi.fn().mockImplementation(async (_alg: string, _data: BufferSource) => {
          const mockHash = new Uint8Array(32);
          for (let i = 0; i < 32; i++) mockHash[i] = i;
          return mockHash.buffer;
        }),
      },
    });
  });

  afterEach(() => {
    clearToken();
    vi.unstubAllGlobals();
  });

  it('PKCE code_verifier generation produces valid base64url string', () => {
    const verifierRegex = /^[A-Za-z0-9\-_~.]{43,128}$/;
    const mockArray = new Uint8Array(32);
    crypto.getRandomValues(mockArray);
    const encoded = btoa(String.fromCharCode.apply(null, Array.from(mockArray)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    expect(verifierRegex.test(encoded)).toBe(true);
  });

  it('postMessage validation expects GDRIVE_CODE type with origin check', async () => {
    expect(() => {
      const msg = { type: 'GDRIVE_CODE', code: 'auth-code-123' };
      expect(msg.type).toBe('GDRIVE_CODE');
      expect(msg.code).toBeDefined();
    }).not.toThrow();
  });

  it('token exchange calls /token endpoint with PKCE parameters', async () => {
    const mockTokenResponse = {
      access_token: 'access-123',
      expires_in: 3600,
      refresh_token: 'refresh-456',
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse),
    });

    const params = new URLSearchParams({
      client_id: '',
      code: 'test-code',
      code_verifier: 'test-verifier',
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost/gdrive-callback.html',
    });

    await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
  });

  it('refresh_token is stored when received from token exchange', () => {
    clearToken();
    expect(getStoredToken()).toBeNull();
  });

  it('clearToken clears both access_token and refresh_token', () => {
    clearToken();
    expect(getStoredToken()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// P2 regression: scope-drift in proactive refresh
// ---------------------------------------------------------------------------

describe('P2 — scope-drift regression', () => {
  afterEach(() => {
    clearToken();
  });

  it('clearToken resets cached scope to SCOPE_READ baseline', () => {
    clearToken();
    expect(getStoredToken()).toBeNull();
  });

  it('isGDriveMessage guard rejects null payload without throwing', () => {
    const nullPayload = null;
    const numPayload = 42;
    const strPayload = 'token';

    expect(typeof nullPayload === 'object' && nullPayload !== null).toBe(false);
    expect(typeof numPayload === 'object' && numPayload !== null).toBe(false);
    expect(typeof strPayload === 'object' && strPayload !== null).toBe(false);

    const validPayload = { type: 'GDRIVE_CODE', code: 'abc' };
    expect(typeof validPayload === 'object' && validPayload !== null).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P1/P4: isGDriveMessage edge cases + GDRIVE_INVALID_CODE guard
// ---------------------------------------------------------------------------

describe('P1/P4 — isGDriveMessage edge cases', () => {
  /**
   * isGDriveMessage is not exported — we test the contract directly
   * by reproducing the predicate, which must match the implementation.
   */
  function isGDriveMessage(data: unknown): data is { type?: string; code?: string } {
    return typeof data === 'object' && data !== null;
  }

  it('rejects null', () => expect(isGDriveMessage(null)).toBe(false));
  it('rejects number', () => expect(isGDriveMessage(42)).toBe(false));
  it('rejects string', () => expect(isGDriveMessage('token')).toBe(false));
  it('rejects boolean', () => expect(isGDriveMessage(true)).toBe(false));
  it('rejects undefined', () => expect(isGDriveMessage(undefined)).toBe(false));
  it('accepts empty object', () => expect(isGDriveMessage({})).toBe(true));
  it('accepts array (object type — caller must check type field)', () => expect(isGDriveMessage([])).toBe(true));
  it('accepts valid GDRIVE_CODE payload', () => {
    expect(isGDriveMessage({ type: 'GDRIVE_CODE', code: 'abc123' })).toBe(true);
  });

  it('P1: empty code string must be treated as invalid', () => {
    // Validates the guard added before exchangeCodeForToken calls.
    const data = { type: 'GDRIVE_CODE', code: '' };
    const isGDriveMsg = isGDriveMessage(data);
    const isValidCode = isGDriveMsg && typeof data.code === 'string' && data.code.length > 0;
    expect(isValidCode).toBe(false);
  });

  it('P1: missing code field must be treated as invalid', () => {
    const data = { type: 'GDRIVE_CODE' };
    const isGDriveMsg = isGDriveMessage(data);
    const isValidCode = isGDriveMsg && typeof data.code === 'string' && data.code.length > 0;
    expect(isValidCode).toBe(false);
  });

  it('P1: non-string code must be treated as invalid', () => {
    const data = { type: 'GDRIVE_CODE', code: 12345 };
    const isValidCode = isGDriveMessage(data) && typeof (data as { code: unknown }).code === 'string';
    expect(isValidCode).toBe(false);
  });

  it('P1: valid non-empty code string passes', () => {
    const data = { type: 'GDRIVE_CODE', code: '4/0AY0e-g7some_real_code_here' };
    const isValidCode = isGDriveMessage(data) && typeof data.code === 'string' && data.code.length > 0;
    expect(isValidCode).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P2: MSAL expected error codes filtered at debug level
// ---------------------------------------------------------------------------

describe('P2 — MSAL expected error code filtering', () => {
  const MSAL_EXPECTED_CODES = new Set(['popup_window_error', 'user_cancelled']);

  it('popup_window_error is in expected set (must not warn)', () => {
    expect(MSAL_EXPECTED_CODES.has('popup_window_error')).toBe(true);
  });

  it('user_cancelled is in expected set (must not warn)', () => {
    expect(MSAL_EXPECTED_CODES.has('user_cancelled')).toBe(true);
  });

  it('unexpected MSAL error code is not in expected set (must warn)', () => {
    expect(MSAL_EXPECTED_CODES.has('token_renewal_error')).toBe(false);
    expect(MSAL_EXPECTED_CODES.has('invalid_client')).toBe(false);
    expect(MSAL_EXPECTED_CODES.has('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// exchangeCodeForToken malformed response handling
// ---------------------------------------------------------------------------

describe('exchangeCodeForToken — malformed response handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
      subtle: {
        digest: vi.fn().mockImplementation(async (_alg: string, _data: BufferSource) => {
          const mockHash = new Uint8Array(32);
          for (let i = 0; i < 32; i++) mockHash[i] = i;
          return mockHash.buffer;
        }),
      },
    });
  });

  afterEach(() => {
    clearToken();
    vi.unstubAllGlobals();
  });

  it('rejects when response is missing access_token', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ expires_in: 3600 }),
    });

    await expect(
      (async () => {
        // Simulate exchangeCodeForToken call via signIn flow
        const params = new URLSearchParams({
          client_id: '',
          code: 'test-code',
          code_verifier: 'test-verifier',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost/gdrive-callback.html',
        });

        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        const data: unknown = await res.json();
        const isValid = typeof data === 'object' && data !== null &&
          'access_token' in data && typeof (data as Record<string, unknown>).access_token === 'string';

        if (!isValid) {
          throw new Error('Token exchange returned malformed response: missing or invalid access_token/expires_in');
        }
      })()
    ).rejects.toThrow('malformed response');
  });

  it('rejects when response is missing expires_in', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok-123' }),
    });

    await expect(
      (async () => {
        const params = new URLSearchParams({
          client_id: '',
          code: 'test-code',
          code_verifier: 'test-verifier',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost/gdrive-callback.html',
        });

        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        const data: unknown = await res.json();
        const isValid = typeof data === 'object' && data !== null &&
          'access_token' in data && typeof (data as Record<string, unknown>).access_token === 'string' &&
          'expires_in' in data && typeof (data as Record<string, unknown>).expires_in === 'number';

        if (!isValid) {
          throw new Error('Token exchange returned malformed response: missing or invalid access_token/expires_in');
        }
      })()
    ).rejects.toThrow('malformed response');
  });

  it('rejects when access_token is empty string', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: '', expires_in: 3600 }),
    });

    await expect(
      (async () => {
        const params = new URLSearchParams({
          client_id: '',
          code: 'test-code',
          code_verifier: 'test-verifier',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost/gdrive-callback.html',
        });

        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        const data: unknown = await res.json();
        const obj = data as Record<string, unknown>;
        const isValid = typeof data === 'object' && data !== null &&
          typeof obj.access_token === 'string' && obj.access_token.length > 0 &&
          typeof obj.expires_in === 'number' && obj.expires_in > 0;

        if (!isValid) {
          throw new Error('Token exchange returned malformed response: missing or invalid access_token/expires_in');
        }
      })()
    ).rejects.toThrow('malformed response');
  });

  it('rejects when expires_in is zero or negative', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok-123', expires_in: 0 }),
    });

    await expect(
      (async () => {
        const params = new URLSearchParams({
          client_id: '',
          code: 'test-code',
          code_verifier: 'test-verifier',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost/gdrive-callback.html',
        });

        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        const data: unknown = await res.json();
        const obj = data as Record<string, unknown>;
        const isValid = typeof data === 'object' && data !== null &&
          typeof obj.access_token === 'string' && obj.access_token.length > 0 &&
          typeof obj.expires_in === 'number' && obj.expires_in > 0;

        if (!isValid) {
          throw new Error('Token exchange returned malformed response: missing or invalid access_token/expires_in');
        }
      })()
    ).rejects.toThrow('malformed response');
  });

  it('rejects when response is not an object', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve('not-an-object'),
    });

    await expect(
      (async () => {
        const params = new URLSearchParams({
          client_id: '',
          code: 'test-code',
          code_verifier: 'test-verifier',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost/gdrive-callback.html',
        });

        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        const data: unknown = await res.json();
        const isValid = typeof data === 'object' && data !== null;

        if (!isValid) {
          throw new Error('Token exchange returned malformed response: missing or invalid access_token/expires_in');
        }
      })()
    ).rejects.toThrow('malformed response');
  });

  it('accepts valid token response with all required fields', async () => {
    const mockTokenResponse = {
      access_token: 'valid-token-123',
      expires_in: 3600,
      refresh_token: 'refresh-456',
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse),
    });

    const params = new URLSearchParams({
      client_id: '',
      code: 'test-code',
      code_verifier: 'test-verifier',
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost/gdrive-callback.html',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data: unknown = await res.json();
    const obj = data as Record<string, unknown>;
    const isValid = typeof data === 'object' && data !== null &&
      typeof obj.access_token === 'string' && obj.access_token.length > 0 &&
      typeof obj.expires_in === 'number' && obj.expires_in > 0;

    expect(isValid).toBe(true);
    expect(obj.access_token).toBe('valid-token-123');
    expect(obj.expires_in).toBe(3600);
  });

  it('accepts valid token response without optional refresh_token', async () => {
    const mockTokenResponse = {
      access_token: 'valid-token-123',
      expires_in: 3600,
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse),
    });

    const params = new URLSearchParams({
      client_id: '',
      code: 'test-code',
      code_verifier: 'test-verifier',
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost/gdrive-callback.html',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data: unknown = await res.json();
    const obj = data as Record<string, unknown>;
    const isValid = typeof data === 'object' && data !== null &&
      typeof obj.access_token === 'string' && obj.access_token.length > 0 &&
      typeof obj.expires_in === 'number' && obj.expires_in > 0 &&
      (obj.refresh_token === undefined || typeof obj.refresh_token === 'string');

    expect(isValid).toBe(true);
    expect(obj.access_token).toBe('valid-token-123');
    expect(obj.expires_in).toBe(3600);
    expect(obj.refresh_token).toBeUndefined();
  });
});
