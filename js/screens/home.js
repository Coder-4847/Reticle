import { settings } from '../state/settings.js';
import { MODES } from '../modes/index.js';
import { DURATIONS } from '../modes/presets.js';
import { icons } from '../ui/icons.js';
import { mountSegmented } from '../ui/components.js';
import { openRunSetup } from '../ui/runSetup.js';

function cardHTML(m) {
  return `<button type="button" class="mode-card" data-mode="${m.id}">
    <span class="mode-card__icon">${icons[m.id] ?? ''}</span>
    <span class="mode-card__name">${m.name}</span>
    <span class="mode-card__blurb">${m.blurb}</span>
    <span class="mode-card__foot"><span class="mode-card__cta">Configure &amp; play ${icons.arrow}</span></span>
  </button>`;
}

export function createHomeScreen(el, app) {
  const grid = el.querySelector('[data-mode-grid]');
  grid.innerHTML = MODES.map(cardHTML).join('');

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-mode]');
    if (!card) return;
    const mode = MODES.find((m) => m.id === card.dataset.mode);
    settings.set('run.mode', mode.id);
    openRunSetup(mode, () => app.go('play', { mode: mode.id }));
  });

  el.querySelector('[data-action="quick-start"]').addEventListener('click', () => {
    app.go('play', { mode: settings.get('run.mode') });
  });

  const duration = mountSegmented(el.querySelector('[data-duration]'), {
    options: DURATIONS,
    value: settings.get('run.duration'),
    label: 'Run duration',
    onChange: (v) => settings.set('run.duration', v),
  });

  return {
    el,
    enter() {
      duration.set(settings.get('run.duration'));
    },
  };
}
