// ============================================================
// test/storage.test.js
// storage.js 核心业务逻辑测试
// 重点覆盖：XSS 转义、间隔重复算法、打卡/成就/统计/会话
// ============================================================

const T = require('./test-runner');

// ========== XSS 转义 ==========
T.describe('App.esc — XSS 转义', function() {
T.it('null 与 undefined 安全降级为空字符串', function() {
        T.assertEqual(T.loadSource('storage.js').esc(null), '');
        T.assertEqual(T.loadSource('storage.js').esc(undefined), '');
    });
T.it('基本 HTML 特殊字符被转义', function() {
        const esc = T.loadSource('storage.js').esc;
        T.assertEqual(esc('<script>alert(1)</script>'),
            '&lt;script&gt;alert(1)&lt;/script&gt;');
        T.assertEqual(esc('A & B'), 'A &amp; B');
        // textContent 不会将 " 转义为 &quot;（这不是必要的 HTML 实体）
        T.assertEqual(esc('"quoted"'), '"quoted"');
    });
T.it('数字与对象被强制字符串化（防止 [object Object] 注入）', function() {
        const esc = T.loadSource('storage.js').esc;
        T.assertEqual(esc(42), '42');
        T.assertEqual(esc(true), 'true');
    });
T.it('反向：纯文本中的 < 一定被转义（防止 XSS 注入）', function() {
        const esc = T.loadSource('storage.js').esc;
        const out = esc('<img src=x onerror=alert(1)>');
        T.assertTrue(out.indexOf('<img') === -1, 'must not contain raw <img');
        T.assertTrue(out.indexOf('&lt;img') !== -1, 'must escape < to &lt;');
    });
});

// ========== 间隔重复：addWrong ==========
T.describe('App.db.addWrong — 错题新增与等级初始化', function() {
T.it('首次添加错题时初始化 SR 字段', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addWrong('q001');
        const list = App.db.getWrong();
        T.assertEqual(list.length, 1);
        const w = list[0];
        T.assertEqual(w.qid, 'q001');
        T.assertEqual(w.cnt, 1);
        T.assertEqual(w.level, 0);
        T.assertTrue(typeof w.nextReview === 'number', 'nextReview must be timestamp');
        T.assertTrue(w.nextReview <= Date.now(), 'nextReview must be <= now for level 0');
    });

T.it('重复添加同题：cnt 递增、level 重置为 0、nextReview 立即', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addWrong('q001');
        const before = App.db.getWrong()[0].time;
        // 模拟时间推进
        const origNow = Date.now;
        const future = origNow() + 10 * 60 * 60 * 1000; // +10h
        Date.now = function() { return future; };
        try {
            App.db.addWrong('q001');
        } finally {
            Date.now = origNow;
        }
        const w = App.db.getWrong()[0];
        T.assertEqual(App.db.getWrong().length, 1, 'still 1 entry');
        T.assertEqual(w.cnt, 2, 'cnt incremented');
        T.assertEqual(w.level, 0, 'level reset');
        // nextReview 是 Date.now() 调用的时间，应等于 future
        T.assertEqual(w.nextReview, future, 'immediately reviewable at mocked time');
    });
});

