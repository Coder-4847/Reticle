// Polygon helpers for the custom shape pipeline. Points are [[x, y], ...].

function perpDistSq(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  if (len === 0) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
}

/** Ramer-Douglas-Peucker simplification (iterative). */
export function simplify(points, epsilon) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const epsSq = epsilon * epsilon;
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpDistSq(points[i], points[first], points[last]);
      if (d > maxD) { maxD = d; index = i; }
    }
    if (maxD > epsSq) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Chaikin corner cutting on a closed polygon. */
export function smoothClosed(points, iterations = 2) {
  let pts = points;
  for (let k = 0; k < iterations; k++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}

/** Signed area and area-weighted centroid (falls back to vertex mean for degenerate shapes). */
export function centroid(points) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  a /= 2;
  if (Math.abs(a) < 1e-6) {
    const n = points.length;
    return { x: points.reduce((s, p) => s + p[0], 0) / n, y: points.reduce((s, p) => s + p[1], 0) / n, area: 0 };
  }
  return { x: cx / (6 * a), y: cy / (6 * a), area: a };
}

/** Center on the centroid and scale so the farthest vertex sits at distance 1. Returns a flat array. */
export function normalize(points) {
  const c = centroid(points);
  let max = 0;
  for (const [x, y] of points) max = Math.max(max, Math.hypot(x - c.x, y - c.y));
  if (max === 0) return null;
  const out = [];
  for (const [x, y] of points) out.push(+((x - c.x) / max).toFixed(4), +((y - c.y) / max).toFixed(4));
  return out;
}
