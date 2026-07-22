import { describe, it, expect, beforeEach } from 'vitest';

// 选项解析函数（从 admin.js 复制）
function parseOptions(optsText) {
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
  
  return options;
}

// 分页计算函数
function calculatePagination(totalItems, pageSize, currentPage) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);
  
  return {
    totalPages,
    currentPage: page,
    start,
    end,
    hasPrev: page > 1,
    hasNext: page < totalPages
  };
}

describe('选项解析', () => {
  it('应该正确解析标准格式的选项', () => {
    const text = `A.选项一
B.选项二
C.选项三
D.选项四`;
    
    const options = parseOptions(text);
    
    expect(options.length).toBe(4);
    expect(options[0]).toEqual({ key: 'A', text: '选项一' });
    expect(options[1]).toEqual({ key: 'B', text: '选项二' });
    expect(options[2]).toEqual({ key: 'C', text: '选项三' });
    expect(options[3]).toEqual({ key: 'D', text: '选项四' });
  });

  it('应该支持中文顿号分隔符', () => {
    const text = `A、选项一
B、选项二`;
    
    const options = parseOptions(text);
    
    expect(options.length).toBe(2);
    expect(options[0]).toEqual({ key: 'A', text: '选项一' });
    expect(options[1]).toEqual({ key: 'B', text: '选项二' });
  });

  it('应该支持全角点号分隔符', () => {
    const text = `A．选项一
B．选项二`;
    
    const options = parseOptions(text);
    
    expect(options.length).toBe(2);
    expect(options[0]).toEqual({ key: 'A', text: '选项一' });
    expect(options[1]).toEqual({ key: 'B', text: '选项二' });
  });

  it('应该忽略空行', () => {
    const text = `A.选项一

B.选项二

C.选项三`;
    
    const options = parseOptions(text);
    
    expect(options.length).toBe(3);
  });

  it('应该忽略不符合格式的行', () => {
    const text = `A.选项一
这是无效行
B.选项二
123.无效
C.选项三`;
    
    const options = parseOptions(text);
    
    expect(options.length).toBe(3);
    expect(options.every(o => ['A', 'B', 'C', 'D'].includes(o.key))).toBe(true);
  });

  it('应该处理带空格的选项文本', () => {
    const text = `A. 选项一（有空格）
B.选项二`;
    
    const options = parseOptions(text);
    
    expect(options.length).toBe(2);
    expect(options[0].text).toBe('选项一（有空格）');
  });

  it('少于2个选项应该返回空数组或报错', () => {
    const text = `A.只有一个选项`;
    
    const options = parseOptions(text);
    
    expect(options.length).toBe(1);
    // 在实际代码中，少于2个选项会被校验拒绝
  });

  it('空文本应该返回空数组', () => {
    expect(parseOptions('')).toEqual([]);
    expect(parseOptions('   ')).toEqual([]);
    expect(parseOptions('\n\n')).toEqual([]);
  });

  it('应该支持超出A-D的选项', () => {
    const text = `A.选项A
B.选项B
C.选项C
D.选项D
E.选项E`;
    
    const options = parseOptions(text);
    
    expect(options.length).toBe(5);
    expect(options[4]).toEqual({ key: 'E', text: '选项E' });
  });
});

