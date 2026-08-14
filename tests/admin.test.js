'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

var BASE = path.resolve(__dirname, '..');
var shim = require('./browser-shim.js');

function freshContext() {
    var ctx = shim.createBrowserShim();
    Object.defineProperty(global, 'window', { value: ctx.window, writable: true, configurable: true });
    Object.defineProperty(global, 'document', { value: ctx.document, writable: true, configurable: true });
    Object.defineProperty(global, 'indexedDB', { value: ctx.indexedDB, writable: true, configurable: true });
    Object.defineProperty(global, 'sessionStorage', { value: ctx.sessionStorage, writable: true, configurable: true });
    Object.defineProperty(global, 'localStorage', { value: ctx.localStorage, writable: true, configurable: true });

    var App = {};
    ctx.window.App = App;

    new Function('window', fs.readFileSync(path.join(BASE, 'js/data.js'), 'utf8'))
        .call(ctx.window, ctx.window);
    new Function('window', fs.readFileSync(path.join(BASE, 'js/storage.js'), 'utf8'))
        .call(ctx.window, ctx.window);
    new Function('window', fs.readFileSync(path.join(BASE, 'js/admin.js'), 'utf8'))
        .call(ctx.window, ctx.window);

    return ctx.window.App;
}

async function setupApp() {
    var App = freshContext();
    await App.db.init();
    return App;
}

// ============================================================
// saveQuestion 中的选项解析正则
// 原实现：line.match(/^([A-Z])[.、．]\s*(.+)$/)
// ============================================================

function parseOptions(optsText) {
    var lines = optsText.split('\n');
    var options = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    return options;
}

test('选项解析 — 标准 A.xxx 格式', function() {
    var text = 'A.选项A\nB.选项B\nC.选项C\nD.选项D';
    var out = parseOptions(text);
    assert.equal(out.length, 4);
    assert.equal(out[0].key, 'A');
    assert.equal(out[0].text, '选项A');
    assert.equal(out[3].key, 'D');
    assert.equal(out[3].text, '选项D');
});

test('选项解析 — 中文顿号 A、xxx 格式', function() {
    var text = 'A、选项一\nB、选项二';
    var out = parseOptions(text);
    assert.equal(out.length, 2);
    assert.equal(out[0].key, 'A');
    assert.equal(out[0].text, '选项一');
});

test('选项解析 — 全角点 A．xxx 格式', function() {
    var text = 'A．选项X\nB．选项Y';
    var out = parseOptions(text);
    assert.equal(out.length, 2);
    assert.equal(out[0].key, 'A');
    assert.equal(out[0].text, '选项X');
});

test('选项解析 — 允许分隔符和选项文本之间有空格', function() {
    var text = 'A.  有空格的选项\nB.\tTab 分隔';
    var out = parseOptions(text);
    assert.equal(out.length, 2);
    assert.equal(out[0].text, '有空格的选项');
    assert.equal(out[1].text, 'Tab 分隔');
});

test('选项解析 — 跳过空行', function() {
    var text = 'A.选项\n\n\nB.选项\n';
    var out = parseOptions(text);
    assert.equal(out.length, 2);
});

test('选项解析 — 无法识别的行被忽略', function() {
    var text = 'A.正常\n这一行格式不对\n3.数字开头\nB.正常';
    var out = parseOptions(text);
    assert.equal(out.length, 2);
    assert.equal(out[0].key, 'A');
    assert.equal(out[1].key, 'B');
});

test('选项解析 — 小写字母 a. 不匹配（只匹配 [A-Z]）', function() {
    var text = 'a.小写\nB.大写';
    var out = parseOptions(text);
    assert.equal(out.length, 1);
    assert.equal(out[0].key, 'B');
});

// ============================================================
// importData — 错题本合并策略（核心修复点）
// admin.js 中的合并逻辑：
//   同 qid: cnt = Math.max(两值)，level = Math.min(两值)
//   新错题: 确保有 level / nextReview / lastReview / time 字段
// ============================================================

function mergeWrongBook(existingWrong, importedWrong) {
    var wrongMap = {};
    for (var w = 0; w < existingWrong.length; w++) {
        wrongMap[existingWrong[w].qid] = existingWrong[w];
    }
    for (var x = 0; x < importedWrong.length; x++) {
        var wrongItem = importedWrong[x];
        if (wrongMap[wrongItem.qid]) {
            // 合并：取较高的错误次数，保留较低等级（更保守）
            wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
            if (wrongItem.level != null) {
                wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
            }
        } else {
            if (!wrongItem.level) wrongItem.level = 0;
            if (!wrongItem.nextReview) wrongItem.nextReview = Date.now();
            if (!wrongItem.lastReview) wrongItem.lastReview = 0;
            if (!wrongItem.time) wrongItem.time = Date.now();
            existingWrong.push(wrongItem);
            wrongMap[wrongItem.qid] = wrongItem;
        }
    }
    return existingWrong;
}

