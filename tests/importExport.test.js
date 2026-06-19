/**
 * 数据导入导出测试
 * 测试边界条件、错误处理、数据合并逻辑
 */

const { importDataFromJSON, DB, DEFAULT_QUESTIONS } = require('./testUtils');

describe('数据导入 importDataFromJSON()', () => {
  let questionBank;

  beforeEach(() => {
    questionBank = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
    localStorage.clear();
  });

  describe('输入验证', () => {
    test('空对象返回错误', () => {
      const result = importDataFromJSON(questionBank, {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('文件中未找到有效数据（questionBank 或 userData）');
    });

    test('null 返回错误', () => {
      const result = importDataFromJSON(questionBank, null);
      expect(result.success).toBe(false);
    });

    test('只有 questionBank 时成功', () => {
      const result = importDataFromJSON(questionBank, { questionBank: [] });
      expect(result.success).toBe(true);
    });

    test('只有 userData 时成功', () => {
      const result = importDataFromJSON(questionBank, { userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } } });
      expect(result.success).toBe(true);
    });
  });

  describe('题库导入', () => {
    test('导入新题目', () => {
      const newQuestion = {
        id: 'new001',
        category: '测试',
        question: '新题目',
        options: [{ key: 'A', text: '选项A' }],
        answer: 'A',
        explanation: ''
      };
      const result = importDataFromJSON(questionBank, { questionBank: [newQuestion] });
      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
      expect(questionBank.length).toBe(3);
    });

    test('更新已存在的题目', () => {
      const updatedQuestion = {
        id: '001',
        category: '专辑',
        question: '修改后的问题',
        options: [{ key: 'A', text: '新选项' }],
        answer: 'A',
        explanation: '新解析'
      };
      const result = importDataFromJSON(questionBank, { questionBank: [updatedQuestion] });
      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(0);
      expect(result.updatedCount).toBe(1);
      expect(questionBank.find(q => q.id === '001').question).toBe('修改后的问题');
    });

    test('混合新增和更新', () => {
      const questions = [
        { id: '001', category: '专辑', question: '更新问题', options: [], answer: 'A', explanation: '' },
        { id: 'new001', category: '新分类', question: '新问题', options: [], answer: 'A', explanation: '' }
      ];
      const result = importDataFromJSON(questionBank, { questionBank: questions });
      expect(result.addedCount).toBe(1);
      expect(result.updatedCount).toBe(1);
      expect(questionBank.length).toBe(3);
    });

    test('导入空题库数组', () => {
      const result = importDataFromJSON(questionBank, { questionBank: [] });
      expect(result.success).toBe(true);
      expect(questionBank.length).toBe(2); // 原有数量不变
    });
  });

  describe('用户数据导入', () => {
    test('导入答题历史', () => {
      const userData = {
        history: [
          { qid: '001', ans: 'A', ok: true, time: 1000 },
          { qid: '002', ans: 'B', ok: false, time: 2000 }
        ],
        wrong: [],
        stats: { total: 0, correct: 0, cats: {} }
      };
      importDataFromJSON(questionBank, { userData });
      const data = DB.get();
      expect(data.history.length).toBe(2);
    });

    test('导入错题记录 - 新错题', () => {
      const userData = {
        history: [],
        wrong: [{ qid: '001', cnt: 3, time: 1000 }],
        stats: { total: 0, correct: 0, cats: {} }
      };
      importDataFromJSON(questionBank, { userData });
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].cnt).toBe(3);
    });

    test('导入错题记录 - 合并已存在的错题', () => {
      // 先添加一个错题
      DB.addWrong('001');
      const userData = {
        history: [],
        wrong: [{ qid: '001', cnt: 2, time: 2000 }],
        stats: { total: 0, correct: 0, cats: {} }
      };
      importDataFromJSON(questionBank, { userData });
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].cnt).toBe(3); // 1 + 2 = 3
    });

    test('导入统计数据', () => {
      const userData = {
        history: [],
        wrong: [],
        stats: { total: 10, correct: 8, cats: {} }
      };
      importDataFromJSON(questionBank, { userData });
      const data = DB.get();
      expect(data.stats.total).toBe(10);
      expect(data.stats.correct).toBe(8);
    });

    test('导入分类统计', () => {
      const userData = {
        history: [],
        wrong: [],
        stats: {
          total: 5,
          correct: 3,
          cats: {
            '专辑': { t: 3, c: 2 },
            '歌曲': { t: 2, c: 1 }
          }
        }
      };
      importDataFromJSON(questionBank, { userData });
      const data = DB.get();
      expect(data.stats.cats['专辑'].t).toBe(3);
      expect(data.stats.cats['专辑'].c).toBe(2);
      expect(data.stats.cats['歌曲'].t).toBe(2);
    });

    test('合并分类统计', () => {
      // 先设置一些初始数据
      DB.save({
        history: [],
        wrong: [],
        stats: {
          total: 5,
          correct: 3,
          cats: { '专辑': { t: 5, c: 3 } }
        }
      });
      const userData = {
        history: [],
        wrong: [],
        stats: {
          total: 3,
          correct: 2,
          cats: { '专辑': { t: 3, c: 2 } }
        }
      };
      importDataFromJSON(questionBank, { userData });
      const data = DB.get();
      expect(data.stats.total).toBe(8); // 5 + 3
      expect(data.stats.correct).toBe(5); // 3 + 2
      expect(data.stats.cats['专辑'].t).toBe(8); // 5 + 3
      expect(data.stats.cats['专辑'].c).toBe(5); // 3 + 2
    });
  });

  describe('边界条件', () => {
    test('导入数据缺少 stats 字段', () => {
      const userData = {
        history: [],
        wrong: []
      };
      expect(() => importDataFromJSON(questionBank, { userData })).not.toThrow();
    });

    test('导入数据 stats 缺少 cats 字段', () => {
      const userData = {
        history: [],
        wrong: [],
        stats: { total: 5, correct: 3 }
      };
      expect(() => importDataFromJSON(questionBank, { userData })).not.toThrow();
    });

    test('导入数据缺少 history 字段', () => {
      const userData = {
        wrong: [],
        stats: { total: 0, correct: 0, cats: {} }
      };
      expect(() => importDataFromJSON(questionBank, { userData })).not.toThrow();
    });

    test('导入数据缺少 wrong 字段', () => {
      const userData = {
        history: [],
        stats: { total: 0, correct: 0, cats: {} }
      };
      expect(() => importDataFromJSON(questionBank, { userData })).not.toThrow();
    });

    test('题目数据缺少字段', () => {
      const incompleteQuestion = { id: 'new001' };
      expect(() => importDataFromJSON(questionBank, { questionBank: [incompleteQuestion] })).not.toThrow();
    });
  });
});
