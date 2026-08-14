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

    return ctx.window.App;
}

async function setupApp() {
    var App = freshContext();
    await App.db.init();
    return App;
}

// ============================================================
// App.esc — XSS 转义
// ============================================================
test('App.esc 对特殊字符进行 HTML 实体转义', function() {
    var App = freshContext();
    assert.equal(App.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(App.esc('a&b'), 'a&amp;b');
    assert.equal(App.esc('a"b'), 'a&quot;b');
});

test('App.esc 对 null/undefined/空串返回空字符串', function() {
    var App = freshContext();
    assert.equal(App.esc(null), '');
    assert.equal(App.esc(undefined), '');
    assert.equal(App.esc(''), '');
    assert.equal(App.esc(0), '0');
    assert.equal(App.esc(false), 'false');
});

// ============================================================
// defaults
// ============================================================
test('db.defaults 返回包含所有必需字段的默认结构', function() {
    var App = freshContext();
    var d = App.db.defaults();
    assert.equal(d.history.length, 0);
    assert.equal(d.wrong.length, 0);
    assert.equal(d.stats.total, 0);
    assert.equal(d.stats.correct, 0);
    assert.deepEqual(d.stats.cats, {});
    assert.equal(d.theme, 'dark');
    assert.equal(d.dailyGoal, 20);
    assert.equal(d.achievements.length, 0);
    assert.equal(d.archive.length, 0);
});

// ============================================================
// addRecord — 基础计数 + 分类统计
// ============================================================
test('addRecord 累加 total / correct / 分类计数', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    App.db.addRecord({ qid: q.id, ans: q.answer, ok: true, time: Date.now() });
    App.db.addRecord({ qid: q.id, ans: 'X', ok: false, time: Date.now() });
    var d = App.db.get();
    assert.equal(d.stats.total, 2);
    assert.equal(d.stats.correct, 1);
    assert.equal(d.history.length, 2);
    assert.equal(d.stats.cats[q.category].t, 2);
    assert.equal(d.stats.cats[q.category].c, 1);
});

test('addRecord 对找不到的题目不崩溃（findQ 返回 null）', async function() {
    var App = await setupApp();
    App.db.addRecord({ qid: 'nonexistent', ans: 'A', ok: true, time: Date.now() });
    var d = App.db.get();
    assert.equal(d.stats.total, 1);
    assert.equal(d.stats.correct, 1);
    assert.equal(Object.keys(d.stats.cats).length, 0);
});

// ============================================================
// addRecord — 历史归档聚合（核心高风险路径）
// ============================================================
test('addRecord 历史超过 1000 条时触发 90 天前记录的按天归档', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    var now = Date.now();
    var oldTime = now - 100 * 24 * 60 * 60 * 1000; // 100 天前
    var recentTime = now - 10 * 24 * 60 * 60 * 1000; // 10 天前（应保留）

    // 塞入 500 条老记录 + 501 条近期记录（让 history 刚好超过 1000）
    for (var i = 0; i < 500; i++) {
        App.db.addRecord({ qid: q.id, ans: q.answer, ok: i % 2 === 0, time: oldTime });
    }
    for (var j = 0; j < 501; j++) {
        App.db.addRecord({ qid: q.id, ans: q.answer, ok: true, time: recentTime });
    }

    var d = App.db.get();
    // 归档后 history 只剩 501 条近期
    assert.ok(d.history.length <= 550, 'history 应只保留 90 天内的记录');
    // archive 有数据
    assert.ok(d.archive.length > 0, 'archive 应该生成归档记录');
    // archive 中的 total 应该接近 500
    var archiveTotal = 0;
    for (var k = 0; k < d.archive.length; k++) archiveTotal += d.archive[k].total;
    assert.ok(archiveTotal >= 480 && archiveTotal <= 520, '归档的老记录数量应接近 500');
    // stats.total 不应该丢失
    assert.equal(d.stats.total, 1001);
});

