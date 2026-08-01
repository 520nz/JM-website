import fs from 'fs';
import path from 'path';

/**
 * 加载源文件并在全局上下文中执行（模拟浏览器环境）
 * @param {string} relativePath - 相对于项目根目录的路径
 */
export function loadSourceFile(relativePath) {
  const filePath = path.resolve(process.cwd(), relativePath);
  const code = fs.readFileSync(filePath, 'utf-8');
  // 在全局上下文中执行代码（文件中的 var App = window.App || {} 等将正常工作）
  const script = new vm.Script(code, { filename: relativePath });
  script.runInThisContext();
}

/**
 * Mock IndexedDB 实现（内存存储）
 */
export function mockIndexedDB() {
  const stores = {};

  class MockRequest {
    constructor() {
      this.onsuccess = null;
      this.onerror = null;
      this.result = null;
      this.error = null;
      this._result = null;
    }
    _complete(result) {
      this._result = result;
      this.result = result;
      if (this.onsuccess) {
        const event = { target: this };
        this.onsuccess(event);
      }
    }
    _fail(error) {
      this.error = error;
      if (this.onerror) {
        const event = { target: this, error: error };
        this.onerror(event);
      }
    }
  }

  class MockTransaction {
    constructor(storeName, mode, storeData) {
      this._storeName = storeName;
      this._mode = mode;
      this._storeData = storeData;
      this.oncomplete = null;
      this.onerror = null;
      this._completed = false;
    }
    objectStore(name) {
      return this._storeData[name];
    }
    _commit() {
      this._completed = true;
      if (this.oncomplete) this.oncomplete();
    }
  }

  class MockObjectStore {
    constructor(name) {
      this._name = name;
      this._data = new Map();
      this._keyPath = null;
    }
    get(key) {
      const req = new MockRequest();
      setTimeout(() => {
        const val = this._data.get(key) || undefined;
        req._complete(val);
      }, 0);
      return req;
    }
    getAll() {
      const req = new MockRequest();
      setTimeout(() => {
        const all = Array.from(this._data.values());
        req._complete(all);
      }, 0);
      return req;
    }
    put(value) {
      const req = new MockRequest();
      setTimeout(() => {
        const key = value.id;
        this._data.set(key, value);
        req._complete(key);
      }, 0);
      return req;
    }
    clear() {
      const req = new MockRequest();
      setTimeout(() => {
        this._data.clear();
        req._complete(undefined);
      }, 0);
      return req;
    }
  }

  function createDB(dbName, version, stores) {
    const storeMap = {};
    for (const name of stores) {
      storeMap[name] = new MockObjectStore(name);
    }

    const db = {
      name: dbName,
      version: version,
      objectStoreNames: stores,
      transaction(storeName, mode) {
        const tx = new MockTransaction(storeName, mode, storeMap);
        // 模拟事务自动提交
        setTimeout(() => tx._commit(), 0);
        return tx;
      },
      createObjectStore(name, options) {
        storeMap[name] = new MockObjectStore(name);
        return storeMap[name];
      }
    };

    return db;
  }

  const mockDB = createDB('jj_quiz_db', 1, ['userData', 'questionBank']);

  const mockIndexedDB = {
    open(dbName, version) {
      const req = new MockRequest();
      setTimeout(() => {
        const event = {
          target: {
            result: mockDB,
            result: mockDB
          }
        };
        // 如果有 onupgradeneeded，先调用
        if (mockIndexedDB._onupgradeneeded) {
          mockIndexedDB._onupgradeneeded(event);
        }
        req._complete(mockDB);
      }, 0);
      req._db = mockDB;
      return req;
    },
    _onupgradeneeded: null,
    _db: mockDB,
    _stores: stores
  };

  // 绑定 onupgradeneeded 到 open 调用
  const originalOpen = mockIndexedDB.open.bind(mockIndexedDB);
  mockIndexedDB.open = function(dbName, version) {
    const req = originalOpen(dbName, version);
    // 拦截 onupgradeneeded 的设置
    const handler = {
      set(target, prop, value) {
        if (prop === 'onupgradeneeded') {
          mockIndexedDB._onupgradeneeded = value;
          return true;
        }
        return Reflect.set(target, prop, value);
      }
    };
    return new Proxy(req, handler);
  };

  return mockIndexedDB;
}

/**
 * 加载题库数据 (data.js)
 */
export function loadQuestionBank() {
  loadSourceFile('js/data.js');
  return window.App.QUESTION_BANK;
}

/**
 * 模拟 Document.createElement 用于 XSS 转义
 */
export function setupDOMMock() {
  // jsdom 环境下 document.createElement 已经可用
  // 确保 document.createElement('div') 返回可用的元素
  if (typeof document !== 'undefined') {
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function(tag) {
      const el = origCreateElement(tag);
      // 确保 textContent 和 innerHTML 可用
      if (!el.textContent) el.textContent = '';
      if (!el.innerHTML) el.innerHTML = '';
      return el;
    };
  }
}
