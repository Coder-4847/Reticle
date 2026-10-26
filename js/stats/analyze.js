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
      { label: 'Best', value: sum.bestRT ?? NaN, unit: 'ms', pb: 'bestRT' },
      { label: 'Worst', value: sum.worstRT ?? NaN, unit: 'ms' },
      { label: 'Trials', value: sum.hits },
      { label: 'False starts', value: sum.misses },
      { label: 'Accuracy', value: sum.accuracy * 100, decimals: 1, unit: '%' },
    ];
  }
  return [
    { label: 'Accuracy', value: sum.accuracy * 100, decimals: 1, unit: '%', pb: 'accuracy' },
    { label: 'Avg reaction', value: sum.avgRT ?? NaN, unit: 'ms' },
    { label: 'Best reaction', value: sum.bestRT ?? NaN, unit: 'ms', pb: 'bestRT' },
    { label: 'Worst reaction', value: sum.worstRT ?? NaN, unit: 'ms' },
    { label: 'Shots', value: sum.shots },
    { label: 'Hits', value: sum.hits },
    { label: 'Misses', value: sum.misses },
    { label: 'Missed targets', value: sum.expired },
  ];
}

/** Which personal bests `run` set, compared with earlier runs of the same mode and preset. */
export function personalBests(run, history) {
  const s = run.summary ?? summarize(run);
  const preset = s.preset;
  const prev = history.filter((r) => r.id !== run.id && r.mode === run.mode && r.timestamp < run.timestamp && r.summary?.preset === preset);
  if (!prev.length) return {};
  const max = (f) => Math.max(...prev.map(f));
  const rts = prev.map((r) => r.summary.bestRT).filter((v) => v !== null);
  return {
    score: s.score > max((r) => r.summary.score),
    accuracy: run.mode !== 'tracking' && s.shots > 0 && s.accuracy > max((r) => r.summary.accuracy),
    bestRT: s.bestRT !== null && rts.length > 0 && s.bestRT < Math.min(...rts),
  };
}

// ---------------------------------------------------------------------------
// Detailed analysis for the full report.

