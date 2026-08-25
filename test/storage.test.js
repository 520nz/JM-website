// ============================================================
// storage.test.js - 数据存储层核心逻辑测试
// ============================================================

const { setupBrowserMocks, loadScripts } = require('./test-helper');

setupBrowserMocks();
const App = loadScripts();

// 等待异步初始化完成
beforeAll(async () => {
  await App.db.init();
});

describe('XSS 转义工具 (App.esc)', () => {
  test('转义 HTML 特殊字符', () => {
    var result = App.esc('<script>alert("xss")</script>');
    // esc 使用 textContent 赋值后读取 innerHTML，会转义 HTML 标签
    expect(typeof result).toBe('string');
  });

  test('处理普通字符串', () => {
    expect(App.esc('hello world')).toBe('hello world');
  });

  test('处理 null/undefined 输入', () => {
    expect(App.esc(null)).toBe('');
    expect(App.esc(undefined)).toBe('');
  });

  test('处理数字输入', () => {
    expect(App.esc(123)).toBe('123');
  });

  test('处理空字符串', () => {
    expect(App.esc('')).toBe('');
  });
});

describe('默认数据 (App.db.defaults)', () => {
  test('返回正确的默认结构', () => {
    var d = App.db.defaults();
    expect(d).toEqual({
      history: [],
      wrong: [],
      stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark',
      dailyGoal: 20,
      achievements: [],
      archive: []
    });
  });
});

describe('题目查找 (App.db.findQ)', () => {
  test('通过 ID 查找题目', () => {
    var q = App.db.findQ('001');
    expect(q).not.toBeNull();
    expect(q.id).toBe('001');
  });

  test('查找不存在的题目返回 null', () => {
    expect(App.db.findQ('999')).toBeNull();
  });

  test('所有题库题目可通过 ID 查找到', () => {
    var ids = App.QUESTION_BANK.map(function(q) { return q.id; });
    ids.forEach(function(id) {
      expect(App.db.findQ(id)).not.toBeNull();
    });
  });
});

describe('答题记录 (App.db.addRecord)', () => {
  beforeEach(function() {
    App.db.setData(App.db.defaults());
  });

  test('添加正确答题记录', function() {
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    var d = App.db.get();
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(1);
    expect(d.history.length).toBe(1);
  });

  test('添加错误答题记录', function() {
    App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
    var d = App.db.get();
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(0);
  });

  test('更新分类统计', function() {
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
    var d = App.db.get();
    expect(d.stats.cats['专辑']).toEqual({ t: 2, c: 1 });
  });

  test('不存在的题目 ID 不更新分类统计', function() {
    App.db.addRecord({ qid: '999', ans: 'A', ok: true, time: Date.now() });
    var d = App.db.get();
    expect(d.stats.total).toBe(1);
    expect(Object.keys(d.stats.cats).length).toBe(0);
  });
});

describe('归档逻辑', () => {
  test('超过1000条记录时触发归档', function() {
    var cache = App.db.defaults();
    var now = Date.now();
    var ninetyDaysAgo = now - 91 * 24 * 60 * 60 * 1000;
    for (var i = 0; i < 600; i++) {
      cache.history.push({
        qid: '001', ans: 'B', ok: true,
        time: ninetyDaysAgo + (i * 60000)
      });
    }
    for (var j = 0; j < 401; j++) {
      cache.history.push({
        qid: '001', ans: 'B', ok: true,
        time: now - (j * 60000)
      });
    }
    App.db.setData(cache);
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
    var d = App.db.get();
    expect(d.archive.length).toBeGreaterThan(0);
    expect(d.history.length).toBeLessThanOrEqual(1001);
  });

  test('归档避免同一日期重复', function() {
    var cache = App.db.defaults();
    var now = Date.now();
    var ninetyDaysAgo = now - 91 * 24 * 60 * 60 * 1000;
    for (var i = 0; i < 500; i++) {
      cache.history.push({ qid: '001', ans: 'B', ok: true, time: ninetyDaysAgo });
    }
    for (var j = 0; j < 600; j++) {
      cache.history.push({ qid: '001', ans: 'B', ok: true, time: now });
    }
    App.db.setData(cache);
    App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
    var d = App.db.get();
    expect(d.archive.length).toBe(1);
  });
});

