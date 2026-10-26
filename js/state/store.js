// Run history. Async API so the backing store can move to IndexedDB without touching callers.
const KEY = 'reticle.runs';
const CAP = 50;

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(runs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(runs));
    return true;
  } catch {
    return false;
  }
}

export async function saveRun(run) {
  const runs = read();
  runs.unshift(run);
  if (runs.length > CAP) runs.length = CAP;
  // On quota errors, drop the oldest half and try again.
  while (!write(runs) && runs.length > 1) runs.length = Math.ceil(runs.length / 2);
}

export async function listRuns() {
  return read();
}
