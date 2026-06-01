const { createDB } = require('../src/db');

describe('DB 存储模块', () => {
  let mockLocalStorage;
  let testQuestionBank;
  let DB;

  beforeEach(() => {
    // 模拟 localStorage
    mockLocalStorage = {
      store: {},
      getItem: jest.fn((key) => mockLocalStorage.store[key] || null),
      setItem: jest.fn((key, value) => { mockLocalStorage.store[key] = value; }),
      removeItem: jest.fn((key) => { delete mockLocalStorage.store[key]; })
    };

    // 测试题库
    testQuestionBank = [
      {
        id: 'q1',
        category: '专辑',
        question: '测试问题1',
        options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
        answer: 'A',
        explanation: '测试解析1'
      },
      {
        id: 'q2',
        category: '歌曲',
        question: '测试问题2',
        options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
        answer: 'B',
        explanation: '测试解析2'
      }
    ];

    DB = createDB(mockLocalStorage, testQuestionBank);
  });

  test('应该返回默认数据结构', () => {
    const data = DB.get();
    expect(data).toEqual({
      history: [],
      wrong: [],
      stats: { total: 0, correct: 0, cats: {} }
    });
  });

  test('应该正确保存和获取数据', () => {
    const testData = {
      history: [],
      wrong: [],
      stats: { total: 5, correct: 3, cats: {} }
    };
    DB.save(testData);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
    expect(DB.get()).toEqual(testData);
  });

  test('应该正确添加答题记录', () => {
    DB.addRecord({ qid: 'q1', ans: 'A', ok: true, time: Date.now() });
    const data = DB.get();
    expect(data.history.length).toBe(1);
    expect(data.stats.total).toBe(1);
    expect(data.stats.correct).toBe(1);
    expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
  });

  test('应该正确添加错题', () => {
    DB.addWrong('q1');
    const wrong = DB.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].qid).toBe('q1');
    expect(wrong[0].cnt).toBe(1);
  });

  test('应该正确增加错题计数', () => {
    DB.addWrong('q1');
    DB.addWrong('q1');
    const wrong = DB.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].cnt).toBe(2);
  });

  test('应该正确移除错题', () => {
    DB.addWrong('q1');
    DB.removeWrong('q1');
    const wrong = DB.getWrong();
    expect(wrong.length).toBe(0);
  });

  test('应该正确查找问题', () => {
    const q1 = DB.findQ('q1');
    expect(q1).not.toBeNull();
    expect(q1.question).toBe('测试问题1');
    
    const qNotExist = DB.findQ('q999');
    expect(qNotExist).toBeNull();
  });
});
