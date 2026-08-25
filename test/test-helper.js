// test-helper.js - 测试辅助函数
const fs = require('fs');
const path = require('path');

function setupBrowserMocks() {
  // 通用的异步请求包装器
  function createAsyncRequest(result) {
    var req = {
      result: result,
      _onsuccess: null,
      _onerror: null,
      _ready: false
    };

    Object.defineProperty(req, 'onsuccess', {
      set: function(fn) {
        this._onsuccess = fn;
        if (!this._ready) {
          this._ready = true;
          var self = this;
          Promise.resolve().then(function() {
            if (self._onsuccess) {
              self._onsuccess({ target: { result: result } });
            }
          });
        }
      },
      get: function() { return this._onsuccess; }
    });

    Object.defineProperty(req, 'onerror', {
      set: function(fn) { this._onerror = fn; },
      get: function() { return this._onerror; }
    });

    return req;
  }

  // 通用的事务包装器
  function createTransactionResult() {
    var tx = {
      _oncomplete: null,
      _onerror: null,
      _store: null
    };

    Object.defineProperty(tx, 'oncomplete', {
      set: function(fn) {
        this._oncomplete = fn;
        var self = this;
        Promise.resolve().then(function() {
          if (self._oncomplete) {
            self._oncomplete();
          }
        });
      },
      get: function() { return this._oncomplete; }
    });

    Object.defineProperty(tx, 'onerror', {
      set: function(fn) { this._onerror = fn; },
      get: function() { return this._onerror; }
    });

    tx.objectStore = function() {
      if (!this._store) {
        this._store = {
          put: function() { return createAsyncRequest(null); },
          get: function() { return createAsyncRequest(null); },
          getAll: function() { return createAsyncRequest([]); },
          clear: function() {},
          openCursor: function() { return createAsyncRequest(null); },
          createIndex: function() {},
          delete: function() { return createAsyncRequest(null); }
        };
      }
      return this._store;
    };

    return tx;
  }

  // 模拟数据库
  var mockDB = {
    transaction: function(storeName, mode) {
      return createTransactionResult();
    },
    objectStoreNames: { 
      contains: function() { return true; },
      length: 0,
      item: function() { return null; }
    },
    createObjectStore: function() { return {}; },
    close: function() {},
    version: 1,
    name: 'mock_db'
  };

  // 模拟 IndexedDB
  global.indexedDB = {
    open: function(name, version) {
      return createAsyncRequest(mockDB);
    },
    deleteDatabase: function() {
      return createAsyncRequest(null);
    },
    cmp: function(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  };

  // 模拟 sessionStorage
  var _sessionStore = {};
  global.sessionStorage = {
    getItem: function(key) { return _sessionStore[key] || null; },
    setItem: function(key, value) { _sessionStore[key] = String(value); },
    removeItem: function(key) { delete _sessionStore[key]; },
    clear: function() { _sessionStore = {}; },
    length: 0
  };

  // 模拟 localStorage
  var _localStore = {};
  global.localStorage = {
    getItem: function(key) { return _localStore[key] || null; },
    setItem: function(key, value) { _localStore[key] = String(value); },
    removeItem: function(key) { delete _localStore[key]; },
    clear: function() { _localStore = {}; },
    length: 0
  };

  // 模拟 navigator
  global.navigator = global.navigator || {};
  global.navigator.vibrate = function() {};

  // 模拟 AudioContext
  global.AudioContext = function() { this.currentTime = 0; };
  global.AudioContext.prototype = {
    createOscillator: function() {
      return {
        type: '',
        frequency: { setValueAtTime: function() {}, exponentialRampToValueAtTime: function() {} },
        connect: function() { return { connect: function() { return { destination: {} }; } }; },
        start: function() {},
        stop: function() {}
      };
    },
    createGain: function() {
      return {
        gain: { setValueAtTime: function() {}, exponentialRampToValueAtTime: function() {} },
        connect: function() { return { destination: {} }; }
      };
    }
  };
  global.webkitAudioContext = global.AudioContext;

  // 模拟 URL
  global.URL = global.URL || {};
  global.URL.createObjectURL = function() { return 'blob:mock-url'; };
  global.URL.revokeObjectURL = function() {};

  // 模拟 Blob
  global.Blob = function() {};

  // 模拟 FileReader
  global.FileReader = function() {
    this.onload = null;
    this.result = null;
    this.onloadend = null;
  };
  global.FileReader.prototype.readAsText = function(file) {
    var self = this;
    setTimeout(function() {
      self.result = '{}';
      if (self.onload) {
        self.onload({ target: { result: '{}' } });
      }
      if (self.onloadend) {
        self.onloadend();
      }
    }, 0);
  };
}

function loadScripts() {
  global.App = {};
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8'));
  return global.App;
}

function loadQuizScripts() {
  loadScripts();
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'quiz.js'), 'utf8'));
  return global.App;
}

function loadAdminScripts() {
  loadScripts();
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'admin.js'), 'utf8'));
  return global.App;
}

function loadAllScripts() {
  loadScripts();
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'quiz.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'chart.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'admin.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8'));
  return global.App;
}

module.exports = {
  setupBrowserMocks: setupBrowserMocks,
  loadScripts: loadScripts,
  loadQuizScripts: loadQuizScripts,
  loadAdminScripts: loadAdminScripts,
  loadAllScripts: loadAllScripts
};
