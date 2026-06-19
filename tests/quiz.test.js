/**
 * 答题逻辑测试
 * 测试洗牌算法、答题流程、计分逻辑
 */

const { shuffle, DB, DEFAULT_QUESTIONS } = require('./testUtils');

describe('洗牌算法 shuffle()', () => {
  test('返回新数组，不修改原数组', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled).not.toBe(original);
  });

  test('返回数组长度相同', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original);
    expect(shuffled.length).toBe(original.length);
  });

  test('返回数组包含所有原元素', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original);
    original.forEach(item => {
      expect(shuffled).toContain(item);
    });
  });

  test('空数组返回空数组', () => {
    const shuffled = shuffle([]);
    expect(shuffled).toEqual([]);
  });

  test('单元素数组返回相同数组', () => {
    const shuffled = shuffle([1]);
    expect(shuffled).toEqual([1]);
  });

  test('多次洗牌结果不同（概率性测试）', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set();
    // 多次洗牌，至少有一次结果不同
    for (let i = 0; i < 10; i++) {
      results.add(JSON.stringify(shuffle(original)));
    }
    // 10次洗牌应该至少有2种不同结果（概率极高）
    expect(results.size).toBeGreaterThan(1);
  });

  test('对象数组洗牌', () => {
    const original = DEFAULT_QUESTIONS;
    const shuffled = shuffle(original);
    expect(shuffled.length).toBe(original.length);
    original.forEach(q => {
      expect(shuffled.find(s => s.id === q.id)).toBeDefined();
    });
  });
});

describe('答题流程集成测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('完整答题流程 - 正确答案', () => {
    const question = DEFAULT_QUESTIONS[0];
    const answer = question.answer;

    // 记录答题
    DB.addRecord({ qid: question.id, ans: answer, ok: true, time: Date.now() }, DEFAULT_QUESTIONS);

    const data = DB.get();
    expect(data.history.length).toBe(1);
    expect(data.stats.total).toBe(1);
    expect(data.stats.correct).toBe(1);
    expect(data.wrong.length).toBe(0);
  });

  test('完整答题流程 - 错误答案', () => {
    const question = DEFAULT_QUESTIONS[0];
    const wrongAnswer = question.answer === 'A' ? 'B' : 'A';

    // 记录答题
    DB.addRecord({ qid: question.id, ans: wrongAnswer, ok: false, time: Date.now() }, DEFAULT_QUESTIONS);
    // 添加错题
    DB.addWrong(question.id);

    const data = DB.get();
    expect(data.history.length).toBe(1);
    expect(data.stats.total).toBe(1);
    expect(data.stats.correct).toBe(0);
    expect(data.wrong.length).toBe(1);
    expect(data.wrong[0].qid).toBe(question.id);
  });

  test('连续答题统计', () => {
    // 模拟连续答题
    for (let i = 0; i < 10; i++) {
      const question = DEFAULT_QUESTIONS[i % DEFAULT_QUESTIONS.length];
      const isCorrect = i % 2 === 0; // 交替正确/错误
      DB.addRecord(
        { qid: question.id, ans: isCorrect ? question.answer : 'X', ok: isCorrect, time: Date.now() + i },
        DEFAULT_QUESTIONS
      );
      if (!isCorrect) {
        DB.addWrong(question.id);
      }
    }

    const data = DB.get();
    expect(data.stats.total).toBe(10);
    expect(data.stats.correct).toBe(5);
    expect(data.wrong.length).toBeGreaterThan(0);
  });

  test('错题复习后移除', () => {
    // 答错
    DB.addWrong('001');
    expect(DB.getWrong().length).toBe(1);

    // 复习后移除
    DB.removeWrong('001');
    expect(DB.getWrong().length).toBe(0);
  });

  test('分类统计正确性', () => {
    // 专辑类题目答对
    DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() }, DEFAULT_QUESTIONS);
    // 歌曲类题目答错
    DB.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() }, DEFAULT_QUESTIONS);

    const data = DB.get();
    expect(data.stats.cats['专辑'].t).toBe(1);
    expect(data.stats.cats['专辑'].c).toBe(1);
    expect(data.stats.cats['歌曲'].t).toBe(1);
    expect(data.stats.cats['歌曲'].c).toBe(0);
  });
});

describe('边界条件测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('空题库答题', () => {
    const rec = { qid: 'nonexistent', ans: 'A', ok: true, time: Date.now() };
    expect(() => DB.addRecord(rec, [])).not.toThrow();
    const data = DB.get();
    expect(data.stats.total).toBe(1);
    expect(data.stats.cats).toEqual({});
  });

  test('大量答题记录', () => {
    for (let i = 0; i < 1000; i++) {
      DB.addRecord(
        { qid: '001', ans: 'A', ok: true, time: Date.now() + i },
        DEFAULT_QUESTIONS
      );
    }
    const data = DB.get();
    expect(data.history.length).toBe(1000);
    expect(data.stats.total).toBe(1000);
    expect(data.stats.correct).toBe(1000);
  });

  test('大量错题记录', () => {
    for (let i = 0; i < 100; i++) {
      DB.addWrong(`q${i}`);
    }
    expect(DB.getWrong().length).toBe(100);
  });

  test('同一错题多次添加', () => {
    for (let i = 0; i < 10; i++) {
      DB.addWrong('001');
    }
    const wrong = DB.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].cnt).toBe(10);
  });

  test('localStorage 数据损坏处理', () => {
    // 模拟损坏的数据
    localStorage.setItem(DB.KEY, 'invalid json');
    // DB.get 应该返回默认值
    expect(() => DB.get()).not.toThrow();
  });
});

describe('数据一致性测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('stats.total 与 history.length 一致', () => {
    for (let i = 0; i < 5; i++) {
      DB.addRecord(
        { qid: '001', ans: 'A', ok: true, time: Date.now() + i },
        DEFAULT_QUESTIONS
      );
    }
    const data = DB.get();
    expect(data.stats.total).toBe(data.history.length);
  });

  test('stats.correct 不超过 stats.total', () => {
    for (let i = 0; i < 10; i++) {
      DB.addRecord(
        { qid: '001', ans: 'A', ok: i % 3 === 0, time: Date.now() + i },
        DEFAULT_QUESTIONS
      );
    }
    const data = DB.get();
    expect(data.stats.correct).toBeLessThanOrEqual(data.stats.total);
  });

  test('分类统计总数与总答题数一致', () => {
    DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() }, DEFAULT_QUESTIONS);
    DB.addRecord({ qid: '002', ans: 'B', ok: false, time: Date.now() }, DEFAULT_QUESTIONS);

    const data = DB.get();
    let catTotal = 0;
    for (const cat in data.stats.cats) {
      catTotal += data.stats.cats[cat].t;
    }
    expect(catTotal).toBe(data.stats.total);
  });
});
