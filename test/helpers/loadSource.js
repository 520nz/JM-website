// 测试辅助：在 Node 全局上下文中加载浏览器端源文件
//
// 浏览器源文件采用 IIFE + window.App 命名空间模式：
//   var App = window.App || {};
//   (function() { App.db = {...}; ... })();
//
// 这里把 IIFE 末尾 `})();` 改写为 `}); return window.App; })();`，
// 然后用 `new Function(...)` 在 Node global 域中执行，使 fake-indexeddb/auto
// 注入的全局（indexedDB/IDBKeyRange/...）能直接被源文件看到。
const fs = require('fs');
const path = require('path');

function makeDocument() {
  function makeElement(tag) {
    // 简易 HTML 转义，与浏览器 textContent 行为一致
    const escapeHTML = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const el = {
      tagName: (tag || 'div').toUpperCase(),
      children: [],
      style: {},
      attrs: {},
      _text: '',
      _html: '',
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); },
        toggle(c, v) { if (v === undefined ? !this._set.has(c) : v) this._set.add(c); else this._set.delete(c); }
      },
      appendChild(c) { this.children.push(c); return c; },
      removeChild(c) { this.children = this.children.filter(x => x !== c); },
      remove() {},
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k] || null; },
      addEventListener() {},
      removeEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      get firstChild() { return this.children[0] || null; },
      get offsetHeight() { return 0; },
      set textContent(v) { this._text = String(v == null ? '' : v); this._html = ''; },
      get textContent() { return this._text; },
      set innerHTML(v) { this._html = String(v == null ? '' : v); this._text = ''; },
      get innerHTML() {
        // 如果通过 textContent 设置，则返回其 HTML 转义形式
        // （与浏览器的 textContent/innerHTML 序列化行为一致）
        if (this._text) return escapeHTML(this._text);
        return this._html;
      }
    };
    return el;
  }
  return {
    createElement: makeElement,
    createElementNS: (_ns, tag) => makeElement(tag),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    documentElement: makeElement('html'),
    body: makeElement('body')
  };
}

function makeStorage() {
  const m = new Map();
  return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(String(k), String(v)),
    removeItem: k => m.delete(String(k)),
    clear: () => m.clear(),
    get length() { return m.size; },
    key: i => Array.from(m.keys())[i] || null
  };
}

let _initialized = false;
function ensureGlobalPolyfills() {
  if (_initialized) return;
  // fake-indexeddb/auto 注入 indexedDB/IDBKeyRange/... 到 globalThis
  require('fake-indexeddb/auto');
  if (typeof global.window === 'undefined') {
    global.window = global;
  }
  if (typeof global.document === 'undefined') {
    global.document = makeDocument();
  }
  if (typeof global.sessionStorage === 'undefined') {
    global.sessionStorage = makeStorage();
  }
  if (typeof global.localStorage === 'undefined') {
    global.localStorage = makeStorage();
  }
  if (typeof global.navigator === 'undefined') {
    global.navigator = { vibrate: undefined };
  }
  if (typeof global.URL === 'undefined' || !global.URL.createObjectURL) {
    const origURL = global.URL;
    global.URL = Object.assign({}, origURL || {}, {
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: () => {}
    });
  }
  if (typeof global.Blob === 'undefined') {
    global.Blob = class { constructor(parts) { this.parts = parts; } };
  }
  if (typeof global.FileReader === 'undefined') {
    global.FileReader = class {
      readAsText(blob) {
        // 优先从 _text 字段取（测试用桩），其次从 Blob.parts
        let text = '';
        if (blob) {
          if (typeof blob._text === 'string') text = blob._text;
          else if (blob.parts) text = blob.parts.join('');
        }
        setTimeout(() => { if (this.onload) this.onload({ target: { result: text } }); }, 0);
      }
    };
  }
  // 静默 alert/confirm/prompt
  global.alert = global.alert || (() => {});
  global.confirm = global.confirm || (() => true);
  global.prompt = global.prompt || (() => null);
  _initialized = true;
}

/**
 * 把源代码末尾的 IIFE 闭合并调用（`})();` 或 `})(App);`）改写为
 * `})(...); return window.App;`，使得外层 Function 能取到命名空间引用。
 *
 * 同时把 `var App = window.App || {};` 改为直接对 window 赋值，
 * 这样命名空间对象在 IIFE 执行后能从外层访问。
 */
function patchCode(code) {
  return code
    .replace(/var\s+App\s*=\s*window\.App\s*\|\|\s*\{\};?/, 'window.App = window.App || {}; var App = window.App;')
    // 匹配 IIFE 闭合：})(); 或 })(App); 或 })(Some); 等
    .replace(/\}\)\s*\([^)]*\)\s*;\s*$/m, '$& return window.App;');
}

function buildRunner(code) {
  // 注意：不把 alert/confirm/prompt 注入到 new Function 参数列表中，
  // 这样源代码内部的 `alert(...)` 会通过全局查找找到 globalThis.alert，
  // 测试可在调用前后修改 global.alert 来观察行为。
  const fn = new Function(
    'window', 'document', 'sessionStorage', 'localStorage',
    'navigator', 'URL', 'Blob', 'FileReader',
    code
  );
  return function runInGlobal() {
    return fn(
      global.window, global.document, global.sessionStorage, global.localStorage,
      global.navigator, global.URL, global.Blob, global.FileReader
    );
  };
}

async function loadStorage() {
  ensureGlobalPolyfills();
  const code = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'storage.js'), 'utf8');
  const run = buildRunner(patchCode(code));
  const App = run();
  // 异步初始化 IDB
  await App.db.init();
  return App;
}

function loadAdmin() {
  ensureGlobalPolyfills();
  const code = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'admin.js'), 'utf8');
  const run = buildRunner(patchCode(code));
  return run();
}

function loadQuiz() {
  ensureGlobalPolyfills();
  const code = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'quiz.js'), 'utf8');
  const run = buildRunner(patchCode(code));
  return run();
}

function loadChart() {
  ensureGlobalPolyfills();
  const code = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'chart.js'), 'utf8');
  const run = buildRunner(patchCode(code));
  return run();
}

module.exports = { loadStorage, loadAdmin, loadQuiz, loadChart, ensureGlobalPolyfills };
