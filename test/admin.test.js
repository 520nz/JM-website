/**
 * admin.test.js - 管理后台逻辑测试
 * 
 * 覆盖范围：
 * - 选项解析正则（saveQuestion 中的解析逻辑）
 * - 数据导入合并逻辑（importData 中的错题合并）
 * - 题库 CRUD 基本逻辑
 * - 重置确认输入验证
 */

// ==================== 选项解析逻辑 ====================
describe('saveQuestion() - 选项解析正则', () => {
  // 对应 admin.js saveQuestion() 中的解析逻辑
  function parseOptions(optsText) {
    var lines = optsText.trim().split('\n');
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
  }

  test('标准格式：A.选项内容', () => {
    var opts = parseOptions('A.选项一\nB.选项二\nC.选项三\nD.选项四');
    expect(opts).toHaveLength(4);
    expect(opts[0].key).toBe('A');
    expect(opts[0].text).toBe('选项一');
  });

  test('中文顿号分隔：A、选项内容', () => {
    var opts = parseOptions('A、选项一\nB、选项二\nC、选项三\nD、选项四');
    expect(opts).toHaveLength(4);
    expect(opts[0].key).toBe('A');
    expect(opts[0].text).toBe('选项一');
  });

  test('全角句号分隔：A．选项内容', () => {
    var opts = parseOptions('A．选项一\nB．选项二');
    expect(opts).toHaveLength(2);
  });

  test('混合分隔符', () => {
    var opts = parseOptions('A.选项一\nB、选项二\nC．选项三');
    expect(opts).toHaveLength(3);
  });

  test('空行被跳过', () => {
    var opts = parseOptions('A.选项一\n\nB.选项二\n\n\nC.选项三');
    expect(opts).toHaveLength(3);
  });

  test('前后空白被正确处理', () => {
    var opts = parseOptions('  A.选项一  \n  B.选项二  ');
    expect(opts).toHaveLength(2);
    expect(opts[0].text).toBe('选项一');
  });

  test('不正确格式被忽略', () => {
    var opts = parseOptions('选项一\nB.正确选项\n选项三');
    expect(opts).toHaveLength(1);
    expect(opts[0].key).toBe('B');
  });

  test('空输入返回空数组', () => {
    expect(parseOptions('')).toEqual([]);
    expect(parseOptions('   \n  ')).toEqual([]);
  });

  test('只输入一个选项', () => {
    var opts = parseOptions('A.唯一选项');
    expect(opts).toHaveLength(1);
    expect(opts[0].key).toBe('A');
    expect(opts[0].text).toBe('唯一选项');
  });

  test('带特殊字符的选项内容', () => {
    var opts = parseOptions('A.选项含$pecial字符&符号\nB.普通选项');
    expect(opts[0].text).toBe('选项含$pecial字符&符号');
  });
});

