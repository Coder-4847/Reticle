/** In-run HUD with five slots (a, b, time, c, d), a streak badge and an FPS readout. DOM only changes when a value does. */
export const DEFAULT_LABELS = { a: 'Score', b: 'Hits', time: 'Time', c: 'Accuracy', d: 'Misses' };
const SLOTS = ['a', 'b', 'time', 'c', 'd'];
const SIDE = ['a', 'b', 'c', 'd'];
const MODE_HUD_EVERY_MS = 100;

export function createHud(root) {
  const slots = {};
  for (const key of SLOTS) {
    const el = root.querySelector(`[data-slot="${key}"]`);
    slots[key] = { el, label: el.querySelector('.hud__label'), value: el.querySelector('.hud__value') };
  }
  const bar = root.querySelector('[data-hud-bar]');
  const streakEl = root.querySelector('[data-streak]');
  const streakN = streakEl.querySelector('.streak__n');
  const fpsEl = root.querySelector('[data-fps]');
  const shown = {};
  const out = {}; // reused buffer for modes that render their own HUD values
  let barK = -1;
  let modeHudT = -1e9;
  let tenths = -1;
  let streakShown = 0;

  function set(key, text) {
    if (shown[key] === text) return;
    shown[key] = text;
    slots[key].value.textContent = text;
  }

  function progress(k) {
    const q = Math.round(Math.min(1, Math.max(0, k)) * 1000) / 1000;
    if (q === barK) return;
    barK = q;
    bar.style.transform = `scaleX(${q})`;
  }

  return {
    set,
    progress,
    /** Prepare for a new session: labels, effects and cleared values. */
    begin(labels = DEFAULT_LABELS, { timerBar = true, fps = false } = {}) {
      for (const key of SLOTS) {
        slots[key].el.hidden = !labels[key];
        slots[key].label.textContent = labels[key] ?? '';
        delete shown[key];
      }
      barK = -1;
      modeHudT = -1e9;
      tenths = -1;
      root.classList.toggle('hud--no-bar', !timerBar);
      fpsEl.hidden = !fps;
      this.streak(0);
    },
    /** Default click-mode stats (modes with their own hud() skip this). */
    stats(s) {
      if (s.mode.hud) return;
      set('a', s.score.toLocaleString());
      set('b', String(s.hits));
      set('c', s.shots ? `${Math.round((s.hits / s.shots) * 100)}%` : '—');
      set('d', String(s.shots - s.hits));
    },
    /** Per-frame: remaining time, timer bar, and mode-provided values (throttled). */
    time(s, t) {
      const now = performance.now();
      if (s.mode.hud && now - modeHudT >= MODE_HUD_EVERY_MS) {
        modeHudT = now;
        out.time = undefined;
        out.progress = undefined;
        s.mode.hud(out, t);
        for (const k of SIDE) if (out[k] !== undefined) set(k, out[k]);
        if (s.duration === null) {
          set('time', out.time ?? '');
          progress(out.progress ?? 1);
        }
      }
      if (s.duration === null) return;
      const remaining = Math.min(s.duration, Math.max(0, s.duration - Math.max(0, t)));
      const next = Math.ceil(remaining / 100);
      if (next !== tenths) {
        tenths = next;
        set('time', (next / 10).toFixed(1));
      }
      progress(remaining / s.duration);
    },
    /** Consecutive-hit counter, visible from 3 hits. Pulses on each increment. */
    streak(n) {
      if (n === streakShown) return;
      const visible = n >= 3;
      streakEl.classList.toggle('is-visible', visible);
      if (visible) {
        streakN.textContent = String(n);
        streakEl.classList.remove('is-pulse');
        void streakEl.offsetWidth;
        streakEl.classList.add('is-pulse');
      }
      streakShown = n;
    },
    fps(v) {
      fpsEl.textContent = `${v} fps`;
    },
  };
}
