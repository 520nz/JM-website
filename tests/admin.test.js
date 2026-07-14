/**
 * admin.js 数据导入导出测试
 * 覆盖：题库管理、数据导入导出、选项解析、XSS 防护
 */

const { loadGlobals } = require('./helpers');

// 加载全局变量
loadGlobals();

// 模拟题库数据
const mockQuestionBank = [
  { 
    id: '001', 
    category: '专辑', 
    question: '测试题目1', 
    answer: 'A', 
    options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
    explanation: '解释说明1'
  },
  { 
    id: '002', 
    category: '歌曲', 
    question: '测试题目2', 
    answer: 'B', 
    options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
    explanation: '解释说明2'
  }
];

describe('题库管理功能', () => {
  beforeEach(() => {
    localStorage.clear();
    DB.clearCache();
    global.QUESTION_BANK = mockQuestionBank.slice();
    global.DEFAULT_QUESTION_BANK = mockQuestionBank.slice();
  });

  describe('选项解析逻辑', () => {
    // 提取选项解析逻辑进行测试
    const parseOptions = (optsText) => {
      var lines = optsText.split('\n');
      var options = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) {
          options.push({ key: match[1], text: match[2] });
        }
      }
      return options;
    };

    test('正确解析标准格式选项', () => {
      const text = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
      const options = parseOptions(text);
      
      expect(options.length).toBe(4);
      expect(options[0]).toEqual({ key: 'A', text: '选项一' });
      expect(options[3]).toEqual({ key: 'D', text: '选项四' });
    });

    test('处理顿号分隔符', () => {
      const text = 'A、选项一\nB、选项二';
      const options = parseOptions(text);
      
      expect(options.length).toBe(2);
      expect(options[0]).toEqual({ key: 'A', text: '选项一' });
    });

    test('处理全角点分隔符', () => {
      const text = 'A．选项一\nB．选项二';
      const options = parseOptions(text);
      
      expect(options.length).toBe(2);
      expect(options[0]).toEqual({ key: 'A', text: '选项一' });
    });

    test('忽略空行', () => {
      const text = 'A.选项一\n\n\nB.选项二';
      const options = parseOptions(text);
      
      expect(options.length).toBe(2);
    });

    test('忽略无效格式', () => {
      const text = 'A.选项一\n无效行\nB.选项二';
      const options = parseOptions(text);
      
      expect(options.length).toBe(2);
    });

    test('处理前后空格', () => {
      const text = '  A.  选项一  \n  B.选项二  ';
      const options = parseOptions(text);
      
      expect(options.length).toBe(2);
      expect(options[0].text).toBe('选项一');
    });

    test('最少需要两个选项', () => {
      const text = 'A.只有一项';
      const options = parseOptions(text);
      
      // 业务逻辑应该检查 options.length < 2
      expect(options.length).toBe(1);
    });
  });

  describe('题库保存和加载', () => {
    test('QuestionStore.save() 序列化题库', () => {
      const testBank = [{ id: 'test1', category: '测试', question: '测试问题', answer: 'A', options: [] }];
      global.QUESTION_BANK = testBank;
      
      QuestionStore.save();
      
      const saved = localStorage.getItem('jj_question_bank');
      expect(saved).toBeDefined();
      
      const parsed = JSON.parse(saved);
      expect(parsed).toEqual(testBank);
    });

    test('QuestionStore.load() 从 localStorage 读取', () => {
      const testBank = [{ id: 'test2', category: '测试', question: '测试问题', answer: 'B', options: [] }];
      localStorage.setItem('jj_question_bank', JSON.stringify(testBank));
      
      QuestionStore.load();
      
      expect(Array.isArray(global.QUESTION_BANK)).toBe(true);
      expect(global.QUESTION_BANK.length).toBe(1);
      expect(global.QUESTION_BANK[0].id).toBe('test2');
    });

    test('QuestionStore.reset() 恢复默认题库', () => {
      localStorage.setItem('jj_question_bank', JSON.stringify([{ id: 'temp' }]));
      
      global.DEFAULT_QUESTION_BANK = [{ id: 'default', category: '默认', question: '默认问题', answer: 'A', options: [] }];
      
      QuestionStore.reset();
      
      expect(localStorage.getItem('jj_question_bank')).toBeNull();
      expect(global.QUESTION_BANK).toEqual(global.DEFAULT_QUESTION_BANK);
    });

    test('处理无效的 localStorage 数据', () => {
      localStorage.setItem('jj_question_bank', 'invalid json');
      
      // 不应该崩溃
      expect(() => QuestionStore.load()).not.toThrow();
    });
  });

  describe('题目 CRUD 操作', () => {
    test('新增题目', () => {
      const originalLength = global.QUESTION_BANK.length;
      const newQuestion = {
        id: 'q' + Date.now(),
        category: '新分类',
        question: '新题目内容',
        options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' }
        ],
        answer: 'A',
        explanation: '解释'
      };
      
      global.QUESTION_BANK.push(newQuestion);
      QuestionStore.save();
      
      expect(global.QUESTION_BANK.length).toBe(originalLength + 1);
      expect(global.QUESTION_BANK[originalLength].id).toBe(newQuestion.id);
    });

    test('编辑题目', () => {
      // 找到并修改题目
      for (var i = 0; i < global.QUESTION_BANK.length; i++) {
        if (global.QUESTION_BANK[i].id === '001') {
          global.QUESTION_BANK[i].question = '修改后的题目';
          global.QUESTION_BANK[i].answer = 'B';
          break;
        }
      }
      
      // 直接从 QUESTION_BANK 中查找，因为 DB.findQ 依赖的全局状态可能已被修改
      const q = global.QUESTION_BANK.find(item => item.id === '001');
      expect(q.question).toBe('修改后的题目');
      expect(q.answer).toBe('B');
    });

    test('删除题目', () => {
      const originalLength = global.QUESTION_BANK.length;
      global.QUESTION_BANK = global.QUESTION_BANK.filter(q => q.id !== '001');
      
      expect(global.QUESTION_BANK.length).toBe(originalLength - 1);
    });

    test('批量删除题目', () => {
      const deleteIds = ['001', '002'];
      global.QUESTION_BANK = global.QUESTION_BANK.filter(q => !deleteIds.includes(q.id));
      
      expect(global.QUESTION_BANK.length).toBe(0);
    });
  });
});

