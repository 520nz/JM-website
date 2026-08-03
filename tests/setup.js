// Jest 测试环境设置

// 初始化 App 命名空间
global.App = {};

// 模拟浏览器环境
global.localStorage = {
  store: {},
  getItem: function(key) {
    return this.store[key] || null;
  },
  setItem: function(key, value) {
    this.store[key] = value;
  },
  removeItem: function(key) {
    delete this.store[key];
  },
  clear: function() {
    this.store = {};
  }
};

global.sessionStorage = {
  store: {},
  getItem: function(key) {
    return this.store[key] || null;
  },
  setItem: function(key, value) {
    this.store[key] = value;
  },
  removeItem: function(key) {
    delete this.store[key];
  },
  clear: function() {
    this.store = {};
  }
};

// 模拟 IndexedDB
global.indexedDB = {
  open: jest.fn().mockImplementation(() => {
    const result = {
      result: {
        createObjectStore: jest.fn(),
        objectStoreNames: {
          contains: jest.fn(() => false)
        },
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            put: jest.fn(),
            get: jest.fn(),
            clear: jest.fn()
          }),
          oncomplete: null,
          onerror: null
        })
      },
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null
    };
    
    setTimeout(() => {
      if (result.onsuccess) {
        result.onsuccess({ target: result });
      }
    }, 0);
    
    return result;
  })
};

// 模拟 document
const mockElement = {
  textContent: '',
  innerHTML: '',
  style: {},
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn()
  },
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  setAttribute: jest.fn(),
  addEventListener: jest.fn()
};

global.document = {
  createElement: jest.fn().mockImplementation((tag) => {
    const el = { ...mockElement };
    // 特殊处理：用于 XSS 转义的 div
    if (tag === 'div') {
      el._text = '';
      Object.defineProperty(el, 'textContent', {
        get() { return this._text; },
        set(val) { this._text = val; }
      });
      Object.defineProperty(el, 'innerHTML', {
        get() { 
          return this._text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        },
        set(val) { this._text = val; }
      });
    }
    return el;
  }),
  getElementById: jest.fn().mockReturnValue({ ...mockElement }),
  querySelectorAll: jest.fn().mockReturnValue([]),
  querySelector: jest.fn().mockReturnValue({ ...mockElement }),
  addEventListener: jest.fn()
};

// 模拟 window 对象
global.window = {
  App: global.App,
  AudioContext: jest.fn(),
  webkitAudioContext: jest.fn(),
  Date: Date,
  navigator: {
    vibrate: jest.fn(),
    clipboard: {
      writeText: jest.fn().mockResolvedValue(true)
    }
  },
  setTimeout: setTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval
};

// Mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn().mockReturnValue({
    type: 'sine',
    frequency: {
      setValueAtTime: jest.fn()
    },
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn()
  }),
  createGain: jest.fn().mockReturnValue({
    gain: {
      setValueAtTime: jest.fn(),
      exponentialRampToValueAtTime: jest.fn()
    },
    connect: jest.fn()
  }),
  destination: {},
  currentTime: 0
}));

global.navigator = {
  vibrate: jest.fn(),
  clipboard: {
    writeText: jest.fn().mockResolvedValue(true)
  }
};

// Suppress console logs in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};