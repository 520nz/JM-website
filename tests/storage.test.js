/**
 * storage.js 核心逻辑测试
 * 覆盖：XSS转义、答题记录（含归档）、间隔重复、连续打卡、成就系统、每日目标
 */

// --- 浏览器 API 模拟 ---
var mockStorage = {};
global.sessionStorage = {
  getItem: function(k) { return mockStorage[k] || null; },
  setItem: function(k, v) { mockStorage[k] = v; },
  removeItem: function(k) { delete mockStorage[k]; }
};

global.document = {
  createElement: function(tag) {
    // 模拟浏览器 DOM 行为：textContent 赋值后 innerHTML 自动转义
    var el = {};
    Object.defineProperty(el, 'textContent', {
      set: function(v) {
        this._text = String(v);
        // 模拟浏览器 textContent -> innerHTML 转义行为
        this.innerHTML = this._text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      get: function() { return this._text; }
    });
    el._text = '';
    el.innerHTML = '';
    return el;
  }
};

global.window = global;
global.indexedDB = null; // 不需要真实 IndexedDB，测试走内存缓存

// 加载源码
global.App = {};
require('../js/data.js');
require('../js/storage.js');

// --- 辅助：重置内存缓存 ---
function resetCache(data) {
  App.db.setData(data || App.db.defaults());
}

// --- 测试开始 ---
describe('App.esc - XSS转义', function() {
  test('转义HTML特殊字符', function() {
    expect(App.esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('转义双引号和&符号', function() {
    expect(App.esc('"hello&world"')).toBe('&quot;hello&amp;world&quot;');
  });

  test('null/undefined 返回空字符串', function() {
    expect(App.esc(null)).toBe('');
    expect(App.esc(undefined)).toBe('');
  });

  test('数字转为字符串', function() {
    expect(App.esc(123)).toBe('123');
  });

  test('普通文本不变', function() {
    expect(App.esc('林俊杰')).toBe('林俊杰');
  });

  test('单引号文本正常处理', function() {
    // textContent 赋值后再读 innerHTML，单引号不会被转义
    var result = App.esc("it's ok");
    expect(result).toBe("it's ok");
  });
});

describe('App.db.defaults - 默认数据结构', function() {
  test('包含所有必要字段', function() {
    var d = App.db.defaults();
    expect(d.history).toEqual([]);
    expect(d.wrong).toEqual([]);
    expect(d.stats).toEqual({ total: 0, correct: 0, cats: {} });
    expect(d.theme).toBe('dark');
    expect(d.dailyGoal).toBe(20);
    expect(d.achievements).toEqual([]);
    expect(d.archive).toEqual([]);
  });
});

describe('App.db.addRecord - 答题记录', function() {
  beforeEach(function() {
    resetCache();
    App.QUESTION_BANK = [
      { id: '001', category: '专辑', question: '测试题', options: [], answer: 'A', explanation: '' }
    ];
  });

  test('正确记录答题并更新统计', function() {
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    var d = App.db.get();
    expect(d.history.length).toBe(1);
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(1);
    expect(d.stats.cats['专辑'].t).toBe(1);
    expect(d.stats.cats['专辑'].c).toBe(1);
  });

  test('错误答案正确统计', function() {
    App.db.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() });
    var d = App.db.get();
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(0);
    expect(d.stats.cats['专辑'].c).toBe(0);
  });

  test('题目不在题库中时不崩溃（cats 不新增）', function() {
    App.db.addRecord({ qid: 'nonexistent', ans: 'A', ok: true, time: Date.now() });
    var d = App.db.get();
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(1);
    expect(Object.keys(d.stats.cats).length).toBe(0);
  });

  test('历史超过1000条时触发归档', function() {
    var d = App.db.get();
    // 构造 1001 条历史记录，全部在 90 天前
    var oldTime = Date.now() - 91 * 24 * 60 * 60 * 1000;
    for (var i = 0; i < 1001; i++) {
      d.history.push({ qid: '001', ans: 'A', ok: true, time: oldTime + i });
    }
    d.stats.total = 1001;
    d.stats.correct = 1001;
    d.stats.cats = { '专辑': { t: 1001, c: 1001 } };

    // 再添加一条触发归档
    App.QUESTION_BANK = [
      { id: '001', category: '专辑', question: '测试', options: [], answer: 'A', explanation: '' }
    ];
    App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });

    var after = App.db.get();
    // 归档后 history 应缩减（仅保留近 90 天记录 + 新增 1 条）
    expect(after.history.length).toBe(1);
    // archive 中应有归档数据
    expect(after.archive.length).toBeGreaterThan(0);
  });
});