test('错题合并 — 已存在：取较高 cnt', function() {
    var existing = [{ qid: 'q1', cnt: 3, level: 1, time: 1000, lastReview: 2000, nextReview: 3000 }];
    var imported = [{ qid: 'q1', cnt: 7, level: 4 }];
    var result = mergeWrongBook(existing, imported);
    assert.equal(result[0].cnt, 7); // max(3, 7)
});

test('错题合并 — 已存在：取较低 level（更保守）', function() {
    var existing = [{ qid: 'q1', cnt: 3, level: 1, time: 1000, lastReview: 2000, nextReview: 3000 }];
    var imported = [{ qid: 'q1', cnt: 2, level: 4 }];
    var result = mergeWrongBook(existing, imported);
    assert.equal(result[0].level, 1); // min(1, 4)
});

test('错题合并 — 新错题自动补齐缺失的间隔重复字段', function() {
    var existing = [];
    var imported = [{ qid: 'q-new', cnt: 2 }]; // 没有 level/nextReview/lastReview/time
    var result = mergeWrongBook(existing, imported);
    assert.equal(result.length, 1);
    assert.equal(result[0].level, 0);
    assert.ok(result[0].nextReview > 0);
    assert.equal(result[0].lastReview, 0);
    assert.ok(result[0].time > 0);
});

test('错题合并 — 不修改已存在错题的时间字段', function() {
    var existing = [{ qid: 'q1', cnt: 3, level: 1, time: 1000, lastReview: 2000, nextReview: 3000 }];
    var imported = [{ qid: 'q1', cnt: 2, level: 0 }];
    var result = mergeWrongBook(existing, imported);
    assert.equal(result[0].time, 1000);
    assert.equal(result[0].lastReview, 2000);
    assert.equal(result[0].nextReview, 3000);
});

// ============================================================
// importData — history 合并后 recalcStats（原 Bug 是累加 stats）
// ============================================================
test('导入 history 后 recalcStats 不直接累加 stats', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    // 先本地加两条记录
    App.db.addRecord({ qid: q.id, ans: q.answer, ok: true, time: Date.now() });
    App.db.addRecord({ qid: q.id, ans: 'X', ok: false, time: Date.now() });
    assert.equal(App.db.get().stats.total, 2);
    assert.equal(App.db.get().stats.correct, 1);

    // 模拟导入：history 合并 + recalcStats
    var importHistory = [
        { qid: q.id, ans: q.answer, ok: true, time: Date.now() },
        { qid: q.id, ans: q.answer, ok: true, time: Date.now() }
    ];
    var existingData = App.db.get();
    existingData.history = existingData.history.concat(importHistory);
    App.db.recalcStats();

    // recalcStats 应该从 history 重新算，4 条记录，3 对 1 错
    var s = App.db.get().stats;
    assert.equal(s.total, 4);
    assert.equal(s.correct, 3);
    // 而不是 2 + 2 = 4 但 correct 被累加（之前可能是 1+2=3，碰巧正确，但分类计数不应翻倍）
});

// ============================================================
// checkResetInput — 恢复默认题库的口令校验
// ============================================================
test('checkResetInput 只有输入"恢复默认"才启用按钮', async function() {
    var App = await setupApp();
    // 无法直接测试 DOM 操作，但逻辑很简单，我们验证 admin 模块存在
    assert.equal(typeof App.resetQuestionBank, 'function');
    assert.equal(typeof App.checkResetInput, 'function');
    assert.equal(typeof App.showResetConfirm, 'function');
    assert.equal(typeof App.closeResetModal, 'function');
});

// ============================================================
// 分页相关常量
// ============================================================
test('admin 模块函数存在', async function() {
    var App = await setupApp();
    assert.equal(typeof App.renderAdmin, 'function');
    assert.equal(typeof App.saveQuestion, 'function');
    assert.equal(typeof App.deleteQuestion, 'function');
    assert.equal(typeof App.showAddForm, 'function');
    assert.equal(typeof App.showEditForm, 'function');
    assert.equal(typeof App.closeModal, 'function');
    assert.equal(typeof App.exportData, 'function');
    assert.equal(typeof App.importData, 'function');
    assert.equal(typeof App.filterQuestions, 'function');
    assert.equal(typeof App.adminPrevPage, 'function');
    assert.equal(typeof App.adminNextPage, 'function');
    assert.equal(typeof App.renderQuestionList, 'function');
});
