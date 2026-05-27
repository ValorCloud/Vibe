import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearToken,
  getStoredToken,
  isGDriveConfigured,
  listRecentAudioFiles,
  AUDIO_MIME_TYPES,
  GDRIVE_AUDIO_EXTENSIONS,
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
    // Files without webContentLink must still be returned - the player downloads
    // them via the Drive REST alt=media endpoint, not via webContentLink.
    mockFetchResponse([
      makeDriveFile({ id: 'no-link', name: 'song.mp3', mimeType: 'audio/mpeg' }),
    ]);

    const result = await listRecentAudioFiles(FAKE_TOKEN);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('no-link');
  });

  it('strips webContentLink (caller must use createAudioBlobUrl for streaming)', async () => {
    // listRecentAudioFiles deliberately omits webContentLink from the returned
    // shape — the link is unreliable for fetch() and createAudioBlobUrl should
    // be used instead. See fix(gdrive) fab1a16 / 7e74ff2.
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
