const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { setup, loadScript } = require('./setup');

async function bootstrap() {
    setup();
    loadScript(path.join(__dirname, '..', 'js', 'data.js'));
    loadScript(path.join(__dirname, '..', 'js', 'storage.js'));
    await global.App.db.init();
}

async function freshCache() {
    await bootstrap();
    global.App.db.setData(global.App.db.defaults());
}

// ============================================================
// 间隔重复算法：addWrong / reviewCorrect / reviewWrong
// ============================================================

test('addWrong: 首次添加错题应初始化为 level 0, cnt 1', async () => {
    await freshCache();
    global.App.db.addWrong('001');
    const wrong = global.App.db.getWrong();
    assert.equal(wrong.length, 1);
    assert.equal(wrong[0].qid, '001');
    assert.equal(wrong[0].cnt, 1);
    assert.equal(wrong[0].level, 0);
    assert.ok(wrong[0].nextReview >= Date.now() - 1000);
});

test('addWrong: 重复添加同一错题应重置等级并累加次数', async () => {
    await freshCache();
    global.App.db.addWrong('001');
    global.App.db.addWrong('001');
    const wrong = global.App.db.getWrong();
    assert.equal(wrong.length, 1);
    assert.equal(wrong[0].cnt, 2);
    assert.equal(wrong[0].level, 0);
});

test('reviewCorrect: level 0 -> 1 应设置下一次复习间隔为 1 小时', async () => {
    await freshCache();
    global.App.db.addWrong('001');
    const before = Date.now();
    const result = global.App.db.reviewCorrect('001');
    const after = Date.now();
    assert.equal(result.level, 1);
    assert.equal(result.mastered, false);
    const wrong = global.App.db.getWrong();
    assert.equal(wrong[0].level, 1);
    const expectedMin = before + 60 * 60 * 1000;
    const expectedMax = after + 60 * 60 * 1000;
    assert.ok(wrong[0].nextReview >= expectedMin, 'nextReview 应 >= 1小时后');
    assert.ok(wrong[0].nextReview <= expectedMax, 'nextReview 应 <= 1小时后');
});

test('reviewCorrect: level 4 -> 5 应标记为已掌握并从错题本移除', async () => {
    await freshCache();
    global.App.db.addWrong('001');
    // 升到 level 4
    global.App.db.reviewCorrect('001'); // -> 1
    global.App.db.reviewCorrect('001'); // -> 2
    global.App.db.reviewCorrect('001'); // -> 3
    global.App.db.reviewCorrect('001'); // -> 4
    const result = global.App.db.reviewCorrect('001'); // -> 5, mastered
    assert.equal(result.mastered, true);
    assert.equal(result.qid, '001');
    const wrong = global.App.db.getWrong();
    assert.equal(wrong.length, 0);
});

test('reviewCorrect: 对不在错题本中的题目调用应返回 { mastered: false }', async () => {
    await freshCache();
    const result = global.App.db.reviewCorrect('999');
    assert.equal(result.mastered, false);
    assert.equal(result.qid, '999');
});

test('reviewWrong: 答对错题本中的错题应重置 level = 0 并累加 cnt', async () => {
    await freshCache();
    global.App.db.addWrong('001');
    global.App.db.reviewCorrect('001'); // level 1
    global.App.db.reviewCorrect('001'); // level 2
    global.App.db.reviewWrong('001');
    const wrong = global.App.db.getWrong();
    assert.equal(wrong[0].level, 0);
    assert.equal(wrong[0].cnt, 2); // 初始 + 这次答错
});

test('reviewWrong: 对不在错题本中的题目应自动添加', async () => {
    await freshCache();
    global.App.db.reviewWrong('002');
    const wrong = global.App.db.getWrong();
    assert.equal(wrong.length, 1);
    assert.equal(wrong[0].qid, '002');
    assert.equal(wrong[0].cnt, 1);
    assert.equal(wrong[0].level, 0);
});

// ============================================================
// 间隔时间梯度：验证每个 level 的间隔正确
// ============================================================

test('间隔时间: level 0-1 为 1小时', async () => {
    await freshCache();
    global.App.db.addWrong('001');
    global.App.db.reviewCorrect('001');
    const interval = global.App.db.getWrong()[0].nextReview - Date.now();
    assert.ok(interval > 55 * 60 * 1000 && interval < 65 * 60 * 1000, '应为约1小时');
});

test('间隔时间: level 1-2 为 1天', async () => {
    await freshCache();
    global.App.db.addWrong('001');
    global.App.db.reviewCorrect('001'); // 1
    global.App.db.reviewCorrect('001'); // 2
    const interval = global.App.db.getWrong()[0].nextReview - Date.now();
    assert.ok(interval > 23 * 60 * 60 * 1000 && interval < 25 * 60 * 60 * 1000, '应为约1天');
});

