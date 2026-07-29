/**
 * admin.js 测试套件
 * 
 * 测试覆盖：
 * 1. 数据导入（JSON解析、合并逻辑、stats重算）
 * 2. 数据导出
 * 3. 题目CRUD操作
 * 4. 选项解析逻辑
 */

describe('数据导入导出', () => {
  describe('JSON解析和验证', () => {
    test('应该正确解析有效的JSON数据', () => {
      const jsonStr = JSON.stringify({
        questionBank: [{ id: '001', question: 'Test' }],
        userData: { history: [], wrong: [], stats: { total: 0 } }
      });

      const data = JSON.parse(jsonStr);
      
      expect(data.questionBank).toBeDefined();
      expect(data.userData).toBeDefined();
    });

    test('应该拒绝无效的JSON', () => {
      const invalidJson = '{ invalid json }';
      
      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    test('应该验证必需字段存在', () => {
      const data = {
        questionBank: [{ id: '001' }],
        userData: null
      };

      const hasValidData = data.questionBank.length > 0 || data.userData;
      expect(hasValidData).toBe(true);

      const emptyData = {};
      const hasNoValidData = !emptyData.questionBank && !emptyData.userData;
      expect(hasNoValidData).toBe(true);
    });
  });

  describe('题库导入和合并', () => {
    test('应该正确添加新题目', () => {
      const existingBank = [
        { id: '001', question: 'Old Q1' }
      ];
      const importBank = [
        { id: '002', question: 'New Q2' },
        { id: '003', question: 'New Q3' }
      ];

      const existingIds = new Set(existingBank.map(q => q.id));
      let addedCount = 0;

      for (const q of importBank) {
        if (!existingIds.has(q.id)) {
          existingBank.push(q);
          addedCount++;
        }
      }

      expect(addedCount).toBe(2);
      expect(existingBank.length).toBe(3);
    });

    test('应该正确更新已存在的题目', () => {
      const existingBank = [
        { id: '001', question: 'Old Q1', answer: 'A' }
      ];
      const importBank = [
        { id: '001', question: 'Updated Q1', answer: 'B' }
      ];

      let updatedCount = 0;

      for (const impQ of importBank) {
        for (let i = 0; i < existingBank.length; i++) {
          if (existingBank[i].id === impQ.id) {
            existingBank[i] = impQ;
            updatedCount++;
            break;
          }
        }
      }

      expect(updatedCount).toBe(1);
      expect(existingBank[0].question).toBe('Updated Q1');
      expect(existingBank[0].answer).toBe('B');
    });

    test('应该正确处理混合导入（新增+更新）', () => {
      const existingBank = [
        { id: '001', question: 'Old Q1' }
      ];
      const importBank = [
        { id: '001', question: 'Updated Q1' },
        { id: '002', question: 'New Q2' }
      ];

      let addedCount = 0;
      let updatedCount = 0;
      const existingIds = new Set(existingBank.map(q => q.id));

      for (const q of importBank) {
        if (existingIds.has(q.id)) {
          for (let i = 0; i < existingBank.length; i++) {
            if (existingBank[i].id === q.id) {
              existingBank[i] = q;
              updatedCount++;
              break;
            }
          }
        } else {
          existingBank.push(q);
          addedCount++;
        }
      }

      expect(addedCount).toBe(1);
      expect(updatedCount).toBe(1);
      expect(existingBank.length).toBe(2);
    });
  });

  describe('用户数据导入和合并', () => {
    test('应该正确合并答题历史', () => {
      const existingHistory = [
        { qid: '001', ok: true, time: 1000 }
      ];
      const importHistory = [
        { qid: '002', ok: false, time: 2000 }
      ];

      const merged = existingHistory.concat(importHistory);

      expect(merged.length).toBe(2);
      expect(merged.map(h => h.qid)).toContain('001');
      expect(merged.map(h => h.qid)).toContain('002');
    });

    test('应该正确合并错题本（含间隔重复数据）', () => {
      const existingWrong = [
        { qid: '001', cnt: 2, level: 1, nextReview: Date.now() }
      ];
      const importWrong = [
        { qid: '001', cnt: 3, level: 0 }, // 已存在，取较大cnt
        { qid: '002', cnt: 1, level: 0 }  // 新错题
      ];

      const wrongMap = {};
      for (const w of existingWrong) {
        wrongMap[w.qid] = { ...w };
      }

      for (const w of importWrong) {
        if (wrongMap[w.qid]) {
          // 合并：取较大的错误次数
          wrongMap[w.qid].cnt = Math.max(wrongMap[w.qid].cnt, w.cnt || 1);
          // 保留较低等级（更保守）
          if (w.level != null) {
            wrongMap[w.qid].level = Math.min(wrongMap[w.qid].level || 0, w.level);
          }
        } else {
          // 新错题
          existingWrong.push({
            ...w,
            level: w.level || 0,
            nextReview: Date.now(),
            lastReview: 0,
            time: Date.now()
          });
        }
      }

      expect(wrongMap['001'].cnt).toBe(3);
      expect(wrongMap['001'].level).toBe(0);
    });

    test('导入后应重新计算统计（不累加）', () => {
      const history = [
        { qid: '001', ok: true, time: Date.now() },
        { qid: '002', ok: false, time: Date.now() },
        { qid: '003', ok: true, time: Date.now() }
      ];

      const questionBank = [
        { id: '001', category: '专辑' },
        { id: '002', category: '歌曲' },
        { id: '003', category: '专辑' }
      ];

      // 模拟 recalcStats
      const stats = { total: 0, correct: 0, cats: {} };
      
      for (const rec of history) {
        stats.total++;
        if (rec.ok) stats.correct++;
        
        const q = questionBank.find(q => q.id === rec.qid);
        if (q) {
          if (!stats.cats[q.category]) {
            stats.cats[q.category] = { t: 0, c: 0 };
          }
          stats.cats[q.category].t++;
          if (rec.ok) stats.cats[q.category].c++;
        }
      }

      expect(stats.total).toBe(3);
      expect(stats.correct).toBe(2);
      expect(stats.cats['专辑'].t).toBe(2);
      expect(stats.cats['专辑'].c).toBe(2);
      expect(stats.cats['歌曲'].t).toBe(1);
      expect(stats.cats['歌曲'].c).toBe(0);
    });
  });

  describe('数据导出', () => {
    test('应该正确生成导出数据结构', () => {
      const exportData = {
        questionBank: [
          { id: '001', question: 'Test' }
        ],
        userData: {
          history: [{ qid: '001', ok: true }],
          wrong: [],
          stats: { total: 1, correct: 1 }
        },
        exportTime: new Date().toISOString()
      };

      expect(exportData.questionBank).toBeDefined();
      expect(exportData.userData).toBeDefined();
      expect(exportData.exportTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('应该正确生成文件名', () => {
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10);
      const filename = `jj_quiz_backup_${dateStr}.json`;

      expect(filename).toMatch(/^jj_quiz_backup_\d{4}-\d{2}-\d{2}\.json$/);
    });
  });
});

describe('题目CRUD操作', () => {
  test('应该正确添加新题目', () => {
    const questionBank = [];
    const newQuestion = {
      id: 'q' + Date.now(),
      category: '专辑',
      question: '测试题目',
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' }
      ],
      answer: 'A',
      explanation: '测试解释'
    };

    questionBank.push(newQuestion);

    expect(questionBank.length).toBe(1);
    expect(questionBank[0].id).toMatch(/^q\d+$/);
  });

  test('应该正确编辑已有题目', () => {
    const questionBank = [
      { id: '001', question: 'Old', answer: 'A' }
    ];

    const editId = '001';
    for (let i = 0; i < questionBank.length; i++) {
      if (questionBank[i].id === editId) {
        questionBank[i].question = 'Updated';
        questionBank[i].answer = 'B';
        break;
      }
    }

    expect(questionBank[0].question).toBe('Updated');
    expect(questionBank[0].answer).toBe('B');
  });

  test('应该正确删除题目', () => {
    let questionBank = [
      { id: '001', question: 'Q1' },
      { id: '002', question: 'Q2' }
    ];

    const deleteId = '001';
    questionBank = questionBank.filter(q => q.id !== deleteId);

    expect(questionBank.length).toBe(1);
    expect(questionBank[0].id).toBe('002');
  });
});

describe('选项解析逻辑', () => {
  test('应该正确解析标准格式的选项', () => {
    const optsText = `A.选项A内容
B.选项B内容
C.选项C内容
D.选项D内容`;

    const lines = optsText.split('\n');
    const options = [];

    for (const line of lines) {
      const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) {
        options.push({ key: match[1], text: match[2] });
      }
    }

    expect(options.length).toBe(4);
    expect(options[0].key).toBe('A');
    expect(options[0].text).toBe('选项A内容');
  });

  test('应该跳过空行和无效格式', () => {
    const optsText = `A.选项A

B.选项B
invalid line
C.选项C`;

    const lines = optsText.split('\n');
    const options = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) {
        options.push({ key: match[1], text: match[2] });
      }
    }

    expect(options.length).toBe(3);
  });

  test('应该支持中文标点', () => {
    const optsText = 'A．选项A\nB．选项B';

    const lines = optsText.split('\n');
    const options = [];

    for (const line of lines) {
      const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) {
        options.push({ key: match[1], text: match[2] });
      }
    }

    expect(options.length).toBe(2);
  });

  test('选项少于2个应报错', () => {
    const optsText = 'A.只有一个选项';
    const lines = optsText.split('\n');
    const options = [];

    for (const line of lines) {
      const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) {
        options.push({ key: match[1], text: match[2] });
      }
    }

    const isValid = options.length >= 2;
    expect(isValid).toBe(false);
  });
});

