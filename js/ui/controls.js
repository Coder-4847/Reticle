import { mountSegmented } from './components.js';
import { openColorPicker } from './colorPicker.js';

const decimalsOf = (step) => (String(step).split('.')[1] || '').length;

/**
 * Slider with a synced numeric input. `scale` maps stored values to displayed ones
 * (e.g. 100 to show 0..1 as a percentage).
 */
export function createSlider({ min, max, step = 1, unit = '', scale = 1, label, value, onChange }) {
  const el = document.createElement('div');
  el.className = 'slider';
  el.innerHTML = `
    <div class="slider__track" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="${min * scale}" aria-valuemax="${max * scale}">
      <span class="slider__fill"></span><span class="slider__thumb"></span>
    </div>
    <label class="num"><input class="num__input" type="text" inputmode="decimal" aria-label="${label} value">${unit ? `<span class="num__unit">${unit}</span>` : ''}</label>`;
  const track = el.querySelector('.slider__track');
  const inputEl = el.querySelector('input');
  const dec = decimalsOf(step * scale);
  let current = value;

  const snap = (v) => {
    const s = Math.round((Math.min(max, Math.max(min, v)) - min) / step) * step + min;
    return Number(s.toFixed(decimalsOf(step) + 2));
  };

  function render() {
    const p = max === min ? 0 : (current - min) / (max - min);
    track.style.setProperty('--p', p);
    const shown = (current * scale).toFixed(dec);
    track.setAttribute('aria-valuenow', shown);
    track.setAttribute('aria-valuetext', `${shown}${unit}`);
    if (document.activeElement !== inputEl) inputEl.value = shown;
  }

  function commit(v) {
    const next = snap(v);
    if (next === current) return render();
    current = next;
    render();
    onChange(current);
  }

  function fromPointer(e) {
    const r = track.getBoundingClientRect();
    commit(min + ((e.clientX - r.left) / r.width) * (max - min));
  }

  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
    fromPointer(e);
  });
  track.addEventListener('pointermove', (e) => track.hasPointerCapture(e.pointerId) && fromPointer(e));
  const end = () => el.classList.remove('is-dragging');
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);

  track.addEventListener('keydown', (e) => {
    const big = (max - min) / 10;
    const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big }[e.key];
    if (delta !== undefined) commit(current + delta);
    else if (e.key === 'Home') commit(min);
    else if (e.key === 'End') commit(max);
    else return;
    e.preventDefault();
  });

  const fromInput = () => {
    const v = parseFloat(inputEl.value);
    if (Number.isFinite(v)) commit(v / scale);
    inputEl.value = (current * scale).toFixed(dec);
  };
  inputEl.addEventListener('change', fromInput);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { fromInput(); inputEl.blur(); }
  });

  render();
  return { el, set(v) { current = v; render(); } };
}

export function createSwitch({ label, value, onChange }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'switch';
  el.setAttribute('role', 'switch');
  el.setAttribute('aria-label', label);
  el.innerHTML = '<span class="switch__thumb"></span>';
  let current = value;
  const render = () => el.setAttribute('aria-checked', String(current));
  el.addEventListener('click', () => {
    current = !current;
    render();
    onChange(current);
  });
  render();
  return { el, set(v) { current = v; render(); } };
}

const HEX = /^#?([0-9a-f]{6})$/i;

/** Preset swatches + a "custom" swatch that opens the full picker + a hex input. */
export function createColorField({ label, value, swatches = [], onChange }) {
  const el = document.createElement('div');
  el.className = 'color-field';
  el.innerHTML = `
    <div class="swatches" role="radiogroup" aria-label="${label}">
      ${swatches.map((c) => `<button type="button" class="swatch" role="radio" style="--swatch:${c}" data-value="${c}" aria-label="${c}"></button>`).join('')}
      <button type="button" class="swatch swatch--custom" aria-label="Custom color" title="Custom color"></button>
    </div>
    <label class="num num--hex"><span class="num__unit">#</span><input class="num__input" type="text" maxlength="7" spellcheck="false" aria-label="${label} hex"></label>`;
  const custom = el.querySelector('.swatch--custom');
  const hexInput = el.querySelector('input');
  let current = value;

  function render() {
    for (const sw of el.querySelectorAll('.swatch[data-value]')) {
      sw.setAttribute('aria-checked', String(sw.dataset.value.toLowerCase() === current.toLowerCase()));
    }
    const isPreset = swatches.some((c) => c.toLowerCase() === current.toLowerCase());
    custom.style.setProperty('--swatch', current);
    custom.setAttribute('aria-checked', String(!isPreset));
    if (document.activeElement !== hexInput) hexInput.value = current.slice(1);
  }

  function commit(v) {
    const m = HEX.exec(v);
    if (!m) return render();
    current = `#${m[1].toLowerCase()}`;
    render();
    onChange(current);
  }

  el.querySelector('.swatches').addEventListener('click', (e) => {
    const sw = e.target.closest('.swatch');
    if (!sw) return;
    if (sw === custom) openColorPicker(custom, current, commit);
    else commit(sw.dataset.value);
  });
  hexInput.addEventListener('change', () => commit(hexInput.value));
  hexInput.addEventListener('keydown', (e) => e.key === 'Enter' && hexInput.blur());

  render();
  return { el, set(v) { current = v; render(); } };
}

export function createSegmented({ label, value, options, onChange }) {
  const el = document.createElement('div');
  const seg = mountSegmented(el, { options, value, label, onChange });
  return { el, set: seg.set };
}