test('间隔时间: level 2-3 为 3天', async () => {
    await freshCache();
    global.App.db.addWrong('001');
    for (let i = 0; i < 3; i++) global.App.db.reviewCorrect('001');
    const interval = global.App.db.getWrong()[0].nextReview - Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    assert.ok(interval > threeDays - 60 * 60 * 1000 && interval < threeDays + 60 * 60 * 1000);
});

test('间隔时间: level 3-4 为 7天', async () => {
    await freshCache();
    global.App.db.addWrong('001');
    for (let i = 0; i < 4; i++) global.App.db.reviewCorrect('001');
    const interval = global.App.db.getWrong()[0].nextReview - Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    assert.ok(interval > sevenDays - 60 * 60 * 1000 && interval < sevenDays + 60 * 60 * 1000);
});

// ============================================================
// getDueWrong: 到期错题筛选
// ============================================================

test('getDueWrong: nextReview 为 0 或已过期的应返回', async () => {
    await freshCache();
    const now = Date.now();
    global.App.db.setData({
        ...global.App.db.defaults(),
        wrong: [
            { qid: '001', cnt: 1, level: 0, nextReview: 0, time: now },
            { qid: '002', cnt: 2, level: 1, nextReview: now - 100, time: now },
            { qid: '003', cnt: 1, level: 2, nextReview: now + 60000, time: now },
        ]
    });
    const due = global.App.db.getDueWrong();
    const ids = due.map(w => w.qid).sort();
    assert.deepEqual(ids, ['001', '002']);
});

// ============================================================
// addRecord: 答题记录 + 分类统计
// ============================================================

test('addRecord: 正确答题应增加 total 和 correct', async () => {
    await freshCache();
    global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    const s = global.App.db.get().stats;
    assert.equal(s.total, 1);
    assert.equal(s.correct, 1);
});

test('addRecord: 错误答题只增加 total 不增加 correct', async () => {
    await freshCache();
    global.App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
    const s = global.App.db.get().stats;
    assert.equal(s.total, 1);
    assert.equal(s.correct, 0);
});

test('addRecord: 应按 category 累加分类统计', async () => {
    await freshCache();
    global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() }); // 专辑
    global.App.db.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() }); // 歌曲
    global.App.db.addRecord({ qid: '003', ans: 'B', ok: true, time: Date.now() }); // 歌曲
    const cats = global.App.db.get().stats.cats;
    assert.equal(cats['专辑'].t, 1);
    assert.equal(cats['专辑'].c, 1);
    assert.equal(cats['歌曲'].t, 2);
    assert.equal(cats['歌曲'].c, 1);
});

test('addRecord: 未知 qid 不应崩溃', async () => {
    await freshCache();
    global.App.db.addRecord({ qid: '999', ans: 'A', ok: true, time: Date.now() });
    const s = global.App.db.get().stats;
    assert.equal(s.total, 1);
    assert.equal(s.correct, 1);
    assert.deepEqual(s.cats, {});
});

// ============================================================
// 历史归档：超过 1000 条时按天聚合
// ============================================================

test('addRecord: 历史归档超过 1000 条时应触发归档', async () => {
    await freshCache();
    const now = Date.now();
    // 先造 90 天前的旧记录 900 条（450对 450错）
    const oldTime = now - 91 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 900; i++) {
        global.App.db.addRecord({ qid: '001', ans: 'B', ok: i % 2 === 0, time: oldTime + i * 1000 });
    }
    // 再造 200 条今天的记录（全对）
    for (let j = 0; j < 200; j++) {
        global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now - j * 1000 });
    }
    const d = global.App.db.get();
    assert.ok(d.history.length < 1100, 'history 应被截断');
    assert.ok(d.archive && d.archive.length > 0, '应产生归档数据');
    assert.equal(d.stats.total, 1100);
    assert.equal(d.stats.correct, 650); // 450旧 + 200新
});

test('addRecord: 归档按天聚合后不应产生重复日期', async () => {
    await freshCache();
    const now = Date.now();
    const oldTime = now - 91 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 900; i++) {
        global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: oldTime + i * 1000 });
    }
    for (let j = 0; j < 200; j++) {
        global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now - j * 1000 });
    }
    const archive = global.App.db.get().archive;
    const keys = archive.map(a => a.date);
    const unique = new Set(keys);
    assert.equal(keys.length, unique.size, '归档日期不应有重复');
});

// ============================================================
// recalcStats: 从 history 重新计算
// ============================================================

