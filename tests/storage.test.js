import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadScript, resetAppState } from './helper.js';

// 只加载 data.js 与 storage.js，避免引入过多 DOM 依赖
describe('storage.js - 数据存储与核心逻辑', () => {
  beforeEach(() => {
    loadScript('js/data.js');
    loadScript('js/storage.js');
    resetAppState();
  });

  afterEach(() => {
    resetAppState();
  });

  describe('App.esc - XSS 转义', () => {
    it('应将 null/undefined 转换为空字符串', () => {
      expect(window.App.esc(null)).toBe('');
      expect(window.App.esc(undefined)).toBe('');
    });

    it('应转义 HTML 特殊字符', () => {
      expect(window.App.esc('<script>alert(1)</script>')).not.toContain('<script>');
      expect(window.App.esc('A & B')).toContain('&amp;');
      expect(window.App.esc('<div>')).toContain('&lt;');
    });

    it('普通文本应保持不变', () => {
      expect(window.App.esc('林俊杰')).toBe('林俊杰');
      expect(window.App.esc('A. 选项')).toBe('A. 选项');
    });
  });

  describe('App.db.defaults - 默认数据结构', () => {
    it('应返回符合预期的默认数据结构', () => {
      const d = window.App.db.defaults();
      expect(d).toHaveProperty('history', []);
      expect(d).toHaveProperty('wrong', []);
      expect(d).toHaveProperty('stats', { total: 0, correct: 0, cats: {} });
      expect(d).toHaveProperty('theme', 'dark');
      expect(d).toHaveProperty('dailyGoal', 20);
      expect(d).toHaveProperty('achievements', []);
      expect(d).toHaveProperty('archive', []);
    });
  });

  describe('App.db.addRecord - 答题记录与统计', () => {
    it('正确答题应更新总题数、正确数与分类统计', () => {
      window.App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      const d = window.App.db.get();
      expect(d.stats.total).toBe(1);
      expect(d.stats.correct).toBe(1);
      expect(d.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
      expect(d.history.length).toBe(1);
    });

    it('错误答题应更新总题数但不增加正确数', () => {
      window.App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
      const d = window.App.db.get();
      expect(d.stats.total).toBe(1);
      expect(d.stats.correct).toBe(0);
      expect(d.stats.cats['专辑']).toEqual({ t: 1, c: 0 });
    });

    it('未知题目不应影响分类统计', () => {
      window.App.db.addRecord({ qid: 'UNKNOWN', ans: 'A', ok: true, time: Date.now() });
      const d = window.App.db.get();
      expect(d.stats.total).toBe(1);
      expect(Object.keys(d.stats.cats).length).toBe(0);
    });

    it('历史超过 1000 条时应归档 90 天前的记录', () => {
      const now = Date.now();
      const oldTime = now - 100 * 24 * 60 * 60 * 1000;
      for (let i = 0; i < 1001; i++) {
        window.App.db.addRecord({ qid: '001', ans: 'B', ok: i % 2 === 0, time: i < 500 ? oldTime : now });
      }
      const d = window.App.db.get();
      expect(d.history.length).toBeLessThan(1001);
      expect(d.archive.length).toBeGreaterThan(0);
    });
  });

  describe('App.db.addWrong / reviewCorrect / reviewWrong - 间隔重复错题本', () => {
    it('新增错题应设置 level 0 与 nextReview 为当前时间', () => {
      const before = Date.now();
      window.App.db.addWrong('001');
      const w = window.App.db.getWrong()[0];
      expect(w.qid).toBe('001');
      expect(w.level).toBe(0);
      expect(w.cnt).toBe(1);
      expect(w.nextReview).toBeGreaterThanOrEqual(before);
    });

    it('重复添加同一道题应增加错误次数并重置等级', () => {
      window.App.db.addWrong('001');
      window.App.db.reviewCorrect('001'); // level -> 1
      window.App.db.addWrong('001');       // level 重置为 0
      const w = window.App.db.getWrong()[0];
      expect(w.cnt).toBe(2);
      expect(w.level).toBe(0);
    });

    it('reviewCorrect 应逐级提升并返回掌握状态', () => {
      window.App.db.addWrong('001');
      for (let level = 1; level < 5; level++) {
        const res = window.App.db.reviewCorrect('001');
        expect(res.mastered).toBe(false);
        expect(res.level).toBe(level);
      }
      const final = window.App.db.reviewCorrect('001');
      expect(final.mastered).toBe(true);
      expect(window.App.db.getWrong().length).toBe(0);
    });

    it('reviewWrong 应重置等级并增加次数', () => {
      window.App.db.addWrong('001');
      window.App.db.reviewCorrect('001'); // level 1
      window.App.db.reviewWrong('001');   // level 0, cnt 2
      const w = window.App.db.getWrong()[0];
      expect(w.level).toBe(0);
      expect(w.cnt).toBe(2);
    });

    it('removeWrong 应删除指定错题', () => {
      window.App.db.addWrong('001');
      window.App.db.addWrong('002');
      window.App.db.removeWrong('001');
      expect(window.App.db.getWrong().length).toBe(1);
      expect(window.App.db.getWrong()[0].qid).toBe('002');
    });

    it('getDueWrong 应只返回到期的错题', () => {
      window.App.db.addWrong('001');
      const w = window.App.db.getWrong()[0];
      w.nextReview = Date.now() + 100000; // 未到期
      expect(window.App.db.getDueWrong().length).toBe(0);
      w.nextReview = Date.now() - 1;      // 已到期
      expect(window.App.db.getDueWrong().length).toBe(1);
    });
  });

  describe('App.db.recalcStats - 统计重算', () => {
    it('应基于 history 重新计算总统计与分类统计', () => {
      const d = window.App.db.get();
      d.history = [
        { qid: '001', ok: true, time: Date.now() },   // 专辑
        { qid: '002', ok: false, time: Date.now() },  // 歌曲
        { qid: '061', ok: true, time: Date.now() }    // 个人信息
      ];
      d.stats = { total: 999, correct: 999, cats: {} };
      window.App.db.recalcStats();
      expect(d.stats.total).toBe(3);
      expect(d.stats.correct).toBe(2);
      expect(d.stats.cats['专辑'].t).toBe(1);
      expect(d.stats.cats['歌曲'].t).toBe(1);
      expect(d.stats.cats['个人信息'].t).toBe(1);
    });
  });

  describe('App.db.setDailyGoal / getDailyGoal - 每日目标边界', () => {
    it('应在 5-100 范围内钳制输入值', () => {
      window.App.db.setDailyGoal(3);
      expect(window.App.db.getDailyGoal()).toBe(5);
      window.App.db.setDailyGoal(200);
      expect(window.App.db.getDailyGoal()).toBe(100);
      window.App.db.setDailyGoal(50);
      expect(window.App.db.getDailyGoal()).toBe(50);
    });
  });

  describe('App.db.getStreak - 连续打卡天数', () => {
    it('无记录时应返回 0', () => {
      expect(window.App.db.getStreak()).toBe(0);
    });

    it('今天有记录时应返回至少 1', () => {
      const d = window.App.db.get();
      d.history.push({ qid: '001', ok: true, time: Date.now() });
      expect(window.App.db.getStreak()).toBeGreaterThanOrEqual(1);
    });

    it('归档数据中的日期应计入连续打卡', () => {
      const d = window.App.db.get();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.archive = [{ date: today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate(), total: 1, correct: 1 }];
      expect(window.App.db.getStreak()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('App.db.checkAchievements - 成就徽章', () => {
    it('首次答题后应解锁 first_answer', () => {
      const d = window.App.db.get();
      d.stats = { total: 1, correct: 0, cats: {} };
      const unlocked = window.App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'first_answer')).toBe(true);
    });

    it('累计 100 题应解锁 total_100', () => {
      const d = window.App.db.get();
      d.stats = { total: 100, correct: 50, cats: {} };
      const unlocked = window.App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'total_100')).toBe(true);
    });

    it('正确率 ≥90% 且满 50 题应解锁 acc_90', () => {
      const d = window.App.db.get();
      d.stats = { total: 50, correct: 45, cats: {} };
      const unlocked = window.App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'acc_90')).toBe(true);
    });

    it('全部分类都有答题记录时应解锁 all_cats', () => {
      const d = window.App.db.get();
      d.stats.cats = { '专辑': { t: 1, c: 1 }, '歌曲': { t: 1, c: 1 }, '个人信息': { t: 1, c: 1 }, '获奖记录': { t: 1, c: 1 } };
      const unlocked = window.App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'all_cats')).toBe(true);
    });

    it('错题清零且已有答题记录时应解锁 wrong_clear', () => {
      const d = window.App.db.get();
      d.stats.total = 10;
      d.achievements = ['first_answer'];
      d.wrong = [];
      const unlocked = window.App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'wrong_clear')).toBe(true);
    });
  });

  describe('App.session - 答题中断恢复', () => {
    it('应能保存并恢复会话状态', () => {
      window.App.session.save({
        quiz: [{ id: '001' }, { id: '002' }],
        idx: 1,
        correctCount: 1,
        startTime: Date.now() - 5000,
        mode: 'standard',
        isWrongBookQuiz: true
      });
      const loaded = window.App.session.load();
      expect(loaded.quizIds).toEqual(['001', '002']);
      expect(loaded.idx).toBe(1);
      expect(loaded.correctCount).toBe(1);
      expect(loaded.mode).toBe('standard');
      expect(loaded.isWrongBookQuiz).toBe(true);
    });

    it('clear 后应返回 null', () => {
      window.App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
      window.App.session.clear();
      expect(window.App.session.load()).toBeNull();
    });
  });
});
