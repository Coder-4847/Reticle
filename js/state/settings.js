// Central settings store. Adding a setting = adding one line to DEFAULTS.
const KEY = 'reticle.settings';
export const SCHEMA_VERSION = 1;

export const DEFAULTS = {
  ui: { accent: '#4f8dff', animations: 'system' },
  run: { mode: 'flick', duration: 30 },
  flick: { radius: 28, lifetime: 1600 },
  targets: { color: '#ff4f6a' },
  crosshair: {
    color: '#4dffa6', length: 7, thickness: 2, gap: 4,
    dot: false, dotSize: 2, outline: true, outlineThickness: 1, opacity: 1,
  },
  background: { color: '#0b0c0f' },
  audio: { master: 0.5 },
};

// MIGRATIONS[n] upgrades stored data from schema version n to n + 1.
const MIGRATIONS = {};

const clone = (v) => JSON.parse(JSON.stringify(v));
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Rebuild `src` in the shape of `def`: unknown keys are dropped, wrong types fall back to defaults.
function conform(def, src) {
  const out = {};
  for (const key of Object.keys(def)) {
    const d = def[key];
    const v = isPlainObject(src) ? src[key] : undefined;
    if (isPlainObject(d)) out[key] = conform(d, v);
    else if (Array.isArray(d)) out[key] = Array.isArray(v) ? v : clone(d);
    else if (d === null) out[key] = v === undefined ? null : v;
    else if (typeof v === typeof d && (typeof v !== 'number' || Number.isFinite(v))) out[key] = v;
    else out[key] = d;
  }
  return out;
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
  if (!raw) return { data: clone(DEFAULTS), reset: false };
  try {
    const parsed = JSON.parse(raw);
    let version = Number(parsed.version) || 0;
    let data = parsed.data;
    for (; version < SCHEMA_VERSION; version++) {
      if (MIGRATIONS[version]) data = MIGRATIONS[version](data);
    }
    return { data: conform(DEFAULTS, data), reset: false };
  } catch {
    return { data: clone(DEFAULTS), reset: true };
  }
}

const loaded = load();
let data = loaded.data;
const subscribers = new Set();
let saveTimer = 0;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ version: SCHEMA_VERSION, data })); } catch { /* quota or private mode */ }
  }, 120);
}

function notify(path, value) {
  for (const fn of subscribers) fn(path, value);
}

export const settings = {
  wasReset: loaded.reset,
  get(path) {
    return path.split('.').reduce((o, k) => o?.[k], data);
  },
  set(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const parent = keys.reduce((o, k) => o?.[k], data);
    if (!parent || !(last in parent) || parent[last] === value) return;
    parent[last] = value;
    save();
    notify(path, value);
  },
  resetSection(section) {
    if (!(section in DEFAULTS)) return;
    data[section] = clone(DEFAULTS[section]);
    save();
    notify(section, data[section]);
  },
  snapshot() {
    return clone(data);
  },
  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};

const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
reducedQuery.addEventListener?.('change', () => notify('ui.animations', data.ui.animations));

/** Effective animation level: 'full' | 'reduced' | 'off'. 'system' follows the OS preference. */
export function motionLevel() {
  const v = data.ui.animations;
  if (v === 'full' || v === 'reduced' || v === 'off') return v;
  return reducedQuery.matches ? 'reduced' : 'full';
}
