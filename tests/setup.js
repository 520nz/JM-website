// Jest setup file
// 模拟 localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// 模拟 alert
global.alert = jest.fn();

// 模拟 confirm
global.confirm = jest.fn(() => true);

// 模拟 URL.createObjectURL 和 URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// 模拟 document.createElement 返回的 a 元素
const originalCreateElement = document.createElement.bind(document);
document.createElement = jest.fn((tagName) => {
  const element = originalCreateElement(tagName);
  if (tagName === 'a') {
    element.click = jest.fn();
  }
  return element;
});

// 清理函数
afterEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});