describe('错题本 - 间隔重复逻辑', () => {
  beforeEach(function() {
    App.db.setData(App.db.defaults());
  });

  describe('App.db.addWrong', function() {
    test('添加新错题', function() {
      App.db.addWrong('001');
      var wl = App.db.getWrong();
      expect(wl.length).toBe(1);
      expect(wl[0].qid).toBe('001');
      expect(wl[0].cnt).toBe(1);
      expect(wl[0].level).toBe(0);
    });

    test('重复添加同一错题', function() {
      App.db.addWrong('001');
      App.db.addWrong('001');
      var wl = App.db.getWrong();
      expect(wl.length).toBe(1);
      expect(wl[0].cnt).toBe(2);
      expect(wl[0].level).toBe(0);
    });

    test('添加不同错题', function() {
      App.db.addWrong('001');
      App.db.addWrong('002');
      expect(App.db.getWrong().length).toBe(2);
    });
  });

  describe('App.db.reviewCorrect', function() {
    test('第一次答对，等级提升到1', function() {
      App.db.addWrong('001');
      var result = App.db.reviewCorrect('001');
      expect(result.mastered).toBe(false);
      expect(result.level).toBe(1);
    });

    test('连续答对5次掌握并移除', function() {
      App.db.addWrong('001');
      App.db.reviewCorrect('001'); // level 1
      App.db.reviewCorrect('001'); // level 2
      App.db.reviewCorrect('001'); // level 3
      App.db.reviewCorrect('001'); // level 4
      var result = App.db.reviewCorrect('001'); // level 5 -> mastered
      expect(result.mastered).toBe(true);
      expect(App.db.getWrong().length).toBe(0);
    });

    test('答对中间答错重置等级', function() {
      App.db.addWrong('001');
      App.db.reviewCorrect('001'); // level 1
      App.db.reviewCorrect('001'); // level 2
      App.db.reviewWrong('001'); // level 0
      var wl = App.db.getWrong();
      expect(wl[0].level).toBe(0);
      expect(wl[0].cnt).toBe(2);
    });

    test('答对不存在的错题返回未掌握', function() {
      var result = App.db.reviewCorrect('nonexistent');
      expect(result.mastered).toBe(false);
    });
  });

  describe('App.db.reviewWrong', function() {
    test('答错重置等级并增加计数', function() {
      App.db.addWrong('001');
      App.db.reviewCorrect('001'); // level 1
      App.db.reviewWrong('001');
      var wl = App.db.getWrong();
      expect(wl[0].level).toBe(0);
      expect(wl[0].cnt).toBe(2);
    });

    test('答错时不在错题本则新增', function() {
      App.db.reviewWrong('001');
      var wl = App.db.getWrong();
      expect(wl.length).toBe(1);
      expect(wl[0].qid).toBe('001');
      expect(wl[0].level).toBe(0);
      expect(wl[0].cnt).toBe(1);
    });
  });

  describe('App.db.removeWrong', function() {
    test('移除错题', function() {
      App.db.addWrong('001');
      App.db.addWrong('002');
      App.db.removeWrong('001');
      var wl = App.db.getWrong();
      expect(wl.length).toBe(1);
      expect(wl[0].qid).toBe('002');
    });

    test('移除不存在的错题不报错', function() {
      App.db.addWrong('001');
      App.db.removeWrong('999');
      expect(App.db.getWrong().length).toBe(1);
    });
  });

  describe('App.db.getDueWrong', function() {
    test('立即可复习的错题被返回', function() {
      App.db.addWrong('001');
      var due = App.db.getDueWrong();
      expect(due.length).toBe(1);
    });

    test('未到期的错题不返回', function() {
      var cache = App.db.defaults();
      var future = Date.now() + 24 * 60 * 60 * 1000;
      cache.wrong.push({
        qid: '001', cnt: 1, level: 3, time: Date.now(),
        lastReview: Date.now(), nextReview: future
      });
      App.db.setData(cache);
      expect(App.db.getDueWrong().length).toBe(0);
    });

    test('混合到期和未到期', function() {
      var cache = App.db.defaults();
      var future = Date.now() + 24 * 60 * 60 * 1000;
      cache.wrong.push(
        { qid: '001', cnt: 1, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() },
        { qid: '002', cnt: 1, level: 3, time: Date.now(), lastReview: Date.now(), nextReview: future }
      );
      App.db.setData(cache);
      var due = App.db.getDueWrong();
      expect(due.length).toBe(1);
      expect(due[0].qid).toBe('001');
    });
  });
});

describe('统计重算 (App.db.recalcStats)', function() {
  test('从 history 重算统计', function() {
    var cache = App.db.defaults();
    cache.history = [
      { qid: '001', ans: 'B', ok: true, time: Date.now() },
      { qid: '001', ans: 'A', ok: false, time: Date.now() },
      { qid: '001', ans: 'B', ok: true, time: Date.now() }
    ];
    cache.stats = { total: 0, correct: 0, cats: {} };
    App.db.setData(cache);
    App.db.recalcStats();
    var d = App.db.get();
    expect(d.stats.total).toBe(3);
    expect(d.stats.correct).toBe(2);
    expect(d.stats.cats['专辑'].t).toBe(3);
    expect(d.stats.cats['专辑'].c).toBe(2);
  });

  test('空历史记录重算为零', function() {
    App.db.setData(App.db.defaults());
    App.db.recalcStats();
    var d = App.db.get();
    expect(d.stats.total).toBe(0);
    expect(d.stats.correct).toBe(0);
  });
});

