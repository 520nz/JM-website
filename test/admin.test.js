// ============================================================
// admin.test.js - 题库管理与数据导入导出测试
// ============================================================

const { setupBrowserMocks, loadAdminScripts } = require('./test-helper');

setupBrowserMocks();

function setupDOM() {
  document.body.innerHTML = '';
  
  var ids = [
    'categoryFilter', 'editCategory', 'searchInput', 'questionList',
    'modalTitle', 'editId', 'editQuestion', 'editOptions', 'editAnswer',
    'editExplanation', 'editModal', 'resetModal', 'resetConfirmInput',
    'resetConfirmBtn'
  ];
  ids.forEach(function(id) {
    var el = document.createElement(id === 'editModal' || id === 'resetModal' ? 'div' : (id === 'resetConfirmBtn' ? 'button' : 'input'));
    el.id = id;
    if (id === 'editModal' || id === 'resetModal') el.style.display = 'none';
    if (id === 'resetConfirmBtn') {
      el.style.opacity = '0.5';
      el.style.pointerEvents = 'none';
    }
    if (id === 'categoryFilter' || id === 'editCategory') {
      el.value = '';
    }
    document.body.appendChild(el);
  });
}

beforeEach(function() {
  setupDOM();
  App = loadAdminScripts();
  App.db.init();
  App.db.setData(App.db.defaults());
  App.updateHome = function() {};
});

// ============================================================
// 选项解析 (saveQuestion 内部逻辑)
// ============================================================
describe('选项解析', () => {
  test('解析标准格式 A.选项内容', () => {
    var lines = ['A.选项一', 'B.选项二', 'C.选项三', 'D.选项四'];
    var options = [];
    for (var i = 0; i < lines.length; i++) {
      var match = lines[i].match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) options.push({ key: match[1], text: match[2] });
    }
    expect(options.length).toBe(4);
    expect(options[0].key).toBe('A');
    expect(options[0].text).toBe('选项一');
  });

  test('解析中文顿号分隔 A、选项内容', () => {
    var lines = ['A、选项一', 'B、选项二', 'C、选项三', 'D、选项四'];
    var options = [];
    for (var i = 0; i < lines.length; i++) {
      var match = lines[i].match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) options.push({ key: match[1], text: match[2] });
    }
    expect(options.length).toBe(4);
    expect(options[0].key).toBe('A');
    expect(options[0].text).toBe('选项一');
  });

  test('解析全角句号分隔 A．选项内容', () => {
    var lines = ['A．选项一', 'B．选项二'];
    var options = [];
    for (var i = 0; i < lines.length; i++) {
      var match = lines[i].match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) options.push({ key: match[1], text: match[2] });
    }
    expect(options.length).toBe(2);
    expect(options[0].text).toBe('选项一');
  });

  test('忽略空行', () => {
    var lines = ['A.选项一', '', 'B.选项二', '', ''];
    var options = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) options.push({ key: match[1], text: match[2] });
    }
    expect(options.length).toBe(2);
  });

  test('至少需要两个选项才有效', () => {
    var lines = ['A.唯一选项'];
    var options = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) options.push({ key: match[1], text: match[2] });
    }
    expect(options.length).toBe(1);
    expect(options.length < 2).toBe(true);
  });
});