test('recalcStats: 应从 history 重新生成正确的 stats', async () => {
    await freshCache();
    const now = Date.now();
    // 直接设置错误的 stats，然后通过 history 重算
    global.App.db.setData({
        ...global.App.db.defaults(),
        history: [
            { qid: '001', ans: 'B', ok: true, time: now },
            { qid: '002', ans: 'B', ok: false, time: now },
            { qid: '003', ans: 'B', ok: true, time: now },
        ],
        stats: { total: 99, correct: 1, cats: {} } // 错误的 stats
    });
    global.App.db.recalcStats();
    const s = global.App.db.get().stats;
    assert.equal(s.total, 3);
    assert.equal(s.correct, 2);
    assert.equal(s.cats['专辑'].t, 1);
    assert.equal(s.cats['歌曲'].t, 2);
});

// ============================================================
// getStreak: 连续打卡天数
// ============================================================

test('getStreak: 无答题记录返回 0', async () => {
    await freshCache();
    assert.equal(global.App.db.getStreak(), 0);
});

test('getStreak: 只有今天答题返回 1', async () => {
    await freshCache();
    global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    assert.equal(global.App.db.getStreak(), 1);
});

test('getStreak: 连续三天答题返回 3', async () => {
    await freshCache();
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const day1 = today.getTime();
    const day2 = day1 - 24 * 60 * 60 * 1000;
    const day3 = day2 - 24 * 60 * 60 * 1000;
    global.App.db.setData({
        ...global.App.db.defaults(),
        history: [
            { qid: '001', ans: 'B', ok: true, time: day1 },
            { qid: '002', ans: 'B', ok: true, time: day2 },
            { qid: '003', ans: 'B', ok: true, time: day3 },
        ],
        stats: { total: 3, correct: 3, cats: {} }
    });
    assert.equal(global.App.db.getStreak(), 3);
});

test('getStreak: 中断后只返回最近连续天数', async () => {
    await freshCache();
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    global.App.db.setData({
        ...global.App.db.defaults(),
        history: [
            { qid: '001', ans: 'B', ok: true, time: today.getTime() },
            { qid: '002', ans: 'B', ok: true, time: today.getTime() - 24 * 60 * 60 * 1000 },
            // 昨天的昨天没答题，中断
            { qid: '003', ans: 'B', ok: true, time: today.getTime() - 3 * 24 * 60 * 60 * 1000 },
        ],
        stats: { total: 3, correct: 3, cats: {} }
    });
    assert.equal(global.App.db.getStreak(), 2);
});

test('getStreak: 合并 archive 数据中的日期', async () => {
    await freshCache();
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const day1 = today.getTime();
    const day2 = day1 - 24 * 60 * 60 * 1000;
    global.App.db.setData({
        ...global.App.db.defaults(),
        history: [
            { qid: '001', ans: 'B', ok: true, time: day1 },
            { qid: '002', ans: 'B', ok: true, time: day2 },
        ],
        // 归档中保存 2 天前和 3 天前（填补连续 gap）
        archive: [
            { date: formatDate(today.getTime() - 2 * 24 * 60 * 60 * 1000), total: 10, correct: 8 },
            { date: formatDate(today.getTime() - 3 * 24 * 60 * 60 * 1000), total: 10, correct: 8 },
        ],
        stats: { total: 2, correct: 2, cats: {} }
    });
    // 15+14 (history) + 13+12 (archive) = 4 天连续
    assert.equal(global.App.db.getStreak(), 4);
});

function formatDate(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

// ============================================================
// setDailyGoal: 边界值 clamp
// ============================================================

test('setDailyGoal: 小于 5 的值应被 clamp 到 5', async () => {
    await freshCache();
    global.App.db.setDailyGoal(1);
    assert.equal(global.App.db.getDailyGoal(), 5);
});

test('setDailyGoal: 大于 100 的值应被 clamp 到 100', async () => {
    await freshCache();
    global.App.db.setDailyGoal(999);
    assert.equal(global.App.db.getDailyGoal(), 100);
});

test('setDailyGoal: 5-100 范围内的值正常保存', async () => {
    await freshCache();
    global.App.db.setDailyGoal(50);
    assert.equal(global.App.db.getDailyGoal(), 50);
});

test('setDailyGoal: 边界值 5 和 100 正常保存', async () => {
    await freshCache();
    global.App.db.setDailyGoal(5);
    assert.equal(global.App.db.getDailyGoal(), 5);
    global.App.db.setDailyGoal(100);
    assert.equal(global.App.db.getDailyGoal(), 100);
});

// ============================================================
// findQ: 查找题目
// ============================================================

test('findQ: 存在的题目应返回完整对象', async () => {
    await bootstrap();
    const q = global.App.db.findQ('001');
    assert.ok(q);
    assert.equal(q.id, '001');
    assert.equal(q.category, '专辑');
    assert.equal(q.options.length, 4);
});

test('findQ: 不存在的题目应返回 null', async () => {
    await bootstrap();
    assert.equal(global.App.db.findQ('ZZZ'), null);
});

// ============================================================
// checkAchievements: 成就系统
// ============================================================

test('成就: first_answer 在 total >= 1 时解锁', async () => {
    await freshCache();
    global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    const unlocks = global.App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'first_answer'));
});