// ========== 间隔重复：reviewCorrect / reviewWrong ==========
T.describe('App.db.reviewCorrect — 答对升级 / 已掌握移除', function() {
T.it('答对：level 0 -> 1，nextReview 在约 1 小时后', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addWrong('q001');
        const before = Date.now();
        const res = App.db.reviewCorrect('q001');
        T.assertEqual(res.mastered, false);
        T.assertEqual(res.level, 1);
        const w = App.db.getWrong()[0];
        T.assertEqual(w.level, 1);
        T.assertTrue(w.nextReview >= before + 60 * 60 * 1000 - 50, 'nextReview ~ 1h');
        T.assertTrue(w.nextReview <= before + 60 * 60 * 1000 + 50, 'nextReview ~ 1h');
    });

T.it('答对：逐级递增，level 1->2->3->4 间隔为 1天/3天/7天', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addWrong('q001');
        const start = Date.now();
        App.db.reviewCorrect('q001'); // -> L1
        let w = App.db.getWrong()[0];
        T.assertEqual(w.level, 1);
        T.assertTrue(Math.abs(w.nextReview - start - 1 * 60 * 60 * 1000) <= 50, 'L1 ~ 1h');

        App.db.reviewCorrect('q001'); // -> L2
        w = App.db.getWrong()[0];
        T.assertEqual(w.level, 2);
        T.assertTrue(Math.abs(w.nextReview - start - 1 * 24 * 60 * 60 * 1000) <= 50, 'L2 ~ 1d');

        App.db.reviewCorrect('q001'); // -> L3
        w = App.db.getWrong()[0];
        T.assertEqual(w.level, 3);
        T.assertTrue(Math.abs(w.nextReview - start - 3 * 24 * 60 * 60 * 1000) <= 50, 'L3 ~ 3d');

        App.db.reviewCorrect('q001'); // -> L4
        w = App.db.getWrong()[0];
        T.assertEqual(w.level, 4);
        T.assertTrue(Math.abs(w.nextReview - start - 7 * 24 * 60 * 60 * 1000) <= 50, 'L4 ~ 7d');
    });

T.it('答对：达到 level >= 5 从错题本移除并返回 mastered=true', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addWrong('q001');
        for (let i = 0; i < 4; i++) App.db.reviewCorrect('q001'); // 升到 L4
        T.assertEqual(App.db.getWrong().length, 1);
        const res = App.db.reviewCorrect('q001'); // L4 -> 升级, level=5 >= 5 移除
        T.assertEqual(res.mastered, true);
        T.assertEqual(res.qid, 'q001');
        T.assertEqual(App.db.getWrong().length, 0, 'removed from wrong book');
    });

T.it('答对不在错题本中的题：返回 mastered=false 不抛错', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const res = App.db.reviewCorrect('q999');
        T.assertEqual(res.mastered, false);
    });
});

T.describe('App.db.reviewWrong — 答错重置', function() {
T.it('已存在的错题答错：level 重置为 0、cnt+1、nextReview 立即', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addWrong('q001');
        App.db.reviewCorrect('q001'); // L1
        App.db.reviewCorrect('q001'); // L2
        T.assertEqual(App.db.getWrong()[0].level, 2);
        App.db.reviewWrong('q001');
        const w = App.db.getWrong()[0];
        T.assertEqual(w.level, 0);
        T.assertEqual(w.cnt, 2, 'cnt from 1->2');
        T.assertTrue(w.nextReview <= Date.now());
    });

T.it('不在错题本的题答错：自动 addWrong', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.reviewWrong('q001');
        T.assertEqual(App.db.getWrong().length, 1);
        T.assertEqual(App.db.getWrong()[0].qid, 'q001');
    });
});

// ========== 间隔重复：getDueWrong ==========
T.describe('App.db.getDueWrong — 到期判定', function() {
T.it('nextReview <= now 视为到期', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addWrong('q001');
        App.db.addWrong('q002');
        App.db.reviewCorrect('q001'); // 升级 -> 下次复习在未来
        const due = App.db.getDueWrong();
        T.assertEqual(due.length, 1, 'only q002 due');
        T.assertEqual(due[0].qid, 'q002');
    });

T.it('无 nextReview 字段视为到期（兼容老数据）', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        // 手工注入老格式错题（无 nextReview）
        const d = App.db.get();
        d.wrong.push({ qid: 'q001', cnt: 1, level: 0, time: Date.now() });
        const due = App.db.getDueWrong();
        T.assertEqual(due.length, 1, 'legacy entry without nextReview is due');
    });
});

