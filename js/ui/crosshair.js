// Crosshair drawn in device pixels so every line lands on whole pixels (no blur).
const rects = new Float32Array(5 * 4); // up to 4 arms + dot, [x, y, w, h] each

function buildRects(cx, cy, c, s) {
  const t = Math.max(1, Math.round(c.thickness * s));
  const len = Math.round(c.length * s);
  const gap = Math.round(c.gap * s);
  const lo = Math.floor((t - 1) / 2); // offset so odd thicknesses center on the pixel
  let n = 0;
  const push = (x, y, w, h) => {
    rects[n++] = x; rects[n++] = y; rects[n++] = w; rects[n++] = h;
  };
  if (len > 0) {
    push(cx + 1 + gap, cy - lo, len, t); // right
    push(cx - gap - len, cy - lo, len, t); // left
    push(cx - lo, cy + 1 + gap, t, len); // bottom
    push(cx - lo, cy - gap - len, t, len); // top
  }
  if (c.dot) {
    const d = Math.max(1, Math.round(c.dotSize * s));
    const dlo = Math.floor((d - 1) / 2);
    push(cx - dlo, cy - dlo, d, d);
  }
  return n;
}

export function drawCrosshair(ctx, x, y, c, dpr) {
  const cx = Math.round(x * dpr);
  const cy = Math.round(y * dpr);
  const n = buildRects(cx, cy, c, dpr);
  if (!n) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = c.opacity;
  if (c.outline) {
    const o = Math.max(1, Math.round(c.outlineThickness * dpr));
    ctx.fillStyle = '#000';
    for (let i = 0; i < n; i += 4) ctx.fillRect(rects[i] - o, rects[i + 1] - o, rects[i + 2] + o * 2, rects[i + 3] + o * 2);
  }
  ctx.fillStyle = c.color;
  for (let i = 0; i < n; i += 4) ctx.fillRect(rects[i], rects[i + 1], rects[i + 2], rects[i + 3]);
  ctx.restore();
}
