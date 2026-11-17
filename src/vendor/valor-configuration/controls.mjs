export const zoomPresets = Object.freeze([75, 100, 150]);
export const zoomLevels = Object.freeze([75, 90, 100, 110, 125, 150]);
// Application status bars include 50% without changing website cartouche choices.
// Keep the existing intermediate levels valid for saved application preferences.
export const statusZoomPresets = Object.freeze([50, 75, 100, 125, 150]);
export const statusZoomLevels = Object.freeze([50, 75, 90, 100, 110, 125, 150]);

export function nextZoom(percent, direction, levels = zoomLevels) {
  if (direction > 0) return levels.find(level => level > percent) ?? levels.at(-1);
  return levels.findLast(level => level < percent) ?? levels[0];
}

export function fitZoom({ width, height, designWidth, designHeight, minimum = 75, maximum = 100 }) {
  const widthRatio = width > 0 && designWidth > 0 ? width / designWidth : 1;
  const heightRatio = height > 0 && designHeight > 0 ? height / designHeight : 1;
  return Math.max(minimum, Math.min(maximum, Math.floor(Math.min(widthRatio, heightRatio) * 100)));
}

// Product adapters own the storage namespace, supported choices and explicit route language.
export function createPreferences({ read, write, defaults, choices }) {
  function normalize(candidate) {
    return Object.fromEntries(Object.entries(defaults).map(([name, fallback]) => {
      const value = candidate?.[name];
      const valid = choices[name] ? choices[name].includes(value) : typeof value === typeof fallback;
      return [name, valid ? value : fallback];
    }));
  }
  let values;
  function reload(clear = false) {
    let stored;
    try { if (!clear) stored = read(); } catch { /* Storage may be unavailable. */ }
    values = normalize(stored);
    return { ...values };
  }
  reload();
  return {
    get value() { return { ...values }; },
    reload,
    set(patch) {
      values = normalize({ ...values, ...patch });
      try { write({ ...values }); } catch { /* Keep the current session usable. */ }
      return { ...values };
    }
  };
}

