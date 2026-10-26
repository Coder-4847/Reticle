/** Pooled particle system using typed arrays: no allocation after creation. */
export function createParticles(max = 512) {
  const x = new Float32Array(max);
  const y = new Float32Array(max);
  const vx = new Float32Array(max);
  const vy = new Float32Array(max);
  const age = new Float32Array(max);
  const ttl = new Float32Array(max);
  const size = new Float32Array(max);
  const color = new Array(max).fill('#fff');
  let count = 0;

  function kill(i) {
    const last = --count;
    x[i] = x[last]; y[i] = y[last];
    vx[i] = vx[last]; vy[i] = vy[last];
    age[i] = age[last]; ttl[i] = ttl[last];
    size[i] = size[last]; color[i] = color[last];
  }

  return {
    get count() { return count; },
    /** Radial burst at (px, py). speed in px/s, life in ms. */
    burst(px, py, n, col, { speed = 380, sz = 3, life = 420 } = {}) {
      for (let k = 0; k < n && count < max; k++) {
        const i = count++;
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.35 + Math.random() * 0.65);
        x[i] = px; y[i] = py;
        vx[i] = Math.cos(a) * s; vy[i] = Math.sin(a) * s;
        age[i] = 0;
        ttl[i] = life * (0.6 + Math.random() * 0.4);
        size[i] = sz * (0.6 + Math.random() * 0.8);
        color[i] = col;
      }
    },
    update(dtMs) {
      const dt = dtMs / 1000;
      const drag = Math.exp(-6 * dt);
      for (let i = 0; i < count; ) {
        age[i] += dtMs;
        if (age[i] >= ttl[i]) { kill(i); continue; }
        vx[i] *= drag; vy[i] *= drag;
        x[i] += vx[i] * dt; y[i] += vy[i] * dt;
        i++;
      }
    },
    draw(ctx) {
      for (let i = 0; i < count; i++) {
        const k = 1 - age[i] / ttl[i];
        const s = size[i] * (0.4 + 0.6 * k);
        ctx.globalAlpha = k;
        ctx.fillStyle = color[i];
        ctx.fillRect(x[i] - s / 2, y[i] - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      count = 0;
    },
  };
}
