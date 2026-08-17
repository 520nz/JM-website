import { describe, it, beforeEach, expect } from 'vitest';
import { loadApp, initStorage, resetStorage } from './_common.js';

let A;

beforeAll(async () => {
    A = loadApp({ quiz: false, admin: false });
    await initStorage();
});

beforeEach(() => {
    resetStorage();
});

describe('storage.js - 模块暴露与 defaults', () => {
    it('应暴露 App.db 完整 API 表面', () => {
        expect(A.db).toBeDefined();
        for (const name of ['init','get','addRecord','addWrong','reviewCorrect','reviewWrong','removeWrong',
                            'getWrong','getDueWrong','findQ','recalcStats','setData','defaults',
                            'getDailyGoal','setDailyGoal','getStreak','getAchievements','checkAchievements','getAchievementDefs']) {
            expect(typeof A.db[name]).toBe('function');
        }
    });

    it('应暴露 App.store / App.session / App.esc', () => {
        expect(A.store).toBeDefined();
        expect(A.session).toBeDefined();
        expect(typeof A.esc).toBe('function');
    });

    it('defaults() 应返回完整骨架', () => {
        const d = A.db.defaults();
        expect(Array.isArray(d.history)).toBe(true);
        expect(Array.isArray(d.wrong)).toBe(true);
        expect(d.stats).toEqual({ total: 0, correct: 0, cats: {} });
        expect(d.theme).toBe('dark');
        expect(d.dailyGoal).toBe(20);
        expect(Array.isArray(d.achievements)).toBe(true);
        expect(Array.isArray(d.archive)).toBe(true);
    });
});

describe('storage.js - esc XSS 转义', () => {
    it('esc(null/undefined) 应返回空字符串', () => {
        expect(A.esc(null)).toBe('');
        expect(A.esc(undefined)).toBe('');
    });

    it('应转义 < > & 三个危险字符', () => {
        expect(A.esc('<script>')).toBe('&lt;script&gt;');
        expect(A.esc('a&b')).toBe('a&amp;b');
    });

    it('数字类型应转为字符串', () => {
        expect(A.esc(42)).toBe('42');
    });
});

describe('storage.js - addRecord 与归档', () => {
    it('addRecord 应递增 stats.total 和 stats.correct', () => {
        A.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        A.db.addRecord({ qid: '002', ok: false, time: Date.now() });
        const d = A.db.get();
        expect(d.stats.total).toBe(2);
        expect(d.stats.correct).toBe(1);
    });

    it('应按 category 聚合 stats.cats', () => {
        A.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        const d = A.db.get();
        const q = A.db.findQ('001');
        expect(q).not.toBeNull();
        expect(d.stats.cats[q.category]).toBeDefined();
        expect(d.stats.cats[q.category].t).toBe(1);
        expect(d.stats.cats[q.category].c).toBe(1);
    });

    it('历史超过 1000 条时，90 天前的记录应被按天聚合到 archive', () => {
        const now = Date.now();
        const cutoff = 91 * 24 * 60 * 60 * 1000;
        const oldTime = now - cutoff;
        for (let i = 0; i < 900; i++) {
            A.db.addRecord({ qid: '001', ok: i % 2 === 0, time: oldTime + i * 60000 });
        }
        for (let i = 0; i < 200; i++) {
            A.db.addRecord({ qid: '001', ok: true, time: now - i * 60000 });
        }
        const d = A.db.get();
        expect(d.history.length).toBeLessThanOrEqual(200);
        expect(d.archive.length).toBeGreaterThan(0);
    });

    it('归档应避免与已有 archive 条目重复日期', () => {
        const d = A.db.get();
        d.archive = [{ date: '2024-1-1', total: 10, correct: 8 }];
        A.db.setData(d);
        const now = Date.now();
        const oldTime = now - 100 * 24 * 60 * 60 * 1000;
        for (let i = 0; i < 1100; i++) {
            A.db.addRecord({ qid: '001', ok: true, time: oldTime + i * 60000 });
        }
        const d2 = A.db.get();
        const dupes = d2.archive.filter(a => a.date === '2024-1-1');
        expect(dupes.length).toBe(1);
    });
});

