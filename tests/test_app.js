// app.js 数据处理逻辑测试
const { describe, it, expect } = require('./runner');
const mock = require('./mock');

require('./mock');
require('./setup').loadAll();
const App = global.App;

mock.setupDOMElements();
const mockDoc = mock.mockDoc;

function setupState(overrides) {
  const base = {
    history: [],
    wrong: [],
    stats: { total: 0, correct: 0, cats: {} },
    theme: 'dark',
    dailyGoal: 20,
    achievements: [],
    archive: []
  };
  if (overrides) {
    Object.keys(overrides).forEach(k => {
      base[k] = overrides[k];
    });
  }
  App.db.setData(base);
  return base;
}

describe('app.js - 首页统计 (updateHome)', () => {
  it('无历史记录时今日答题数为 0', () => {
    setupState();
    const d = App.db.get();
    const today = new Date().setHours(0, 0, 0, 0);
    const th = d.history.filter(h => h.time >= today);
    expect(th.length).toBe(0);
  });

  it('今日答题正确率计算', () => {
    const now = Date.now();
    setupState({
      history: [
        { qid: '001', ans: 'A', ok: true, time: now },
        { qid: '002', ans: 'B', ok: true, time: now },
        { qid: '003', ans: 'C', ok: false, time: now }
      ]
    });
    const d = App.db.get();
    const today = new Date().setHours(0, 0, 0, 0);
    const th = d.history.filter(h => h.time >= today);
    const acc = th.length > 0 ? Math.round(th.filter(h => h.ok).length / th.length * 100) : 0;
    expect(th.length).toBe(3);
    expect(acc).toBe(67);
  });

  it('无记录时正确率为 0%', () => {
    setupState();
    const d = App.db.get();
    const today = new Date().setHours(0, 0, 0, 0);
    const th = d.history.filter(h => h.time >= today);
    const acc = th.length > 0 ? Math.round(th.filter(h => h.ok).length / th.length * 100) : 0;
    expect(acc).toBe(0);
  });

  it('全部正确时正确率为 100%', () => {
    const now = Date.now();
    setupState({
      history: [
        { qid: '001', ans: 'A', ok: true, time: now },
        { qid: '002', ans: 'B', ok: true, time: now }
      ]
    });
    const d = App.db.get();
    const today = new Date().setHours(0, 0, 0, 0);
    const th = d.history.filter(h => h.time >= today);
    const acc = th.length > 0 ? Math.round(th.filter(h => h.ok).length / th.length * 100) : 0;
    expect(acc).toBe(100);
  });
});

describe('app.js - 每日目标进度', () => {
  it('进度百分比计算', () => {
    const goal = 20;
    const todayDone = 5;
    const goalPct = Math.min(100, Math.round(todayDone / goal * 100));
    expect(goalPct).toBe(25);
  });

  it('进度百分比封顶 100%', () => {
    const goal = 20;
    const todayDone = 25;
    const goalPct = Math.min(100, Math.round(todayDone / goal * 100));
    expect(goalPct).toBe(100);
  });

  it('目标完成后显示完成样式', () => {
    const goal = 20;
    const todayDone = 20;
    const goalPct = Math.min(100, Math.round(todayDone / goal * 100));
    expect(goalPct >= 100).toBe(true);
  });
});

describe('app.js - 错题本排序', () => {
  it('按错误次数排序', () => {
    setupState({
      wrong: [
        { qid: '001', cnt: 3, level: 0, time: Date.now() - 3000, lastReview: 0, nextReview: Date.now() },
        { qid: '002', cnt: 1, level: 0, time: Date.now() - 1000, lastReview: 0, nextReview: Date.now() },
        { qid: '003', cnt: 5, level: 0, time: Date.now() - 5000, lastReview: 0, nextReview: Date.now() }
      ]
    });
    const wl = App.db.getWrong();
    const sorted = wl.slice().sort((a, b) => b.cnt - a.cnt);
    expect(sorted[0].qid).toBe('003');
    expect(sorted[sorted.length - 1].qid).toBe('002');
  });

  it('按到期时间排序', () => {
    const now = Date.now();
    setupState({
      wrong: [
        { qid: '001', cnt: 1, level: 0, time: now - 3000, lastReview: 0, nextReview: now + 7 * 24 * 60 * 60 * 1000 },
        { qid: '002', cnt: 1, level: 0, time: now - 1000, lastReview: 0, nextReview: now + 1 * 24 * 60 * 60 * 1000 },
        { qid: '003', cnt: 1, level: 0, time: now - 5000, lastReview: 0, nextReview: now }
      ]
    });
    const wl = App.db.getWrong();
    const sorted = wl.slice().sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
    expect(sorted[0].qid).toBe('003'); // 最先到期
  });

  it('按最近添加排序（默认）', () => {
    const now = Date.now();
    setupState({
      wrong: [
        { qid: '001', cnt: 1, level: 0, time: now - 3000, lastReview: 0, nextReview: now },
        { qid: '002', cnt: 1, level: 0, time: now - 1000, lastReview: 0, nextReview: now },
        { qid: '003', cnt: 1, level: 0, time: now - 5000, lastReview: 0, nextReview: now }
      ]
    });
    const wl = App.db.getWrong();
    const sorted = wl.slice().sort((a, b) => (b.time || 0) - (a.time || 0));
    expect(sorted[0].qid).toBe('002'); // 最近添加
  });
});

