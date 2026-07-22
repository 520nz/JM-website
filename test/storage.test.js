// ============================================================
// storage.test.js - 验证归档去重与 recalcStats 含 archive 的回归测试
// 运行：node test/storage.test.js
// 说明：mock 最小浏览器全局对象，无需测试框架与 IndexedDB
// ============================================================

var vm = require('vm');
var fs = require('fs');
var path = require('path');
var assert = require('assert');

// --- mock 浏览器全局对象 ---
var sandbox = {
    window: {},
    document: {
        createElement: function() {
            return { textContent: '', innerHTML: '' };
        }
    },
    indexedDB: {
        open: function() {
            // 返回一个永不 resolve 的假请求，使 persist 走 catch 被吞
            return { onsuccess: null, onerror: null, onupgradeneeded: null };
        }
    },
    sessionStorage: { getItem: function() { return null; }, setItem: function() {}, removeItem: function() {} },
    console: console,
    Date: Date,
    Math: Math,
    JSON: JSON,
    Promise: Promise,
    setTimeout: setTimeout
};
sandbox.window = sandbox; // storage.js 中 var App = window.App || {}，让 App 挂到 sandbox
vm.createContext(sandbox);

// 加载 storage.js
var code = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8');
vm.runInContext(code, sandbox);

var App = sandbox.App;
assert.ok(App && App.db, 'App.db 应被挂载');

// --- 辅助：构造一条答题记录 ---
function rec(time, ok) {
    return { qid: 'q_test', ans: 'A', ok: !!ok, time: time };
}

// ============================================================
// 测试 1：归档按 date 去重，跨 cutoff 边界不重复堆积
// ============================================================
(function testArchiveDedup() {
    var DAY = 24 * 60 * 60 * 1000;
    var now = Date.now();
    // 90 天前的某一天 D
    var dayD = now - 95 * DAY;
    // 同一天内的两个时间点
    var dMorning = new Date(dayD); dMorning.setHours(8, 0, 0, 0);
    var dEvening = new Date(dayD); dEvening.setHours(20, 0, 0, 0);

    // 初始：history 含 1001 条，全在 D 早晨（90 天前）
    var history1 = [];
    for (var i = 0; i < 1001; i++) history1.push(rec(dMorning.getTime(), i % 2 === 0));

    App.db.setData({
        history: history1,
        wrong: [],
        stats: { total: 1001, correct: 501, cats: {} },
        theme: 'dark',
        dailyGoal: 20,
        achievements: [],
        archive: []
    });

    // 触发第一次归档（addRecord 推入一条 90 天内的新记录，history 变 1002 > 1000）
    App.db.addRecord(rec(now, true));

    var d = App.db.get();
    // archive 应只有 1 条（D 早晨聚合）
    assert.strictEqual(d.archive.length, 1, '第一次归档后 archive 应只有 1 条，实际 ' + d.archive.length);
    assert.strictEqual(d.archive[0].date, dMorning.getFullYear() + '-' + (dMorning.getMonth() + 1) + '-' + dMorning.getDate());
    assert.strictEqual(d.archive[0].total, 1001, '第一次归档 total 应为 1001');

    // 模拟跨 cutoff：再次填入 1001 条 D 晚上的数据（同一日期 key，但时间更晚）
    // 实际场景：第一次归档保留的"90 天内"数据随着时间推移跨过 cutoff
    var history2 = [];
    for (var j = 0; j < 1001; j++) history2.push(rec(dEvening.getTime(), j % 2 === 0));
    d.history = history2; // 直接覆盖，模拟边界推进后保留的数据再次超量

    // 再次触发归档
    App.db.addRecord(rec(now, true));

    d = App.db.get();
    // 关键断言：archive 仍应只有 1 条（同 date 合并），而非 2 条
    assert.strictEqual(d.archive.length, 1, '修复后 archive 应去重为 1 条，实际 ' + d.archive.length + '（修复前为 2）');
    assert.strictEqual(d.archive[0].total, 2002, '合并后 total 应为 2002，实际 ' + d.archive[0].total);

    console.log('PASS: 归档按 date 去重，跨 cutoff 边界不重复堆积');
})();

// ============================================================
// 测试 2：recalcStats 含 archive，导入后累计统计不截断
// ============================================================
(function testRecalcStatsIncludesArchive() {
    var now = Date.now();
    // 模拟已归档用户：history 仅 5 条近期，archive 含 100 题
    App.db.setData({
        history: [
            rec(now - 1000, true),
            rec(now - 900, false),
            rec(now - 800, true),
            rec(now - 700, true),
            rec(now - 600, false)
        ],
        wrong: [],
        stats: { total: 105, correct: 80, cats: {} }, // 累计 105（5 明细 + 100 归档）
        theme: 'dark',
        dailyGoal: 20,
        achievements: [],
        archive: [
            { date: '2026-4-1', total: 60, correct: 50 },
            { date: '2026-4-2', total: 40, correct: 30 }
        ]
    });

    App.db.recalcStats();

    var d = App.db.get();
    // 修复前：stats.total = 5（仅 history）；修复后：105（history 5 + archive 100）
    assert.strictEqual(d.stats.total, 105, 'recalcStats 后 total 应含 archive（105），实际 ' + d.stats.total);
    assert.strictEqual(d.stats.correct, 83, 'recalcStats 后 correct 应含 archive（3+80=83），实际 ' + d.stats.correct);

    console.log('PASS: recalcStats 含 archive，导入后累计统计不截断');
})();

console.log('\n所有测试通过。');
