import { analyzeRun, direction } from './analyze.js';
import { insights } from './insights.js';
import { lineChart, barChart, SERIES } from './charts.js';
import { heatmap, precisionPlot, regionGrid } from './plots.js';
import { exportRun } from './dataIO.js';
import { MODES } from '../modes/index.js';
import { getShape } from '../targets/shapes.js';
import { escapeHtml } from '../ui/components.js';

const ms = (v) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString());
const pct1 = (v) => (v === null || v === undefined ? '—' : (v * 100).toFixed(1));
const num = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

function tile(label, value, unit = '', sub = '') {
  const u = unit && value !== '—' ? `<span class="stat__unit">${unit}</span>` : '';
  return `<div class="stat"><span class="stat__label">${label}</span><span class="stat__value">${value}${u}</span>${sub ? `<span class="stat__sub">${sub}</span>` : ''}</div>`;
}

const card = (title, body, { wide = false, sub = '' } = {}) =>
  `<section class="report-card${wide ? ' report-card--wide' : ''}"><header class="report-card__head"><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</header>${body}</section>`;

const chart = (id, label) => `<div class="chart"><canvas data-chart="${id}" role="img" aria-label="${label}"></canvas></div>`;

function changeText(first, second) {
  if (!first || !second) return '';
  const c = (second - first) / first;
  if (Math.abs(c) < 0.02) return 'about the same';
  return `${Math.abs(c * 100).toFixed(0)}% ${c > 0 ? 'slower' : 'faster'}`;
}

function rolling(points, k = 5) {
  return points.map((p, i) => {
    const win = points.slice(Math.max(0, i - k + 1), i + 1);
    return [p[0], win.reduce((s, q) => s + q[1], 0) / win.length];
  });
}

