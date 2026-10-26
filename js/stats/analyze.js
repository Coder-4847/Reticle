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
  const out = {
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
  if (run.track) {
    const errs = [];
    for (let i = 1; i < run.track.samples.length; i += 3) if (run.track.samples[i] >= 0) errs.push(run.track.samples[i]);
    out.score = run.track.score;
    out.accuracy = run.elapsed ? run.track.onMs / run.elapsed : 0;
    out.onMs = run.track.onMs;
    out.avgError = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null;
  }
  return out;
}

/** The headline numbers for a run, as display rows. */
export function resultRows(run, sum) {
  if (run.mode === 'tracking') {
    return [
      { label: 'On target', value: sum.accuracy * 100, decimals: 1, unit: '%' },
      { label: 'Time on target', value: sum.onMs / 1000, decimals: 1, unit: 's' },
      { label: 'Avg error', value: sum.avgError ?? NaN, unit: 'px' },
    ];
  }
  if (run.mode === 'reaction') {
    return [
      { label: 'Average', value: sum.avgRT ?? NaN, unit: 'ms' },
      { label: 'Best', value: sum.bestRT ?? NaN, unit: 'ms' },
      { label: 'Worst', value: sum.worstRT ?? NaN, unit: 'ms' },
      { label: 'Trials', value: sum.hits },
      { label: 'False starts', value: sum.misses },
      { label: 'Accuracy', value: sum.accuracy * 100, decimals: 1, unit: '%' },
    ];
  }
  return [
    { label: 'Accuracy', value: sum.accuracy * 100, decimals: 1, unit: '%' },
    { label: 'Avg reaction', value: sum.avgRT ?? NaN, unit: 'ms' },
    { label: 'Hits', value: sum.hits },
    { label: 'Misses', value: sum.misses },
    { label: 'Missed targets', value: sum.expired },
    { label: 'Shots', value: sum.shots },
  ];
}
