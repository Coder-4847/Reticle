import { settings } from '../state/settings.js';
import { MODES } from '../modes/index.js';
import { DURATIONS } from '../modes/presets.js';
import { icons } from '../ui/icons.js';
import { mountSegmented } from '../ui/components.js';
import { openRunSetup } from '../ui/runSetup.js';
import { createHomeBackground } from '../ui/homeBackground.js';
import { listRuns } from '../state/store.js';

function cardHTML(m) {
  return `<button type="button" class="mode-card" data-mode="${m.id}">
    <span class="mode-card__icon">${icons[m.id] ?? ''}</span>
    <span class="mode-card__name">${m.name}</span>
    <span class="mode-card__blurb">${m.blurb}</span>
    <span class="mode-card__foot"><span class="mode-card__pb" data-pb-for="${m.id}"></span><span class="mode-card__cta">Play ${icons.arrow}</span></span>
  </button>`;
}

export function createHomeScreen(el, app) {
  const grid = el.querySelector('[data-mode-grid]');
  grid.innerHTML = MODES.map(cardHTML).join('');
  [...grid.children].forEach((c, i) => c.style.setProperty('--i', i));
  const bg = createHomeBackground(el.querySelector('.home__bg'));

  // Best score per mode at its currently selected preset.
  async function showBests() {
    const runs = await listRuns();
    for (const m of MODES) {
      const preset = settings.get(`modes.${m.id}.preset`);
      const mine = runs.filter((r) => r.mode === m.id && r.summary.preset === preset);
      const node = grid.querySelector(`[data-pb-for="${m.id}"]`);
      if (!mine.length) {
        node.textContent = 'No runs yet';
        continue;
      }
      const best = Math.max(...mine.map((r) => r.summary.score));
      const label = m.id === 'tracking' ? `${best.toFixed(1)}%` : Math.round(best).toLocaleString();
      node.innerHTML = `<span class="mode-card__pb-label">PB · ${preset}</span>${label}`;
    }
  }

  function pickMode(mode) {
    settings.set('run.mode', mode.id);
    openRunSetup(mode, () => app.go('play', { mode: mode.id }));
  }
  const quickStart = () => app.go('play', { mode: settings.get('run.mode') });

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-mode]');
    if (card) pickMode(MODES.find((m) => m.id === card.dataset.mode));
  });
  el.querySelector('[data-action="quick-start"]').addEventListener('click', quickStart);

  const duration = mountSegmented(el.querySelector('[data-duration]'), {
    options: DURATIONS,
    value: settings.get('run.duration'),
    label: 'Run duration',
    onChange: (v) => settings.set('run.duration', v),
  });

  return {
    el,
    quickStart,
    pickMode: (i) => MODES[i] && pickMode(MODES[i]),
    enter() {
      duration.set(settings.get('run.duration'));
      bg.start();
      showBests();
    },
    leave() {
      bg.stop();
    },
  };
}
