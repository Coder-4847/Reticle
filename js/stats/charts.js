import { fit, animateIn, niceTicks, compact, createTip, onHover, roundTopRect, axisText, dot, SERIES, INK } from './chartCore.js';

export * from './chartCore.js';

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

  const stop = animateIn(draw, { delay: opts.delay ?? 0, canvas });
  return { redraw: () => draw(progress), destroy: stop };
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

  const stop = animateIn(draw, { delay, canvas });
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
  }, { duration: 900, canvas });
}