// Keep the region available independently of the visual presentation and browser zoom.
export function mountChoices(group, { placement = 'below', getBounds, onSelect } = {}) {
  const trigger = group.querySelector('[aria-controls]');
  const panel = group.querySelector('[data-choices]');
  const root = group.getRootNode();
  const doc = group.ownerDocument;
  const view = doc.defaultView;
  const buttons = () => Array.from(panel.querySelectorAll('button:not(:disabled)'));
  let hovering = false;
  let suppressFocus = false;
  let closeTimer;

  function place() {
    if (panel.hidden) return;
    const frame = view.visualViewport;
    const bounds = getBounds?.();
    const viewportLeft = frame?.offsetLeft ?? 0;
    const viewportTop = frame?.offsetTop ?? 0;
    const left = Math.max(viewportLeft, bounds?.left ?? viewportLeft) + 8;
    const top = Math.max(viewportTop, bounds?.top ?? viewportTop) + 8;
    const right = Math.min(viewportLeft + (frame?.width ?? view.innerWidth), bounds ? bounds.left + bounds.width : Infinity) - 8;
    const bottom = Math.min(viewportTop + (frame?.height ?? view.innerHeight), bounds ? bounds.top + bounds.height : Infinity) - 8;
    const anchor = group.getBoundingClientRect();
    const factor = panel.currentCSSZoom || 1;
    const above = Math.max(0, anchor.top - top);
    const below = Math.max(0, bottom - anchor.bottom);
    const naturalHeight = panel.scrollHeight * factor;
    const opensAbove = placement === 'above' ? above >= Math.min(naturalHeight, below) : below < Math.min(naturalHeight, above);
    panel.dataset.side = opensAbove ? 'above' : 'below';
    panel.style.maxWidth = `${Math.max(1, (right - left) / factor)}px`;
    panel.style.maxHeight = `${Math.max(1, (opensAbove ? above : below) / factor)}px`;
    panel.style.marginInlineStart = '0px';
    const rect = panel.getBoundingClientRect();
    const shift = Math.max(left - rect.left, Math.min(0, right - rect.right)) / factor;
    panel.style.marginInlineStart = `${view.getComputedStyle(group).direction === 'rtl' ? -shift : shift}px`;
  }
  function show() {
    view.clearTimeout(closeTimer);
    if (!panel.hidden) return;
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    place();
  }
  function close(restore = false) {
    view.clearTimeout(closeTimer);
    if (restore) {
      suppressFocus = true;
      trigger.focus();
      suppressFocus = false;
    }
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }
  function deferClose() {
    view.clearTimeout(closeTimer);
    closeTimer = view.setTimeout(() => {
      if (!hovering && !group.contains(root.activeElement)) close();
    }, 100);
  }
  function enter(event) { if (event.pointerType === 'mouse') { hovering = true; show(); } }
  function leave(event) { if (event.pointerType === 'mouse') { hovering = false; deferClose(); } }
  function focus() { if (!suppressFocus) show(); }
  function click(event) {
    const choice = event.target.closest('[data-choice]');
    if (choice && panel.contains(choice)) {
      onSelect?.(choice.dataset.choice);
      close(true);
    } else if (trigger.contains(event.target)) {
      show();
    }
  }
  function keys(event) {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      show();
      const items = buttons();
      const index = items.indexOf(root.activeElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index < 1 ? items.length - 1 : index - 1);
      items[next]?.focus();
    }
  }
  function outside(event) { if (!event.composedPath().includes(group) && !panel.hidden) close(); }
  group.addEventListener('pointerenter', enter);
  group.addEventListener('pointerleave', leave);
  group.addEventListener('focusin', focus);
  group.addEventListener('focusout', deferClose);
  group.addEventListener('click', click);
  group.addEventListener('keydown', keys);
  doc.addEventListener('pointerdown', outside);
  view.addEventListener('resize', place);
  view.addEventListener('scroll', place, true);
  view.visualViewport?.addEventListener('resize', place);
  view.visualViewport?.addEventListener('scroll', place);
  return () => {
    close();
    group.removeEventListener('pointerenter', enter);
    group.removeEventListener('pointerleave', leave);
    group.removeEventListener('focusin', focus);
    group.removeEventListener('focusout', deferClose);
    group.removeEventListener('click', click);
    group.removeEventListener('keydown', keys);
    doc.removeEventListener('pointerdown', outside);
    view.removeEventListener('resize', place);
    view.removeEventListener('scroll', place, true);
    view.visualViewport?.removeEventListener('resize', place);
    view.visualViewport?.removeEventListener('scroll', place);
  };
}

export function mountFullscreen({ target, button, enterLabel, exitLabel, onChange, onError }) {
  const doc = target.ownerDocument;
  let pending = false;
  let disposed = false;
  const supported = typeof target.requestFullscreen === 'function' && doc.fullscreenEnabled !== false;
  function update() {
    if (disposed) return;
    const active = doc.fullscreenElement === target;
    button.disabled = pending || Boolean(doc.fullscreenElement && !active);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? exitLabel() : enterLabel());
    button.title = button.getAttribute('aria-label');
    onChange?.(active);
  }
  async function toggle() {
    if (pending || button.disabled) return;
    pending = true;
    update();
    try {
      if (doc.fullscreenElement === target) await doc.exitFullscreen();
      else await target.requestFullscreen();
      if (disposed && doc.fullscreenElement === target) await doc.exitFullscreen();
    } catch (error) {
      if (!disposed) onError?.(error);
    } finally {
      pending = false;
      update();
    }
  }
  button.hidden = !supported;
  if (supported) {
    update();
    button.addEventListener('click', toggle);
    doc.addEventListener('fullscreenchange', update);
  }
  return {
    update,
    dispose() {
      disposed = true;
      button.removeEventListener('click', toggle);
      doc.removeEventListener('fullscreenchange', update);
      if (doc.fullscreenElement === target) void doc.exitFullscreen().catch(() => {});
    }
  };
}
