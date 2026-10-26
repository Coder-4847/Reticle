import { motionLevel } from '../state/settings.js';
import { easeOutCubic } from '../engine/ease.js';

// Chart palette: validated categorical slots (dark mode) and a one-hue blue sequential ramp.
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
export const SEQ = ['#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef'];
export const INK = {
  primary: '#eef1f4', secondary: '#a6adb6', muted: '#6b727c',
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

/** Run draw(p) with p easing 0 -> 1 (or straight to 1 when motion is off/reduced). */
export function animateIn(draw, { duration = 800, delay = 0 } = {}) {
  if (motionLevel() !== 'full') {
    draw(1);
    return () => {};
  }
  let raf = 0;
  const start = performance.now() + delay;
  draw(0);
  const tick = (now) => {
    const k = Math.min(1, Math.max(0, (now - start) / duration));
    draw(easeOutCubic(k));
    if (k < 1) raf = requestAnimationFrame(tick);
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

function roundTopRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function axisText(ctx, text, x, y, align = 'right', baseline = 'middle') {
  ctx.font = FONT;
  ctx.fillStyle = INK.muted;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

/**
 * Line chart. series: [{ name, color, points: [[x, y]], dots, area, line = true }]
 * opts: { height, x: { min, max, format }, y: { min, max, format, zero }, tooltip(x, matches) }
 */
export function lineChart(canvas, opts) {
  const host = canvas.parentElement;
  const tip = createTip(host);
  const pad = { l: 44, r: 14, t: 12, b: 26 };
  const all = opts.series.flatMap((s) => s.points);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const xmin = opts.x?.min ?? Math.min(...xs);
  const xmax = opts.x?.max ?? Math.max(...xs);
  let ymin = opts.y?.min ?? Math.min(...ys);
  let ymax = opts.y?.max ?? Math.max(...ys);
  if (opts.y?.zero) ymin = Math.min(0, ymin);
  if (ymax === ymin) { ymax += 1; ymin -= opts.y?.zero ? 0 : 1; }
  const yTicks = niceTicks(ymin, ymax, 4);
  ymin = Math.min(ymin, yTicks[0]);
  ymax = Math.max(ymax, yTicks[yTicks.length - 1]);
  const yFmt = opts.y?.format ?? compact;
  const xFmt = opts.x?.format ?? compact;
  let progress = 0;
  let hover = null;
  let size;

  const sx = (v) => pad.l + ((v - xmin) / (xmax - xmin || 1)) * (size.w - pad.l - pad.r);
  const sy = (v) => size.h - pad.b - ((v - ymin) / (ymax - ymin || 1)) * (size.h - pad.t - pad.b);

  function draw(p) {
    progress = p;
    size = fit(canvas, opts.height ?? 200);
    const { ctx, w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (const t of yTicks) {
      const y = Math.round(sy(t)) + 0.5;
      ctx.strokeStyle = INK.grid;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      axisText(ctx, yFmt(t), pad.l - 8, y);
    }
    const xTicks = opts.x?.ticks ?? niceTicks(xmin, xmax, Math.max(2, Math.floor((w - pad.l) / 90)));
    for (const t of xTicks) if (t >= xmin && t <= xmax) axisText(ctx, xFmt(t), sx(t), h - pad.b + 8, 'center', 'top');

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l - 6, 0, (w - pad.l + 6) * p, h);
    ctx.clip();
    for (const s of opts.series) {
      if (!s.points.length) continue;
      if (s.area) {
        ctx.beginPath();
        ctx.moveTo(sx(s.points[0][0]), sy(Math.max(ymin, 0)));
        for (const [x, y] of s.points) ctx.lineTo(sx(x), sy(y));
        ctx.lineTo(sx(s.points[s.points.length - 1][0]), sy(Math.max(ymin, 0)));
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (s.line !== false && s.points.length > 1) {
        ctx.beginPath();
        s.points.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = ctx.lineCap = 'round';
        ctx.globalAlpha = s.faint ? 0.35 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (s.dots) for (const [x, y] of s.points) dot(ctx, sx(x), sy(y), s.color, s.faint ? 0.45 : 1, 3);
    }
    ctx.restore();

    if (hover && p === 1) {
      const x = Math.round(sx(hover.x)) + 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, h - pad.b);
      ctx.stroke();
      for (const m of hover.matches) dot(ctx, sx(m.point[0]), sy(m.point[1]), m.series.color, 1, 4);
    }
  }

  onHover(canvas, (mx, my) => {
    if (mx === null || progress < 1) {
      hover = null;
      tip.hide();
      if (progress === 1) draw(1);
      return;
    }
    let best = null;
    for (const s of opts.series) {
      if (s.hover === false) continue;
      for (const pt of s.points) {
        const d = Math.abs(sx(pt[0]) - mx);
        if (!best || d < best.d) best = { d, x: pt[0] };
      }
    }
    if (!best) return;
    const matches = [];
    for (const s of opts.series) {
      if (s.hover === false) continue;
      let near = null;
      for (const pt of s.points) if (!near || Math.abs(pt[0] - best.x) < Math.abs(near[0] - best.x)) near = pt;
      if (near && Math.abs(sx(near[0]) - sx(best.x)) < 24) matches.push({ series: s, point: near });
    }
    hover = { x: best.x, matches };
    draw(1);
    const content = opts.tooltip?.(best.x, matches) ?? {
      title: xFmt(best.x),
      rows: matches.map((m) => ({ color: m.series.color, value: yFmt(m.point[1]), label: m.series.name })),
    };
    tip.show(sx(best.x), my, content);
  });

  const stop = animateIn(draw, { delay: opts.delay ?? 0 });
  return { redraw: () => draw(progress), destroy: stop };
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

/** Column chart. bars: [{ label, value, tip }]; bars grow from the baseline. */
export function barChart(canvas, { bars, height = 180, color = SERIES[0], yFormat = compact, labelEvery = 1, delay = 0 }) {
  const host = canvas.parentElement;
  const tip = createTip(host);
  const pad = { l: 36, r: 8, t: 10, b: 24 };
  const max = Math.max(1, ...bars.map((b) => b.value));
  const ticks = niceTicks(0, max, 3);
  const top = Math.max(max, ticks[ticks.length - 1]);
  let progress = 0;
  let hoverIndex = -1;
  let geo = [];

  function draw(p) {
    progress = p;
    const { ctx, w, h } = fit(canvas, height);
    ctx.clearRect(0, 0, w, h);
    const plotH = h - pad.t - pad.b;
    for (const t of ticks) {
      const y = Math.round(h - pad.b - (t / top) * plotH) + 0.5;
      ctx.strokeStyle = INK.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      axisText(ctx, yFormat(t), pad.l - 8, y);
    }
    const slot = (w - pad.l - pad.r) / bars.length;
    const bw = Math.max(2, Math.min(24, slot - 2));
    geo = bars.map((b, i) => {
      const x = pad.l + i * slot + (slot - bw) / 2;
      const bh = (b.value / top) * plotH * p;
      const y = h - pad.b - bh;
      if (bh > 0) {
        roundTopRect(ctx, x, y, bw, bh, 4);
        ctx.fillStyle = i === hoverIndex ? '#5598e7' : b.color ?? color;
        ctx.fill();
      }
      if (i % labelEvery === 0) axisText(ctx, b.label, x + bw / 2, h - pad.b + 8, 'center', 'top');
      return { x: pad.l + i * slot, w: slot, cx: x + bw / 2, y };
    });
  }

  onHover(canvas, (mx, my) => {
    const i = mx === null || progress < 1 ? -1 : geo.findIndex((g) => mx >= g.x && mx < g.x + g.w);
    if (i !== hoverIndex) {
      hoverIndex = i;
      if (progress === 1) draw(1);
    }
    if (i < 0) return tip.hide();
    tip.show(geo[i].cx, Math.min(my, geo[i].y), bars[i].tip ?? { title: bars[i].label, rows: [{ value: yFormat(bars[i].value) }] });
  });

  const stop = animateIn(draw, { delay });
  return { destroy: stop };
}

/** Minimal trend line: no axes, end dot. */
export function sparkline(canvas, values, { height = 40, color = SERIES[0] } = {}) {
  if (values.length < 2) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  animateIn((p) => {
    const { ctx, w, h } = fit(canvas, height);
    ctx.clearRect(0, 0, w, h);
    const x = (i) => 4 + (i / (values.length - 1)) * (w - 8);
    const y = (v) => h - 6 - ((v - min) / (max - min || 1)) * (h - 12);
    const n = Math.max(2, Math.ceil(values.length * p));
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i ? ctx.lineTo(x(i), y(values[i])) : ctx.moveTo(x(i), y(values[i])));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.stroke();
    dot(ctx, x(n - 1), y(values[n - 1]), color, 1, 3);
  }, { duration: 900 });
}
