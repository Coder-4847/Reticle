import { clamp } from '../engine/ease.js';

// Scoring is shared by the live HUD and the results so both always agree.
export const MISS_POINTS = -25;

/** 100 points per hit plus up to 100 for speed, relative to `refMs`. */
export function scoreHit(rt, refMs) {
  return 100 + Math.round(100 * clamp(1 - rt / refMs, 0, 1));
}

export function applyPoints(score, pts) {
  return Math.max(0, score + pts);
}

export function summarize(run) {
  let score = 0;
  let hits = 0;
  for (const s of run.shots) {
    score = applyPoints(score, s.pts);
    if (s.hit) hits++;
  }
  const shots = run.shots.length;
  const rts = [];
  let expired = 0;
  for (const t of run.targets) {
    if (t.hit) rts.push(t.rt);
    else if (t.endT !== null) expired++;
  }
  const sum = rts.reduce((a, b) => a + b, 0);
  return {
    score,
    hits,
    shots,
    misses: shots - hits,
    expired,
    accuracy: shots ? hits / shots : 0,
    avgRT: rts.length ? sum / rts.length : null,
    bestRT: rts.length ? Math.min(...rts) : null,
    worstRT: rts.length ? Math.max(...rts) : null,
  };
}
