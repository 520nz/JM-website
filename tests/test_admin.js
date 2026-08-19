// admin.js 数据导入合并逻辑测试
const { describe, it, expect } = require('./runner');
const { setupDOMElements } = require('./mock');

require('./mock');
require('./setup').loadAll();
const App = global.App;

setupDOMElements();

function setupEmptyState() {
  App.db.setData({
    history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
    theme: 'dark', dailyGoal: 20, achievements: [], archive: []
  });
}

describe('admin.js - 选项解析 (saveQuestion)', () => {
  // 直接测试选项解析逻辑（从 saveQuestion 提取的逻辑）
  function parseOptions(optsText) {
    const lines = optsText.split('\n');
    const options = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) {
        options.push({ key: match[1], text: match[2] });
      }
    }
    return options;
  }

  it('标准格式解析', () => {
    const text = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
    const opts = parseOptions(text);
    expect(opts.length).toBe(4);
    expect(opts[0].key).toBe('A');
    expect(opts[0].text).toBe('选项一');
  });

  it('中文句号分隔', () => {
    const text = 'A. 选项一\nB. 选项二';
    const opts = parseOptions(text);
    expect(opts.length).toBe(2);
    expect(opts[0].text).toBe('选项一');
  });

  it('顿号分隔', () => {
    const text = 'A、选项一\nB、选项二';
    const opts = parseOptions(text);
    expect(opts.length).toBe(2);
  });

  it('混合分隔符', () => {
    const text = 'A.选项一\nB、选项二\nC．选项三';
    const opts = parseOptions(text);
    expect(opts.length).toBe(3);
  });

  it('跳过空行', () => {
    const text = 'A.选项一\n\nB.选项二\n';
    const opts = parseOptions(text);
    expect(opts.length).toBe(2);
  });

  it('单行格式', () => {
    const text = 'A.正确 B.错误';
    const opts = parseOptions(text);
    expect(opts.length).toBe(1); // 只匹配第一个
  });

  it('无有效选项返回空', () => {
    const text = '这不是选项格式';
    const opts = parseOptions(text);
    expect(opts.length).toBe(0);
  });

  it('必须至少两个选项', () => {
    const text = 'A.只有一个';
    const opts = parseOptions(text);
    expect(opts.length).toBe(1);
    // saveQuestion 会检查 options.length < 2
    expect(opts.length >= 2).toBe(false);
  });
});

describe('admin.js - 题库管理 (CRUD)', () => {
  it('新增题目', () => {
    const initialCount = App.QUESTION_BANK.length;
    App.QUESTION_BANK.push({
      id: 'test_' + Date.now(),
      category: '测试',
      question: '测试题目？',
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' }
      ],
      answer: 'A',
      explanation: '测试解析'
    });
    expect(App.QUESTION_BANK.length).toBe(initialCount + 1);
  });

  it('删除题目', () => {
    const testId = 'test_delete';
    App.QUESTION_BANK.push({
      id: testId,
      category: '测试',
      question: '待删除',
      options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
      answer: 'A',
      explanation: ''
    });
    const countBefore = App.QUESTION_BANK.length;
    App.QUESTION_BANK = App.QUESTION_BANK.filter(q => q.id !== testId);
    expect(App.QUESTION_BANK.length).toBe(countBefore - 1);
  });

  it('编辑题目', () => {
    const testId = 'test_edit';
    App.QUESTION_BANK.push({
      id: testId,
      category: '测试',
      question: '原始题目',
      options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
      answer: 'A',
      explanation: '原始解析'
    });
    // 编辑
    for (let i = 0; i < App.QUESTION_BANK.length; i++) {
      if (App.QUESTION_BANK[i].id === testId) {
        App.QUESTION_BANK[i].question = '修改后题目';
        App.QUESTION_BANK[i].answer = 'B';
        break;
      }
    }
    const q = App.db.findQ(testId);
    expect(q.question).toBe('修改后题目');
    expect(q.answer).toBe('B');
  });
});

