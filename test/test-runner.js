// ============================================================
// test/test-runner.js
// 轻量级 Node.js 测试运行器（零依赖）
// - 通过 vm.runInThisContext 加载源码，避免 require 缓存
// - 每个测试套件独立 fresh-load 源码，保证闭包变量隔离
// - 输出 TAP 风格的测试报告
// ============================================================

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctxState = {
    suites: [],
    currentSuite: null,
    stats: { passed: 0, failed: 0, total: 0 }
};

function describe(name, fn) {
    const suite = { name, tests: [], beforeEach: [], afterEach: [] };
    ctxState.suites.push(suite);
    ctxState.currentSuite = suite;
    try { fn(); } finally { ctxState.currentSuite = null; }
}

function beforeEach(fn) {
    if (ctxState.currentSuite) ctxState.currentSuite.beforeEach.push(fn);
}

function afterEach(fn) {
    if (ctxState.currentSuite) ctxState.currentSuite.afterEach.push(fn);
}

function it(name, fn) {
    if (!ctxState.currentSuite) throw new Error('it() must be called inside describe()');
    ctxState.currentSuite.tests.push({ name, fn });
}

// --- 断言工具 ---
function _format(v) {
    if (v === undefined) return 'undefined';
    if (typeof v === 'function') return '[Function]';
    try { return JSON.stringify(v); } catch (e) { return String(v); }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
    const a = _format(actual);
    const e = _format(expected);
    if (a !== e) {
        throw new Error((msg ? msg + ' — ' : '') +
            'expected ' + e + ' but got ' + a);
    }
}

function assertDeepEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        throw new Error((msg ? msg + ' — ' : '') +
            'expected ' + e + ' but got ' + a);
    }
}

function assertNotEqual(actual, expected, msg) {
    const a = _format(actual);
    const e = _format(expected);
    if (a === e) {
        throw new Error((msg ? msg + ' — ' : '') + 'expected not equal to ' + e + ' but got ' + a);
    }
}

function assertTrue(v, msg) { if (v !== true) throw new Error((msg || '') + ' — expected true, got ' + _format(v)); }
function assertFalse(v, msg) { if (v !== false) throw new Error((msg || '') + ' — expected false, got ' + _format(v)); }
function assertNull(v, msg) { if (v !== null) throw new Error((msg || '') + ' — expected null, got ' + _format(v)); }
function assertNotNull(v, msg) { if (v == null) throw new Error((msg || '') + ' — expected non-null'); }
function assertThrows(fn, msg) {
    let threw = false;
    try { fn(); } catch (e) { threw = true; }
    if (!threw) throw new Error((msg || '') + ' — expected function to throw');
}

function fail(msg) { throw new Error(msg || 'fail()'); }

// --- 源码加载 ---
// 使用 vm.runInNewContext 每次创建独立 sandbox，让源码中的 var App 能被
// IIFE 闭包共享并暴露到外部。
const SRC_DIR = path.join(__dirname, '..', 'js');

function _makeSandbox() {
    return {
        window: global.window,
        document: global.document,
        localStorage: global.localStorage,
        sessionStorage: global.sessionStorage,
        indexedDB: global.indexedDB,
        navigator: global.navigator,
        URL: global.URL,
        Blob: global.Blob,
        FileReader: global.FileReader,
        AudioContext: global.AudioContext,
        webkitAudioContext: global.webkitAudioContext,
        alert: global.alert || function() {},
        confirm: global.confirm || function() { return true; },
        prompt: global.prompt || function() { return null; },
        setTimeout, clearTimeout, setImmediate, clearImmediate,
        console, Math, JSON, Date, Object, Array, String, Number, Boolean,
        RegExp, Error, Promise, Symbol, parseInt, parseFloat, isNaN
    };
}

function loadSource(filename) {
    const code = fs.readFileSync(path.join(SRC_DIR, filename), 'utf8');
    const sandbox = _makeSandbox();
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: path.join(SRC_DIR, filename) });
    // 让 App 写入 global.window 以便后续测试读取
    if (sandbox.App) global.window.App = sandbox.App;
    return sandbox.App;
}

// 在每个测试前重置 shim 状态，避免持久化 mock 污染
function resetShim() {
    global.localStorage.clear();
    global.sessionStorage.clear();
    if (global.document && global.document.__reset) global.document.__reset();
    // IndexedDB 模拟数据保留 db schema，但清空记录
    // 通过重新 require 模块难以重置；改用 reloadSource 重新加载 storage.js
}

function loadFreshSource() {
    // 重新读取并执行 storage.js / quiz.js / data.js 等，使闭包变量回到初始状态
    for (const f of ['data.js', 'storage.js', 'quiz.js', 'admin.js', 'chart.js', 'app.js']) {
        loadSource(f);
    }
}

// --- 测试运行 ---
function run() {
    const startTime = Date.now();
    const failures = [];

    for (const suite of ctxState.suites) {
        console.log('\n\u001b[36m' + suite.name + '\u001b[0m');
        for (const t of suite.tests) {
            ctxState.stats.total++;
            // 每个用例：清状态 + 重新加载源码 + 执行 beforeEach
            try {
                resetShim();
                loadFreshSource();
                for (const h of suite.beforeEach) h();
                t.fn();
                for (const h of suite.afterEach) h();
                ctxState.stats.passed++;
                console.log('  \u001b[32m✓\u001b[0m ' + t.name);
            } catch (e) {
                ctxState.stats.failed++;
                failures.push({ suite: suite.name, test: t.name, err: e });
                console.log('  \u001b[31m✗\u001b[0m ' + t.name);
                console.log('      \u001b[31m' + (e.message || e) + '\u001b[0m');
                if (e.stack) {
                    const lines = e.stack.split('\n').slice(1, 4).join('\n');
                    console.log('      \u001b[90m' + lines + '\u001b[0m');
                }
            }
        }
    }

    const ms = Date.now() - startTime;
    console.log('\n' + '─'.repeat(50));
    const ok = ctxState.stats.failed === 0;
    const tag = ok ? '\u001b[32mPASS\u001b[0m' : '\u001b[31mFAIL\u001b[0m';
    console.log(tag + '  ' + ctxState.stats.passed + ' passed, ' +
        ctxState.stats.failed + ' failed, ' + ctxState.stats.total + ' total  (' + ms + 'ms)');

    if (failures.length > 0) {
        console.log('\n\u001b[31mFailures:\u001b[0m');
        for (const f of failures) {
            console.log('  • [' + f.suite + '] ' + f.test);
            console.log('    ' + f.err.message);
        }
    }

    process.exit(ok ? 0 : 1);
}

module.exports = {
    describe, it, beforeEach, afterEach,
    assert, assertEqual, assertDeepEqual, assertNotEqual,
    assertTrue, assertFalse, assertNull, assertNotNull,
    assertThrows, fail,
    loadSource, loadFreshSource, run
};
