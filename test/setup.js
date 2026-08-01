import { beforeEach } from 'vitest';

// 带正确回调机制的 IndexedDB mock
// 请求在创建时立即执行并存储结果，onsuccess 仅作为通知
// 交易追踪所有请求，在所有请求完成后触发 oncomplete

class MockRequest {
  constructor(execFn, onDone) {
    this._result = undefined;
    this._onDone = onDone || (() => {});
    this._pendingOnSuccess = null;
    this._pendingOnError = null;
    this._done = false;
    this._execFn = execFn;
    // 立即执行请求（模拟同步操作）
    this._execute();
  }
  _execute() {
    try {
      this._execFn(this);
      this._done = true;
      // 通知交易此请求已完成
      this._onDone();
    } catch (e) {
      this._error = e;
    }
  }
  get onsuccess() { return this._pendingOnSuccess; }
  set onsuccess(fn) {
    this._pendingOnSuccess = fn;
    if (this._done && fn) {
      // 请求已完成，立即回调
      Promise.resolve().then(() => fn({ target: this }));
    }
  }
  get onerror() { return this._pendingOnError; }
  set onerror(fn) { this._pendingOnError = fn; }
  get result() { return this._result; }
  set result(v) { this._result = v; }
}

class MockTransaction {
  constructor(store) {
    this._store = store;
    this._oncomplete = null;
    this._onerror = null;
    this._completed = false;
    this._pendingRequests = 0;
  }

  objectStore(name) {
    const self = this;
    return {
      get(key) {
        self._pendingRequests++;
        return new MockRequest((req) => {
          req._result = self._store._data.get(key) || undefined;
        }, () => self._requestDone());
      },
      getAll() {
        self._pendingRequests++;
        return new MockRequest((req) => {
          req._result = Array.from(self._store._data.values());
        }, () => self._requestDone());
      },
      put(value) {
        self._pendingRequests++;
        self._store._data.set(value.id, value);
        return new MockRequest((req) => {
          req._result = value.id;
        }, () => self._requestDone());
      },
      clear() {
        self._pendingRequests++;
        self._store._data.clear();
        return new MockRequest((req) => {
          req._result = undefined;
        }, () => self._requestDone());
      }
    };
  }

  _requestDone() {
    this._pendingRequests--;
    if (this._pendingRequests <= 0 && this._oncomplete) {
      this._fireComplete();
    }
  }

  get oncomplete() { return this._oncomplete; }
  set oncomplete(fn) {
    this._oncomplete = fn;
    // 检查是否已完成（可能所有请求都已同步完成）
    Promise.resolve().then(() => {
      if (this._pendingRequests <= 0 && !this._completed) {
        this._fireComplete();
      }
    });
  }

  get onerror() { return this._onerror; }
  set onerror(fn) { this._onerror = fn; }

  _fireComplete() {
    if (!this._completed) {
      this._completed = true;
      Promise.resolve().then(() => {
        if (this._oncomplete) this._oncomplete();
      });
    }
  }
}

class MockObjectStore {
  constructor() {
    this._data = new Map();
  }
}

class MockDB {
  constructor() {
    this._stores = {};
    this.objectStoreNames = [];
  }
  transaction(storeName, mode) {
    const store = this._stores[storeName] || new MockObjectStore();
    if (!this._stores[storeName]) {
      this._stores[storeName] = store;
    }
    return new MockTransaction(store);
  }
  createObjectStore(name, options) {
    if (!this._stores[name]) {
      this._stores[name] = new MockObjectStore();
      this.objectStoreNames.push(name);
    }
    return this._stores[name];
  }
}

// 为数组添加 contains 方法（IDBDatabase 接口需要）
if (!Array.prototype.contains) {
  Array.prototype.contains = function(value) {
    return this.indexOf(value) !== -1;
  };
}

let _mockDB = null;

function getMockDB() {
  if (!_mockDB) {
    _mockDB = new MockDB();
  }
  return _mockDB;
}

// 确保全局 indexedDB 存在且支持回调
globalThis.indexedDB = {
  open(dbName, version) {
    const db = getMockDB();
    const request = {
      _upgrading: false,
      _pendingOnSuccess: null,
      _pendingOnUpgradeNeeded: null,
      get onsuccess() { return this._pendingOnSuccess; },
      set onsuccess(fn) {
        this._pendingOnSuccess = fn;
        if (!this._executed) {
          this._executed = true;
          // 使用微任务模拟异步
          Promise.resolve().then(() => {
            // 先触发 onupgradeneeded（由 storage.js 中的处理器创建 store）
            if (!this._upgrading) {
              this._upgrading = true;
              if (this._pendingOnUpgradeNeeded) {
                this._pendingOnUpgradeNeeded({ target: { result: db } });
              }
            }
            if (fn) fn({ target: request });
          });
        }
      },
      get onupgradeneeded() { return this._pendingOnUpgradeNeeded; },
      set onupgradeneeded(fn) { this._pendingOnUpgradeNeeded = fn; },
      result: db,
      _executed: false
    };
    return request;
  },
  deleteDatabase() {
    return { onsuccess: null, onerror: null };
  }
};

beforeEach(() => {
  _mockDB = null;
  if (typeof window !== 'undefined') {
    window.App = {};
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
});

export function resetMockDB() {
  _mockDB = null;
}
