// Jest 全局设置 - 模拟浏览器环境

// 模拟 IndexedDB - 关键：open 后立即触发 onsuccess
var mockDB = {
  result: {},
  transaction: function() {
    return {
      objectStore: function() {
        return {
          put: function() { return { result: null }; },
          get: function() { return { result: null }; },
          getAll: function() { return { result: [] }; },
          clear: function() {}
        };
      },
      oncomplete: null,
      onerror: null
    };
  },
  objectStoreNames: { contains: function() { return true; } }
};

global.indexedDB = {
  open: function(name, version) {
    var request = {
      result: mockDB,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    };
    // 模拟异步：设置 onsuccess 后立即触发
    setTimeout(function() {
      if (request.onsuccess) {
        request.onsuccess({ target: { result: mockDB } });
      }
    }, 0);
    return request;
  },
  deleteDatabase: function() {}
};

// 模拟 sessionStorage
if (!global.sessionStorage) {
  var _sessionStore = {};
  global.sessionStorage = {
    getItem: function(key) { return _sessionStore[key] || null; },
    setItem: function(key, value) { _sessionStore[key] = value; },
    removeItem: function(key) { delete _sessionStore[key]; },
    clear: function() { for (var k in _sessionStore) delete _sessionStore[k]; }
  };
}

// 模拟 navigator
if (!global.navigator) {
  global.navigator = {
    vibrate: function() {}
  };
}

// 模拟 AudioContext
global.AudioContext = function() {
  this.currentTime = 0;
};
global.AudioContext.prototype.createOscillator = function() {
  return {
    type: '',
    frequency: { setValueAtTime: function() {}, exponentialRampToValueAtTime: function() {} },
    connect: function() { return { connect: function() { return { destination: {} }; } }; },
    start: function() {},
    stop: function() {}
  };
};
global.AudioContext.prototype.createGain = function() {
  return {
    gain: { setValueAtTime: function() {}, exponentialRampToValueAtTime: function() {} },
    connect: function() { return { destination: {} }; }
  };
};

global.webkitAudioContext = global.AudioContext;

// 模拟 URL
global.URL.createObjectURL = function() { return 'blob:mock-url'; };
global.URL.revokeObjectURL = function() {};

// 模拟 Blob
global.Blob = function() {};

// 模拟 FileReader
global.FileReader = function() {
  this.onload = null;
  this.result = null;
};
global.FileReader.prototype.readAsText = function(file) {
  var self = this;
  setTimeout(function() {
    if (self.onload) {
      self.result = '{}';
      self.onload({ target: { result: '{}' } });
    }
  }, 0);
};

// 模拟 setTimeout/setInterval
global.setTimeout = function(cb) {
  if (typeof cb === 'function') cb();
  return 1;
};
global.setInterval = function(cb) {
  if (typeof cb === 'function') cb();
  return 1;
};
global.clearTimeout = function() {};
global.clearInterval = function() {};

// 模拟 requestAnimationFrame
global.requestAnimationFrame = function(cb) { if (cb) cb(); return 1; };
