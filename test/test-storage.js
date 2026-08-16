const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestEnv, loadAllSources } = require('./setup.js');

function setup() {
    const { window } = createTestEnv();
    loadAllSources(window);
    return window;
}

// ============ XSS 转义测试 ============

test('esc - 转义 HTML 特殊字符', () => {
    const window = setup();
    const App = window.App;
    assert.equal(App.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(App.esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(App.esc('纯文本'), '纯文本');
    assert.equal(App.esc(null), '');
    assert.equal(App.esc(undefined), '');
    assert.equal(App.esc(0), '0');
});

// ============ 默认数据 ============

test('db.defaults() 返回正确结构', () => {
    const window = setup();
    const App = window.App;
    const d = App.db.defaults();
    assert.equal(d.history.length, 0);
    assert.equal(d.wrong.length, 0);
    assert.equal(d.stats.total, 0);
    assert.equal(d.stats.correct, 0);
    assert.equal(Object.keys(d.stats.cats).length, 0);
    assert.equal(d.theme, 'dark');
    assert.equal(d.dailyGoal, 20);
    assert.equal(d.achievements.length, 0);
    assert.equal(d.archive.length, 0);
});

// ============ addRecord + findQ ============

test('addRecord - 正确更新 total/correct/stats.cats', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const qid = App.QUESTION_BANK[0].id;
    const cat = App.QUESTION_BANK[0].category;

    App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });
    let d = App.db.get();
    assert.equal(d.stats.total, 1);
    assert.equal(d.stats.correct, 1);
    assert.equal(d.stats.cats[cat].t, 1);
    assert.equal(d.stats.cats[cat].c, 1);

    App.db.addRecord({ qid, ans: 'B', ok: false, time: Date.now() });
    d = App.db.get();
    assert.equal(d.stats.total, 2);
    assert.equal(d.stats.correct, 1);
    assert.equal(d.stats.cats[cat].t, 2);
    assert.equal(d.stats.cats[cat].c, 1);
});

test('findQ - 找到/找不到题目', () => {
    const window = setup();
    const App = window.App;
    const q = App.db.findQ('001');
    assert.ok(q, '应能找到 id=001 的题目');
    assert.equal(q.question, App.QUESTION_BANK[0].question);

    const notFound = App.db.findQ('nonexistent');
    assert.equal(notFound, null);
});

test('addRecord - history 归档：超过 1000 条时聚合 90 天前记录', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const now = Date.now();
    const qid = App.QUESTION_BANK[0].id;

    const oldTime = now - 91 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 900; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: i % 2 === 0, time: oldTime });
    }
    for (let i = 0; i < 101; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: now });
    }

    const d = App.db.get();
    assert.ok(d.history.length <= 1000, '归档后 history 应 <= 1000');
    assert.ok(d.archive.length > 0, '应有归档数据');
    assert.equal(d.stats.total, 1001);
});

test('addRecord - 归档同日数据不重复归档', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const qid = App.QUESTION_BANK[0].id;
    const oldTime = Date.now() - 91 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 900; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: oldTime });
    }
    for (let i = 0; i < 101; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });
    }
    const archCount1 = App.db.get().archive.length;

    for (let i = 0; i < 900; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: oldTime });
    }
    for (let i = 0; i < 101; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });
    }
    const archCount2 = App.db.get().archive.length;
    assert.equal(archCount2, archCount1, '归档数据不应重复添加');
});

// ============ 间隔重复：addWrong ============

test('addWrong - 新增错题', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const qid = 'test_qid_001';

    App.db.addWrong(qid);
    const wrong = App.db.getWrong();
    assert.equal(wrong.length, 1);
    assert.equal(wrong[0].qid, qid);
    assert.equal(wrong[0].cnt, 1);
    assert.equal(wrong[0].level, 0);
    assert.ok(wrong[0].nextReview <= Date.now());
});

