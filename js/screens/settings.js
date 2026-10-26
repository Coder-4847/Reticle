import { settings } from '../state/settings.js';
import { mountSegmented } from '../ui/components.js';
import { DURATIONS } from './home.js';

const ACCENTS = ['#4f8dff', '#7c6cff', '#22c3a6', '#38d996', '#ffb547', '#ff7a45', '#ff4f8b', '#e8eaed'];
const CATEGORIES = ['General', 'Crosshair', 'Targets', 'Background', 'Audio'];
const ANIMATIONS = [
  { value: 'system', label: 'System' },
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'off', label: 'Off' },
];

export function createSettingsScreen(el) {
  const root = el.querySelector('[data-settings]');
  root.innerHTML = `
    <nav class="settings__nav" role="tablist" aria-label="Setting categories">
      ${CATEGORIES.map((c, i) => `<button type="button" class="settings__tab" role="tab" aria-selected="${i === 0}" ${i ? 'disabled' : ''}>${c}${i ? '<span class="badge">Soon</span>' : ''}</button>`).join('')}
    </nav>
    <section class="card panel" role="tabpanel" aria-label="General">
      <header class="panel__head">
        <h2 class="panel__title">General</h2>
        <button type="button" class="btn btn--ghost btn--sm" data-action="reset">Reset to default</button>
      </header>
      <div class="row">
        <div class="row__label">Animations<span class="row__hint">System follows your OS reduced-motion preference.</span></div>
        <div data-control="animations"></div>
      </div>
      <div class="row">
        <div class="row__label">Accent color<span class="row__hint">Used for highlights across the interface.</span></div>
        <div class="swatches" role="radiogroup" aria-label="Accent color" data-control="accent">
          ${ACCENTS.map((c) => `<button type="button" class="swatch" role="radio" style="--swatch:${c}" data-value="${c}" aria-label="${c}"></button>`).join('')}
        </div>
      </div>
      <div class="row">
        <div class="row__label">Run duration<span class="row__hint">Length of a timed run.</span></div>
        <div data-control="duration"></div>
      </div>
    </section>`;

  const animations = mountSegmented(root.querySelector('[data-control="animations"]'), {
    options: ANIMATIONS,
    value: settings.get('ui.animations'),
    label: 'Animations',
    onChange: (v) => settings.set('ui.animations', v),
  });
  const duration = mountSegmented(root.querySelector('[data-control="duration"]'), {
    options: DURATIONS,
    value: settings.get('run.duration'),
    label: 'Run duration',
    onChange: (v) => settings.set('run.duration', v),
  });
  const accent = root.querySelector('[data-control="accent"]');

  function sync() {
    animations.set(settings.get('ui.animations'));
    duration.set(settings.get('run.duration'));
    const current = settings.get('ui.accent');
    for (const sw of accent.children) sw.setAttribute('aria-checked', String(sw.dataset.value === current));
  }

  accent.addEventListener('click', (e) => {
    const sw = e.target.closest('.swatch');
    if (sw) settings.set('ui.accent', sw.dataset.value);
  });

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    settings.resetSection('ui');
    settings.resetSection('run');
  });

  settings.subscribe(sync);
  sync();
  return { el, enter: sync };
}
