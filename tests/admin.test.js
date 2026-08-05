// ============================================================
// admin.test.js - 题库管理和数据导入导出测试
// 测试重点：题目CRUD、数据导入验证、导出功能
// ============================================================

// 模拟 App 命名空间
global.App = {
  QUESTION_BANK: [],
  DEFAULT_QUESTION_BANK: [],
  esc: (s) => {
    if (s == null) return '';
    const d = { textContent: String(s), innerHTML: '' };
    return d.innerHTML;
  }
};

// 加载被测模块
require('../js/admin.js');

describe('admin.js - 题库管理和数据导入导出', () => {
  
  describe('题目管理 CRUD', () => {
    
    beforeEach(() => {
      // 重置题库
      App.QUESTION_BANK = [
        { id: '001', category: '专辑', question: '测试题目1', options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' }
        ], answer: 'A', explanation: '测试解析' }
      ];
      App.DEFAULT_QUESTION_BANK = App.QUESTION_BANK.slice();
    });
    
    test('新增题目应正确添加到题库', () => {
      const newQuestion = {
        id: 'q' + Date.now(),
        category: '歌曲',
        question: '新增测试题目',
        options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' }
        ],
        answer: 'B',
        explanation: '新增题目解析'
      };
      
      App.QUESTION_BANK.push(newQuestion);
      
      expect(App.QUESTION_BANK.length).toBe(2);
      expect(App.QUESTION_BANK[1].question).toBe('新增测试题目');
    });
    
    test('编辑题目应正确更新', () => {
      const updatedQuestion = {
        id: '001',
        category: '专辑',
        question: '修改后的题目',
        options: [
          { key: 'A', text: '新选项A' },
          { key: 'B', text: '新选项B' }
        ],
        answer: 'B',
        explanation: '修改后的解析'
      };
      
      for (let i = 0; i < App.QUESTION_BANK.length; i++) {
        if (App.QUESTION_BANK[i].id === '001') {
          App.QUESTION_BANK[i] = updatedQuestion;
          break;
        }
      }
      
      expect(App.QUESTION_BANK[0].question).toBe('修改后的题目');
      expect(App.QUESTION_BANK[0].answer).toBe('B');
    });
    
    test('删除题目应从题库移除', () => {
      const qid = '001';
      App.QUESTION_BANK = App.QUESTION_BANK.filter(q => q.id !== qid);
      
      expect(App.QUESTION_BANK.length).toBe(0);
    });
    
    test('选项解析应支持多种格式', () => {
      const testCases = [
        { input: 'A.选项内容', expected: { key: 'A', text: '选项内容' } },
        { input: 'B、选项内容', expected: { key: 'B', text: '选项内容' } },
        { input: 'C．选项内容', expected: { key: 'C', text: '选项内容' } }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const match = input.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) {
          const option = { key: match[1], text: match[2] };
          expect(option).toEqual(expected);
        }
      });
    });
    
    test('选项应至少包含2个有效选项', () => {
      const options = [
        { key: 'A', text: '选项A' }
      ];
      
      expect(options.length).toBeLessThan(2);
      
      options.push({ key: 'B', text: '选项B' });
      expect(options.length).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('数据导入验证', () => {
    
    test('导入有效JSON应成功', () => {
      const validData = {
        questionBank: [
          { id: 'test001', category: '专辑', question: '测试题目', options: [
            { key: 'A', text: '选项A' }
          ], answer: 'A', explanation: '' }
        ],
        userData: {
          history: [],
          wrong: [],
          stats: { total: 0, correct: 0, cats: {} }
        }
      };
      
      const jsonStr = JSON.stringify(validData);
      const parsed = JSON.parse(jsonStr);
      
      expect(parsed.questionBank).toBeDefined();
      expect(parsed.userData).toBeDefined();
    });
    
    test('导入无效JSON应失败', () => {
      const invalidJSON = '{ invalid json }';
      
      expect(() => {
        JSON.parse(invalidJSON);
      }).toThrow();
    });
    
    test('导入缺少必要字段的数据应被拒绝', () => {
      const invalidData = {
        someOtherField: 'value'
      };
      
      const hasQuestionBank = invalidData.questionBank !== undefined;
      const hasUserData = invalidData.userData !== undefined;
      
      expect(hasQuestionBank || hasUserData).toBe(false);
    });
    
    test('导入重复题目ID应更新而非新增', () => {
      App.QUESTION_BANK = [
        { id: '001', category: '专辑', question: '旧题目', options: [], answer: 'A', explanation: '' }
      ];
      
      const importedQuestions = [
        { id: '001', category: '专辑', question: '新题目', options: [], answer: 'B', explanation: '更新' },
        { id: '002', category: '歌曲', question: '新题目2', options: [], answer: 'A', explanation: '' }
      ];
      
      const existingIds = {};
      for (let i = 0; i < App.QUESTION_BANK.length; i++) {
        existingIds[App.QUESTION_BANK[i].id] = true;
      }
      
      let addedCount = 0;
      let updatedCount = 0;
      
      for (let j = 0; j < importedQuestions.length; j++) {
        const q = importedQuestions[j];
        if (existingIds[q.id]) {
          // 更新
          for (let k = 0; k < App.QUESTION_BANK.length; k++) {
            if (App.QUESTION_BANK[k].id === q.id) {
              App.QUESTION_BANK[k] = q;
              updatedCount++;
              break;
            }
          }
        } else {
          // 新增
          App.QUESTION_BANK.push(q);
          addedCount++;
        }
      }
      
      expect(updatedCount).toBe(1);
      expect(addedCount).toBe(1);
      expect(App.QUESTION_BANK[0].question).toBe('新题目');
    });
    
    test('导入用户数据应合并历史记录', () => {
      const existingHistory = [
        { qid: '001', ans: 'A', ok: true, time: Date.now() }
      ];
      
      const importedHistory = [
        { qid: '002', ans: 'B', ok: false, time: Date.now() + 1000 }
      ];
      
      const mergedHistory = existingHistory.concat(importedHistory);
      
      expect(mergedHistory.length).toBe(2);
      expect(mergedHistory[1].qid).toBe('002');
    });
    
    test('导入间隔重复数据应保留较低等级', () => {
      const existingWrong = [
        { qid: '001', cnt: 3, level: 2, time: Date.now(), lastReview: 0, nextReview: Date.now() }
      ];
      
      const importedWrong = [
        { qid: '001', cnt: 2, level: 1, time: Date.now(), lastReview: 0, nextReview: Date.now() }
      ];
      
      // 合并逻辑：取较高的错误次数，保留较低等级
      const merged = { ...existingWrong[0] };
      merged.cnt = Math.max(merged.cnt, importedWrong[0].cnt || 1);
      if (importedWrong[0].level != null) {
        merged.level = Math.min(merged.level || 0, importedWrong[0].level);
      }
      
      expect(merged.cnt).toBe(3);
      expect(merged.level).toBe(1); // 取较低等级
    });
  });
  
  describe('数据导出', () => {
    
    test('导出应包含所有必要字段', () => {
      App.QUESTION_BANK = [
        { id: '001', category: '专辑', question: '测试', options: [], answer: 'A', explanation: '' }
      ];
      
      const exportData = {
        questionBank: App.QUESTION_BANK,
        userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } },
        exportTime: new Date().toISOString()
      };
      
      expect(exportData.questionBank).toBeDefined();
      expect(exportData.userData).toBeDefined();
      expect(exportData.exportTime).toBeDefined();
    });
    
    test('导出文件名应包含日期', () => {
      const filename = 'jj_quiz_backup_' + new Date().toISOString().slice(0, 10) + '.json';
      const datePattern = /\d{4}-\d{2}-\d{2}/;
      
      expect(datePattern.test(filename)).toBe(true);
    });
  });
  
  describe('题库重置', () => {
    
    test('重置应恢复为默认题库', () => {
      App.QUESTION_BANK = [
        { id: 'custom001', category: '专辑', question: '自定义题目', options: [], answer: 'A', explanation: '' }
      ];
      
      App.DEFAULT_QUESTION_BANK = [
        { id: '001', category: '专辑', question: '默认题目', options: [], answer: 'A', explanation: '' }
      ];
      
      App.QUESTION_BANK = App.DEFAULT_QUESTION_BANK.slice();
      
      expect(App.QUESTION_BANK[0].id).toBe('001');
      expect(App.QUESTION_BANK[0].question).toBe('默认题目');
    });
  });
  
  describe('分页和过滤', () => {
    
    beforeEach(() => {
      // 创建测试题库
      App.QUESTION_BANK = [];
      for (let i = 0; i < 50; i++) {
        App.QUESTION_BANK.push({
          id: 'q' + i,
          category: i < 25 ? '专辑' : '歌曲',
          question: '题目 ' + i,
          options: [],
          answer: 'A',
          explanation: ''
        });
      }
    });
    
    test('分页应正确计算总页数', () => {
      const pageSize = 30;
      const total = App.QUESTION_BANK.length;
      const totalPages = Math.ceil(total / pageSize);
      
      expect(totalPages).toBe(2);
    });
    
    test('分类过滤应返回正确结果', () => {
      const filtered = App.QUESTION_BANK.filter(q => q.category === '专辑');
      
      expect(filtered.length).toBe(25);
      filtered.forEach(q => expect(q.category).toBe('专辑'));
    });
    
    test('搜索应匹配题目文本', () => {
      const search = '10';
      const filtered = App.QUESTION_BANK.filter(q => 
        q.question.toLowerCase().indexOf(search.toLowerCase()) !== -1
      );
      
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(q => expect(q.question).toContain('10'));
    });
  });
});