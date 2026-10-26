// HSV color picker popover: saturation/value square, hue strip, hex input.

function hsvToHex(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function hexToHsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: max ? d / max : 0, v: max };
}

let pop = null;
let state = null;

function build() {
  pop = document.createElement('div');
  pop.className = 'cp';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Color picker');
  pop.innerHTML = `
    <div class="cp__sv"><span class="cp__knob"></span></div>
    <div class="cp__hue"><span class="cp__knob cp__knob--hue"></span></div>
    <div class="cp__row"><span class="cp__preview"></span><label class="num num--hex"><span class="num__unit">#</span><input class="num__input" maxlength="7" spellcheck="false" aria-label="Hex"></label></div>`;
  document.body.append(pop);
  const sv = pop.querySelector('.cp__sv');
  const hue = pop.querySelector('.cp__hue');
  const hexInput = pop.querySelector('input');

  const drag = (area, fn) => {
    const move = (e) => {
      const r = area.getBoundingClientRect();
      fn(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
      emit();
    };
    area.addEventListener('pointerdown', (e) => { area.setPointerCapture(e.pointerId); move(e); });
    area.addEventListener('pointermove', (e) => area.hasPointerCapture(e.pointerId) && move(e));
  };
  drag(sv, (x, y) => { state.s = x; state.v = 1 - y; });
  drag(hue, (x) => { state.h = x * 359.9; });
  hexInput.addEventListener('change', () => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hexInput.value.trim());
    if (m) { Object.assign(state, hexToHsv(`#${m[1]}`)); emit(); }
  });
  document.addEventListener('pointerdown', (e) => {
    if (state && !pop.contains(e.target) && e.target !== state.anchor) close();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (state && e.key === 'Escape') { e.stopImmediatePropagation(); const a = state.anchor; close(); a.focus(); }
  }, true);
}

function paint() {
  const hex = hsvToHex(state.h, state.s, state.v);
  pop.style.setProperty('--hue', `hsl(${state.h} 100% 50%)`);
  pop.style.setProperty('--color', hex);
  const [svKnob, hueKnob] = pop.querySelectorAll('.cp__knob');
  svKnob.style.left = `${state.s * 100}%`;
  svKnob.style.top = `${(1 - state.v) * 100}%`;
  hueKnob.style.left = `${(state.h / 360) * 100}%`;
  const input = pop.querySelector('input');
  if (document.activeElement !== input) input.value = hex.slice(1);
  return hex;
}

function emit() {
  state.onChange(paint());
}

function close() {
  pop?.classList.remove('is-open');
  state = null;
}

export function openColorPicker(anchor, value, onChange) {
  if (!pop) build();
  if (state?.anchor === anchor) return close();
  state = { ...hexToHsv(value), anchor, onChange };
  paint();
  const r = anchor.getBoundingClientRect();
  const w = 232;
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  const below = r.bottom + 8;
  pop.style.top = `${below + 260 > window.innerHeight ? Math.max(8, r.top - 268) : below}px`;
  requestAnimationFrame(() => pop.classList.add('is-open'));
}