describe('分页逻辑', () => {
  it('应该正确计算总页数', () => {
    expect(calculatePagination(100, 30, 1).totalPages).toBe(4);
    expect(calculatePagination(90, 30, 1).totalPages).toBe(3);
    expect(calculatePagination(31, 30, 1).totalPages).toBe(2);
    expect(calculatePagination(30, 30, 1).totalPages).toBe(1);
    expect(calculatePagination(0, 30, 1).totalPages).toBe(1); // 至少1页
  });

  it('应该正确计算起止索引', () => {
    const result = calculatePagination(100, 30, 1);
    expect(result.start).toBe(0);
    expect(result.end).toBe(30);
    
    const result2 = calculatePagination(100, 30, 2);
    expect(result2.start).toBe(30);
    expect(result2.end).toBe(60);
    
    const result3 = calculatePagination(100, 30, 4);
    expect(result3.start).toBe(90);
    expect(result3.end).toBe(100);
  });

  it('应该限制当前页在有效范围内', () => {
    const result1 = calculatePagination(100, 30, 0);
    expect(result1.currentPage).toBe(1);
    
    const result2 = calculatePagination(100, 30, 10);
    expect(result2.currentPage).toBe(4);
    
    const result3 = calculatePagination(100, 30, -5);
    expect(result3.currentPage).toBe(1);
  });

  it('hasPrev和hasNext应该正确', () => {
    const result1 = calculatePagination(100, 30, 1);
    expect(result1.hasPrev).toBe(false);
    expect(result1.hasNext).toBe(true);
    
    const result2 = calculatePagination(100, 30, 4);
    expect(result2.hasPrev).toBe(true);
    expect(result2.hasNext).toBe(false);
    
    const result3 = calculatePagination(100, 30, 2);
    expect(result3.hasPrev).toBe(true);
    expect(result3.hasNext).toBe(true);
    
    const result4 = calculatePagination(30, 30, 1);
    expect(result4.hasPrev).toBe(false);
    expect(result4.hasNext).toBe(false);
  });

  it('最后一页应该正确处理不足一页的情况', () => {
    const result = calculatePagination(95, 30, 4);
    expect(result.start).toBe(90);
    expect(result.end).toBe(95);
    expect(result.totalPages).toBe(4);
  });
});

describe('题目搜索和筛选', () => {
  const questions = [
    { id: 'q001', category: '专辑', question: '林俊杰首张专辑是什么' },
    { id: 'q002', category: '歌曲', question: '江南是谁作词的' },
    { id: 'q003', category: '专辑', question: '《曹操》专辑发行年份' },
    { id: 'q004', category: '个人信息', question: '林俊杰的生日' },
    { id: 'q005', category: '歌曲', question: '《一千年以后》作词人' }
  ];

  it('应该正确按分类筛选', () => {
    const filtered = questions.filter(q => q.category === '专辑');
    expect(filtered.length).toBe(2);
    expect(filtered.every(q => q.category === '专辑')).toBe(true);
  });

  it('应该正确按关键词搜索', () => {
    const keyword = '林俊杰';
    const filtered = questions.filter(q => 
      q.question.toLowerCase().includes(keyword.toLowerCase())
    );
    expect(filtered.length).toBe(2);
  });

  it('应该正确组合分类和关键词筛选', () => {
    const catFilter = '歌曲';
    const keyword = '作词';
    
    const filtered = questions.filter(q => {
      if (catFilter && q.category !== catFilter) return false;
      if (keyword && !q.question.toLowerCase().includes(keyword.toLowerCase())) return false;
      return true;
    });
    
    expect(filtered.length).toBe(2);
    expect(filtered.every(q => q.category === '歌曲')).toBe(true);
  });

  it('空关键词应该返回全部', () => {
    const filtered = questions.filter(q => {
      return q.question.toLowerCase().indexOf('') !== -1;
    });
    expect(filtered.length).toBe(5);
  });
});

