import { settings } from '../state/settings.js';
import { listRuns, importRuns, clearRuns } from '../state/store.js';
import { shapeStore } from '../targets/shapeStore.js';
import { backgroundImage } from '../ui/backgrounds.js';

const FORMAT = 'reticle-export';
const FORMAT_VERSION = 1;

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Everything: settings, custom shapes and the full run history. */
export async function buildExport() {
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: settings.snapshot(),
    shapes: shapeStore.list(),
    runs: await listRuns(),
  };
}

export async function exportAll() {
  download(`reticle-backup-${stamp()}.json`, JSON.stringify(await buildExport()));
}

export function exportRun(run) {
  download(`reticle-run-${run.mode}-${new Date(run.timestamp).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`, JSON.stringify(run, null, 2));
}

/** Restore from a backup object. Settings and shapes are replaced; runs are merged by id. */
export async function importData(data) {
  if (!data || data.format !== FORMAT || !Array.isArray(data.runs)) throw new Error('This is not a Reticle backup file.');
  if (data.settings) settings.replaceAll(data.settings);
  if (Array.isArray(data.shapes)) shapeStore.replaceAll(data.shapes);
  return importRuns(data.runs);
}

const CSV_COLUMNS = [
  ['id', (r) => r.id],
  ['date', (r) => new Date(r.timestamp).toISOString()],
  ['mode', (r) => r.mode],
  ['preset', (r) => r.summary.preset],
  ['duration_s', (r) => (r.duration ? r.duration / 1000 : '')],
  ['score', (r) => r.summary.score],
  ['accuracy_pct', (r) => (r.summary.accuracy * 100).toFixed(2)],
  ['hits', (r) => r.summary.hits],
  ['shots', (r) => r.summary.shots],
  ['misses', (r) => r.summary.misses],
  ['expired', (r) => r.summary.expired],
  ['avg_reaction_ms', (r) => (r.summary.avgRT === null ? '' : r.summary.avgRT.toFixed(1))],
  ['best_reaction_ms', (r) => r.summary.bestRT ?? ''],
  ['worst_reaction_ms', (r) => r.summary.worstRT ?? ''],
];

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCsv(runs) {
  const lines = [CSV_COLUMNS.map((c) => c[0]).join(',')];
  for (const r of runs) lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(r))).join(','));
  download(`reticle-history-${stamp()}.csv`, lines.join('\n'), 'text/csv');
}

export async function clearAll({ everything = false } = {}) {
  await clearRuns();
  if (!everything) return;
  settings.replaceAll({});
  shapeStore.replaceAll([]);
  await backgroundImage.clear();
}
