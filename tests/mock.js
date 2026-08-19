// 浏览器 API Mock - 为 Node.js 测试环境提供完整的浏览器 API 模拟

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '\n': '\n',
  '\r': '\r',
  '\t': '\t'
};

function escapeHTML(str) {
  return String(str).replace(/[&<>"'\n\r\t]/g, ch => ESCAPE_MAP[ch] || ch);
}

class MockClassList {
  constructor() { this._set = new Set(); }
  add(...classes) { classes.forEach(c => this._set.add(c)); }
  remove(...classes) { classes.forEach(c => this._set.delete(c)); }
  contains(c) { return this._set.has(c); }
  toggle(c, force) {
    if (force !== undefined) {
      if (force) this._set.add(c); else this._set.delete(c);
      return force;
    }
    if (this._set.has(c)) { this._set.delete(c); return false; }
    this._set.add(c); return true;
  }
  get length() { return this._set.size; }
  clear() { this._set.clear(); }
  toString() { return [...this._set].join(' '); }
}

class MockStyle {
  constructor() {
    const proxy = new Proxy({}, {
      set(target, prop, value) {
        target[prop] = String(value);
        return true;
      },
      get(target, prop) {
        return target[prop] || '';
      }
    });
    return proxy;
  }
}

class MockElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this._id = '';
    this._textContent = '';
    this._innerHTML = '';
    this._style = new MockStyle();
    this._classList = new MockClassList();
    this._handlers = {};
    this._parent = null;
    this._offsetHeight = 100;
    this.dataset = {};
    this._isView = false;
    this._isNav = false;
    this._isErrorItem = false;
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.maxLength = -1;
    this.placeholder = '';
    this.type = '';
    this.files = [];
  }
  get textContent() { return this._textContent; }
  set textContent(v) {
    this._textContent = String(v);
    this._innerHTML = escapeHTML(v);
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v);
    const idRegex = /id\s*=\s*["']([^"']+)["']/g;
    let match;
    while ((match = idRegex.exec(this._innerHTML)) !== null) {
      const id = match[1];
      if (id && !mockDoc.getElementById(id)) {
        const el = new MockElement('div');
        el.id = id;
        mockDoc._registerElement(id, el);
        this.children.push(el);
      }
    }
  }
  get style() { return this._style; }
  get id() { return this._id; }
  set id(v) { this._id = String(v); }
  get className() { return this._classList.toString(); }
  set className(v) {
    this._classList.clear();
    if (v) {
      v.split(/\s+/).forEach(c => {
        if (c) this._classList.add(c);
      });
    }
  }
  get classList() { return this._classList; }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'data-view') this._isView = true;
    if (k === 'data-nav') this._isNav = true;
  }
  getAttribute(k) { return this.attributes[k] || null; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  }
  removeEventListener(event, handler) {
    if (this._handlers[event]) {
      this._handlers[event] = this._handlers[event].filter(h => h !== handler);
    }
  }
  dispatchEvent(event) {
    const handlers = this._handlers[event.type] || [];
    handlers.forEach(h => h(event));
  }
  appendChild(child) {
    child._parent = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) { this.children.splice(idx, 1); child._parent = null; }
    return child;
  }
  insertBefore(newChild, refChild) {
    const idx = this.children.indexOf(refChild);
    if (idx >= 0) {
      newChild._parent = this;
      this.children.splice(idx, 0, newChild);
    } else {
      this.appendChild(newChild);
    }
    return newChild;
  }
  querySelectorAll(selector) {
    if (selector === '.view' && this._isView) return [this];
    if (selector === '.nav-item' && this._isNav) return [this];
    if (selector === '.error-item' && this._isErrorItem) return [this];
    return [];
  }
  querySelector(selector) { return null; }
  get offsetHeight() { return this._offsetHeight; }
  click() { this.dispatchEvent({ type: 'click' }); }
  focus() {}
  blur() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}

