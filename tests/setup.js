// 为 jsdom 提供最小化的 IndexedDB 模拟，使 storage.js 的异步写入路径可预测。
class FakeIDBRequest {
  constructor(resultValue) {
    this.result = resultValue;
    this.onsuccess = null;
    this.onerror = null;
  }
  _fire() {
    if (this.onsuccess) this.onsuccess();
  }
}

class FakeIDBObjectStore {
  constructor(name) {
    this.name = name;
    this._data = new Map();
  }
  put(value) {
    this._data.set(value.id, value);
  }
  get(key) {
    const req = new FakeIDBRequest(this._data.get(key));
    setTimeout(() => req._fire(), 0);
    return req;
  }
  getAll() {
    const req = new FakeIDBRequest(Array.from(this._data.values()));
    setTimeout(() => req._fire(), 0);
    return req;
  }
  clear() {
    this._data.clear();
  }
}

class FakeIDBTransaction {
  constructor(store) {
    this._store = store;
    this.objectStore = () => this._store;
    this.oncomplete = null;
    this.onerror = null;
  }
  commit() {
    if (this.oncomplete) this.oncomplete();
  }
}

class FakeIDBDatabase {
  constructor() {
    this.objectStoreNames = {
      _names: new Set(),
      contains: function (n) { return this._names.has(n); }
    };
    this._stores = {};
  }
  createObjectStore(name, opts) {
    this.objectStoreNames._names.add(name);
    this._stores[name] = new FakeIDBObjectStore(name);
    return this._stores[name];
  }
  transaction(name, mode) {
    if (!this._stores[name]) this._stores[name] = new FakeIDBObjectStore(name);
    const tx = new FakeIDBTransaction(this._stores[name]);
    setTimeout(() => tx.commit(), 0);
    return tx;
  }
}

const fakeDB = new FakeIDBDatabase();

const indexedDBMock = {
  open: function (dbName, version) {
    const req = {
      result: fakeDB,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null
    };
    setTimeout(() => {
      if (req.onupgradeneeded) {
        req.onupgradeneeded({ target: req });
      }
      if (req.onsuccess) {
        req.onsuccess({ target: req });
      }
    }, 0);
    return req;
  }
};

window.indexedDB = indexedDBMock;
