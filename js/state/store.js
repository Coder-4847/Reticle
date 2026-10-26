import { runsDb } from './idb.js';
import { summarize } from '../stats/analyze.js';

// Run history. IndexedDB first, localStorage as a fallback. The newest FULL_DETAIL runs
// keep every target and shot; older runs are compacted to their summary.
const FULL_DETAIL = 50;
const LEGACY_KEY = 'reticle.runs'; // Phase 1-2 localStorage history, migrated on first load
const FALLBACK_KEY = 'reticle.runs.v2';

let cache = null; // newest first
let useIdb = true;
let loading = null;

export function buildSummary(run) {
  const s = summarize(run);
  return {
    score: s.score, accuracy: s.accuracy, hits: s.hits, shots: s.shots, misses: s.misses, expired: s.expired,
    avgRT: s.avgRT, bestRT: s.bestRT, worstRT: s.worstRT, onMs: s.onMs ?? null, avgError: s.avgError ?? null,
    preset: run.settings?.modes?.[run.mode]?.preset ?? 'standard',
    elapsed: run.elapsed || run.duration || 0,
  };
}

function withSummary(run) {
  if (!run.summary) run.summary = buildSummary(run);
  return run;
}

function compact(run) {
  if (run.compact) return run;
  const { targets, shots, track, ...rest } = run;
  return { ...rest, compact: true };
}

const byNewest = (a, b) => b.timestamp - a.timestamp;
const valid = (r) => r && typeof r.id === 'string' && typeof r.mode === 'string' && Number.isFinite(r.timestamp) &&
  (r.compact || (Array.isArray(r.targets) && Array.isArray(r.shots)));

function readLocal(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v.filter(valid) : [];
  } catch {
    return [];
  }
}

async function persist(changed) {
  if (useIdb) {
    try {
      await runsDb.putMany(changed);
      return;
    } catch {
      useIdb = false;
    }
  }
  // Fallback: the whole history in localStorage; shrink detail further if the quota is hit.
  let keep = FULL_DETAIL;
  for (;;) {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(cache.map((r, i) => (i < keep ? r : compact(r)))));
      return;
    } catch {
      if (keep === 0) return;
      keep = Math.floor(keep / 2);
    }
  }
}

/** Apply the detail cap; returns runs whose stored form changed. */
function enforceCap() {
  const changed = [];
  cache.forEach((r, i) => {
    if (i >= FULL_DETAIL && !r.compact) {
      cache[i] = compact(r);
      changed.push(cache[i]);
    }
  });
  return changed;
}

async function load() {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      let runs = [];
      try {
        runs = (await runsDb.all()).filter(valid);
      } catch {
        useIdb = false;
        runs = readLocal(FALLBACK_KEY);
      }
      const legacy = readLocal(LEGACY_KEY);
      cache = runs.map(withSummary).sort(byNewest);
      if (legacy.length) {
        const known = new Set(cache.map((r) => r.id));
        const fresh = legacy.filter((r) => !known.has(r.id)).map(withSummary);
        cache = [...cache, ...fresh].sort(byNewest);
        await persist([...fresh, ...enforceCap()]);
        try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
      }
      return cache;
    })();
  }
  return loading;
}

export async function saveRun(run) {
  await load();
  withSummary(run);
  cache.unshift(run);
  cache.sort(byNewest);
  await persist([run, ...enforceCap()]);
}

/** All runs, newest first. Treat the returned objects as read-only. */
export async function listRuns() {
  return [...(await load())];
}

export async function getRun(id) {
  return (await load()).find((r) => r.id === id) ?? null;
}

/** Merge runs in (same id = replaced). Returns the number of runs added or updated. */
export async function importRuns(runs) {
  await load();
  const incoming = runs.filter(valid).map(withSummary);
  const ids = new Set(incoming.map((r) => r.id));
  cache = [...cache.filter((r) => !ids.has(r.id)), ...incoming].sort(byNewest);
  enforceCap();
  await persist(cache);
  return incoming.length;
}

export async function clearRuns() {
  await load();
  cache = [];
  try { await runsDb.clear(); } catch { /* fallback below */ }
  try { localStorage.removeItem(FALLBACK_KEY); } catch { /* ignore */ }
}
