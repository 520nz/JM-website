import fs from 'fs';
import path from 'path';

const srcRoot = path.resolve(__dirname, '..');

function loadScript(relPath) {
  const abs = path.join(srcRoot, relPath);
  const code = fs.readFileSync(abs, 'utf8');
  const script = new Function(code);
  script();
}

global.loadScript = loadScript;

// ------------------------------------------------------------------
// 最小可用 indexedDB mock（纯内存 + 同步语义）
// 让 storage.js 里的 getDB / idbPut / idbGet / idbGetAll /
// idbClearAndPutAll 全部跑通，持久化逻辑对测试透明
// ------------------------------------------------------------------
function makeIDBMock() {
  const stores = {};
  function ensureStore(name) {
    if (!stores[name]) stores[name] = new Map();
    return stores[name];
  }

  const db = {
    _names: [],
    objectStoreNames: {
      contains(n) { return db._names.indexOf(n) !== -1; },
    },
    createObjectStore(name) {
      if (db._names.indexOf(name) === -1) db._names.push(name);
      ensureStore(name);
      return { put() {}, get() {}, getAll() {}, clear() {} };
    },
    transaction(storeName, mode) {
      const store = ensureStore(storeName);
      const tx = {
        objectStore() {
          return {
            put(value) {
              store.set(value.id, value);
              const req = {};
              queueMicrotask(() => { if (req.onsuccess) req.onsuccess(); tx.oncomplete && tx.oncomplete(); });
              return req;
            },
            get(key) {
              const req = {};
              queueMicrotask(() => { req.result = store.get(key); req.onsuccess && req.onsuccess(); });
              return req;
            },
            getAll() {
              const req = {};
              queueMicrotask(() => { req.result = Array.from(store.values()); req.onsuccess && req.onsuccess(); });
              return req;
            },
            clear() {
              store.clear();
              const req = {};
              queueMicrotask(() => { req.onsuccess && req.onsuccess(); tx.oncomplete && tx.oncomplete(); });
              return req;
            },
          };
        },
        oncomplete: null,
        onerror: null,
      };
      return tx;
    },
  };

  global.indexedDB = {
    open(name, version) {
      const req = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        result: db,
        error: null,
      };
      // 先触发 onupgradeneeded（storage.js 用它来建 store）
      queueMicrotask(() => {
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
        req.onsuccess && req.onsuccess({ target: req });
      });
      return req;
    },
  };
}

beforeAll(() => {
  makeIDBMock();

  global.window.App = global.window.App || {};
  global.App = global.window.App;

  if (!global.navigator) global.navigator = {};
  global.navigator.vibrate = () => {};
  global.navigator.clipboard = { writeText: () => Promise.resolve() };

  // 确保 Function 执行上下文能找到这些浏览器全局变量
  // vitest + jsdom 默认注入到 global，但显式再挂一次保险
  if (typeof window !== 'undefined') {
    for (const name of ['sessionStorage', 'localStorage', 'document', 'navigator', 'indexedDB']) {
      if (window[name] && !(name in globalThis)) {
        globalThis[name] = window[name];
      }
    }
  }
});

beforeEach(() => {
  global.window.App = {};
  global.App = global.window.App;
});

afterEach(() => {
  try { global.sessionStorage.clear(); } catch (e) {}
  try { global.localStorage.clear(); } catch (e) {}
});
