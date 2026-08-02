/**
 * integration.test.js - 集成测试
 * 
 * 通过加载实际源文件，验证 App 命名空间的 API 暴露和模块协同。
 * 重点验证：
 * - 所有暴露的 API 函数签名正确
 * - 模块间数据传递正确
 * - 核心业务流程可正常运行
 */

// 在每个测试前重置 App 命名空间
beforeEach(() => {
  // 设置必要的全局对象
  global.App = {
    QUESTION_BANK: [],
    db: {},
    store: {},
    session: {}
  };

  // Mock IndexedDB（storage.js 中的 persist() 需要用到）
  global.indexedDB = {
    open: jest.fn(() => {
      return {
        result: {
          createObjectStore: jest.fn(),
          objectStoreNames: { contains: jest.fn(() => false) }
        },
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null
      };
    })
  };
});

// ==================== 加载源文件 ====================
function loadSourceFile(filePath) {
  var fs = require('fs');
  var path = require('path');
  var fullPath = path.resolve(__dirname, '..', filePath);
  var code = fs.readFileSync(fullPath, 'utf8');
  eval(code);
}

// 深拷贝（用于状态快照）
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ==================== 验证源文件加载和 API 暴露 ====================
describe('源文件加载与 API 暴露', () => {
  test('data.js 正确加载题库', () => {
    loadSourceFile('js/data.js');
    expect(App.QUESTION_BANK).toBeDefined();
    expect(App.QUESTION_BANK.length).toBeGreaterThan(0);
    expect(App.QUESTION_BANK[0]).toHaveProperty('id');
    expect(App.QUESTION_BANK[0]).toHaveProperty('question');
    expect(App.QUESTION_BANK[0]).toHaveProperty('answer');
    expect(App.QUESTION_BANK[0]).toHaveProperty('options');
  });

  test('data.js 暴露 DEFAULT_QUESTION_BANK', () => {
    loadSourceFile('js/data.js');
    expect(App.DEFAULT_QUESTION_BANK).toBeDefined();
    expect(App.DEFAULT_QUESTION_BANK.length).toBe(App.QUESTION_BANK.length);
  });

  test('storage.js 暴露 App.esc', () => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
    expect(App.esc).toBeDefined();
    expect(typeof App.esc).toBe('function');
  });

  test('storage.js 暴露 App.db 模块', () => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
    expect(App.db).toBeDefined();
    expect(typeof App.db.get).toBe('function');
    expect(typeof App.db.findQ).toBe('function');
    expect(typeof App.db.addRecord).toBe('function');
    expect(typeof App.db.addWrong).toBe('function');
    expect(typeof App.db.reviewCorrect).toBe('function');
    expect(typeof App.db.reviewWrong).toBe('function');
    expect(typeof App.db.removeWrong).toBe('function');
    expect(typeof App.db.getWrong).toBe('function');
    expect(typeof App.db.getDueWrong).toBe('function');
    expect(typeof App.db.recalcStats).toBe('function');
    expect(typeof App.db.getStreak).toBe('function');
    expect(typeof App.db.checkAchievements).toBe('function');
    expect(typeof App.db.getAchievementDefs).toBe('function');
    expect(typeof App.db.getAchievements).toBe('function');
    expect(typeof App.db.getDailyGoal).toBe('function');
    expect(typeof App.db.setDailyGoal).toBe('function');
    expect(typeof App.db.setData).toBe('function');
  });

  test('storage.js 暴露 App.store 模块', () => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
    expect(App.store).toBeDefined();
    expect(typeof App.store.init).toBe('function');
    expect(typeof App.store.save).toBe('function');
    expect(typeof App.store.reset).toBe('function');
  });

  test('storage.js 暴露 App.session 模块', () => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
    expect(App.session).toBeDefined();
    expect(typeof App.session.save).toBe('function');
    expect(typeof App.session.load).toBe('function');
    expect(typeof App.session.clear).toBe('function');
  });

  test('quiz.js 暴露答题核心函数', () => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
    loadSourceFile('js/quiz.js');
    expect(typeof App.shuffle).toBe('function');
    expect(typeof App.startTimer).toBe('function');
    expect(typeof App.stopTimer).toBe('function');
    expect(typeof App.pickOption).toBe('function');
    expect(typeof App.nextQ).toBe('function');
    expect(typeof App.quitQuiz).toBe('function');
    expect(typeof App.finishQuiz).toBe('function');
    expect(typeof App.tryResumeSession).toBe('function');
    expect(typeof App.handleQuizKeydown).toBe('function');
    expect(typeof App.toggleSound).toBe('function');
    expect(typeof App.state).toBe('object');
  });

  test('app.js 暴露视图管理函数', () => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
    loadSourceFile('js/quiz.js');
    loadSourceFile('js/app.js');
    expect(typeof App.switchView).toBe('function');
    expect(typeof App.updateHome).toBe('function');
    expect(typeof App.renderWrongBook).toBe('function');
    expect(typeof App.removeWrong).toBe('function');
    expect(typeof App.renderStats).toBe('function');
    expect(typeof App.renderAchievements).toBe('function');
    expect(typeof App.editDailyGoal).toBe('function');
    expect(typeof App.init).toBe('function');
    expect(typeof App.switchTheme).toBe('function');
  });

  test('chart.js 暴露 renderTrendChart', () => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
    loadSourceFile('js/chart.js');
    expect(typeof App.renderTrendChart).toBe('function');
  });

  test('admin.js 暴露管理函数', () => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
    loadSourceFile('js/admin.js');
    expect(typeof App.renderAdmin).toBe('function');
    expect(typeof App.exportData).toBe('function');
    expect(typeof App.importData).toBe('function');
  });
});

