import { listRuns } from '../state/store.js';
import { summarize } from '../stats/analyze.js';
import { MODES } from '../modes/index.js';
import { escapeHtml } from '../ui/components.js';

const fmtDate = (ts) =>
  new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function createStatsScreen(el, app) {
  const root = el.querySelector('[data-stats]');

  async function render() {
    const runs = await listRuns();
    if (!runs.length) {
      root.innerHTML = '<div class="card empty">No runs yet. Finish a run and it will show up here.</div>';
      return;
    }
    const rows = runs.map((r) => ({ run: r, sum: summarize(r) }));
    const totalShots = rows.reduce((a, x) => a + x.sum.shots, 0);
    const totalHits = rows.reduce((a, x) => a + x.sum.hits, 0);
    const best = Math.max(...rows.map((x) => x.sum.score));
    const stat = (label, value) =>
      `<div class="stat"><span class="stat__label">${label}</span><span class="stat__value">${value}</span></div>`;
    root.innerHTML = `
      <div class="totals">
        ${stat('Runs', runs.length)}
        ${stat('Best score', best.toLocaleString())}
        ${stat('Total hits', totalHits.toLocaleString())}
        ${stat('Lifetime accuracy', totalShots ? `${((totalHits / totalShots) * 100).toFixed(1)}%` : '—')}
      </div>
      <h2 class="section-title">Recent runs</h2>
      <ul class="card run-list">
        ${rows.slice(0, 20).map(({ run, sum }, i) => `
          <li><button type="button" class="run-item" data-index="${i}">
            <span>${escapeHtml(MODES.find((m) => m.id === run.mode)?.name ?? run.mode)} <span class="run-item__dim">· ${Math.round(run.duration / 1000)}s</span></span>
            <span class="run-item__dim">${fmtDate(run.timestamp)}</span>
            <span>${sum.score.toLocaleString()}</span>
            <span>${(sum.accuracy * 100).toFixed(1)}%</span>
          </button></li>`).join('')}
      </ul>`;
    root.querySelector('.run-list').onclick = (e) => {
      const item = e.target.closest('[data-index]');
      if (item) app.go('results', { run: runs[Number(item.dataset.index)] });
    };
  }

  return { el, enter: render };
}
