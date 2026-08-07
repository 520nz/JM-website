// ============================================================
// test/storage.test.js - storage.js 核心逻辑测试
// 覆盖：XSS防护、间隔重复状态机、打卡天数、成就判定、历史归档、每日目标边界
// ============================================================
const assert = require('assert');
const setup = require('./setup');
const App = setup.loadApp();

// 辅助：重置内存缓存，保持一个干净的状态
function resetCache() {
    App.db.setData(App.db.defaults());
}

// 等待异步 persist 完成（mock indexedDB 用了 setTimeout(0)）
function tick() {
    return new Promise(r => setImmediate(r));
}

describe('XSS 防护 (App.esc)', () => {
    it('应转义 script 标签', () => {
        const result = App.esc('<script>alert(1)</script>');
        assert.ok(!/^\s*<script/i.test(result), `不应保留 script 标签, 得到: ${result}`);
        assert.strictEqual(result.indexOf('<'), -1, '所有 < 都应被转义');
    });

    it('应转义 HTML 标签防止注入', () => {
        const result = App.esc('<div onclick="alert(1)">foo</div>');
        assert.ok(result.indexOf('<div') === -1, 'div 标签应被转义');
        // 转义后不应有可执行的标签
        assert.ok(!/^\s*<\w+/m.test(result), '不应保留任何标签');
    });

    it('应转义 img onerror 注入', () => {
        const result = App.esc('<img src=x onerror=alert(1)>');
        assert.ok(result.indexOf('<img') === -1, 'img 标签应被转义');
    });

    it('应转义 & 和 < >', () => {
        const result = App.esc('a & b < c > d');
        assert.strictEqual(result.indexOf('& '), -1, '& 应被转义');
        assert.strictEqual(result.indexOf('< c'), -1, '< 应被转义');
        assert.strictEqual(result.indexOf('> d'), -1, '> 应被转义');
    });

    it('应处理 null/undefined 为""', () => {
        assert.strictEqual(App.esc(null), '');
        assert.strictEqual(App.esc(undefined), '');
    });

    it('应处理数字', () => {
        assert.strictEqual(App.esc(123), '123');
    });

    it('应保留合法中文字符', () => {
        const result = App.esc('林俊杰首张专辑《乐行者》');
        assert.ok(result.includes('林俊杰'), '中文应被保留');
        assert.ok(result.includes('乐行者'), '书名号应被保留');
    });
});

describe('题目查找 (App.db.findQ)', () => {
    it('应根据 id 找到题目', () => {
        const q = App.db.findQ('001');
        assert.ok(q, '应找到 id=001 的题目');
        assert.strictEqual(q.category, '专辑');
        assert.ok(q.options.length >= 2);
    });

    it('不存在的 id 返回 null', () => {
        const q = App.db.findQ('nonexistent_id_xyz');
        assert.strictEqual(q, null);
    });
});

describe('每日目标边界 (getDailyGoal / setDailyGoal)', () => {
    beforeEach(() => resetCache());

    it('默认目标为 20', () => {
        assert.strictEqual(App.db.getDailyGoal(), 20);
    });

    it('设置 5-100 之间的值应正常生效', () => {
        App.db.setDailyGoal(50);
        assert.strictEqual(App.db.getDailyGoal(), 50);
    });

    it('设置小于 5 的值应被钳位到 5', () => {
        App.db.setDailyGoal(1);
        assert.strictEqual(App.db.getDailyGoal(), 5);
    });

    it('设置大于 100 的值应被钳位到 100', () => {
        App.db.setDailyGoal(999);
        assert.strictEqual(App.db.getDailyGoal(), 100);
    });

    it('设置 0 应被钳位到 5', () => {
        App.db.setDailyGoal(0);
        assert.strictEqual(App.db.getDailyGoal(), 5);
    });
});

