/** In-run HUD. Only touches the DOM when a displayed value actually changes. */
export function createHud(root) {
  const els = {};
  for (const el of root.querySelectorAll('[data-hud-el]')) els[el.dataset.hudEl] = el;
  const shown = {};
  let barK = -1;

  function text(key, value) {
    if (shown[key] === value) return;
    shown[key] = value;
    els[key].textContent = value;
  }

  const hud = {
    reset(duration) {
      for (const k of Object.keys(shown)) delete shown[k];
      barK = -1;
      hud.stats({ score: 0, hits: 0, shots: 0 });
      hud.frame(0, duration);
    },
    stats({ score, hits, shots }) {
      text('score', score.toLocaleString());
      text('hits', String(hits));
      text('misses', String(shots - hits));
      text('acc', shots ? `${Math.round((hits / shots) * 100)}%` : '—');
    },
    frame(elapsed, duration) {
      const remaining = Math.min(duration, Math.max(0, duration - Math.max(0, elapsed)));
      text('time', (Math.ceil(remaining / 100) / 10).toFixed(1));
      const k = Math.round((remaining / duration) * 1000) / 1000;
      if (k !== barK) {
        barK = k;
        els.bar.style.transform = `scaleX(${k})`;
      }
    },
  };
  return hud;
}