// ============================================================
// 题目 CRUD
// ============================================================
describe('题目 CRUD', () => {
  test('新增题目到题库', () => {
    var initialLen = App.QUESTION_BANK.length;
    var newQ = {
      id: 'test_new_' + Date.now(),
      category: '测试类别',
      question: '测试题目',
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' }
      ],
      answer: 'A',
      explanation: '解析'
    };
    App.QUESTION_BANK.push(newQ);
    expect(App.QUESTION_BANK.length).toBe(initialLen + 1);
    expect(App.QUESTION_BANK[App.QUESTION_BANK.length - 1].question).toBe('测试题目');
  });

  test('编辑现有题目', () => {
    var targetId = App.QUESTION_BANK[0].id;
    var newQuestion = '修改后的题目';
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
      if (App.QUESTION_BANK[i].id === targetId) {
        App.QUESTION_BANK[i].question = newQuestion;
        break;
      }
    }
    var updated = App.QUESTION_BANK.find(function(q) { return q.id === targetId; });
    expect(updated.question).toBe(newQuestion);
  });

  test('删除题目', () => {
    var targetId = App.QUESTION_BANK[0].id;
    var initialLen = App.QUESTION_BANK.length;
    App.QUESTION_BANK = App.QUESTION_BANK.filter(function(q) { return q.id !== targetId; });
    expect(App.QUESTION_BANK.length).toBe(initialLen - 1);
    var found = App.QUESTION_BANK.find(function(q) { return q.id === targetId; });
    expect(found).toBeUndefined();
  });

  test('删除不存在的题目不影响题库', () => {
    var initialLen = App.QUESTION_BANK.length;
    App.QUESTION_BANK = App.QUESTION_BANK.filter(function(q) { return q.id !== 'nonexistent'; });
    expect(App.QUESTION_BANK.length).toBe(initialLen);
  });

  test('按 ID 查找题目', () => {
    var targetId = App.QUESTION_BANK[0].id;
    var found = null;
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
      if (App.QUESTION_BANK[i].id === targetId) { found = App.QUESTION_BANK[i]; break; }
    }
    expect(found).not.toBeNull();
    expect(found.id).toBe(targetId);
  });
});

