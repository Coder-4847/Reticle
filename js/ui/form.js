import { settings } from '../state/settings.js';
import { createSlider, createSwitch, createColorField, createSegmented } from './controls.js';

/**
 * Build labeled control rows bound to settings paths. Rows re-sync (values and
 * `when` visibility) whenever any setting changes. `custom[id](slot, row)` renders
 * custom rows and may return { sync() }.
 */
export function buildRows(container, rows, { custom = {}, onUserChange } = {}) {
  const bound = [];
  for (const row of rows) {
    const el = document.createElement('div');
    el.className = `row${row.block ? ' row--block' : ''}`;
    el.innerHTML = `<div class="row__label">${row.label}${row.hint ? `<span class="row__hint">${row.hint}</span>` : ''}</div><div class="row__control"></div>`;
    const slot = el.lastElementChild;
    const value = row.path ? settings.get(row.path) : undefined;
    const onChange = (v) => {
      settings.set(row.path, v);
      onUserChange?.(row, v);
    };
    const opts = { ...row, value, onChange };
    let ctrl = null;
    if (row.type === 'slider') ctrl = createSlider(opts);
    else if (row.type === 'switch') ctrl = createSwitch(opts);
    else if (row.type === 'color') ctrl = createColorField(opts);
    else if (row.type === 'segmented') ctrl = createSegmented(opts);
    else if (row.type === 'custom') ctrl = custom[row.id]?.(slot, row) ?? null;
    if (ctrl?.el) slot.append(ctrl.el);
    container.append(el);
    bound.push({ row, el, ctrl });
  }

  function sync() {
    for (const { row, el, ctrl } of bound) {
      if (row.path) ctrl?.set(settings.get(row.path));
      else ctrl?.sync?.();
      el.hidden = row.when ? !row.when(settings.get) : false;
    }
  }

  sync();
  const unsubscribe = settings.subscribe(sync);
  return { sync, destroy: unsubscribe };
}
