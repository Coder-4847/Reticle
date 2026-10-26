// Point-in-shape tests. Polygons use the nonzero winding rule, matching how they are filled.

const isLeft = (x1, y1, x2, y2, px, py) => (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1);

/** Nonzero winding test on a flat [x0, y0, x1, y1, ...] polygon. */
export function pointInPolygon(px, py, poly) {
  let winding = 0;
  const n = poly.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const x1 = poly[j];
    const y1 = poly[j + 1];
    const x2 = poly[i];
    const y2 = poly[i + 1];
    if (y1 <= py) {
      if (y2 > py && isLeft(x1, y1, x2, y2, px, py) > 0) winding++;
    } else if (y2 <= py && isLeft(x1, y1, x2, y2, px, py) < 0) {
      winding--;
    }
  }
  return winding !== 0;
}

/**
 * Does world point (x, y) hit a target { x, y, r, rot } drawn with `shape`?
 * The point is moved into the shape's unit space (undo translate, rotation and scale).
 * Ring targets count the whole disc as the hit area. `scale` matches an animated draw size.
 */
export function hitTarget(tg, shape, x, y, scale = 1) {
  const r = tg.r * scale;
  const dx = x - tg.x;
  const dy = y - tg.y;
  const reach = shape.bound * r;
  if (dx * dx + dy * dy > reach * reach) return false;
  if (shape.kind !== 'poly') return dx * dx + dy * dy <= r * r;
  const c = Math.cos(tg.rot);
  const s = Math.sin(tg.rot);
  const lx = (dx * c + dy * s) / r;
  const ly = (-dx * s + dy * c) / r;
  return pointInPolygon(lx, ly, shape.poly);
}
