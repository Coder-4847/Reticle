import { settings, DEFAULTS, conform } from './settings.js';

// Setting profiles: named snapshots of the "look and feel" sections. The active
// profile follows your edits; switching applies another profile's sections.
const KEY = 'reticle.profiles';
export const PROFILE_SECTIONS = ['crosshair', 'trail', 'targets', 'background', 'audio', 'pointer', 'effects'];
const CODE_PREFIX = 'RP1-';
const listeners = new Set();
let state = null;
let applying = false;
let saveTimer = 0;
export let profilesWereReset = false;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pick = (snap) => Object.fromEntries(PROFILE_SECTIONS.map((s) => [s, snap[s]]));
const clean = (data) => Object.fromEntries(PROFILE_SECTIONS.map((s) => [s, conform(DEFAULTS[s], data?.[s], s)]));
const validName = (n) => (typeof n === 'string' && n.trim() ? n.trim().slice(0, 32) : 'Profile');

function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* unavailable */ }
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    const list = Array.isArray(parsed?.list)
      ? parsed.list.filter((p) => p && typeof p.id === 'string').map((p) => ({ id: p.id, name: validName(p.name), data: clean(p.data) }))
      : [];
    if (list.length) return { active: list.some((p) => p.id === parsed.active) ? parsed.active : list[0].id, list };
  } catch {
    profilesWereReset = true;
  }
  const id = uid();
  return { active: id, list: [{ id, name: 'Default', data: pick(settings.snapshot()) }] };
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  }, 150);
  for (const fn of listeners) fn(state);
}

function apply(data) {
  applying = true;
  for (const s of PROFILE_SECTIONS) settings.importSection(s, data[s]);
  applying = false;
}

const find = (id) => state.list.find((p) => p.id === id);

export const profiles = {
  init() {
    state = load();
    persist();
    settings.subscribe((path) => {
      if (applying) return;
      const section = path.split('.')[0];
      if (path !== '*' && !PROFILE_SECTIONS.includes(section)) return;
      const active = find(state.active);
      if (active) {
        active.data = pick(settings.snapshot());
        persist();
      }
    });
  },
  list: () => state.list,
  activeId: () => state.active,
  active: () => find(state.active),
  switchTo(id) {
    const p = find(id);
    if (!p || id === state.active) return;
    state.active = id;
    apply(p.data);
    persist();
  },
  /** New profile from the current settings; becomes active. */
  create(name) {
    const p = { id: uid(), name: validName(name), data: pick(settings.snapshot()) };
    state.list.push(p);
    state.active = p.id;
    persist();
    return p.id;
  },
  duplicate(id) {
    const src = find(id);
    if (!src) return null;
    const p = { id: uid(), name: validName(`${src.name} copy`), data: JSON.parse(JSON.stringify(src.data)) };
    state.list.splice(state.list.indexOf(src) + 1, 0, p);
    persist();
    return p.id;
  },
  rename(id, name) {
    const p = find(id);
    if (!p) return;
    p.name = validName(name);
    persist();
  },
  remove(id) {
    if (state.list.length <= 1) return;
    const i = state.list.findIndex((p) => p.id === id);
    if (i < 0) return;
    state.list.splice(i, 1);
    if (state.active === id) {
      state.active = state.list[Math.max(0, i - 1)].id;
      apply(find(state.active).data);
    }
    persist();
  },
  encode(id) {
    const p = find(id);
    const json = JSON.stringify({ n: p.name, d: p.data });
    return CODE_PREFIX + btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  },
  /** Add a profile from a share code. Returns its id, or null if the code is invalid. */
  importCode(code) {
    try {
      const s = String(code).trim();
      if (!s.startsWith(CODE_PREFIX)) return null;
      const bytes = Uint8Array.from(atob(s.slice(CODE_PREFIX.length)), (c) => c.charCodeAt(0));
      const { n, d } = JSON.parse(new TextDecoder().decode(bytes));
      const p = { id: uid(), name: validName(n), data: clean(d) };
      state.list.push(p);
      persist();
      return p.id;
    } catch {
      return null;
    }
  },
  /** Backup support: the raw state, and restoring it. */
  exportState: () => JSON.parse(JSON.stringify(state)),
  importState(next) {
    if (!next || !Array.isArray(next.list) || !next.list.length) return;
    const list = next.list.filter((p) => p && typeof p.id === 'string').map((p) => ({ id: p.id, name: validName(p.name), data: clean(p.data) }));
    state = { active: next.active, list };
    if (!find(state.active)) state.active = state.list[0].id;
    persist();
  },
  /** Back to a single "Default" profile holding the current settings. */
  reset() {
    const id = uid();
    state = { active: id, list: [{ id, name: 'Default', data: pick(settings.snapshot()) }] };
    persist();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
