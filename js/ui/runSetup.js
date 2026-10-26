import { settings } from '../state/settings.js';
import { openModal } from './modal.js';
import { buildRows } from './form.js';
import { createSegmented } from './controls.js';
import { icons } from './icons.js';
import { FIELDS, MODE_FIELDS, PRESETS, PRESET_NAMES, DURATIONS } from '../modes/presets.js';

/** Pre-run configuration panel: preset, duration and the mode's own fields. */
export function openRunSetup(mode, onStart) {
  const base = `modes.${mode.id}`;
  const presets = PRESETS[mode.id];
  const presetKeys = presets ? Object.keys(presets.standard) : [];
  const content = document.createElement('div');
  content.className = 'run-setup';
  content.innerHTML = `
    <header class="run-setup__head">
      <span class="mode-card__icon">${icons[mode.id] ?? ''}</span>
      <div>
        <h2 class="dialog__title">${mode.name}</h2>
        <p class="dialog__sub">${mode.blurb}</p>
      </div>
    </header>
    ${presets ? '<div class="run-setup__presets"><span class="eyebrow">Difficulty</span><div data-presets></div></div>' : ''}
    <div class="run-setup__rows"></div>
    <div class="dialog__actions dialog__actions--row">
      <button type="button" class="btn" data-act="cancel">Cancel</button>
      <button type="button" class="btn btn--primary" data-act="start" autofocus>Start <kbd>Enter</kbd></button>
    </div>`;

  let presetCtrl = null;
  if (presets) {
    presetCtrl = createSegmented({
      label: 'Difficulty preset',
      value: settings.get(`${base}.preset`),
      options: PRESET_NAMES,
      onChange(v) {
        if (v !== 'custom') for (const [k, val] of Object.entries(presets[v])) settings.set(`${base}.${k}`, val);
        settings.set(`${base}.preset`, v);
      },
    });
    content.querySelector('[data-presets]').append(presetCtrl.el);
  }

  const rows = [];
  if (mode.timed !== false) rows.push({ type: 'segmented', path: 'run.duration', label: 'Duration', options: DURATIONS });
  for (const [key, override] of Object.entries(MODE_FIELDS[mode.id])) rows.push({ ...FIELDS[key], ...override, path: `${base}.${key}` });

  const form = buildRows(content.querySelector('.run-setup__rows'), rows, {
    onUserChange(row) {
      const key = row.path.split('.').pop();
      if (presetKeys.includes(key)) settings.set(`${base}.preset`, 'custom');
    },
  });
  const unsubscribe = settings.subscribe(() => presetCtrl?.set(settings.get(`${base}.preset`)));

  const modal = openModal(content, {
    label: `${mode.name} setup`,
    onClose() {
      form.destroy();
      unsubscribe();
    },
  });

  const start = () => {
    modal.close();
    onStart();
  };
  content.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'cancel') modal.close();
    else if (act === 'start') start();
  });
  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.target.closest('input, button, [role="slider"]')) start();
  });
}