// ==================== 数据导入 - 错题合并逻辑 ====================
describe('importData() - 错题合并逻辑', () => {
  function mergeWrong(existingWrong, importedWrong) {
    if (!importedWrong || importedWrong.length === 0) return existingWrong;

    var wrongMap = {};
    for (var w = 0; w < existingWrong.length; w++) {
      wrongMap[existingWrong[w].qid] = existingWrong[w];
    }

    for (var x = 0; x < importedWrong.length; x++) {
      var wrongItem = importedWrong[x];
      if (wrongMap[wrongItem.qid]) {
        // 合并：取较高的错误次数
        wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
        // 保留较低等级（更保守）
        if (wrongItem.level != null) {
          wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
        }
      } else {
        // 新错题，确保有间隔重复字段
        if (!wrongItem.level) wrongItem.level = 0;
        if (!wrongItem.nextReview) wrongItem.nextReview = Date.now();
        if (!wrongItem.lastReview) wrongItem.lastReview = 0;
        if (!wrongItem.time) wrongItem.time = Date.now();
        existingWrong.push(wrongItem);
      }
    }

    return existingWrong;
  }

  test('导入空错题本', () => {
    var existing = [{ qid: '001', cnt: 2, level: 1, time: 100, lastReview: 50, nextReview: 200 }];
    var result = mergeWrong(existing, []);
    expect(result).toHaveLength(1);
  });

  test('导入全新错题', () => {
    var existing = [];
    var imported = [{ qid: '001', cnt: 3, level: 2, time: 100, lastReview: 50, nextReview: 200 }];
    var result = mergeWrong(existing, imported);
    expect(result).toHaveLength(1);
    expect(result[0].qid).toBe('001');
  });

  test('新错题缺少间隔重复字段时自动补充', () => {
    var existing = [];
    var imported = [{ qid: '001', cnt: 1 }]; // 缺少 level/nextReview/lastReview/time
    var result = mergeWrong(existing, imported);
    expect(result[0].level).toBe(0);
    expect(result[0].nextReview).toBeDefined();
    expect(result[0].lastReview).toBe(0);
    expect(result[0].time).toBeDefined();
  });

  test('合并已有错题：取较高错误次数', () => {
    var existing = [{ qid: '001', cnt: 2, level: 1, time: 100, lastReview: 50, nextReview: 200 }];
    var imported = [{ qid: '001', cnt: 5, level: 2, time: 300, lastReview: 250, nextReview: 400 }];
    var result = mergeWrong(existing, imported);
    expect(result).toHaveLength(1);
    expect(result[0].cnt).toBe(5); // 取较高值
  });

  test('合并已有错题：取较低等级', () => {
    var existing = [{ qid: '001', cnt: 2, level: 3, time: 100, lastReview: 50, nextReview: 200 }];
    var imported = [{ qid: '001', cnt: 1, level: 1, time: 300, lastReview: 250, nextReview: 400 }];
    var result = mergeWrong(existing, imported);
    expect(result[0].level).toBe(1); // 取较低等级（更保守）
  });

  test('导入的错题等级为 null 时不覆盖已有等级', () => {
    var existing = [{ qid: '001', cnt: 2, level: 3, time: 100, lastReview: 50, nextReview: 200 }];
    var imported = [{ qid: '001', cnt: 1 }]; // level 为 undefined
    var result = mergeWrong(existing, imported);
    expect(result[0].level).toBe(3); // 保留原有
  });

  test('混合场景：部分新增部分合并', () => {
    var existing = [
      { qid: '001', cnt: 2, level: 1, time: 100, lastReview: 50, nextReview: 200 },
      { qid: '002', cnt: 1, level: 0, time: 100, lastReview: 0, nextReview: 100 }
    ];
    var imported = [
      { qid: '001', cnt: 5, level: 4, time: 300, lastReview: 250, nextReview: 400 }, // 合并
      { qid: '003', cnt: 1 } // 新增
    ];
    var result = mergeWrong(existing, imported);
    expect(result).toHaveLength(3);
    expect(result[0].cnt).toBe(5); // 001 取较高次数
    expect(result[0].level).toBe(1); // 001 取较低等级
    expect(result[2].qid).toBe('003'); // 新增的 003
  });

  test('导入错题中 cnt 为 undefined 时默认处理', () => {
    var existing = [{ qid: '001', cnt: 2, level: 1, time: 100, lastReview: 50, nextReview: 200 }];
    var imported = [{ qid: '001' }]; // cnt undefined
    var result = mergeWrong(existing, imported);
    expect(result[0].cnt).toBe(2); // Math.max(2, 1) = 2
  });
});

// ==================== 导入数据完整性检查 ====================
describe('importData() - 数据完整性验证', () => {
  function validateImportData(data) {
    if (!data.questionBank && !data.userData) {
      return { valid: false, error: '文件中未找到有效数据（questionBank 或 userData）' };
    }
    return { valid: true };
  }

  test('缺少 questionBank 和 userData', () => {
    expect(validateImportData({})).toEqual({ valid: false, error: expect.any(String) });
  });

  test('只有 questionBank', () => {
    expect(validateImportData({ questionBank: [] })).toEqual({ valid: true });
  });

  test('只有 userData', () => {
    expect(validateImportData({ userData: {} })).toEqual({ valid: true });
  });

  test('两者都有', () => {
    expect(validateImportData({ questionBank: [], userData: {} })).toEqual({ valid: true });
  });
});

// ==================== 题库 CRUD 逻辑 ====================
describe('题库 CRUD - 新增和删除逻辑', () => {
  function addQuestion(bank, question) {
    bank.push(question);
    return bank;
  }

  function deleteQuestion(bank, qid) {
    return bank.filter(function(q) { return q.id !== qid; });
  }

  test('新增题目', () => {
    var bank = [];
    bank = addQuestion(bank, { id: 'q1', question: 'Q1', answer: 'A' });
    expect(bank).toHaveLength(1);
    expect(bank[0].id).toBe('q1');
  });

  test('删除存在的题目', () => {
    var bank = [
      { id: 'q1', question: 'Q1' },
      { id: 'q2', question: 'Q2' }
    ];
    bank = deleteQuestion(bank, 'q1');
    expect(bank).toHaveLength(1);
    expect(bank[0].id).toBe('q2');
  });

  test('删除不存在的题目', () => {
    var bank = [{ id: 'q1', question: 'Q1' }];
    bank = deleteQuestion(bank, 'q99');
    expect(bank).toHaveLength(1);
  });

  test('删除唯一题目', () => {
    var bank = [{ id: 'q1', question: 'Q1' }];
    bank = deleteQuestion(bank, 'q1');
    expect(bank).toHaveLength(0);
  });
});