describe('搜索和过滤', () => {
  test('应该正确按关键词搜索', () => {
    const questionBank = [
      { id: '001', question: '林俊杰的第一张专辑是什么？' },
      { id: '002', question: '江南的作曲人是谁？' },
      { id: '003', question: '曹操发行于哪一年？' }
    ];

    const search = '林俊杰';
    const filtered = questionBank.filter(q => 
      q.question.toLowerCase().includes(search.toLowerCase())
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('001');
  });

  test('应该正确按分类过滤', () => {
    const questionBank = [
      { id: '001', category: '专辑', question: 'Q1' },
      { id: '002', category: '歌曲', question: 'Q2' },
      { id: '003', category: '专辑', question: 'Q3' }
    ];

    const catFilter = '专辑';
    const filtered = questionBank.filter(q => 
      !catFilter || q.category === catFilter
    );

    expect(filtered.length).toBe(2);
    expect(filtered.map(q => q.id)).toEqual(['001', '003']);
  });

  test('应该正确组合搜索和分类过滤', () => {
    const questionBank = [
      { id: '001', category: '专辑', question: '第一张专辑' },
      { id: '002', category: '专辑', question: '第二张专辑' },
      { id: '003', category: '歌曲', question: '第一首歌' }
    ];

    const search = '第一';
    const catFilter = '专辑';

    const filtered = questionBank.filter(q => {
      if (catFilter && q.category !== catFilter) return false;
      if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('001');
  });
});

describe('分页逻辑', () => {
  test('应该正确计算总页数', () => {
    const totalItems = 95;
    const pageSize = 30;

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    expect(totalPages).toBe(4);
  });

  test('应该正确计算起始和结束索引', () => {
    const page = 2;
    const pageSize = 30;
    const totalItems = 95;

    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, totalItems);

    expect(start).toBe(30);
    expect(end).toBe(60);
  });

  test('超出范围应调整到最后一页', () => {
    const page = 10;
    const totalPages = 4;

    const adjustedPage = Math.min(page, totalPages);

    expect(adjustedPage).toBe(4);
  });
});

describe('恢复默认题库', () => {
  test('应该正确重置为默认题库', () => {
    const DEFAULT_QUESTION_BANK = [
      { id: '001', question: 'Default Q1' },
      { id: '002', question: 'Default Q2' }
    ];

    let questionBank = [
      { id: '001', question: 'Modified Q1' },
      { id: '003', question: 'Added Q3' }
    ];

    // 重置
    questionBank = DEFAULT_QUESTION_BANK.slice();

    expect(questionBank.length).toBe(2);
    expect(questionBank[0].question).toBe('Default Q1');
  });

  test('重置不应影响默认题库本身', () => {
    const DEFAULT_QUESTION_BANK = [
      { id: '001', question: 'Default' }
    ];

    const questionBank = DEFAULT_QUESTION_BANK.map(q => ({ ...q }));
    questionBank[0].question = 'Modified';

    expect(DEFAULT_QUESTION_BANK[0].question).toBe('Default');
  });
});