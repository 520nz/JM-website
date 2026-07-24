// 测试环境初始化：mock IndexedDB 和浏览器 API

// ---- Mock IndexedDB ----
class MockIDBRequest {
  constructor(result) {
    this.result = result;
  }
  addEventListener(type, handler) {
    if (type === 'success' && this.onsuccess) this.onsuccess({ target: this });
  }
}

class MockIDBObjectStore {
  constructor() {
    this._data = {};
  }
  put(value) {
    this._data[value.id || 'key'] = value;
  }
  get(key) {
    const req = new MockIDBRequest(this._data[key]);
    setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
    return req;
  }
  getAll() {
    const all = Object.values(this._data);
    const req = new MockIDBRequest(all);
    setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
    return req;
  }
  clear() {
    this._data = {};
    const req = new MockIDBRequest(undefined);
    setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
    return req;
  }
}

class MockIDBTransaction {
  constructor() {
    this._store = new MockIDBObjectStore();
  }
  objectStore() {
    return this._store;
  }
}

class MockIDBDatabase {
  constructor() {
    this._names = [];
    this.objectStoreNames = {
      contains: (n) => this._names.indexOf(n) !== -1,
      add: (n) => this._names.push(n)
    };
  }
  createObjectStore(name) {
    this.objectStoreNames.add(name);
    return new MockIDBObjectStore();
  }
  transaction() {
    const tx = new MockIDBTransaction();
    setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0);
    return tx;
  }
}

function createOpenDBRequest() {
  const req = {};
  setTimeout(() => {
    const db = new MockIDBDatabase();
    if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
    if (req.onsuccess) req.onsuccess({ target: { result: db } });
  }, 0);
  return req;
}

const mockIndexedDB = {
  open: () => createOpenDBRequest()
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

// ---- Mock sessionStorage ----
const sessionStore = {};
Object.defineProperty(global, 'sessionStorage', {
  value: {
    getItem: (k) => sessionStore[k] || null,
    setItem: (k, v) => { sessionStore[k] = String(v); },
    removeItem: (k) => { delete sessionStore[k]; }
  },
  writable: true
});

// ---- Mock navigator.vibrate ----
Object.defineProperty(global, 'navigator', {
  value: {
    vibrate: jest.fn(),
    clipboard: {
      writeText: jest.fn(() => Promise.resolve())
    }
  },
  writable: true
});

// ---- Reset App namespace before each test ----
beforeEach(() => {
  global.App = { QUESTION_BANK: [] };
  // 清理 sessionStorage
  Object.keys(sessionStore).forEach(k => delete sessionStore[k]);
});
