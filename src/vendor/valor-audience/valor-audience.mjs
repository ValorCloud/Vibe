/* Valor audience 1.0 — canonical source: ValorCloud/apps-websites/shared/analytics. */
const CONSENT_AGE = 180 * 24 * 60 * 60 * 1000;
const EVENTS = new Set(['site_open','app_open','store_open','booking_open','contact_open','peer_open','navigation','settings_open']);
export function createAudience(config, env) {
  const w = env, d = w.document;
  const key = 'valor-audience-v1:' + (config?.key || 'unknown');
  let decision = 'unknown', started = false, stopped = false, pending = null;
  const listeners = new Set();
  // Only explicit public entry pages may extend an application's root paths.
  const appPaths = config?.appPaths;
  const validAppPaths = appPaths === undefined || Array.isArray(appPaths) && appPaths.length <= 20 &&
    appPaths.every(path => typeof path === 'string' && /^\/(?:[a-zA-Z0-9_-]+\/)*(?:index\.html)?$/.test(path));
  const configured = validAppPaths && config?.schemaVersion === 1 && config.enabled === true && config.privacyReviewed === true &&
    /^[a-z0-9-]{2,60}$/.test(config.key || '') && /^[a-z0-9]{6,30}$/.test(config.projectId || '') &&
    ['site','app'].includes(config.kind) && Array.isArray(config.hosts) && config.hosts.includes(w.location.hostname);
  function safeUrl(href = w.location.href) {
    try {
      const u = new URL(href, w.location.href);
      if (u.protocol !== 'https:' || u.username || u.password || !config.hosts?.includes(u.hostname) || /\/(?:espace|auth|callback|tracking)(?:\/|$)/i.test(u.pathname)) return false;
      if (config.kind === 'app' && !['/','/index.html', ...(Array.isArray(appPaths) ? appPaths : [])].includes(u.pathname)) return false;
      const publicAnchor = config.kind === 'site' && /^#[a-z][a-z0-9_-]{0,64}$/i.test(u.hash) && d.getElementById?.(u.hash.slice(1));
      if (u.hash && !publicAnchor) return false;
      for (const [k,v] of u.searchParams) {
        if (k === 'lang' && ['fr','en','en-US'].includes(v)) continue;
        if (/^utm_(source|medium|campaign)$/.test(k) && /^[a-z0-9_-]{1,50}$/i.test(v)) continue;
        return false;
      }
      return true;
    } catch { return false; }
  }
  function allowed() {
    return configured && safeUrl() && w.navigator?.globalPrivacyControl !== true &&
      w.navigator?.doNotTrack !== '1' && w.doNotTrack !== '1';
  }
  function read() {
    try {
      const value = JSON.parse(w.localStorage.getItem(key));
      if (value?.version === 1 && ['granted','denied'].includes(value.value) &&
        Number.isFinite(value.time) && value.time <= Date.now() && Date.now() - value.time < CONSENT_AGE) return value.value;
    } catch { /* Storage denial leaves the page usable and consent unknown. */ }
    return 'unknown';
  }
  function notify() { for (const fn of listeners) fn(api.status()); }
  function stop() {
    if (!started) return;
    stopped = true;
    // Drop any queued grant when the external tag is still loading.
    if (w.clarity?.q) w.clarity.q = [];
    try {
      w.clarity('consentv2', {analytics_Storage:'denied', ad_Storage:'denied'});
      w.clarity('consent', false);
      w.clarity('stop');
    } catch { /* A blocked vendor must never break the host application. */ }
    if (pending) pending.remove();
  }
  function track(name) {
    if (!EVENTS.has(name) || !started || stopped || decision !== 'granted' || !allowed()) return false;
    try { w.clarity('event', name); return true; } catch { return false; }
  }
  function start() {
    if (started || stopped || decision !== 'granted' || !allowed() || w.clarity) return;
    if (config.kind === 'app') d.documentElement.setAttribute('data-clarity-mask','true');
    else for (const form of d.querySelectorAll('form')) form.setAttribute('data-clarity-mask','true');
    const queue = function() { (queue.q = queue.q || []).push(arguments); };
    w.clarity = queue;
    w.clarity('consentv2', {analytics_Storage:'granted', ad_Storage:'denied'});
    w.clarity('set', 'valor_surface', config.key);
    pending = d.createElement('script');
    pending.async = true;
    pending.src = 'https://www.clarity.ms/tag/' + config.projectId;
    pending.referrerPolicy = 'no-referrer';
    pending.onerror = () => { stopped = true; notify(); };
    pending.onload = () => { if (stopped || decision !== 'granted' || !allowed()) { started = true; stop(); } };
    started = true;
    d.head.appendChild(pending);
    track(config.kind === 'app' ? 'app_open' : 'site_open');
  }
  const api = Object.freeze({
    status: () => ({configured, eligible:allowed(), decision, active:started && !stopped, reloadRequired:stopped}),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setConsent(value) {
      if (!['granted','denied'].includes(value)) return false;
      decision = value;
      try { w.localStorage.setItem(key, JSON.stringify({version:1,value,time:Date.now()})); } catch { /* Session-only choice. */ }
      if (value === 'denied') stop(); else start();
      notify(); return true;
    },
    track
  });
  decision = read();
  w.addEventListener('storage', event => { if (event.key === key || event.key === null) { decision = read(); if (decision !== 'granted') stop(); else start(); notify(); } });
  const guard = () => { if (!allowed()) stop(); notify(); };
  w.addEventListener('popstate', guard);
  w.addEventListener('hashchange', guard);
  // Stop before a SPA exposes a URL with tokens or customer references to the SDK.
  for (const method of ['pushState','replaceState']) {
    const original = w.history?.[method];
    if (original) w.history[method] = function(state,title,url) {
      if (url != null && !safeUrl(url)) stop();
      return original.apply(this, arguments);
    };
  }
  start();
  return api;
}
export function mountAudience(config, w) {
  const api = createAudience(config,w), d = w.document;
  w.ValorAudience = api;
  if (!api.status().configured || !api.status().eligible) return api;
  const english = () => d.documentElement.lang?.startsWith('en') || new URL(w.location.href).searchParams.get('lang')?.startsWith('en');
  const copy = () => english() ? {
    control:'Privacy', title:'Optional audience measurement',
    text:'With your agreement, Microsoft Clarity measures visits, clicks and navigation and reconstructs masked sessions. You can refuse or withdraw at any time. Advertising consent stays disabled.',
    accept:'Accept', deny:'Refuse', close:'Close', legal:'Privacy information', reload:'Your choice is saved. Reload to restart audience measurement.'
  } : {
    control:'Confidentialité', title:'Mesure d’audience facultative',
    text:'Avec votre accord, Microsoft Clarity mesure les visites, clics et parcours et reconstitue les sessions masquées. Vous pouvez refuser ou retirer votre accord à tout moment. Le consentement publicitaire reste désactivé.',
    accept:'Accepter', deny:'Refuser', close:'Fermer', legal:'Informations de confidentialité', reload:'Votre choix est enregistré. Rechargez pour reprendre la mesure d’audience.'
  };
  const control = d.createElement('button'); control.type = 'button'; control.className = 'valor-audience-control';
  const panel = d.createElement('section'); panel.className = 'valor-audience-panel'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-labelledby','valor-audience-title');
  const title = d.createElement('h2'); title.id = 'valor-audience-title';
  const text = d.createElement('p');
  const legal = d.createElement('a'); legal.href = config.privacyPath || '/mentions-legales/';
  const actions = d.createElement('div'); actions.className = 'valor-audience-actions';
  const accept = d.createElement('button'), deny = d.createElement('button'), close = d.createElement('button');
  for (const button of [accept,deny,close]) { button.type = 'button'; actions.appendChild(button); }
  panel.append(title,text,legal,actions); d.body.append(control,panel);
  function refresh() { const c=copy(); control.textContent=c.control; title.textContent=c.title; text.textContent=api.status().reloadRequired && api.status().decision==='granted'?c.reload:c.text; legal.textContent=c.legal; accept.textContent=c.accept; deny.textContent=c.deny; close.textContent=c.close; }
  function hide() { panel.hidden=true; control.focus(); }
  control.addEventListener('click', () => { refresh(); panel.hidden=false; deny.focus(); });
  accept.addEventListener('click', () => { api.setConsent('granted'); hide(); });
  deny.addEventListener('click', () => { api.setConsent('denied'); hide(); });
  close.addEventListener('click', hide);
  panel.addEventListener('keydown', event => { if(event.key==='Escape') hide(); });
  api.subscribe(refresh);
  panel.hidden=api.status().decision!=='unknown'; refresh();
  d.addEventListener('click', event => {
    const target=event.target?.closest?.('[data-valor-event], a, [data-view], nav button, [role=tab]' );
    if (!target) return;
    const declared=target.getAttribute('data-valor-event');
    if (declared) { api.track(declared); return; }
    if (target.hasAttribute('data-view') || target.matches?.('nav button, [role=tab]')) { api.track('navigation'); return; }
    try {
      const url=new URL(target.href,w.location.href);
      if (url.hostname==='apps.microsoft.com' || url.hostname==='marketplace.microsoft.com') api.track('store_open');
      else if (url.hostname==='bookings.cloud.microsoft' || url.hostname==='outlook.office365.com' && url.pathname.includes('book')) api.track('booking_open');
      else if (url.protocol==='mailto:' || url.pathname==='/contact/') api.track('contact_open');
      else if (['valor.pro','surveyor.valor.cloud','casemaster.valor.cloud','exorcist.valor.cloud','synapse.valor.cloud'].includes(url.hostname) && url.hostname!==w.location.hostname) api.track('peer_open');
    } catch { /* No href or an unsupported link. */ }
  });
  return api;
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const boot=() => { try { const meta=document.querySelector('meta[name="valor-audience"]'); if(meta) mountAudience(JSON.parse(meta.content),window); } catch { /* Invalid config is inert. */ } };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
}