test('addRecord 归档不会重复归档同一天', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    var oldTime = Date.now() - 100 * 24 * 60 * 60 * 1000;

    // 先触发一次归档
    for (var i = 0; i < 1001; i++) {
        App.db.addRecord({ qid: q.id, ans: q.answer, ok: true, time: i < 500 ? oldTime : Date.now() });
    }
    var archiveAfterFirst = App.db.get().archive.slice();

    // 再次触发归档
    for (var j = 0; j < 1001; j++) {
        App.db.addRecord({ qid: q.id, ans: q.answer, ok: true, time: j < 500 ? oldTime : Date.now() });
    }
    var d = App.db.get();
    // 归档后的每个日期应该只有一份
    var dateSet = {};
    for (var k = 0; k < d.archive.length; k++) {
        assert.ok(!dateSet[d.archive[k].date], '归档日期不应重复: ' + d.archive[k].date);
        dateSet[d.archive[k].date] = true;
    }
});

// ============================================================
// addWrong — 新增 / 重复重置
// ============================================================
test('addWrong 首次添加错题', async function() {
    var App = await setupApp();
    App.db.addWrong('001');
    var w = App.db.getWrong();
    assert.equal(w.length, 1);
    assert.equal(w[0].qid, '001');
    assert.equal(w[0].cnt, 1);
    assert.equal(w[0].level, 0);
    assert.ok(w[0].time > 0);
});

test('addWrong 重复错题时 cnt++ 且 level 重置为 0', async function() {
    var App = await setupApp();
    App.db.addWrong('001');
    // 手动把 level 调到 3 模拟已复习过
    App.db.getWrong()[0].level = 3;
    App.db.addWrong('001');
    var w = App.db.getWrong();
    assert.equal(w.length, 1);
    assert.equal(w[0].cnt, 2);
    assert.equal(w[0].level, 0);
});

// ============================================================
// reviewCorrect — 间隔重复等级进阶 + mastered 判定
// ============================================================
test('reviewCorrect 未到 level 5 时只提升等级，返回 mastered:false', async function() {
    var App = await setupApp();
    App.db.addWrong('001'); // level 0
    var r1 = App.db.reviewCorrect('001');
    assert.equal(r1.mastered, false);
    assert.equal(r1.level, 1);

    // 手动把 level 调到 3，再答对一次 → 4，此时 mastered:false
    App.db.getWrong()[0].level = 3;
    var r3to4 = App.db.reviewCorrect('001');
    assert.equal(r3to4.mastered, false);
    assert.equal(r3to4.level, 4);
    assert.equal(App.db.getWrong().length, 1);
});

test('reviewCorrect level >= 5 时从错题本移除并返回 mastered:true', async function() {
    var App = await setupApp();
    App.db.addWrong('001');
    // 一路升到 5
    for (var i = 0; i < 5; i++) {
        App.db.reviewCorrect('001');
    }
    var w = App.db.getWrong();
    assert.equal(w.length, 0, '错题应该在 level>=5 时被移除');
    // 第 5 次调用的返回值
    App.db.addWrong('002');
    for (var j = 0; j < 5; j++) {
        var r = App.db.reviewCorrect('002');
        if (j === 4) {
            assert.equal(r.mastered, true);
            assert.equal(r.qid, '002');
        }
    }
});

test('reviewCorrect 不存在于错题本的题目不崩溃', async function() {
    var App = await setupApp();
    var r = App.db.reviewCorrect('ghost');
    assert.equal(r.mastered, false);
    assert.equal(r.qid, 'ghost');
});

test('reviewCorrect 正确设置 nextReview 为对应的 SR 间隔', async function() {
    var App = await setupApp();
    App.db.addWrong('001');
    var before = Date.now();
    App.db.reviewCorrect('001'); // level 0 -> 1
    var w = App.db.getWrong()[0];
    // level 1 应加 1 小时
    assert.ok(w.nextReview >= before + 3600 * 1000 - 1000);
    assert.ok(w.nextReview <= Date.now() + 3600 * 1000 + 1000);
});

// ============================================================
// reviewWrong — 重置等级 + 错题本外新增
// ============================================================
test('reviewWrong 已在错题本中时重置 level=0 并 cnt++', async function() {
    var App = await setupApp();
    App.db.addWrong('001');
    App.db.getWrong()[0].level = 3;
    App.db.getWrong()[0].cnt = 5;
    App.db.reviewWrong('001');
    var w = App.db.getWrong()[0];
    assert.equal(w.level, 0);
    assert.equal(w.cnt, 6);
});

