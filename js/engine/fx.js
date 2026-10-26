import { drawTarget } from '../targets/render.js';

// Pooled one-shot effects in real time (performance.now): shape fragments,
// click pings, miss ripples and a small screen shake. No allocation after creation.
const FRAG = 1;
const PING = 2;
const RIPPLE = 3;

export function createFx(max = 64) {
  const pool = Array.from({ length: max }, () => ({ kind: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, size: 0, t: 0, life: 0, color: '' }));
  const shake = { t: -1e9, amp: 0, x: 0, y: 0 };

  function take(kind, x, y, color, life, now) {
    const it = pool.find((p) => !p.kind);
    if (!it) return null;
    it.kind = kind; it.x = x; it.y = y; it.color = color; it.life = life; it.t = now;
    return it;
  }

  return {
    /** Small copies of the target's shape flying outward. */
    fragments(x, y, r, color, now, n = 5) {
      for (let i = 0; i < n; i++) {
        const it = take(FRAG, x, y, color, 380 + Math.random() * 160, now);
        if (!it) return;
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.8;
        const s = 140 + Math.random() * 160;
        it.vx = Math.cos(a) * s;
        it.vy = Math.sin(a) * s;
        it.rot = Math.random() * Math.PI * 2;
        it.vr = (Math.random() - 0.5) * 12;
        it.size = r * (0.22 + Math.random() * 0.12);
      }
    },
    ping(x, y, color, now) {
      take(PING, x, y, color, 240, now);
    },
    ripple(x, y, color, now) {
      take(RIPPLE, x, y, color, 420, now);
    },
    shake(now, amp = 3) {
      shake.t = now;
      shake.amp = amp;
    },
    /** Current shake offset (decays over 160 ms). */
    shakeOffset(now) {
      const k = 1 - (now - shake.t) / 160;
      if (k <= 0) { shake.x = 0; shake.y = 0; return shake; }
      shake.x = (Math.random() * 2 - 1) * shake.amp * k;
      shake.y = (Math.random() * 2 - 1) * shake.amp * k;
      return shake;
    },
    update(dtMs) {
      const dt = dtMs / 1000;
      const drag = Math.exp(-5 * dt);
      for (const it of pool) {
        if (it.kind !== FRAG) continue;
        it.vx *= drag; it.vy *= drag;
        it.x += it.vx * dt; it.y += it.vy * dt;
        it.rot += it.vr * dt;
      }
    },
    draw(ctx, now, look) {
      for (const it of pool) {
        if (!it.kind) continue;
        const k = (now - it.t) / it.life;
        if (k >= 1) { it.kind = 0; continue; }
        if (it.kind === FRAG) {
          drawTarget(ctx, look, it.x, it.y, it.size, it.rot, 1 - k * 0.5, (1 - k) * 0.9, it.color);
          continue;
        }
        const e = 1 - (1 - k) ** 3;
        ctx.strokeStyle = it.color;
        if (it.kind === PING) {
          ctx.globalAlpha = (1 - k) * 0.7;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(it.x, it.y, 3 + e * 16, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.lineWidth = 2;
          for (const [delay, scale] of [[0, 1], [0.18, 0.6]]) {
            const kk = Math.max(0, (k - delay) / (1 - delay));
            if (kk <= 0) continue;
            ctx.globalAlpha = (1 - kk) * 0.55;
            ctx.beginPath();
            ctx.arc(it.x, it.y, 4 + (1 - (1 - kk) ** 3) * 26 * scale, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      for (const it of pool) it.kind = 0;
      shake.t = -1e9;
    },
  };
}
