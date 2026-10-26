const STEP = 1000 / 240; // fixed simulation step (ms)
const MAX_FRAME = 250; // clamp long frames so a hitch can't cause a spiral of updates

/** rAF loop: fixed-step `update(stepMs)` for simulation, `render(frameMs)` once per frame. */
export function createLoop({ update, render }) {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    let dt = now - last;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    if (dt < 0) dt = 0;
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render(dt);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get running() {
      return running;
    },
  };
}

/**
 * Pausable game clock in ms. Shares the performance.now() timebase, so event
 * timeStamps convert exactly with fromStamp().
 */
export function createClock() {
  let origin = 0;
  let pausedAt = null;

  return {
    start() {
      origin = performance.now();
      pausedAt = null;
    },
    now() {
      return (pausedAt ?? performance.now()) - origin;
    },
    fromStamp(ts) {
      // Guard against browsers that report epoch-based or zero timestamps.
      const valid = ts > 0 && Math.abs(ts - performance.now()) < 10000;
      return (valid ? ts : performance.now()) - origin;
    },
    pause() {
      if (pausedAt === null) pausedAt = performance.now();
    },
    resume() {
      if (pausedAt === null) return;
      origin += performance.now() - pausedAt;
      pausedAt = null;
    },
    get paused() {
      return pausedAt !== null;
    },
  };
}
