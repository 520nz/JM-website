describe('DB数据存储模块', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('DB.get() 应返回默认数据结构', () => {
    const data = DB.get();
    expect(data).toEqual({
      history: [],
      wrong: [],
      stats: { total: 0, correct: 0, cats: {} }
    });
  });

  test('DB.addRecord() 应正确记录答题记录', () => {
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    const data = DB.get();
    expect(data.history.length).toBe(1);
    expect(data.stats.total).toBe(1);
    expect(data.stats.correct).toBe(1);
    expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
  });

  test('DB.addRecord() 应正确记录错题', () => {
    DB.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
    const data = DB.get();
    expect(data.stats.total).toBe(1);
    expect(data.stats.correct).toBe(0);
    expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 0 });
  });

  test('DB.addWrong() 应正确添加错题到错题本', () => {
    DB.addWrong('001');
    const data = DB.get();
    expect(data.wrong.length).toBe(1);
    expect(data.wrong[0].qid).toBe('001');
    expect(data.wrong[0].cnt).toBe(1);
  });

  test('DB.addWrong() 应正确累加同一错题的错误次数', () => {
    DB.addWrong('001');
    DB.addWrong('001');
    const data = DB.get();
    expect(data.wrong.length).toBe(1);
    expect(data.wrong[0].cnt).toBe(2);
  });

  test('DB.removeWrong() 应正确从错题本移除题目', () => {
    DB.addWrong('001');
    DB.addWrong('002');
    DB.removeWrong('001');
    const data = DB.get();
    expect(data.wrong.length).toBe(1);
    expect(data.wrong[0].qid).toBe('002');
  });

  test('DB.findQ() 应正确查找题目', () => {
    const q = DB.findQ('001');
    expect(q).not.toBeNull();
    expect(q.id).toBe('001');
    expect(q.category).toBe('专辑');
  });

  test('DB.findQ() 应返回null当题目不存在', () => {
    const q = DB.findQ('nonexistent');
    expect(q).toBeNull();
  });

  test('DB.getWrong() 应返回错题列表', () => {
    DB.addWrong('001');
    const wrong = DB.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].qid).toBe('001');
  });

  test('DB.defaults() 应返回正确的默认数据结构', () => {
    const defaults = DB.defaults();
    expect(defaults).toEqual({
      history: [],
      wrong: [],
      stats: { total: 0, correct: 0, cats: {} }
    });
  });

  test('DB.save() 和 DB.get() 应正确持久化数据', () => {
    const testData = {
      history: [{ qid: '001', ans: 'A', ok: false, time: 1234567890 }],
      wrong: [{ qid: '001', cnt: 1, time: 1234567890 }],
      stats: { total: 1, correct: 0, cats: { '专辑': { t: 1, c: 0 } } }
    };
    DB.save(testData);
    const retrieved = DB.get();
    expect(retrieved).toEqual(testData);
  });

  test('分类统计应正确累加', () => {
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    DB.addRecord({ qid: '002', ans: 'A', ok: true, time: Date.now() });
    DB.addRecord({ qid: '005', ans: 'C', ok: false, time: Date.now() });
    const data = DB.get();
    expect(data.stats.cats['专辑']).toEqual({ t: 2, c: 1 });
    expect(data.stats.cats['歌曲']).toEqual({ t: 1, c: 1 });
  });
});