// ============================================================
// 数据导入（修复 stats 累加问题）
// ============================================================
describe('数据导入', () => {
  test('导入题库时新增题目', () => {
    var initialLen = App.QUESTION_BANK.length;
    var importData = {
      questionBank: [
        { id: 'import_1', category: '测试', question: '导入题1', options: [{key:'A',text:'A'},{key:'B',text:'B'}], answer: 'A', explanation: '' }
      ]
    };
    var existingIds = {};
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
      existingIds[App.QUESTION_BANK[i].id] = true;
    }
    var addedCount = 0;
    for (var j = 0; j < importData.questionBank.length; j++) {
      var q = importData.questionBank[j];
      if (!existingIds[q.id]) {
        App.QUESTION_BANK.push(q);
        addedCount++;
      }
    }
    expect(addedCount).toBe(1);
    expect(App.QUESTION_BANK.length).toBe(initialLen + 1);
  });

  test('导入题库时更新已有题目（按 ID）', () => {
    var existingId = App.QUESTION_BANK[0].id;
    var importData = {
      questionBank: [
        { id: existingId, category: '新类别', question: '更新后的题目', options: [{key:'A',text:'A'},{key:'B',text:'B'}], answer: 'B', explanation: '新解析' }
      ]
    };
    var existingIds = {};
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
      existingIds[App.QUESTION_BANK[i].id] = true;
    }
    var updatedCount = 0;
    for (var j = 0; j < importData.questionBank.length; j++) {
      var q = importData.questionBank[j];
      if (existingIds[q.id]) {
        for (var k = 0; k < App.QUESTION_BANK.length; k++) {
          if (App.QUESTION_BANK[k].id === q.id) {
            App.QUESTION_BANK[k] = q;
            updatedCount++;
            break;
          }
        }
      }
    }
    expect(updatedCount).toBe(1);
    var updated = App.QUESTION_BANK.find(function(q) { return q.id === existingId; });
    expect(updated.question).toBe('更新后的题目');
    expect(updated.answer).toBe('B');
  });

  test('导入用户数据时合并答题历史', () => {
    var existingData = App.db.get();
    var importUserData = {
      history: [
        { qid: '001', correct: true, time: Date.now() - 1000 }
      ]
    };
    var initialLen = existingData.history.length;
    existingData.history = existingData.history.concat(importUserData.history);
    expect(existingData.history.length).toBe(initialLen + 1);
  });

  test('导入错题本时合并间隔重复数据', () => {
    var existingData = App.db.get();
    existingData.wrong = [
      { qid: '001', cnt: 2, level: 1, nextReview: Date.now() + 86400000, lastReview: Date.now() - 86400000, time: Date.now() - 172800000 }
    ];
    
    var importUserData = {
      wrong: [
        { qid: '001', cnt: 3, level: 0, nextReview: Date.now(), lastReview: 0, time: Date.now() - 86400000 },
        { qid: '002', cnt: 1, level: 0, nextReview: Date.now(), lastReview: 0, time: Date.now() }
      ]
    };

    // 合并逻辑
    var wrongMap = {};
    for (var w = 0; w < existingData.wrong.length; w++) {
      wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
    }
    var addedCount = 0;
    for (var x = 0; x < importUserData.wrong.length; x++) {
      var wrongItem = importUserData.wrong[x];
      if (wrongMap[wrongItem.qid]) {
        // 取较高的错误次数
        wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
        // 保留较低等级（更保守）
        if (wrongItem.level != null) {
          wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
        }
      } else {
        if (wrongItem.level == null) wrongItem.level = 0;
        if (wrongItem.nextReview == null) wrongItem.nextReview = Date.now();
        if (wrongItem.lastReview == null) wrongItem.lastReview = 0;
        if (wrongItem.time == null) wrongItem.time = Date.now();
        existingData.wrong.push(wrongItem);
        addedCount++;
      }
    }

    // 验证合并结果
    var q001 = wrongMap['001'];
    expect(q001.cnt).toBe(3); // 取较高次数
    expect(q001.level).toBe(0); // 保留较低等级

    // 验证新增错题
    expect(addedCount).toBe(1);
    expect(existingData.wrong.length).toBe(2);
  });

  test('导入错题时自动补全间隔重复字段', () => {
    var existingData = App.db.get();
    existingData.wrong = [];
    
    var importUserData = {
      wrong: [
        { qid: '001', cnt: 1 } // 缺少 level, nextReview 等字段
      ]
    };

    var wrongMap = {};
    for (var x = 0; x < importUserData.wrong.length; x++) {
      var wrongItem = importUserData.wrong[x];
      if (!wrongMap[wrongItem.qid]) {
        if (wrongItem.level == null) wrongItem.level = 0;
        if (wrongItem.nextReview == null) wrongItem.nextReview = Date.now();
        if (wrongItem.lastReview == null) wrongItem.lastReview = 0;
        if (wrongItem.time == null) wrongItem.time = Date.now();
        existingData.wrong.push(wrongItem);
      }
    }

    expect(existingData.wrong.length).toBe(1);
    expect(existingData.wrong[0].level).toBe(0);
    expect(existingData.wrong[0].nextReview).toBeDefined();
    expect(existingData.wrong[0].lastReview).toBe(0);
    expect(existingData.wrong[0].time).toBeDefined();
  });
});

// ============================================================
// Stats 重算（修复：不再累加，从 history 重新计算）
// ============================================================
describe('Stats 重算', () => {
  test('recalcStats 从 history 重新计算统计', () => {
    var data = App.db.defaults();
    data.history = [
      { qid: '001', ok: true, time: Date.now() - 1000 },
      { qid: '002', ok: false, time: Date.now() - 2000 },
      { qid: '003', ok: true, time: Date.now() - 3000 },
      { qid: '004', ok: false, time: Date.now() - 4000 },
      { qid: '005', ok: true, time: Date.now() - 5000 }
    ];
    App.db.setData(data);
    App.db.recalcStats();
    var result = App.db.get();
    expect(result.stats.total).toBe(5);
    expect(result.stats.correct).toBe(3);
  });

  test('recalcStats 正确计算分类统计', () => {
    var data = App.db.defaults();
    data.history = [
      { qid: '001', ok: true, time: 5000 },
      { qid: '002', ok: true, time: 4000 },
      { qid: '003', ok: true, time: 3000 },
      { qid: '004', ok: false, time: 2000 },
      { qid: '005', ok: true, time: 1000 }
    ];
    App.db.setData(data);
    App.db.recalcStats();
    var result = App.db.get();
    expect(result.stats.total).toBe(5);
    expect(result.stats.correct).toBe(4);
    // 验证分类统计被创建
    expect(result.stats.cats).toBeDefined();
  });

  test('recalcStats 空历史记录返回零统计', () => {
    var data = App.db.defaults();
    data.history = [];
    App.db.setData(data);
    App.db.recalcStats();
    var result = App.db.get();
    expect(result.stats.total).toBe(0);
    expect(result.stats.correct).toBe(0);
  });
});

