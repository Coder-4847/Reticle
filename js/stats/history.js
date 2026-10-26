import { MODES } from '../modes/index.js';
import { dayKey } from './plots.js';

// Pure helpers over the run history (each run carries a `summary`).
const DAY = 86400000;
export const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All time' },
];

export function filterRuns(runs, { range = 'all', mode = 'all', preset = 'all' }) {
  const since = range === 'all' ? -Infinity : Date.now() - Number(range) * DAY;
  return runs.filter((r) => r.timestamp >= since && (mode === 'all' || r.mode === mode) && (preset === 'all' || r.summary.preset === preset));
}

export function totals(runs) {
  let playMs = 0;
  let shots = 0;
  let hits = 0;
  const perMode = {};
  for (const r of runs) {
    playMs += r.summary.elapsed || 0;
    if (r.mode !== 'tracking') {
      shots += r.summary.shots;
      hits += r.summary.hits;
    }
    perMode[r.mode] = (perMode[r.mode] || 0) + 1;
  }
  const fav = Object.entries(perMode).sort((a, b) => b[1] - a[1])[0];
  return {
    runs: runs.length, playMs, shots, hits,
    accuracy: shots ? hits / shots : null,
    favorite: fav ? { mode: fav[0], runs: fav[1] } : null,
  };
}

export function formatDuration(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function dayCounts(runs) {
  const map = new Map();
  for (const r of runs) {
    const k = dayKey(r.timestamp);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

/** Consecutive days with at least one run. Current streak counts from today (or yesterday). */
export function streaks(runs) {
  const days = new Set(runs.map((r) => dayKey(r.timestamp)));
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  let cursor = noon.getTime();
  if (!days.has(dayKey(cursor))) cursor -= DAY;
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current++;
    cursor -= DAY;
  }
  const sorted = [...new Set(runs.map((r) => {
    const d = new Date(r.timestamp);
    d.setHours(12, 0, 0, 0);
    return d.getTime();
  }))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  sorted.forEach((t, i) => {
    run = i && Math.round((t - sorted[i - 1]) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return { current, best };
}

const PRESET_ORDER = ['beginner', 'standard', 'pro', 'insane', 'custom'];

/** Personal bests per mode and preset. */
export function bests(runs) {
  const groups = new Map();
  for (const r of runs) {
    const key = `${r.mode}|${r.summary.preset}`;
    if (!groups.has(key)) groups.set(key, { mode: r.mode, preset: r.summary.preset, runs: 0, score: -Infinity, accuracy: null, bestRT: null });
    const g = groups.get(key);
    g.runs++;
    g.score = Math.max(g.score, r.summary.score);
    if (r.mode !== 'tracking' && r.summary.shots) g.accuracy = Math.max(g.accuracy ?? 0, r.summary.accuracy);
    if (r.summary.bestRT !== null) g.bestRT = g.bestRT === null ? r.summary.bestRT : Math.min(g.bestRT, r.summary.bestRT);
  }
  const modeIndex = (m) => MODES.findIndex((x) => x.id === m);
  return [...groups.values()].sort((a, b) => modeIndex(a.mode) - modeIndex(b.mode) || PRESET_ORDER.indexOf(a.preset) - PRESET_ORDER.indexOf(b.preset));
}

export const SORTS = [
  { value: 'new', label: 'Newest', fn: (a, b) => b.timestamp - a.timestamp },
  { value: 'old', label: 'Oldest', fn: (a, b) => a.timestamp - b.timestamp },
  { value: 'score', label: 'Score', fn: (a, b) => b.summary.score - a.summary.score },
  { value: 'acc', label: 'Accuracy', fn: (a, b) => b.summary.accuracy - a.summary.accuracy },
];

/** Metric accessors for the progress graph. */
export const METRICS = {
  score: { label: 'Score', get: (r) => r.summary.score, format: (v) => Math.round(v).toLocaleString() },
  accuracy: { label: 'Accuracy', get: (r) => r.summary.accuracy * 100, format: (v) => `${v.toFixed(1)}%` },
  reaction: { label: 'Reaction', get: (r) => r.summary.avgRT, format: (v) => `${Math.round(v)} ms` },
};