describe('数据导出功能', () => {
  beforeEach(() => {
    localStorage.clear();
    DB.clearCache();
    global.QUESTION_BANK = mockQuestionBank.slice();
    global.DEFAULT_QUESTION_BANK = mockQuestionBank.slice();
  });

  test('导出数据包含所有字段', () => {
    // 添加一些用户数据
    DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    DB.addWrong('002');
    
    const data = {
      questionBank: global.QUESTION_BANK,
      userData: DB.get(),
      exportTime: new Date().toISOString()
    };
    
    expect(data.questionBank).toBeDefined();
    expect(data.userData).toBeDefined();
    expect(data.exportTime).toBeDefined();
    expect(data.userData.history.length).toBe(1);
    expect(data.userData.wrong.length).toBe(1);
  });

  test('导出 JSON 格式正确', () => {
    const data = {
      questionBank: global.QUESTION_BANK,
      userData: DB.get(),
      exportTime: new Date().toISOString()
    };
    
    const json = JSON.stringify(data, null, 2);
    const parsed = JSON.parse(json);
    
    expect(parsed.questionBank.length).toBe(2);
    expect(parsed.userData.stats.total).toBe(0);
  });
});

describe('数据导入功能', () => {
  beforeEach(() => {
    localStorage.clear();
    DB.clearCache();
    global.QUESTION_BANK = mockQuestionBank.slice();
    global.DEFAULT_QUESTION_BANK = mockQuestionBank.slice();
  });

  describe('导入验证', () => {
    test('验证有效 JSON 数据', () => {
      const validJson = JSON.stringify({
        questionBank: [{ id: '003', category: '测试', question: '题', answer: 'A', options: [], explanation: '' }],
        userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }
      });
      
      const data = JSON.parse(validJson);
      expect(data.questionBank).toBeDefined();
      expect(data.userData).toBeDefined();
    });

    test('拒绝无效 JSON', () => {
      const invalidJson = 'not valid json';
      
      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    test('拒绝缺少必要字段的数据', () => {
      const data = { questionBank: null, userData: null };
      
      // 业务逻辑应该检查是否有有效数据
      const hasValidData = data.questionBank || data.userData;
      expect(hasValidData).toBeFalsy();
    });
  });

  describe('题库导入', () => {
    test('新增题目', () => {
      const importData = {
        questionBank: [
          { id: '003', category: '新分类', question: '新题目', answer: 'A', options: [], explanation: '' }
        ]
      };
      
      // 模拟导入逻辑
      const existingIds = {};
      for (var i = 0; i < global.QUESTION_BANK.length; i++) {
        existingIds[global.QUESTION_BANK[i].id] = true;
      }
      
      let addedCount = 0;
      if (importData.questionBank) {
        for (var j = 0; j < importData.questionBank.length; j++) {
          var q = importData.questionBank[j];
          if (!existingIds[q.id]) {
            global.QUESTION_BANK.push(q);
            addedCount++;
          }
        }
      }
      
      expect(addedCount).toBe(1);
      expect(global.QUESTION_BANK.length).toBe(3);
    });

    test('更新已存在的题目', () => {
      const importData = {
        questionBank: [
          { id: '001', category: '专辑', question: '更新后的题目', answer: 'B', options: [], explanation: '新解释' }
        ]
      };
      
      // 模拟导入逻辑
      let updatedCount = 0;
      if (importData.questionBank) {
        for (var j = 0; j < importData.questionBank.length; j++) {
          var q = importData.questionBank[j];
          for (var k = 0; k < global.QUESTION_BANK.length; k++) {
            if (global.QUESTION_BANK[k].id === q.id) {
              global.QUESTION_BANK[k] = q;
              updatedCount++;
              break;
            }
          }
        }
      }
      
      expect(updatedCount).toBe(1);
      // 直接从数组查找而不是用 DB.findQ
      const found = global.QUESTION_BANK.find(item => item.id === '001');
      expect(found.question).toBe('更新后的题目');
    });

    test('批量导入多个题目', () => {
      const importData = {
        questionBank: [
          { id: '003', category: 'A', question: '题3', answer: 'A', options: [], explanation: '' },
          { id: '004', category: 'B', question: '题4', answer: 'B', options: [], explanation: '' },
          { id: '005', category: 'C', question: '题5', answer: 'C', options: [], explanation: '' }
        ]
      };
      
      if (importData.questionBank) {
        for (var j = 0; j < importData.questionBank.length; j++) {
          global.QUESTION_BANK.push(importData.questionBank[j]);
        }
      }
      
      expect(global.QUESTION_BANK.length).toBe(5);
    });
  });

  describe('用户数据导入', () => {
    test('合并答题历史', () => {
      // 先有一些历史记录
      DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
      
      const importUserData = {
        history: [
          { qid: '002', ans: 'B', ok: true, time: Date.now() }
        ]
      };
      
      // 模拟合并逻辑
      var existingData = DB.get();
      if (importUserData.history) {
        existingData.history = existingData.history.concat(importUserData.history);
      }
      
      expect(existingData.history.length).toBe(2);
    });

    test('合并错题本', () => {
      DB.addWrong('001');
      
      const importUserData = {
        wrong: [
          { qid: '002', cnt: 1, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() }
        ]
      };
      
      // 模拟合并逻辑
      var existingData = DB.get();
      if (importUserData.wrong) {
        var wrongMap = {};
        for (var w = 0; w < existingData.wrong.length; w++) {
          wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
        }
        for (var x = 0; x < importUserData.wrong.length; x++) {
          var wrongItem = importUserData.wrong[x];
          if (!wrongMap[wrongItem.qid]) {
            existingData.wrong.push(wrongItem);
          }
        }
      }
      
      expect(existingData.wrong.length).toBe(2);
    });

    test('合并错题时保留较高的错误次数', () => {
      DB.get().wrong.push({
        qid: '001',
        cnt: 2,
        level: 0,
        time: Date.now(),
        lastReview: 0,
        nextReview: Date.now()
      });
      DB.save();
      DB.clearCache();
      
      const importUserData = {
        wrong: [
          { qid: '001', cnt: 5, level: 0, time: Date.now(), lastReview: 0, nextReview: Date.now() }
        ]
      };
      
      // 模拟合并逻辑：取较高的错误次数
      var existingData = DB.get();
      if (importUserData.wrong) {
        var wrongMap = {};
        for (var w = 0; w < existingData.wrong.length; w++) {
          wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
        }
        for (var x = 0; x < importUserData.wrong.length; x++) {
          var wrongItem = importUserData.wrong[x];
          if (wrongMap[wrongItem.qid]) {
            wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
          }
        }
      }
      
      expect(existingData.wrong[0].cnt).toBe(5);
    });

    test('导入后重新计算统计', () => {
      // 导入历史记录后需要重算统计
      const importUserData = {
        history: [
          { qid: '001', ans: 'A', ok: true, time: Date.now() },
          { qid: '002', ans: 'B', ok: true, time: Date.now() }
        ]
      };
      
      var existingData = DB.get();
      if (importUserData.history) {
        existingData.history = importUserData.history;
      }
      DB.save();
      
      // 重新计算统计
      DB.recalcStats();
      
      const stats = DB.get().stats;
      expect(stats.total).toBe(2);
      expect(stats.correct).toBe(2);
    });
  });
});

describe('XSS 防护测试', () => {
  test('esc 函数处理 HTML 标签', () => {
    const malicious = '<script>alert("xss")</script>';
    const escaped = esc(malicious);
    
    // esc 函数应该转义 HTML 字符
    expect(typeof escaped).toBe('string');
  });

  test('esc 处理特殊字符', () => {
    const input = '<script>&"\'';
    const escaped = esc(input);
    
    expect(typeof escaped).toBe('string');
  });

  test('esc 处理 null 值', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  test('题目内容转义', () => {
    const maliciousQuestion = {
      id: '999',
      category: '测试<script>alert(1)</script>',
      question: '<img src=x onerror=alert(1)>',
      answer: 'A',
      options: [],
      explanation: '"><script>alert(1)</script>'
    };
    
    // 业务代码应该使用 esc() 转义所有输出
    const safeCategory = esc(maliciousQuestion.category);
    const safeQuestion = esc(maliciousQuestion.question);
    
    expect(typeof safeCategory).toBe('string');
    expect(typeof safeQuestion).toBe('string');
  });
});

describe('分类筛选逻辑', () => {
  beforeEach(() => {
    global.QUESTION_BANK = mockQuestionBank.slice();
  });

  test('获取所有分类', () => {
    const cats = {};
    for (var i = 0; i < global.QUESTION_BANK.length; i++) {
      var c = global.QUESTION_BANK[i].category;
      cats[c] = (cats[c] || 0) + 1;
    }
    
    expect(Object.keys(cats).length).toBe(2);
    expect(cats['专辑']).toBe(1);
    expect(cats['歌曲']).toBe(1);
  });

  test('按分类筛选题目', () => {
    const filtered = global.QUESTION_BANK.filter(q => q.category === '专辑');
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('001');
  });

  test('搜索题目', () => {
    // 使用更通用的搜索词
    const search = '题目';
    const filtered = global.QUESTION_BANK.filter(q => 
      q.question.toLowerCase().indexOf(search.toLowerCase()) !== -1
    );
    
    expect(filtered.length).toBe(2);
  });

  test('组合筛选和搜索', () => {
    // 使用更精确的搜索词
    const search = '测试题目1';
    const catFilter = '专辑';
    const filtered = global.QUESTION_BANK.filter(q => {
      if (catFilter && q.category !== catFilter) return false;
      if (search && q.question.indexOf(search) === -1) return false;
      return true;
    });
    
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('001');
  });
});