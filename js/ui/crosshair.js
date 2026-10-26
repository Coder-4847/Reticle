import { DEFAULTS, conform } from '../state/settings.js';

// Line crosshairs are drawn in device pixels so every edge lands on a whole pixel.
const rects = new Float32Array(5 * 4); // up to 4 arms + dot, [x, y, w, h] each
const TAU = Math.PI * 2;

function buildRects(cx, cy, c, s, extraGap) {
  const t = Math.max(1, Math.round(c.thickness * s));
  const len = Math.round(c.length * s);
  const gap = Math.round((c.gap + extraGap) * s);
  const lo = Math.floor((t - 1) / 2); // odd thicknesses center on the pixel
  let n = 0;
  const push = (x, y, w, h) => {
    rects[n++] = x; rects[n++] = y; rects[n++] = w; rects[n++] = h;
  };
  if (len > 0 && (c.style === 'classic' || c.style === 't')) {
    push(cx + 1 + gap, cy - lo, len, t); // right
    push(cx - gap - len, cy - lo, len, t); // left
    push(cx - lo, cy + 1 + gap, t, len); // bottom
    if (c.style === 'classic') push(cx - lo, cy - gap - len, t, len); // top
  }
  if (c.dot || c.style === 'dot' || c.style === 'circleDot') {
    const d = Math.max(1, Math.round(c.dotSize * s));
    const dlo = Math.floor((d - 1) / 2);
    push(cx - dlo, cy - dlo, d, d);
  }
  return n;
}

/** Draw the crosshair at CSS position (x, y). `scale` is the device pixel ratio (or larger to zoom). */
export function drawCrosshair(ctx, x, y, c, scale, extraGap = 0) {
  const cx = Math.round(x * scale);
  const cy = Math.round(y * scale);
  const n = buildRects(cx, cy, c, scale, extraGap);
  const o = c.outline ? Math.max(1, Math.round(c.outlineThickness * scale)) : 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = c.opacity;
  if (c.style === 'circle' || c.style === 'circleDot') {
    const r = Math.max(2, (c.length + extraGap) * scale);
    const w = Math.max(1, c.thickness * scale);
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy + 0.5, r, 0, TAU);
    if (o) {
      ctx.lineWidth = w + o * 2;
      ctx.strokeStyle = '#000';
      ctx.stroke();
    }
    ctx.lineWidth = w;
    ctx.strokeStyle = c.color;
    ctx.stroke();
  }
  if (o) {
    ctx.fillStyle = '#000';
    for (let i = 0; i < n; i += 4) ctx.fillRect(rects[i] - o, rects[i + 1] - o, rects[i + 2] + o * 2, rects[i + 3] + o * 2);
  }
  ctx.fillStyle = c.color;
  for (let i = 0; i < n; i += 4) ctx.fillRect(rects[i], rects[i + 1], rects[i + 2], rects[i + 3]);
  ctx.restore();
}

/** Hit marker: four short diagonal ticks around the crosshair, fading out as k goes 0 -> 1. */
export function drawHitMarker(ctx, x, y, k, scale, color = '#ffffff') {
  const inner = (6 + 3 * k) * scale;
  const outer = inner + 6 * scale;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const dx = i & 1 ? 1 : -1;
    const dy = i & 2 ? 1 : -1;
    ctx.moveTo(x * scale + dx * inner * 0.707, y * scale + dy * inner * 0.707);
    ctx.lineTo(x * scale + dx * outer * 0.707, y * scale + dy * outer * 0.707);
  }
  ctx.stroke();
  ctx.restore();
}

// Share codes: "RX1-" + base64 of the values in a fixed key order.
const CODE_PREFIX = 'RX1-';
const CODE_KEYS = Object.keys(DEFAULTS.crosshair);

export function encodeCrosshair(c) {
  return CODE_PREFIX + btoa(JSON.stringify(CODE_KEYS.map((k) => c[k])));
}

/** Returns a validated crosshair config, or null if the code is invalid. */
export function decodeCrosshair(code) {
  try {
    const s = String(code).trim();
    if (!s.startsWith(CODE_PREFIX)) return null;
    const values = JSON.parse(atob(s.slice(CODE_PREFIX.length)));
    if (!Array.isArray(values)) return null;
    const obj = {};
    CODE_KEYS.forEach((k, i) => { obj[k] = values[i]; });
    return conform(DEFAULTS.crosshair, obj, 'crosshair');
  } catch {
    return null;
  }
}
