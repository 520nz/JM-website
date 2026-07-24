/**
 * storage.js 核心逻辑测试
 * 覆盖缺口：数据归档、间隔重复、成就系统、连续打卡
 */

describe('storage.js', () => {
  beforeEach(() => {
    // 重置 App 并加载 storage.js（因为 storage.js 在 IIFE 中捕获 App）
    // 注意：Node require 会缓存模块，需要清缓存后重新加载以隔离状态
    jest.resetModules();
    global.App = { QUESTION_BANK: [] };
    require('../storage.js');
  });

  // 辅助：等待 init
  async function initDB() {
    await App.db.init();
  }

  // 辅助：快速构建缓存（绕过 init 的异步，直接操作 get 返回的对象）
  function getData() {
    return App.db.get();
  }

  describe('esc - XSS 转义', () => {
    it('应返回空字符串当输入为 null/undefined', () => {
      expect(App.esc(null)).toBe('');
      expect(App.esc(undefined)).toBe('');
    });

    it('应将 HTML 特殊字符转义', () => {
      expect(App.esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(App.esc('A&B')).toBe('A&amp;B');
      expect(App.esc('"quoted"')).toBe('"quoted"');
    });

    it('应保留普通文本不变', () => {
      expect(App.esc('林俊杰')).toBe('林俊杰');
    });
  });

  describe('defaults - 默认数据结构', () => {
    it('默认数据应包含所有必需字段', () => {
      const d = App.db.defaults();
      expect(d).toHaveProperty('history');
      expect(d).toHaveProperty('wrong');
      expect(d).toHaveProperty('stats');
      expect(d).toHaveProperty('theme');
      expect(d).toHaveProperty('dailyGoal');
      expect(d).toHaveProperty('achievements');
      expect(d).toHaveProperty('archive');
      expect(Array.isArray(d.archive)).toBe(true);
    });
  });

  describe('addRecord - 添加答题记录', () => {
    it('应正确更新 total 和 correct 统计', async () => {
      await initDB();
      App.db.addRecord({ qid: 'q1', ans: 'A', ok: true, time: Date.now() });
      const d = getData();
      expect(d.stats.total).toBe(1);
      expect(d.stats.correct).toBe(1);
    });

    it('应将答错记录加入历史但不增加 correct', async () => {
      await initDB();
      App.db.addRecord({ qid: 'q1', ans: 'B', ok: false, time: Date.now() });
      const d = getData();
      expect(d.stats.total).toBe(1);
      expect(d.stats.correct).toBe(0);
    });

    it('应按分类聚合统计', async () => {
      await initDB();
      global.App.QUESTION_BANK = [
        { id: 'q1', category: '专辑' },
        { id: 'q2', category: '歌曲' },
        { id: 'q3', category: '专辑' }
      ];
      App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
      App.db.addRecord({ qid: 'q2', ok: false, time: Date.now() });
      App.db.addRecord({ qid: 'q3', ok: true, time: Date.now() });
      const d = getData();
      expect(d.stats.cats['专辑'].t).toBe(2);
      expect(d.stats.cats['专辑'].c).toBe(2);
      expect(d.stats.cats['歌曲'].t).toBe(1);
      expect(d.stats.cats['歌曲'].c).toBe(0);
    });
  });

  describe('addRecord - 数据归档（核心新增功能）', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const NINETY_DAYS = 90 * DAY;

    it('history <= 1000 时不应触发归档', async () => {
      await initDB();
      const d = getData();
      // 构造 1000 条新记录
      for (let i = 0; i < 1000; i++) {
        d.history.push({ qid: 'q' + i, ok: true, time: Date.now() });
      }
      d.stats.total = 1000;
      App.db.addRecord({ qid: 'q1000', ok: true, time: Date.now() });
      expect(getData().history.length).toBe(1001);
      expect(getData().archive.length).toBe(0);
    });

    it('history > 1000 但无 90 天前记录时不应归档', async () => {
      await initDB();
      const d = getData();
      const now = Date.now();
      // 构造 1001 条都是 89 天前的记录（在 cutoff 之上）
      for (let i = 0; i < 1001; i++) {
        d.history.push({ qid: 'q' + i, ok: true, time: now - 89 * DAY });
      }
      d.stats.total = 1001;
      App.db.addRecord({ qid: 'q1001', ok: true, time: now });
      // 由于所有记录都 >= cutoff，不应被归档
      expect(getData().history.length).toBe(1002);
      expect(getData().archive.length).toBe(0);
    });

    it('history > 1000 且有 90 天前记录时应按天聚合归档', async () => {
      await initDB();
      const d = getData();
      const now = Date.now();
      const oldTime = now - 91 * DAY;
      const oldDate = new Date(oldTime);
      const dateKey = oldDate.getFullYear() + '-' + (oldDate.getMonth() + 1) + '-' + oldDate.getDate();

      // 构造 999 条新记录 + 2 条旧记录
      for (let i = 0; i < 999; i++) {
        d.history.push({ qid: 'q' + i, ok: true, time: now });
      }
      d.history.push({ qid: 'old1', ok: true, time: oldTime });
      d.history.push({ qid: 'old2', ok: false, time: oldTime });
      d.stats.total = 1001;

      App.db.addRecord({ qid: 'q999', ok: true, time: now });

      const result = getData();
      expect(result.history.length).toBe(1000); // 999 新 + 1 条刚添加的
      expect(result.archive.length).toBe(1);
      expect(result.archive[0].date).toBe(dateKey);
      expect(result.archive[0].total).toBe(2);
      expect(result.archive[0].correct).toBe(1);
    });

    it('归档时应正确处理 archive 字段初始不存在的情况', async () => {
      await initDB();
      const d = getData();
      delete d.archive; // 模拟旧数据无 archive 字段
      const now = Date.now();
      for (let i = 0; i < 1000; i++) {
        d.history.push({ qid: 'q' + i, ok: true, time: now - 91 * DAY });
      }
      d.stats.total = 1000;
      App.db.addRecord({ qid: 'trigger', ok: true, time: now });
      expect(getData().archive.length).toBeGreaterThan(0);
    });

    it('应保留 90 天内记录不被归档', async () => {
      await initDB();
      const d = getData();
      const now = Date.now();
      // 1 条 91 天前 + 1000 条 1 天前
      d.history.push({ qid: 'old', ok: true, time: now - 91 * DAY });
      for (let i = 0; i < 1000; i++) {
        d.history.push({ qid: 'q' + i, ok: true, time: now - DAY });
      }
      d.stats.total = 1001;
      App.db.addRecord({ qid: 'new', ok: true, time: now });
      const result = getData();
      // 1000 条 1 天前的 + 1 条刚添加的 = 1001 条在 history 中
      expect(result.history.length).toBe(1001);
      expect(result.archive.length).toBe(1);
    });
  });

  describe('间隔重复 - addWrong / reviewCorrect / reviewWrong', () => {
    it('addWrong 应添加新错题到列表', async () => {
      await initDB();
      App.db.addWrong('q1');
      const w = App.db.getWrong();
      expect(w.length).toBe(1);
      expect(w[0].qid).toBe('q1');
      expect(w[0].cnt).toBe(1);
      expect(w[0].level).toBe(0);
    });

    it('addWrong 应对已有错题累加次数并重置等级', async () => {
      await initDB();
      App.db.addWrong('q1');
      // 模拟答对升级
      App.db.reviewCorrect('q1');
      const before = App.db.getWrong()[0];
      expect(before.level).toBe(1);
      // 再次答错
      App.db.addWrong('q1');
      const after = App.db.getWrong()[0];
      expect(after.cnt).toBe(2);
      expect(after.level).toBe(0);
    });

    it('reviewCorrect 应提升等级并设置下次复习时间', async () => {
      await initDB();
      App.db.addWrong('q1');
      const result = App.db.reviewCorrect('q1');
      expect(result.mastered).toBe(false);
      expect(result.level).toBe(1);
      const w = App.db.getWrong()[0];
      expect(w.nextReview).toBeGreaterThan(Date.now()); // 1 小时后
    });

    it('reviewCorrect 连续答对 5 次应标记为已掌握并移除', async () => {
      await initDB();
      App.db.addWrong('q1');
      for (let i = 0; i < 5; i++) {
        App.db.reviewCorrect('q1');
      }
      expect(App.db.getWrong().length).toBe(0);
    });

    it('reviewWrong 应重置等级并增加次数', async () => {
      await initDB();
      App.db.addWrong('q1');
      App.db.reviewCorrect('q1'); // level 1
      App.db.reviewWrong('q1');
      const w = App.db.getWrong()[0];
      expect(w.level).toBe(0);
      expect(w.cnt).toBe(2);
      expect(w.nextReview).toBeLessThanOrEqual(Date.now());
    });

    it('getDueWrong 应只返回到期或未到期的错题', async () => {
      await initDB();
      const d = getData();
      d.wrong = [
        { qid: 'q1', nextReview: Date.now() - 1000, level: 0 },
        { qid: 'q2', nextReview: Date.now() + 3600000, level: 1 },
        { qid: 'q3', nextReview: 0, level: 0 }
      ];
      const due = App.db.getDueWrong();
      expect(due.length).toBe(2);
      expect(due.some(w => w.qid === 'q1')).toBe(true);
      expect(due.some(w => w.qid === 'q3')).toBe(true);
    });
  });

  describe('getStreak - 连续打卡', () => {
    it('无记录时应返回 0', async () => {
      await initDB();
      expect(App.db.getStreak()).toBe(0);
    });

    it('今天答题应返回至少 1', async () => {
      await initDB();
      const d = getData();
      d.history.push({ qid: 'q1', time: Date.now() });
      expect(App.db.getStreak()).toBeGreaterThanOrEqual(1);
    });

    it('连续 3 天答题应返回 3', async () => {
      await initDB();
      const d = getData();
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      for (let i = 0; i < 3; i++) {
        const t = now.getTime() - i * 86400000;
        d.history.push({ qid: 'q' + i, time: t });
      }
      expect(App.db.getStreak()).toBe(3);
    });

    it('昨天答题今天未答题应不断签（返回至少 1）', async () => {
      await initDB();
      const d = getData();
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      d.history.push({ qid: 'q1', time: now.getTime() - 86400000 });
      expect(App.db.getStreak()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('checkAchievements - 成就系统', () => {
    it('应解锁 first_answer 当有答题记录', async () => {
      await initDB();
      const d = getData();
      d.stats.total = 1;
      const unlocked = App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'first_answer')).toBe(true);
    });

    it('应解锁 total_100 当累计 100 题', async () => {
      await initDB();
      const d = getData();
      d.stats.total = 100;
      const unlocked = App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'total_100')).toBe(true);
    });

    it('应解锁 acc_90 当答满 50 题且正确率 >= 90%', async () => {
      await initDB();
      const d = getData();
      d.stats.total = 50;
      d.stats.correct = 45;
      const unlocked = App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'acc_90')).toBe(true);
    });

    it('不应解锁 acc_90 当正确率 < 90%', async () => {
      await initDB();
      const d = getData();
      d.stats.total = 50;
      d.stats.correct = 44;
      const unlocked = App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'acc_90')).toBe(false);
    });

    it('应解锁 perfect_10 当本轮 10 题全对', async () => {
      await initDB();
      const unlocked = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
      expect(unlocked.some(a => a.id === 'perfect_10')).toBe(true);
    });

    it('应解锁 wrong_clear 当错题本为空且有过记录', async () => {
      await initDB();
      const d = getData();
      d.stats.total = 10;
      d.achievements = ['first_answer'];
      d.wrong = [];
      const unlocked = App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'wrong_clear')).toBe(true);
    });

    it('应解锁 all_cats 当所有分类都有答题记录', async () => {
      await initDB();
      const d = getData();
      d.stats.cats = {
        '专辑': { t: 1, c: 1 },
        '歌曲': { t: 1, c: 1 },
        '个人信息': { t: 1, c: 1 },
        '获奖记录': { t: 1, c: 1 }
      };
      const unlocked = App.db.checkAchievements();
      expect(unlocked.some(a => a.id === 'all_cats')).toBe(true);
    });
  });
});