describe('间隔重复状态机 (addWrong / reviewCorrect / reviewWrong)', () => {
    beforeEach(() => resetCache());

    it('addWrong：首次添加应初始化 level=0', () => {
        App.db.addWrong('001');
        const w = App.db.getWrong();
        assert.strictEqual(w.length, 1);
        assert.strictEqual(w[0].qid, '001');
        assert.strictEqual(w[0].cnt, 1);
        assert.strictEqual(w[0].level, 0);
        assert.ok(w[0].nextReview <= Date.now());
    });

    it('addWrong：重复添加应重置 level 和 nextReview，但 cnt 递增', () => {
        App.db.addWrong('001');
        const first = App.db.getWrong()[0];
        // 手动提升 level 模拟已复习过
        App.db.getWrong()[0].level = 2;
        App.db.addWrong('001');
        const w = App.db.getWrong();
        assert.strictEqual(w.length, 1);
        assert.strictEqual(w[0].cnt, 2, '错误次数应递增');
        assert.strictEqual(w[0].level, 0, 'level 应重置');
        assert.ok(w[0].nextReview <= Date.now(), '应立即可复习');
    });

    it('reviewCorrect：提升 level 但未到 5，返回 mastered=false', () => {
        App.db.addWrong('001');
        const r1 = App.db.reviewCorrect('001');
        assert.strictEqual(r1.mastered, false);
        assert.strictEqual(r1.level, 1);

        const r2 = App.db.reviewCorrect('001');
        assert.strictEqual(r2.level, 2);

        const w = App.db.getWrong();
        assert.strictEqual(w.length, 1, '未掌握前仍在错题本');
        assert.ok(w[0].nextReview > Date.now(), 'nextReview 应在未来');
    });

    it('reviewCorrect：level 到 5 应从错题本移除（掌握）', () => {
        App.db.addWrong('001');
        App.db.reviewCorrect('001'); // level 1
        App.db.reviewCorrect('001'); // level 2
        App.db.reviewCorrect('001'); // level 3
        App.db.reviewCorrect('001'); // level 4
        const final = App.db.reviewCorrect('001'); // level 5 → mastered
        assert.strictEqual(final.mastered, true);
        assert.strictEqual(App.db.getWrong().length, 0, '应从错题本移除');
    });

    it('reviewCorrect：对不存在的题目应返回 mastered=false', () => {
        const r = App.db.reviewCorrect('no_such_q');
        assert.strictEqual(r.mastered, false);
        assert.strictEqual(r.qid, 'no_such_q');
    });

    it('reviewWrong：在错题本中应重置 level + cnt 递增', () => {
        App.db.addWrong('001');
        App.db.reviewCorrect('001'); // level 1
        App.db.reviewWrong('001');
        const w = App.db.getWrong();
        assert.strictEqual(w[0].level, 0);
        assert.strictEqual(w[0].cnt, 2);
        assert.ok(w[0].nextReview <= Date.now(), '应立即可复习');
    });

    it('reviewWrong：不在错题本中应自动 addWrong', () => {
        App.db.reviewWrong('001');
        const w = App.db.getWrong();
        assert.strictEqual(w.length, 1);
        assert.strictEqual(w[0].qid, '001');
        assert.strictEqual(w[0].level, 0);
    });

    it('removeWrong 应立即移除', () => {
        App.db.addWrong('001');
        App.db.addWrong('002');
        assert.strictEqual(App.db.getWrong().length, 2);
        App.db.removeWrong('001');
        const w = App.db.getWrong();
        assert.strictEqual(w.length, 1);
        assert.strictEqual(w[0].qid, '002');
    });

    it('getDueWrong：应只返回 nextReview <= now 的错题', () => {
        App.db.addWrong('001'); // 立即可复习
        App.db.addWrong('002');
        // 手动设置 002 的 nextReview 为未来
        App.db.getWrong()[App.db.getWrong().findIndex(w => w.qid === '002')].nextReview = Date.now() + 86400000;

        const due = App.db.getDueWrong();
        const dueIds = due.map(w => w.qid);
        assert.ok(dueIds.includes('001'), '001 应到期');
        assert.ok(!dueIds.includes('002'), '002 不应到期');
    });

    it('getDueWrong：nextReview 为 0 的老数据应视为到期', () => {
        App.db.addWrong('001');
        const w = App.db.getWrong()[0];
        w.nextReview = 0;
        const due = App.db.getDueWrong();
        assert.ok(due.some(d => d.qid === '001'), 'nextReview=0 应被视为到期');
    });
});

