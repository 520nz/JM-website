/**
 * tests/setup.js - 浏览器环境模拟 + 源码加载
 * 为 storage.js / quiz.js / admin.js / chart.js / data.js 提供最小运行环境
 * 仅模拟纯逻辑所需的 API，DOM 相关测试单独处理
 */
'use strict';

// ============================================================
// 1. 浏览器全局对象模拟
//    注意：Node v24 开始 global.navigator / global.window 等为内置只读 getter，
//    必须通过 Object.defineProperty 覆写，且不要依赖「||」短路直接赋值。
// ============================================================

function defineRO(obj, name, value) {
  try { Object.defineProperty(obj, name, { value, writable: true, configurable: true, enumerable: true }); }
  catch (e) { /* ignore */ }
}

// --- sessionStorage mock（内存版） ---
const _sessionStore = new Map();
const sessionStorageMock = {
  getItem: (k) => (_sessionStore.has(k) ? _sessionStore.get(k) : null),
  setItem: (k, v) => _sessionStore.set(k, String(v)),
  removeItem: (k) => _sessionStore.delete(k),
  clear: () => _sessionStore.clear(),
};
defineRO(global, 'sessionStorage', sessionStorageMock);

// --- 通用 DOM 元素工厂 ---
function makeEl(tag = 'DIV') {
  const el = {
    tagName: tag.toUpperCase(),
    _textContent: '',
    _innerHTML: '',
    _value: '',
    _style: {},
    _classList: new Set(),
    _dataset: {},
    get classList() {
      const self = this;
      return {
        add: (...c) => c.forEach(x => self._classList.add(x)),
        remove: (...c) => c.forEach(x => self._classList.delete(x)),
        contains: (c) => self._classList.has(c),
      };
    },
    get dataset() { return this._dataset; },
    set dataset(v) { this._dataset = v || {}; },
    get textContent() { return this._textContent; },
    set textContent(v) {
      this._textContent = String(v ?? '');
      // 模拟浏览器的 textContent -> innerHTML 转义行为（esc() 依赖）
      this._innerHTML = String(v ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = String(v ?? ''); },
    get value() { return this._value; },
    set value(v) { this._value = String(v ?? ''); },
    get style() {
      const self = this;
      return new Proxy({}, {
        get(_, p) { return self._style[p] || ''; },
        set(_, p, v) { self._style[p] = String(v); return true; },
      });
    },
    setAttribute(k, v) { this['_' + k] = v; },
    getAttribute(k) { return this['_' + k]; },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
  };
  return el;
}

// --- document.createElement + querySelectorAll + querySelector + getElementById ---
const _domElements = new Map(); // id -> element
const documentMock = {
  createElement: (tag) => makeEl(tag),
  querySelectorAll: (sel) => {
    // selectMode 中：document.querySelectorAll('.mode-btn')
    // 为 quiz.js selectMode 定制：根据 sel 返回空数组即可（因为会 remove classList）
    if (sel === '.mode-btn') {
      // 返回 3 个模拟按钮（quick/standard/intensive）
      return ['quick', 'standard', 'intensive'].map(m => {
        const btn = makeEl('BUTTON');
        btn._dataset = { mode: m };
        return btn;
      });
    }
    return [];
  },
  querySelector: (sel) => {
    // selectMode 中：document.querySelector('.mode-btn[data-mode="' + m + '"]')
    const match = sel.match(/^\.mode-btn\[data-mode="(.+)"\]$/);
    if (match) {
      const btn = makeEl('BUTTON');
      btn._dataset = { mode: match[1] };
      return btn;
    }
    return makeEl('DIV');
  },
  getElementById: (id) => {
    if (!_domElements.has(id)) _domElements.set(id, makeEl('DIV'));
    return _domElements.get(id);
  },
  body: makeEl('BODY'),
};
defineRO(global, 'document', documentMock);

// --- window ---
defineRO(global, 'window', {});

// --- navigator ---
const navigatorMock = {
  vibrate: () => false,
  userAgent: 'NodeTest',
  clipboard: { writeText: () => Promise.resolve() },
};
defineRO(global, 'navigator', navigatorMock);

// --- indexedDB ---
defineRO(global, 'indexedDB', undefined);

// ============================================================
// 2. 源码加载（通过 vm 在隔离上下文中执行，注入全局）
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function loadScript(filename, sandbox) {
  const code = fs.readFileSync(path.join(ROOT, 'js', filename), 'utf8');
  // IIFE 在全局 App 命名空间上挂载属性，sandbox 作为 globalThis
  vm.runInNewContext(code, sandbox, { filename });
}

// 共享的 App 命名空间 sandbox
function createSandbox() {
  const sb = {
    window: {},
    document: global.document,
    indexedDB: global.indexedDB,
    sessionStorage: global.sessionStorage,
    navigator: global.navigator,
    App: {},
    Date: Date,
    Math: Math,
    JSON: JSON,
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    console: console,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
  };
  sb.window.App = sb.App;
  return sb;
}

// 默认加载顺序：data.js(题库) -> storage.js -> quiz.js -> admin.js -> chart.js -> app.js
function loadAll() {
  const sb = createSandbox();
  for (const f of ['data.js', 'storage.js', 'quiz.js', 'admin.js', 'chart.js', 'app.js']) {
    try { loadScript(f, sb); } catch (e) { /* DOM 相关代码会抛错，忽略，只关心纯逻辑 */ }
  }
  return sb.App;
}

// 仅加载不依赖 DOM 的核心脚本（更纯净）
function loadCore() {
  const sb = createSandbox();
  loadScript('data.js', sb);
  loadScript('storage.js', sb);
  // quiz.js 中纯逻辑函数 (shuffle, fmtTime, getCount) 在 App 顶层可访问
  try { loadScript('quiz.js', sb); } catch (e) {}
  try { loadScript('admin.js', sb); } catch (e) {}
  return sb.App;
}

// ============================================================
// 3. 简易测试框架 (零依赖，断言 + 统计)
//    特性：
//      - suite 级 beforeEach（每个 test 运行前调用，用于隔离状态、重置缓存）
//      - 支持 suite(name, fn) / suite(name, { beforeEach }, fn) 两种调用
// ============================================================
let _total = 0, _pass = 0, _fail = 0;
const _failures = [];
let _suiteBeforeEach = null;
const _beforeEachStack = [];

function test(name, fn) {
  _total++;
  try {
    if (_suiteBeforeEach) _suiteBeforeEach();
    fn();
    _pass++;
    process.stdout.write('  \x1b[32m✓\x1b[0m ' + name + '\n');
  } catch (e) {
    _fail++;
    _failures.push({ name, error: e });
    process.stdout.write('  \x1b[31m✗\x1b[0m ' + name + '\n');
    process.stdout.write('    \x1b[31m' + (e.message || e) + '\x1b[0m\n');
  }
}

// suite(name, fn) 或 suite(name, { beforeEach }, fn)
function suite(name, arg2, arg3) {
  const opts = (typeof arg2 === 'function' || arg2 == null) ? {} : arg2;
  const fn   = (typeof arg2 === 'function') ? arg2 : arg3;
  process.stdout.write('\n\x1b[1m' + name + '\x1b[0m\n');
  _beforeEachStack.push(_suiteBeforeEach);
  _suiteBeforeEach = opts.beforeEach || null;
  try { fn && fn(); } finally {
    _suiteBeforeEach = _beforeEachStack.pop();
  }
}

function summary() {
  process.stdout.write('\n' + '='.repeat(50) + '\n');
  process.stdout.write(`总计: ${_total}  通过: \x1b[32m${_pass}\x1b[0m  失败: \x1b[31m${_fail}\x1b[0m\n`);
  if (_failures.length > 0) {
    process.stdout.write('\n--- 失败详情 ---\n');
    for (const f of _failures) {
      process.stdout.write(`【${f.name}】\n  ${f.error.stack || f.error}\n`);
    }
    process.exit(1);
  }
  process.stdout.write('\n全部通过 ✓\n');
}

module.exports = {
  loadAll,
  loadCore,
  test,
  suite,
  summary,
};
