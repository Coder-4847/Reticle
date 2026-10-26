// Central settings store. Adding a setting = adding one line to DEFAULTS.
const KEY = 'reticle.settings';
export const SCHEMA_VERSION = 2;

export const DEFAULTS = {
  ui: { accent: '#4f8dff', animations: 'system' },
  run: { mode: 'flick', duration: 30 },
  modes: {
    flick: { preset: 'standard', size: 28, lifetime: 1600, spawnDelay: 0, count: 1, speed: 0, area: 'full' },
    gridshot: { preset: 'standard', size: 30, lifetime: 0, count: 3, speed: 0, area: 'box' },
    tracking: { preset: 'standard', size: 32, speed: 260, area: 'full', holdToTrack: true },
    reaction: { preset: 'standard', trials: 5 },
    switching: { preset: 'standard', size: 28, lifetime: 1600, count: 3, speed: 0, area: 'full' },
  },
  targets: {
    shape: 'circle', colorMode: 'single', color: '#ff4f6a', hitColor: '#ffffff',
    outline: false, glow: false, opacity: 1, sizeVariation: 0, randomRotation: false,
  },
  crosshair: {
    style: 'classic', color: '#4dffa6', length: 7, thickness: 2, gap: 4,
    dot: false, dotSize: 2, outline: true, outlineThickness: 1, opacity: 1,
    pulse: false, pulseStrength: 4,
  },
  pointer: { lock: false, sensitivity: 1, hitFeedback: 'sound' },
  trail: { enabled: false, style: 'line', colorMode: 'crosshair', color: '#ffffff', length: 160, fade: 0.5, width: 3 },
  background: {
    type: 'solid', color: '#0b0c0f', color2: '#1a2233', gridSpacing: 48, gridOpacity: 0.06,
    vignette: false, imageDim: 0.5, brightness: 1,
  },
  audio: { master: 0.5, hit: 0.8, miss: 0.6, spawn: 0.25, countdown: 0.7, hitTimbre: 'click' },
};

// Allowed values for string settings, keyed by path. Anything else falls back to the default.
export const ENUMS = {
  'ui.animations': ['system', 'full', 'reduced', 'off'],
  'crosshair.style': ['classic', 't', 'dot', 'circle', 'circleDot'],
  'pointer.hitFeedback': ['sound', 'flash', 'both', 'none'],
  'trail.style': ['line', 'dots', 'glow'],
  'trail.colorMode': ['accent', 'crosshair', 'custom'],
  'background.type': ['solid', 'grid', 'gradient', 'stars', 'image'],
  'targets.colorMode': ['single', 'states'],
  'audio.hitTimbre': ['click', 'pop', 'tick'],
};

// MIGRATIONS[n] upgrades stored data from schema version n to n + 1.
const MIGRATIONS = {
  1: (d) => {
    if (d?.flick) d.modes = { flick: { size: d.flick.radius, lifetime: d.flick.lifetime } };
    return d;
  },
};

const clone = (v) => JSON.parse(JSON.stringify(v));
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

// Rebuild `src` in the shape of `def`: unknown keys are dropped, invalid values fall back to defaults.
export function conform(def, src, path = '') {
  const out = {};
  for (const key of Object.keys(def)) {
    const d = def[key];
    const v = isPlainObject(src) ? src[key] : undefined;
    const p = path ? `${path}.${key}` : key;
    if (isPlainObject(d)) out[key] = conform(d, v, p);
    else if (Array.isArray(d)) out[key] = Array.isArray(v) ? v : clone(d);
    else if (typeof v !== typeof d || (typeof v === 'number' && !Number.isFinite(v))) out[key] = d;
    else if (ENUMS[p] && !ENUMS[p].includes(v)) out[key] = d;
    else if (typeof d === 'string' && isHex(d) && !isHex(v)) out[key] = d;
    else out[key] = v;
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

const resolve = (path) => path.split('.').reduce((o, k) => o?.[k], data);
const resolveDefault = (path) => path.split('.').reduce((o, k) => o?.[k], DEFAULTS);

export const settings = {
  wasReset: loaded.reset,
  get: resolve,
  default: resolveDefault,
  set(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const parent = keys.reduce((o, k) => o?.[k], data);
    if (!parent || !(last in parent) || parent[last] === value) return;
    parent[last] = value;
    save();
    notify(path, value);
  },
  /** Reset a section (e.g. 'crosshair' or 'modes.flick') to its defaults. */
  resetSection(path) {
    settings.importSection(path, resolveDefault(path));
  },
  /** Replace a whole section with validated values (used by reset and share codes). */
  importSection(path, value) {
    const def = resolveDefault(path);
    if (!isPlainObject(def)) return;
    const keys = path.split('.');
    const last = keys.pop();
    const parent = keys.reduce((o, k) => o[k], data);
    parent[last] = conform(def, value, path);
    save();
    notify(path, parent[last]);
  },
  /** Replace every setting (validated). Subscribers get path '*'. */
  replaceAll(value) {
    data = conform(DEFAULTS, value);
    save();
    notify('*', data);
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
