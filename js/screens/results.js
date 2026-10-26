import { summarize } from '../stats/analyze.js';
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
    f.meta.textContent = `${modeName} · ${Math.round(r.duration / 1000)}s`;
    countUp(f.score, sum.score, { duration: 1100 });
    countUp(f.accuracy, sum.accuracy * 100, { decimals: 1, delay: 80 });
    countUp(f.avgRT, sum.avgRT ?? NaN, { delay: 120 });
    countUp(f.hits, sum.hits, { delay: 160 });
    countUp(f.misses, sum.misses, { delay: 200 });
    countUp(f.expired, sum.expired, { delay: 240 });
    countUp(f.shots, sum.shots, { delay: 280 });
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