// Canvas Context Mock
function createCanvasContext() {
  const ctx = new Proxy(function() {}, {
    get(target, prop) {
      if (prop === 'createLinearGradient') {
        return () => ({
          addColorStop() {},
          get addColorStop() { return () => {}; }
        });
      }
      if (prop === 'fillRect') return () => {};
      if (prop === 'fillText') return () => {};
      if (prop === 'strokeText') return () => {};
      if (prop === 'beginPath') return () => {};
      if (prop === 'moveTo') return () => {};
      if (prop === 'lineTo') return () => {};
      if (prop === 'stroke') return () => {};
      if (prop === 'arc') return () => {};
      if (prop === 'fill') return () => {};
      if (prop === 'clearRect') return () => {};
      if (prop === 'scale') return () => {};
      if (prop === 'set fillStyle') return undefined;
      if (prop === 'set strokeStyle') return undefined;
      if (prop === 'set font') return undefined;
      if (prop === 'set textAlign') return undefined;
      if (prop === 'set lineWidth') return undefined;
      if (prop === 'set globalAlpha') return undefined;
      if (prop === 'measureText') return (text) => ({ width: text.length * 8 });
      if (prop === 'roundRect') return () => {};
      return () => createCanvasContext();
    }
  });
  return ctx;
}

// Document Mock
function createMockDocument() {
  const elements = {};

  function createElement(tag) {
    const el = new MockElement(tag);
    if (tag === 'canvas') {
      el.width = 0;
      el.height = 0;
      el.getContext = () => createCanvasContext();
      el.toBlob = (callback, type) => { callback(new Blob()); };
    }
    if (tag === 'select') {
      el.options = [];
      Object.defineProperty(el, 'value', {
        get() { return el._selValue || ''; },
        set(v) { el._selValue = v; }
      });
      el.addEventListener('change', () => {});
    }
    if (tag === 'input') {
      Object.defineProperty(el, 'value', {
        get() { return el._inputValue || ''; },
        set(v) { el._inputValue = v; }
      });
      Object.defineProperty(el, 'files', {
        get() { return el._files || []; }
      });
    }
    if (tag === 'textarea') {
      Object.defineProperty(el, 'value', {
        get() { return el._taValue || ''; },
        set(v) { el._taValue = v; }
      });
    }
    if (tag === 'button') {
      // button has default click behavior
    }
    return el;
  }

  const doc = {
    createElement,
    getElementById(id) { return elements[id] || null; },
    _registerElement(id, el) { elements[id] = el; },
    _clearElements() { for (const k in elements) delete elements[k]; },
    querySelectorAll(selector) {
      const results = [];
      for (const k in elements) {
        const el = elements[k];
        if (selector === '.view' && el._isView) results.push(el);
        if (selector === '.nav-item' && el._isNav) results.push(el);
        if (selector === '.error-item' && el._isErrorItem) results.push(el);
      }
      return results;
    },
    querySelector(selector) {
      for (const k in elements) {
        const el = elements[k];
        if (selector === '.theme-toggle') return el;
      }
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
    body: new MockElement('body'),
    head: new MockElement('head'),
    documentElement: (() => {
      const el = new MockElement('html');
      return el;
    })(),
    createTextNode(text) { return { textContent: text, nodeType: 3 }; },
    createDocumentFragment() { return { children: [], appendChild() {}, nodeType: 11 }; },
    createEvent() { return { initEvent() {} }; }
  };

  return doc;
}

// Storage Mock
class MockStorage {
  constructor() { this._data = {}; }
  getItem(k) { return this._data[k] || null; }
  setItem(k, v) { this._data[k] = String(v); }
  removeItem(k) { delete this._data[k]; }
  clear() { this._data = {}; }
  key(i) { return Object.keys(this._data)[i] || null; }
  get length() { return Object.keys(this._data).length; }
}

// IndexedDB Mock
class MockIDBRequest {
  constructor(result, error) {
    this.result = result || null;
    this.error = error || null;
    this.onsuccess = null;
    this.onerror = null;
    this.onupgradeneeded = null;
    this._fire();
  }
  _fire() {
    if (this.error) {
      if (this.onerror) this.onerror({ target: this });
    } else {
      if (this.onsuccess) this.onsuccess({ target: this });
    }
  }
  // For transaction requests
  get transaction() { return this._tx || null; }
  set transaction(v) { this._tx = v; }
}

class MockIDBTransaction {
  constructor(db, mode) {
    this._db = db;
    this._mode = mode;
    this._stores = {};
    this.oncomplete = null;
    this.onerror = null;
    this._completed = false;
  }
  objectStore(name) {
    if (!this._stores[name]) {
      this._stores[name] = new Map();
    }
    return this._stores[name];
  }
  _complete() {
    this._completed = true;
    if (this.oncomplete) this.oncomplete();
  }
}

class MockObjectStore {
  constructor(name) {
    this._name = name;
    this._data = new Map();
    this._tx = null;
    this.indexNames = {};
    this.keyPath = null;
    this.autoIncrement = false;
  }
  put(value) {
    const key = value.id;
    this._data.set(key, value);
    const req = new MockIDBRequest(value);
    req.transaction = this._tx;
    return req;
  }
  get(key) {
    const value = this._data.get(key) || null;
    return new MockIDBRequest(value);
  }
  getAll() {
    const values = Array.from(this._data.values());
    return new MockIDBRequest(values);
  }
  clear() {
    this._data.clear();
    return new MockIDBRequest(null);
  }
  add(value) { return this.put(value); }
  delete(key) {
    this._data.delete(key);
    return new MockIDBRequest(null);
  }
  openCursor() { return new MockIDBRequest(null); }
  createIndex() { return {}; }
  deleteIndex() {}
}

class MockIndexedDB {
  constructor() {
    this._databases = new Map();
  }
  open(dbName, version) {
    const self = this;
    const existing = this._databases.get(dbName);
    const db = existing || { _stores: new Map() };

    const req = new MockIDBRequest(null);
    req.result = db;

    // Setup onupgradeneeded
    const originalOnSuccess = req.onsuccess;
    req.onsuccess = null;

    // Fire upgradeneeded first if new DB
    if (!existing) {
      req.onupgradeneeded = function(e) {
        const database = e.target.result;
        database.createObjectStore = function(name, options) {
          if (!database._stores.has(name)) {
            database._stores.set(name, new MockObjectStore(name));
          }
          return database._stores.get(name);
        };
        database.objectStoreNames = {
          contains(name) { return database._stores.has(name); }
        };
      };
      // Fire upgradeneeded
      req._fireUpgradeneeded();
    }

    req.onsuccess = function(e) {
      const dbRef = e.target.result;
      dbRef.transaction = function(storeNames, mode) {
        const tx = new MockIDBTransaction(dbRef, mode);
        if (typeof storeNames === 'string') storeNames = [storeNames];
        storeNames.forEach(name => {
          if (!dbRef._stores.has(name)) {
            dbRef._stores.set(name, new MockObjectStore(name));
          }
        });
        tx._stores = dbRef._stores;
        // Patch objectStore to return our MockObjectStore
        tx.objectStore = function(name) {
          return dbRef._stores.get(name);
        };
        return tx;
      };
      dbRef.close = function() {};
      dbRef.objectStoreNames = {
        contains(name) { return dbRef._stores.has(name); }
      };
      self._databases.set(dbName, dbRef);
      if (originalOnSuccess) originalOnSuccess(e);
    };

    req._fireUpgradeneeded = function() {
      if (req.onupgradeneeded) {
        req.onupgradeneeded({ target: req });
      }
    };

    // Fire onsuccess asynchronously
    setImmediate(() => {
      if (!existing) {
        req._fireUpgradeneeded();
      }
      if (req.onsuccess) {
        req.onsuccess({ target: req });
      }
    });

    return req;
  }
  deleteDatabase(dbName) {
    this._databases.delete(dbName);
    return new MockIDBRequest(null);
  }
}

// AudioContext Mock
class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
    this._state = 'running';
  }
  createOscillator() {
    return {
      connect() { return {}; },
      disconnect() {},
      start() {},
      stop() {},
      type: 'sine',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }
    };
  }
  createGain() {
    return {
      connect() { return {}; },
      disconnect() {},
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }
    };
  }
  createBuffer() { return {}; }
  decodeAudioData(data, success, error) { if (success) success({}); }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

