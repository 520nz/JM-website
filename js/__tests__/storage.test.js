// storage.js 单元测试：覆盖 IndexedDB 迁移后的核心存储与间隔重复逻辑

describe('App.db storage layer', () => {
  beforeEach(async () => {
    jest.resetModules();
    // 重置全局 App，避免测试间状态污染
    window.App = {};

    // 每个测试使用独立的 IndexedDB 实例
    global.createTestIndexedDB();

    // 加载 data.js 提供默认题库
    require('../data.js');
    // 加载被测模块
    require('../storage.js');

    await window.App.db.init();
  });

  afterEach(() => {
    window.App = {};
  });

  test('defaults() 返回正确的初始数据结构', () => {
    const d = window.App.db.defaults();
    expect(d).toEqual({ history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });
  });

  test('get() 在未初始化时返回默认结构', () => {
    window.App.db.setData(window.App.db.defaults());
    const d = window.App.db.get();
    expect(d.history).toEqual([]);
    expect(d.stats.total).toBe(0);
  });

  test('addRecord 正确更新总统计与分类统计', () => {
    window.App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    window.App.db.addRecord({ qid: '002', ans: 'B', ok: false, time: Date.now() });

    const d = window.App.db.get();
    expect(d.history.length).toBe(2);
    expect(d.stats.total).toBe(2);
    expect(d.stats.correct).toBe(1);
    expect(d.stats.cats['专辑'].t).toBe(1);
    expect(d.stats.cats['专辑'].c).toBe(1);
    expect(d.stats.cats['歌曲'].t).toBe(1);
    expect(d.stats.cats['歌曲'].c).toBe(0);
  });

  test('addRecord 对未知题目不崩溃且不计入分类', () => {
    window.App.db.addRecord({ qid: 'unknown', ans: 'A', ok: true, time: Date.now() });
    const d = window.App.db.get();
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(1);
    expect(Object.keys(d.stats.cats)).toEqual([]);
  });

  test('addWrong 首次添加创建间隔重复记录', () => {
    window.App.db.addWrong('001');
    const w = window.App.db.getWrong();
    expect(w.length).toBe(1);
    expect(w[0].qid).toBe('001');
    expect(w[0].cnt).toBe(1);
    expect(w[0].level).toBe(0);
    expect(w[0].nextReview).toBeLessThanOrEqual(Date.now());
  });

  test('addWrong 重复答错增加次数并重置等级', () => {
    window.App.db.addWrong('001');
    // 模拟已经升级到 level 2
    const d = window.App.db.get();
    d.wrong[0].level = 2;
    d.wrong[0].nextReview = Date.now() + 86400000;

    window.App.db.addWrong('001');
    const w = window.App.db.getWrong()[0];
    expect(w.cnt).toBe(2);
    expect(w.level).toBe(0);
    expect(w.nextReview).toBeLessThanOrEqual(Date.now());
  });

  test('reviewCorrect 逐级提升并在 level 5 移除错题', () => {
    window.App.db.addWrong('001');

    for (let i = 0; i < 4; i++) {
      window.App.db.reviewCorrect('001');
    }
    expect(window.App.db.getWrong().length).toBe(1);
    expect(window.App.db.getWrong()[0].level).toBe(4);

    // 第 5 次正确后应移除
    window.App.db.reviewCorrect('001');
    expect(window.App.db.getWrong().length).toBe(0);
  });

  test('reviewCorrect 的 nextReview 按 SR_INTERVALS 递增', () => {
    const base = 1000000000000;
    jest.spyOn(Date, 'now').mockReturnValue(base);
    window.App.db.addWrong('001');

    window.App.db.reviewCorrect('001'); // level 1 => 1小时后
    const w = window.App.db.getWrong()[0];
    expect(w.level).toBe(1);
    expect(w.nextReview - base).toBe(60 * 60 * 1000);

    Date.now.mockRestore();
  });

  test('reviewWrong 在错题本中存在时重置等级并增加次数', () => {
    window.App.db.addWrong('001');
    window.App.db.reviewCorrect('001'); // level 1
    window.App.db.reviewWrong('001');
    const w = window.App.db.getWrong()[0];
    expect(w.level).toBe(0);
    expect(w.cnt).toBe(2);
  });

  test('reviewWrong 对不在错题本的题目新增记录', () => {
    window.App.db.reviewWrong('001');
    const w = window.App.db.getWrong();
    expect(w.length).toBe(1);
    expect(w[0].qid).toBe('001');
    expect(w[0].cnt).toBe(1);
  });

  test('getDueWrong 只返回已到复习时间的错题', () => {
    const now = Date.now();
    window.App.db.addWrong('001');
    window.App.db.addWrong('002');
    const d = window.App.db.get();
    d.wrong[1].nextReview = now + 86400000; // 明天才到期

    const due = window.App.db.getDueWrong();
    expect(due.length).toBe(1);
    expect(due[0].qid).toBe('001');
  });

  test('removeWrong 移除指定错题', () => {
    window.App.db.addWrong('001');
    window.App.db.addWrong('002');
    window.App.db.removeWrong('001');
    expect(window.App.db.getWrong().length).toBe(1);
    expect(window.App.db.getWrong()[0].qid).toBe('002');
  });

  test('recalcStats 从 history 重新计算统计，修复导入后累加问题', () => {
    window.App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    window.App.db.addRecord({ qid: '002', ans: 'B', ok: false, time: Date.now() });

    // 模拟错误地累加了 stats
    const d = window.App.db.get();
    d.stats.total = 999;
    d.stats.correct = 999;

    window.App.db.recalcStats();
    expect(d.stats.total).toBe(2);
    expect(d.stats.correct).toBe(1);
    expect(d.stats.cats['专辑'].t).toBe(1);
  });

  test('findQ 在题库中查找题目', () => {
    const q = window.App.db.findQ('001');
    expect(q).toBeTruthy();
    expect(q.id).toBe('001');
    expect(window.App.db.findQ('not-exist')).toBeNull();
  });

  test('setData 直接覆盖缓存并持久化', async () => {
    const custom = { history: [{ qid: '001', ok: true }], wrong: [], stats: { total: 1, correct: 1, cats: {} } };
    window.App.db.setData(custom);

    // 重新初始化应读到同一份数据
    await window.App.db.init();
    const loaded = window.App.db.get();
    expect(loaded.history.length).toBe(1);
    expect(loaded.stats.total).toBe(1);
  });

  test('esc 对 XSS 特殊字符进行 HTML 转义', () => {
    expect(window.App.esc('<script>alert("x")</script>')).not.toContain('<script>');
    expect(window.App.esc(null)).toBe('');
    expect(window.App.esc(undefined)).toBe('');
  });
});

