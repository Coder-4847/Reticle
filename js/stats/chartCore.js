// Chart primitives: palette, sizing, animation, ticks, tooltips, small drawing helpers.
import { motionLevel } from '../state/settings.js';
import { easeOutCubic } from '../engine/ease.js';

// Chart palette: validated categorical slots (dark mode) and a one-hue blue sequential ramp.
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
export const SEQ = ['#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef'];
export const INK = {
  primary: '#eef1f4', secondary: '#a6adb6', muted: '#8e959f',
  grid: 'rgba(255,255,255,0.07)', surface: '#13161a',
};
export const FONT = '11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Size a canvas to its CSS box (and optional fixed height) at device resolution. */
export function fit(canvas, height) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  if (height) canvas.style.height = `${height}px`;
  const w = canvas.clientWidth || 300;
  const h = height ?? (canvas.clientHeight || 160);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/**
 * Run draw(p) with p easing 0 -> 1 (or straight to 1 when motion is off/reduced).
 * With `canvas`, the chart redraws whenever the canvas width changes afterwards.
 */
export function animateIn(draw, { duration = 800, delay = 0, canvas = null } = {}) {
  let done = false;
  let lastW = canvas?.clientWidth;
  if (canvas) {
    new ResizeObserver(() => {
      const w = canvas.clientWidth;
      if (done && w && w !== lastW) {
        lastW = w;
        draw(1);
      }
    }).observe(canvas);
  }
  const finish = () => {
    done = true;
    lastW = canvas?.clientWidth;
  };
  if (motionLevel() !== 'full') {
    draw(1);
    finish();
    return () => {};
  }
  let raf = 0;
  const start = performance.now() + delay;
  draw(0);
  const tick = (now) => {
    const k = Math.min(1, Math.max(0, (now - start) / duration));
    draw(easeOutCubic(k));
    if (k < 1) raf = requestAnimationFrame(tick);
    else finish();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** Round tick values covering [min, max]. */
export function niceTicks(min, max, count = 4) {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(+v.toFixed(10));
  return out;
}

export const compact = (v) => (Math.abs(v) >= 1000 ? `${+(v / 1000).toFixed(1)}K` : `${+v.toFixed(1)}`);

/** Shared tooltip bound to a chart host element (position: relative). Text only, via textContent. */
export function createTip(host) {
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  host.append(tip);
  return {
    show(x, y, { title, rows = [] }) {
      tip.replaceChildren();
      if (title) {
        const t = document.createElement('div');
        t.className = 'chart-tip__title';
        t.textContent = title;
        tip.append(t);
      }
      for (const r of rows) {
        const row = document.createElement('div');
        row.className = 'chart-tip__row';
        if (r.color) {
          const key = document.createElement('span');
          key.className = 'chart-tip__key';
          key.style.background = r.color;
          row.append(key);
        }
        const v = document.createElement('strong');
        v.textContent = r.value;
        row.append(v);
        if (r.label) {
          const l = document.createElement('span');
          l.textContent = r.label;
          row.append(l);
        }
        tip.append(row);
      }
      tip.hidden = false;
      const tw = tip.offsetWidth;
      let left = x + 12;
      if (left + tw > host.clientWidth) left = x - tw - 12;
      tip.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, y - tip.offsetHeight - 10)}px)`;
    },
    hide() {
      tip.hidden = true;
    },
  };
}

/** Pointer hover wiring: fn(x, y) on move, fn(null) on leave. */
export function onHover(canvas, fn) {
  canvas.addEventListener('pointermove', (e) => fn(e.offsetX, e.offsetY));
  canvas.addEventListener('pointerleave', () => fn(null));
}

export function roundTopRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

export function axisText(ctx, text, x, y, align = 'right', baseline = 'middle') {
  ctx.font = FONT;
  ctx.fillStyle = INK.muted;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

export function dot(ctx, x, y, color, alpha = 1, r = 4) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, Math.PI * 2);
  ctx.fillStyle = INK.surface;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
}