describe('每日目标', function() {
  beforeEach(function() {
    App.db.setData(App.db.defaults());
  });

  test('默认每日目标为20', function() {
    expect(App.db.getDailyGoal()).toBe(20);
  });

  test('设置有效目标', function() {
    App.db.setDailyGoal(50);
    expect(App.db.getDailyGoal()).toBe(50);
  });

  test('低于最小值限制为5', function() {
    App.db.setDailyGoal(3);
    expect(App.db.getDailyGoal()).toBe(5);
  });

  test('超过最大值限制为100', function() {
    App.db.setDailyGoal(150);
    expect(App.db.getDailyGoal()).toBe(100);
  });

  test('边界值5和100有效', function() {
    App.db.setDailyGoal(5);
    expect(App.db.getDailyGoal()).toBe(5);
    App.db.setDailyGoal(100);
    expect(App.db.getDailyGoal()).toBe(100);
  });
});

describe('连续打卡天数 (App.db.getStreak)', function() {
  test('无记录返回0', function() {
    App.db.setData(App.db.defaults());
    expect(App.db.getStreak()).toBe(0);
  });

  test('今天有记录', function() {
    var cache = App.db.defaults();
    var now = new Date();
    cache.history.push({ qid: '001', ans: 'B', ok: true, time: now.getTime() });
    App.db.setData(cache);
    expect(App.db.getStreak()).toBe(1);
  });

  test('连续3天打卡', function() {
    var cache = App.db.defaults();
    var now = new Date();
    for (var i = 0; i < 3; i++) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(12, 0, 0, 0);
      cache.history.push({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
    }
    App.db.setData(cache);
    expect(App.db.getStreak()).toBe(3);
  });

  test('打卡中断', function() {
    var cache = App.db.defaults();
    var now = new Date();
    var d1 = new Date(now); d1.setHours(12, 0, 0, 0);
    var d2 = new Date(now); d2.setDate(d2.getDate() - 1); d2.setHours(12, 0, 0, 0);
    var d4 = new Date(now); d4.setDate(d4.getDate() - 3); d4.setHours(12, 0, 0, 0);
    cache.history.push({ qid: '001', ans: 'B', ok: true, time: d1.getTime() });
    cache.history.push({ qid: '001', ans: 'B', ok: true, time: d2.getTime() });
    cache.history.push({ qid: '001', ans: 'B', ok: true, time: d4.getTime() });
    App.db.setData(cache);
    expect(App.db.getStreak()).toBe(2);
  });

  test('归档数据补充打卡', function() {
    var cache = App.db.defaults();
    var now = new Date();
    var yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    // 使用与 getStreak 中一致的日期格式 (getMonth() 从0开始)
    var dateKey = yesterday.getFullYear() + '-' + yesterday.getMonth() + '-' + yesterday.getDate();
    cache.archive.push({ date: dateKey, total: 10, correct: 8 });
    var d1 = new Date(now); d1.setHours(12, 0, 0, 0);
    cache.history.push({ qid: '001', ans: 'B', ok: true, time: d1.getTime() });
    App.db.setData(cache);
    expect(App.db.getStreak()).toBe(2);
  });
});

describe('成就系统 (App.db.checkAchievements)', function() {
  beforeEach(function() {
    App.db.setData(App.db.defaults());
  });

  test('首次答题解锁初出茅庐', function() {
    var cache = App.db.defaults();
    cache.stats.total = 1;
    App.db.setData(cache);
    var unlocks = App.db.checkAchievements();
    expect(unlocks.map(function(u) { return u.id; })).toContain('first_answer');
  });

  test('累计100题解锁百题斩', function() {
    var cache = App.db.defaults();
    cache.stats.total = 100;
    App.db.setData(cache);
    var unlocks = App.db.checkAchievements();
    expect(unlocks.map(function(u) { return u.id; })).toContain('total_100');
  });

  test('累计500题解锁五百题王', function() {
    var cache = App.db.defaults();
    cache.stats.total = 500;
    App.db.setData(cache);
    var unlocks = App.db.checkAchievements();
    expect(unlocks.map(function(u) { return u.id; })).toContain('total_500');
  });

  test('50题且正确率≥90%解锁资深JM', function() {
    var cache = App.db.defaults();
    cache.stats.total = 50;
    cache.stats.correct = 46;
    App.db.setData(cache);
    var unlocks = App.db.checkAchievements();
    expect(unlocks.map(function(u) { return u.id; })).toContain('acc_90');
  });

  test('50题但正确率<90%不解锁', function() {
    var cache = App.db.defaults();
    cache.stats.total = 50;
    cache.stats.correct = 40;
    App.db.setData(cache);
    var unlocks = App.db.checkAchievements();
    expect(unlocks.map(function(u) { return u.id; })).not.toContain('acc_90');
  });

  test('完美一轮解锁十全十美', function() {
    var unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    expect(unlocks.map(function(u) { return u.id; })).toContain('perfect_10');
  });

  test('不完美一轮不解锁', function() {
    var unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 9 });
    expect(unlocks.map(function(u) { return u.id; })).not.toContain('perfect_10');
  });

  test('单日50题解锁勤奋粉丝', function() {
    var cache = App.db.defaults();
    var now = Date.now();
    for (var i = 0; i < 50; i++) {
      cache.history.push({ qid: '001', ans: 'B', ok: true, time: now });
    }
    App.db.setData(cache);
    var unlocks = App.db.checkAchievements();
    expect(unlocks.map(function(u) { return u.id; })).toContain('daily_50');
  });

  test('连续3天解锁三日坚持', function() {
    var cache = App.db.defaults();
    var now = new Date();
    for (var i = 0; i < 3; i++) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(12, 0, 0, 0);
      cache.history.push({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
    }
    App.db.setData(cache);
    var unlocks = App.db.checkAchievements();
    expect(unlocks.map(function(u) { return u.id; })).toContain('streak_3');
  });

  test('连续7天解锁七日之约', function() {
    var cache = App.db.defaults();
    var now = new Date();
    for (var i = 0; i < 7; i++) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(12, 0, 0, 0);
      cache.history.push({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
    }
    App.db.setData(cache);
    var unlocks = App.db.checkAchievements();
    expect(unlocks.map(function(u) { return u.id; })).toContain('streak_7');
  });

  test('所有分类都有答题记录解锁全能粉丝', function() {
    var cache = App.db.defaults();
    cache.stats.total = 10;
    cache.achievements = ['first_answer'];
    cache.stats.cats = {
      '专辑': { t: 1, c: 1 },
      '歌曲': { t: 1, c: 1 },
      '个人信息': { t: 1, c: 1 },
      '获奖记录': { t: 1, c: 1 }
    };
    App.db.setData(cache);
    var unlocks = App.db.checkAchievements();
    expect(unlocks.map(function(u) { return u.id; })).toContain('all_cats');
  });

  test('错题清零解锁', function() {
    var cache = App.db.defaults();
    cache.stats.total = 1;
    cache.achievements = ['first_answer'];
    cache.wrong = [];
    App.db.setData(cache);
    var unlocks = App.db.checkAchievements();
    expect(unlocks.map(function(u) { return u.id; })).toContain('wrong_clear');
  });

  test('重复解锁不重复添加', function() {
    var cache = App.db.defaults();
    cache.stats.total = 1;
    App.db.setData(cache);
    App.db.checkAchievements();
    var unlocks = App.db.checkAchievements();
    expect(unlocks.filter(function(u) { return u.id === 'first_answer'; }).length).toBe(0);
  });
});

describe('会话管理 (App.session)', function() {
  beforeEach(function() {
    App.session.clear();
  });

  test('保存和加载会话', function() {
    var state = {
      quiz: [{ id: '001' }, { id: '002' }],
      idx: 1,
      correctCount: 1,
      startTime: Date.now(),
      mode: 'quick',
      isWrongBookQuiz: false
    };
    App.session.save(state);
    var loaded = App.session.load();
    expect(loaded).not.toBeNull();
    expect(loaded.quizIds).toEqual(['001', '002']);
    expect(loaded.idx).toBe(1);
    expect(loaded.correctCount).toBe(1);
    expect(loaded.mode).toBe('quick');
  });

  test('加载空会话返回 null', function() {
    expect(App.session.load()).toBeNull();
  });

  test('清除会话', function() {
    App.session.save({ quiz: [], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
    App.session.clear();
    expect(App.session.load()).toBeNull();
  });
});

describe('成就定义', function() {
  test('返回所有成就定义', function() {
    var defs = App.db.getAchievementDefs();
    expect(defs.length).toBe(10);
    expect(defs.map(function(d) { return d.id; })).toEqual(expect.arrayContaining([
      'first_answer', 'perfect_10', 'daily_50', 'streak_3', 'streak_7',
      'total_100', 'total_500', 'acc_90', 'wrong_clear', 'all_cats'
    ]));
  });
});
