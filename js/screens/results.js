import { summarize, resultRows } from '../stats/analyze.js';
import { countUp } from '../ui/components.js';
import { MODES } from '../modes/index.js';
import { listRuns } from '../state/store.js';

export function createResultsScreen(el, app) {
  const f = {};
  for (const node of el.querySelectorAll('[data-r]')) f[node.dataset.r] = node;
  let run = null;

  el.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'retry') app.go('play', { mode: run?.mode });
    else if (action === 'home') app.go('home');
  });

  function show(r) {
    run = r;
    const sum = summarize(r);
    const modeName = MODES.find((m) => m.id === r.mode)?.name ?? r.mode;
    const length = r.duration ? `${Math.round(r.duration / 1000)}s` : `${r.targets.length} trials`;
    f.meta.textContent = `${modeName} · ${length}`;
    f.scoreLabel.textContent = r.mode === 'tracking' ? 'Score (% on target)' : 'Score';
    countUp(f.score, sum.score, { duration: 1100, decimals: r.mode === 'tracking' ? 1 : 0 });
    const rows = resultRows(r, sum);
    f.grid.innerHTML = rows
      .map((row) => `<div class="stat"><span class="stat__label">${row.label}</span><span class="stat__value"><span data-v></span>${row.unit && Number.isFinite(row.value) ? `<span class="stat__unit">${row.unit}</span>` : ''}</span></div>`)
      .join('');
    f.grid.querySelectorAll('[data-v]').forEach((node, i) => countUp(node, rows[i].value, { decimals: rows[i].decimals ?? 0, delay: 80 + i * 40 }));
  }

  return {
    el,
    focusTarget: el.querySelector('[data-action="retry"]'),
    async enter({ run: r } = {}) {
      if (r) return show(r);
      const [latest] = await listRuns();
      if (latest) show(latest);
      else app.go('home');
    },
  };
}
