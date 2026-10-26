import { clamp, easeOutBack, easeOutCubic } from '../engine/ease.js';
import { hitTarget } from '../targets/hitTest.js';
import { drawTarget } from '../targets/render.js';
import { scoreHit, MISS_POINTS } from '../stats/analyze.js';

const SPAWN_MS = 220;
const HIT_MS = 170;
const EXPIRE_MS = 260;
const OVERSHOOT = 1.5;
const TAU = Math.PI * 2;

/**
 * A set of live click targets that spawn, expire, move, and refill themselves.
 * opts: { size, lifetime, speed, count, spawnDelay, record = true, spread = false,
 *         place(r, field) -> {x, y}, killTime = false }
 * `killTime` measures reaction from the previous hit instead of from spawn (Gridshot).
 */
export function createField(game, opts) {
  const look = game.look;
  const live = [];
  const fading = [];
  const pending = []; // due times of scheduled spawns, ascending
  let nextId = 0;
  let last = null;
  let lastHitT = 0;
  const field = { live, lastRemoved: null };

  const reachOf = (r) => r * look.shape.bound;

  function randomPlace(r) {
    const a = game.area();
    const pad = reachOf(r) + 4;
    const minFlick = opts.spread ? Math.min(a.w, a.h) * 0.2 : 0;
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 30; i++) {
      const x = a.x + pad + Math.random() * Math.max(0, a.w - pad * 2);
      const y = a.y + pad + Math.random() * Math.max(0, a.h - pad * 2);
      let score = Infinity;
      for (const o of live) score = Math.min(score, Math.hypot(x - o.x, y - o.y) - reachOf(o.r) - reachOf(r) - 10);
      if (last && minFlick) score = Math.min(score, Math.hypot(x - last.x, y - last.y) - minFlick);
      if (score >= 0) return { x, y };
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return best;
  }

  function spawn(t) {
    const r = Math.max(4, opts.size * (1 + (Math.random() * 2 - 1) * look.variation));
    const p = opts.place ? opts.place(r, field) : randomPlace(r);
    const angle = Math.random() * TAU;
    const tg = {
      id: nextId++, x: p.x, y: p.y, r,
      rot: look.rotate ? Math.random() * TAU : 0,
      spawn: t, life: opts.lifetime || 0,
      vx: Math.cos(angle) * opts.speed, vy: Math.sin(angle) * opts.speed,
    };
    live.push(tg);
    last = tg;
    if (opts.record !== false) game.recorder.targetSpawned(tg);
    game.onSpawn?.(tg);
    return tg;
  }

  function remove(tg, kind, t) {
    const i = live.indexOf(tg);
    if (i < 0) return;
    live.splice(i, 1);
    field.lastRemoved = tg;
    if (game.motion !== 'off') fading.push({ x: tg.x, y: tg.y, r: tg.r, rot: tg.rot, t, kind });
    pending.push(t + (opts.spawnDelay || 0));
    pending.sort((a, b) => a - b);
  }

  /** Process expiries and scheduled spawns, in time order, up to time t. */
  field.advance = (t) => {
    for (;;) {
      let exp = null;
      for (const tg of live) if (tg.life && (!exp || tg.spawn + tg.life < exp.spawn + exp.life)) exp = tg;
      const expT = exp ? exp.spawn + exp.life : Infinity;
      const spawnT = pending.length ? pending[0] : Infinity;
      if (Math.min(expT, spawnT) > t) return;
      if (spawnT <= expT) {
        spawn(pending.shift());
      } else {
        if (opts.record !== false) game.recorder.targetExpired(exp.id, expT);
        remove(exp, 'expire', expT);
      }
    }
  };

  field.fill = (t) => {
    for (let i = 0; i < opts.count; i++) spawn(t);
  };

  /** Move targets by their velocity, bouncing off the play area. */
  field.move = (dtMs) => {
    if (!opts.speed) return;
    const a = game.area();
    const dt = dtMs / 1000;
    for (const tg of live) {
      const pad = reachOf(tg.r);
      tg.x += tg.vx * dt;
      tg.y += tg.vy * dt;
      if (tg.x < a.x + pad) { tg.x = a.x + pad; tg.vx = Math.abs(tg.vx); }
      if (tg.x > a.x + a.w - pad) { tg.x = a.x + a.w - pad; tg.vx = -Math.abs(tg.vx); }
      if (tg.y < a.y + pad) { tg.y = a.y + pad; tg.vy = Math.abs(tg.vy); }
      if (tg.y > a.y + a.h - pad) { tg.y = a.y + a.h - pad; tg.vy = -Math.abs(tg.vy); }
    }
  };

  // Visual scale during the spawn pop. Never below 1 for hit testing: the full target always counts,
  // and while the overshoot draws it larger, the larger area counts too.
  const spawnScale = (tg, t) => (game.motion === 'full' ? easeOutBack(clamp((t - tg.spawn) / SPAWN_MS, 0, 1), OVERSHOOT) : 1);

  /** Topmost live target under (x, y) that already existed at time t. */
  field.hitTest = (x, y, t) => {
    for (let i = live.length - 1; i >= 0; i--) {
      const tg = live[i];
      if (tg.spawn <= t && hitTarget(tg, look.shape, x, y, Math.max(1, spawnScale(tg, t)))) return tg;
    }
    return null;
  };

  field.nearest = (x, y, filter) => {
    let best = null;
    let bestD = Infinity;
    for (const tg of live) {
      if (filter && !filter(tg)) continue;
      const d = Math.hypot(x - tg.x, y - tg.y);
      if (d < bestD) { bestD = d; best = tg; }
    }
    return best ? { tg: best, dist: bestD } : null;
  };

  /** Register a hit: record it, burst, and schedule the replacement. Returns { rt, dist }. */
  field.hit = (tg, t, x, y) => {
    const dist = Math.hypot(x - tg.x, y - tg.y);
    const rt = Math.max(0, t - (opts.killTime ? Math.max(tg.spawn, lastHitT) : tg.spawn));
    lastHitT = t;
    if (opts.record !== false) game.recorder.targetHit(tg.id, t, x, y, dist, rt);
    remove(tg, 'hit', t);
    game.burst(tg.x, tg.y, look.hitColor);
    return { rt, dist };
  };

  /** Standard click resolution for modes where any live target counts. */
  field.clickShot = (x, y, t, refMs) => {
    field.advance(t);
    const tg = field.hitTest(x, y, t);
    if (tg) {
      const { rt, dist } = field.hit(tg, t, x, y);
      const pts = scoreHit(rt, refMs);
      game.recorder.shot(t, x, y, true, tg.id, dist, pts);
      return { hit: true, pts };
    }
    const near = field.nearest(x, y);
    game.recorder.shot(t, x, y, false, near ? near.tg.id : null, near ? near.dist : null, MISS_POINTS);
    return { hit: false, pts: MISS_POINTS };
  };

  /** style: { colorOf(tg), ringOf(tg) -> { start, life } | null } */
  field.draw = (ctx, t, style = {}) => {
    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      const k = (t - f.t) / (f.kind === 'hit' ? HIT_MS : EXPIRE_MS);
      if (k >= 1) { fading.splice(i, 1); continue; }
      if (k < 0) continue;
      if (f.kind === 'hit') drawTarget(ctx, look, f.x, f.y, f.r, f.rot, 1 - easeOutCubic(k), 1 - k, look.hitColor);
      else drawTarget(ctx, look, f.x, f.y, f.r, f.rot, 1 - 0.35 * easeOutCubic(k), (1 - k) * 0.4);
    }
    for (const tg of live) {
      const age = t - tg.spawn;
      if (age < 0) continue;
      const scale = spawnScale(tg, t);
      const alpha = game.motion === 'reduced' ? clamp(age / SPAWN_MS, 0, 1) : 1;
      const color = style.colorOf ? style.colorOf(tg) : look.color;
      drawTarget(ctx, look, tg.x, tg.y, tg.r, tg.rot, scale, alpha, color);
      const ring = style.ringOf ? style.ringOf(tg) : tg.life ? { start: tg.spawn, life: tg.life } : null;
      if (ring) {
        const remaining = 1 - clamp((t - ring.start) / ring.life, 0, 1);
        ctx.globalAlpha = alpha * 0.35;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tg.x, tg.y, reachOf(tg.r) * scale + 6, -Math.PI / 2, -Math.PI / 2 + remaining * TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  };

  return field;
}
