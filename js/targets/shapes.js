import { shapeStore } from './shapeStore.js';

// Shapes live in unit space centered on (0, 0); a target of radius r is the shape scaled by r.
// Filling and hit testing both use the NONZERO winding rule.
const TAU = Math.PI * 2;

function regular(n, radius, start) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * TAU;
    out.push(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  return out;
}

function star(points, outer, inner) {
  const out = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i / (points * 2)) * TAU;
    const r = i % 2 ? inner : outer;
    out.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return out;
}

export const BUILTIN = {
  circle: { name: 'Circle', kind: 'circle' },
  square: { name: 'Square', kind: 'poly', poly: [-0.88, -0.88, 0.88, -0.88, 0.88, 0.88, -0.88, 0.88] },
  diamond: { name: 'Diamond', kind: 'poly', poly: regular(4, 1.15, -Math.PI / 2) },
  triangle: { name: 'Triangle', kind: 'poly', poly: regular(3, 1.25, -Math.PI / 2) },
  hexagon: { name: 'Hexagon', kind: 'poly', poly: regular(6, 1.05, 0) },
  star: { name: 'Star', kind: 'poly', poly: star(5, 1.2, 0.52) },
  ring: { name: 'Ring', kind: 'ring', inner: 0.58 },
};

export const BUILTIN_IDS = Object.keys(BUILTIN);
export const CUSTOM_PREFIX = 'custom:';
const cache = new Map();

function build(id, def) {
  const path = new Path2D();
  let bound = 1;
  let poly = null;
  if (def.kind === 'circle') {
    path.arc(0, 0, 1, 0, TAU);
  } else if (def.kind === 'ring') {
    path.arc(0, 0, 1, 0, TAU);
    path.moveTo(def.inner, 0);
    path.arc(0, 0, def.inner, 0, TAU, true); // opposite winding -> hole under nonzero
  } else {
    poly = Float32Array.from(def.poly);
    path.moveTo(poly[0], poly[1]);
    for (let i = 2; i < poly.length; i += 2) path.lineTo(poly[i], poly[i + 1]);
    path.closePath();
    bound = 0;
    for (let i = 0; i < poly.length; i += 2) bound = Math.max(bound, Math.hypot(poly[i], poly[i + 1]));
  }
  return { id, name: def.name, kind: def.kind, poly, path, bound };
}

/** Resolve a shape id (built-in or "custom:<id>") to { kind, path, poly, bound }. Unknown ids fall back to circle. */
export function getShape(id) {
  let shape = cache.get(id);
  if (shape) return shape;
  if (BUILTIN[id]) {
    shape = build(id, BUILTIN[id]);
  } else if (id?.startsWith(CUSTOM_PREFIX)) {
    const custom = shapeStore.get(id.slice(CUSTOM_PREFIX.length));
    if (custom) shape = build(id, { name: custom.name, kind: 'poly', poly: custom.points });
  }
  if (!shape) return getShape('circle');
  cache.set(id, shape);
  return shape;
}

shapeStore.subscribe(() => {
  for (const id of cache.keys()) if (id.startsWith(CUSTOM_PREFIX)) cache.delete(id);
});