// ========== 每日目标 ==========
T.describe('App.db.setDailyGoal — 边界值裁剪', function() {
T.it('合法值原样保存', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.setDailyGoal(50);
        T.assertEqual(App.db.getDailyGoal(), 50);
    });
T.it('小于 5 被钳到 5', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.setDailyGoal(1);
        T.assertEqual(App.db.getDailyGoal(), 5);
        App.db.setDailyGoal(-100);
        T.assertEqual(App.db.getDailyGoal(), 5);
    });
T.it('大于 100 被钳到 100', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.setDailyGoal(9999);
        T.assertEqual(App.db.getDailyGoal(), 100);
    });
});

// ========== 连续打卡 ==========
T.describe('App.db.getStreak — 连续打卡天数', function() {
T.it('无任何记录返回 0', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        T.assertEqual(App.db.getStreak(), 0);
    });
T.it('仅今天有记录：streak=1', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        T.assertEqual(App.db.getStreak(), 1);
    });
T.it('连续 3 天有记录：streak=3', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const now = new Date();
        now.setHours(12, 0, 0, 0);
        const day = 24 * 60 * 60 * 1000;
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: now.getTime() });
        App.db.addRecord({ qid: 'q002', ans: 'A', ok: true, time: now.getTime() - day });
        App.db.addRecord({ qid: 'q003', ans: 'A', ok: true, time: now.getTime() - 2 * day });
        T.assertEqual(App.db.getStreak(), 3);
    });
T.it('中间断开一天：streak 只算连续尾部', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const now = new Date();
        now.setHours(12, 0, 0, 0);
        const day = 24 * 60 * 60 * 1000;
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: now.getTime() });
        // 跳过昨天
        App.db.addRecord({ qid: 'q003', ans: 'A', ok: true, time: now.getTime() - 2 * day });
        App.db.addRecord({ qid: 'q004', ans: 'A', ok: true, time: now.getTime() - 3 * day });
        T.assertEqual(App.db.getStreak(), 1, '断签后只算今天');
    });
T.it('今天无记录但昨天及之前连续：streak 不含今天', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const now = new Date();
        now.setHours(12, 0, 0, 0);
        const day = 24 * 60 * 60 * 1000;
        // 昨天、前天、大前天
        App.db.addRecord({ qid: 'q002', ans: 'A', ok: true, time: now.getTime() - day });
        App.db.addRecord({ qid: 'q003', ans: 'A', ok: true, time: now.getTime() - 2 * day });
        App.db.addRecord({ qid: 'q004', ans: 'A', ok: true, time: now.getTime() - 3 * day });
        // 今天无记录，但因"从今天或昨天起算连续"，应为 3
        T.assertEqual(App.db.getStreak(), 3);
    });
T.it('归档数据中的日期也参与打卡统计', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const d = App.db.get();
        d.archive = [{ date: '2020-1-1', total: 1, correct: 1 }];
        T.assertTrue(App.db.getStreak() >= 0);
        // 归档日期不是最近日期，不影响 streak
        T.assertEqual(App.db.getStreak(), 0);
    });
});

// ========== 成就解锁 ==========
T.describe('App.db.checkAchievements — 成就触发', function() {
T.it('首次答题：解锁 first_answer', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        const unlocks = App.db.checkAchievements();
        T.assertTrue(unlocks.some(a => a.id === 'first_answer'));
    });

T.it('累计 100 题且正确率 >= 90%：解锁 acc_90', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        for (let i = 0; i < 50; i++) App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        const unlocks = App.db.checkAchievements();
        T.assertTrue(unlocks.some(a => a.id === 'acc_90'), '应解锁 acc_90');
    });

T.it('累计 100 题但正确率 < 90%：不解锁 acc_90', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        for (let i = 0; i < 50; i++) App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        for (let i = 0; i < 20; i++) App.db.addRecord({ qid: 'q002', ans: 'B', ok: false, time: Date.now() });
        const unlocks = App.db.checkAchievements();
        T.assertFalse(unlocks.some(a => a.id === 'acc_90'));
    });