// ==================== API 函数基本行为验证 ====================
describe('API 基本行为', () => {
  beforeEach(() => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
  });

  test('App.esc 正确转义 HTML', () => {
    var escaped = App.esc('<script>alert("xss")</script>');
    expect(escaped).not.toContain('<script>');
  });

  test('App.db.findQ 能找到题目', () => {
    var q = App.db.findQ('001');
    expect(q).not.toBeNull();
    expect(q.id).toBe('001');
  });

  test('App.db.findQ 找不到返回 null', () => {
    expect(App.db.findQ('nonexistent')).toBeNull();
  });

  test('App.db.get 返回默认数据结构', () => {
    var d = App.db.get();
    expect(d).toBeDefined();
    expect(d.history).toBeDefined();
    expect(d.wrong).toBeDefined();
    expect(d.stats).toBeDefined();
    expect(d.stats.total).toBe(0);
    expect(d.stats.correct).toBe(0);
    expect(d.stats.cats).toBeDefined();
  });

  test('App.db.getDailyGoal 返回默认值 20', () => {
    expect(App.db.getDailyGoal()).toBe(20);
  });

  test('App.db.getWrong 返回空数组', () => {
    expect(App.db.getWrong()).toEqual([]);
  });

  test('App.db.getDueWrong 返回空数组', () => {
    expect(App.db.getDueWrong()).toEqual([]);
  });

  test('App.db.getStreak 无数据返回 0', () => {
    expect(App.db.getStreak()).toBe(0);
  });

  test('App.db.getAchievementDefs 返回 10 个成就', () => {
    var defs = App.db.getAchievementDefs();
    expect(defs).toHaveLength(10);
  });

  test('App.db.checkAchievements 首次答题解锁成就', () => {
    var d = App.db.get();
    // 直接修改数据模拟有答题记录
    d.stats.total = 1;
    d.stats.correct = 1;
    d.history.push({ qid: '001', ok: true, time: Date.now() });
    App.db.setData(d);

    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('first_answer');
  });

  test('App.db.reviewCorrect 答对错题返回结果', () => {
    // 先添加错题
    App.db.addWrong('001');
    var result = App.db.reviewCorrect('001');
    expect(result).toHaveProperty('mastered');
    expect(result).toHaveProperty('qid', '001');
  });

  test('App.db.reviewWrong 答对错题重置等级', () => {
    App.db.addWrong('001');
    App.db.reviewCorrect('001'); // level 1
    App.db.reviewWrong('001'); // 重置
    var wrong = App.db.getWrong();
    expect(wrong[0].level).toBe(0);
  });
});

