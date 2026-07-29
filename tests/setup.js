// Jest DOM 扩展
require('@testing-library/jest-dom');

// Mock IndexedDB
const indexedDB = {
  open: jest.fn(),
};

// Mock sessionStorage
const sessionStorage = {
  store: {},
  getItem: jest.fn((key) => sessionStorage.store[key] || null),
  setItem: jest.fn((key, value) => {
    sessionStorage.store[key] = value;
  }),
  removeItem: jest.fn((key) => {
    delete sessionStorage.store[key];
  }),
  clear: jest.fn(() => {
    sessionStorage.store = {};
  }),
};

// Mock navigator
const navigator = {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
  vibrate: jest.fn(),
};

// Mock AudioContext
class MockAudioContext {
  constructor() {
    this.currentTime = 0;
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(),
    };
  }
  get destination() {
    return {};
  }
}

// 设置全局 mocks
global.indexedDB = indexedDB;
global.sessionStorage = sessionStorage;
global.navigator = navigator;
global.window = {
  AudioContext: MockAudioContext,
  webkitAudioContext: MockAudioContext,
  devicePixelRatio: 1,
  addEventListener: jest.fn(),
};
global.document = {
  createElement: jest.fn(() => ({
    textContent: '',
    innerHTML: '',
    style: {},
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
    },
  })),
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  addEventListener: jest.fn(),
};
global.Date = class extends Date {
  constructor(...args) {
    if (args.length === 0) {
      super('2024-01-15T12:00:00.000Z');
    } else {
      super(...args);
    }
  }
  static now() {
    return 1705316400000; // 2024-01-15 12:00:00 UTC
  }
};
global.alert = jest.fn();
global.confirm = jest.fn(() => true);
global.prompt = jest.fn();
global.URL = {
  createObjectURL: jest.fn(() => 'blob:test'),
  revokeObjectURL: jest.fn(),
};
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
  }
};
global.FileReader = class FileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
  readAsText(file) {
    setTimeout(() => {
      if (this.onload) {
        this.result = file.content || '{}';
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
};
global.File = class File {
  constructor(bits, name, options) {
    this.name = name;
    this.type = options?.type || '';
    this.content = bits[0];
  }
};

// 清理函数
afterEach(() => {
  jest.clearAllMocks();
  sessionStorage.store = {};
});