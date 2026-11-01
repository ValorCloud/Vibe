import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { createAudience, mountAudience } from '../vendor/valor-audience/valor-audience.mjs';
import type { AudienceConfig } from '../vendor/valor-audience/valor-audience.mjs';

const config: AudienceConfig = {schemaVersion:1,enabled:true,privacyReviewed:true,key:'lyricist',projectId:'test123',kind:'app',hosts:['lyricist.test'],privacyPath:'/privacy.html'};
const page = (url = 'https://lyricist.test/') => new JSDOM('<html lang="en"><head></head><body><main>Private draft<input value="private prompt" /></main></body></html>', {url});

describe('shared optional audience boundary', () => {
  it('keeps the vendored runtime and style byte-identical to the recorded source', () => {
    const base = resolve('src/vendor/valor-audience');
    const manifest = JSON.parse(readFileSync(resolve(base, 'manifest.json'), 'utf8'));
    for (const [name, hash] of Object.entries(manifest.files)) expect(createHash('sha256').update(readFileSync(resolve(base, name))).digest('hex')).toBe(hash);
  });
  it('loads nothing before agreement, masks content first and removes a pending SDK on withdrawal', () => {
    const dom = page(), win = dom.window as unknown as Window;
    const api = mountAudience(config, win);
    expect(win.document.querySelector('script')).toBeNull();
    expect(win.document.querySelector('.valor-audience-panel')?.hasAttribute('hidden')).toBe(false);
    api.setConsent('granted');
    expect(win.document.documentElement.getAttribute('data-clarity-mask')).toBe('true');
    expect(win.document.querySelector('script')?.src).toBe('https://www.clarity.ms/tag/test123');
    expect(api.track('private draft')).toBe(false);
    api.setConsent('denied');
    expect(api.status().active).toBe(false);
    expect(win.document.querySelector('script')).toBeNull();
    const next = page(); next.window.localStorage.setItem('valor-audience-v1:lyricist', win.localStorage.getItem('valor-audience-v1:lyricist')!);
    const restored = createAudience(config, next.window as unknown as Window);
    expect(restored.status().decision).toBe('denied');
    expect(next.window.document.querySelector('script')).toBeNull();
    dom.window.close(); next.window.close();
  });
  it.each(['globalPrivacyControl', 'doNotTrack'])('honors %s despite a saved grant', property => {
    const dom = page();
    Object.defineProperty(dom.window.navigator, property, { value: property === 'globalPrivacyControl' ? true : '1' });
    const api = createAudience(config, dom.window as unknown as Window);
    api.setConsent('granted');
    expect(api.status().active).toBe(false);
    expect(dom.window.document.querySelector('script')).toBeNull();
    dom.window.close();
  });
  it('stops before history exposes an OAuth token and honors withdrawal in another tab', () => {
    const dom = page(), win = dom.window as unknown as Window;
    const api = createAudience(config, win); api.setConsent('granted');
    win.history.pushState({}, '', '/?token=private');
    expect(api.status().active).toBe(false);
    expect(win.document.querySelector('script')).toBeNull();
    win.localStorage.setItem('valor-audience-v1:lyricist', JSON.stringify({version:1,value:'denied',time:Date.now()}));
    win.dispatchEvent(new dom.window.StorageEvent('storage', {key:'valor-audience-v1:lyricist'}));
    expect(api.status().decision).toBe('denied');
    dom.window.close();
  });
  it.each(['https://lyricist.test/?code=secret', 'https://lyricist.test/#access_token=secret', 'https://lyricist.test/callback'])('never loads on %s', url => {
    const dom = page(url), api = createAudience(config, dom.window as unknown as Window);
    api.setConsent('granted'); expect(api.status().active).toBe(false);
    expect(dom.window.document.querySelector('script')).toBeNull(); dom.window.close();
  });
  it('admits the exact GitHub Pages app root without admitting adjacent private paths', () => {
    for (const [path, active] of [['/Vibe/', true], ['/Vibe/index.html', true], ['/Vibe/customer', false], ['/Vibe/?token=x', false]] as const) {
      const dom = page('https://lyricist.test' + path);
      const api = createAudience({...config, appPaths:['/Vibe/', '/Vibe/index.html']}, dom.window as unknown as Window);
      api.setConsent('granted'); expect(api.status().active).toBe(active); dom.window.close();
    }
  });
});
