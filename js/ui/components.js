import { motionLevel } from '../state/settings.js';
import { easeOutCubic } from '../engine/ease.js';

/**
 * Segmented control (radiogroup) with a sliding thumb.
 * options: [{ value, label }]
 */
export function mountSegmented(container, { options, value, onChange, label }) {
  container.classList.add('segmented');
  container.setAttribute('role', 'radiogroup');
  if (label) container.setAttribute('aria-label', label);
  container.innerHTML =
    '<span class="segmented__thumb" aria-hidden="true"></span>' +
    options
      .map((o) => `<button type="button" class="segmented__opt" role="radio" data-value="${o.value}">${o.label}</button>`)
      .join('');
  const thumb = container.firstElementChild;
  const buttons = [...container.querySelectorAll('.segmented__opt')];
  let current = value;

  function place() {
    const btn = buttons.find((b) => b.dataset.value === String(current));
    if (!btn) return;
    thumb.style.width = `${btn.offsetWidth}px`;
    thumb.style.transform = `translateX(${btn.offsetLeft}px)`;
  }

  function set(v) {
    current = v;
    for (const b of buttons) {
      const on = b.dataset.value === String(v);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    place();
  }

  function choose(i) {
    const opt = options[(i + options.length) % options.length];
    set(opt.value);
    onChange?.(opt.value);
  }

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented__opt');
    if (btn) choose(buttons.indexOf(btn));
  });

  container.addEventListener('keydown', (e) => {
    const i = options.findIndex((o) => String(o.value) === String(current));
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    choose(i + step);
    buttons[options.findIndex((o) => o.value === current)]?.focus();
  });

  new ResizeObserver(place).observe(container);
  set(value);
  requestAnimationFrame(() => container.classList.add('is-ready'));
  return { set, refresh: place };
}

/** Animate a number into `el`. */
export function countUp(el, to, { decimals = 0, duration = 900, delay = 0, format } = {}) {
  const fmt = format ?? ((v) => v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  const motion = motionLevel();
  if (motion === 'off' || !Number.isFinite(to)) {
    el.textContent = Number.isFinite(to) ? fmt(to) : '—';
    return;
  }
  const dur = motion === 'reduced' ? Math.min(duration, 250) : duration;
  const start = performance.now() + (motion === 'reduced' ? 0 : delay);
  el.textContent = fmt(0);
  const token = (el._countToken = {});
  function tick(now) {
    if (el._countToken !== token) return;
    const k = Math.min(1, Math.max(0, (now - start) / dur));
    const v = to * easeOutCubic(k);
    el.textContent = fmt(decimals ? v : Math.round(v));
    if (k < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
