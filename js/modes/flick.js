import { createField } from './field.js';

/** Flick: targets appear at random spots; snap to each before its lifetime runs out. */
export function createFlick(game) {
  const c = game.config;
  const field = createField(game, {
    size: c.size, lifetime: c.lifetime, speed: c.speed, count: c.count, spawnDelay: c.spawnDelay, spread: true,
  });
  const ref = c.lifetime || 1200;

  return {
    start: (t) => field.fill(t),
    update(t, dt) {
      field.advance(t);
      field.move(dt);
    },
    shot: (x, y, t) => field.clickShot(x, y, t, ref),
    draw: (ctx, t) => field.draw(ctx, t),
  };
}
