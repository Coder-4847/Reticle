/** In-run HUD with five slots (a, b, time, c, d). Only touches the DOM when a value changes. */
export const DEFAULT_LABELS = { a: 'Score', b: 'Hits', time: 'Time', c: 'Accuracy', d: 'Misses' };
const SLOTS = ['a', 'b', 'time', 'c', 'd'];

export function createHud(root) {
  const slots = {};
  for (const key of SLOTS) {
    const el = root.querySelector(`[data-slot="${key}"]`);
    slots[key] = { el, label: el.querySelector('.hud__label'), value: el.querySelector('.hud__value') };
  }
  const bar = root.querySelector('[data-hud-bar]');
  const shown = {};
  let barK = -1;

  return {
    configure(labels = DEFAULT_LABELS) {
      for (const key of SLOTS) {
        const label = labels[key];
        slots[key].el.hidden = !label;
        slots[key].label.textContent = label ?? '';
        delete shown[key];
      }
      barK = -1;
    },
    set(key, text) {
      if (shown[key] === text) return;
      shown[key] = text;
      slots[key].value.textContent = text;
    },
    /** Remaining fraction for the top bar, 1 -> 0. */
    progress(k) {
      const q = Math.round(Math.min(1, Math.max(0, k)) * 1000) / 1000;
      if (q === barK) return;
      barK = q;
      bar.style.transform = `scaleX(${q})`;
    },
  };
}
