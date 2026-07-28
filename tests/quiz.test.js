/**
 * quiz.js 核心逻辑单元测试（轻量 mock，不依赖 jsdom）
 * 覆盖：shuffle 随机打乱、getCount 模式映射、tryResumeSession 会话恢复
 */

// --- 最小浏览器环境模拟 ---
function setupBrowserEnv() {
  const textContentMap = new WeakMap();
  global.document = {
    createElement: function(tag) {
      return {
        set textContent(v) { textContentMap.set(this, v); },
        get textContent() { return textContentMap.get(this) || ''; },
        get innerHTML() {
          const t = textContentMap.get(this) || '';
          return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
      };
    },
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
  };

  const store = {};
  global.sessionStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };

  global.indexedDB = { open: () => ({}) };
  global.window = global;
  global.navigator = { vibrate: null };
}

let App;

beforeEach(() => {
  setupBrowserEnv();
  jest.resetModules();
  delete require.cache[require.resolve('../js/storage.js')];
  delete require.cache[require.resolve('../js/data.js')];
  delete require.cache[require.resolve('../js/quiz.js')];

  global.App = {};
  require('../js/data.js');
  require('../js/storage.js');
  require('../js/quiz.js');
  App = global.App;
});

// ============================================================
// 1. shuffle 随机打乱
// ============================================================
describe('App.shuffle - 随机打乱', () => {
  test('返回新数组，不修改原数组', () => {
    const orig = [1, 2, 3, 4, 5];
    const result = App.shuffle(orig);
    expect(orig).toEqual([1, 2, 3, 4, 5]);
    expect(result).not.toBe(orig);
  });

  test('结果包含所有原始元素', () => {
    const orig = [1, 2, 3, 4, 5];
    const result = App.shuffle(orig);
    expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('空数组返回空数组', () => {
    expect(App.shuffle([])).toEqual([]);
  });

  test('单元素数组返回相同元素', () => {
    expect(App.shuffle([42])).toEqual([42]);
  });
});

// ============================================================
// 2. selectMode 模式选择
// ============================================================
describe('selectMode - 模式选择', () => {
  test('quick 模式设置 state.mode', () => {
    App.selectMode('quick');
    expect(App.state.mode).toBe('quick');
  });

  test('standard 模式设置 state.mode', () => {
    App.selectMode('standard');
    expect(App.state.mode).toBe('standard');
  });

  test('intensive 模式设置 state.mode', () => {
    App.selectMode('intensive');
    expect(App.state.mode).toBe('intensive');
  });
});

// ============================================================
// 3. tryResumeSession 会话恢复逻辑
// ============================================================
describe('tryResumeSession - 会话恢复', () => {
  beforeEach(() => {
    App.db.setData(App.db.defaults());
    App.QUESTION_BANK = [
      { id: 'q1', category: '专辑', question: '测试1', options: [{key:'A',text:'a'},{key:'B',text:'b'}], answer: 'A', explanation: '' },
      { id: 'q2', category: '歌曲', question: '测试2', options: [{key:'A',text:'a'},{key:'B',text:'b'}], answer: 'B', explanation: '' },
    ];
  });

  test('无保存会话时返回 false', () => {
    App.session.clear();
    expect(App.tryResumeSession()).toBe(false);
  });

  test('保存的会话已答完（idx >= quiz.length）时返回 false 并清除会话', () => {
    App.session.save({
      quiz: [{ id: 'q1' }],
      idx: 1,
      correctCount: 0,
      startTime: Date.now() - 10000,
      mode: 'quick'
    });
    expect(App.tryResumeSession()).toBe(false);
    expect(App.session.load()).toBeNull();
  });

  test('有效会话恢复状态', () => {
    App.session.save({
      quiz: [{ id: 'q1' }, { id: 'q2' }],
      idx: 1,
      correctCount: 1,
      startTime: Date.now() - 30000,
      mode: 'standard',
      isWrongBookQuiz: true
    });
    const result = App.tryResumeSession();
    expect(result).toBe(true);
    expect(App.state.idx).toBe(1);
    expect(App.state.correctCount).toBe(1);
    expect(App.state.mode).toBe('standard');
    expect(App.state.isWrongBookQuiz).toBe(true);
    expect(App.state.quiz.length).toBe(2);
  });

  test('恢复时 startTime 被修正以保持计时连续性', () => {
    const savedStart = Date.now() - 60000;
    App.session.save({
      quiz: [{ id: 'q1' }, { id: 'q2' }],
      idx: 0,
      correctCount: 0,
      startTime: savedStart,
      mode: 'quick'
    });
    App.tryResumeSession();
    const elapsed = Date.now() - App.state.startTime;
    expect(elapsed).toBeGreaterThanOrEqual(55000);
    expect(elapsed).toBeLessThanOrEqual(70000);
  });

  test('题目ID在题库中不存在时跳过该题', () => {
    App.session.save({
      quiz: [{ id: 'q1' }, { id: 'nonexist' }, { id: 'q2' }],
      idx: 0,
      correctCount: 0,
      startTime: Date.now(),
      mode: 'quick'
    });
    const result = App.tryResumeSession();
    expect(result).toBe(true);
    expect(App.state.quiz.length).toBe(2);
  });

  test('所有题目ID都无效时返回 false', () => {
    App.session.save({
      quiz: [{ id: 'nonexist1' }, { id: 'nonexist2' }],
      idx: 0,
      correctCount: 0,
      startTime: Date.now(),
      mode: 'quick'
    });
    expect(App.tryResumeSession()).toBe(false);
  });
});