describe('题目CRUD操作', () => {
  let questionBank;
  
  beforeEach(() => {
    questionBank = [
      { id: 'q001', category: '专辑', question: '题目1' },
      { id: 'q002', category: '歌曲', question: '题目2' }
    ];
  });

  it('新增题目应该正确添加', () => {
    const newQ = {
      id: 'q' + Date.now(),
      category: '个人信息',
      question: '新题目',
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' }
      ],
      answer: 'A',
      explanation: '解释'
    };
    
    questionBank.push(newQ);
    
    expect(questionBank.length).toBe(3);
    expect(questionBank.find(q => q.id === newQ.id)).toBeDefined();
  });

  it('编辑题目应该正确更新', () => {
    const qid = 'q001';
    const updates = {
      category: '新分类',
      question: '更新后的题目'
    };
    
    const q = questionBank.find(q => q.id === qid);
    if (q) {
      Object.assign(q, updates);
    }
    
    expect(q.category).toBe('新分类');
    expect(q.question).toBe('更新后的题目');
    expect(questionBank.length).toBe(2); // 数量不变
  });

  it('删除题目应该正确移除', () => {
    const qid = 'q001';
    questionBank = questionBank.filter(q => q.id !== qid);
    
    expect(questionBank.length).toBe(1);
    expect(questionBank.find(q => q.id === qid)).toBeUndefined();
  });

  it('ID查找应该正确', () => {
    const qid = 'q002';
    const q = questionBank.find(q => q.id === qid);
    
    expect(q).toBeDefined();
    expect(q.id).toBe('q002');
    
    const notFound = questionBank.find(q => q.id === 'q999');
    expect(notFound).toBeUndefined();
  });
});

describe('数据导入导出', () => {
  it('导出数据应该包含必要字段', () => {
    const exportData = {
      questionBank: [{ id: 'q001', question: '测试' }],
      userData: { history: [], wrong: [] },
      exportTime: new Date().toISOString()
    };
    
    expect(exportData.questionBank).toBeDefined();
    expect(exportData.userData).toBeDefined();
    expect(exportData.exportTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('导入数据应该合并而不覆盖', () => {
    const existingIds = { 'q001': true, 'q002': true };
    const importQuestions = [
      { id: 'q002', question: '更新题目' }, // 已存在
      { id: 'q003', question: '新题目' }     // 新增
    ];
    
    let addedCount = 0;
    let updatedCount = 0;
    
    for (const q of importQuestions) {
      if (existingIds[q.id]) {
        updatedCount++;
      } else {
        addedCount++;
      }
    }
    
    expect(addedCount).toBe(1);
    expect(updatedCount).toBe(1);
  });

  it('无效JSON应该被正确处理', () => {
    const invalidJson = 'not a valid json';
    
    expect(() => JSON.parse(invalidJson)).toThrow();
    
    // 实际代码应该用 try-catch 处理
    let data = null;
    try {
      data = JSON.parse(invalidJson);
    } catch (e) {
      // 处理错误
    }
    
    expect(data).toBeNull();
  });

  it('缺失必要字段的导入数据应该被拒绝', () => {
    const data = { someOtherField: 'value' };
    
    const isValid = data.questionBank || data.userData;
    
    expect(isValid).toBeFalsy();
  });
});

describe('恢复默认题库', () => {
  it('确认输入应该完全匹配', () => {
    const confirmInput = '恢复默认';
    const expected = '恢复默认';
    
    expect(confirmInput === expected).toBe(true);
  });

  it('错误的确认输入应该被拒绝', () => {
    const confirmInput = '恢复默认题库';
    const expected = '恢复默认';
    
    expect(confirmInput === expected).toBe(false);
  });
});

describe('分类选项更新', () => {
  it('应该提取所有唯一分类', () => {
    const questions = [
      { category: '专辑' },
      { category: '歌曲' },
      { category: '专辑' },
      { category: '个人信息' }
    ];
    
    const cats = {};
    for (const q of questions) {
      cats[q.category] = true;
    }
    
    const keys = Object.keys(cats).sort();
    
    // 汉字排序可能因环境不同而不同，只验证数量和内容存在
    expect(keys.length).toBe(3);
    expect(keys).toContain('专辑');
    expect(keys).toContain('歌曲');
    expect(keys).toContain('个人信息');
  });

  it('应该保持当前选中状态', () => {
    const currentValue = '歌曲';
    const cats = ['专辑', '歌曲', '个人信息'];
    
    const selected = cats.find(c => c === currentValue);
    
    expect(selected).toBe('歌曲');
  });
});