// Navigator Mock
const mockNavigator = {
  vibrate() {},
  clipboard: {
    writeText(text) { return Promise.resolve(); }
  },
  userAgent: 'node.js',
  platform: 'Linux',
  language: 'zh-CN'
};

// --- 初始化全局环境 ---

const mockDoc = createMockDocument();
const mockSessionStorage = new MockStorage();
const mockLocalStorage = new MockStorage();
const mockIndexedDB = new MockIndexedDB();

const eventListeners = {};
global.App = {};
global.window = {
  App: global.App,
  addEventListener(event, handler) {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(handler);
  },
  removeEventListener(event, handler) {
    if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter(h => h !== handler);
    }
  },
  dispatchEvent(event) {
    if (eventListeners[event]) {
      eventListeners[event].forEach(h => h({ type: event }));
    }
  },
  requestAnimationFrame(cb) { return setTimeout(cb, 16); },
  cancelAnimationFrame(id) { return clearTimeout(id); }
};
global.document = mockDoc;
global.sessionStorage = mockSessionStorage;
global.localStorage = mockLocalStorage;
global.indexedDB = mockIndexedDB;
global.navigator = mockNavigator;
global.AudioContext = MockAudioContext;
global.webkitAudioContext = MockAudioContext;
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;
global.setInterval = setInterval;
global.clearInterval = clearInterval;