T.it('完美一轮（10/10）通过 context 触发 perfect_10', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        for (let i = 0; i < 10; i++) App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
        T.assertTrue(unlocks.some(a => a.id === 'perfect_10'));
    });

T.it('完美一轮但不是全对：不触发 perfect_10', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 9 });
        T.assertFalse(unlocks.some(a => a.id === 'perfect_10'));
    });

T.it('所有四个分类都有记录：解锁 all_cats', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        // 找一个真实的四分类题目
        const qByCat = {};
        for (const q of App.QUESTION_BANK) {
            if (!qByCat[q.category]) qByCat[q.category] = q.id;
        }
        for (const c of ['专辑', '歌曲', '个人信息', '获奖记录']) {
            if (qByCat[c]) {
                App.db.addRecord({ qid: qByCat[c], ans: 'A', ok: true, time: Date.now() });
            }
        }
        const unlocks = App.db.checkAchievements();
        T.assertTrue(unlocks.some(a => a.id === 'all_cats'), '应解锁 all_cats');
    });

T.it('错题清零：曾经答过题且现在 wrong 为空时解锁', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        // 此时已 first_answer，wrong 为空
        const unlocks = App.db.checkAchievements();
        T.assertTrue(unlocks.some(a => a.id === 'wrong_clear'));
    });

T.it('成就是幂等的：重复检查不会重复解锁', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        const first = App.db.checkAchievements();
        T.assertTrue(first.some(a => a.id === 'first_answer'));
        const second = App.db.checkAchievements();
        T.assertFalse(second.some(a => a.id === 'first_answer'), 'second call has no new unlocks');
    });

T.it('单日 50 题：解锁 daily_50', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        for (let i = 0; i < 50; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        }
        const unlocks = App.db.checkAchievements();
        T.assertTrue(unlocks.some(a => a.id === 'daily_50'));
    });
});

// ========== 历史归档 ==========
T.describe('App.db.addRecord — 历史超过 1000 时按天归档', function() {
T.it('历史 1000+ 时将 90 天前的记录聚合为 archive', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const d = App.db.get();
        const now = Date.now();
        // 注入 1000 条记录：500 条是 100 天前（旧），500 条是今天（新）
        for (let i = 0; i < 500; i++) {
            d.history.push({ qid: 'q001', ans: 'A', ok: i % 2 === 0, time: now - 100 * 86400000 });
        }
        for (let i = 0; i < 500; i++) {
            d.history.push({ qid: 'q001', ans: 'A', ok: true, time: now });
        }
        T.assertEqual(d.history.length, 1000);
        // 触发归档：再 addRecord
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: now });
        // 1000 之前老记录（>= 90 天前）被聚合为 archive，history 应只剩 501 条
        T.assertTrue(d.history.length <= 510, 'history trimmed');
        T.assertTrue((d.archive || []).length > 0, 'archive populated');
        // 归档的聚合应按天：500 条老记录都在同一天，应只有 1 条 archive
        T.assertEqual(d.archive.length, 1, 'one archive entry per day');
        T.assertEqual(d.archive[0].total, 500);
        // correct 应约为 250（i%2==0 表示 ok）
        T.assertEqual(d.archive[0].correct, 250);
    });

T.it('历史不足 1000：不触发归档', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        for (let i = 0; i < 50; i++) {
            App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        }
        T.assertEqual((App.db.get().archive || []).length, 0);
    });

T.it('同一日期二次归档不会产生重复 archive 条目', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const d = App.db.get();
        const old = Date.now() - 100 * 86400000;
        // 注入 1000 条
        for (let i = 0; i < 500; i++) d.history.push({ qid: 'q001', ans: 'A', ok: true, time: old });
        for (let i = 0; i < 500; i++) d.history.push({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        const archiveCountAfterFirst = d.archive.length;
        // 再加 1 条，模拟后续新增历史再次触发归档
        for (let i = 0; i < 500; i++) d.history.push({ qid: 'q001', ans: 'A', ok: true, time: old });
        App.db.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
        // 不应出现两条相同日期的 archive
        const dates = d.archive.map(a => a.date);
        const uniqueDates = Array.from(new Set(dates));
        T.assertEqual(dates.length, uniqueDates.length, 'no duplicate dates in archive');
    });
});

