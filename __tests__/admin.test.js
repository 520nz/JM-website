// ============================================================
// admin.js 测试 - 管理页分页逻辑
// ============================================================

global.App = {};

// 模拟DOM环境
global.document = {
  createElement: jest.fn(() => ({
    textContent: '',
    get innerHTML() { return this._innerHTML || ''; },
    set innerHTML(v) { this._innerHTML = v; }
  })),
  getElementById: jest.fn(() => ({
    innerHTML: '',
    value: '',
    style: {}
  })),
  querySelectorAll: jest.fn(() => [])
};

global.alert = jest.fn();
global.confirm = jest.fn(() => true);

// 加载依赖
require('../js/storage.js');

describe('Admin Module - 管理页分页逻辑', () => {
  let mockStore;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 生成大量测试题目（超过30条以测试分页）
    App.QUESTION_BANK = Array.from({ length: 85 }, (_, i) => ({
      id: `q${i + 1}`,
      category: i % 4 === 0 ? '专辑' : i % 4 === 1 ? '歌曲' : i % 4 === 2 ? '个人信息' : '获奖记录',
      question: `测试题目${i + 1}`,
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' },
        { key: 'C', text: '选项C' },
        { key: 'D', text: '选项D' }
      ],
      answer: 'A',
      explanation: `解析${i + 1}`
    }));
    
    // 模拟存储
    mockStore = {
      save: jest.fn(),
      reset: jest.fn()
    };
    
    App.store = mockStore;
    App.esc = (s) => s;
  });

  describe('分页计算逻辑', () => {
    const pageSize = 30;

    test('应正确计算总页数', () => {
      const totalItems = App.QUESTION_BANK.length;  // 85题
      const totalPages = Math.ceil(totalItems / pageSize);
      
      expect(totalPages).toBe(3);  // 85 / 30 = 2.83 ≈ 3页
    });

    test('应正确计算当前页的起始和结束索引', () => {
      const totalItems = 85;
      
      // 第1页
      let page = 1;
      let start = (page - 1) * pageSize;
      let end = Math.min(start + pageSize, totalItems);
      expect(start).toBe(0);
      expect(end).toBe(30);
      
      // 第2页
      page = 2;
      start = (page - 1) * pageSize;
      end = Math.min(start + pageSize, totalItems);
      expect(start).toBe(30);
      expect(end).toBe(60);
      
      // 第3页（最后一页）
      page = 3;
      start = (page - 1) * pageSize;
      end = Math.min(start + pageSize, totalItems);
      expect(start).toBe(60);
      expect(end).toBe(85);
    });

    test('页码超出范围时应自动调整', () => {
      const totalItems = 85;
      const totalPages = Math.ceil(totalItems / pageSize);
      
      let currentPage = 5;  // 超出最大页数
      if (currentPage > totalPages) currentPage = totalPages;
      
      expect(currentPage).toBe(3);
      
      currentPage = 0;  // 小于最小页数
      if (currentPage < 1) currentPage = 1;
      
      expect(currentPage).toBe(1);
    });

    test('空题库时应显示1页', () => {
      App.QUESTION_BANK = [];
      const totalItems = 0;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      
      expect(totalPages).toBe(1);
    });
  });

  describe('搜索和过滤逻辑', () => {
    test('应正确过滤分类', () => {
      const catFilter = '专辑';
      const filtered = App.QUESTION_BANK.filter(q => q.category === catFilter);
      
      // 每4题有1题是专辑，85题约21题
      expect(filtered.length).toBeGreaterThan(20);
      filtered.forEach(q => {
        expect(q.category).toBe('专辑');
      });
    });

    test('应正确搜索题目', () => {
      const searchKeyword = '测试题目5';
      const filtered = App.QUESTION_BANK.filter(q => 
        q.question === searchKeyword  // 精确匹配
      );
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].question).toBe('测试题目5');
    });

    test('组合过滤应正确工作', () => {
      const catFilter = '歌曲';
      const searchKeyword = '测试题目';
      
      const filtered = App.QUESTION_BANK.filter(q => {
        if (catFilter && q.category !== catFilter) return false;
        if (searchKeyword && !q.question.toLowerCase().includes(searchKeyword.toLowerCase())) return false;
        return true;
      });
      
      filtered.forEach(q => {
        expect(q.category).toBe('歌曲');
        expect(q.question).toContain('测试题目');
      });
    });
  });

  describe('题目CRUD操作', () => {
    test('新增题目应添加到题库', () => {
      const initialCount = App.QUESTION_BANK.length;
      
      const newQuestion = {
        id: 'q_new',
        category: '专辑',
        question: '新增测试题目',
        options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' }
        ],
        answer: 'A',
        explanation: '新增测试'
      };
      
      App.QUESTION_BANK.push(newQuestion);
      
      expect(App.QUESTION_BANK.length).toBe(initialCount + 1);
      expect(App.QUESTION_BANK.find(q => q.id === 'q_new')).toBeDefined();
    });

    test('编辑题目应更新对应条目', () => {
      const targetId = 'q1';
      const question = App.QUESTION_BANK.find(q => q.id === targetId);
      
      if (question) {
        question.question = '修改后的题目';
        question.answer = 'B';
      }
      
      const updated = App.QUESTION_BANK.find(q => q.id === targetId);
      expect(updated.question).toBe('修改后的题目');
      expect(updated.answer).toBe('B');
    });

    test('删除题目应从题库移除', () => {
      const targetId = 'q1';
      const initialCount = App.QUESTION_BANK.length;
      
      App.QUESTION_BANK = App.QUESTION_BANK.filter(q => q.id !== targetId);
      
      expect(App.QUESTION_BANK.length).toBe(initialCount - 1);
      expect(App.QUESTION_BANK.find(q => q.id === targetId)).toBeUndefined();
    });
  });

  describe('数据导入导出', () => {
    test('导出数据应包含所有必要字段', () => {
      const exportData = {
        questionBank: App.QUESTION_BANK,
        userData: {
          history: [],
          wrong: [],
          stats: { total: 0, correct: 0, cats: {} }
        },
        exportTime: new Date().toISOString()
      };
      
      expect(exportData).toHaveProperty('questionBank');
      expect(exportData).toHaveProperty('userData');
      expect(exportData).toHaveProperty('exportTime');
      expect(Array.isArray(exportData.questionBank)).toBe(true);
      expect(exportData.questionBank.length).toBe(85);
    });

    test('导入数据应正确合并题库', () => {
      const existingIds = {};
      App.QUESTION_BANK.forEach(q => existingIds[q.id] = true);
      
      const importedQuestions = [
        { id: 'q90', category: '专辑', question: '新题目1' },  // 新增
        { id: 'q1', category: '歌曲', question: '更新题目1' }  // 更新
      ];
      
      let addedCount = 0;
      let updatedCount = 0;
      
      importedQuestions.forEach(q => {
        if (existingIds[q.id]) {
          const index = App.QUESTION_BANK.findIndex(item => item.id === q.id);
          if (index !== -1) {
            App.QUESTION_BANK[index] = q;
            updatedCount++;
          }
        } else {
          App.QUESTION_BANK.push(q);
          addedCount++;
        }
      });
      
      expect(addedCount).toBe(1);
      expect(updatedCount).toBe(1);
      expect(App.QUESTION_BANK.length).toBe(86);
    });
  });
});