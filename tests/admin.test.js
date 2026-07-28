/**
 * admin.js 数据导入逻辑单元测试（轻量 mock，不依赖 jsdom）
 * 覆盖：导入题库去重合并、错题本合并（间隔重复数据兼容）、stats重算
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
    getElementById: (id) => {
      // 返回适合 admin.js 的 DOM 元素
      const el = {
        style: {},
        value: '',
        textContent: '',
        innerHTML: '',
        display: '',
        selectedIndex: 0,
        options: [],
      };
      if (id === 'editModal' || id === 'resetModal') {
        el.style = { display: 'none' };
      }
      return el;
    },
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
  delete require.cache[require.resolve('../js/admin.js')];

  global.App = {};
  require('../js/data.js');
  require('../js/storage.js');
  require('../js/admin.js');
  App = global.App;
});

// ============================================================
// 辅助：模拟 FileReader 导入
// ============================================================
function simulateImport(importData) {
  const json = JSON.stringify(importData);
  const mockEvent = {
    target: {
      files: [{}],
      value: ''
    }
  };

  const origFileReader = global.FileReader;
  global.FileReader = function() {
    this.readAsText = function() {
      this.onload({ target: { result: json } });
    };
  };

  global.alert = jest.fn();
  global.confirm = jest.fn(() => true);

  App.importData(mockEvent);

  global.FileReader = origFileReader;
}

// ============================================================
// 1. 导入题库 - 去重合并
// ============================================================
describe('importData - 题库导入', () => {
  beforeEach(() => {
    App.db.setData(App.db.defaults());
    App.QUESTION_BANK = [
      { id: '001', category: '专辑', question: '原题', options: [{key:'A',text:'a'}], answer: 'A', explanation: '' },
    ];
  });

  test('新增不存在的题目', () => {
    simulateImport({
      questionBank: [
        { id: '002', category: '歌曲', question: '新题', options: [{key:'A',text:'a'}], answer: 'B', explanation: '' },
      ]
    });
    expect(App.QUESTION_BANK.length).toBe(2);
    expect(App.QUESTION_BANK.find(q => q.id === '002')).toBeDefined();
  });

  test('更新已存在的题目（相同ID）', () => {
    simulateImport({
      questionBank: [
        { id: '001', category: '专辑', question: '修改后的题', options: [{key:'A',text:'a'}], answer: 'A', explanation: 'updated' },
      ]
    });
    expect(App.QUESTION_BANK.length).toBe(1);
    expect(App.QUESTION_BANK[0].question).toBe('修改后的题');
  });

  test('混合新增和更新', () => {
    simulateImport({
      questionBank: [
        { id: '001', category: '专辑', question: '更新题', options: [{key:'A',text:'a'}], answer: 'A', explanation: '' },
        { id: '003', category: '个人信息', question: '全新题', options: [{key:'A',text:'a'}], answer: 'A', explanation: '' },
      ]
    });
    expect(App.QUESTION_BANK.length).toBe(2);
  });

  test('无效 JSON 格式提示错误', () => {
    const mockEvent = {
      target: { files: [{}], value: '' }
    };
    global.FileReader = function() {
      this.readAsText = function() {
        this.onload({ target: { result: 'invalid json {{{' } });
      };
    };
    global.alert = jest.fn();
    App.importData(mockEvent);
    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('导入失败'));
  });

  test('缺少 questionBank 和 userData 提示错误', () => {
    const mockEvent = {
      target: { files: [{}], value: '' }
    };
    global.FileReader = function() {
      this.readAsText = function() {
        this.onload({ target: { result: JSON.stringify({ otherKey: 123 }) } });
      };
    };
    global.alert = jest.fn();
    App.importData(mockEvent);
    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('未找到有效数据'));
  });
});

// ============================================================
// 2. 导入用户数据 - 错题本合并
// ============================================================
describe('importData - 错题本合并', () => {
  beforeEach(() => {
    App.QUESTION_BANK = [
      { id: 'q1', category: '专辑', question: '测试1', options: [], answer: 'A', explanation: '' },
      { id: 'q2', category: '歌曲', question: '测试2', options: [], answer: 'B', explanation: '' },
    ];
    App.db.setData(App.db.defaults());
    const d = App.db.get();
    d.wrong = [
      { qid: 'q1', cnt: 3, level: 2, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() + 3600000 }
    ];
    d.history = [
      { qid: 'q1', ans: 'A', ok: true, time: Date.now() }
    ];
    App.db.setData(d);
  });

  test('合并新错题（导入有但本地没有的）', () => {
    simulateImport({
      userData: {
        wrong: [
          { qid: 'q2', cnt: 2, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() }
        ],
        history: []
      }
    });
    const wl = App.db.getWrong();
    expect(wl.length).toBe(2);
    expect(wl.find(w => w.qid === 'q2')).toBeDefined();
  });

  test('合并已有错题取较高 cnt', () => {
    simulateImport({
      userData: {
        wrong: [
          { qid: 'q1', cnt: 5, level: 1, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() }
        ],
        history: []
      }
    });
    const w = App.db.getWrong().find(x => x.qid === 'q1');
    expect(w.cnt).toBe(5);
  });

  test('合并已有错题取较低 level（更保守）', () => {
    simulateImport({
      userData: {
        wrong: [
          { qid: 'q1', cnt: 1, level: 0, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() }
        ],
        history: []
      }
    });
    const w = App.db.getWrong().find(x => x.qid === 'q1');
    expect(w.level).toBe(0);
  });

  test('导入错题缺少间隔重复字段时自动填充', () => {
    simulateImport({
      userData: {
        wrong: [
          { qid: 'q2', cnt: 1 }
        ],
        history: []
      }
    });
    const w = App.db.getWrong().find(x => x.qid === 'q2');
    expect(w.level).toBe(0);
    expect(w.nextReview).toBeGreaterThan(0);
    expect(w.lastReview).toBe(0);
    expect(w.time).toBeGreaterThan(0);
  });
});

// ============================================================
// 3. 导入后 stats 重算
// ============================================================
describe('importData - stats 重算而非累加', () => {
  beforeEach(() => {
    App.QUESTION_BANK = [
      { id: 'q1', category: '专辑', question: '测试1', options: [], answer: 'A', explanation: '' },
    ];
    App.db.setData(App.db.defaults());
    const d = App.db.get();
    d.history = [
      { qid: 'q1', ans: 'A', ok: true, time: Date.now() },
    ];
    App.db.setData(d);
  });

  test('导入后 stats 从 history 重新计算', () => {
    simulateImport({
      userData: {
        history: [
          { qid: 'q1', ans: 'B', ok: false, time: Date.now() - 10000 },
        ],
        wrong: [],
      }
    });
    const d = App.db.get();
    expect(d.stats.total).toBe(2);
    expect(d.stats.correct).toBe(1);
  });
});
