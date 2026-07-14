// 测试环境设置
// 模拟 localStorage 和 sessionStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true
});

// 模拟 document.createElement 和 DOM API
global.document = {
  createElement: jest.fn((tagName) => {
    const element = {
      tagName: tagName.toUpperCase(),
      textContent: '',
      innerHTML: '',
      classList: {
        classes: new Set(),
        add: function(cls) { this.classes.add(cls); },
        remove: function(cls) { this.classes.delete(cls); },
        contains: function(cls) { return this.classes.has(cls); }
      },
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(() => null),
      getElementById: jest.fn(() => null),
      addEventListener: jest.fn()
    };
    return element;
  }),
  querySelectorAll: jest.fn(() => []),
  querySelector: jest.fn(() => null),
  getElementById: jest.fn(() => null),
  addEventListener: jest.fn()
};

// 模拟 window 对象
global.window = {
  addEventListener: jest.fn()
};

// 确保全局变量可在模块间共享
// 在 Node.js 中，var 声明的变量不会自动成为全局变量
// 需要手动将需要的变量暴露到 global 对象上

// 清理每个测试之间的状态
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// 在全局导出辅助函数，用于从文件中提取全局变量
global.extractGlobals = (code) => {
  // 执行代码并提取全局变量
  const fn = new Function('window', 'document', 'localStorage', 'sessionStorage', code);
  fn(global.window, global.document, global.localStorage, global.sessionStorage);
};