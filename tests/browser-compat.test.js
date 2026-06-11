/**
 * 浏览器集成验证
 * 
 * 目标：确认 core.js 以浏览器方式（UMD 通过 self.QuizCore）加载后，
 * 核心 API 语义与 Node 环境一致。
 * 
 * 运行方式：node tests/browser-compat.test.js
 */

'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');

// 模拟浏览器全局对象 self
var sandbox = { self: {}, console: console };
var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8');

// 在浏览器风格的上下文中 eval
var fn = new Function('self', 'console', src + '\nreturn self.QuizCore;');
var QuizCore = fn(sandbox.self, sandbox.console);

assert.ok(QuizCore, 'core.js 未在 self 上挂载 QuizCore');
assert.strictEqual(typeof QuizCore.getCount, 'function', 'getCount 应导出');
assert.strictEqual(typeof QuizCore.shuffle, 'function', 'shuffle 应导出');
assert.strictEqual(typeof QuizCore.fmtTime, 'function', 'fmtTime 应导出');
assert.strictEqual(typeof QuizCore.parseOptions, 'function', 'parseOptions 应导出');
assert.strictEqual(typeof QuizCore.createDB, 'function', 'createDB 应导出');
assert.strictEqual(typeof QuizCore.calcAccuracy, 'function', 'calcAccuracy 应导出');
assert.strictEqual(typeof QuizCore.calcTodayRecords, 'function', 'calcTodayRecords 应导出');
assert.strictEqual(typeof QuizCore.mergeImportedData, 'function', 'mergeImportedData 应导出');
assert.strictEqual(typeof QuizCore.buildCategoryStats, 'function', 'buildCategoryStats 应导出');

// 基本冒烟验证
assert.strictEqual(QuizCore.getCount('quick'), 10);
assert.strictEqual(QuizCore.fmtTime(60000), '1分0秒');
assert.deepStrictEqual(
    QuizCore.parseOptions('A.选项1\nB.选项2'),
    [{ key: 'A', text: '选项1' }, { key: 'B', text: '选项2' }]
);

// DB 验证（使用内存 store）
var store = {
    _data: {},
    getItem: function (k) { return this._data.hasOwnProperty(k) ? this._data[k] : null; },
    setItem: function (k, v) { this._data[k] = String(v); },
    removeItem: function (k) { delete this._data[k]; }
};
var db = QuizCore.createDB(store, { getBank: function () { return [{ id: 'q1', category: '专辑' }]; } });
db.addRecord({ qid: 'q1', ans: 'A', ok: true, time: 12345 });
assert.strictEqual(db.get().stats.total, 1);
assert.strictEqual(db.get().stats.correct, 1);

console.log('  ✓ 浏览器 UMD 挂载 & API 冒烟');
console.log('  ✓ 核心函数在浏览器环境下可正常工作');
console.log('  ✓ DB 模块在自定义 store 下正常');
console.log('\n浏览器集成验证：全部通过');