// ==================== 数据持久化流程 ====================
describe('数据操作流程', () => {
  beforeEach(() => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
  });

  test('添加答题记录更新统计', () => {
    var before = deepClone(App.db.get());
    App.db.addRecord({ qid: '001', ok: true, time: Date.now() });
    var after = App.db.get();
    expect(after.stats.total).toBe(before.stats.total + 1);
    expect(after.stats.correct).toBe(before.stats.correct + 1);
    expect(after.history.length).toBe(before.history.length + 1);
  });

  test('添加错题并获取', () => {
    App.db.addWrong('001');
    var w = App.db.getWrong();
    expect(w).toHaveLength(1);
    expect(w[0].qid).toBe('001');
    expect(w[0].cnt).toBe(1);
    expect(w[0].level).toBe(0);
  });

  test('重复添加同一错题增加计数', () => {
    App.db.addWrong('001');
    App.db.addWrong('001');
    var w = App.db.getWrong();
    expect(w).toHaveLength(1);
    expect(w[0].cnt).toBe(2);
    expect(w[0].level).toBe(0); // 重置
  });

  test('移除错题', () => {
    App.db.addWrong('001');
    App.db.removeWrong('001');
    expect(App.db.getWrong()).toHaveLength(0);
  });

  test('setData 替换数据', () => {
    var newData = {
      history: [{ qid: '001', ok: true, time: Date.now() }],
      wrong: [],
      stats: { total: 1, correct: 1, cats: { '专辑': { t: 1, c: 1 } } },
      dailyGoal: 50,
      theme: 'dark',
      achievements: ['first_answer'],
      archive: []
    };
    App.db.setData(newData);
    var d = App.db.get();
    expect(d.dailyGoal).toBe(50);
    expect(d.stats.total).toBe(1);
  });

  test('setDailyGoal 限制范围', () => {
    App.db.setDailyGoal(3);
    expect(App.db.getDailyGoal()).toBe(5); // 低于5，设置为5
    App.db.setDailyGoal(200);
    expect(App.db.getDailyGoal()).toBe(100); // 超过100，设置为100
    App.db.setDailyGoal(50);
    expect(App.db.getDailyGoal()).toBe(50);
  });

  test('recalcStats 正确重算', () => {
    // 直接设置历史数据
    App.db.setData({
      history: [
        { qid: '001', ok: true, time: Date.now() },
        { qid: '002', ok: false, time: Date.now() },
        { qid: '001', ok: true, time: Date.now() }
      ],
      wrong: [],
      stats: { total: 10, correct: 5, cats: {} }, // 错误的统计
      dailyGoal: 20,
      theme: 'dark',
      achievements: [],
      archive: []
    });
    App.db.recalcStats();
    var d = App.db.get();
    expect(d.stats.total).toBe(3);
    expect(d.stats.correct).toBe(2);
    expect(d.stats.cats['专辑'].t).toBe(2); // 001 是专辑
    expect(d.stats.cats['专辑'].c).toBe(2);
    expect(d.stats.cats['歌曲'].t).toBe(1); // 002 是歌曲
    expect(d.stats.cats['歌曲'].c).toBe(0);
  });
});

// ==================== quiz.js 实际 API 行为 ====================
describe('quiz.js 实际 API', () => {
  beforeEach(() => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
    loadSourceFile('js/quiz.js');
  });

  test('App.shuffle 打乱数组', () => {
    var arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    var shuffled = App.shuffle(arr);
    expect(shuffled).toHaveLength(arr.length);
    expect(shuffled.sort(function(a, b) { return a - b; })).toEqual(arr);
  });

  test('App.state 初始状态正确', () => {
    expect(App.state.quiz).toEqual([]);
    expect(App.state.idx).toBe(0);
    expect(App.state.answered).toBe(false);
    expect(App.state.mode).toBe('quick');
    expect(App.state.correctCount).toBe(0);
  });

  test('App.toggleSound 切换音效状态', () => {
    var s1 = App.toggleSound();
    var s2 = App.toggleSound();
    expect(s1).not.toBe(s2);
  });
});

// ==================== 会话管理 ====================
describe('会话管理', () => {
  beforeEach(() => {
    loadSourceFile('js/data.js');
    loadSourceFile('js/storage.js');
  });

  test('session.save 和 session.load 正确往返', () => {
    var state = {
      quiz: [{ id: '001' }, { id: '002' }],
      idx: 1,
      correctCount: 1,
      mode: 'standard',
      startTime: Date.now(),
      isWrongBookQuiz: false
    };
    App.session.save(state);
    var loaded = App.session.load();
    expect(loaded).not.toBeNull();
    expect(loaded.quizIds).toEqual(['001', '002']);
    expect(loaded.idx).toBe(1);
    expect(loaded.correctCount).toBe(1);
    expect(loaded.mode).toBe('standard');
  });

  test('session.load 返回 null 当无保存数据', () => {
    App.session.clear();
    var loaded = App.session.load();
    expect(loaded).toBeNull();
  });

  test('session.clear 清除保存数据', () => {
    App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, mode: 'quick', startTime: Date.now(), isWrongBookQuiz: false });
    App.session.clear();
    expect(App.session.load()).toBeNull();
  });
});