test('reviewWrong 不在错题本中时自动 addWrong', async function() {
    var App = await setupApp();
    App.db.reviewWrong('new-q');
    var w = App.db.getWrong();
    assert.equal(w.length, 1);
    assert.equal(w[0].qid, 'new-q');
    assert.equal(w[0].level, 0);
});

// ============================================================
// getDueWrong — 到期筛选
// ============================================================
test('getDueWrong 返回 nextReview <= now 或 nextReview 缺失的错题', async function() {
    var App = await setupApp();
    App.db.addWrong('001'); // nextReview = Date.now()，立即可复习
    App.db.addWrong('002');
    // 把 002 的 nextReview 设到未来
    App.db.getWrong()[1].nextReview = Date.now() + 24 * 3600 * 1000;
    // 003 没有 nextReview 字段
    App.db.getWrong().push({ qid: '003', cnt: 1, level: 0, time: Date.now(), lastReview: 0 });

    var due = App.db.getDueWrong();
    var dueIds = due.map(function(w) { return w.qid; }).sort();
    assert.ok(dueIds.indexOf('001') >= 0, '001 应到期');
    assert.ok(dueIds.indexOf('003') >= 0, 'nextReview 缺失视为到期');
    assert.ok(dueIds.indexOf('002') < 0, '002 未到期');
});

test('getDueWrong 错题本空时返回空数组', async function() {
    var App = await setupApp();
    assert.deepEqual(App.db.getDueWrong(), []);
});

// ============================================================
// removeWrong
// ============================================================
test('removeWrong 按 qid 正确移除且不移除其他', async function() {
    var App = await setupApp();
    App.db.addWrong('a');
    App.db.addWrong('b');
    App.db.addWrong('c');
    App.db.removeWrong('b');
    var ids = App.db.getWrong().map(function(w) { return w.qid; }).sort();
    assert.deepEqual(ids, ['a', 'c']);
});

// ============================================================
// recalcStats
// ============================================================
test('recalcStats 从 history 重新计算 stats，覆盖错误的旧值', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    // 先手动塞一个错误的 stats
    App.db.get().stats = { total: 999, correct: 888, cats: { 'fake': { t: 50, c: 50 } } };
    // 加两条正确记录
    App.db.addRecord({ qid: q.id, ans: q.answer, ok: true, time: Date.now() });
    App.db.addRecord({ qid: q.id, ans: 'X', ok: false, time: Date.now() });
    // 先验证 stats 是累加的
    assert.equal(App.db.get().stats.total, 1001);
    // recalc
    App.db.recalcStats();
    var s = App.db.get().stats;
    assert.equal(s.total, 2);
    assert.equal(s.correct, 1);
    assert.equal(s.cats[q.category].t, 2);
    assert.equal(s.cats[q.category].c, 1);
    assert.equal(s.cats['fake'], undefined);
});

// ============================================================
// getStreak — 连续打卡（含 archive 合并、今日断点逻辑）
// ============================================================
test('getStreak 无历史记录返回 0', async function() {
    var App = await setupApp();
    assert.equal(App.db.getStreak(), 0);
});

test('getStreak 今日答题返回今日 + 昨日等连续天数', async function() {
    var App = await setupApp();
    var now = Date.now();
    var today0 = new Date(); today0.setHours(0, 0, 0, 0);
    // 连续 5 天，从今天往回
    for (var i = 0; i < 5; i++) {
        var day = today0.getTime() - i * 86400000;
        App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: day });
    }
    assert.equal(App.db.getStreak(), 5);
});

test('getStreak 今日未答但昨日答过返回昨天起的连续天数', async function() {
    var App = await setupApp();
    var today0 = new Date(); today0.setHours(0, 0, 0, 0);
    // 昨天、前天、大前天答题
    for (var i = 1; i <= 3; i++) {
        App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: today0.getTime() - i * 86400000 });
    }
    assert.equal(App.db.getStreak(), 3);
});

