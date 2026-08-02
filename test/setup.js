// 测试环境设置
// 模拟浏览器全局对象
global.window = global;
global.document = document;
global.navigator = {
  vibrate: jest.fn(),
  clipboard: { writeText: jest.fn().mockResolvedValue() }
};
global.sessionStorage = {
  _data: {},
  getItem: function(k) { return this._data[k] || null; },
  setItem: function(k, v) { this._data[k] = String(v); },
  removeItem: function(k) { delete this._data[k]; }
};
global.indexedDB = {
  open: jest.fn(() => ({
    result: {
      createObjectStore: jest.fn(),
      objectStoreNames: { contains: jest.fn(() => false) }
    },
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null
  }))
};

// App 全局命名空间
global.App = {};

// 加载源文件的辅助函数
function loadSource(path) {
  const fs = require('fs');
  const code = fs.readFileSync(path, 'utf8');
  try {
    eval(code);
  } catch (e) {
    // 某些文件依赖 DOM，在纯逻辑测试中可能需要忽略
    console.warn(`加载 ${path} 时出错（可能是 DOM 依赖）: ${e.message}`);
  }
}

global.loadSource = loadSource;

// 重置 App 命名空间
function resetApp() {
  global.App = {
    QUESTION_BANK: [],
    db: {},
    store: {},
    session: {}
  };
}

global.resetApp = resetApp;