function settingsCard(run) {
  const s = run.settings;
  if (!s) return '';
  const m = s.modes?.[run.mode] ?? {};
  const rows = [
    ['Preset', m.preset],
    ['Duration', run.duration ? `${run.duration / 1000}s` : `${m.trials} trials`],
    ['Target size', m.size !== undefined ? `${m.size}px` : null],
    ['Lifetime', m.lifetime !== undefined ? (m.lifetime ? `${m.lifetime}ms` : 'Never') : null],
    ['Simultaneous', m.count],
    ['Speed', m.speed !== undefined ? `${m.speed}px/s` : null],
    ['Area', m.area === 'box' ? 'Centered box' : m.area ? 'Full screen' : null],
    ['Shape', s.targets ? getShape(s.targets.shape).name : null],
    ['Size variation', s.targets ? `${Math.round(s.targets.sizeVariation * 100)}%` : null],
    ['Sensitivity', s.pointer ? `${s.pointer.sensitivity}×${s.pointer.lock ? ' · raw input' : ''}` : null],
    ['Crosshair', s.crosshair?.style],
    ['Screen', run.area ? `${run.area.w}×${run.area.h}` : null],
  ].filter(([, v]) => v !== null && v !== undefined);
  return card('Run settings', `<dl class="kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(String(v))}</dd></div>`).join('')}</dl>`, { wide: true, sub: 'Compare runs with matching settings.' });
}

/** Render the detailed report for `run` into `root`. Charts animate in, staggered. */
export function renderReport(root, run) {
  const a = analyzeRun(run);
  const s = a.sum;
  const modeName = MODES.find((m) => m.id === run.mode)?.name ?? run.mode;
  const parts = [];
  const charts = [];
  const isTracking = run.mode === 'tracking';
  const isReaction = run.mode === 'reaction';

  if (run.compact) {
    parts.push(card('Summary only', `<p class="report-note">Detailed data for older runs is condensed to save space. Totals are kept.</p><div class="tile-grid">${tile('Score', num(s.score, isTracking ? 1 : 0))}${tile('Accuracy', pct1(s.accuracy), '%')}${tile('Avg reaction', ms(s.avgRT), 'ms')}${tile('Hits', num(s.hits))}</div>`, { wide: true }));
  } else if (isTracking) {
    const t = a.track;
    parts.push(card('Overview', `<div class="tile-grid">${tile('On target', pct1(s.accuracy), '%')}${tile('Time on target', num(s.onMs / 1000, 1), 's')}${tile('Avg error', ms(t?.err?.mean), 'px')}${tile('Median error', ms(t?.err?.median), 'px')}${tile('First half', pct1(t?.onFirst), '%')}${tile('Second half', pct1(t?.onSecond), '%')}</div>`, { wide: true }));
    if (t?.errSeries.length > 1) {
      parts.push(card('Distance from target over the run', chart('trackErr', 'Tracking error over time'), { wide: true, sub: 'Pixels between the crosshair and the target center. Lower is better.' }));
      charts.push(['trackErr', (el, delay) => lineChart(el, {
        delay, height: 220,
        series: [{ name: 'Error', color: SERIES[0], points: t.errSeries.map(([x, y]) => [x / 1000, y]), area: true }],
        x: { format: (v) => `${v}s` }, y: { zero: true, format: (v) => `${Math.round(v)}` },
        tooltip: (x, m) => ({ title: `${x.toFixed(1)}s`, rows: m.map((q) => ({ color: q.series.color, value: `${q.point[1]} px`, label: 'from center' })) }),
      })]);
    }
  } else {
    const overview = isReaction
      ? `${tile('Average', ms(s.avgRT), 'ms')}${tile('Median', ms(a.rt?.median), 'ms')}${tile('Best', ms(s.bestRT), 'ms')}${tile('Worst', ms(s.worstRT), 'ms')}${tile('Consistency', a.rt ? `±${ms(a.rt.sd)}` : '—', 'ms')}${tile('False starts', num(s.misses))}`
      : `${tile('Score', num(s.score))}${tile('Accuracy', pct1(s.accuracy), '%')}${tile('Hits', num(s.hits))}${tile('Misses', num(s.misses))}${tile('Expired', num(s.expired))}${tile('Shots / sec', num(a.shotsPerSec, 2))}${tile('Targets / sec', num(a.targetsPerSec, 2))}`;
    parts.push(card('Overview', `<div class="tile-grid">${overview}</div>`, { wide: true }));

    if (isReaction && a.trials?.length) {
      parts.push(card('Trials', `${chart('trials', 'Reaction time per trial')}
        <table class="table"><thead><tr><th>Trial</th><th>Reaction</th><th>False starts before</th></tr></thead>
        <tbody>${a.trials.map((t) => `<tr><td>${t.n}</td><td>${ms(t.rt)} ms</td><td>${t.early}</td></tr>`).join('')}</tbody></table>`, { wide: true }));
      charts.push(['trials', (el, delay) => barChart(el, {
        delay, height: 180, yFormat: (v) => `${Math.round(v)}`,
        bars: a.trials.map((t) => ({ label: `#${t.n}`, value: t.rt, tip: { title: `Trial ${t.n}`, rows: [{ value: `${ms(t.rt)} ms` }, { value: String(t.early), label: 'false starts before' }] } })),
      })]);
    }

    if (!isReaction && a.rt) {
      parts.push(card('Reaction time', `<div class="tile-grid tile-grid--compact">${tile('Average', ms(a.rt.mean), 'ms')}${tile('Median', ms(a.rt.median), 'ms')}${tile('Best', ms(a.rt.min), 'ms')}${tile('Worst', ms(a.rt.max), 'ms')}${tile('Std dev', ms(a.rt.sd), 'ms')}</div>${chart('rtHist', 'Distribution of reaction times')}`, { sub: 'How long each hit took, from target spawn.' }));
      const bins = a.rtHist.bins;
      charts.push(['rtHist', (el, delay) => barChart(el, {
        delay, height: 170, labelEvery: Math.ceil(bins.length / 6),
        bars: bins.map((b) => ({ label: `${b.from}`, value: b.n, tip: { title: `${b.from}–${b.to} ms`, rows: [{ value: String(b.n), label: b.n === 1 ? 'hit' : 'hits' }] } })),
      })]);
    }

    if (!isReaction && a.rtSeries?.length > 2) {
      const pts = a.rtSeries.map(([x, y]) => [x / 1000, y]);
      parts.push(card('Over the run', `${chart('rtLine', 'Reaction time over the run')}<div class="tile-grid tile-grid--compact">${tile('First half', ms(a.halves.first), 'ms')}${tile('Second half', ms(a.halves.second), 'ms', changeText(a.halves.first, a.halves.second))}</div>`, { sub: 'Each hit (dots) and the 5-hit rolling average (line). Shows warm-up and fatigue.' }));
      charts.push(['rtLine', (el, delay) => lineChart(el, {
        delay, height: 200,
        series: [
          { name: 'Hit', color: SERIES[0], points: pts, dots: true, line: false, faint: true },
          { name: 'Rolling average', color: SERIES[0], points: rolling(pts) },
        ],
        x: { min: 0, format: (v) => `${Math.round(v)}s` }, y: { zero: true, format: (v) => `${Math.round(v)}` },
        tooltip: (x, m) => ({ title: `${x.toFixed(1)}s into the run`, rows: m.map((q) => ({ color: q.series.color, value: `${Math.round(q.point[1])} ms`, label: q.series.name.toLowerCase() })) }),
      })]);
    }

    if (!isReaction && (a.hitPoints.length || a.missPoints.length)) {
      parts.push(card('Hit map', `${chart('heat', 'Hit density and miss positions across the screen')}<div class="legend"><span><i class="legend__ramp"></i>Hit density</span><span><i class="legend__x"></i>Miss</span></div>`, { sub: 'Where you clicked, over the whole play area.' }));
      charts.push(['heat', (el, delay) => heatmap(el, { delay, hits: a.hitPoints, misses: a.missPoints, aspect: a.area.w / a.area.h })]);
    }

    if (!isReaction && a.offsets.length) {
      const [mx, my] = a.offsetMean;
      const bias = Math.hypot(mx, my) < 0.08 ? 'centered' : direction(mx, my);
      parts.push(card('Precision', `<div class="precision">${chart('prec', 'Hit positions relative to target center')}<div class="tile-grid tile-grid--stack">${tile('Avg distance from center', num(a.normDist, 2), '× radius')}${tile('Average bias', bias, '', `${Math.abs(mx).toFixed(2)}r ${mx >= 0 ? 'right' : 'left'}, ${Math.abs(my).toFixed(2)}r ${my >= 0 ? 'low' : 'high'}`)}</div></div><div class="legend"><span><i class="legend__dot"></i>Hit</span><span><i class="legend__x"></i>Average</span></div>`, { sub: 'Where on the target each hit landed, scaled to the target size.' }));
      charts.push(['prec', (el, delay) => precisionPlot(el, { delay, offsets: a.offsets, mean: a.offsetMean })]);
    }

    if (!isReaction) {
      const { over, under, lateral } = a.flick;
      const fl = over + under + lateral;
      const dirs = Object.entries(a.missDirs).sort((x, y) => y[1] - x[1]).slice(0, 3);
      const bar = (label, n) => `<div class="meter"><span class="meter__label">${label}</span><span class="meter__track"><span class="meter__fill" style="--k:${fl ? n / fl : 0}"></span></span><span class="meter__value">${n}</span></div>`;
      parts.push(card('Misses', `<div class="tile-grid tile-grid--compact">${tile('Missed clicks', num(s.misses))}${tile('Expired targets', num(s.expired))}${tile('Most common side', dirs.length ? dirs[0][0] : '—')}</div>
        ${fl ? `<div class="meters">${bar('Overshoot', over)}${bar('Undershoot', under)}${bar('Off to the side', lateral)}</div>` : '<p class="report-note">Not enough misses to tell whether you overshoot or undershoot.</p>'}`,
      { sub: 'Misses are measured against the target you were most likely aiming for.' }));
    }

    if (!isReaction && a.regions.some((r) => r.total)) {
      parts.push(card('Accuracy by screen region', chart('regions', 'Share of targets hit in each third of the screen'), { sub: 'Share of targets hit, by where they appeared.' }));
      charts.push(['regions', (el, delay) => regionGrid(el, { delay, cells: a.regions, aspect: a.area.w / a.area.h })]);
    }
  }

  const tips = run.compact ? [] : insights(a);
  if (tips.length) parts.push(card('Insights', `<ul class="insights">${tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`, { wide: true }));
  parts.push(settingsCard(run));

  root.innerHTML = `<div class="report" aria-label="${escapeHtml(modeName)} detailed report">${parts.join('')}
    <div class="report__foot"><button type="button" class="btn btn--sm" data-act="export-run">Export this run (JSON)</button></div></div>`;
  root.querySelector('[data-act="export-run"]').onclick = () => exportRun(run);
  [...root.querySelectorAll('.report-card')].forEach((el, i) => el.style.setProperty('--i', i));
  requestAnimationFrame(() => {
    charts.forEach(([id, make], i) => {
      const el = root.querySelector(`[data-chart="${id}"]`);
      if (el) make(el, 120 + i * 90);
    });
  });
}