// ==================== 重置确认输入验证 ====================
describe('resetQuestionBank() - 重置确认输入验证', () => {
  function checkResetInput(input) {
    return input === '恢复默认';
  }

  test('正确的确认词', () => {
    expect(checkResetInput('恢复默认')).toBe(true);
  });

  test('错误的确认词', () => {
    expect(checkResetInput('恢复')).toBe(false);
    expect(checkResetInput('恢复默认！')).toBe(false);
    expect(checkResetInput('RESET')).toBe(false);
    expect(checkResetInput('reset default')).toBe(false);
  });

  test('空输入', () => {
    expect(checkResetInput('')).toBe(false);
  });

  test('大小写敏感', () => {
    expect(checkResetInput('恢复默认')).toBe(true);
    expect(checkResetInput('恢复默认 ')).toBe(false); // 带空格
  });
});

// ==================== 题目筛选逻辑 ====================
describe('renderQuestionList() - 题目筛选逻辑', () => {
  function filterQuestions(bank, search, catFilter) {
    var filtered = [];
    for (var i = 0; i < bank.length; i++) {
      var q = bank[i];
      if (catFilter && q.category !== catFilter) continue;
      if (search && q.question.toLowerCase().indexOf(search) === -1) continue;
      filtered.push(q);
    }
    return filtered;
  }

  var testBank = [
    { id: '001', category: '专辑', question: '乐行者发行日期' },
    { id: '002', category: '歌曲', question: '江南的作词' },
    { id: '003', category: '专辑', question: '第二天堂' },
    { id: '004', category: '个人信息', question: '林俊杰出生日期' }
  ];

  test('无筛选条件返回全部', () => {
    expect(filterQuestions(testBank, '', '')).toHaveLength(4);
  });

  test('按分类筛选', () => {
    var result = filterQuestions(testBank, '', '专辑');
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe('专辑');
  });

  test('按搜索词筛选', () => {
    var result = filterQuestions(testBank, '江南', '');
    expect(result).toHaveLength(1);
    expect(result[0].question).toContain('江南');
  });

  test('同时按分类和搜索词筛选', () => {
    var result = filterQuestions(testBank, '发行', '专辑');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('001');
  });

  test('搜索词不区分大小写', () => {
    var result = filterQuestions(testBank, 'jiangnan', '');
    expect(result).toHaveLength(0); // 中文搜索
  });

  test('无匹配结果', () => {
    var result = filterQuestions(testBank, '不存在的词', '');
    expect(result).toHaveLength(0);
  });
});

// ==================== 分页逻辑 ====================
describe('renderQuestionList() - 分页逻辑', () => {
  function paginate(items, page, pageSize) {
    var totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * pageSize;
    var end = Math.min(start + pageSize, items.length);
    return {
      totalPages: totalPages,
      page: page,
      items: items.slice(start, end)
    };
  }

  test('不足一页', () => {
    var result = paginate([1, 2, 3], 1, 30);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(3);
  });

  test('多页分页', () => {
    var items = [];
    for (var i = 0; i < 75; i++) items.push(i);
    var page1 = paginate(items, 1, 30);
    expect(page1.totalPages).toBe(3);
    expect(page1.items).toHaveLength(30);
    expect(page1.items[0]).toBe(0);

    var page2 = paginate(items, 2, 30);
    expect(page2.items).toHaveLength(30);
    expect(page2.items[0]).toBe(30);

    var page3 = paginate(items, 3, 30);
    expect(page3.items).toHaveLength(15);
    expect(page3.items[0]).toBe(60);
  });

  test('超出页码范围自动修正', () => {
    var items = [1, 2, 3];
    var result = paginate(items, 10, 30);
    expect(result.page).toBe(1); // 修正到第一页
  });

  test('零条数据', () => {
    var result = paginate([], 1, 30);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(0);
  });
});
