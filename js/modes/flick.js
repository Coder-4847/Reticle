import { clamp, easeOutBack, easeOutCubic } from '../engine/ease.js';
import { scoreHit, MISS_POINTS } from '../stats/analyze.js';

const SPAWN_MS = 220;
const HIT_MS = 160;
const EXPIRE_MS = 260;
const TAU = Math.PI * 2;

/**
 * Flick: one target at a time at a random position. Hit it before its lifetime
 * runs out. `game` supplies settings, area(), recorder, burst() and motion.
 */
export function createFlick(game) {
  const { radius, lifetime } = game.settings.flick;
  const color = game.settings.targets.color;
  const fading = []; // targets playing their hit / expire animation
  let target = null;
  let nextId = 0;
  let lastX = null;
  let lastY = null;

  function spawn(t) {
    const a = game.area();
    const pad = radius + 6;
    const spanX = Math.max(0, a.w - pad * 2);
    const spanY = Math.max(0, a.h - pad * 2);
    const minDist = Math.min(a.w, a.h) * 0.2; // force a real flick between targets
    let x = 0;
    let y = 0;
    for (let i = 0; i < 16; i++) {
      x = a.x + pad + Math.random() * spanX;
      y = a.y + pad + Math.random() * spanY;
      if (lastX === null || Math.hypot(x - lastX, y - lastY) >= minDist) break;
    }
    lastX = x;
    lastY = y;
    target = { id: nextId++, x, y, r: radius, spawn: t, life: lifetime };
    game.recorder.targetSpawned(target);
  }

  function retire(tg, kind, t) {
    if (game.motion === 'off') return;
    fading.push({ x: tg.x, y: tg.y, r: tg.r, t, kind });
  }

  // Expire (and replace) the target if time `t` is past its lifetime.
  function expireUntil(t) {
    while (target && t >= target.spawn + target.life) {
      const end = target.spawn + target.life;
      game.recorder.targetExpired(target.id, end);
      retire(target, 'expire', end);
      spawn(end);
    }
  }

  function drawFading(ctx, t) {
    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      const dur = f.kind === 'hit' ? HIT_MS : EXPIRE_MS;
      const k = (t - f.t) / dur;
      if (k >= 1 || k < 0) {
        if (k >= 1) fading.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      if (f.kind === 'hit') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = color;
        ctx.arc(f.x, f.y, f.r * (1 - easeOutCubic(k)), 0, TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = (1 - k) * 0.55;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.arc(f.x, f.y, f.r * (1 - 0.35 * easeOutCubic(k)), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTarget(ctx, t) {
    const age = t - target.spawn;
    if (age < 0) return;
    const k = clamp(age / SPAWN_MS, 0, 1);
    let scale = 1;
    let alpha = 1;
    if (game.motion === 'full') scale = easeOutBack(k, 2.2);
    else if (game.motion === 'reduced') alpha = k;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.r * scale, 0, TAU);
    ctx.fill();

    // Lifetime ring: sweeps down as the target's time runs out.
    const remaining = 1 - clamp(age / target.life, 0, 1);
    ctx.globalAlpha = alpha * 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.r * scale + 6, -Math.PI / 2, -Math.PI / 2 + remaining * TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  return {
    start(t) {
      spawn(t);
    },
    update(t) {
      expireUntil(t);
    },
    /** Resolve a click at (x, y) at run time t. Returns { hit, pts }. */
    shot(x, y, t) {
      expireUntil(t);
      let hit = false;
      let pts = MISS_POINTS;
      let id = null;
      let dist = null;
      if (target && t >= target.spawn) {
        id = target.id;
        dist = Math.hypot(x - target.x, y - target.y);
        if (dist <= target.r) {
          hit = true;
          pts = scoreHit(t - target.spawn, target.life);
          game.recorder.targetHit(id, t, x, y, dist);
          retire(target, 'hit', t);
          game.burst(target.x, target.y, color);
          spawn(t);
        }
      }
      game.recorder.shot(t, x, y, hit, id, dist, pts);
      return { hit, pts };
    },
    draw(ctx, t) {
      drawFading(ctx, t);
      if (target) drawTarget(ctx, t);
    },
  };
}