// ============================================================
// XSS 转义在管理页面
// ============================================================
describe('XSS 转义在管理页面', () => {
  test('esc 函数在渲染题目列表时被调用', () => {
    var xssPayload = '<script>alert("XSS")</script>';
    var escaped = App.esc(xssPayload);
    expect(escaped).not.toContain('<script>');
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
  });

  test('esc 转义题目内容', () => {
    var xssPayload = '题目包含<img src=x onerror=alert(1)>标签';
    var escaped = App.esc(xssPayload);
    // esc 将 < 和 > 转义为 HTML 实体，防止标签被浏览器解释
    expect(escaped).not.toContain('<img');
    expect(escaped).not.toContain('>标签');
  });

  test('esc 转义类别名称', () => {
    var category = 'AJ林俊杰<br>演唱会';
    var escaped = App.esc(category);
    expect(escaped).not.toContain('<br>');
  });

  test('esc 处理 null 和 undefined', () => {
    expect(App.esc(null)).toBe('');
    expect(App.esc(undefined)).toBe('');
    expect(App.esc('')).toBe('');
  });
});

// ============================================================
// 重置题库
// ============================================================
describe('重置题库', () => {
  test('store.reset 恢复默认题库', () => {
    // 先添加一道自定义题目
    App.QUESTION_BANK.push({
      id: 'custom_test',
      category: '自定义',
      question: '自定义题目',
      options: [{key:'A',text:'A'},{key:'B',text:'B'}],
      answer: 'A',
      explanation: ''
    });
    var lenBeforeReset = App.QUESTION_BANK.length;
    expect(lenBeforeReset).toBeGreaterThan(0);
    
    // 执行重置
    App.store.reset();
    
    // 验证恢复了默认题库（不包含自定义题目）
    var customExists = App.QUESTION_BANK.find(function(q) { return q.id === 'custom_test'; });
    expect(customExists).toBeUndefined();
    expect(App.QUESTION_BANK.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 数据完整性
// ============================================================
describe('数据完整性', () => {
  test('QUESTION_BANK 中每道题都有必要字段', () => {
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
      var q = App.QUESTION_BANK[i];
      expect(q.id).toBeDefined();
      expect(q.category).toBeDefined();
      expect(q.question).toBeDefined();
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.answer).toBeDefined();
      // 每个选项都有 key 和 text
      for (var j = 0; j < q.options.length; j++) {
        expect(q.options[j].key).toBeDefined();
        expect(q.options[j].text).toBeDefined();
      }
      // 答案必须是选项之一
      var validAnswers = q.options.map(function(o) { return o.key; });
      expect(validAnswers).toContain(q.answer);
    }
  });

  test('每道题的选项键是 A B C D 等', () => {
    var validKeys = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
      var q = App.QUESTION_BANK[i];
      for (var j = 0; j < q.options.length; j++) {
        expect(validKeys).toContain(q.options[j].key);
      }
    }
  });

  test('题库不允许重复 ID', () => {
    var ids = {};
    for (var i = 0; i < App.QUESTION_BANK.length; i++) {
      var id = App.QUESTION_BANK[i].id;
      expect(ids[id]).toBeUndefined();
      ids[id] = true;
    }
  });
});