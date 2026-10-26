// Cursor trail: a fixed-size ring buffer of recent pointer positions, drawn with age-based fade.
const CAP = 256;

export function createTrail() {
  const xs = new Float32Array(CAP);
  const ys = new Float32Array(CAP);
  const ts = new Float64Array(CAP);
  let head = 0; // next write index
  let size = 0;

  const at = (i) => (head - 1 - i + CAP * 2) % CAP; // i = 0 is the newest point

  return {
    push(x, y, t) {
      if (size) {
        const p = at(0);
        if (Math.abs(xs[p] - x) < 0.5 && Math.abs(ys[p] - y) < 0.5) return;
      }
      xs[head] = x; ys[head] = y; ts[head] = t;
      head = (head + 1) % CAP;
      if (size < CAP) size++;
    },
    clear() {
      size = 0;
    },
    /** cfg: { style, length (ms), fade (0..1), width } */
    draw(ctx, now, cfg, color) {
      let n = 0;
      while (n < size && now - ts[at(n)] <= cfg.length) n++;
      if (n < 2) return;
      const power = 0.5 + cfg.fade * 3; // higher fade = alpha drops off faster
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = 'round';
      for (let i = 0; i < n - 1; i++) {
        const a = at(i);
        const k = 1 - (now - ts[a]) / cfg.length;
        const alpha = Math.max(0, k) ** power;
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = alpha;
        if (cfg.style === 'dots') {
          const s = cfg.width * (0.4 + 0.6 * k);
          ctx.fillRect(xs[a] - s / 2, ys[a] - s / 2, s, s);
        } else {
          const b = at(i + 1);
          const w = cfg.width * (0.35 + 0.65 * k);
          ctx.beginPath();
          ctx.moveTo(xs[a], ys[a]);
          ctx.lineTo(xs[b], ys[b]);
          if (cfg.style === 'glow') {
            ctx.globalAlpha = alpha * 0.18;
            ctx.lineWidth = w * 4;
            ctx.stroke();
            ctx.globalAlpha = alpha;
          }
          ctx.lineWidth = w;
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  };
}

/** Resolve the trail color from settings. */
export function trailColor(snap) {
  const mode = snap.trail.colorMode;
  if (mode === 'accent') return snap.ui.accent;
  if (mode === 'custom') return snap.trail.color;
  return snap.crosshair.color;
}
