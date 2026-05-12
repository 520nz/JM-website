// 数据库模块测试
const { createDB } = require('../src/db');

describe('DB Module', () => {
  let mockStorage;
  let testQuestionBank;

  beforeEach(() => {
    // 模拟 localStorage
    mockStorage = (function() {
      let store = {};
      return {
        getItem: function(key) {
          return store[key] || null;
        },
        setItem: function(key, value) {
          store[key] = value.toString();
        },
        removeItem: function(key) {
          delete store[key];
        },
        clear: function() {
          store = {};
        }
      };
    })();

    // 测试题库
    testQuestionBank = [
      {
        id: '001',
        category: '专辑',
        question: '测试题目1',
        options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' }
        ],
        answer: 'A',
        explanation: '测试解析1'
      },
      {
        id: '002',
        category: '歌曲',
        question: '测试题目2',
        options: [
          { key: 'A', text: '选项A' },
          { key: 'B', text: '选项B' }
        ],
        answer: 'B',
        explanation: '测试解析2'
      }
    ];
  });

  test('should create DB instance', () => {
    const db = createDB({ questionBank: testQuestionBank, storage: mockStorage });
    expect(typeof db).toBe('object');
    expect(typeof db.get).toBe('function');
    expect(typeof db.save).toBe('function');
  });

  test('should get default data when no data exists', () => {
    const db = createDB({ questionBank: testQuestionBank, storage: mockStorage });
    const data = db.get();
    expect(data).toEqual({
      history: [],
      wrong: [],
      stats: { total: 0, correct: 0, cats: {} }
    });
  });

  test('should save and get data correctly', () => {
    const db = createDB({ questionBank: testQuestionBank, storage: mockStorage });
    const testData = {
      history: [],
      wrong: [],
      stats: { total: 5, correct: 3, cats: {} }
    };
    db.save(testData);
    const retrievedData = db.get();
    expect(retrievedData).toEqual(testData);
  });

  test('should add record correctly', () => {
    const db = createDB({ questionBank: testQuestionBank, storage: mockStorage });
    const record = {
      qid: '001',
      ans: 'A',
      ok: true,
      time: Date.now()
    };
    db.addRecord(record);
    const data = db.get();
    expect(data.history.length).toBe(1);
    expect(data.history[0]).toEqual(record);
    expect(data.stats.total).toBe(1);
    expect(data.stats.correct).toBe(1);
    expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
  });

  test('should handle wrong answer in record', () => {
    const db = createDB({ questionBank: testQuestionBank, storage: mockStorage });
    const record = {
      qid: '001',
      ans: 'B',
      ok: false,
      time: Date.now()
    };
    db.addRecord(record);
    const data = db.get();
    expect(data.stats.total).toBe(1);
    expect(data.stats.correct).toBe(0);
    expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 0 });
  });

  test('should add wrong question and increment count on multiple wrong answers', () => {
    const db = createDB({ questionBank: testQuestionBank, storage: mockStorage });
    db.addWrong('001');
    let data = db.get();
    expect(data.wrong.length).toBe(1);
    expect(data.wrong[0].qid).toBe('001');
    expect(data.wrong[0].cnt).toBe(1);

    db.addWrong('001');
    data = db.get();
    expect(data.wrong.length).toBe(1);
    expect(data.wrong[0].cnt).toBe(2);
  });

  test('should remove wrong question', () => {
    const db = createDB({ questionBank: testQuestionBank, storage: mockStorage });
    db.addWrong('001');
    db.addWrong('002');
    let data = db.get();
    expect(data.wrong.length).toBe(2);

    db.removeWrong('001');
    data = db.get();
    expect(data.wrong.length).toBe(1);
    expect(data.wrong[0].qid).toBe('002');
  });

  test('should get wrong questions', () => {
    const db = createDB({ questionBank: testQuestionBank, storage: mockStorage });
    db.addWrong('001');
    db.addWrong('002');
    const wrongList = db.getWrong();
    expect(wrongList.length).toBe(2);
  });

  test('should find question by id', () => {
    const db = createDB({ questionBank: testQuestionBank, storage: mockStorage });
    const q1 = db.findQ('001');
    expect(q1).not.toBeNull();
    expect(q1.question).toBe('测试题目1');

    const q3 = db.findQ('nonexistent');
    expect(q3).toBeNull();
  });

  test('should handle category stats correctly for different categories', () => {
    const db = createDB({ questionBank: testQuestionBank, storage: mockStorage });
    db.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    db.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
    const data = db.get();
    expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
    expect(data.stats.cats['歌曲']).toEqual({ t: 1, c: 0 });
  });
});
