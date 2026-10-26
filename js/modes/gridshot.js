import { createField } from './field.js';

const COLS = 5;
const ROWS = 4;

/** Gridshot: a fixed number of targets on a slot grid; each hit spawns a replacement in a free slot. */
export function createGridshot(game) {
  const c = game.config;

  function place(r, field) {
    const a = game.area();
    const cell = Math.min(a.w / COLS, a.h / ROWS);
    const ox = a.x + (a.w - cell * COLS) / 2 + cell / 2;
    const oy = a.y + (a.h - cell * ROWS) / 2 + cell / 2;
    const free = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = ox + col * cell;
        const y = oy + row * cell;
        const taken = field.live.some((tg) => Math.hypot(tg.x - x, tg.y - y) < cell * 0.6);
        const justLeft = field.lastRemoved && Math.hypot(field.lastRemoved.x - x, field.lastRemoved.y - y) < cell * 0.6;
        if (!taken && !justLeft) free.push({ x, y });
      }
    }
    return free.length ? free[Math.floor(Math.random() * free.length)] : { x: ox, y: oy };
  }

  const field = createField(game, {
    size: c.size, lifetime: c.lifetime, speed: c.speed, count: c.count, spawnDelay: 0, place, killTime: true,
  });

  return {
    start: (t) => field.fill(t),
    update(t, dt) {
      field.advance(t);
      field.move(dt);
    },
    shot: (x, y, t) => field.clickShot(x, y, t, 900),
    draw: (ctx, t) => field.draw(ctx, t),
  };
}