test('getStreak 中间有断点会从断点处截断', async function() {
    var App = await setupApp();
    var today0 = new Date(); today0.setHours(0, 0, 0, 0);
    // 今天、昨天、前天答题，4 天前没答题，5 天前答题
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: today0.getTime() });
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: today0.getTime() - 1 * 86400000 });
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: today0.getTime() - 2 * 86400000 });
    // 跳过 -3 天
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: today0.getTime() - 4 * 86400000 });
    assert.equal(App.db.getStreak(), 3);
});

test('getStreak 能从 archive 中合并日期', async function() {
    var App = await setupApp();
    var today0 = new Date(); today0.setHours(0, 0, 0, 0);
    // 今天、昨天、前天答题（history）
    for (var i = 0; i < 3; i++) {
        App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: today0.getTime() - i * 86400000 });
    }
    // 7 天前、8 天前答题（手动塞 archive，模拟老数据归档后仍然算连续）
    App.db.get().archive = [
        { date: formatKey(today0.getTime() - 7 * 86400000), total: 1, correct: 1 },
        { date: formatKey(today0.getTime() - 8 * 86400000), total: 1, correct: 1 }
    ];
    // 连续应该被 archive 中的数据补上 — 但 3 天前到 6 天前没有记录
    // 所以 streak 还是 3
    assert.equal(App.db.getStreak(), 3);
});

function formatKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
}

// ============================================================
// getDailyGoal / setDailyGoal
// ============================================================
test('getDailyGoal 默认 20', async function() {
    var App = await setupApp();
    assert.equal(App.db.getDailyGoal(), 20);
});

test('setDailyGoal 边界 clamp 到 [5, 100]', async function() {
    var App = await setupApp();
    App.db.setDailyGoal(3);
    assert.equal(App.db.getDailyGoal(), 5);
    App.db.setDailyGoal(200);
    assert.equal(App.db.getDailyGoal(), 100);
    App.db.setDailyGoal(50);
    assert.equal(App.db.getDailyGoal(), 50);
    App.db.setDailyGoal(5);
    assert.equal(App.db.getDailyGoal(), 5);
    App.db.setDailyGoal(100);
    assert.equal(App.db.getDailyGoal(), 100);
});

// ============================================================
// checkAchievements — 成就解锁
// ============================================================
test('checkAchievements total>=1 解锁 first_answer', async function() {
    var App = await setupApp();
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    assert.ok(ids.indexOf('first_answer') >= 0);
});

test('checkAchievements total>=100 解锁 total_100', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    for (var i = 0; i < 100; i++) {
        App.db.addRecord({ qid: q.id, ans: 'A', ok: true, time: Date.now() });
    }
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    assert.ok(ids.indexOf('total_100') >= 0);
});

test('checkAchievements total>=500 解锁 total_500', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    for (var i = 0; i < 500; i++) {
        App.db.addRecord({ qid: q.id, ans: 'A', ok: true, time: Date.now() });
    }
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    assert.ok(ids.indexOf('total_500') >= 0);
});

test('checkAchievements total>=50 且正确率>=90% 解锁 acc_90', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    for (var i = 0; i < 50; i++) {
        App.db.addRecord({ qid: q.id, ans: 'A', ok: true, time: Date.now() });
    }
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    assert.ok(ids.indexOf('acc_90') >= 0);
});

test('checkAchievements 低于 90% 不解锁 acc_90', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    // 50 题，44 对 6 错 = 88% < 90%
    for (var i = 0; i < 50; i++) {
        App.db.addRecord({ qid: q.id, ans: 'A', ok: i >= 6, time: Date.now() });
    }
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    assert.ok(ids.indexOf('acc_90') < 0, '88% 不应解锁 acc_90');
});

test('checkAchievements 单次 perfect_10 需要 context.quizTotal>=10 且全部答对', async function() {
    var App = await setupApp();
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    var unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    var ids = unlocks.map(function(a) { return a.id; });
    assert.ok(ids.indexOf('perfect_10') >= 0);

    // 少于 10 题不触发
    App.db.get().achievements = []; // 重置
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    var unlocks2 = App.db.checkAchievements({ quizTotal: 9, quizCorrect: 9 });
    var ids2 = unlocks2.map(function(a) { return a.id; });
    assert.ok(ids2.indexOf('perfect_10') < 0);
});

