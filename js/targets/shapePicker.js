import { settings } from '../state/settings.js';
import { BUILTIN_IDS, CUSTOM_PREFIX, getShape } from './shapes.js';
import { shapeStore, MAX_SHAPES } from './shapeStore.js';
import { openDrawEditor } from './drawEditor.js';
import { escapeHtml } from '../ui/components.js';

const PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

function drawThumb(canvas, id, color) {
  const dpr = window.devicePixelRatio || 1;
  const size = 44;
  canvas.width = canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  const shape = getShape(id);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(size / 2, size / 2);
  const s = (size / 2 - 3) / shape.bound;
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.fill(shape.path);
}

/** Grid of built-in and custom shapes, plus a "Draw shape" tile. */
export function mountShapePicker(slot) {
  const wrap = document.createElement('div');
  wrap.className = 'shape-picker';
  slot.append(wrap);
  let armedDelete = null;
  let renaming = null;

  function tile(id, name, custom) {
    const sel = settings.get('targets.shape') === id;
    return `<div class="shape-tile${sel ? ' is-selected' : ''}" data-id="${id}">
      ${renaming === id
        ? `<div class="shape-tile__main"><canvas class="shape-tile__thumb"></canvas><input class="shape-tile__rename" value="${escapeHtml(name)}" maxlength="24" aria-label="Shape name"></div>`
        : `<button type="button" class="shape-tile__main" aria-pressed="${sel}"><canvas class="shape-tile__thumb" aria-hidden="true"></canvas><span class="shape-tile__name">${escapeHtml(name)}</span></button>`}
      ${custom ? `<div class="shape-tile__actions">
        <button type="button" class="icon-btn" data-act="rename" aria-label="Rename ${escapeHtml(name)}">${PENCIL}</button>
        <button type="button" class="icon-btn${armedDelete === id ? ' is-armed' : ''}" data-act="delete" aria-label="${armedDelete === id ? 'Confirm delete' : `Delete ${escapeHtml(name)}`}">${CROSS}</button>
      </div>` : ''}
    </div>`;
  }

  function render() {
    const customs = shapeStore.list();
    const full = customs.length >= MAX_SHAPES;
    wrap.innerHTML = `
      <div class="shape-grid">
        ${BUILTIN_IDS.map((id) => tile(id, getShape(id).name, false)).join('')}
        ${customs.map((s) => tile(CUSTOM_PREFIX + s.id, s.name, true)).join('')}
        <button type="button" class="shape-tile shape-tile--new" data-act="draw" ${full ? 'disabled' : ''}>
          <span class="shape-tile__plus">${PLUS}</span><span class="shape-tile__name">Draw shape</span>
        </button>
      </div>
      <p class="row__hint">${customs.length}/${MAX_SHAPES} custom shapes${full ? ' · delete one to draw another' : ''}</p>`;
    const color = settings.get('targets.color');
    for (const t of wrap.querySelectorAll('.shape-tile[data-id]')) drawThumb(t.querySelector('canvas'), t.dataset.id, color);
    const input = wrap.querySelector('.shape-tile__rename');
    if (input) {
      input.focus();
      input.select();
      const done = (save) => {
        if (renaming === null) return;
        const id = renaming;
        renaming = null;
        if (save) shapeStore.rename(id.slice(CUSTOM_PREFIX.length), input.value);
        else render();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') done(true);
        if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      });
      input.addEventListener('blur', () => done(true));
    }
  }

  wrap.addEventListener('click', async (e) => {
    const actBtn = e.target.closest('[data-act]');
    const tileEl = e.target.closest('.shape-tile[data-id]');
    if (actBtn?.dataset.act === 'draw') {
      const id = await openDrawEditor();
      if (id) settings.set('targets.shape', CUSTOM_PREFIX + id);
      return;
    }
    if (!tileEl) return;
    const id = tileEl.dataset.id;
    if (actBtn?.dataset.act === 'rename') {
      renaming = id;
      render();
    } else if (actBtn?.dataset.act === 'delete') {
      if (armedDelete !== id) {
        armedDelete = id;
        render();
        setTimeout(() => { if (armedDelete === id) { armedDelete = null; render(); } }, 2500);
        return;
      }
      armedDelete = null;
      if (settings.get('targets.shape') === id) settings.set('targets.shape', 'circle');
      shapeStore.remove(id.slice(CUSTOM_PREFIX.length));
    } else if (e.target.closest('button.shape-tile__main')) {
      settings.set('targets.shape', id);
    }
  });

  let lastKey = '';
  function sync() {
    const key = `${settings.get('targets.shape')}|${settings.get('targets.color')}`;
    if (key !== lastKey) {
      lastKey = key;
      render();
    }
  }
  shapeStore.subscribe(() => { lastKey = ''; sync(); });
  return { sync };
}
