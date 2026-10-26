import { fit, animateIn, createTip, onHover, dot, SERIES, SEQ, INK, FONT } from './charts.js';

const rampColor = (k) => SEQ[Math.min(SEQ.length - 1, Math.max(0, Math.round(k * (SEQ.length - 1))))];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const SEQ_RGB = SEQ.map(rgb);
const inkOn = (hex) => {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0b0c0f' : '#ffffff';
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

function cross(ctx, x, y, s, color) {
  ctx.lineCap = 'round';
  for (const [c, lw] of [[INK.surface, 5], [color, 2]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s);
    ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y - s);
    ctx.lineTo(x - s, y + s);
    ctx.stroke();
  }
}

/** Hit density (sequential blue) over the play area, with miss markers (orange x). Points are 0..1. */
export function heatmap(canvas, { hits, misses, aspect, delay = 0 }) {
  const tip = createTip(canvas.parentElement);
  const gw = 120;
  const gh = Math.max(40, Math.round(gw / aspect));
  const density = new Float32Array(gw * gh);
  const rad = 6;
  for (const [x, y] of hits) {
    const cx = x * gw;
    const cy = y * gh;
    for (let j = Math.max(0, Math.floor(cy - rad * 2)); j < Math.min(gh, cy + rad * 2); j++) {
      for (let i = Math.max(0, Math.floor(cx - rad * 2)); i < Math.min(gw, cx + rad * 2); i++) {
        density[j * gw + i] += Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (2 * rad * rad));
      }
    }
  }
  const peak = Math.max(1e-6, ...density);
  const layer = document.createElement('canvas');
  layer.width = gw;
  layer.height = gh;
  const lctx = layer.getContext('2d');
  const img = lctx.createImageData(gw, gh);
  for (let i = 0; i < density.length; i++) {
    const k = density[i] / peak;
    if (k < 0.04) continue;
    const [r, g, b] = SEQ_RGB[Math.min(SEQ.length - 1, Math.floor(k * SEQ.length))];
    img.data.set([r, g, b, Math.round(Math.min(1, 0.25 + k) * 255)], i * 4);
  }
  lctx.putImageData(img, 0, 0);

  let box = null;
  const draw = (p) => {
    const width = canvas.clientWidth || 400;
    const { ctx, w, h } = fit(canvas, Math.round(width / aspect));
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fill();
    ctx.strokeStyle = INK.grid;
    ctx.stroke();
    ctx.globalAlpha = p;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer, 0, 0, w, h);
    ctx.globalAlpha = 1;
    const shown = Math.ceil(misses.length * p);
    for (let i = 0; i < shown; i++) cross(ctx, misses[i][0] * w, misses[i][1] * h, 4, SERIES[1]);
    box = { w, h };
  };

  onHover(canvas, (mx, my) => {
    if (mx === null || !box) return tip.hide();
    const r = 0.06;
    const near = (pts) => pts.filter(([x, y]) => Math.hypot(x - mx / box.w, (y - my / box.h) / aspect) < r).length;
    const nh = near(hits);
    const nm = near(misses);
    if (!nh && !nm) return tip.hide();
    tip.show(mx, my, { title: 'Near this spot', rows: [{ color: SERIES[0], value: String(nh), label: nh === 1 ? 'hit' : 'hits' }, { color: SERIES[1], value: String(nm), label: nm === 1 ? 'miss' : 'misses' }] });
  });
  animateIn(draw, { delay, duration: 900, canvas });
}

/** Where on the target hits land. offsets in target radii; mean marked with a cross. */
export function precisionPlot(canvas, { offsets, mean, delay = 0 }) {
  const tip = createTip(canvas.parentElement);
  let geo = null;
  const draw = (p) => {
    const size = Math.min(canvas.clientWidth || 260, 280);
    const { ctx, w, h } = fit(canvas, size);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.36;
    geo = { cx, cy, R };
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = INK.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 6); ctx.lineTo(cx, h - 6);
    ctx.moveTo(6, cy); ctx.lineTo(w - 6, cy);
    ctx.stroke();
    for (const k of [0.5, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
      ctx.strokeStyle = k === 1 ? 'rgba(255,255,255,0.22)' : INK.grid;
      ctx.stroke();
    }
    ctx.font = FONT;
    ctx.fillStyle = INK.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('target edge', cx, cy - R - 4);
    const n = Math.ceil(offsets.length * p);
    for (let i = 0; i < n; i++) {
      const [ox, oy] = offsets[i];
      dot(ctx, cx + Math.max(-1.25, Math.min(1.25, ox)) * R, cy + Math.max(-1.25, Math.min(1.25, oy)) * R, SERIES[0], 0.8, 3);
    }
    if (mean && p === 1) cross(ctx, cx + mean[0] * R, cy + mean[1] * R, 6, SERIES[1]);
  };
  onHover(canvas, (mx, my) => {
    if (mx === null || !geo) return tip.hide();
    const ox = (mx - geo.cx) / geo.R;
    const oy = (my - geo.cy) / geo.R;
    let best = null;
    for (const o of offsets) {
      const d = Math.hypot(o[0] - ox, o[1] - oy);
      if (!best || d < best.d) best = { d, o };
    }
    if (!best || best.d * geo.R > 14) return tip.hide();
    const [x, y] = best.o;
    tip.show(mx, my, {
      title: 'Hit position',
      rows: [{ value: `${Math.abs(x).toFixed(2)}r`, label: x >= 0 ? 'right' : 'left' }, { value: `${Math.abs(y).toFixed(2)}r`, label: y >= 0 ? 'low' : 'high' }],
    });
  });
  animateIn(draw, { delay, duration: 900, canvas });
}

