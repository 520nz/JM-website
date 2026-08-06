// ============================================================
// tests/storage.test.js - storage.js 核心业务逻辑测试
// 覆盖：XSS 转义、间隔重复、答题归档、连续打卡、成就徽章、每日目标、错题聚合导入
// ============================================================
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestContext } = require('./setup.js');

function freshCtx() {
    const ctx = createTestContext();
    ctx.resetStorage();
    return ctx;
}

function idsEqual(arr, expectedIds) {
    const got = arr.map(w => w.qid).sort();
    const exp = expectedIds.slice().sort();
    assert.equal(got.join(','), exp.join(','), `期望 [${exp.join(',')}] 但得到 [${got.join(',')}]`);
}

// ============================================================
// App.esc - XSS 转义工具
// 这是整个应用防 XSS 的唯一防线
// ============================================================
test('esc() 应对 XSS 向量中的尖括号进行转义', () => {
    const { App } = freshCtx();
    assert.equal(App.esc(null), '');
    assert.equal(App.esc(undefined), '');
    assert.equal(App.esc(''), '');
    assert.equal(App.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(App.esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(App.esc('<div>hello</div>'), '&lt;div&gt;hello&lt;/div&gt;');
});

test('esc() 应对 & 进行实体化，防止属性注入', () => {
    const { App } = freshCtx();
    assert.equal(App.esc('&'), '&amp;');
    assert.equal(App.esc('a & b'), 'a &amp; b');
});

test('esc() 对正常文本、数字、布尔值不产生副作用', () => {
    const { App } = freshCtx();
    assert.equal(App.esc('林俊杰真帅'), '林俊杰真帅');
    assert.equal(App.esc('2 + 2 = 4'), '2 + 2 = 4');
    assert.equal(App.esc(123), '123');
    assert.equal(App.esc(0), '0');
    assert.equal(App.esc(false), 'false');
    assert.equal(App.esc(true), 'true');
});

// ============================================================
// 间隔重复核心算法
// ============================================================
test('addWrong() 首次添加错题，初始 level=0、cnt=1、立即可复习', () => {
    const { App } = freshCtx();
    App.db.addWrong('001');
    const wl = App.db.getWrong();
    assert.equal(wl.length, 1);
    assert.equal(wl[0].qid, '001');
    assert.equal(wl[0].cnt, 1);
    assert.equal(wl[0].level, 0);
    assert.equal(wl[0].nextReview, Date.now());
});

test('addWrong() 同一题再次答错，cnt+1 但 level 重置为 0', () => {
    const { App } = freshCtx();
    App.db.addWrong('001');
    App.db.reviewCorrect('001'); // level 1
    App.db.addWrong('001');
    const w = App.db.getWrong()[0];
    assert.equal(w.cnt, 2);
    assert.equal(w.level, 0);
    assert.equal(w.nextReview, Date.now());
});

test('reviewCorrect() 逐步推进 level，答对 5 次后自动从错题本移除', () => {
    const { App } = freshCtx();
    App.db.addWrong('001');

    for (let step = 1; step <= 5; step++) {
        const result = App.db.reviewCorrect('001');
        if (step < 5) {
            assert.equal(result.mastered, false, `第 ${step} 次答对不应掌握`);
            assert.equal(result.level, step);
        } else {
            assert.equal(result.mastered, true, `第 5 次答对应已掌握`);
        }
    }
    assert.equal(App.db.getWrong().length, 0, '掌握后应从错题本移除');
});

test('reviewCorrect() 推进 level 时，nextReview 按间隔时间表设置', () => {
    const { App } = freshCtx();
    App.db.addWrong('001');

    const t0 = Date.now();
    const r1 = App.db.reviewCorrect('001');
    assert.equal(r1.level, 1);
    const w1 = App.db.getWrong()[0];
    const expected1h = 60 * 60 * 1000;
    assert.ok(w1.nextReview >= t0 + expected1h - 200, 'level 1 应延迟约 1h');

    const before2 = Date.now();
    const r2 = App.db.reviewCorrect('001');
    assert.equal(r2.level, 2);
    const w2 = App.db.getWrong()[0];
    const expected1d = 24 * 60 * 60 * 1000;
    assert.ok(w2.nextReview >= before2 + expected1d - 200, 'level 2 应延迟约 1d');
});

test('reviewCorrect() 对不存在于错题本的题返回未掌握', () => {
    const { App } = freshCtx();
    const result = App.db.reviewCorrect('999');
    assert.equal(result.mastered, false);
});

test('reviewWrong() 错题本中答错，重置 level 并 cnt+1', () => {
    const { App } = freshCtx();
    App.db.addWrong('001');
    App.db.reviewCorrect('001'); // level 1
    App.db.reviewCorrect('001'); // level 2

    App.db.reviewWrong('001');
    const w = App.db.getWrong()[0];
    assert.equal(w.level, 0);
    assert.equal(w.cnt, 2); // addWrong(1) + reviewWrong(+1)
    assert.equal(w.nextReview, Date.now());
});

test('reviewWrong() 题不在错题本中时自动 addWrong', () => {
    const { App } = freshCtx();
    App.db.reviewWrong('002');
    const w = App.db.getWrong();
    assert.equal(w.length, 1);
    assert.equal(w[0].qid, '002');
    assert.equal(w[0].cnt, 1);
});

test('getDueWrong() 只返回 nextReview<=now 或 nextReview 为空/0 的错题', () => {
    const { App } = freshCtx();
    const now = Date.now();

    App.db.setData({
        history: [],
        wrong: [
            { qid: '001', cnt: 1, level: 2, nextReview: now - 1000, lastReview: 0, time: now },  // 过期
            { qid: '002', cnt: 1, level: 0, nextReview: now + 86400000, lastReview: 0, time: now }, // 未到期
            { qid: '003', cnt: 1, level: 0, nextReview: 0, lastReview: 0, time: now },              // 0 视为到期
            { qid: '004', cnt: 1, level: 0, /* 无 nextReview */ lastReview: 0, time: now }          // 缺失视为到期
        ],
        stats: { total: 0, correct: 0, cats: {} },
        archive: [], achievements: []
    });

    const due = App.db.getDueWrong();
    assert.equal(due.length, 3);
    idsEqual(due, ['001', '003', '004']);
    // 002 不应在 due 中
    const ids = due.map(w => w.qid);
    assert.ok(!ids.includes('002'));
});

test('removeWrong() 从错题本中移除指定题目', () => {
    const { App } = freshCtx();
    App.db.addWrong('001');
    App.db.addWrong('002');
    App.db.removeWrong('001');
    idsEqual(App.db.getWrong(), ['002']);
});

// ============================================================
// 答题记录 + 统计
// ============================================================
test('addRecord() 正确维护 stats.total/correct 和分类统计', () => {
    const { App } = freshCtx();
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    App.db.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
    App.db.addRecord({ qid: '003', ans: 'A', ok: true, time: Date.now() });

    const d = App.db.get();
    assert.equal(d.stats.total, 3);
    assert.equal(d.stats.correct, 2);

    assert.equal(d.stats.cats['专辑'].t, 1);
    assert.equal(d.stats.cats['专辑'].c, 1);
    assert.equal(d.stats.cats['歌曲'].t, 2);
    assert.equal(d.stats.cats['歌曲'].c, 1);
});

test('addRecord() 不存在的 qid 不产生分类条目，但 total 仍增加', () => {
    const { App } = freshCtx();
    App.db.addRecord({ qid: 'NOTEXIST', ans: 'A', ok: true, time: Date.now() });
    const d = App.db.get();
    assert.equal(d.stats.total, 1);
    assert.equal(d.stats.correct, 1);
    assert.deepEqual(d.stats.cats, {});
});

test('addRecord() 归档：history 超过 1000 条时，严格早于 90 天的记录按天聚合进 archive', () => {
    const { App } = freshCtx();
    const now = Date.now();
    const cutoff = now - 90 * 24 * 60 * 60 * 1000;

    // 950 条严格 < cutoff 的旧记录 + 60 条新记录
    const oldRecs = [];
    const newRecs = [];
    for (let i = 0; i < 950; i++) {
        // 减去额外 1ms 确保严格小于 cutoff（代码用 < 判断）
        const t = cutoff - i * 3600000 - 1;
        oldRecs.push({ qid: '001', ans: 'B', ok: i % 2 === 0, time: t });
    }
    for (let j = 0; j < 60; j++) {
        newRecs.push({ qid: '002', ans: 'A', ok: true, time: now - j * 3600000 });
    }

    App.db.setData({
        history: [...oldRecs, ...newRecs],
        wrong: [],
        stats: { total: 1010, correct: 0, cats: {} },
        archive: [], achievements: []
    });

    // 触发归档
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: now });

    const d = App.db.get();
    assert.ok(d.history.length <= 1000, '归档后 history 应被压缩');
    assert.ok(d.archive.length > 0, '应有归档数据');

    let archiveTotal = 0;
    for (const a of d.archive) archiveTotal += a.total;
    assert.equal(archiveTotal, 950, '归档总计应等于严格早于 cutoff 的旧记录数');
});

