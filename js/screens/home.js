import { settings } from '../state/settings.js';
import { MODES } from '../modes/index.js';
import { icons } from '../ui/icons.js';
import { mountSegmented } from '../ui/components.js';

export const DURATIONS = [30, 60, 90].map((v) => ({ value: v, label: `${v}s` }));

function cardHTML(m) {
  const playable = Boolean(m.create);
  const foot = playable
    ? `<span class="mode-card__cta">Play ${icons.arrow}</span>`
    : `<span class="badge">${icons.lock}Coming soon</span>`;
  return `<button type="button" class="mode-card" data-mode="${m.id}" ${playable ? '' : 'disabled'}>
    <span class="mode-card__icon">${icons[m.id] ?? ''}</span>
    <span class="mode-card__name">${m.name}</span>
    <span class="mode-card__blurb">${m.blurb}</span>
    <span class="mode-card__foot">${foot}</span>
  </button>`;
}

export function createHomeScreen(el, app) {
  const grid = el.querySelector('[data-mode-grid]');
  grid.innerHTML = MODES.map(cardHTML).join('');

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-mode]');
    if (!card || card.disabled) return;
    settings.set('run.mode', card.dataset.mode);
    app.go('play', { mode: card.dataset.mode });
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
