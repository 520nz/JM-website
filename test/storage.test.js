import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadData, loadStorage } from './loader.js';

/**
 * storage.js 核心逻辑测试
 * 覆盖：XSS转义、数据归档、间隔重复、成就检查、统计计算等
 */
describe('storage.js', () => {
  let App;

  beforeEach(async () => {
    loadData();
    loadStorage();
    App = window.App;
    await App.db.init();
  });

  // ========== XSS 转义 ==========
  describe('esc() - XSS 转义工具', () => {
    it('应正确转义 HTML 特殊字符', () => {
      // esc() 使用 textContent 设置，innerHTML 读取，会转义 HTML 特殊字符
      expect(App.esc('<script>')).toBe('&lt;script&gt;');
      expect(App.esc('&')).toBe('&amp;');
      // jsdom 的 innerHTML 会对特殊字符进行转义
      const escaped = App.esc('<img onerror=alert(1)>');
      expect(escaped).toContain('img');
      expect(escaped).toContain('alert');
      expect(escaped).not.toContain('<img');
    });

    it('应处理空值和 null', () => {
      expect(App.esc(null)).toBe('');
      expect(App.esc(undefined)).toBe('');
      expect(App.esc('')).toBe('');
    });

    it('应处理数字', () => {
      expect(App.esc(123)).toBe('123');
      expect(App.esc(0)).toBe('0');
    });

    it('应处理普通文本', () => {
      expect(App.esc('hello world')).toBe('hello world');
      expect(App.esc('林俊杰')).toBe('林俊杰');
    });
  });

  // ========== defaults() 默认数据 ==========
  describe('defaults() - 默认数据结构', () => {
    it('应返回完整的默认数据结构', () => {
      const d = App.db.defaults();
      expect(d).toHaveProperty('history', []);
      expect(d).toHaveProperty('wrong', []);
      expect(d).toHaveProperty('stats');
      expect(d.stats).toEqual({ total: 0, correct: 0, cats: {} });
      expect(d).toHaveProperty('theme', 'dark');
      expect(d).toHaveProperty('dailyGoal', 20);
      expect(d).toHaveProperty('achievements', []);
      expect(d).toHaveProperty('archive', []);
    });
  });

  // ========== findQ() 查找题目 ==========
  describe('findQ() - 题目查找', () => {
    it('应通过 ID 找到对应题目', () => {
      const q = App.db.findQ('001');
      expect(q).not.toBeNull();
      expect(q.id).toBe('001');
      expect(q.category).toBe('专辑');
      expect(q.question).toContain('林俊杰首张专辑');
    });

    it('对不存在的 ID 应返回 null', () => {
      const q = App.db.findQ('nonexistent');
      expect(q).toBeNull();
    });

    it('应能查找所有类别的题目', () => {
      const categories = ['专辑', '歌曲', '个人信息', '获奖记录'];
      for (const cat of categories) {
        const q = App.QUESTION_BANK.find(q => q.category === cat);
        expect(q).not.toBeUndefined();
        const found = App.db.findQ(q.id);
        expect(found).not.toBeNull();
        expect(found.category).toBe(cat);
      }
    });
  });

  // ========== addRecord() 答题记录 ==========
  describe('addRecord() - 答题记录与归档', () => {
    it('应正确添加答题记录', () => {
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      const d = App.db.get();
      expect(d.history.length).toBeGreaterThan(0);
      expect(d.stats.total).toBe(1);
      expect(d.stats.correct).toBe(1);
    });

    it('应在答错时不增加正确数', () => {
      App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
      const d = App.db.get();
      expect(d.stats.total).toBe(1);
      expect(d.stats.correct).toBe(0);
    });

    it('应正确统计分类数据', () => {
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      const d = App.db.get();
      expect(d.stats.cats['专辑']).toBeDefined();
      expect(d.stats.cats['专辑'].t).toBe(1);
      expect(d.stats.cats['专辑'].c).toBe(1);
    });

    it('超过 1000 条历史记录时应触发归档', () => {
      const now = Date.now();
      for (let i = 0; i < 1001; i++) {
        const time = i < 900 ? now - (100 * 24 * 60 * 60 * 1000) : now;
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: time });
      }
      const d = App.db.get();
      expect(d.history.length).toBeLessThanOrEqual(1000);
      expect(d.archive.length).toBeGreaterThan(0);
      expect(d.stats.total).toBe(1001);
    });

    it('归档不应在同一天重复创建', () => {
      const now = Date.now();
      // 第一次触发归档
      for (let i = 0; i < 1001; i++) {
        const time = i < 900 ? now - (100 * 24 * 60 * 60 * 1000) : now;
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: time });
      }
      const archiveLen1 = App.db.get().archive.length;
      // 第二次添加更多记录（同样日期范围）
      for (let j = 0; j < 50; j++) {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
      }
      // 归档长度不应因为同一天的记录而翻倍
      const archiveLen2 = App.db.get().archive.length;
      expect(archiveLen2).toBeLessThanOrEqual(archiveLen1 + 5); // 最多增加几个不同日期
    });
  });

  // ========== addWrong() 错题管理 ==========
  describe('addWrong() - 添加错题', () => {
    it('首次添加错题应初始化正确的字段', () => {
      App.db.addWrong('001');
      const wrong = App.db.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0]).toEqual(
        expect.objectContaining({
          qid: '001',
          cnt: 1,
          level: 0,
          lastReview: 0,
        })
      );
      expect(wrong[0].nextReview).toBeGreaterThan(0);
    });

    it('重复添加同一错题应增加计数并重置等级', () => {
      App.db.addWrong('001');
      App.db.addWrong('001');
      const wrong = App.db.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].cnt).toBe(2);
      expect(wrong[0].level).toBe(0);
    });
  });

  // ========== reviewCorrect() / reviewWrong() 间隔重复 ==========
  describe('间隔重复逻辑', () => {
    it('reviewCorrect 应提升等级', () => {
      App.db.addWrong('001');
      const result = App.db.reviewCorrect('001');
      expect(result.mastered).toBe(false);
      expect(result.level).toBe(1);
    });

    it('reviewCorrect 达到 level 5 应标记为已掌握', () => {
      App.db.addWrong('001');
      for (let i = 0; i < 4; i++) {
        App.db.reviewCorrect('001');
      }
      const result = App.db.reviewCorrect('001');
      expect(result.mastered).toBe(true);
      const wrong = App.db.getWrong();
      expect(wrong.filter(w => w.qid === '001').length).toBe(0);
    });

    it('reviewWrong 应重置等级为 0 并增加计数', () => {
      App.db.addWrong('001');
      App.db.reviewCorrect('001');
      App.db.reviewCorrect('001');
      App.db.reviewWrong('001');
      const wrong = App.db.getWrong();
      const item = wrong.find(w => w.qid === '001');
      expect(item.level).toBe(0);
      expect(item.cnt).toBeGreaterThanOrEqual(2);
    });

    it('reviewWrong 对不在错题本中的题目应自动添加', () => {
      App.db.reviewWrong('999');
      const wrong = App.db.getWrong();
      expect(wrong.find(w => w.qid === '999')).toBeDefined();
    });

    it('getDueWrong 应返回到期的错题', () => {
      App.db.addWrong('001');
      const wrong = App.db.getWrong();
      wrong[0].nextReview = Date.now() - 1000;
      wrong.push({
        qid: '002', cnt: 1, level: 2,
        time: Date.now(), lastReview: Date.now(),
        nextReview: Date.now() + 1000000
      });
      const due = App.db.getDueWrong();
      expect(due.length).toBe(1);
      expect(due[0].qid).toBe('001');
    });
  });

  // ========== removeWrong() 移除错题 ==========
  describe('removeWrong()', () => {
    it('应正确移除指定错题', () => {
      App.db.addWrong('001');
      App.db.addWrong('002');
      App.db.removeWrong('001');
      const wrong = App.db.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].qid).toBe('002');
    });
  });

  // ========== recalcStats() 重算统计 ==========
  describe('recalcStats() 重算统计', () => {
    it('应从历史记录重新计算统计', () => {
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      App.db.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
      App.db.addRecord({ qid: '003', ans: 'C', ok: true, time: Date.now() });

      const d = App.db.get();
      d.stats = { total: 999, correct: 999, cats: {} };

      App.db.recalcStats();
      const recalculated = App.db.get();
      expect(recalculated.stats.total).toBe(3);
      expect(recalculated.stats.correct).toBe(2);
    });

    it('重算后分类统计应正确', () => {
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      App.db.addRecord({ qid: '002', ans: 'A', ok: true, time: Date.now() });
      App.db.recalcStats();
      const d = App.db.get();
      expect(d.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
      expect(d.stats.cats['歌曲']).toEqual({ t: 1, c: 1 });
    });
  });

  // ========== getDailyGoal() / setDailyGoal() ==========
  describe('每日目标', () => {
    it('默认每日目标为 20', () => {
      expect(App.db.getDailyGoal()).toBe(20);
    });

    it('setDailyGoal 应限制在 5-100 范围内', () => {
      App.db.setDailyGoal(3);
      expect(App.db.getDailyGoal()).toBe(5);

      App.db.setDailyGoal(150);
      expect(App.db.getDailyGoal()).toBe(100);

      App.db.setDailyGoal(50);
      expect(App.db.getDailyGoal()).toBe(50);
    });
  });

  // ========== getStreak() 连续打卡 ==========
  describe('getStreak() 连续打卡', () => {
    it('无历史记录时应返回 0', () => {
      expect(App.db.getStreak()).toBe(0);
    });

    it('当天答题应计算连续 1 天', () => {
      const now = new Date();
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now.getTime() });
      const streak = App.db.getStreak();
      expect(streak).toBeGreaterThanOrEqual(1);
    });

    it('前一天答题应计算连续 1 天', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: yesterday.getTime() });
      const streak = App.db.getStreak();
      expect(streak).toBeGreaterThanOrEqual(1);
    });

    it('连续两天答题应正确计算', () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: today.getTime() });
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: yesterday.getTime() });
      const streak = App.db.getStreak();
      expect(streak).toBeGreaterThanOrEqual(2);
    });

    it('不连续的答题应只计算最近连续段', () => {
      const today = new Date();
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: today.getTime() });
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: threeDaysAgo.getTime() });
      const streak = App.db.getStreak();
      expect(streak).toBeGreaterThanOrEqual(1);
      expect(streak).toBeLessThanOrEqual(2);
    });
  });

  // ========== checkAchievements() 成就检查 ==========
  describe('checkAchievements() 成就检查', () => {
    it('首次答题应解锁 first_answer', () => {
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      const unlocks = App.db.checkAchievements();
      const ids = unlocks.map(a => a.id);
      expect(ids).toContain('first_answer');
    });

    it('累计 100 题应解锁 total_100', () => {
      for (let i = 0; i < 100; i++) {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      }
      const unlocks = App.db.checkAchievements();
      const ids = unlocks.map(a => a.id);
      expect(ids).toContain('total_100');
    });

    it('正确率达标应解锁 acc_90', () => {
      for (let i = 0; i < 45; i++) {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      }
      for (let i = 0; i < 5; i++) {
        App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
      }
      const unlocks = App.db.checkAchievements();
      const ids = unlocks.map(a => a.id);
      expect(ids).toContain('acc_90');
    });

    it('完美一轮应解锁 perfect_10', () => {
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
      const ids = unlocks.map(a => a.id);
      expect(ids).toContain('perfect_10');
    });

    it('单日 50 题应解锁 daily_50', () => {
      const now = Date.now();
      for (let i = 0; i < 50; i++) {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
      }
      const unlocks = App.db.checkAchievements();
      const ids = unlocks.map(a => a.id);
      expect(ids).toContain('daily_50');
    });

    it('已有成就不应重复解锁', () => {
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      const firstCheck = App.db.checkAchievements();
      const secondCheck = App.db.checkAchievements();
      const firstIds = firstCheck.map(a => a.id);
      const secondIds = secondCheck.map(a => a.id);
      for (const id of firstIds) {
        expect(secondIds).not.toContain(id);
      }
    });

    it('错题清零应解锁 wrong_clear', () => {
      // 错题清零条件：错题本为空、有答题记录、已解锁 first_answer
      // 先确保有答题记录和 first_answer
      App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
      // 第一次检查解锁 first_answer（wrong_clear 也会同时解锁因为条件已满足）
      const unlocks1 = App.db.checkAchievements();
      const ids1 = unlocks1.map(a => a.id);
      expect(ids1).toContain('first_answer');
      // wrong_clear 也应解锁，因为错题本为空且已有 first_answer
      expect(ids1).toContain('wrong_clear');
    });

    it('所有分类都有记录应解锁 all_cats', () => {
      App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
      App.db.addRecord({ qid: '002', ans: 'A', ok: true, time: Date.now() });
      App.db.addRecord({ qid: '061', ans: 'B', ok: true, time: Date.now() });
      App.db.addRecord({ qid: '069', ans: 'C', ok: true, time: Date.now() });
      const unlocks = App.db.checkAchievements();
      const ids = unlocks.map(a => a.id);
      expect(ids).toContain('all_cats');
    });
  });

  // ========== setData() / get() 数据操作 ==========
  describe('setData() 和 get()', () => {
    it('setData 应设置数据，get 应返回相同数据', () => {
      const testData = {
        history: [{ qid: '001', ok: true, time: Date.now() }],
        wrong: [],
        stats: { total: 1, correct: 1, cats: { '专辑': { t: 1, c: 1 } } },
        theme: 'light',
        dailyGoal: 30,
        achievements: ['first_answer'],
        archive: []
      };
      App.db.setData(testData);
      const d = App.db.get();
      expect(d.theme).toBe('light');
      expect(d.dailyGoal).toBe(30);
      expect(d.history.length).toBe(1);
    });
  });

  // ========== 题库数据完整性 ==========
  describe('题库数据完整性', () => {
    it('题库应包含所有四个分类', () => {
      const cats = new Set();
      for (const q of App.QUESTION_BANK) {
        cats.add(q.category);
      }
      expect(cats).toContain('专辑');
      expect(cats).toContain('歌曲');
      expect(cats).toContain('个人信息');
      expect(cats).toContain('获奖记录');
    });

    it('每道题目应有完整的字段', () => {
      for (const q of App.QUESTION_BANK) {
        expect(q.id).toBeDefined();
        expect(q.category).toBeDefined();
        expect(q.question).toBeDefined();
        expect(q.options).toBeDefined();
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.answer).toBeDefined();
        expect(q.explanation).toBeDefined();
        for (const opt of q.options) {
          expect(opt.key).toBeDefined();
          expect(opt.text).toBeDefined();
        }
      }
    });

    it('答案必须在选项中存在', () => {
      for (const q of App.QUESTION_BANK) {
        const keys = q.options.map(o => o.key);
        expect(keys).toContain(q.answer);
      }
    });
  });

  // ========== App.store 模块 ==========
  describe('App.store 题库管理', () => {
    it('题库应有默认数据', () => {
      expect(App.QUESTION_BANK.length).toBeGreaterThan(0);
      expect(App.DEFAULT_QUESTION_BANK.length).toBeGreaterThan(0);
    });

    it('DEFAULT_QUESTION_BANK 应是 QUESTION_BANK 的副本', () => {
      const originalLen = App.DEFAULT_QUESTION_BANK.length;
      App.QUESTION_BANK.push({
        id: 'test', category: '测试', question: '测试',
        options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: ''
      });
      expect(App.DEFAULT_QUESTION_BANK.length).toBe(originalLen);
    });
  });
});