describe('答题记录与统计 (addRecord)', () => {
    beforeEach(() => resetCache());

    it('单次正确答题应更新 stats', () => {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        const d = App.db.get();
        assert.strictEqual(d.stats.total, 1);
        assert.strictEqual(d.stats.correct, 1);
        assert.strictEqual(d.history.length, 1);
        assert.ok(d.stats.cats['专辑'], '专辑分类应有记录');
        assert.strictEqual(d.stats.cats['专辑'].t, 1);
        assert.strictEqual(d.stats.cats['专辑'].c, 1);
    });

    it('单次错误答题应正确记录', () => {
        App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
        const d = App.db.get();
        assert.strictEqual(d.stats.total, 1);
        assert.strictEqual(d.stats.correct, 0);
        assert.strictEqual(d.stats.cats['专辑'].t, 1);
        assert.strictEqual(d.stats.cats['专辑'].c, 0);
    });

    it('history > 1000 时应归档 90 天前的记录', () => {
        const now = Date.now();
        const oldTime = now - 91 * 86400000;

        // 先添加 2 条老记录
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: oldTime });
        App.db.addRecord({ qid: '002', ans: 'C', ok: false, time: oldTime });

        // 填满到 1001 条（需要触发归档）
        for (let i = 0; i < 1000; i++) {
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
        }

        const d = App.db.get();
        assert.ok(d.archive.length > 0, '应有归档数据');
        assert.ok(d.history.length <= 1000, '归档后 history 应 <= 1000');

        // 归档的日期格式验证
        const first = d.archive[0];
        assert.ok(/^\d{4}-\d+-\d+$/.test(first.date), '归档日期应为 YYYY-M-D');
        assert.strictEqual(typeof first.total, 'number');
        assert.strictEqual(typeof first.correct, 'number');
    });

    it('归档不应产生重复日期', () => {
        const now = Date.now();
        const oldTime = now - 91 * 86400000;

        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: oldTime });
        for (let i = 0; i < 1000; i++) {
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
        }
        // 再次触发归档
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });

        const d = App.db.get();
        const dateMap = {};
        for (const a of d.archive) {
            assert.strictEqual(dateMap[a.date], undefined, `重复的归档日期: ${a.date}`);
            dateMap[a.date] = true;
        }
    });
});

describe('统计重算 (recalcStats)', () => {
    beforeEach(() => resetCache());

    it('从 history 重算应得到正确 stats', () => {
        const now = Date.now();
        // 伪造 stats 错误（模拟导入场景）
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
        App.db.addRecord({ qid: '002', ans: 'C', ok: false, time: now });
        App.db.addRecord({ qid: '003', ans: 'A', ok: true, time: now });

        // 手动破坏 stats
        const d = App.db.get();
        d.stats.total = 999;
        d.stats.correct = 0;

        App.db.recalcStats();
        const fixed = App.db.get();
        assert.strictEqual(fixed.stats.total, 3);
        assert.strictEqual(fixed.stats.correct, 2);
        assert.ok(fixed.stats.cats['专辑'] || fixed.stats.cats['歌曲']);
    });

    it('空 history 重算后 stats 应为 0', () => {
        App.db.recalcStats();
        const d = App.db.get();
        assert.strictEqual(d.stats.total, 0);
        assert.strictEqual(d.stats.correct, 0);
    });
});