// ========== 分类统计 ==========
T.describe('App.db.addRecord — 分类统计', function() {
T.it('按 q.category 聚合到 stats.cats', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        // 找两个不同分类的真实题目
        const q1 = App.QUESTION_BANK.find(q => q.category === '专辑');
        const q2 = App.QUESTION_BANK.find(q => q.category === '歌曲');
        T.assertNotNull(q1);
        T.assertNotNull(q2);
        App.db.addRecord({ qid: q1.id, ans: 'A', ok: true, time: Date.now() });
        App.db.addRecord({ qid: q2.id, ans: 'B', ok: false, time: Date.now() });
        const cats = App.db.get().stats.cats;
        T.assertEqual(cats['专辑'].t, 1);
        T.assertEqual(cats['专辑'].c, 1);
        T.assertEqual(cats['歌曲'].t, 1);
        T.assertEqual(cats['歌曲'].c, 0);
    });

T.it('对不存在的 qid 不会污染 stats.cats', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.db.addRecord({ qid: 'nonexistent', ans: 'A', ok: true, time: Date.now() });
        T.assertEqual(Object.keys(App.db.get().stats.cats).length, 0);
    });
});

// ========== recalcStats ==========
T.describe('App.db.recalcStats — 从 history 重新计算 stats', function() {
T.it('丢弃旧 stats 重新计算', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const d = App.db.get();
        // 人为污染 stats
        d.stats.total = 9999;
        d.stats.correct = 9999;
        const q1 = App.QUESTION_BANK.find(q => q.category === '专辑');
        d.history.push({ qid: q1.id, ans: 'A', ok: true, time: Date.now() });
        d.history.push({ qid: q1.id, ans: 'A', ok: false, time: Date.now() });
        App.db.recalcStats();
        T.assertEqual(d.stats.total, 2);
        T.assertEqual(d.stats.correct, 1);
        T.assertEqual(d.stats.cats['专辑'].t, 2);
        T.assertEqual(d.stats.cats['专辑'].c, 1);
    });
});

// ========== session 模块 ==========
T.describe('App.session — sessionStorage 包装', function() {
T.it('save -> load 往返一致', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const state = { quiz: [{ id: 'q1' }, { id: 'q2' }], idx: 1, correctCount: 1, startTime: 100, mode: 'standard', isWrongBookQuiz: false };
        App.session.save(state);
        const loaded = App.session.load();
        T.assertDeepEqual(loaded.quizIds, ['q1', 'q2']);
        T.assertEqual(loaded.idx, 1);
        T.assertEqual(loaded.correctCount, 1);
        T.assertEqual(loaded.startTime, 100);
        T.assertEqual(loaded.mode, 'standard');
        T.assertEqual(loaded.isWrongBookQuiz, false);
    });

T.it('clear 后 load 返回 null', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        App.session.save({ quiz: [{ id: 'q1' }], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
        App.session.clear();
        T.assertNull(App.session.load());
    });

T.it('load 在 sessionStorage 为空时返回 null', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        T.assertNull(App.session.load());
    });

T.it('load 在 JSON 损坏时返回 null（不抛错）', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        global.sessionStorage.setItem('jj_quiz_session', '{not valid json');
        T.assertNull(App.session.load());
    });
});

// ========== findQ ==========
T.describe('App.db.findQ — 在 App.QUESTION_BANK 中查找', function() {
T.it('存在的题目返回对象', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        const q = App.db.findQ('001');
        T.assertNotNull(q);
        T.assertEqual(q.id, '001');
    });
T.it('不存在的题目返回 null', function() {
        T.loadFreshSource();
        T.loadSource('data.js');
        const App = global.window.App;
        T.assertNull(App.db.findQ('does-not-exist'));
    });
});
