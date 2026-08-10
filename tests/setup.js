import { beforeEach } from 'vitest';
import fs from 'fs';

const _indexedDBStores = new Map();

function createDBObject(storeMap) {
  return {
    objectStoreNames: { contains: () => true },
    createObjectStore(name, opts) {
      if (!storeMap.has(name)) storeMap.set(name, new Map());
      return { name };
    },
    transaction(storeName, mode) {
      let store = storeMap.get(storeName);
      if (!store) { store = new Map(); storeMap.set(storeName, store); }

      const pendingOps = [];
      let oncompleteCb = null;
      let onerrorCb = null;

      const tx = {
        objectStore() {
          return {
            _s: store,
            put(val) { pendingOps.push(() => { store.set(val.id, val); }); return {}; },
            clear() { pendingOps.push(() => { store.clear(); }); return {}; },
            get(key) {
              const result = store.get(key);
              return {
                onsuccess: null,
                onerror: null,
                result: result,
                _fire() { if (this.onsuccess) this.onsuccess({ target: this }); },
              };
            },
            getAll() {
              const result = Array.from(store.values());
              return {
                onsuccess: null,
                onerror: null,
                result: result,
                _fire() { if (this.onsuccess) this.onsuccess({ target: this }); },
              };
            },
          };
        },
        get oncomplete() { return oncompleteCb; },
        set oncomplete(cb) {
          oncompleteCb = cb;
          setTimeout(() => {
            for (const op of pendingOps) op();
            if (oncompleteCb) oncompleteCb();
          }, 0);
        },
        get onerror() { return onerrorCb; },
        set onerror(cb) { onerrorCb = cb; },
      };
      return tx;
    },
  };
}

beforeEach(() => {
  if (global.App) delete global.App;
  global.App = {};

  try { sessionStorage.clear(); } catch(e) {}
  global.navigator = { vibrate: () => false };

  _indexedDBStores.clear();

  global.indexedDB = {
    open(name, version) {
      const dbKey = `${name}_${version}`;
      if (!_indexedDBStores.has(dbKey)) {
        _indexedDBStores.set(dbKey, new Map());
      }
      const storeMap = _indexedDBStores.get(dbKey);
      const db = createDBObject(storeMap);

      let onsuccessCb = null;
      let onerrorCb = null;
      let onupgradeCb = null;
      let fired = false;
      let pendingOnsuccess = null;

      function fireOnce() {
        if (fired) return;
        fired = true;
        setTimeout(() => {
          if (pendingOnsuccess) pendingOnsuccess({ target: req });
        }, 0);
      }

      const req = {
        get result() { return db; },
        get error() { return null; },
        get onsuccess() { return onsuccessCb; },
        set onsuccess(cb) {
          onsuccessCb = cb;
          pendingOnsuccess = cb;
          fireOnce();
        },
        get onerror() { return onerrorCb; },
        set onerror(cb) { onerrorCb = cb; },
        get onupgradeneeded() { return onupgradeCb; },
        set onupgradeneeded(cb) {
          onupgradeCb = cb;
          // Upgrade fires before success; after upgrade, schedule success
          setTimeout(() => {
            if (onupgradeCb) onupgradeCb({ target: req });
            fireOnce();
          }, 0);
        },
      };
      return req;
    },
  };
});

global.__loadCode = fs.readFileSync;
