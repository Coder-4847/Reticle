import { openModal } from '../ui/modal.js';
import { simplify, smoothClosed, normalize, centroid } from './geometry.js';
import { shapeStore, MAX_SHAPES } from './shapeStore.js';

const CLOSE_PX = 24; // the stroke counts as closed when it ends this close to its start
const MIN_SPAN = 60; // ...and has travelled at least this far from the start

/** Freehand shape editor. Resolves with the new shape's id, or null if cancelled. */
export function openDrawEditor() {
  return new Promise((resolve) => {
    const content = document.createElement('div');
    content.className = 'draw';
    content.innerHTML = `
      <header class="draw__head">
        <div>
          <h2 class="dialog__title">Draw a target shape</h2>
          <p class="dialog__sub">Draw one continuous outline and finish where you started.</p>
        </div>
      </header>
      <div class="draw__stage"><canvas class="draw__canvas" aria-label="Drawing area"></canvas></div>
      <p class="draw__status" data-tone="info" aria-live="polite">Press and drag to draw.</p>
      <div class="draw__foot">
        <input class="input" type="text" maxlength="24" placeholder="Shape name" aria-label="Shape name">
        <button type="button" class="btn btn--ghost" data-act="clear">Clear</button>
        <button type="button" class="btn" data-act="cancel">Cancel</button>
        <button type="button" class="btn btn--primary" data-act="save" disabled>Save shape</button>
      </div>`;
    const canvas = content.querySelector('canvas');
    const status = content.querySelector('.draw__status');
    const nameInput = content.querySelector('input');
    const saveBtn = content.querySelector('[data-act="save"]');
    const ctx = canvas.getContext('2d');
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4f8dff';
    let stroke = [];
    let drawing = false;
    let closed = false;
    let result = null; // normalized flat points
    let resolved = false;

    const modal = openModal(content, {
      label: 'Draw a target shape',
      wide: true,
      onClose: () => { if (!resolved) resolve(null); },
    });

    function setStatus(text, tone) {
      status.textContent = text;
      status.dataset.tone = tone;
    }

    function size() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    }

    const isClosing = () => {
      if (stroke.length < 8) return false;
      const [sx, sy] = stroke[0];
      const [ex, ey] = stroke[stroke.length - 1];
      const span = Math.max(...stroke.map(([x, y]) => Math.hypot(x - sx, y - sy)));
      return span >= MIN_SPAN && Math.hypot(ex - sx, ey - sy) <= CLOSE_PX;
    };

    function paint() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (result) {
        // Show the processed shape at the size and place it was drawn.
        const c = centroid(stroke);
        const scale = Math.max(...stroke.map(([x, y]) => Math.hypot(x - c.x, y - c.y)));
        ctx.beginPath();
        for (let i = 0; i < result.length; i += 2) ctx.lineTo(c.x + result[i] * scale, c.y + result[i + 1] * scale);
        ctx.closePath();
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.85;
        ctx.fill('nonzero');
        ctx.globalAlpha = 1;
        return;
      }
      if (!stroke.length) return;
      const near = isClosing();
      ctx.lineWidth = 3;
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.strokeStyle = '#eef1f4';
      ctx.beginPath();
      for (const [x, y] of stroke) ctx.lineTo(x, y);
      ctx.stroke();
      const [sx, sy] = stroke[0];
      ctx.beginPath();
      ctx.arc(sx, sy, near ? CLOSE_PX : 6, 0, Math.PI * 2);
      ctx.fillStyle = near ? `${accent}33` : '#eef1f4';
      ctx.fill();
      if (near) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    function finishStroke() {
      drawing = false;
      closed = isClosing();
      if (!closed) {
        setStatus('The shape is not closed. Finish your line near the starting dot.', 'error');
        saveBtn.disabled = true;
        paint();
        return;
      }
      const simplified = simplify(stroke, 1.5);
      const pts = normalize(smoothClosed(simplified, 2));
      const area = pts ? Math.abs(centroid(simplified).area) : 0;
      if (!pts || area < 400) {
        setStatus('That shape is too thin to use as a target. Try a fuller outline.', 'error');
        result = null;
        saveBtn.disabled = true;
        paint();
        return;
      }
      result = pts;
      const full = shapeStore.isFull();
      setStatus(full ? `You already have ${MAX_SHAPES} shapes. Delete one to save another.` : 'Closed. Name it and save.', full ? 'error' : 'ok');
      saveBtn.disabled = full;
      paint();
      if (!full) nameInput.focus();
    }

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      closed = false;
      result = null;
      saveBtn.disabled = true;
      stroke = [[e.offsetX, e.offsetY]];
      setStatus('Keep going… bring the line back to the start.', 'info');
      paint();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const list = e.getCoalescedEvents?.() ?? [e];
      for (const ce of list.length ? list : [e]) {
        const r = canvas.getBoundingClientRect();
        stroke.push([ce.clientX - r.left, ce.clientY - r.top]);
      }
      const near = isClosing();
      if (near) setStatus('Closed: release to finish.', 'ok');
      paint();
    });
    canvas.addEventListener('pointerup', () => drawing && finishStroke());
    canvas.addEventListener('pointercancel', () => drawing && finishStroke());

    content.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'clear') {
        stroke = [];
        result = null;
        saveBtn.disabled = true;
        setStatus('Press and drag to draw.', 'info');
        paint();
      } else if (act === 'cancel') {
        modal.close();
      } else if (act === 'save' && result) {
        const id = shapeStore.add(nameInput.value || `Shape ${shapeStore.list().length + 1}`, result);
        resolved = true;
        resolve(id);
        modal.close();
      }
    });
    nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && !saveBtn.disabled && saveBtn.click());

    new ResizeObserver(size).observe(canvas);
  });
}