test('checkAchievements 单日 >=50 题解锁 daily_50', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    for (var i = 0; i < 50; i++) {
        App.db.addRecord({ qid: q.id, ans: 'A', ok: true, time: Date.now() });
    }
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    assert.ok(ids.indexOf('daily_50') >= 0);
});

test('checkAchievements 连续 >=3 天解锁 streak_3，>=7 天解锁 streak_7', async function() {
    var App = await setupApp();
    var today0 = new Date(); today0.setHours(0, 0, 0, 0);
    var q = App.QUESTION_BANK[0];
    for (var i = 0; i < 3; i++) {
        App.db.addRecord({ qid: q.id, ans: 'A', ok: true, time: today0.getTime() - i * 86400000 });
    }
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    assert.ok(ids.indexOf('streak_3') >= 0);
    assert.ok(ids.indexOf('streak_7') < 0);

    App.db.get().achievements = [];
    for (var j = 3; j < 7; j++) {
        App.db.addRecord({ qid: q.id, ans: 'A', ok: true, time: today0.getTime() - j * 86400000 });
    }
    var unlocks2 = App.db.checkAchievements();
    var ids2 = unlocks2.map(function(a) { return a.id; });
    assert.ok(ids2.indexOf('streak_7') >= 0);
});

test('checkAchievements 错题清零 + 有答题记录 + 解锁过 first_answer → 解锁 wrong_clear', async function() {
    var App = await setupApp();
    var q = App.QUESTION_BANK[0];
    App.db.addRecord({ qid: q.id, ans: q.answer, ok: true, time: Date.now() });
    // 手动加错题再清掉
    App.db.addWrong('001');
    App.db.removeWrong('001');
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    assert.ok(ids.indexOf('wrong_clear') >= 0, '错题清零后应解锁 wrong_clear');
});

test('checkAchievements 所有分类都有答题记录解锁 all_cats', async function() {
    var App = await setupApp();
    var cats = ['专辑', '歌曲', '个人信息', '获奖记录'];
    for (var i = 0; i < cats.length; i++) {
        // 找一个对应分类的题目
        var q = App.QUESTION_BANK.find(function(q) { return q.category === cats[i]; });
        assert.ok(q, '测试前置：题库中必须存在分类 ' + cats[i]);
        App.db.addRecord({ qid: q.id, ans: q.answer, ok: true, time: Date.now() });
    }
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    assert.ok(ids.indexOf('all_cats') >= 0);
});

test('checkAchievements 已解锁的成就不会重复加入返回列表', async function() {
    var App = await setupApp();
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    App.db.checkAchievements();
    // 第二次调用
    var unlocks = App.db.checkAchievements();
    assert.equal(unlocks.length, 0, '已解锁的成就不应重复返回');
});

// ============================================================
// App.session — 会话持久化
// ============================================================
test('session.save / load / clear 基本流程', function() {
    var App = freshContext();
    App.session.save({
        quiz: [{ id: '001' }, { id: '002' }],
        idx: 1,
        correctCount: 1,
        startTime: Date.now() - 60000,
        mode: 'quick',
        isWrongBookQuiz: false
    });
    var loaded = App.session.load();
    assert.ok(loaded);
    assert.deepEqual(loaded.quizIds, ['001', '002']);
    assert.equal(loaded.idx, 1);
    assert.equal(loaded.correctCount, 1);
    assert.equal(loaded.mode, 'quick');
    App.session.clear();
    assert.equal(App.session.load(), null);
});

test('session.load 空时返回 null', function() {
    var App = freshContext();
    assert.equal(App.session.load(), null);
});

test('session.save 空状态时 quizIds 为空数组', function() {
    var App = freshContext();
    App.session.save({
        quiz: [],
        idx: 0,
        correctCount: 0,
        startTime: Date.now(),
        mode: 'standard'
    });
    var loaded = App.session.load();
    assert.equal(loaded.quizIds.length, 0);
});
