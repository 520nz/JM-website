// Jest 测试环境设置
// 模拟浏览器环境中的全局对象

// 模拟 IndexedDB
const indexedDB = {
  open: jest.fn(() => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: {
      createObjectStore: jest.fn(),
      objectStoreNames: {
        contains: jest.fn(() => false)
      }
    }
  }))
};

// 模拟 sessionStorage
const sessionStorage = {
  store: {},
  getItem: jest.fn((key) => sessionStorage.store[key] || null),
  setItem: jest.fn((key, value) => { sessionStorage.store[key] = value; }),
  removeItem: jest.fn((key) => { delete sessionStorage.store[key]; }),
  clear: jest.fn(() => { sessionStorage.store = {}; })
};

// 模拟 localStorage
const localStorage = {
  store: {},
  getItem: jest.fn((key) => localStorage.store[key] || null),
  setItem: jest.fn((key, value) => { localStorage.store[key] = value; }),
  removeItem: jest.fn((key) => { delete localStorage.store[key]; }),
  clear: jest.fn(() => { localStorage.store = {}; })
};

// 模拟 navigator
const navigator = {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  },
  vibrate: jest.fn()
};

// 模拟 window 对象
global.indexedDB = indexedDB;
global.sessionStorage = sessionStorage;
global.localStorage = localStorage;
global.navigator = navigator;
global.Date.now = jest.fn(() => 1234567890000);

// 模拟 document
global.document = {
  createElement: jest.fn(() => ({
    setAttribute: jest.fn(),
    textContent: '',
    innerHTML: '',
    style: {},
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn()
    },
    appendChild: jest.fn(),
    remove: jest.fn()
  })),
  getElementById: jest.fn(() => ({
    textContent: '',
    innerHTML: '',
    value: '',
    style: {}
  })),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  addEventListener: jest.fn()
};

// 模拟 AudioContext
global.window = {
  AudioContext: jest.fn(() => ({
    createOscillator: jest.fn(() => ({
      type: 'sine',
      frequency: {
        setValueAtTime: jest.fn()
      },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn()
    })),
    createGain: jest.fn(() => ({
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn()
      },
      connect: jest.fn()
    })),
    destination: {},
    currentTime: 0
  })),
  webkitAudioContext: jest.fn()
};

// 抑制 console.error 在测试中的输出
console.error = jest.fn();

// 每个测试前重置模拟
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.store = {};
  localStorage.store = {};
});