test('addWrong - 重复添加重置等级', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const qid = 'test_qid_002';

    App.db.addWrong(qid);
    App.db.getWrong()[0].level = 3;
    App.db.getWrong()[0].cnt = 5;

    App.db.addWrong(qid);
    const w = App.db.getWrong()[0];
    assert.equal(w.cnt, 6, 'cnt 应增加');
    assert.equal(w.level, 0, 'level 应重置为 0');
    assert.ok(w.nextReview <= Date.now(), '应立即可复习');
});

// ============ 间隔重复：reviewCorrect ============

test('reviewCorrect - 逐级提升等级至掌握', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const qid = 'test_qid_003';
    App.db.addWrong(qid);

    // 第 1 次正确 => level 0->1, mastered=false
    let r = App.db.reviewCorrect(qid);
    assert.equal(r.level, 1);
    assert.equal(r.mastered, false);
    // 第 2 次 => level 2
    r = App.db.reviewCorrect(qid);
    assert.equal(r.level, 2);
    assert.equal(r.mastered, false);
    // 第 3 次 => level 3
    r = App.db.reviewCorrect(qid);
    assert.equal(r.level, 3);
    assert.equal(r.mastered, false);
    // 第 4 次 => level 4
    r = App.db.reviewCorrect(qid);
    assert.equal(r.level, 4);
    assert.equal(r.mastered, false);
    // 第 5 次 => level 5 => mastered=true，已移除
    r = App.db.reviewCorrect(qid);
    assert.equal(r.mastered, true);
    assert.equal(App.db.getWrong().length, 0, '掌握后应从错题本移除');
});

test('reviewCorrect - 不存在的题目返回 mastered=false', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const result = App.db.reviewCorrect('nonexistent_qid');
    assert.equal(result.mastered, false);
    assert.equal(result.qid, 'nonexistent_qid');
});

// ============ 间隔重复：reviewWrong ============

test('reviewWrong - 重置等级为 0 并增加 cnt', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const qid = 'test_qid_004';
    App.db.addWrong(qid);
    App.db.getWrong()[0].level = 3;
    App.db.getWrong()[0].cnt = 2;

    App.db.reviewWrong(qid);
    const w = App.db.getWrong()[0];
    assert.equal(w.level, 0);
    assert.equal(w.cnt, 3);
    assert.ok(w.nextReview <= Date.now());
});

test('reviewWrong - 不在错题本中则新增', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const qid = 'test_qid_005';
    assert.equal(App.db.getWrong().length, 0);

    App.db.reviewWrong(qid);
    const w = App.db.getWrong();
    assert.equal(w.length, 1);
    assert.equal(w[0].level, 0);
    assert.equal(w[0].cnt, 1);
});

// ============ 间隔重复：getDueWrong ============

test('getDueWrong - 返回到期的错题', () => {
    const window = setup();
    const App = window.App;
    App.db.init();

    App.db.addWrong('q_due_now');
    App.db.addWrong('q_future');
    App.db.getWrong()[1].nextReview = Date.now() + 3600 * 1000;

    const due = App.db.getDueWrong();
    assert.ok(due.some(w => w.qid === 'q_due_now'), '应包含到期的');
    assert.ok(!due.some(w => w.qid === 'q_future'), '不应包含未到期的');
});

// ============ 连续打卡 ============

test('getStreak - 无历史返回 0', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    assert.equal(App.db.getStreak(), 0);
});

test('getStreak - 连续打卡', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 5; i++) {
        App.db.addRecord({ qid: App.QUESTION_BANK[0].id, ans: 'A', ok: true, time: today.getTime() - i * 86400000 });
    }
    const streak = App.db.getStreak();
    assert.ok(streak >= 3, '应检测到至少 3 天连续打卡');
});

test('getStreak - 中间断档时正确计算', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    [0, 1, 2, 5].forEach(offset => {
        App.db.addRecord({
            qid: App.QUESTION_BANK[0].id, ans: 'A', ok: true,
            time: today.getTime() - offset * 86400000
        });
    });
    const streak = App.db.getStreak();
    assert.equal(streak, 3, '断档后应只计算连续的 3 天');
});