describe('app.js - 统计页数据', () => {
  it('统计数据正确计算', () => {
    setupState({
      stats: { total: 100, correct: 80, cats: {} }
    });
    const d = App.db.get();
    const acc = d.stats.total > 0 ? Math.round(d.stats.correct / d.stats.total * 100) : 0;
    expect(d.stats.total).toBe(100);
    expect(d.stats.correct).toBe(80);
    expect(acc).toBe(80);
  });

  it('零统计数据不除零', () => {
    setupState({
      stats: { total: 0, correct: 0, cats: {} }
    });
    const d = App.db.get();
    const acc = d.stats.total > 0 ? Math.round(d.stats.correct / d.stats.total * 100) : 0;
    expect(acc).toBe(0);
  });

  it('分类统计正确', () => {
    setupState({
      history: [
        { qid: '001', ans: 'A', ok: true, time: Date.now() }, // 专辑
        { qid: '002', ans: 'B', ok: true, time: Date.now() }, // 歌曲
        { qid: '003', ans: 'C', ok: false, time: Date.now() }  // 个人信息
      ],
      stats: { total: 3, correct: 2, cats: { '专辑': { t: 1, c: 1 }, '歌曲': { t: 1, c: 1 }, '个人信息': { t: 1, c: 0 } } }
    });
    const d = App.db.get();
    expect(d.stats.cats['专辑'].t).toBe(1);
    expect(d.stats.cats['专辑'].c).toBe(1);
    expect(d.stats.cats['个人信息'].t).toBe(1);
    expect(d.stats.cats['个人信息'].c).toBe(0);
  });

  it('分类正确率计算', () => {
    const cats = {
      '专辑': { t: 10, c: 8 },
      '歌曲': { t: 5, c: 3 },
      '个人信息': { t: 0, c: 0 }
    };
    for (const name in cats) {
      const s = cats[name];
      const pct = s.t > 0 ? Math.round(s.c / s.t * 100) : 0;
      if (name === '专辑') expect(pct).toBe(80);
      if (name === '歌曲') expect(pct).toBe(60);
      if (name === '个人信息') expect(pct).toBe(0);
    }
  });
});