test('归档应去除已存在于 archive 的日期，避免重复', () => {
    const { App } = freshCtx();
    const now = Date.now();
    const cutoff = now - 90 * 24 * 60 * 60 * 1000;

    const existingDate = new Date(cutoff - 86400000);
    const existingKey = existingDate.getFullYear() + '-' + (existingDate.getMonth() + 1) + '-' + existingDate.getDate();

    App.db.setData({
        history: [],
        wrong: [],
        stats: { total: 0, correct: 0, cats: {} },
        archive: [{ date: existingKey, total: 5, correct: 3 }],
        achievements: []
    });

    // 构造归档触发：999 条旧记录 + 2 条刚好落在 existingKey 那一天 + 1 条新记录
    const oldRecs = [];
    for (let i = 0; i < 999; i++) {
        oldRecs.push({ qid: '001', ans: 'B', ok: true, time: cutoff - 2 * 86400000 - i });
    }
    for (let k = 0; k < 2; k++) {
        const d0 = new Date(existingDate);
        d0.setHours(12, 0, 0, 0);
        oldRecs.push({ qid: '001', ans: 'B', ok: true, time: d0.getTime() + k });
    }

    App.db.setData({
        history: oldRecs,
        wrong: [],
        stats: { total: oldRecs.length, correct: 0, cats: {} },
        archive: [{ date: existingKey, total: 5, correct: 3 }],
        achievements: []
    });

    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: now });

    const d = App.db.get();
    const sameDayArchives = d.archive.filter(a => a.date === existingKey);
    assert.equal(sameDayArchives.length, 1, '已存在日期的归档条目不应被重复添加');
    assert.equal(sameDayArchives[0].total, 5, '原归档条目应保持不变');
});