describe('间隔重复逻辑 - addWrong / reviewCorrect / reviewWrong', function() {
  beforeEach(function() {
    resetCache();
  });

  test('首次添加错题：cnt=1, level=0, nextReview=now', function() {
    App.db.addWrong('001');
    var wl = App.db.getWrong();
    expect(wl.length).toBe(1);
    expect(wl[0].qid).toBe('001');
    expect(wl[0].cnt).toBe(1);
    expect(wl[0].level).toBe(0);
    expect(wl[0].nextReview).toBeLessThanOrEqual(Date.now());
  });

  test('重复添加同一错题：cnt递增，level重置为0', function() {
    App.db.addWrong('001');
    App.db.addWrong('001');
    var wl = App.db.getWrong();
    expect(wl.length).toBe(1);
    expect(wl[0].cnt).toBe(2);
    expect(wl[0].level).toBe(0);
  });

  test('reviewCorrect: 逐步升级等级', function() {
    App.db.addWrong('001');
    var r1 = App.db.reviewCorrect('001');
    expect(r1.mastered).toBe(false);
    expect(r1.level).toBe(1);

    var r2 = App.db.reviewCorrect('001');
    expect(r2.mastered).toBe(false);
    expect(r2.level).toBe(2);
  });

  test('reviewCorrect: 达到 level 5 时掌握并移除', function() {
    App.db.addWrong('001');
    // level 0 -> 1 -> 2 -> 3 -> 4 -> 5(mastered)
    for (var i = 0; i < 4; i++) App.db.reviewCorrect('001');
    var r = App.db.reviewCorrect('001');
    expect(r.mastered).toBe(true);
    expect(App.db.getWrong().length).toBe(0);
  });

  test('reviewCorrect: 不存在的题目返回 mastered=false', function() {
    var r = App.db.reviewCorrect('nonexistent');
    expect(r.mastered).toBe(false);
  });

  test('reviewWrong: 重置等级和递增cnt', function() {
    App.db.addWrong('001');
    App.db.reviewCorrect('001'); // level -> 1
    App.db.reviewWrong('001');
    var wl = App.db.getWrong();
    expect(wl[0].level).toBe(0);
    expect(wl[0].cnt).toBe(2);
  });

  test('reviewWrong: 不在错题本中时自动新增', function() {
    App.db.reviewWrong('002');
    var wl = App.db.getWrong();
    expect(wl.length).toBe(1);
    expect(wl[0].qid).toBe('002');
  });

  test('removeWrong: 移除指定错题', function() {
    App.db.addWrong('001');
    App.db.addWrong('002');
    App.db.removeWrong('001');
    var wl = App.db.getWrong();
    expect(wl.length).toBe(1);
    expect(wl[0].qid).toBe('002');
  });
});

describe('getDueWrong - 到期错题筛选', function() {
  beforeEach(function() {
    resetCache();
  });

  test('nextReview <= now 的错题到期', function() {
    var d = App.db.get();
    d.wrong = [
      { qid: '001', cnt: 1, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() - 1000 },
      { qid: '002', cnt: 1, level: 1, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() + 3600000 }
    ];
    var due = App.db.getDueWrong();
    expect(due.length).toBe(1);
    expect(due[0].qid).toBe('001');
  });

  test('nextReview 为 undefined 时视为到期', function() {
    var d = App.db.get();
    d.wrong = [{ qid: '001', cnt: 1, level: 0, time: Date.now(), lastReview: 0 }];
    var due = App.db.getDueWrong();
    expect(due.length).toBe(1);
  });

  test('所有错题都未到期时返回空数组', function() {
    var d = App.db.get();
    d.wrong = [{ qid: '001', cnt: 1, level: 2, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() + 86400000 }];
    var due = App.db.getDueWrong();
    expect(due.length).toBe(0);
  });
});

describe('每日目标 - setDailyGoal / getDailyGoal', function() {
  beforeEach(function() {
    resetCache();
  });

  test('正常设置目标', function() {
    App.db.setDailyGoal(30);
    expect(App.db.getDailyGoal()).toBe(30);
  });

  test('低于5时钳位到5', function() {
    App.db.setDailyGoal(1);
    expect(App.db.getDailyGoal()).toBe(5);
  });

  test('高于100时钳位到100', function() {
    App.db.setDailyGoal(200);
    expect(App.db.getDailyGoal()).toBe(100);
  });

  test('边界值5和100正常设置', function() {
    App.db.setDailyGoal(5);
    expect(App.db.getDailyGoal()).toBe(5);
    App.db.setDailyGoal(100);
    expect(App.db.getDailyGoal()).toBe(100);
  });

  test('默认值为20', function() {
    expect(App.db.getDailyGoal()).toBe(20);
  });
});

