// IndexedDB wrapper: a key-value store (images, misc) and a "runs" store keyed by run id.
const DB_NAME = 'reticle';
const DB_VERSION = 2;
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const idb = {
  get: (key) => run('kv', 'readonly', (s) => s.get(key)),
  set: (key, value) => run('kv', 'readwrite', (s) => s.put(value, key)),
  del: (key) => run('kv', 'readwrite', (s) => s.delete(key)),
};

export const runsDb = {
  all: () => run('runs', 'readonly', (s) => s.getAll()),
  putMany: (runs) => run('runs', 'readwrite', (s) => {
    for (const r of runs) s.put(r);
  }),
  clear: () => run('runs', 'readwrite', (s) => s.clear()),
};