// ============================================================
// recalcStats - 从 history 重算 stats
// ============================================================
test('recalcStats() 从 history 精确重建 stats，清除脏分类数据', () => {
    const { App } = freshCtx();
    const now = Date.now();

    App.db.setData({
        history: [
            { qid: '001', ans: 'B', ok: true, time: now },
            { qid: '001', ans: 'A', ok: false, time: now },
            { qid: '002', ans: 'A', ok: true, time: now },
        ],
        wrong: [],
        stats: { total: 999, correct: 999, cats: { '不存在分类': { t: 999, c: 999 } } },
        archive: [], achievements: []
    });

    App.db.recalcStats();
    const d = App.db.get();

    assert.equal(d.stats.total, 3);
    assert.equal(d.stats.correct, 2);
    assert.equal(d.stats.cats['专辑'].t, 2);
    assert.equal(d.stats.cats['专辑'].c, 1);
    assert.equal(d.stats.cats['歌曲'].t, 1);
    assert.equal(d.stats.cats['歌曲'].c, 1);
    assert.ok(!d.stats.cats['不存在分类']);
});

// ============================================================
// 连续打卡 getStreak
// ============================================================
function dateKey(dayOffset) {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
}

function daysFromToday(...offsets) {
    const history = [];
    const archive = [];
    const cats = {};
    for (const off of offsets) {
        const d = new Date();
        d.setDate(d.getDate() - off);
        d.setHours(12, 0, 0, 0);
        if (d.getTime() > Date.now() - 90 * 86400000) {
            history.push({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
        } else {
            archive.push({ date: dateKey(off), total: 1, correct: 1 });
        }
    }
    // 确保有 first_answer 成就触发 stats.cats 不为空
    return { history, archive };
}

test('getStreak() 无历史数据返回 0', () => {
    const { App } = freshCtx();
    assert.equal(App.db.getStreak(), 0);
});

test('getStreak() 今日答题返回 1', () => {
    const { App } = freshCtx();
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    assert.equal(App.db.getStreak(), 1);
});

test('getStreak() 今日未答题但昨日有，从昨日起算返回 1', () => {
    const { App } = freshCtx();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    App.db.setData({
        history: [{ qid: '001', ans: 'B', ok: true, time: yesterday.getTime() }],
        wrong: [], stats: { total: 1, correct: 1, cats: {} },
        archive: [], achievements: []
    });
    assert.equal(App.db.getStreak(), 1);
});

test('getStreak() 连续 7 天返回 7', () => {
    const { App } = freshCtx();
    const history = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(12, 0, 0, 0);
        history.push({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
    }
    App.db.setData({
        history, wrong: [], stats: { total: 7, correct: 7, cats: {} },
        archive: [], achievements: []
    });
    assert.equal(App.db.getStreak(), 7);
});

test('getStreak() 中间断一天时，返回从最近答题日起的连续天数', () => {
    const { App } = freshCtx();
    // 今天(day 0)、昨天(day 1)、大前天(day 3)有答题，但 day 2 没有
    // 算法从今天0点往前找：今天存在→+1，昨天存在→+1，前天不存在→break
    // 所以结果是 2
    const history = [];
    for (const off of [0, 1, 3]) {
        const d = new Date();
        d.setDate(d.getDate() - off);
        d.setHours(12, 0, 0, 0);
        history.push({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
    }
    App.db.setData({
        history, wrong: [], stats: { total: 3, correct: 3, cats: {} },
        archive: [], achievements: []
    });
    assert.equal(App.db.getStreak(), 2,
        '从最近一天起连续往回找：今天→昨天(2天)，前天断开');
});

test('getStreak() 归档数据中的日期也计入连续打卡', () => {
    const { App } = freshCtx();
    const history = [];
    const archive = [];
    // 今天、昨天放 history
    for (const off of [0, 1]) {
        const d = new Date();
        d.setDate(d.getDate() - off);
        d.setHours(12, 0, 0, 0);
        history.push({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
    }
    // 大前天（day 2）放 archive
    const d3 = new Date();
    d3.setDate(d3.getDate() - 2);
    archive.push({
        date: d3.getFullYear() + '-' + (d3.getMonth()) + '-' + d3.getDate(),
        total: 1, correct: 1
    });
    App.db.setData({
        history, wrong: [], stats: { total: 2, correct: 2, cats: {} },
        archive, achievements: []
    });
    assert.equal(App.db.getStreak(), 3, 'history 的 2 天 + archive 的 1 天应连续');
});

// ============================================================
// 成就徽章 checkAchievements
// ============================================================
test('first_answer - 完成第 1 次答题即解锁', () => {
    const { App } = freshCtx();
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'first_answer'));
    assert.ok(App.db.getAchievements().includes('first_answer'));
});

test('total_100 - 累计 100 题解锁', () => {
    const { App } = freshCtx();
    const now = Date.now();
    const history = [];
    for (let i = 0; i < 100; i++) {
        history.push({ qid: '001', ans: 'B', ok: true, time: now });
    }
    App.db.setData({
        history, wrong: [], stats: { total: 100, correct: 100, cats: {} },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'total_100'));
});

test('total_500 - 累计 500 题解锁', () => {
    const { App } = freshCtx();
    const now = Date.now();
    const history = [];
    for (let i = 0; i < 500; i++) {
        history.push({ qid: '001', ans: 'B', ok: true, time: now });
    }
    App.db.setData({
        history, wrong: [], stats: { total: 500, correct: 500, cats: {} },
        archive: [], achievements: ['first_answer', 'total_100']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'total_500'));
});

test('acc_90 - 满 50 题且正确率 90% 解锁', () => {
    const { App } = freshCtx();
    const now = Date.now();
    const history = [];
    for (let i = 0; i < 45; i++) history.push({ qid: '001', ans: 'B', ok: true, time: now });
    for (let j = 0; j < 5; j++) history.push({ qid: '001', ans: 'B', ok: false, time: now });
    App.db.setData({
        history, wrong: [], stats: { total: 50, correct: 45, cats: {} },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'acc_90'), '45/50=90% 满足条件');
});

test('acc_90 - 总数不足 50 不解锁，即使正确率很高', () => {
    const { App } = freshCtx();
    const now = Date.now();
    const history = [];
    for (let i = 0; i < 49; i++) history.push({ qid: '001', ans: 'B', ok: true, time: now });
    App.db.setData({
        history, wrong: [], stats: { total: 49, correct: 49, cats: {} },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(!unlocks.some(a => a.id === 'acc_90'));
});

test('acc_90 - 正确率低于 90% 不解锁', () => {
    const { App } = freshCtx();
    const now = Date.now();
    const history = [];
    for (let i = 0; i < 50; i++) history.push({ qid: '001', ans: 'B', ok: true, time: now });
    for (let j = 0; j < 10; j++) history.push({ qid: '001', ans: 'B', ok: false, time: now });
    App.db.setData({
        history, wrong: [], stats: { total: 60, correct: 50, cats: {} },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(!unlocks.some(a => a.id === 'acc_90'), '50/60=83% 不满足');
});

test('perfect_10 - 单次 10 题全部答对解锁', () => {
    const { App } = freshCtx();
    App.db.setData({
        history: [{ qid: '001', ans: 'B', ok: true, time: Date.now() }],
        wrong: [], stats: { total: 1, correct: 1, cats: {} },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    assert.ok(unlocks.some(a => a.id === 'perfect_10'));
});

test('perfect_10 - quizTotal 不足 10 不解锁', () => {
    const { App } = freshCtx();
    App.db.setData({
        history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
        archive: [], achievements: []
    });
    const unlocks = App.db.checkAchievements({ quizTotal: 9, quizCorrect: 9 });
    assert.ok(!unlocks.some(a => a.id === 'perfect_10'));
});

test('daily_50 - 单日答题 50 题解锁', () => {
    const { App } = freshCtx();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const history = [];
    for (let i = 0; i < 50; i++) {
        history.push({ qid: '001', ans: 'B', ok: true, time: todayStart.getTime() + i * 1000 });
    }
    App.db.setData({
        history, wrong: [], stats: { total: 50, correct: 50, cats: {} },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'daily_50'));
});

test('streak_3 和 streak_7 - 连续 3/7 天解锁对应徽章', () => {
    const { App } = freshCtx();
    const history = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(12, 0, 0, 0);
        history.push({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
    }
    App.db.setData({
        history, wrong: [], stats: { total: 7, correct: 7, cats: {} },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'streak_3'), '3 天连应解锁');
    assert.ok(unlocks.some(a => a.id === 'streak_7'), '7 天连应解锁');
});

test('wrong_clear - 错题本空 + 有 first_answer + total>0 时解锁', () => {
    const { App } = freshCtx();
    App.db.setData({
        history: [{ qid: '001', ans: 'B', ok: true, time: Date.now() }],
        wrong: [],
        stats: { total: 1, correct: 1, cats: {} },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'wrong_clear'),
        '空错题本 + first_answer + total>0 应解锁 wrong_clear');
});

test('wrong_clear - 有错题存在时不解锁', () => {
    const { App } = freshCtx();
    App.db.setData({
        history: [{ qid: '001', ans: 'B', ok: true, time: Date.now() }],
        wrong: [{ qid: '002', cnt: 1, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() }],
        stats: { total: 1, correct: 1, cats: {} },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(!unlocks.some(a => a.id === 'wrong_clear'));
});

test('all_cats - 4 个分类都有答题记录才解锁', () => {
    const { App } = freshCtx();
    const cats = {
        '专辑': { t: 5, c: 4 },
        '歌曲': { t: 3, c: 3 },
        '个人信息': { t: 2, c: 1 },
        '获奖记录': { t: 1, c: 0 }
    };
    App.db.setData({
        history: [], wrong: [],
        stats: { total: 11, correct: 8, cats },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'all_cats'));
});

test('all_cats - 缺少任何一个分类都不解锁', () => {
    const { App } = freshCtx();
    const cats = {
        '专辑': { t: 5, c: 4 },
        '歌曲': { t: 3, c: 3 },
        '个人信息': { t: 2, c: 1 },
    };
    App.db.setData({
        history: [], wrong: [],
        stats: { total: 10, correct: 8, cats },
        archive: [], achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    assert.ok(!unlocks.some(a => a.id === 'all_cats'));
});

test('checkAchievements - 同成就不会重复触发解锁', () => {
    const { App } = freshCtx();
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    const u1 = App.db.checkAchievements();
    assert.ok(u1.some(a => a.id === 'first_answer'));

    // 再次检查不应返回相同成就
    const u2 = App.db.checkAchievements();
    assert.ok(!u2.some(a => a.id === 'first_answer'));
});

// ============================================================
// 每日目标边界
// ============================================================
test('setDailyGoal() 边界：<5 夹到 5，>100 夹到 100', () => {
    const { App } = freshCtx();
    App.db.setDailyGoal(1);
    assert.equal(App.db.getDailyGoal(), 5);
    App.db.setDailyGoal(0);
    assert.equal(App.db.getDailyGoal(), 5);
    App.db.setDailyGoal(999);
    assert.equal(App.db.getDailyGoal(), 100);
    App.db.setDailyGoal(-50);
    assert.equal(App.db.getDailyGoal(), 5);
});

test('setDailyGoal() 正常值直接设置，含边界值 5 和 100', () => {
    const { App } = freshCtx();
    App.db.setDailyGoal(20);
    assert.equal(App.db.getDailyGoal(), 20);
    App.db.setDailyGoal(100);
    assert.equal(App.db.getDailyGoal(), 100);
    App.db.setDailyGoal(5);
    assert.equal(App.db.getDailyGoal(), 5);
});

test('getDailyGoal() 无数据时默认 20', () => {
    const { App } = freshCtx();
    assert.equal(App.db.getDailyGoal(), 20);
});

// ============================================================
// findQ - 跨模块多处调用
// ============================================================
test('findQ() 找到已知题目返回完整对象，找不到返回 null', () => {
    const { App } = freshCtx();
    const q = App.db.findQ('001');
    assert.ok(q);
    assert.equal(q.id, '001');
    assert.equal(q.category, '专辑');
    assert.equal(q.answer, 'B');
    assert.ok(q.options && q.options.length === 4);
    assert.equal(App.db.findQ('NOTEXIST'), null);
    assert.equal(App.db.findQ(''), null);
});

// ============================================================
// defaults 独立性
// ============================================================
test('defaults() 每次调用返回独立副本，互不影响', () => {
    const { App } = freshCtx();
    const d1 = App.db.defaults();
    const d2 = App.db.defaults();
    assert.deepEqual(d1, d2);
    d1.history.push({ foo: 'bar' });
    assert.equal(d2.history.length, 0, 'defaults 副本不应共享引用');
});