describe('连续打卡天数 (getStreak)', () => {
    beforeEach(() => resetCache());

    it('无历史记录返回 0', () => {
        assert.strictEqual(App.db.getStreak(), 0);
    });

    it('今天答题返回 1', () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: today.getTime() });
        assert.strictEqual(App.db.getStreak(), 1);
    });

    it('昨天答题返回 1（今天没答）', () => {
        const yesterday = new Date();
        yesterday.setHours(12, 0, 0, 0);
        yesterday.setDate(yesterday.getDate() - 1);
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: yesterday.getTime() });
        assert.strictEqual(App.db.getStreak(), 1);
    });

    it('连续三天答题返回 3', () => {
        const today = new Date();
        for (let i = 0; i < 3; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            d.setHours(12, 0, 0, 0);
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
        }
        assert.strictEqual(App.db.getStreak(), 3);
    });

    it('有一天中断，应返回从中断点重新计数', () => {
        const today = new Date();
        // 今天 + 昨天 + 大前天（跳过前天）
        for (const offset of [0, 1, 3]) {
            const d = new Date(today);
            d.setDate(d.getDate() - offset);
            d.setHours(12, 0, 0, 0);
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
        }
        assert.strictEqual(App.db.getStreak(), 2);
    });

    it('应合并 archive 中的日期参与计算', () => {
        const d = App.db.get();
        const today = new Date();
        // 设置 archive 包含今天和昨天（history 为空）
        const k0 = today.getFullYear() + '-' + today.getMonth() + '-' + today.getDate();
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        const k1 = y.getFullYear() + '-' + y.getMonth() + '-' + y.getDate();
        d.archive = [
            { date: k0, total: 5, correct: 4 },
            { date: k1, total: 3, correct: 2 }
        ];
        d.history = [];
        // 手动触发 archive 中 today 可被识别 → streak=2
        assert.strictEqual(App.db.getStreak(), 2);
    });
});

describe('成就徽章 (checkAchievements)', () => {
    beforeEach(() => resetCache());

    it('首次答题应解锁 first_answer', () => {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        const u = App.db.checkAchievements();
        const ids = u.map(a => a.id);
        assert.ok(ids.includes('first_answer'), `应解锁 first_answer, 得到: ${ids}`);
    });

    it('累计 100 题应解锁 total_100', () => {
        for (let i = 0; i < 100; i++) {
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        }
        const u = App.db.checkAchievements();
        const ids = u.map(a => a.id);
        assert.ok(ids.includes('total_100'));
    });

    it('累计 500 题应解锁 total_500', () => {
        for (let i = 0; i < 500; i++) {
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        }
        const u = App.db.checkAchievements();
        const ids = u.map(a => a.id);
        assert.ok(ids.includes('total_500'));
    });

    it('50题且正确率≥90% 应解锁 acc_90', () => {
        for (let i = 0; i < 50; i++) {
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        }
        App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() }); // 降到 ~98%
        const u = App.db.checkAchievements();
        const ids = u.map(a => a.id);
        assert.ok(ids.includes('acc_90'));
    });

    it('50题但正确率 <90% 不应解锁 acc_90', () => {
        for (let i = 0; i < 50; i++) {
            const ok = i < 44; // 44/50 = 88%
            App.db.addRecord({ qid: '001', ans: ok ? 'B' : 'A', ok, time: Date.now() });
        }
        const u = App.db.checkAchievements();
        const ids = u.map(a => a.id);
        assert.ok(!ids.includes('acc_90'), `88% 不应解锁 acc_90, 得到: ${ids}`);
    });

    it('context 传入 10 题全对应解锁 perfect_10', () => {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() }); // 触发 first_answer
        const u = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
        const ids = u.map(a => a.id);
        assert.ok(ids.includes('perfect_10'));
    });

    it('context 不全对不应解锁 perfect_10', () => {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        const u = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 9 });
        const ids = u.map(a => a.id);
        assert.ok(!ids.includes('perfect_10'), `9/10 不应解锁, 得到: ${ids}`);
    });

    it('连续 3 天应解锁 streak_3', () => {
        const today = new Date();
        for (let i = 0; i < 3; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            d.setHours(12, 0, 0, 0);
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
        }
        const u = App.db.checkAchievements();
        const ids = u.map(a => a.id);
        assert.ok(ids.includes('streak_3'));
    });

    it('所有分类都有记录应解锁 all_cats', () => {
        const today = new Date();
        for (const cat of ['专辑', '歌曲', '个人信息', '获奖记录']) {
            const q = App.QUESTION_BANK.find(q => q.category === cat);
            App.db.addRecord({ qid: q.id, ans: q.answer, ok: true, time: today.getTime() });
        }
        // 先触发 first_answer
        const u = App.db.checkAchievements();
        const ids = u.map(a => a.id);
        assert.ok(ids.includes('all_cats'), `应解锁 all_cats, 得到: ${ids}`);
    });

    it('错题清零 + 有答题记录 应解锁 wrong_clear', () => {
        // 先产生答题记录（触发 first_answer）
        App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
        // 产生错题
        App.db.addWrong('001');
        // 然后通过 5 次答对掌握它，从错题本移除
        for (let i = 0; i < 5; i++) App.db.reviewCorrect('001');
        assert.strictEqual(App.db.getWrong().length, 0, '错题本应该被清空');
        const u = App.db.checkAchievements();
        const ids = u.map(a => a.id);
        // 注意：first_answer 已在第一次 check 时解锁了，这里只有 wrong_clear
        assert.ok(ids.includes('wrong_clear'), `应解锁 wrong_clear, 得到: ${ids}`);
    });

    it('已解锁的成就不应重复出现在 newUnlocks', () => {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        const first = App.db.checkAchievements();
        const second = App.db.checkAchievements();
        assert.strictEqual(second.length, 0, '第二次检查不应返回重复解锁');
    });
});

