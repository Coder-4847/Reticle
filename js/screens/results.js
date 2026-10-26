import { summarize, resultRows, personalBests } from '../stats/analyze.js';
import { renderReport } from '../stats/report.js';
import { sparkline } from '../stats/charts.js';
import { countUp } from '../ui/components.js';
import { MODES } from '../modes/index.js';
import { listRuns } from '../state/store.js';
import { motionLevel } from '../state/settings.js';

export function createResultsScreen(el, app) {
  const f = {};
  for (const node of el.querySelectorAll('[data-r]')) f[node.dataset.r] = node;
  const expandBtn = el.querySelector('[data-action="expand"]');
  const backBtn = el.querySelector('[data-action="back"]');
  let run = null;
  let expanded = false;
  let rendered = false;
  let token = 0;

  function setExpanded(open, { instant = false } = {}) {
    expanded = open;
    expandBtn.setAttribute('aria-expanded', String(open));
    f.expandLabel.textContent = open ? 'Hide full report' : 'Expand full report';
    const d = f.detail;
    if (open && !rendered) {
      renderReport(d, run);
      rendered = true;
    }
    const animate = !instant && motionLevel() !== 'off';
    if (!animate) {
      d.style.height = open ? 'auto' : '0px';
      d.classList.toggle('is-open', open);
      return;
    }
    d.style.height = `${d.offsetHeight}px`;
    d.classList.toggle('is-open', open);
    requestAnimationFrame(() => {
      d.style.height = open ? `${d.scrollHeight}px` : '0px';
    });
    const done = (e) => {
      if (e.target !== d || e.propertyName !== 'height') return;
      d.removeEventListener('transitionend', done);
      if (expanded) d.style.height = 'auto';
    };
    d.addEventListener('transitionend', done);
    if (open) setTimeout(() => d.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  el.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'retry') app.go('play', { mode: run?.mode });
    else if (action === 'home') app.go('home');
    else if (action === 'back') app.go('stats');
    else if (action === 'expand') setExpanded(!expanded);
  });

  async function show(r, { expand = false, from = null } = {}) {
    const my = ++token;
    run = r;
    rendered = false;
    f.detail.replaceChildren();
    setExpanded(false, { instant: true });
    backBtn.hidden = from !== 'stats';
    const sum = r.summary ?? summarize(r);
    const modeName = MODES.find((m) => m.id === r.mode)?.name ?? r.mode;
    const length = r.duration ? `${Math.round(r.duration / 1000)}s` : `${r.targets?.length ?? sum.hits} trials`;
    const preset = sum.preset ? ` · ${sum.preset[0].toUpperCase()}${sum.preset.slice(1)}` : '';
    f.meta.textContent = `${modeName} · ${length}${preset}`;
    f.title.textContent = from === 'stats'
      ? new Date(r.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : 'Run complete';
    const tracking = r.mode === 'tracking';
    f.scoreLabel.textContent = tracking ? 'Score (% on target)' : 'Score';
    countUp(f.score, sum.score, { duration: 1100, decimals: tracking ? 1 : 0 });

    const rows = resultRows(r, sum);
    f.grid.innerHTML = rows
      .map((row) => `<div class="stat"><span class="stat__label">${row.label}${row.pb ? `<span class="pb pb--sm" data-pb="${row.pb}" hidden>PB</span>` : ''}</span><span class="stat__value"><span data-v></span>${row.unit && Number.isFinite(row.value) ? `<span class="stat__unit">${row.unit}</span>` : ''}</span></div>`)
      .join('');
    f.grid.querySelectorAll('[data-v]').forEach((node, i) => countUp(node, rows[i].value, { decimals: rows[i].decimals ?? 0, delay: 80 + i * 40 }));

    // Sparkline: reaction time per hit, tracking error, or per-trial reaction.
    let values = [];
    let label = '';
    if (r.compact) {
      label = '';
    } else if (r.track) {
      const s = r.track.samples;
      const step = Math.max(1, Math.floor(s.length / 3 / 60));
      for (let i = 0; i < s.length; i += 3 * step) if (s[i + 1] >= 0) values.push(s[i + 1]);
      label = 'Distance from target over the run';
    } else {
      values = r.targets.filter((t) => t.hit).sort((a, b) => a.hitT - b.hitT).map((t) => t.rt);
      label = r.mode === 'reaction' ? 'Reaction time per trial' : 'Reaction time over the run';
    }
    f.spark.hidden = values.length < 2;
    f.sparkLabel.textContent = label;
    if (values.length >= 2) requestAnimationFrame(() => sparkline(f.sparkCanvas, values, { height: 56 }));

    for (const b of el.querySelectorAll('[data-pb]')) b.hidden = true;
    const pbs = personalBests(r, await listRuns());
    if (my !== token) return;
    for (const [key, isPb] of Object.entries(pbs)) {
      if (!isPb) continue;
      const badge = el.querySelector(`[data-pb="${key}"]`);
      if (badge) {
        badge.hidden = false;
        badge.classList.remove('is-in');
        void badge.offsetWidth;
        badge.classList.add('is-in');
      }
    }
    if (expand) requestAnimationFrame(() => setExpanded(true));
  }

  return {
    el,
    focusTarget: el.querySelector('[data-action="retry"]'),
    async enter({ run: r, expand = false, from = null } = {}) {
      if (r) return show(r, { expand, from });
      const [latest] = await listRuns();
      if (latest) show(latest);
      else app.go('home');
    },
  };
}