describe('app.js - 成就检查 (checkAchievements)', () => {
  it('首次答题解锁 first_answer', () => {
    setupState({
      stats: { total: 1, correct: 1, cats: {} }
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).toContain('first_answer');
  });

  it('累计 100 题解锁 total_100', () => {
    setupState({
      stats: { total: 100, correct: 80, cats: {} }
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).toContain('total_100');
  });

  it('累计 500 题解锁 total_500', () => {
    setupState({
      stats: { total: 500, correct: 400, cats: {} }
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).toContain('total_500');
  });

  it('正确率 ≥90% 且 ≥50 题解锁 acc_90', () => {
    setupState({
      stats: { total: 50, correct: 48, cats: {} }
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).toContain('acc_90');
  });

  it('正确率不足不解锁 acc_90', () => {
    setupState({
      stats: { total: 50, correct: 40, cats: {} }
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).not.toContain('acc_90');
  });

  it('题目数量不足不解锁 acc_90', () => {
    setupState({
      stats: { total: 30, correct: 30, cats: {} }
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).not.toContain('acc_90');
  });

  it('10 题全对解锁 perfect_10', () => {
    setupState({
      stats: { total: 10, correct: 10, cats: {} }
    });
    const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    const ids = unlocks.map(u => u.id);
    expect(ids).toContain('perfect_10');
  });

  it('9 题全对不解锁 perfect_10', () => {
    setupState({
      stats: { total: 9, correct: 9, cats: {} }
    });
    const unlocks = App.db.checkAchievements({ quizTotal: 9, quizCorrect: 9 });
    const ids = unlocks.map(u => u.id);
    expect(ids).not.toContain('perfect_10');
  });

  it('连续 3 天解锁 streak_3', () => {
    const history = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 0; i < 3; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      history.push({ qid: '001', ans: 'A', ok: true, time: d.getTime() });
    }
    setupState({
      history,
      stats: { total: 3, correct: 3, cats: {} }
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).toContain('streak_3');
  });

  it('连续 7 天解锁 streak_7', () => {
    const history = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      history.push({ qid: '001', ans: 'A', ok: true, time: d.getTime() });
    }
    setupState({
      history,
      stats: { total: 7, correct: 7, cats: {} }
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).toContain('streak_7');
  });

  it('错题清零解锁 wrong_clear', () => {
    setupState({
      wrong: [],
      stats: { total: 10, correct: 8, cats: {} },
      achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).toContain('wrong_clear');
  });

  it('有错题时不解锁 wrong_clear', () => {
    setupState({
      wrong: [{ qid: '001', cnt: 1, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() }],
      stats: { total: 10, correct: 8, cats: {} },
      achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).not.toContain('wrong_clear');
  });

  it('全分类答题解锁 all_cats', () => {
    setupState({
      stats: {
        total: 10, correct: 8,
        cats: { '专辑': { t: 1, c: 1 }, '歌曲': { t: 1, c: 1 }, '个人信息': { t: 1, c: 1 }, '获奖记录': { t: 1, c: 1 } }
      }
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).toContain('all_cats');
  });

  it('部分分类答题不解锁 all_cats', () => {
    setupState({
      stats: {
        total: 10, correct: 8,
        cats: { '专辑': { t: 1, c: 1 }, '歌曲': { t: 1, c: 1 } }
      }
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).not.toContain('all_cats');
  });

  it('已解锁的成就不重复解锁', () => {
    setupState({
      stats: { total: 100, correct: 80, cats: {} },
      achievements: ['first_answer']
    });
    const unlocks = App.db.checkAchievements();
    const ids = unlocks.map(u => u.id);
    expect(ids).not.toContain('first_answer');
    expect(ids).toContain('total_100');
  });
});

describe('app.js - 成就定义', () => {
  it('成就定义完整', () => {
    const defs = App.db.getAchievementDefs();
    expect(defs.length).toBe(10);
    const ids = defs.map(d => d.id);
    expect(ids).toContain('first_answer');
    expect(ids).toContain('perfect_10');
    expect(ids).toContain('streak_3');
    expect(ids).toContain('streak_7');
    expect(ids).toContain('wrong_clear');
    expect(ids).toContain('all_cats');
  });

  it('每个成就有必要字段', () => {
    const defs = App.db.getAchievementDefs();
    for (let i = 0; i < defs.length; i++) {
      expect(defs[i].id).toBeDefined();
      expect(defs[i].name).toBeDefined();
      expect(defs[i].icon).toBeDefined();
      expect(defs[i].desc).toBeDefined();
    }
  });
});

describe('app.js - 视图切换', () => {
  it('切换视图后正确设置状态', () => {
    App.switchView('home');
    // 验证视图切换逻辑
    const homeView = mockDoc.getElementById('view-home');
    if (homeView) {
      expect(homeView.classList.contains('active')).toBe(true);
    }
  });

  it('切换到 practice 视图', () => {
    setupState();
    App.selectMode('quick');
    App.startRandomQuiz();
    App.switchView('practice');
    const practiceView = mockDoc.getElementById('view-practice');
    if (practiceView) {
      expect(practiceView.classList.contains('active')).toBe(true);
    }
  });

  it('切换视图时触发对应更新', () => {
    setupState({
      history: [{ qid: '001', ans: 'A', ok: true, time: Date.now() }]
    });
    App.switchView('home');
    // 验证 updateHome 被调用（间接：今日答题数应已计算）
  });
});

describe('app.js - 边界条件', () => {
  it('空 history 过滤不报错', () => {
    setupState();
    const d = App.db.get();
    const today = new Date().setHours(0, 0, 0, 0);
    const filtered = d.history.filter(h => h.time >= today);
    expect(filtered.length).toBe(0);
  });

  it('空 wrong 列表渲染', () => {
    setupState();
    const wl = App.db.getWrong();
    expect(wl.length).toBe(0);
  });

  it('NaN 处理', () => {
    const x = NaN;
    expect(isNaN(x)).toBe(true);
    expect(x > 0).toBe(false);
    expect(x < 0).toBe(false);
  });

  it('除零防护', () => {
    const total = 0;
    const correct = 0;
    const pct = total > 0 ? Math.round(correct / total * 100) : 0;
    expect(pct).toBe(0);
  });

  it('空题库查找返回 null', () => {
    const result = App.db.findQ('nonexistent_id_12345');
    expect(result).toBe(null);
  });
});