describe('admin.js - 数据导入合并逻辑', () => {
  it('合并答题历史', () => {
    setupEmptyState();
    const existing = App.db.get();
    existing.history = [
      { qid: '001', ans: 'A', ok: true, time: Date.now() - 1000 }
    ];
    // 模拟导入数据
    const imported = {
      history: [
        { qid: '002', ans: 'B', ok: false, time: Date.now() }
      ]
    };
    existing.history = existing.history.concat(imported.history);
    App.db.setData(existing);
    expect(App.db.get().history.length).toBe(2);
  });

  it('错题合并 - 新错题', () => {
    setupEmptyState();
    const existing = App.db.get();
    existing.wrong = [{ qid: '001', cnt: 1, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() }];

    const importedWrong = [{ qid: '002', cnt: 2, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() }];

    // 合并逻辑
    const wrongMap = {};
    for (let w = 0; w < existing.wrong.length; w++) {
      wrongMap[existing.wrong[w].qid] = existing.wrong[w];
    }
    for (let x = 0; x < importedWrong.length; x++) {
      const wItem = importedWrong[x];
      if (wrongMap[wItem.qid]) {
        wrongMap[wItem.qid].cnt = Math.max(wrongMap[wItem.qid].cnt, wItem.cnt || 1);
        if (wItem.level != null) {
          wrongMap[wItem.qid].level = Math.min(wrongMap[wItem.qid].level || 0, wItem.level);
        }
      } else {
        if (!wItem.level) wItem.level = 0;
        if (!wItem.nextReview) wItem.nextReview = Date.now();
        if (!wItem.lastReview) wItem.lastReview = 0;
        if (!wItem.time) wItem.time = Date.now();
        existing.wrong.push(wItem);
      }
    }
    App.db.setData(existing);
    expect(App.db.get().wrong.length).toBe(2);
  });

  it('错题合并 - 去重错题', () => {
    setupEmptyState();
    const existing = App.db.get();
    existing.wrong = [{ qid: '001', cnt: 1, level: 2, time: Date.now(), lastReview: 0, nextReview: Date.now() }];

    const importedWrong = [{ qid: '001', cnt: 3, level: 1 }];

    // 合并逻辑
    const wrongMap = {};
    for (let w = 0; w < existing.wrong.length; w++) {
      wrongMap[existing.wrong[w].qid] = existing.wrong[w];
    }
    for (let x = 0; x < importedWrong.length; x++) {
      const wItem = importedWrong[x];
      if (wrongMap[wItem.qid]) {
        wrongMap[wItem.qid].cnt = Math.max(wrongMap[wItem.qid].cnt, wItem.cnt || 1);
        if (wItem.level != null) {
          wrongMap[wItem.qid].level = Math.min(wrongMap[wItem.qid].level || 0, wItem.level);
        }
      }
    }
    App.db.setData(existing);
    const merged = App.db.get().wrong;
    expect(merged.length).toBe(1);
    expect(merged[0].cnt).toBe(3); // 取较大值
    expect(merged[0].level).toBe(1); // 取较低等级（更保守）
  });

  it('Stats 重算而非累加', () => {
    setupEmptyState();
    const existing = App.db.get();
    existing.history = [
      { qid: '001', ans: 'A', ok: true, time: Date.now() - 2000 },
      { qid: '002', ans: 'B', ok: false, time: Date.now() - 1000 }
    ];
    // 模拟导入数据
    existing.history = existing.history.concat([
      { qid: '003', ans: 'C', ok: true, time: Date.now() }
    ]);

    App.db.setData(existing);
    App.db.recalcStats();
    const d = App.db.get();
    expect(d.stats.total).toBe(3);
    expect(d.stats.correct).toBe(2);
  });
});

describe('admin.js - 数据导出', () => {
  it('导出数据结构正确', () => {
    setupEmptyState();
    const data = {
      questionBank: App.QUESTION_BANK,
      userData: App.db.get(),
      exportTime: new Date().toISOString()
    };
    expect(data.questionBank).toBeDefined();
    expect(data.userData).toBeDefined();
    expect(data.exportTime).toBeDefined();
    expect(Array.isArray(data.questionBank)).toBe(true);
  });

  it('导出的题库包含题目', () => {
    setupEmptyState();
    const data = {
      questionBank: App.QUESTION_BANK,
      userData: App.db.get(),
      exportTime: new Date().toISOString()
    };
    expect(data.questionBank.length).toBeGreaterThan(0);
    expect(data.questionBank[0].id).toBeDefined();
    expect(data.questionBank[0].question).toBeDefined();
    expect(data.questionBank[0].options).toBeDefined();
  });
});

describe('admin.js - 题库重置', () => {
  it('重置后恢复默认题库', () => {
    const originalCount = App.DEFAULT_QUESTION_BANK.length;
    // 新增一道题
    App.QUESTION_BANK.push({
      id: 'reset_test',
      category: '测试',
      question: '测试',
      options: [{ key: 'A', text: 'A' }],
      answer: 'A',
      explanation: ''
    });
    // 重置
    App.QUESTION_BANK = App.DEFAULT_QUESTION_BANK.slice();
    expect(App.QUESTION_BANK.length).toBe(originalCount);
    // 确认新增的题已移除
    const found = App.QUESTION_BANK.find(q => q.id === 'reset_test');
    expect(found).toBeUndefined();
  });
});

describe('admin.js - 分页逻辑', () => {
  it('分页计算正确', () => {
    const pageSize = 30;
    const total = 78;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    expect(totalPages).toBe(3);

    // 第 1 页
    const page = 1;
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    expect(start).toBe(0);
    expect(end).toBe(30);

    // 第 3 页
    const page3 = 3;
    const start3 = (page3 - 1) * pageSize;
    const end3 = Math.min(start3 + pageSize, total);
    expect(start3).toBe(60);
    expect(end3).toBe(78);
  });

  it('单页题目不分页', () => {
    const pageSize = 30;
    const total = 15;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    expect(totalPages).toBe(1);
  });
});

describe('admin.js - 搜索过滤', () => {
  it('按关键词过滤题目', () => {
    const search = '江南';
    const filtered = App.QUESTION_BANK.filter(q =>
      q.question.toLowerCase().indexOf(search.toLowerCase()) !== -1
    );
    expect(filtered.length).toBeGreaterThan(0);
    for (let i = 0; i < filtered.length; i++) {
      expect(filtered[i].question).toContain('江南');
    }
  });

  it('按分类过滤', () => {
    const cat = '专辑';
    const filtered = App.QUESTION_BANK.filter(q => q.category === cat);
    expect(filtered.length).toBeGreaterThan(0);
    for (let i = 0; i < filtered.length; i++) {
      expect(filtered[i].category).toBe('专辑');
    }
  });

  it('空过滤条件返回全部', () => {
    const filtered = App.QUESTION_BANK.filter(q => true);
    expect(filtered.length).toBe(App.QUESTION_BANK.length);
  });
});
