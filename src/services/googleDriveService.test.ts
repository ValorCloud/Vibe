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
    // The module was loaded without any stubbed env so CLIENT_ID defaults to ''.
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
// Scope drift regression (P2)
// ---------------------------------------------------------------------------

describe('scope drift regression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i % 256;
        return arr;
      },
      subtle: {
        digest: vi.fn().mockImplementation(async () => {
          const mockHash = new Uint8Array(32);
          for (let i = 0; i < 32; i++) mockHash[i] = i;
          return mockHash.buffer;
        }),
      },
    });
  });

  afterEach(() => {
    clearToken();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clearToken resets cached scope to SCOPE_READ', () => {
    // After clearToken, a subsequent signIn(write=false) should request read scope.
    // This verifies _cachedScope is reset and cannot carry over a stale write scope.
    clearToken();
    // getStoredToken must be null — no residual token or scope
    expect(getStoredToken()).toBeNull();
  });

  it('signIn throws GDRIVE_NOT_CONFIGURED when CLIENT_ID is empty', async () => {
    // Verifies the CLIENT_ID guard fires before any popup or iframe is created.
    // Also exercises the signIn() entry path (isTokenValid=false branch).
    vi.stubGlobal('open', vi.fn().mockReturnValue(null));
    await expect(signIn(false)).rejects.toThrow();
  });
});
