import { drawTarget } from '../targets/render.js';
import { hitTarget } from '../targets/hitTest.js';

const SAMPLE_MS = 50;

/**
 * Tracking: one target wanders along smooth curves. Score is the percentage of the
 * run spent with the crosshair on target (while holding the button, if hold-to-track is on).
 */
export function createTracking(game) {
  const c = game.config;
  const look = game.look;
  const p = game.pointer;
  const tg = { id: 0, x: 0, y: 0, r: c.size, rot: 0, spawn: 0 };
  // Flat [t, errorPx, onTarget] samples; stored on the run for the detailed report.
  const track = { holdToTrack: c.holdToTrack, onMs: 0, score: 0, samples: [] };
  let heading = 0;
  let turn = 0;
  let turnTarget = 0;
  let nextTurnAt = 0;
  let sampleAcc = 0;
  let errSum = 0;
  let errN = 0;
  let elapsed = 0;
  let on = false;

  function steer(t, dts) {
    if (t >= nextTurnAt) {
      turnTarget = (Math.random() * 2 - 1) * 3;
      if (Math.random() < 0.2) turnTarget *= 2.2; // occasional sharp direction change
      nextTurnAt = t + 350 + Math.random() * 900;
    }
    turn += (turnTarget - turn) * Math.min(1, dts * 5);
    const a = game.area();
    const margin = tg.r + Math.min(80, Math.min(a.w, a.h) * 0.15);
    let pull = 0;
    if (tg.x < a.x + margin || tg.x > a.x + a.w - margin || tg.y < a.y + margin || tg.y > a.y + a.h - margin) {
      const want = Math.atan2(a.y + a.h / 2 - tg.y, a.x + a.w / 2 - tg.x);
      const diff = Math.atan2(Math.sin(want - heading), Math.cos(want - heading));
      pull = diff * 5;
    }
    heading += (turn + pull) * dts;
    const speed = c.speed * (0.8 + 0.4 * (0.5 + 0.5 * Math.sin(t / 650)));
    tg.x = Math.min(a.x + a.w - tg.r, Math.max(a.x + tg.r, tg.x + Math.cos(heading) * speed * dts));
    tg.y = Math.min(a.y + a.h - tg.r, Math.max(a.y + tg.r, tg.y + Math.sin(heading) * speed * dts));
  }

  return {
    hudLabels: { a: 'On target', b: 'Time on', time: 'Time', c: 'Avg error' },
    start(t) {
      const a = game.area();
      tg.x = a.x + a.w / 2;
      tg.y = a.y + a.h / 2;
      heading = Math.random() * Math.PI * 2;
      game.recorder.run.track = track;
      game.recorder.targetSpawned(tg);
      elapsed = t;
    },
    update(t, dt) {
      steer(t, dt / 1000);
      const counting = !c.holdToTrack || p.down;
      const err = p.inside ? Math.hypot(p.x - tg.x, p.y - tg.y) : Infinity;
      on = counting && p.inside && hitTarget(tg, look.shape, p.x, p.y);
      if (on) track.onMs += dt;
      elapsed = t;
      track.score = elapsed > 0 ? Math.round((track.onMs / elapsed) * 1000) / 10 : 0;
      sampleAcc += dt;
      if (sampleAcc >= SAMPLE_MS) {
        sampleAcc -= SAMPLE_MS;
        const e = Number.isFinite(err) ? Math.round(err) : -1;
        track.samples.push(Math.round(t), e, on ? 1 : 0);
        if (e >= 0) { errSum += e; errN++; }
      }
    },
    shot: () => null,
    hud(out) {
      out.a = `${track.score.toFixed(1)}%`;
      out.b = `${(track.onMs / 1000).toFixed(1)}s`;
      out.c = errN ? `${Math.round(errSum / errN)}px` : '—';
    },
    draw(ctx) {
      if (on) {
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = look.hitColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tg.x, tg.y, tg.r * look.shape.bound + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      drawTarget(ctx, look, tg.x, tg.y, tg.r, 0, 1, 1, on ? look.hitColor : look.color);
    },
  };
}