test('getStreak - 包含归档数据', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 归档中有昨天，history 中有今天 → 连续 2 天
    const archDate = new Date(today.getTime() - 1 * 86400000);
    const archKey = archDate.getFullYear() + '-' + (archDate.getMonth() + 1) + '-' + archDate.getDate();
    App.db.get().archive = [{ date: archKey, total: 1, correct: 1 }];

    App.db.addRecord({ qid: App.QUESTION_BANK[0].id, ans: 'A', ok: true, time: today.getTime() });

    const streak = App.db.getStreak();
    assert.ok(streak >= 2, `应包含归档日期计算连续天数，实际 streak=${streak}`);
});

test('getStreak - 今天未答题但昨天有记录', () => {
    const window = setup();
    const App = window.App;
    App.db.init();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    App.db.addRecord({ qid: App.QUESTION_BANK[0].id, ans: 'A', ok: true, time: today.getTime() - 86400000 });

    const streak = App.db.getStreak();
    assert.equal(streak, 1, '今天没答，昨天有，连续应为 1');
});

// ============ 每日目标 ============

test('setDailyGoal - 边界值限制在 5-100', () => {
    const window = setup();
    const App = window.App;
    App.db.init();

    App.db.setDailyGoal(3);
    assert.equal(App.db.getDailyGoal(), 5, '小于 5 应被钳制到 5');

    App.db.setDailyGoal(200);
    assert.equal(App.db.getDailyGoal(), 100, '大于 100 应被钳制到 100');

    App.db.setDailyGoal(50);
    assert.equal(App.db.getDailyGoal(), 50, '正常范围应直接设置');
});

// ============ recalcStats ============

test('recalcStats - 从 history 正确重算', () => {
    const window = setup();
    const App = window.App;
    App.db.init();

    App.db.get().stats = { total: 999, correct: 999, cats: {} };

    const qid = App.QUESTION_BANK[0].id;
    App.db.get().history = [
        { qid, ok: true, time: Date.now() },
        { qid, ok: false, time: Date.now() },
        { qid, ok: true, time: Date.now() }
    ];

    App.db.recalcStats();
    const s = App.db.get().stats;
    assert.equal(s.total, 3);
    assert.equal(s.correct, 2);
});

// ============ 成就徽章 ============

function makeAchieveData() {
    const window = setup();
    const App = window.App;
    App.db.init();
    return { window, App };
}

test('成就 - first_answer 在 total>=1 时解锁', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;
    App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'first_answer'), '第一次答题应解锁初出茅庐');
});

test('成就 - total_100 / total_500 累积答题数', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;

    for (let i = 0; i < 100; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });
    }
    let unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'total_100'), '累计 100 题应解锁百题斩');
    assert.ok(!unlocks.some(a => a.id === 'total_500'), '累计 100 题不应解锁五百题王');

    for (let i = 0; i < 400; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });
    }
    unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'total_500'), '累计 500 题应解锁五百题王');
});

test('成就 - acc_90 在答满 50 题且正确率 >= 90% 时解锁', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;

    for (let i = 0; i < 45; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });
    }
    for (let i = 0; i < 5; i++) {
        App.db.addRecord({ qid, ans: 'B', ok: false, time: Date.now() });
    }
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'acc_90'), '答满 50 题正确率 >= 90% 应解锁资深JM');
});

test('成就 - acc_90 边界 89% 不应解锁', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;

    for (let i = 0; i < 44; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });
    }
    for (let i = 0; i < 6; i++) {
        App.db.addRecord({ qid, ans: 'B', ok: false, time: Date.now() });
    }
    const unlocks = App.db.checkAchievements();
    assert.ok(!unlocks.some(a => a.id === 'acc_90'), '88% 正确率不应解锁');
});

