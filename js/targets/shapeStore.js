// User-drawn shapes, stored locally. Points are a flat, normalized [x0, y0, x1, y1, ...] array.
const KEY = 'reticle.shapes';
export const MAX_SHAPES = 12;
const listeners = new Set();

function valid(s) {
  return s && typeof s.id === 'string' && typeof s.name === 'string' &&
    Array.isArray(s.points) && s.points.length >= 6 && s.points.length % 2 === 0 &&
    s.points.every(Number.isFinite);
}

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(valid).slice(0, MAX_SHAPES) : [];
  } catch {
    return [];
  }
}

let shapes = read();

function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(shapes)); } catch { /* quota */ }
  for (const fn of listeners) fn(shapes);
}

export const shapeStore = {
  list: () => shapes,
  get: (id) => shapes.find((s) => s.id === id) ?? null,
  isFull: () => shapes.length >= MAX_SHAPES,
  add(name, points) {
    if (shapes.length >= MAX_SHAPES) return null;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    shapes = [...shapes, { id, name: name.trim().slice(0, 24) || 'Custom shape', points }];
    commit();
    return id;
  },
  rename(id, name) {
    shapes = shapes.map((s) => (s.id === id ? { ...s, name: name.trim().slice(0, 24) || s.name } : s));
    commit();
  },
  remove(id) {
    shapes = shapes.filter((s) => s.id !== id);
    commit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
