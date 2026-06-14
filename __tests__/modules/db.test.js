/**
 * DB模块单元测试
 * 测试数据存储、答题记录、错题管理等核心功能
 */

const { DB, createDefaultData } = require('../../src/db.js');

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
  { id: '001', category: '专辑', question: '测试题目1', options: [{ key: 'A', text: '选项A' }], answer: 'A' },
  { id: '002', category: '歌曲', question: '测试题目2', options: [{ key: 'B', text: '选项B' }], answer: 'B' },
  { id: '003', category: '专辑', question: '测试题目3', options: [{ key: 'C', text: '选项C' }], answer: 'C' }
];

describe('DB模块', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('createDefaultData', () => {
    test('应创建正确的默认数据结构', () => {
      const data = createDefaultData();
      
      expect(data).toHaveProperty('history');
      expect(data).toHaveProperty('wrong');
      expect(data).toHaveProperty('stats');
      expect(Array.isArray(data.history)).toBe(true);
      expect(Array.isArray(data.wrong)).toBe(true);
      expect(data.stats).toHaveProperty('total', 0);
      expect(data.stats).toHaveProperty('correct', 0);
      expect(data.stats).toHaveProperty('cats');
    });
  });

  describe('get和save', () => {
    test('无数据时应返回默认数据', () => {
      const data = DB.get();
      
      expect(data.history).toEqual([]);
      expect(data.wrong).toEqual([]);
      expect(data.stats.total).toBe(0);
    });

    test('保存后应能正确读取', () => {
      const testData = {
        history: [{ qid: '001', ans: 'A', ok: true, time: Date.now() }],
        wrong: [],
        stats: { total: 1, correct: 1, cats: {} }
      };
      
      DB.save(testData);
      const data = DB.get();
      
      expect(data.history.length).toBe(1);
      expect(data.history[0].qid).toBe('001');
      expect(data.stats.total).toBe(1);
    });
  });

  describe('addRecord', () => {
    test('应正确添加答题记录', () => {
      const rec = { qid: '001', ans: 'A', ok: true, time: Date.now() };
      DB.addRecord(rec, mockQuestionBank);
      const data = DB.get();
      
      expect(data.history.length).toBe(1);
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(1);
    });

    test('应正确更新分类统计', () => {
      const rec = { qid: '001', ans: 'A', ok: true, time: Date.now() };
      DB.addRecord(rec, mockQuestionBank);
      const data = DB.get();
      
      expect(data.stats.cats['专辑']).toBeDefined();
      expect(data.stats.cats['专辑'].t).toBe(1);
      expect(data.stats.cats['专辑'].c).toBe(1);
    });

    test('错误答案应正确统计', () => {
      const rec = { qid: '001', ans: 'B', ok: false, time: Date.now() };
      DB.addRecord(rec, mockQuestionBank);
      const data = DB.get();
      
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(0);
      expect(data.stats.cats['专辑'].t).toBe(1);
      expect(data.stats.cats['专辑'].c).toBe(0);
    });

    test('多次答题应累加统计', () => {
      DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() }, mockQuestionBank);
      DB.addRecord({ qid: '002', ans: 'B', ok: true, time: Date.now() }, mockQuestionBank);
      DB.addRecord({ qid: '003', ans: 'A', ok: false, time: Date.now() }, mockQuestionBank);
      const data = DB.get();
      
      expect(data.stats.total).toBe(3);
      expect(data.stats.correct).toBe(2);
      expect(data.stats.cats['专辑'].t).toBe(2);
      expect(data.stats.cats['专辑'].c).toBe(1);
      expect(data.stats.cats['歌曲'].t).toBe(1);
      expect(data.stats.cats['歌曲'].c).toBe(1);
    });
  });

  describe('addWrong和removeWrong', () => {
    test('首次添加错题应创建新记录', () => {
      DB.addWrong('001');
      const wrong = DB.getWrong();
      
      expect(wrong.length).toBe(1);
      expect(wrong[0].qid).toBe('001');
      expect(wrong[0].cnt).toBe(1);
    });

    test('重复添加错题应增加计数', () => {
      DB.addWrong('001');
      DB.addWrong('001');
      DB.addWrong('001');
      const wrong = DB.getWrong();
      
      expect(wrong.length).toBe(1);
      expect(wrong[0].cnt).toBe(3);
    });

    test('移除错题应正确删除', () => {
      DB.addWrong('001');
      DB.addWrong('002');
      DB.removeWrong('001');
      const wrong = DB.getWrong();
      
      expect(wrong.length).toBe(1);
      expect(wrong[0].qid).toBe('002');
    });

    test('移除不存在的错题应无影响', () => {
      DB.addWrong('001');
      DB.removeWrong('999');
      const wrong = DB.getWrong();
      
      expect(wrong.length).toBe(1);
    });
  });

  describe('findQ', () => {
    test('应正确查找存在的题目', () => {
      const q = DB.findQ('001', mockQuestionBank);
      
      expect(q).toBeDefined();
      expect(q.id).toBe('001');
      expect(q.category).toBe('专辑');
    });

    test('查找不存在的题目应返回null', () => {
      const q = DB.findQ('999', mockQuestionBank);
      
      expect(q).toBeNull();
    });
  });

  describe('getTodayStats', () => {
    test('无答题记录时应返回零值', () => {
      const stats = DB.getTodayStats();
      
      expect(stats.count).toBe(0);
      expect(stats.correctCount).toBe(0);
      expect(stats.accuracy).toBe(0);
    });

    test('应正确统计今日答题', () => {
      const now = Date.now();
      DB.save({
        history: [
          { qid: '001', ans: 'A', ok: true, time: now },
          { qid: '002', ans: 'B', ok: true, time: now },
          { qid: '003', ans: 'A', ok: false, time: now }
        ],
        wrong: [],
        stats: { total: 3, correct: 2, cats: {} }
      });
      
      const stats = DB.getTodayStats();
      
      expect(stats.count).toBe(3);
      expect(stats.correctCount).toBe(2);
      expect(stats.accuracy).toBe(67);
    });

    test('应排除非今日的答题记录', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      DB.save({
        history: [
          { qid: '001', ans: 'A', ok: true, time: yesterday }
        ],
        wrong: [],
        stats: { total: 1, correct: 1, cats: {} }
      });
      
      const stats = DB.getTodayStats();
      
      expect(stats.count).toBe(0);
    });
  });

  describe('getOverallStats', () => {
    test('应正确返回总体统计', () => {
      DB.save({
        history: [],
        wrong: [{ qid: '001', cnt: 1 }, { qid: '002', cnt: 2 }],
        stats: { total: 10, correct: 7, cats: { '专辑': { t: 5, c: 3 } } }
      });
      
      const stats = DB.getOverallStats();
      
      expect(stats.total).toBe(10);
      expect(stats.correct).toBe(7);
      expect(stats.wrong).toBe(2);
      expect(stats.accuracy).toBe(70);
      expect(stats.cats['专辑'].t).toBe(5);
    });
  });
});