describe('storage.js - 错题本与间隔重复', () => {
    it('addWrong 新题应初始化错题结构', () => {
        A.db.addWrong('001');
        const w = A.db.getWrong();
        expect(w.length).toBe(1);
        expect(w[0].qid).toBe('001');
        expect(w[0].cnt).toBe(1);
        expect(w[0].level).toBe(0);
    });

    it('addWrong 重复错题应递增 cnt 并重置 level', () => {
        A.db.addWrong('001');
        A.db.reviewCorrect('001');
        A.db.reviewCorrect('001');
        A.db.addWrong('001');
        const w = A.db.getWrong();
        expect(w.length).toBe(1);
        expect(w[0].cnt).toBe(2);
        expect(w[0].level).toBe(0);
    });

    it('reviewCorrect 连续 5 次后应 mastered=true 并移除', () => {
        A.db.addWrong('001');
        for (let i = 0; i < 5; i++) {
            const r = A.db.reviewCorrect('001');
            if (i < 4) expect(r.mastered).toBe(false);
            else expect(r.mastered).toBe(true);
        }
        expect(A.db.getWrong().length).toBe(0);
    });

    it('reviewCorrect 1-4 级应设置合理 nextReview', () => {
        A.db.addWrong('001');
        for (let lv = 1; lv <= 4; lv++) {
            A.db.reviewCorrect('001');
        }
        const w = A.db.getWrong()[0];
        expect(w.level).toBe(4);
        expect(w.nextReview).toBeGreaterThan(Date.now());
    });

    it('reviewWrong 应重置 level=0', () => {
        A.db.addWrong('001');
        A.db.reviewCorrect('001');
        A.db.reviewCorrect('001');
        A.db.reviewWrong('001');
        const w = A.db.getWrong()[0];
        expect(w.level).toBe(0);
        expect(w.cnt).toBeGreaterThanOrEqual(2);
    });

    it('reviewWrong 不存在的错题应自动 addWrong', () => {
        A.db.reviewWrong('999');
        const w = A.db.getWrong();
        expect(w.length).toBe(1);
        expect(w[0].qid).toBe('999');
        expect(w[0].cnt).toBe(1);
    });

    it('reviewCorrect 不存在的错题应返回 {mastered:false}', () => {
        const r = A.db.reviewCorrect('999');
        expect(r).toEqual({ mastered: false, qid: '999' });
    });

    it('getDueWrong 应只返回 nextReview<=now 的错题', () => {
        A.db.addWrong('001');
        A.db.addWrong('002');
        for (let i = 0; i < 4; i++) A.db.reviewCorrect('002');
        const w = A.db.getWrong();
        const due = A.db.getDueWrong();
        expect(due.find(d => d.qid === '001')).toBeDefined();
        expect(due.find(d => d.qid === '002')).toBeUndefined();
    });

    it('removeWrong 应移除指定错题', () => {
        A.db.addWrong('001');
        A.db.addWrong('002');
        A.db.removeWrong('001');
        const w = A.db.getWrong();
        expect(w.length).toBe(1);
        expect(w[0].qid).toBe('002');
    });
});

describe('storage.js - findQ', () => {
    it('应通过 id 找到题目', () => {
        const q = A.db.findQ('001');
        expect(q).not.toBeNull();
        expect(q.id).toBe('001');
    });

    it('不存在的 id 应返回 null', () => {
        expect(A.db.findQ('zzz')).toBeNull();
    });
});

describe('storage.js - dailyGoal', () => {
    it('默认每日目标应为 20', () => {
        expect(A.db.getDailyGoal()).toBe(20);
    });

    it('setDailyGoal 应钳制到 [5, 100]', () => {
        A.db.setDailyGoal(2);
        expect(A.db.getDailyGoal()).toBe(5);
        A.db.setDailyGoal(200);
        expect(A.db.getDailyGoal()).toBe(100);
        A.db.setDailyGoal(30);
        expect(A.db.getDailyGoal()).toBe(30);
    });
});

