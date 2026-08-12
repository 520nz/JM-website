// 浏览器环境 shim —— 在 Node.js 中提供最小 window/document/indexedDB/sessionStorage
// 用于加载前端 JS 模块后执行单元测试
// 核心策略：IndexedDB 所有操作通过微任务自动 resolve，sessionStorage 真实存储

'use strict';

function createBrowserShim() {
  const listeners = {};

  const _sessionImpl = {};
  const makeStorage = () => ({
    getItem: (k) => (k in _sessionImpl ? _sessionImpl[k] : null),
    setItem: (k, v) => { _sessionImpl[k] = String(v); },
    removeItem: (k) => { delete _sessionImpl[k]; },
    clear: () => { for (const k of Object.keys(_sessionImpl)) delete _sessionImpl[k]; },
  });

  const makeEl = (tagName) => {
    let _textContent = '';
    let _innerHTML = '';
    const el = {
      tagName,
      children: [],
      style: {},
      dataset: {},
      classList: {
        _set: new Set(),
        add(...cls) { cls.forEach((c) => this._set.add(c)); },
        remove(...cls) { cls.forEach((c) => this._set.delete(c)); },
        contains(c) { return this._set.has(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this._set.has(c)) this._set.delete(c); else this._set.add(c);
            return this._set.has(c);
          }
          if (force) this._set.add(c); else this._set.delete(c);
          return force;
        },
      },
      get textContent() { return _textContent; },
      set textContent(v) {
        _textContent = String(v);
        // 模拟浏览器：textContent 设置时特殊字符被转义写入 innerHTML
        _innerHTML = String(v)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      },
      get innerHTML() { return _innerHTML; },
      set innerHTML(v) { _innerHTML = String(v); },
      onclick: null,
      value: '',
      type: '',
      disabled: false,
      className: '',
      getAttribute: (k) => el.dataset[k] || null,
      setAttribute: () => {},
      hasAttribute: () => false,
      insertBefore: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
      getContext: () => null,
      offsetHeight: 0,
      getElementsByClassName: () => [],
    };
    return el;
  };

  const document = {
    createElement: (tag) => makeEl(tag),
    createTextNode: (t) => ({ textContent: t }),
    body: makeEl('body'),
    head: makeEl('head'),
    documentElement: makeEl('html'),
    getElementById: () => makeEl('div'),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const sessionStorage = makeStorage();
  const localStorage = makeStorage();

  // -------- 模拟 IndexedDB 内存存储 + 微任务自动回调 --------
  const _stores = new Map();
  const _dbMock = {
    objectStoreNames: {
      contains: (name) => _stores.has(name),
    },
    createObjectStore(name) {
      _stores.set(name, new Map());
    },
    transaction(storeName) {
      let storeImpl;
      if (!_stores.has(storeName)) _stores.set(storeName, new Map());
      storeImpl = _stores.get(storeName);
      let completeH = null, errorH = null;
      const tx = {
        oncomplete: null,
        onerror: null,
        objectStore() {
          return {
            put(value) {
              const key = value.id;
              storeImpl.set(key, value);
              const req = { onsuccess: null, onerror: null, result: key };
              Promise.resolve().then(() => { if (req.onsuccess) req.onsuccess(); });
              return req;
            },
            get(key) {
              const req = { onsuccess: null, onerror: null, result: storeImpl.get(key) || undefined };
              Promise.resolve().then(() => { if (req.onsuccess) req.onsuccess(); });
              return req;
            },
            getAll() {
              const result = Array.from(storeImpl.values());
              const req = { onsuccess: null, onerror: null, result };
              Promise.resolve().then(() => { if (req.onsuccess) req.onsuccess(); });
              return req;
            },
            clear() {
              storeImpl.clear();
              return { onsuccess: null, onerror: null };
            },
          };
        },
      };
      Promise.resolve().then(() => {
        if (tx.oncomplete) tx.oncomplete();
        if (completeH) completeH();
      });
      return tx;
    },
  };

  const indexedDB = {
    open() {
      const req = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        result: _dbMock,
      };
      // 微任务触发 onsuccess，确保调用方先注册
      Promise.resolve().then(() => {
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
  };

  const window = {
    document,
    indexedDB,
    sessionStorage,
    localStorage,
    AudioContext: null,
    webkitAudioContext: null,
    navigator: { vibrate: null, clipboard: null },
    devicePixelRatio: 1,
    Blob: function Blob() {},
    URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    Promise,
    Math,
    Date,
    JSON,
    console,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    confirm: () => true,
    alert: () => {},
    prompt: () => null,
    addEventListener: (name, fn) => {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(fn);
    },
    removeEventListener: () => {},
  };

  function loadFile(filePath) {
    // eslint-disable-next-line global-require
    const fs = require('fs');
    const code = fs.readFileSync(filePath, 'utf-8');

    // 预置 window.App = {}，让 data.js/storage.js 里的
    // `var App = window.App || {}` 拿到真实对象引用
    if (!window.App) window.App = {};

    // storage.js / quiz.js 里会直接引用 document/indexedDB/sessionStorage 等全局
    // new Function 中需要显式注入
    const argNames = [
      'window', 'globalThis', 'document', 'indexedDB', 'sessionStorage', 'localStorage',
      'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'console', 'navigator', 'AudioContext', 'webkitAudioContext',
      'Blob', 'URL', 'confirm', 'alert', 'prompt',
      'Promise', 'Math', 'Date', 'JSON',
    ];
    const argValues = [
      window, window, document, indexedDB, sessionStorage, localStorage,
      setTimeout, clearTimeout, setInterval, clearInterval,
      console, window.navigator, null, null,
      function Blob() {}, { createObjectURL: () => '', revokeObjectURL: () => {} },
      () => true, () => {}, () => null,
      Promise, Math, Date, JSON,
    ];
    const fn = new Function(...argNames, code);
    fn(...argValues);
  }

  // 重置 IndexedDB 内存
  function resetIDB() {
    _stores.clear();
  }

  return { window, document, sessionStorage, localStorage, indexedDB, loadFile, resetIDB };
}

module.exports = { createBrowserShim };
