import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionSnapshot } from './sessionPersistence';

const snapshot = (title = 'draft'): SessionSnapshot => ({
  schemaVersion: 1, savedAt: 123, song: [], structure: [], title, titleOrigin: 'user',
  topic: '', mood: '', rhymeScheme: '', targetSyllables: 8, songLanguage: 'en', genre: '',
  tempo: 120, instrumentation: '', rhythm: '', narrative: '', musicalPrompt: '',
  activeTab: 'lyrics', isStructureOpen: true, isLeftPanelOpen: true,
});
function storage() {
  let contents = '';
  const close = vi.fn(async () => {}), abort = vi.fn(async () => {});
  const file = {
    createWritable: vi.fn(async () => {
      let draft = '';
      return { write: vi.fn(async (text: string) => { draft = text; }), abort,
        close: async () => { await close(); contents = draft; } };
    }),
    getFile: vi.fn(async () => ({ text: async () => contents })),
  };
  const root = { getFileHandle: vi.fn(async () => file), removeEntry: vi.fn(async () => { contents = ''; }) };
  vi.stubGlobal('navigator', { storage: { getDirectory: async () => root } });
  return { file, root, close, abort, read: () => contents };
}
beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('verified OPFS session persistence', () => {
  it('rejects unsupported storage instead of reporting a save', async () => {
    vi.stubGlobal('navigator', {});
    const { saveSession } = await import('./sessionPersistence');
    await expect(saveSession(snapshot())).rejects.toThrow('unavailable');
  });
  it('propagates close failure, aborts and keeps the last committed version', async () => {
    const opfs = storage();
    const { saveSession } = await import('./sessionPersistence');
    await saveSession(snapshot('first'));
    opfs.close.mockRejectedValueOnce(new Error('disk full'));
    await expect(saveSession(snapshot('second'))).rejects.toThrow('disk full');
    expect(opfs.abort).toHaveBeenCalledOnce();
    expect(JSON.parse(opfs.read()).title).toBe('first');
    await saveSession(snapshot('third'));
    expect(JSON.parse(opfs.read()).title).toBe('third');
  });
  it('rejects a mismatched reread', async () => {
    const opfs = storage();
    opfs.file.getFile.mockResolvedValue({ text: async () => 'different' });
    const { saveSession } = await import('./sessionPersistence');
    await expect(saveSession(snapshot())).rejects.toThrow('verified');
  });
  it('serializes overlapping writes and snapshots their inputs before queueing', async () => {
    const opfs = storage();
    let release!: () => void;
    opfs.close.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    const { saveSession } = await import('./sessionPersistence');
    const first = saveSession(snapshot('first'));
    await vi.waitFor(() => expect(opfs.close).toHaveBeenCalledOnce());
    const value = snapshot('second'), second = saveSession(value);
    value.title = 'later mutation';
    expect(opfs.file.createWritable).toHaveBeenCalledOnce();
    release(); await Promise.all([first, second]);
    expect(JSON.parse(opfs.read()).title).toBe('second');
  });
  it('orders reset after an in-flight write', async () => {
    const opfs = storage();
    const { saveSession, clearSession } = await import('./sessionPersistence');
    await Promise.all([saveSession(snapshot()), clearSession()]);
    expect(opfs.read()).toBe('');
  });
});
