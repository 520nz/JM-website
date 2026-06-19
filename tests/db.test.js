/**
 * 数据管理模块（DB对象）测试
 * 测试 localStorage 持久化、答题记录、错题管理
 */

const { DB, DEFAULT_QUESTIONS } = require('./testUtils');

describe('DB 数据管理模块', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('DB.get() 和 DB.save()', () => {
    test('无数据时返回默认结构', () => {
      const data = DB.get();
      expect(data).toEqual({
        history: [],
        wrong: [],
        stats: { total: 0, correct: 0, cats: {} }
      });
    });

    test('保存后能正确读取', () => {
      const testData = {
        history: [{ qid: '001', ans: 'A', ok: true, time: 1000 }],
        wrong: [{ qid: '002', cnt: 1, time: 2000 }],
        stats: { total: 1, correct: 1, cats: {} }
      };
      DB.save(testData);
      const data = DB.get();
      expect(data).toEqual(testData);
    });

    test('多次保存覆盖之前数据', () => {
      DB.save({ history: [], wrong: [], stats: { total: 5, correct: 3, cats: {} } });
      DB.save({ history: [], wrong: [], stats: { total: 10, correct: 8, cats: {} } });
      const data = DB.get();
      expect(data.stats.total).toBe(10);
    });
  });

  describe('DB.addRecord()', () => {
    test('正确记录答题历史', () => {
      const rec = { qid: '001', ans: 'A', ok: true, time: Date.now() };
      DB.addRecord(rec, DEFAULT_QUESTIONS);
      const data = DB.get();
      expect(data.history.length).toBe(1);
      expect(data.history[0]).toEqual(rec);
    });

    test('正确更新统计数据 - 正确答案', () => {
      const rec = { qid: '001', ans: 'A', ok: true, time: Date.now() };
      DB.addRecord(rec, DEFAULT_QUESTIONS);
      const data = DB.get();
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(1);
    });

    test('正确更新统计数据 - 错误答案', () => {
      const rec = { qid: '001', ans: 'B', ok: false, time: Date.now() };
      DB.addRecord(rec, DEFAULT_QUESTIONS);
      const data = DB.get();
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(0);
    });

    test('正确更新分类统计', () => {
      const rec = { qid: '001', ans: 'A', ok: true, time: Date.now() };
      DB.addRecord(rec, DEFAULT_QUESTIONS);
      const data = DB.get();
      expect(data.stats.cats['专辑']).toBeDefined();
      expect(data.stats.cats['专辑'].t).toBe(1);
      expect(data.stats.cats['专辑'].c).toBe(1);
    });

    test('题目不存在时不崩溃', () => {
      const rec = { qid: 'nonexistent', ans: 'A', ok: true, time: Date.now() };
      expect(() => DB.addRecord(rec, DEFAULT_QUESTIONS)).not.toThrow();
      const data = DB.get();
      expect(data.stats.total).toBe(1);
    });
  });

  describe('DB.addWrong()', () => {
    test('首次添加错题', () => {
      DB.addWrong('001');
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].qid).toBe('001');
      expect(wrong[0].cnt).toBe(1);
    });

    test('重复添加同一错题增加计数', () => {
      DB.addWrong('001');
      DB.addWrong('001');
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].cnt).toBe(2);
    });

    test('添加多个不同错题', () => {
      DB.addWrong('001');
      DB.addWrong('002');
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(2);
    });

    test('更新错题时间戳', () => {
      DB.addWrong('001');
      const time1 = DB.getWrong()[0].time;
      // 等待一小段时间
      const start = Date.now();
      while (Date.now() - start < 5) {} // 确保时间差
      DB.addWrong('001');
      const time2 = DB.getWrong()[0].time;
      expect(time2).toBeGreaterThanOrEqual(time1);
    });
  });

  describe('DB.removeWrong()', () => {
    test('移除存在的错题', () => {
      DB.addWrong('001');
      DB.addWrong('002');
      DB.removeWrong('001');
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].qid).toBe('002');
    });

    test('移除不存在的错题不报错', () => {
      DB.addWrong('001');
      expect(() => DB.removeWrong('nonexistent')).not.toThrow();
      expect(DB.getWrong().length).toBe(1);
    });

    test('清空所有错题', () => {
      DB.addWrong('001');
      DB.addWrong('002');
      DB.removeWrong('001');
      DB.removeWrong('002');
      expect(DB.getWrong().length).toBe(0);
    });
  });

  describe('DB.findQ()', () => {
    test('查找存在的题目', () => {
      const q = DB.findQ('001', DEFAULT_QUESTIONS);
      expect(q).toBeDefined();
      expect(q.id).toBe('001');
    });

    test('查找不存在的题目返回 null', () => {
      const q = DB.findQ('nonexistent', DEFAULT_QUESTIONS);
      expect(q).toBeNull();
    });
  });
});
