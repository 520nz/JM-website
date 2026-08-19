// storage.js 核心逻辑测试
const { describe, it, expect } = require('./runner');
const { mockSessionStorage, setupDOMElements } = require('./mock');

// 加载源文件
require('./setup').loadAll();
const App = global.App;

// 设置 DOM 环境
setupDOMElements();

describe('storage.js - XSS 转义 (esc)', () => {
  it('null 和 undefined 返回空字符串', () => {
    expect(App.esc(null)).toBe('');
    expect(App.esc(undefined)).toBe('');
  });

  it('普通文本不变', () => {
    expect(App.esc('hello world')).toBe('hello world');
  });

  it('转义 HTML 标签', () => {
    const result = App.esc('<script>alert("xss")</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  it('转义特殊字符 &', () => {
    const result = App.esc('A & B');
    expect(result).toContain('&amp;');
  });

  it('转义双引号', () => {
    const result = App.esc('He said "hello"');
    expect(result).toContain('&quot;');
  });

  it('转义单引号', () => {
    const result = App.esc("It's a test");
    expect(result).toContain('&#39;');
  });

  it('数字正确转换为字符串', () => {
    expect(App.esc(123)).toBe('123');
    expect(App.esc(0)).toBe('0');
  });

  it('空字符串返回空字符串', () => {
    expect(App.esc('')).toBe('');
  });

  it('防止事件处理器注入', () => {
    const result = App.esc('onclick="alert(1)"');
    expect(result).not.toContain('"');
  });
});

describe('storage.js - 间隔重复 (addWrong/reviewCorrect/reviewWrong)', () => {
  // 辅助函数：创建测试用的答题记录
  function setupState() {
    App.db.setData({
      history: [],
      wrong: [],
      stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark',
      dailyGoal: 20,
      achievements: [],
      archive: []
    });
  }

  it('addWrong 创建新错题', () => {
    setupState();
    App.db.addWrong('001');
    const wl = App.db.getWrong();
    expect(wl.length).toBe(1);
    expect(wl[0].qid).toBe('001');
    expect(wl[0].cnt).toBe(1);
    expect(wl[0].level).toBe(0);
  });

  it('addWrong 重复错题增加计数并重置等级', () => {
    setupState();
    App.db.addWrong('001');
    App.db.addWrong('001');
    const wl = App.db.getWrong();
    expect(wl.length).toBe(1);
    expect(wl[0].cnt).toBe(2);
    expect(wl[0].level).toBe(0);
  });

  it('addWrong 不同题目创建多条记录', () => {
    setupState();
    App.db.addWrong('001');
    App.db.addWrong('002');
    App.db.addWrong('003');
    const wl = App.db.getWrong();
    expect(wl.length).toBe(3);
  });

  it('reviewCorrect 提升等级', () => {
    setupState();
    App.db.addWrong('001');
    const result = App.db.reviewCorrect('001');
    expect(result.mastered).toBe(false);
    expect(result.level).toBe(1);
  });

  it('reviewCorrect 逐级提升直到掌握 (level 5)', () => {
    setupState();
    App.db.addWrong('001');
    let result;
    for (let i = 0; i < 5; i++) {
      result = App.db.reviewCorrect('001');
    }
    expect(result.mastered).toBe(true);
    // 掌握后应从错题本移除
    const wl = App.db.getWrong();
    expect(wl.length).toBe(0);
  });

  it('reviewCorrect 对不存在的题目返回未掌握', () => {
    setupState();
    const result = App.db.reviewCorrect('nonexist');
    expect(result.mastered).toBe(false);
    expect(result.qid).toBe('nonexist');
  });

  it('reviewWrong 重置等级和时间', () => {
    setupState();
    App.db.addWrong('001');
    App.db.reviewCorrect('001'); // level 1
    App.db.reviewCorrect('001'); // level 2
    App.db.reviewWrong('001'); // 应重置为 level 0
    const wl = App.db.getWrong();
    expect(wl[0].level).toBe(0);
    expect(wl[0].cnt).toBe(2);
  });

  it('reviewWrong 对不存在的题目自动新增', () => {
    setupState();
    App.db.reviewWrong('newQ');
    const wl = App.db.getWrong();
    expect(wl.length).toBe(1);
    expect(wl[0].qid).toBe('newQ');
    expect(wl[0].cnt).toBe(1);
  });

  it('getDueWrong 筛选到期错题', () => {
    setupState();
    App.db.addWrong('001'); // nextReview = Date.now() (立即可复习)
    App.db.addWrong('002'); // 同上
    const due = App.db.getDueWrong();
    expect(due.length).toBe(2);
  });

  it('getDueWrong 排除未到期错题', () => {
    setupState();
    App.db.addWrong('001');
    // 手动设置 nextReview 为未来
    const state = App.db.get();
    state.wrong[0].nextReview = Date.now() + 7 * 24 * 60 * 60 * 1000;
    App.db.setData(state);

    const due = App.db.getDueWrong();
    expect(due.length).toBe(0);
  });
});

describe('storage.js - 答题记录与归档 (addRecord)', () => {
  it('addRecord 更新统计数据', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    const d = App.db.get();
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(1);
  });

  it('addRecord 错误记录更新', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
    const d = App.db.get();
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(0);
  });

  it('addRecord 更新分类统计', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    const d = App.db.get();
    expect(d.stats.cats['专辑']).toBeDefined();
    expect(d.stats.cats['专辑'].t).toBe(1);
    expect(d.stats.cats['专辑'].c).toBe(1);
  });

  it('addRecord 触发归档 (超过1000条)', () => {
    const history = [];
    const now = Date.now();
    const ninetyDaysAgo = now - 91 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 1001; i++) {
      history.push({ qid: '001', ans: 'A', ok: true, time: ninetyDaysAgo - i * 1000 });
    }
    App.db.setData({
      history, wrong: [], stats: { total: 1001, correct: 1001, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
    const d = App.db.get();
    expect(d.archive.length).toBeGreaterThan(0);
    expect(d.history.length).toBeLessThanOrEqual(1000);
  });
});