// DOM 初始化：预注册视图和导航元素
function setupDOMElements() {
  const views = ['home', 'practice', 'wrongbook', 'stats', 'admin', 'category'];
  views.forEach(v => {
    const el = new MockElement('div');
    el.id = 'view-' + v;
    el._isView = true;
    mockDoc._registerElement('view-' + v, el);
  });

  const navs = ['home', 'practice', 'wrongbook', 'stats', 'admin'];
  navs.forEach(n => {
    const el = new MockElement('div');
    el.classList.add('nav-item');
    el.setAttribute('data-view', n);
    mockDoc._registerElement('nav-' + n, el);
  });

  // 常用元素
  const commonIds = [
    'quizArea', 'categoryList', 'wrongBookList', 'wrongBookBtn',
    'todayCount', 'todayAcc', 'streakBadge', 'goalProgress', 'goalTarget', 'goalBar',
    'sTotal', 'sCorrect', 'sAcc', 'sWrong', 'catStats', 'trendChart',
    'achvGrid', 'achvCount', 'timerVal', 'fb', 'fbTitle', 'fbDesc',
    'nextBtn', 'practiceView',
    'categoryFilter', 'editCategory', 'searchInput', 'questionList',
    'modalTitle', 'editId', 'editQuestion', 'editOptions', 'editAnswer', 'editExplanation',
    'editModal', 'resetModal', 'resetConfirmInput', 'resetConfirmBtn',
    'progressBar', 'progressBarBg',
    'loadingOverlay'
  ];
  commonIds.forEach(id => {
    const el = new MockElement('div');
    el.id = id;
    mockDoc._registerElement(id, el);
  });

  // 主题切换按钮
  const themeBtn = new MockElement('button');
  themeBtn.className = 'theme-toggle';
  themeBtn.textContent = '🌙';
  mockDoc._registerElement('themeBtn', themeBtn);

  return mockDoc;
}

module.exports = {
  mockDoc,
  mockSessionStorage,
  mockLocalStorage,
  mockIndexedDB,
  mockNavigator,
  MockElement,
  MockStorage,
  MockObjectStore,
  MockIDBTransaction,
  MockIDBRequest,
  createCanvasContext,
  setupDOMElements,
  escapeHTML
};
