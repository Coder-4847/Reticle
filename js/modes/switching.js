import { createField } from './field.js';
import { scoreHit, MISS_POINTS } from '../stats/analyze.js';

const INACTIVE = '#5b6270';

/**
 * Target switching: several targets on screen, only the highlighted one counts.
 * Each activation is recorded as one target, so reaction time = time to re-target.
 */
export function createSwitching(game) {
  const c = game.config;
  const field = createField(game, {
    size: c.size, lifetime: 0, speed: c.speed, count: Math.max(2, c.count), spawnDelay: 0, spread: true, record: false,
  });
  const rec = game.recorder;
  let active = null;
  let since = 0;
  let actId = -1;
  let nextAct = 0;

  function activate(t, exclude) {
    const options = field.live.filter((tg) => tg !== exclude);
    if (!options.length) { active = null; return; }
    active = options[Math.floor(Math.random() * options.length)];
    since = t;
    actId = nextAct++;
    rec.targetSpawned({ id: actId, x: active.x, y: active.y, r: active.r, spawn: t, life: c.lifetime || null });
  }

  function checkExpiry(t) {
    if (c.lifetime && active && t >= since + c.lifetime) {
      const end = since + c.lifetime;
      rec.targetExpired(actId, end);
      activate(end, active);
    }
  }

  return {
    start(t) {
      field.fill(t);
      activate(t, null);
    },
    update(t, dt) {
      checkExpiry(t);
      field.advance(t);
      field.move(dt);
      if (!active) activate(t, null);
    },
    shot(x, y, t) {
      checkExpiry(t);
      const tg = field.hitTest(x, y, t);
      if (tg && tg === active) {
        const dist = Math.hypot(x - tg.x, y - tg.y);
        const rt = Math.max(0, t - since);
        const pts = scoreHit(rt, c.lifetime || 1000);
        rec.targetHit(actId, t, x, y, dist, rt, tg.x, tg.y);
        rec.shot(t, x, y, true, actId, dist, pts, tg.x, tg.y);
        field.hit(tg, t, x, y);
        activate(t, null);
        field.advance(t); // spawn the replacement (it starts inactive)
        return { hit: true, pts };
      }
      const dist = active ? Math.hypot(x - active.x, y - active.y) : null;
      rec.shot(t, x, y, false, active ? actId : null, dist, MISS_POINTS, active?.x ?? null, active?.y ?? null);
      return { hit: false, pts: MISS_POINTS };
    },
    draw(ctx, t) {
      field.draw(ctx, t, {
        colorOf: (tg) => (tg === active ? game.look.color : INACTIVE),
        ringOf: (tg) => (tg === active && c.lifetime ? { start: since, life: c.lifetime } : null),
      });
    },
  };
}
