import { listRuns } from '../state/store.js';
import { MODES } from '../modes/index.js';
import { PRESET_NAMES } from '../modes/presets.js';
import { createSegmented, createSwitch } from '../ui/controls.js';
import { escapeHtml } from '../ui/components.js';
import { openModal } from '../ui/modal.js';
import { lineChart, SERIES } from '../stats/charts.js';
import { calendar, SEQ_LEGEND } from '../stats/plots.js';
import { filterRuns, totals, formatDuration, dayCounts, streaks, bests, RANGES, SORTS, METRICS } from '../stats/history.js';
import { exportAll, exportCsv, importData, clearAll } from '../stats/dataIO.js';

const PAGE = 25;
const modeName = (id) => MODES.find((m) => m.id === id)?.name ?? id;
const modeColor = (id) => SERIES[Math.max(0, MODES.findIndex((m) => m.id === id))];
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const fmtDate = (ts) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const tile = (label, value, sub = '') => `<div class="stat"><span class="stat__label">${label}</span><span class="stat__value">${value}</span>${sub ? `<span class="stat__sub">${sub}</span>` : ''}</div>`;

export function createStatsScreen(el, app) {
  const root = el.querySelector('[data-stats]');
  const filters = { range: 'all', mode: 'all', preset: 'all' };
  const view = { metric: 'score', rolling: true, sort: 'new', shown: PAGE };
  let all = [];

  root.innerHTML = `
    <div class="filters" role="group" aria-label="Filters">
      <div class="filter"><span class="eyebrow">Range</span><div data-f="range"></div></div>
      <div class="filter"><span class="eyebrow">Mode</span><div data-f="mode"></div></div>
      <div class="filter"><span class="eyebrow">Preset</span><div data-f="preset"></div></div>
    </div>
    <div class="stats-body" data-body></div>
    <section class="report-card report-card--wide data-card">
      <header class="report-card__head"><h3>Your data</h3><p>Everything is stored on this device only.</p></header>
      <div class="btn-row">
        <button type="button" class="btn btn--sm" data-act="export">Export all (JSON)</button>
        <button type="button" class="btn btn--sm" data-act="import">Import backup</button>
        <button type="button" class="btn btn--sm" data-act="csv">Export history (CSV)</button>
        <button type="button" class="btn btn--sm btn--danger" data-act="clear">Clear data…</button>
        <input type="file" accept="application/json,.json" hidden data-file>
      </div>
      <p class="field-msg" data-msg aria-live="polite"></p>
    </section>`;

  const body = root.querySelector('[data-body]');
  const msg = root.querySelector('[data-msg]');
  const fileInput = root.querySelector('[data-file]');
  const bind = (key, options) => {
    const c = createSegmented({ label: cap(key), value: filters[key], options, onChange: (v) => { filters[key] = v; view.shown = PAGE; render(); } });
    root.querySelector(`[data-f="${key}"]`).append(c.el);
  };
  bind('range', RANGES);
  bind('mode', [{ value: 'all', label: 'All' }, ...MODES.map((m) => ({ value: m.id, label: m.name }))]);
  bind('preset', [{ value: 'all', label: 'All' }, ...PRESET_NAMES]);

  function say(text, tone = 'ok') {
    msg.textContent = text;
    msg.dataset.tone = tone;
  }

  function progressCard(runs) {
    const metric = METRICS[view.metric];
    let modes = [...new Set(runs.map((r) => r.mode))];
    let note = '';
    if (view.metric === 'score' && modes.length > 1) {
      // Scores use different scales per mode, so chart one mode at a time.
      const fav = totals(runs).favorite.mode;
      modes = [fav];
      note = `Scores aren't comparable across modes. Showing ${modeName(fav)}; pick a mode above to switch.`;
    }
    const series = modes.map((m) => {
      const pts = runs.filter((r) => r.mode === m && metric.get(r) !== null).map((r) => [r.timestamp, metric.get(r)]).sort((a, b) => a[0] - b[0]);
      return { mode: m, pts };
    }).filter((s) => s.pts.length);
    return { series, note };
  }

  function drawProgress(canvas, { series }) {
    const metric = METRICS[view.metric];
    const chartSeries = [];
    for (const s of series) {
      const color = modeColor(s.mode);
      if (view.rolling && s.pts.length > 2) {
        chartSeries.push({ name: modeName(s.mode), color, points: s.pts, dots: true, line: false, faint: true, hover: true, raw: true });
        const avg = s.pts.map((p, i) => {
          const w = s.pts.slice(Math.max(0, i - 4), i + 1);
          return [p[0], w.reduce((a, q) => a + q[1], 0) / w.length];
        });
        chartSeries.push({ name: `${modeName(s.mode)} (5-run average)`, color, points: avg, hover: false });
      } else {
        chartSeries.push({ name: modeName(s.mode), color, points: s.pts, dots: true });
      }
    }
    const xs = series.flatMap((s) => s.pts.map((p) => p[0]));
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    const ticks = max > min ? [0, 0.25, 0.5, 0.75, 1].map((k) => min + (max - min) * k) : [min];
    lineChart(canvas, {
      height: 240,
      series: chartSeries,
      x: { min: max > min ? min : min - 1, max: max > min ? max : max + 1, ticks, format: (v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) },
      y: { zero: view.metric === 'score', format: view.metric === 'accuracy' ? (v) => `${Math.round(v)}%` : (v) => (Math.abs(v) >= 1000 ? `${+(v / 1000).toFixed(1)}K` : `${Math.round(v)}`) },
      tooltip: (x, matches) => ({
        title: new Date(x).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
        rows: matches.map((m) => ({ color: m.series.color, value: metric.format(m.point[1]), label: m.series.name })),
      }),
    });
  }

  function render() {
    const runs = filterRuns(all, filters);
    if (!all.length) {
      body.innerHTML = '<div class="card empty">No runs yet. Finish a run and your statistics will appear here.</div>';
      return;
    }
    if (!runs.length) {
      body.innerHTML = '<div class="card empty">No runs match these filters.</div>';
      return;
    }
    const t = totals(runs);
    const st = streaks(all);
    const progress = progressCard(runs);
    const sorted = [...runs].sort(SORTS.find((s) => s.value === view.sort).fn);
    const pbs = bests(runs);

    body.innerHTML = `
      <div class="totals">
        ${tile('Play time', formatDuration(t.playMs))}
        ${tile('Runs', t.runs.toLocaleString())}
        ${tile('Total shots', t.shots.toLocaleString())}
        ${tile('Total hits', t.hits.toLocaleString())}
        ${tile('Lifetime accuracy', t.accuracy === null ? '—' : `${(t.accuracy * 100).toFixed(1)}%`, 'Click modes')}
        ${tile('Favorite mode', t.favorite ? modeName(t.favorite.mode) : '—', t.favorite ? `${t.favorite.runs} runs` : '')}
        ${tile('Current streak', `${st.current} ${st.current === 1 ? 'day' : 'days'}`, 'Any mode')}
        ${tile('Best streak', `${st.best} ${st.best === 1 ? 'day' : 'days'}`)}
      </div>
      <section class="report-card report-card--wide">
        <header class="report-card__head report-card__head--row">
          <div><h3>Progress</h3><p data-note>${escapeHtml(progress.note)}</p></div>
          <div class="report-card__tools"><div data-v="metric"></div><label class="inline-switch"><span>Rolling average</span><span data-v="rolling"></span></label></div>
        </header>
        <div class="chart"><canvas data-chart="progress" role="img" aria-label="${METRICS[view.metric].label} over time"></canvas></div>
        ${progress.series.length > 1 ? `<div class="legend">${progress.series.map((s) => `<span><i class="legend__line" style="background:${modeColor(s.mode)}"></i>${modeName(s.mode)}</span>`).join('')}</div>` : ''}
      </section>
      <section class="report-card report-card--wide">
        <header class="report-card__head"><h3>Activity</h3><p>Runs per day. The most recent week is on the right.</p></header>
        <div class="chart"><canvas data-chart="calendar" role="img" aria-label="Runs per day calendar"></canvas></div>
        <div class="legend legend--end"><span>Less</span>${SEQ_LEGEND.map((c) => `<i class="legend__cell" style="background:${c}"></i>`).join('')}<span>More</span></div>
      </section>
      <section class="report-card report-card--wide">
        <header class="report-card__head"><h3>Personal bests</h3><p>Per mode and difficulty preset.</p></header>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Mode</th><th>Preset</th><th class="is-num">Runs</th><th class="is-num">Best score</th><th class="is-num">Best accuracy</th><th class="is-num">Best reaction</th></tr></thead>
          <tbody>${pbs.map((b) => `<tr><td>${modeName(b.mode)}</td><td>${cap(b.preset)}</td><td class="is-num">${b.runs}</td><td class="is-num">${b.mode === 'tracking' ? `${b.score.toFixed(1)}%` : Math.round(b.score).toLocaleString()}</td><td class="is-num">${b.accuracy === null ? '—' : `${(b.accuracy * 100).toFixed(1)}%`}</td><td class="is-num">${b.bestRT === null ? '—' : `${Math.round(b.bestRT)} ms`}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>
      <section class="report-card report-card--wide">
        <header class="report-card__head report-card__head--row"><div><h3>Run history</h3><p>${runs.length} ${runs.length === 1 ? 'run' : 'runs'}. Select one for its full report.</p></div><div class="report-card__tools" data-v="sort"></div></header>
        <ul class="run-list">
          ${sorted.slice(0, view.shown).map((r) => `
            <li><button type="button" class="run-item" data-id="${escapeHtml(r.id)}">
              <span class="run-item__mode"><i style="background:${modeColor(r.mode)}"></i>${modeName(r.mode)}<span class="run-item__dim">${cap(r.summary.preset)}</span></span>
              <span class="run-item__dim">${fmtDate(r.timestamp)}</span>
              <span class="is-num">${r.mode === 'tracking' ? `${r.summary.score.toFixed(1)}%` : Math.round(r.summary.score).toLocaleString()}</span>
              <span class="is-num">${r.mode === 'tracking' ? '' : `${(r.summary.accuracy * 100).toFixed(1)}%`}</span>
              <span class="is-num run-item__dim">${r.summary.avgRT === null ? '' : `${Math.round(r.summary.avgRT)} ms`}</span>
            </button></li>`).join('')}
        </ul>
        ${sorted.length > view.shown ? `<button type="button" class="btn btn--sm btn--ghost show-more" data-act="more">Show ${Math.min(PAGE, sorted.length - view.shown)} more</button>` : ''}
      </section>`;

    const metricCtl = createSegmented({ label: 'Metric', value: view.metric, options: Object.entries(METRICS).map(([value, m]) => ({ value, label: m.label })), onChange: (v) => { view.metric = v; render(); } });
    body.querySelector('[data-v="metric"]').append(metricCtl.el);
    const rollingCtl = createSwitch({ label: 'Rolling average', value: view.rolling, onChange: (v) => { view.rolling = v; render(); } });
    body.querySelector('[data-v="rolling"]').append(rollingCtl.el);
    const sortCtl = createSegmented({ label: 'Sort', value: view.sort, options: SORTS, onChange: (v) => { view.sort = v; render(); } });
    body.querySelector('[data-v="sort"]').append(sortCtl.el);

    requestAnimationFrame(() => {
      const pc = body.querySelector('[data-chart="progress"]');
      if (progress.series.length) drawProgress(pc, progress);
      calendar(body.querySelector('[data-chart="calendar"]'), { counts: dayCounts(runs) });
    });
  }

  body.addEventListener('click', (e) => {
    const item = e.target.closest('.run-item');
    if (item) {
      const run = all.find((r) => r.id === item.dataset.id);
      if (run) app.go('results', { run, expand: true, from: 'stats' });
    } else if (e.target.closest('[data-act="more"]')) {
      view.shown += PAGE;
      render();
    }
  });

  function confirmClear() {
    const content = document.createElement('div');
    content.innerHTML = `
      <h2 class="dialog__title">Clear data?</h2>
      <p class="dialog__sub">This can't be undone. Export a backup first if you want to keep anything.</p>
      <div class="dialog__actions">
        <button type="button" class="btn btn--danger btn--block" data-c="runs">Delete run history</button>
        <button type="button" class="btn btn--block" data-c="all">Delete everything (history, settings, shapes)</button>
        <button type="button" class="btn btn--ghost btn--block" data-c="cancel" autofocus>Cancel</button>
      </div>`;
    const modal = openModal(content, { label: 'Clear data' });
    content.addEventListener('click', async (e) => {
      const c = e.target.closest('[data-c]')?.dataset.c;
      if (!c) return;
      modal.close();
      if (c === 'cancel') return;
      await clearAll({ everything: c === 'all' });
      all = await listRuns();
      render();
      say(c === 'all' ? 'All data deleted.' : 'Run history deleted.');
    });
  }

  root.querySelector('.data-card').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'export') {
      await exportAll();
      say(`Exported ${all.length} runs with your settings and shapes.`);
    } else if (act === 'import') {
      fileInput.click();
    } else if (act === 'csv') {
      exportCsv(filterRuns(all, filters));
      say('History exported as CSV.');
    } else if (act === 'clear') {
      confirmClear();
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const n = await importData(JSON.parse(await file.text()));
      all = await listRuns();
      render();
      say(`Imported ${n} runs. Settings and shapes restored.`);
    } catch (err) {
      say(err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message, 'error');
    }
  });

  return {
    el,
    async enter() {
      all = await listRuns();
      render();
    },
  };
}