describe('storage.js - 统计重算 (recalcStats)', () => {
  it('从 history 重新计算 stats', () => {
    const history = [
      { qid: '001', ans: 'A', ok: true, time: Date.now() },
      { qid: '002', ans: 'B', ok: false, time: Date.now() },
      { qid: '003', ans: 'C', ok: true, time: Date.now() },
    ];
    App.db.setData({
      history, wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.recalcStats();
    const d = App.db.get();
    expect(d.stats.total).toBe(3);
    expect(d.stats.correct).toBe(2);
  });

  it('recalcStats 空 history', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 100, correct: 80, cats: { '专辑': { t: 50, c: 40 } } },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.recalcStats();
    const d = App.db.get();
    expect(d.stats.total).toBe(0);
    expect(d.stats.correct).toBe(0);
    expect(Object.keys(d.stats.cats).length).toBe(0);
  });
});

describe('storage.js - 连续打卡 (getStreak)', () => {
  it('无历史记录返回 0', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    expect(App.db.getStreak()).toBe(0);
  });

  it('今天有答题记录', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    App.db.setData({
      history: [{ qid: '001', ans: 'A', ok: true, time: today.getTime() }],
      wrong: [], stats: { total: 1, correct: 1, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    expect(App.db.getStreak()).toBe(1);
  });

  it('昨天有记录今天没有', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    App.db.setData({
      history: [{ qid: '001', ans: 'A', ok: true, time: yesterday.getTime() }],
      wrong: [], stats: { total: 1, correct: 1, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    expect(App.db.getStreak()).toBe(1);
  });

  it('连续 3 天打卡', () => {
    const history = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 0; i < 3; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      history.push({ qid: '001', ans: 'A', ok: true, time: d.getTime() });
    }
    App.db.setData({
      history, wrong: [], stats: { total: 3, correct: 3, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    expect(App.db.getStreak()).toBe(3);
  });

  it('中间断开的打卡只计算最近连续', () => {
    const history = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    // 今天和昨天有记录，前天没有
    for (let i = 0; i < 2; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      history.push({ qid: '001', ans: 'A', ok: true, time: d.getTime() });
    }
    // 5 天前的记录
    const old = new Date(base);
    old.setDate(old.getDate() - 5);
    history.push({ qid: '001', ans: 'A', ok: true, time: old.getTime() });

    App.db.setData({
      history, wrong: [], stats: { total: 3, correct: 3, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    expect(App.db.getStreak()).toBe(2);
  });

  it('结合归档数据计算连续打卡', () => {
    const history = [];
    const archive = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    // 历史数据：今天
    history.push({ qid: '001', ans: 'A', ok: true, time: base.getTime() });
    // 归档数据：昨天和前天
    const y = new Date(base); y.setDate(y.getDate() - 1);
    const dby = new Date(base); dby.setDate(dby.getDate() - 2);
    archive.push({ date: `${y.getFullYear()}-${y.getMonth()}-${y.getDate()}`, total: 5, correct: 4 });
    archive.push({ date: `${dby.getFullYear()}-${dby.getMonth()}-${dby.getDate()}`, total: 3, correct: 3 });

    App.db.setData({
      history, wrong: [], stats: { total: 1, correct: 1, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive
    });
    expect(App.db.getStreak()).toBe(3);
  });
});

describe('storage.js - 每日目标 (setDailyGoal/getDailyGoal)', () => {
  it('默认每日目标为 20', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    expect(App.db.getDailyGoal()).toBe(20);
  });

  it('setDailyGoal 最小值为 5', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.setDailyGoal(3);
    expect(App.db.getDailyGoal()).toBe(5);
  });

  it('setDailyGoal 最大值为 100', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.setDailyGoal(200);
    expect(App.db.getDailyGoal()).toBe(100);
  });

  it('setDailyGoal 设置正常值', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.setDailyGoal(50);
    expect(App.db.getDailyGoal()).toBe(50);
  });
});

describe('storage.js - findQ', () => {
  it('查找存在的题目', () => {
    const q = App.db.findQ('001');
    expect(q).toBeDefined();
    expect(q.id).toBe('001');
    expect(q.question).toBeDefined();
  });

  it('查找不存在的题目返回 null', () => {
    const q = App.db.findQ('999');
    expect(q).toBe(null);
  });
});

describe('storage.js - removeWrong', () => {
  it('移除存在的错题', () => {
    App.db.setData({
      history: [], wrong: [{ qid: '001', cnt: 1, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() }],
      stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.removeWrong('001');
    expect(App.db.getWrong().length).toBe(0);
  });

  it('移除不存在的错题不报错', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    App.db.removeWrong('nonexist');
    expect(App.db.getWrong().length).toBe(0);
  });
});

describe('storage.js - 会话存储 (session)', () => {
  it('保存和加载会话', () => {
    const state = {
      quiz: [{ id: '001' }, { id: '002' }],
      idx: 1,
      correctCount: 0,
      startTime: Date.now(),
      mode: 'quick',
      isWrongBookQuiz: false
    };
    App.session.save(state);
    const loaded = App.session.load();
    expect(loaded).toBeDefined();
    expect(loaded.quizIds.length).toBe(2);
    expect(loaded.idx).toBe(1);
    expect(loaded.mode).toBe('quick');
  });

  it('加载空会话返回 null', () => {
    App.session.clear();
    const loaded = App.session.load();
    expect(loaded).toBe(null);
  });

  it('清除会话', () => {
    App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick', isWrongBookQuiz: false });
    App.session.clear();
    const loaded = App.session.load();
    expect(loaded).toBe(null);
  });
});

describe('storage.js - 数据导入 (setData/get)', () => {
  it('设置和获取数据', () => {
    const data = {
      history: [{ qid: '001', ans: 'A', ok: true, time: Date.now() }],
      wrong: [{ qid: '001', cnt: 1, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() }],
      stats: { total: 1, correct: 1, cats: { '专辑': { t: 1, c: 1 } } },
      theme: 'light',
      dailyGoal: 30,
      achievements: ['first_answer'],
      archive: []
    };
    App.db.setData(data);
    const d = App.db.get();
    expect(d.theme).toBe('light');
    expect(d.dailyGoal).toBe(30);
    expect(d.history.length).toBe(1);
    expect(d.wrong.length).toBe(1);
  });
});

describe('storage.js - 主题', () => {
  it('切换主题', () => {
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });
    const d1 = App.db.get();
    expect(d1.theme).toBe('dark');
    App.switchTheme();
    const d2 = App.db.get();
    expect(d2.theme).toBe('light');
  });
});