const REGION_NAMES = ['Top left', 'Top', 'Top right', 'Left', 'Center', 'Right', 'Bottom left', 'Bottom', 'Bottom right'];

/** 3x3 accuracy grid. cells: [{ hits, total }] row-major. */
export function regionGrid(canvas, { cells, aspect, delay = 0 }) {
  const tip = createTip(canvas.parentElement);
  let geo = null;
  const draw = (p) => {
    const width = canvas.clientWidth || 300;
    const { ctx, w, h } = fit(canvas, Math.round(Math.min(width / aspect, 260)));
    ctx.clearRect(0, 0, w, h);
    const gap = 2;
    const cw = (w - gap * 2) / 3;
    const ch = (h - gap * 2) / 3;
    geo = { cw, ch, gap };
    cells.forEach((c, i) => {
      const x = (i % 3) * (cw + gap);
      const y = Math.floor(i / 3) * (ch + gap);
      const acc = c.total ? c.hits / c.total : null;
      const fill = acc === null ? 'rgba(255,255,255,0.04)' : rampColor(acc);
      ctx.globalAlpha = Math.min(1, p * 1.5 - (i % 3) * 0.1 - Math.floor(i / 3) * 0.1);
      roundRect(ctx, x, y, cw, ch, 6);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.globalAlpha = Math.max(0, p * 2 - 1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = acc === null ? INK.muted : inkOn(fill);
      ctx.font = `600 15px ${FONT.split(' ').slice(1).join(' ')}`;
      ctx.fillText(acc === null ? '—' : `${Math.round(acc * 100)}%`, x + cw / 2, y + ch / 2 - (acc === null ? 0 : 7));
      if (acc !== null) {
        ctx.font = FONT;
        ctx.globalAlpha *= 0.8;
        ctx.fillText(`${c.hits}/${c.total}`, x + cw / 2, y + ch / 2 + 11);
      }
      ctx.globalAlpha = 1;
    });
  };
  onHover(canvas, (mx, my) => {
    if (mx === null || !geo) return tip.hide();
    const col = Math.min(2, Math.floor(mx / (geo.cw + geo.gap)));
    const row = Math.min(2, Math.floor(my / (geo.ch + geo.gap)));
    const c = cells[row * 3 + col];
    tip.show(mx, my, { title: REGION_NAMES[row * 3 + col], rows: c.total ? [{ value: `${Math.round((c.hits / c.total) * 100)}%`, label: `${c.hits} of ${c.total} targets hit` }] : [{ value: 'No targets' }] });
  });
  animateIn(draw, { delay, duration: 700, canvas });
}

const DAY = 86400000;
export const SEQ_LEGEND = ['rgba(255,255,255,0.05)', SEQ[2], SEQ[4], SEQ[6], SEQ[8]];
export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** Activity calendar: one cell per day, weeks as columns (Monday first), sized to fill the width. */
export function calendar(canvas, { counts }) {
  const tip = createTip(canvas.parentElement);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const level = (n) => SEQ_LEGEND[n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4];
  const labelW = 30;
  const gap = 3;
  let geo = null;
  const dateAt = (wk, d) => new Date(geo.start + (wk * 7 + d) * DAY + DAY / 2);
  const draw = (p) => {
    const width = canvas.clientWidth || 600;
    const weeks = Math.max(8, Math.min(53, Math.floor((width - labelW) / 15)));
    const cell = Math.max(6, Math.min(16, Math.floor((width - labelW) / weeks) - gap));
    const height = 18 + 7 * (cell + gap);
    const { ctx } = fit(canvas, height);
    ctx.clearRect(0, 0, width, height);
    geo = { cell, weeks, start: today.getTime() - ((weeks - 1) * 7 + dow) * DAY };
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = INK.muted;
    ['Mon', '', 'Wed', '', 'Fri', '', ''].forEach((l, r) => l && ctx.fillText(l, 0, 18 + r * (cell + gap) + cell / 2));
    let lastMonth = -1;
    let lastLabelX = -Infinity;
    for (let wk = 0; wk < weeks; wk++) {
      for (let d = 0; d < 7; d++) {
        const date = dateAt(wk, d);
        if (date > Date.now() + DAY) continue;
        const x = labelW + wk * (cell + gap);
        if (d === 0 && date.getMonth() !== lastMonth) {
          lastMonth = date.getMonth();
          if (x - lastLabelX >= 32) {
            lastLabelX = x;
            ctx.globalAlpha = 1;
            ctx.fillStyle = INK.muted;
            ctx.fillText(date.toLocaleString(undefined, { month: 'short' }), x, 7);
          }
        }
        ctx.globalAlpha = Math.min(1, Math.max(0, p * 2 - wk / weeks));
        roundRect(ctx, x, 18 + d * (cell + gap), cell, cell, 2);
        ctx.fillStyle = level(counts.get(dayKey(date)) ?? 0);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };
  onHover(canvas, (mx, my) => {
    if (mx === null || !geo) return tip.hide();
    const wk = Math.floor((mx - labelW) / (geo.cell + gap));
    const d = Math.floor((my - 18) / (geo.cell + gap));
    if (wk < 0 || wk >= geo.weeks || d < 0 || d > 6) return tip.hide();
    const date = dateAt(wk, d);
    if (date > Date.now() + DAY) return tip.hide();
    const n = counts.get(dayKey(date)) ?? 0;
    tip.show(mx, my, { title: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), rows: [{ value: String(n), label: n === 1 ? 'run' : 'runs' }] });
  });
  animateIn(draw, { duration: 700, canvas });
}
