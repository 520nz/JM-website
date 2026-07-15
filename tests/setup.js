// Jest 测试环境设置
// 模拟浏览器环境

// 模拟 sessionStorage
const sessionStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = value;
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};
global.sessionStorage = sessionStorageMock;

// 模拟 indexedDB（完全同步实现）
class MockIDBDatabase {
  constructor(name) {
    this.name = name;
    this.objectStores = {};
  }
  
  get objectStoreNames() {
    return {
      contains: (storeName) => {
        return !!this.objectStores[storeName];
      }
    };
  }
  
  createObjectStore(storeName, options) {
    this.objectStores[storeName] = {
      keyPath: options?.keyPath || 'id',
      data: {}
    };
    return this.objectStores[storeName];
  }
  
  transaction(storeNames, mode) {
    const self = this;
    const tx = {
      objectStore: (storeName) => {
        const store = self.objectStores[storeName];
        if (!store) {
          // 自动创建如果不存在
          self.objectStores[storeName] = {
            keyPath: 'id',
            data: {}
          };
        }
        const actualStore = self.objectStores[storeName];
        return {
          put: (value) => {
            const key = value[actualStore.keyPath];
            actualStore.data[key] = value;
            return undefined;
          },
          get: (key) => ({
            result: actualStore.data[key] || null
          }),
          getAll: () => ({
            result: Object.values(actualStore.data)
          }),
          clear: () => {
            actualStore.data = {};
            return undefined;
          }
        };
      },
      oncomplete: null,
      onerror: null
    };
    
    // 立即触发 oncomplete
    Promise.resolve().then(() => {
      if (tx.oncomplete) tx.oncomplete();
    });
    
    return tx;
  }
}

const indexedDBMock = {
  databases: {},
  open(dbName, version) {
    const request = {
      result: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    };
    
    const isNew = !indexedDBMock.databases[dbName];
    
    // 同步初始化数据库
    if (isNew) {
      indexedDBMock.databases[dbName] = new MockIDBDatabase(dbName);
      request.result = indexedDBMock.databases[dbName];
      
      // 触发 onupgradeneeded（同步）
      if (request.onupgradeneeded) {
        request.onupgradeneeded({
          target: {
            result: indexedDBMock.databases[dbName]
          }
        });
      }
    } else {
      request.result = indexedDBMock.databases[dbName];
    }
    
    // 异步触发 onsuccess
    Promise.resolve().then(() => {
      if (request.onsuccess) {
        request.onsuccess({ target: request });
      }
    });
    
    return request;
  }
};
global.indexedDB = indexedDBMock;

// 清理函数
afterEach(() => {
  sessionStorageMock.clear();
  indexedDBMock.databases = {};
  global.App = {};
});