import { scoreHit, MISS_POINTS } from '../stats/analyze.js';

const RESULT_MS = 1100;
const FALSE_MS = 1200;
const GO = '#38d996';
const EARLY = '#ff5d6c';
const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * Reaction: wait for the screen to turn green after a random 1-4 s delay, then click.
 * Clicking early is a false start: it costs points and the trial restarts.
 */
export function createReaction(game) {
  const N = game.config.trials;
  const rec = game.recorder;
  const rts = [];
  let trial = 0;
  let state = 'wait';
  let goAt = 0;
  let stateT = 0;
  let falseStarts = 0;
  let done = false;

  function arm(t) {
    state = 'wait';
    stateT = t;
    goAt = t + 1000 + Math.random() * 3000;
  }

  function advance(t) {
    if (state === 'wait' && t >= goAt) {
      state = 'go';
      stateT = goAt;
      const v = game.view();
      rec.targetSpawned({ id: trial, x: v.w / 2, y: v.h / 2, r: 0, spawn: goAt });
    } else if (state === 'result' && t >= stateT + RESULT_MS) {
      if (trial >= N) done = true;
      else arm(t);
    } else if (state === 'false' && t >= stateT + FALSE_MS) {
      arm(t);
    }
  }

  function text(ctx, str, y, size, color, weight = 650) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(str, game.view().w / 2, y);
  }

  return {
    hudLabels: { a: 'Average', b: 'Best', time: 'Trial', c: 'Last', d: 'False starts' },
    quietStart: true, // no "Go" banner: the mode has its own wait-for-green start
    start: arm,
    update: advance,
    isDone: () => done,
    shot(x, y, t) {
      advance(t);
      if (state === 'wait') {
        falseStarts++;
        rec.shot(t, x, y, false, null, null, MISS_POINTS);
        state = 'false';
        stateT = t;
        return { hit: false, pts: MISS_POINTS };
      }
      if (state !== 'go') return null;
      const rt = t - goAt;
      const pts = scoreHit(rt, 600);
      rec.targetHit(trial, t, x, y, 0, rt);
      rec.shot(t, x, y, true, trial, 0, pts);
      rts.push(rt);
      trial++;
      state = 'result';
      stateT = t;
      return { hit: true, pts };
    },
    hud(out) {
      const avg = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
      out.a = avg === null ? '—' : `${Math.round(avg)}ms`;
      out.b = rts.length ? `${Math.round(Math.min(...rts))}ms` : '—';
      out.c = rts.length ? `${Math.round(rts[rts.length - 1])}ms` : '—';
      out.d = String(falseStarts);
      out.time = `${Math.min(trial + 1, N)}/${N}`;
      out.progress = 1 - trial / N;
    },
    draw(ctx) {
      const { w, h } = game.view();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (state === 'go') {
        ctx.fillStyle = GO;
        ctx.fillRect(0, 0, w, h);
        text(ctx, 'Click!', h / 2, 72, '#06140d', 750);
      } else if (state === 'false') {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = EARLY;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        text(ctx, 'Too early', h / 2 - 10, 56, EARLY);
        text(ctx, 'Wait for green. This trial restarts.', h / 2 + 40, 16, '#a6adb6', 450);
      } else if (state === 'result') {
        text(ctx, `${Math.round(rts[rts.length - 1])} ms`, h / 2 - 10, 72, '#eef1f4', 700);
        text(ctx, trial >= N ? 'Done' : `Trial ${trial} of ${N}`, h / 2 + 44, 16, '#a6adb6', 450);
      } else {
        text(ctx, 'Wait for green…', h / 2, 36, '#a6adb6', 600);
      }
    },
  };
}
