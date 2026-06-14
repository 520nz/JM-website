/**
 * 题库管理模块测试
 */

const { QuestionBankManager } = require('../../src/questionBank.js');

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

// 测试用题库
const mockQuestionBank = [
  { id: '001', category: '专辑', question: '题目1', options: [{ key: 'A', text: 'A' }], answer: 'A' },
  { id: '002', category: '歌曲', question: '题目2', options: [{ key: 'B', text: 'B' }], answer: 'B' },
  { id: '003', category: '专辑', question: '题目3', options: [{ key: 'C', text: 'C' }], answer: 'C' },
  { id: '004', category: '个人信息', question: '题目4', options: [{ key: 'D', text: 'D' }], answer: 'D' }
];

describe('QuestionBankManager', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('save和load', () => {
    test('保存后应能正确加载', () => {
      QuestionBankManager.save(mockQuestionBank);
      const loaded = QuestionBankManager.load([]);
      
      expect(loaded.length).toBe(4);
      expect(loaded[0].id).toBe('001');
    });

    test('无保存数据时应返回默认题库', () => {
      const loaded = QuestionBankManager.load(mockQuestionBank);
      
      expect(loaded.length).toBe(4);
    });

    test('加载损坏数据应返回默认题库', () => {
      localStorageMock.setItem('jj_question_bank', 'invalid json');
      const loaded = QuestionBankManager.load(mockQuestionBank);
      
      expect(loaded.length).toBe(4);
    });
  });

  describe('add', () => {
    test('应正确添加新题目', () => {
      const newQ = { id: '005', category: '专辑', question: '新题目', options: [], answer: 'A' };
      const result = QuestionBankManager.add(mockQuestionBank, newQ);
      
      expect(result.length).toBe(5);
      expect(result[4].id).toBe('005');
    });

    test('添加不应影响原数组', () => {
      const newQ = { id: '005', category: '专辑', question: '新题目', options: [], answer: 'A' };
      QuestionBankManager.add(mockQuestionBank, newQ);
      
      expect(mockQuestionBank.length).toBe(4);
    });
  });

  describe('update', () => {
    test('应正确更新题目', () => {
      const newData = { question: '更新后的题目' };
      const result = QuestionBankManager.update(mockQuestionBank, '001', newData);
      
      expect(result[0].question).toBe('更新后的题目');
      expect(result[0].id).toBe('001');
    });

    test('更新不存在的题目应无变化', () => {
      const result = QuestionBankManager.update(mockQuestionBank, '999', { question: '新题目' });
      
      expect(result).toEqual(mockQuestionBank);
    });
  });

  describe('delete', () => {
    test('应正确删除题目', () => {
      const result = QuestionBankManager.delete(mockQuestionBank, '001');
      
      expect(result.length).toBe(3);
      expect(result.find(q => q.id === '001')).toBeUndefined();
    });

    test('删除不存在的题目应无变化', () => {
      const result = QuestionBankManager.delete(mockQuestionBank, '999');
      
      expect(result.length).toBe(4);
    });
  });

  describe('getCategories', () => {
    test('应返回所有分类', () => {
      const cats = QuestionBankManager.getCategories(mockQuestionBank);
      
      expect(cats).toContain('专辑');
      expect(cats).toContain('歌曲');
      expect(cats).toContain('个人信息');
    });

    test('分类应按字母排序', () => {
      const cats = QuestionBankManager.getCategories(mockQuestionBank);
      
      expect(cats).toEqual(['专辑', '个人信息', '歌曲']);
    });

    test('空题库应返回空数组', () => {
      const cats = QuestionBankManager.getCategories([]);
      
      expect(cats).toEqual([]);
    });
  });

  describe('filterByCategory', () => {
    test('应正确筛选分类', () => {
      const result = QuestionBankManager.filterByCategory(mockQuestionBank, '专辑');
      
      expect(result.length).toBe(2);
      expect(result.every(q => q.category === '专辑')).toBe(true);
    });

    test('空分类应返回全部', () => {
      const result = QuestionBankManager.filterByCategory(mockQuestionBank, '');
      
      expect(result.length).toBe(4);
    });

    test('不存在的分类应返回空数组', () => {
      const result = QuestionBankManager.filterByCategory(mockQuestionBank, '不存在的分类');
      
      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    test('应正确搜索题目', () => {
      const result = QuestionBankManager.search(mockQuestionBank, '题目1');
      
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('001');
    });

    test('搜索应不区分大小写', () => {
      const result = QuestionBankManager.search(mockQuestionBank, '题目');
      
      expect(result.length).toBe(4);
    });

    test('空关键词应返回全部', () => {
      const result = QuestionBankManager.search(mockQuestionBank, '');
      
      expect(result.length).toBe(4);
    });

    test('无匹配应返回空数组', () => {
      const result = QuestionBankManager.search(mockQuestionBank, '不存在的关键词');
      
      expect(result).toEqual([]);
    });
  });

  describe('reset', () => {
    test('应重置为默认题库', () => {
      QuestionBankManager.save(mockQuestionBank);
      const result = QuestionBankManager.reset(mockQuestionBank);
      
      expect(result.length).toBe(4);
    });
  });

  describe('import', () => {
    test('应正确导入新题目', () => {
      const importData = [
        { id: '005', category: '新分类', question: '新题目', options: [], answer: 'A' }
      ];
      
      const result = QuestionBankManager.import(mockQuestionBank, importData);
      
      expect(result.bank.length).toBe(5);
      expect(result.added).toBe(1);
      expect(result.updated).toBe(0);
    });

    test('应正确更新已存在的题目', () => {
      const importData = [
        { id: '001', category: '专辑', question: '更新的题目', options: [], answer: 'A' }
      ];
      
      const result = QuestionBankManager.import(mockQuestionBank, importData);
      
      expect(result.bank.length).toBe(4);
      expect(result.added).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.bank[0].question).toBe('更新的题目');
    });

    test('混合导入应正确统计', () => {
      const importData = [
        { id: '001', category: '专辑', question: '更新的题目', options: [], answer: 'A' },
        { id: '005', category: '新分类', question: '新题目', options: [], answer: 'A' }
      ];
      
      const result = QuestionBankManager.import(mockQuestionBank, importData);
      
      expect(result.added).toBe(1);
      expect(result.updated).toBe(1);
    });
  });

  describe('export', () => {
    test('应正确导出题库数据', () => {
      const result = QuestionBankManager.export(mockQuestionBank);
      
      expect(result.questionBank).toEqual(mockQuestionBank);
      expect(result.exportTime).toBeDefined();
    });

    test('包含用户数据时应一起导出', () => {
      const userData = { history: [], wrong: [], stats: {} };
      const result = QuestionBankManager.export(mockQuestionBank, userData);
      
      expect(result.userData).toEqual(userData);
    });
  });
});
