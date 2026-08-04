// Jest 测试环境设置
require('fake-indexeddb/auto');

// structuredClone polyfill (Node.js 16及以下版本可能缺失)
if (typeof global.structuredClone !== 'function') {
  global.structuredClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    return JSON.parse(JSON.stringify(obj));
  };
}

// 模拟浏览器 API
global.localStorage = {
  store: {},
  getItem: function(key) { return this.store[key] || null; },
  setItem: function(key, value) { this.store[key] = String(value); },
  removeItem: function(key) { delete this.store[key]; },
  clear: function() { this.store = {}; }
};

global.sessionStorage = {
  store: {},
  getItem: function(key) { return this.store[key] || null; },
  setItem: function(key, value) { this.store[key] = String(value); },
  removeItem: function(key) { delete this.store[key]; },
  clear: function() { this.store = {}; }
};

// 模拟 navigator
Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'node.js',
    platform: 'node',
    vibrate: jest.fn()
  },
  writable: true
});

// 模拟 AudioContext
global.window.AudioContext = jest.fn().mockImplementation(() => ({
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
}));

global.window.webkitAudioContext = global.window.AudioContext;

// 全局变量
global.App = {};

// 加载模块
const fs = require('fs');
const path = require('path');

// 读取并执行 JS 文件
function loadJS(filePath) {
  const code = fs.readFileSync(path.join(__dirname, '..', filePath), 'utf-8');
  const script = new Function('window', 'document', 'navigator', code);
  script(global.window, global.document, global.navigator);
}

// 在每个测试前重置
beforeEach(() => {
  // 清空 IndexedDB
  if (global.indexedDB && global.indexedDB._databases) {
    global.indexedDB._databases.clear();
  }
  
  // 重置 App 命名空间
  global.App = {};
  
  // 重置 localStorage 和 sessionStorage
  global.localStorage.store = {};
  global.sessionStorage.store = {};
});