describe('storage.js - getStreak 连续打卡', () => {
    it('无答题记录应返回 0', () => {
        expect(A.db.getStreak()).toBe(0);
    });

    it('只有今天答题过应返回 1', () => {
        A.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        expect(A.db.getStreak()).toBe(1);
    });

    it('未答今天但答了昨天，应返回 1（昨天作为起点）', () => {
        const yesterday = Date.now() - 24 * 60 * 60 * 1000;
        A.db.addRecord({ qid: '001', ok: true, time: yesterday });
        expect(A.db.getStreak()).toBe(1);
    });

    it('连续三天答题应返回 3', () => {
        const today = Date.now();
        const day = 24 * 60 * 60 * 1000;
        A.db.addRecord({ qid: '001', ok: true, time: today });
        A.db.addRecord({ qid: '001', ok: true, time: today - day });
        A.db.addRecord({ qid: '001', ok: true, time: today - 2 * day });
        expect(A.db.getStreak()).toBe(3);
    });

    it('中间有断点时应从最近的连续段计算', () => {
        const today = Date.now();
        const day = 24 * 60 * 60 * 1000;
        A.db.addRecord({ qid: '001', ok: true, time: today });
        A.db.addRecord({ qid: '001', ok: true, time: today - 2 * day });
        expect(A.db.getStreak()).toBe(1);
    });
});

describe('storage.js - 成就系统 checkAchievements', () => {
    it('首次答题应解锁 first_answer', () => {
        A.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        const newA = A.db.checkAchievements();
        expect(newA.some(a => a.id === 'first_answer')).toBe(true);
    });

    it('累计 100 题应解锁 total_100', () => {
        for (let i = 0; i < 100; i++) {
            A.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        }
        const newA = A.db.checkAchievements();
        expect(newA.some(a => a.id === 'total_100')).toBe(true);
    });

    it('答满 50 题且正确率 >=90% 应解锁 acc_90', () => {
        for (let i = 0; i < 50; i++) {
            A.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        }
        A.db.addRecord({ qid: '001', ok: false, time: Date.now() });
        const newA = A.db.checkAchievements();
        expect(newA.some(a => a.id === 'acc_90')).toBe(true);
    });

    it('单次 10 题全对应解锁 perfect_10', () => {
        const ctx = { quizTotal: 10, quizCorrect: 10 };
        const newA = A.db.checkAchievements(ctx);
        expect(newA.some(a => a.id === 'perfect_10')).toBe(true);
    });

    it('所有分类有答题记录应解锁 all_cats', () => {
        A.db.addRecord({ qid: '001', ok: true, time: Date.now() }); // 专辑
        A.db.addRecord({ qid: '003', ok: true, time: Date.now() }); // 歌曲
        A.db.addRecord({ qid: '061', ok: true, time: Date.now() }); // 个人信息
        A.db.addRecord({ qid: '069', ok: true, time: Date.now() }); // 获奖记录
        const newA = A.db.checkAchievements();
        expect(newA.some(a => a.id === 'all_cats')).toBe(true);
    });

    it('同一成就不会重复解锁（幂等性）', () => {
        A.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        A.db.checkAchievements();
        const newA = A.db.checkAchievements();
        expect(newA.some(a => a.id === 'first_answer')).toBe(false);
    });

    it('错题清零条件：有过错题记录且现在为空', () => {
        A.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        A.db.addWrong('001');
        A.db.removeWrong('001');
        const newA = A.db.checkAchievements();
        expect(newA.some(a => a.id === 'wrong_clear')).toBe(true);
    });
});

describe('storage.js - recalcStats', () => {
    it('应从 history 重新计算 stats', () => {
        const d = A.db.get();
        d.stats = { total: 999, correct: 999, cats: {}};
        A.db.setData(d);
        A.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        A.db.addRecord({ qid: '002', ok: false, time: Date.now() });
        A.db.recalcStats();
        const d2 = A.db.get();
        expect(d2.stats.total).toBe(2);
        expect(d2.stats.correct).toBe(1);
    });

    it('history 为空时 stats 应重置为零值', () => {
        A.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        const d = A.db.get();
        d.history = [];
        A.db.setData(d);
        A.db.recalcStats();
        const d2 = A.db.get();
        expect(d2.stats.total).toBe(0);
        expect(d2.stats.correct).toBe(0);
        expect(Object.keys(d2.stats.cats).length).toBe(0);
    });
});

describe('storage.js - App.session', () => {
    it('save / load / clear 流程', () => {
        A.session.save({ quiz: [{id:'001'}], idx: 2, correctCount: 1, startTime: 123, mode: 'quick' });
        const loaded = A.session.load();
        expect(loaded).not.toBeNull();
        expect(loaded.idx).toBe(2);
        expect(loaded.correctCount).toBe(1);
        A.session.clear();
        expect(A.session.load()).toBeNull();
    });
});