test('成就: total_100 在 total >= 100 时解锁', async () => {
    await freshCache();
    const now = Date.now();
    for (let i = 0; i < 100; i++) {
        global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now - i * 1000 });
    }
    const unlocks = global.App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'total_100'));
});

test('成就: acc_90 在 total >= 50 且正确率 >= 90% 时解锁', async () => {
    await freshCache();
    const now = Date.now();
    // 45 对 5 错 = 90%
    for (let i = 0; i < 45; i++) global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now - i * 1000 });
    for (let j = 0; j < 5; j++) global.App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: now - (j + 50) * 1000 });
    const unlocks = global.App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'acc_90'));
});

test('成就: perfect_10 需传入 context.quizCorrect === quizTotal >= 10', async () => {
    await freshCache();
    const now = Date.now();
    for (let i = 0; i < 10; i++) global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now - i * 1000 });
    // 无 context
    let unlocks = global.App.db.checkAchievements();
    assert.ok(!unlocks.some(a => a.id === 'perfect_10'), '无 context 时不应解锁 perfect_10');
    // 有 context 全部答对
    unlocks = global.App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    assert.ok(unlocks.some(a => a.id === 'perfect_10'), '全部答对应解锁 perfect_10');
});

test('成就: streak_3 在连续打卡 >= 3 天时解锁', async () => {
    await freshCache();
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    global.App.db.setData({
        ...global.App.db.defaults(),
        history: [
            { qid: '001', ans: 'B', ok: true, time: today.getTime() },
            { qid: '002', ans: 'B', ok: true, time: today.getTime() - 86400000 },
            { qid: '003', ans: 'B', ok: true, time: today.getTime() - 2 * 86400000 },
        ],
        stats: { total: 3, correct: 3, cats: {} }
    });
    const unlocks = global.App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'streak_3'));
});

test('成就: daily_50 当日答题 >= 50 时解锁', async () => {
    await freshCache();
    const now = Date.now();
    for (let i = 0; i < 50; i++) global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now - i * 1000 });
    const unlocks = global.App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'daily_50'));
});

test('成就: wrong_clear 在错题本清零后解锁', async () => {
    await freshCache();
    // 先答题解锁 first_answer
    global.App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
    // 再把错题答对掌握
    for (let i = 0; i < 5; i++) global.App.db.reviewCorrect('001');
    assert.equal(global.App.db.getWrong().length, 0);
    const unlocks = global.App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'wrong_clear'), '错题清空应解锁 wrong_clear');
});

test('成就: 重复调用不应重复解锁', async () => {
    await freshCache();
    global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    global.App.db.checkAchievements(); // 解锁
    const unlocks2 = global.App.db.checkAchievements(); // 再调用
    const firstAnswerCount = unlocks2.filter(a => a.id === 'first_answer').length;
    assert.ok(firstAnswerCount <= 1);
});

test('成就: all_cats 在所有分类都有答题记录时解锁', async () => {
    await freshCache();
    const now = Date.now();
    // 每个分类答一题
    global.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now }); // 专辑
    global.App.db.addRecord({ qid: '002', ans: 'A', ok: true, time: now }); // 歌曲
    global.App.db.addRecord({ qid: '061', ans: 'B', ok: true, time: now }); // 个人信息
    global.App.db.addRecord({ qid: '069', ans: 'C', ok: true, time: now }); // 获奖记录
    const unlocks = global.App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'all_cats'));
});

// ============================================================
// removeWrong
// ============================================================

test('removeWrong: 应从错题本中移除指定题目', async () => {
    await freshCache();
    global.App.db.addWrong('001');
    global.App.db.addWrong('002');
    global.App.db.removeWrong('001');
    const wrong = global.App.db.getWrong();
    assert.equal(wrong.length, 1);
    assert.equal(wrong[0].qid, '002');
});

// ============================================================
// session: 会话持久化
// ============================================================

test('App.session: save/load/clear 完整流程', async () => {
    await bootstrap();
    const state = {
        quiz: [{ id: '001' }],
        idx: 2,
        correctCount: 5,
        startTime: 12345,
        mode: 'standard',
        isWrongBookQuiz: true
    };
    global.App.session.save(state);
    const loaded = global.App.session.load();
    assert.equal(loaded.idx, 2);
    assert.equal(loaded.correctCount, 5);
    assert.equal(loaded.mode, 'standard');
    assert.equal(loaded.isWrongBookQuiz, true);
    assert.deepEqual(loaded.quizIds, ['001']);

    global.App.session.clear();
    assert.equal(global.App.session.load(), null);
});