describe('题库 (App.store)', () => {
    it('QUESTION_BANK 应包含题目且有合理结构', () => {
        const bank = App.QUESTION_BANK;
        assert.ok(bank.length > 0, '题库不能为空');
        assert.ok(bank.length >= 78, '题库应包含足够题目（四个分类共 78 题）');
    });

    it('每道题都应有必要字段', () => {
        for (const q of App.QUESTION_BANK) {
            assert.ok(q.id, `题目 ${q.question} 缺少 id`);
            assert.ok(q.question, `题目 ${q.id} 缺少 question`);
            assert.ok(q.answer, `题目 ${q.id} 缺少 answer`);
            assert.ok(q.options.length >= 2, `题目 ${q.id} 选项不足`);
            assert.ok(q.options.some(o => o.key === q.answer), `题目 ${q.id} 的 answer 不在 options 中`);
        }
    });

    it('所有分类都应有题目', () => {
        const cats = new Set();
        for (const q of App.QUESTION_BANK) cats.add(q.category);
        assert.ok(cats.has('专辑'));
        assert.ok(cats.has('歌曲'));
        assert.ok(cats.has('个人信息'));
        assert.ok(cats.has('获奖记录'));
    });
});

describe('会话恢复 (App.session)', () => {
    beforeEach(() => resetCache());

    it('save 后 load 应能拿到完整数据', () => {
        App.session.save({
            quiz: App.QUESTION_BANK.slice(0, 3),
            idx: 2,
            correctCount: 1,
            startTime: 1234567890,
            mode: 'quick',
            isWrongBookQuiz: false
        });
        const s = App.session.load();
        assert.ok(s);
        assert.strictEqual(s.idx, 2);
        assert.strictEqual(s.correctCount, 1);
        assert.strictEqual(s.quizIds.length, 3);
    });

    it('load 无数据时返回 null', () => {
        App.session.clear();
        assert.strictEqual(App.session.load(), null);
    });

    it('clear 后 load 返回 null', () => {
        App.session.save({ quiz: App.QUESTION_BANK.slice(0, 1), idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
        App.session.clear();
        assert.strictEqual(App.session.load(), null);
    });
});