test('成就 - perfect_10 单次 10 题全对', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;
    App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });

    const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    assert.ok(unlocks.some(a => a.id === 'perfect_10'), '单次 10 题全对应解锁十全十美');
});

test('成就 - perfect_10 未全对时不应解锁', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;
    App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });

    const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 9 });
    assert.ok(!unlocks.some(a => a.id === 'perfect_10'));
});

test('成就 - daily_50 单日答题 50 题', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (let i = 0; i < 50; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: todayStart.getTime() + i * 1000 });
    }
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'daily_50'), '单日 50 题应解锁勤奋粉丝');
});

test('成就 - streak_3 / streak_7 连续打卡', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    App.db.addRecord({ qid, ans: 'A', ok: true, time: today.getTime() });
    App.db.addRecord({ qid, ans: 'A', ok: true, time: today.getTime() - 86400000 });
    App.db.addRecord({ qid, ans: 'A', ok: true, time: today.getTime() - 2 * 86400000 });

    let unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'streak_3'), '连续 3 天应解锁三日坚持');
    assert.ok(!unlocks.some(a => a.id === 'streak_7'), '连续 3 天不应解锁七日之约');

    for (let i = 3; i < 7; i++) {
        App.db.addRecord({ qid, ans: 'A', ok: true, time: today.getTime() - i * 86400000 });
    }
    unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'streak_7'), '连续 7 天应解锁七日之约');
});

test('成就 - wrong_clear 错题本全部掌握', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;
    App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });

    assert.equal(App.db.getWrong().length, 0);
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'wrong_clear'), '错题本为空且有答题历史应解锁错题清零');
});

test('成就 - wrong_clear 有错题时不应解锁', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;
    App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });
    App.db.addWrong(qid);

    const unlocks = App.db.checkAchievements();
    assert.ok(!unlocks.some(a => a.id === 'wrong_clear'));
});

test('成就 - all_cats 所有分类都有答题记录', () => {
    const { App } = makeAchieveData();
    for (const q of App.QUESTION_BANK) {
        App.db.addRecord({ qid: q.id, ans: 'A', ok: true, time: Date.now() });
    }
    const unlocks = App.db.checkAchievements();
    assert.ok(unlocks.some(a => a.id === 'all_cats'), '所有分类都有记录应解锁全能粉丝');
});

test('成就 - all_cats 缺分类时不应解锁', () => {
    const { App } = makeAchieveData();
    const albumQ = App.QUESTION_BANK.filter(q => q.category === '专辑');
    for (const q of albumQ) {
        App.db.addRecord({ qid: q.id, ans: 'A', ok: true, time: Date.now() });
    }
    const unlocks = App.db.checkAchievements();
    assert.ok(!unlocks.some(a => a.id === 'all_cats'));
});

test('成就 - 已解锁成就不会重复添加', () => {
    const { App } = makeAchieveData();
    const qid = App.QUESTION_BANK[0].id;
    App.db.addRecord({ qid, ans: 'A', ok: true, time: Date.now() });

    App.db.checkAchievements();
    const firstRunCount = App.db.get().achievements.length;

    App.db.checkAchievements();
    const secondRunCount = App.db.get().achievements.length;

    assert.equal(firstRunCount, secondRunCount, '成就不应重复解锁');
});

// ============ session 持久化 ============

test('session - save/load/clear 循环', () => {
    const window = setup();
    const App = window.App;
    const state = {
        quiz: [{ id: '001', question: 'test' }],
        idx: 2, correctCount: 5, startTime: 1234567890, mode: 'quick',
        isWrongBookQuiz: false
    };
    App.session.save(state);
    const loaded = App.session.load();
    assert.ok(loaded);
    assert.equal(loaded.quizIds.length, 1);
    assert.equal(loaded.idx, 2);

    App.session.clear();
    assert.equal(App.session.load(), null);
});

test('session - load 空存储返回 null', () => {
    const window = setup();
    const App = window.App;
    assert.equal(App.session.load(), null);
});