describe('App.session', () => {
  beforeEach(() => {
    jest.resetModules();
    window.App = {};
    require('../data.js');
    require('../storage.js');
  });

  test('session save/load 保持答题状态', () => {
    const state = {
      quiz: [{ id: '001' }, { id: '002' }],
      idx: 1,
      correctCount: 1,
      startTime: 1234567890,
      mode: 'standard'
    };
    window.App.session.save(state);
    const loaded = window.App.session.load();
    expect(loaded.quizIds).toEqual(['001', '002']);
    expect(loaded.idx).toBe(1);
    expect(loaded.correctCount).toBe(1);
    expect(loaded.startTime).toBe(1234567890);
    expect(loaded.mode).toBe('standard');
  });

  test('session load 在空 sessionStorage 时返回 null', () => {
    window.App.session.clear();
    expect(window.App.session.load()).toBeNull();
  });

  test('session save 对异常静默处理', () => {
    const orig = window.sessionStorage.setItem;
    window.sessionStorage.setItem = () => { throw new Error('quota'); };
    expect(() => window.App.session.save({ quiz: [], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' })).not.toThrow();
    window.sessionStorage.setItem = orig;
  });
});

describe('App.store question bank persistence', () => {
  beforeEach(async () => {
    jest.resetModules();
    window.App = {};
    global.createTestIndexedDB();
    require('../data.js');
    require('../storage.js');
  });

  test('store.save 持久化题库，store.init 加载后保留默认备份', async () => {
    await window.App.store.init();
    const original = window.App.QUESTION_BANK.slice();

    window.App.QUESTION_BANK.push({ id: 'new', category: '测试', question: 'Q', options: [], answer: 'A', explanation: '' });
    await window.App.store.save();

    // 重新初始化
    jest.resetModules();
    window.App = {};
    require('../data.js');
    require('../storage.js');
    await window.App.store.init();

    expect(window.App.QUESTION_BANK.length).toBe(original.length + 1);
    expect(window.App.QUESTION_BANK.some(q => q.id === 'new')).toBe(true);
    expect(window.App.DEFAULT_QUESTION_BANK.length).toBe(original.length + 1);
  });

  test('store.reset 恢复为默认题库', async () => {
    await window.App.store.init();
    const original = window.App.QUESTION_BANK.slice();
    window.App.QUESTION_BANK = [];
    await window.App.store.reset();
    expect(window.App.QUESTION_BANK.length).toBe(original.length);
  });
});