export function describe(values) {
  const n = values.length;
  if (!n) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const mid = n >> 1;
  const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const sd = Math.sqrt(sorted.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  return { n, mean, median, min: sorted[0], max: sorted[n - 1], sd };
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/** Histogram with a "nice" bin width aiming for ~12 bins. */
export function histogram(values, target = 12) {
  if (!values.length) return { bins: [], width: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const raw = Math.max(1, (max - min) / target);
  const width = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((w) => w >= raw) ?? Math.ceil(raw);
  const start = Math.floor(min / width) * width;
  const count = Math.max(1, Math.floor((max - start) / width) + 1);
  const bins = Array.from({ length: count }, (_, i) => ({ from: start + i * width, to: start + (i + 1) * width, n: 0 }));
  for (const v of values) bins[Math.min(count - 1, Math.floor((v - start) / width))].n++;
  return { bins, width };
}

const SECTORS = ['right', 'low-right', 'low', 'low-left', 'left', 'high-left', 'high', 'high-right'];

/** Compass name for a screen-space vector (y grows downward). */
export function direction(dx, dy) {
  const a = Math.atan2(dy, dx);
  return SECTORS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}

export function analyzeRun(run) {
  const sum = run.summary ?? summarize(run);
  const dur = run.elapsed || run.duration || 1;
  const W = run.area?.w || 1;
  const H = run.area?.h || 1;
  const out = { sum, dur, area: { w: W, h: H } };
  if (run.compact) return out;

  // Reaction times over the run
  const hitTargets = run.targets.filter((t) => t.hit && t.rt !== null).sort((a, b) => a.hitT - b.hitT);
  const rts = hitTargets.map((t) => t.rt);
  out.rt = describe(rts);
  out.rtSeries = hitTargets.map((t) => [t.hitT, t.rt]);
  out.rtHist = histogram(rts);
  const half = dur / 2;
  const firstHalf = hitTargets.filter((t) => t.hitT < half).map((t) => t.rt);
  const secondHalf = hitTargets.filter((t) => t.hitT >= half).map((t) => t.rt);
  out.halves = { first: mean(firstHalf), second: mean(secondHalf), n: Math.min(firstHalf.length, secondHalf.length) };

  // Throughput
  out.shotsPerSec = (sum.shots / dur) * 1000;
  out.targetsPerSec = (sum.hits / dur) * 1000;

  // Positions, normalized to the play area (0..1)
  out.hitPoints = run.shots.filter((s) => s.hit).map((s) => [s.x / W, s.y / H]);
  out.missPoints = run.shots.filter((s) => !s.hit).map((s) => [s.x / W, s.y / H]);

  // Precision: where on the target the hits land, in target radii
  const offsets = hitTargets.filter((t) => t.r > 0 && t.cx !== null).map((t) => [(t.cx - (t.hx ?? t.x)) / t.r, (t.cy - (t.hy ?? t.y)) / t.r]);
  out.offsets = offsets;
  out.offsetMean = offsets.length ? [mean(offsets.map((o) => o[0])), mean(offsets.map((o) => o[1]))] : null;
  out.normDist = mean(offsets.map(([x, y]) => Math.hypot(x, y)));

  // Misses: direction relative to the intended target, and over/undershoot along the flick
  const byId = new Map(run.targets.map((t) => [t.id, t]));
  const dirs = {};
  let over = 0;
  let under = 0;
  let lateral = 0;
  let prev = { x: W / 2, y: H / 2 };
  for (const s of run.shots) {
    const tg = byId.get(s.target);
    const tx = s.tx ?? tg?.x;
    const ty = s.ty ?? tg?.y;
    if (!s.hit && tg && tx !== undefined && tg.r > 0) {
      const ox = s.x - tx;
      const oy = s.y - ty;
      if (Math.hypot(ox, oy) < tg.r * 6) {
        const name = direction(ox, oy);
        dirs[name] = (dirs[name] || 0) + 1;
        const ax = tx - prev.x;
        const ay = ty - prev.y;
        const len = Math.hypot(ax, ay);
        if (len > tg.r * 2) {
          const along = (ox * ax + oy * ay) / len;
          if (along > tg.r * 0.3) over++;
          else if (along < -tg.r * 0.3) under++;
          else lateral++;
        }
      }
    }
    prev = s;
  }
  out.missDirs = dirs;
  out.flick = { over, under, lateral };

  // Accuracy by screen region (3x3, by where the target was)
  out.regions = Array.from({ length: 9 }, () => ({ hits: 0, total: 0 }));
  for (const t of run.targets) {
    if (!t.hit && t.endT === null) continue; // still alive when the run ended
    const col = Math.min(2, Math.max(0, Math.floor((t.x / W) * 3)));
    const row = Math.min(2, Math.max(0, Math.floor((t.y / H) * 3)));
    const cell = out.regions[row * 3 + col];
    cell.total++;
    if (t.hit) cell.hits++;
  }

  // Tracking: error trace and on-target share per half
  if (run.track) {
    const s = run.track.samples;
    const errSeries = [];
    const onHalves = [[0, 0], [0, 0]];
    for (let i = 0; i < s.length; i += 3) {
      if (s[i + 1] >= 0) errSeries.push([s[i], s[i + 1]]);
      const h = s[i] < half ? 0 : 1;
      onHalves[h][0] += s[i + 2];
      onHalves[h][1]++;
    }
    out.track = {
      errSeries,
      err: describe(errSeries.map((p) => p[1])),
      onFirst: onHalves[0][1] ? onHalves[0][0] / onHalves[0][1] : null,
      onSecond: onHalves[1][1] ? onHalves[1][0] / onHalves[1][1] : null,
    };
  }

  // Reaction mode: per-trial results with the false starts that preceded each
  if (run.mode === 'reaction') {
    let last = -Infinity;
    out.trials = hitTargets.map((t, i) => {
      const early = run.shots.filter((s) => !s.hit && s.t > last && s.t < t.hitT).length;
      last = t.hitT;
      return { n: i + 1, rt: t.rt, early };
    });
  }
  return out;
}