describe('getStreak - 连续打卡天数', function() {
  beforeEach(function() {
    resetCache();
  });

  test('无答题记录返回0', function() {
    expect(App.db.getStreak()).toBe(0);
  });

  test('今天答过题，连续1天', function() {
    var d = App.db.get();
    d.history.push({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    expect(App.db.getStreak()).toBe(1);
  });

  test('今天未答但昨天答过，连续1天', function() {
    var d = App.db.get();
    var yesterday = Date.now() - 24 * 60 * 60 * 1000;
    d.history.push({ qid: '001', ans: 'A', ok: true, time: yesterday });
    expect(App.db.getStreak()).toBe(1);
  });

  test('连续多天打卡', function() {
    var d = App.db.get();
    var now = Date.now();
    for (var i = 0; i < 5; i++) {
      d.history.push({ qid: '001', ans: 'A', ok: true, time: now - i * 24 * 60 * 60 * 1000 });
    }
    expect(App.db.getStreak()).toBe(5);
  });

  test('中间断签则仅计连续部分', function() {
    var d = App.db.get();
    var now = Date.now();
    // 今天和前天答过，昨天没答
    d.history.push({ qid: '001', ans: 'A', ok: true, time: now });
    d.history.push({ qid: '001', ans: 'A', ok: true, time: now - 2 * 24 * 60 * 60 * 1000 });
    expect(App.db.getStreak()).toBe(1);
  });
});

describe('checkAchievements - 成就系统', function() {
  beforeEach(function() {
    resetCache();
  });

  test('初次答题解锁 first_answer', function() {
    var d = App.db.get();
    d.stats.total = 1;
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('first_answer');
  });

  test('答满100题解锁 total_100', function() {
    var d = App.db.get();
    d.stats.total = 100;
    d.stats.correct = 50;
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('total_100');
  });

  test('答满50题且正确率>=90% 解锁 acc_90', function() {
    var d = App.db.get();
    d.stats.total = 50;
    d.stats.correct = 45;
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('acc_90');
  });

  test('答满50题但正确率<90% 不解锁 acc_90', function() {
    var d = App.db.get();
    d.stats.total = 50;
    d.stats.correct = 44;
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).not.toContain('acc_90');
  });

  test('单次10题全对解锁 perfect_10', function() {
    var d = App.db.get();
    d.stats.total = 10;
    d.stats.correct = 10;
    var unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('perfect_10');
  });

  test('已解锁成就不重复返回', function() {
    var d = App.db.get();
    d.stats.total = 1;
    App.db.checkAchievements(); // 首次
    var unlocks2 = App.db.checkAchievements(); // 二次
    expect(unlocks2.length).toBe(0);
  });

  test('错题清零（有记录且错题为空）解锁 wrong_clear', function() {
    var d = App.db.get();
    d.stats.total = 10;
    d.stats.correct = 10;
    d.achievements = ['first_answer']; // 已有 first_answer
    d.wrong = []; // 错题为空
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('wrong_clear');
  });

  test('全分类答题解锁 all_cats', function() {
    var d = App.db.get();
    d.stats.total = 100;
    d.stats.cats = {
      '专辑': { t: 25, c: 20 },
      '歌曲': { t: 25, c: 20 },
      '个人信息': { t: 25, c: 20 },
      '获奖记录': { t: 25, c: 20 }
    };
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('all_cats');
  });

  test('部分分类无答题不解锁 all_cats', function() {
    var d = App.db.get();
    d.stats.total = 50;
    d.stats.cats = {
      '专辑': { t: 25, c: 20 },
      '歌曲': { t: 25, c: 20 }
    };
    var unlocks = App.db.checkAchievements();
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).not.toContain('all_cats');
  });
});

describe('App.session - 答题中断恢复', function() {
  beforeEach(function() {
    mockStorage = {};
  });

  test('save + load 正确持久化', function() {
    var state = {
      quiz: [{ id: '001' }, { id: '002' }],
      idx: 1,
      correctCount: 1,
      startTime: 1000000,
      mode: 'standard'
    };
    App.session.save(state);
    var loaded = App.session.load();
    expect(loaded.quizIds).toEqual(['001', '002']);
    expect(loaded.idx).toBe(1);
    expect(loaded.correctCount).toBe(1);
    expect(loaded.mode).toBe('standard');
  });

  test('load 空数据返回 null', function() {
    expect(App.session.load()).toBeNull();
  });

  test('clear 后 load 返回 null', function() {
    App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
    App.session.clear();
    expect(App.session.load()).toBeNull();
  });

  test('损坏的 JSON 数据 load 返回 null', function() {
    mockStorage['jj_quiz_session'] = '{invalid json';
    expect(App.session.load()).toBeNull();
  });
});

describe('App.db.recalcStats - 统计重算', function() {
  test('从 history 重新计算统计', function() {
    resetCache();
    App.QUESTION_BANK = [
      { id: '001', category: '专辑', question: '测试', options: [], answer: 'A', explanation: '' },
      { id: '002', category: '歌曲', question: '测试2', options: [], answer: 'B', explanation: '' }
    ];
    var d = App.db.get();
    d.history = [
      { qid: '001', ans: 'A', ok: true, time: Date.now() },
      { qid: '002', ans: 'A', ok: false, time: Date.now() },
      { qid: '001', ans: 'A', ok: true, time: Date.now() }
    ];
    d.stats = { total: 0, correct: 0, cats: {} }; // 清空

    App.db.recalcStats();
    var after = App.db.get();
    expect(after.stats.total).toBe(3);
    expect(after.stats.correct).toBe(2);
    expect(after.stats.cats['专辑'].t).toBe(2);
    expect(after.stats.cats['专辑'].c).toBe(2);
    expect(after.stats.cats['歌曲'].t).toBe(1);
    expect(after.stats.cats['歌曲'].c).toBe(0);
  });
});
