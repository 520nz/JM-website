import { describe, it, expect, beforeEach } from 'vitest';
import { loadAllApp, resetDB, makeQuizBank } from './test-helpers.js';

describe('storage.js - App.db 核心逻辑', () => {
  let App;

  function resetCache() {
    App.db.setData(App.db.defaults());
  }

  beforeEach(async () => {
    resetDB();
    App = loadAllApp();
    App.QUESTION_BANK = makeQuizBank();
    resetCache();
  });

  describe('esc() - XSS 转义', () => {
    it('对 HTML 标签进行转义', () => {
      expect(App.esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
    it('对 null/undefined 返回空字符串', () => {
      expect(App.esc(null)).toBe('');
      expect(App.esc(undefined)).toBe('');
    });
    it('对数字进行转义', () => {
      expect(App.esc(123)).toBe('123');
    });
  });

  describe('findQ() - 查找题目', () => {
    it('找到存在的题目', () => {
      expect(App.db.findQ('q1')).not.toBeNull();
      expect(App.db.findQ('q1').question).toBe('Q1');
    });
    it('不存在的题目返回 null', () => {
      expect(App.db.findQ('nonexistent')).toBeNull();
    });
  });

  describe('defaults() - 默认数据结构', () => {
    it('返回包含完整字段的对象', () => {
      const d = App.db.defaults();
      expect(Array.isArray(d.history)).toBe(true);
      expect(Array.isArray(d.wrong)).toBe(true);
      expect(d.stats).toEqual({ total: 0, correct: 0, cats: {} });
      expect(d.theme).toBe('dark');
      expect(d.dailyGoal).toBe(20);
      expect(Array.isArray(d.achievements)).toBe(true);
      expect(Array.isArray(d.archive)).toBe(true);
    });
  });

  describe('addRecord() - 添加答题记录', () => {
    it('正确答题时 stats 正确累加', () => {
      resetCache();
      App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      const d = App.db.get();
      expect(d.stats.total).toBe(1);
      expect(d.stats.correct).toBe(1);
      expect(d.history.length).toBe(1);
    });

    it('错误答题时 correct 不累加', () => {
      resetCache();
      App.db.addRecord({ qid: 'q1', ok: false, time: Date.now() });
      const d = App.db.get();
      expect(d.stats.total).toBe(1);
      expect(d.stats.correct).toBe(0);
    });

    it('按题目分类统计', () => {
      resetCache();
      App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      App.db.addRecord({ qid: 'q1', ok: false, time: Date.now() });
      App.db.addRecord({ qid: 'q2', ok: true, time: Date.now() });

      const d = App.db.get();
      expect(d.stats.cats['专辑']).toEqual({ t: 2, c: 1 });
      expect(d.stats.cats['歌曲']).toEqual({ t: 1, c: 1 });
    });

    it('不存在的题目不产生分类统计，但 total 仍累加', () => {
      resetCache();
      App.db.addRecord({ qid: 'unknown', ok: true, time: Date.now() });
      const d = App.db.get();
      expect(d.stats.total).toBe(1);
      expect(Object.keys(d.stats.cats).length).toBe(0);
    });
  });

  describe('addRecord() - 历史归档逻辑', () => {
    it('超过 1000 条时触发归档', () => {
      resetCache();
      const now = Date.now();
      const oldTime = now - 100 * 24 * 60 * 60 * 1000;

      for (let i = 0; i < 600; i++) {
        App.db.addRecord({ qid: 'q1', ok: true, time: oldTime + i * 1000 });
      }
      for (let j = 0; j < 500; j++) {
        App.db.addRecord({ qid: 'q1', ok: true, time: now + j * 1000 });
      }

      const d = App.db.get();
      expect(d.history.length).toBeLessThanOrEqual(1000);
      expect(d.archive.length).toBeGreaterThan(0);
    });

    it('归档按天聚合数据正确', () => {
      resetCache();
      const now = Date.now();
      const oldTime = now - 100 * 24 * 60 * 60 * 1000;

      for (let i = 0; i < 1010; i++) {
        App.db.addRecord({ qid: 'q1', ok: i % 2 === 0, time: oldTime + i * 1000 });
      }

      const d = App.db.get();
      expect(d.archive.length).toBeGreaterThan(0);
      for (const a of d.archive) {
        expect(typeof a.date).toBe('string');
        expect(typeof a.total).toBe('number');
        expect(typeof a.correct).toBe('number');
      }
    });

    it('归档不会重复添加相同日期', () => {
      resetCache();
      const now = Date.now();
      const oldTime = now - 100 * 24 * 60 * 60 * 1000;

      for (let i = 0; i < 1010; i++) {
        App.db.addRecord({ qid: 'q1', ok: true, time: oldTime });
      }

      const d = App.db.get();
      const dates = d.archive.map(a => a.date);
      const unique = [...new Set(dates)];
      expect(unique.length).toBe(dates.length);
    });
  });

  describe('addWrong() - 添加错题', () => {
    it('首次添加错题', () => {
      resetCache();
      App.db.addWrong('q1');
      const d = App.db.get();
      expect(d.wrong.length).toBe(1);
      const w = d.wrong[0];
      expect(w.qid).toBe('q1');
      expect(w.cnt).toBe(1);
      expect(w.level).toBe(0);
      expect(w.nextReview).toBeGreaterThanOrEqual(Date.now() - 1000);
    });

    it('重复添加同一错题时重置等级并累加 cnt', () => {
      resetCache();
      App.db.addWrong('q1');
      App.db.addWrong('q1');
      const d = App.db.get();
      expect(d.wrong.length).toBe(1);
      expect(d.wrong[0].cnt).toBe(2);
      expect(d.wrong[0].level).toBe(0);
    });

    it('添加不同题目产生不同记录', () => {
      resetCache();
      App.db.addWrong('q1');
      App.db.addWrong('q2');
      const d = App.db.get();
      expect(d.wrong.length).toBe(2);
    });
  });

  describe('reviewCorrect() - 答对复习', () => {
    it('答对时 level+1', () => {
      resetCache();
      App.db.addWrong('q1');
      const result = App.db.reviewCorrect('q1');
      expect(result.mastered).toBe(false);
      expect(result.level).toBe(1);
      expect(App.db.get().wrong[0].level).toBe(1);
    });

    it('答对 5 次后掌握并从错题本移除', () => {
      resetCache();
      App.db.addWrong('q1');
      for (let i = 0; i < 5; i++) {
        const result = App.db.reviewCorrect('q1');
        if (i < 4) {
          expect(result.mastered).toBe(false);
        } else {
          expect(result.mastered).toBe(true);
        }
      }
      expect(App.db.get().wrong.length).toBe(0);
    });

    it('答对后 nextReview 按间隔重复时间表推进', () => {
      resetCache();
      App.db.addWrong('q1');
      const nowBefore = Date.now();
      App.db.reviewCorrect('q1');
      const w = App.db.get().wrong[0];
      expect(w.nextReview).toBeGreaterThanOrEqual(nowBefore + 1 * 60 * 60 * 1000 - 1000);
    });

    it('错题不存在时返回 mastered: false', () => {
      resetCache();
      const result = App.db.reviewCorrect('nonexistent');
      expect(result.mastered).toBe(false);
      expect(result.qid).toBe('nonexistent');
    });
  });

  describe('reviewWrong() - 答错复习', () => {
    it('答错时 level 重置为 0，cnt+1', () => {
      resetCache();
      App.db.addWrong('q1');
      App.db.reviewCorrect('q1');
      App.db.reviewCorrect('q1');
      App.db.reviewWrong('q1');
      const w = App.db.get().wrong[0];
      expect(w.level).toBe(0);
      expect(w.cnt).toBe(2);
    });

    it('nextReview 重置为立即可复习', () => {
      resetCache();
      App.db.addWrong('q1');
      const now = Date.now();
      App.db.reviewCorrect('q1');
      App.db.reviewCorrect('q1');
      App.db.reviewWrong('q1');
      const w = App.db.get().wrong[0];
      expect(w.nextReview).toBeLessThanOrEqual(now + 1000);
    });

    it('不在错题本中时自动添加', () => {
      resetCache();
      App.db.reviewWrong('new_q');
      const d = App.db.get();
      expect(d.wrong.length).toBe(1);
      expect(d.wrong[0].qid).toBe('new_q');
    });
  });

  describe('getDueWrong() - 到期错题筛选', () => {
    it('返回所有 nextReview <= now 的错题', () => {
      resetCache();
      App.db.addWrong('q1');
      App.db.addWrong('q2');
      App.db.addWrong('q3');
      App.db.reviewCorrect('q1');
      App.db.reviewCorrect('q2');

      const due = App.db.getDueWrong();
      const dueIds = due.map(w => w.qid);
      expect(dueIds).toContain('q3');
    });

    it('nextReview 为 0 或 undefined 时视为到期', () => {
      App.db.setData({
        ...App.db.defaults(),
        wrong: [{ qid: 'q1', cnt: 1, level: 0, time: Date.now(), lastReview: 0, nextReview: 0 }]
      });
      const due = App.db.getDueWrong();
      expect(due.length).toBe(1);
    });
  });

  describe('removeWrong() - 移除错题', () => {
    it('移除指定错题', () => {
      resetCache();
      App.db.addWrong('q1');
      App.db.addWrong('q2');
      App.db.removeWrong('q1');
      const d = App.db.get();
      expect(d.wrong.length).toBe(1);
      expect(d.wrong[0].qid).toBe('q2');
    });
  });

  describe('recalcStats() - 重新计算统计', () => {
    it('根据 history 重新计算 stats', () => {
      resetCache();
      App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      App.db.addRecord({ qid: 'q1', ok: false, time: Date.now() });
      App.db.addRecord({ qid: 'q2', ok: true, time: Date.now() });

      const d = App.db.get();
      d.stats.total = 999;
      d.stats.correct = 0;
      d.stats.cats = {};

      App.db.recalcStats();

      expect(App.db.get().stats.total).toBe(3);
      expect(App.db.get().stats.correct).toBe(2);
      expect(App.db.get().stats.cats['专辑'].t).toBe(2);
      expect(App.db.get().stats.cats['专辑'].c).toBe(1);
    });

    it('history 为空时 stats 归零', () => {
      const d = App.db.defaults();
      d.stats = { total: 100, correct: 50, cats: {} };
      App.db.setData(d);
      App.db.recalcStats();
      expect(App.db.get().stats.total).toBe(0);
      expect(App.db.get().stats.correct).toBe(0);
    });
  });

  describe('setDailyGoal() - 每日目标边界', () => {
    it('低于 5 时限制为 5', () => {
      resetCache();
      App.db.setDailyGoal(1);
      expect(App.db.get().dailyGoal).toBe(5);
    });
    it('高于 100 时限制为 100', () => {
      resetCache();
      App.db.setDailyGoal(200);
      expect(App.db.get().dailyGoal).toBe(100);
    });
    it('正常范围值', () => {
      resetCache();
      App.db.setDailyGoal(30);
      expect(App.db.get().dailyGoal).toBe(30);
    });
    it('0 值被限制为 5', () => {
      resetCache();
      App.db.setDailyGoal(0);
      expect(App.db.get().dailyGoal).toBe(5);
    });
  });

  describe('getStreak() - 连续打卡天数', () => {
    it('无历史时返回 0', () => {
      resetCache();
      expect(App.db.getStreak()).toBe(0);
    });

    it('今天有答题记录 streak 至少为 1', () => {
      resetCache();
      App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      expect(App.db.getStreak()).toBeGreaterThanOrEqual(1);
    });

    it('今天没答题但昨天有，从昨天开始计', () => {
      resetCache();
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const twoDaysAgo = yesterday - 24 * 60 * 60 * 1000;
      App.db.setData({
        ...App.db.defaults(),
        history: [
          { qid: 'q1', ok: true, time: yesterday },
          { qid: 'q2', ok: true, time: twoDaysAgo },
        ],
      });
      expect(App.db.getStreak()).toBe(2);
    });

    it('有间断时 streak 从最近的连续段开始计', () => {
      resetCache();
      const now = new Date(); now.setHours(12, 0, 0, 0);
      const d1 = new Date(now); d1.setDate(d1.getDate() - 1);
      const d2 = new Date(now); d2.setDate(d2.getDate() - 2);
      const d5 = new Date(now); d5.setDate(d5.getDate() - 5);

      App.db.setData({
        ...App.db.defaults(),
        history: [
          { qid: 'q1', ok: true, time: d1.getTime() },
          { qid: 'q2', ok: true, time: d2.getTime() },
          { qid: 'q3', ok: true, time: d5.getTime() },
        ],
      });
      expect(App.db.getStreak()).toBe(2);
    });

    it('归档数据中的日期也计入', () => {
      resetCache();
      const today = new Date();
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      App.db.setData({
        ...App.db.defaults(),
        archive: [
          { date: yesterday.getFullYear() + '-' + (yesterday.getMonth()) + '-' + yesterday.getDate(), total: 10, correct: 10 },
          { date: twoDaysAgo.getFullYear() + '-' + (twoDaysAgo.getMonth()) + '-' + twoDaysAgo.getDate(), total: 5, correct: 5 },
        ],
      });
      expect(App.db.getStreak()).toBe(2);
    });
  });

  describe('checkAchievements() - 成就徽章检查', () => {
    it('首次答题解锁 first_answer', () => {
      resetCache();
      App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      const unlocks = App.db.checkAchievements();
      expect(unlocks.map(u => u.id)).toContain('first_answer');
    });

    it('累计 100 题解锁 total_100', () => {
      resetCache();
      for (let i = 0; i < 100; i++) {
        App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      }
      const unlocks = App.db.checkAchievements();
      expect(unlocks.map(u => u.id)).toContain('total_100');
    });

    it('累计 500 题解锁 total_500', () => {
      resetCache();
      for (let i = 0; i < 500; i++) {
        App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      }
      const unlocks = App.db.checkAchievements();
      expect(unlocks.map(u => u.id)).toContain('total_500');
    });

    it('答对 50 题且正确率 >= 90% 解锁 acc_90', () => {
      resetCache();
      for (let i = 0; i < 50; i++) {
        App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      }
      App.db.addRecord({ qid: 'q2', ok: false, time: Date.now() });
      const unlocks = App.db.checkAchievements();
      expect(unlocks.map(u => u.id)).toContain('acc_90');
    });

    it('答对 50 题但正确率 < 90% 不解锁 acc_90', () => {
      resetCache();
      for (let i = 0; i < 40; i++) {
        App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      }
      for (let j = 0; j < 10; j++) {
        App.db.addRecord({ qid: 'q1', ok: false, time: Date.now() });
      }
      const unlocks = App.db.checkAchievements();
      expect(unlocks.map(u => u.id)).not.toContain('acc_90');
    });

    it('单次完美 10 题解锁 perfect_10', () => {
      resetCache();
      for (let i = 0; i < 10; i++) {
        App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      }
      const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
      expect(unlocks.map(u => u.id)).toContain('perfect_10');
    });

    it('完美 5 题不解锁 perfect_10', () => {
      resetCache();
      for (let i = 0; i < 5; i++) {
        App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      }
      const unlocks = App.db.checkAchievements({ quizTotal: 5, quizCorrect: 5 });
      expect(unlocks.map(u => u.id)).not.toContain('perfect_10');
    });

    it('连续 3 天解锁 streak_3', () => {
      resetCache();
      const now = new Date();
      for (let d = 0; d < 3; d++) {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - d);
        dt.setHours(12, 0, 0, 0);
        App.db.addRecord({ qid: 'q1', ok: true, time: dt.getTime() });
      }
      const unlocks = App.db.checkAchievements();
      expect(unlocks.map(u => u.id)).toContain('streak_3');
    });

    it('连续 7 天解锁 streak_7', () => {
      resetCache();
      const now = new Date();
      for (let d = 0; d < 7; d++) {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - d);
        dt.setHours(12, 0, 0, 0);
        App.db.addRecord({ qid: 'q1', ok: true, time: dt.getTime() });
      }
      const unlocks = App.db.checkAchievements();
      expect(unlocks.map(u => u.id)).toContain('streak_7');
    });

    it('所有分类都有答题记录解锁 all_cats', () => {
      resetCache();
      App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      App.db.addRecord({ qid: 'q2', ok: true, time: Date.now() });
      App.db.addRecord({ qid: 'q3', ok: true, time: Date.now() });
      App.db.addRecord({ qid: 'q4', ok: true, time: Date.now() });
      const unlocks = App.db.checkAchievements();
      expect(unlocks.map(u => u.id)).toContain('all_cats');
    });

    it('已有成就不会重复解锁', () => {
      resetCache();
      App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      App.db.checkAchievements();
      const achievementsAfterFirst = App.db.get().achievements.length;
      App.db.addRecord({ qid: 'q2', ok: true, time: Date.now() });
      App.db.checkAchievements();
      expect(App.db.get().achievements.length).toBe(achievementsAfterFirst);
    });
  });

  describe('session 模块', () => {
    it('save/load/clear 正常工作', () => {
      const state = {
        quiz: [{ id: 'q1', question: 'Q1', options: [], answer: 'A', explanation: '' }],
        idx: 2,
        correctCount: 5,
        startTime: 12345,
        mode: 'quick',
        isWrongBookQuiz: false,
      };
      App.session.save(state);
      const loaded = App.session.load();
      expect(loaded.idx).toBe(2);
      expect(loaded.correctCount).toBe(5);
      expect(loaded.quizIds).toEqual(['q1']);

      App.session.clear();
      expect(App.session.load()).toBeNull();
    });
  });
});
