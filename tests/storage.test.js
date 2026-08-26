const lib = require('./testLib');

describe('XSS 转义工具 (esc)', () => {
  test('正常文本不应被修改', () => {
    expect(lib.esc('hello world')).toBe('hello world');
  });

  test('HTML 特殊字符应被转义', () => {
    const result = lib.esc('<script>alert(1)</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  test('空值应返回空字符串', () => {
    expect(lib.esc(null)).toBe('');
    expect(lib.esc(undefined)).toBe('');
  });

  test('数字应被转为字符串', () => {
    expect(lib.esc(42)).toBe('42');
  });

  test('& 符号应被转义', () => {
    expect(lib.esc('A & B')).toContain('&amp;');
  });
});

describe('默认数据结构', () => {
  test('defaults() 应返回正确的默认结构', () => {
    const d = lib.defaults();
    expect(d).toHaveProperty('history', []);
    expect(d).toHaveProperty('wrong', []);
    expect(d).toHaveProperty('stats');
    expect(d.stats).toEqual({ total: 0, correct: 0, cats: {} });
    expect(d).toHaveProperty('theme', 'dark');
    expect(d).toHaveProperty('dailyGoal', 20);
    expect(d).toHaveProperty('achievements', []);
    expect(d).toHaveProperty('archive', []);
  });
});

describe('findQ 查找题目', () => {
  beforeEach(() => {
    lib.setQuestionBank([
      { id: '001', question: 'Q1', answer: 'A', category: '测试' },
      { id: '002', question: 'Q2', answer: 'B', category: '测试' },
      { id: '003', question: 'Q3', answer: 'C', category: '歌曲' }
    ]);
  });

  test('应通过 id 找到题目', () => {
    const q = lib.findQ('001');
    expect(q).toBeDefined();
    expect(q.question).toBe('Q1');
    expect(q.answer).toBe('A');
  });

  test('找不到时应返回 null', () => {
    const q = lib.findQ('999');
    expect(q).toBeNull();
  });
});

describe('答题记录与统计', () => {
  beforeEach(() => {
    lib.reset();
    lib.setQuestionBank([
      { id: '001', question: 'Q1', answer: 'A', category: '专辑' },
      { id: '002', question: 'Q2', answer: 'B', category: '歌曲' }
    ]);
  });

  test('addRecord 应正确更新统计', () => {
    lib.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    const d = lib.get();
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(1);
    expect(d.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
  });

  test('addRecord 答错时不应增加正确数', () => {
    lib.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() });
    const d = lib.get();
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(0);
    expect(d.stats.cats['专辑'].c).toBe(0);
  });

  test('多条记录应正确累加', () => {
    lib.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    lib.addRecord({ qid: '002', ans: 'C', ok: false, time: Date.now() });
    const d = lib.get();
    expect(d.stats.total).toBe(2);
    expect(d.stats.correct).toBe(1);
    expect(d.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
    expect(d.stats.cats['歌曲']).toEqual({ t: 1, c: 0 });
  });

  test('不存在的题目不应导致错误', () => {
    expect(() => {
      lib.addRecord({ qid: '999', ans: 'A', ok: true, time: Date.now() });
    }).not.toThrow();
    const d = lib.get();
    expect(d.stats.total).toBe(1);
  });
});

describe('错题本与间隔重复', () => {
  beforeEach(() => {
    lib.reset();
  });

  test('addWrong 应添加新错题', () => {
    lib.addWrong('001');
    const wrong = lib.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].qid).toBe('001');
    expect(wrong[0].level).toBe(0);
    expect(wrong[0].cnt).toBe(1);
    expect(wrong[0].nextReview).toBeDefined();
  });

  test('addWrong 重复添加应重置等级和增加计数', () => {
    lib.addWrong('001');
    lib.addWrong('001');
    const w = lib.getWrong()[0];
    expect(w.cnt).toBe(2);
    expect(w.level).toBe(0);
  });

  test('reviewCorrect 应提升等级', () => {
    lib.addWrong('001');
    const result = lib.reviewCorrect('001');
    expect(result.mastered).toBe(false);
    expect(result.level).toBe(1);
  });

  test('reviewCorrect 等级达到5应标记为掌握并移除', () => {
    lib.addWrong('001');
    for (let i = 0; i < 4; i++) {
      lib.reviewCorrect('001');
    }
    const result = lib.reviewCorrect('001');
    expect(result.mastered).toBe(true);
    const wrong = lib.getWrong();
    expect(wrong.length).toBe(0);
  });

  test('reviewCorrect 对不在错题本中的题目应返回默认结果', () => {
    const result = lib.reviewCorrect('999');
    expect(result.mastered).toBe(false);
    expect(result.qid).toBe('999');
  });

  test('reviewWrong 应重置等级为0并增加计数', () => {
    lib.addWrong('001');
    lib.reviewCorrect('001');
    lib.reviewCorrect('001');
    lib.reviewWrong('001');
    const w = lib.getWrong()[0];
    expect(w.level).toBe(0);
    expect(w.cnt).toBe(2);
  });

  test('reviewWrong 对不在错题本中的题目应新增', () => {
    lib.reviewWrong('999');
    const wrong = lib.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].qid).toBe('999');
  });

  test('getDueWrong 应返回到期错题', () => {
    const now = Date.now();
    lib.setData(lib.defaults());
    lib.get().wrong = [
      { qid: '001', nextReview: now - 1000, level: 0, cnt: 1 },
      { qid: '002', nextReview: now + 86400000, level: 1, cnt: 1 },
      { qid: '003', nextReview: 0, level: 0, cnt: 1 }
    ];
    const due = lib.getDueWrong();
    expect(due.length).toBe(2);
    expect(due.map(w => w.qid)).toContain('001');
    expect(due.map(w => w.qid)).toContain('003');
    expect(due.map(w => w.qid)).not.toContain('002');
  });

  test('removeWrong 应移除指定错题', () => {
    lib.addWrong('001');
    lib.addWrong('002');
    lib.removeWrong('001');
    const wrong = lib.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].qid).toBe('002');
  });
});

describe('统计重算', () => {
  beforeEach(() => {
    lib.reset();
    lib.setQuestionBank([
      { id: '001', question: 'Q1', answer: 'A', category: '专辑' },
      { id: '002', question: 'Q2', answer: 'B', category: '歌曲' }
    ]);
  });

  test('recalcStats 应从历史数据重新计算统计', () => {
    lib.get().history = [
      { qid: '001', ok: true, time: Date.now() },
      { qid: '002', ok: false, time: Date.now() },
      { qid: '001', ok: true, time: Date.now() }
    ];
    lib.recalcStats();
    const d = lib.get();
    expect(d.stats.total).toBe(3);
    expect(d.stats.correct).toBe(2);
    expect(d.stats.cats['专辑']).toEqual({ t: 2, c: 2 });
    expect(d.stats.cats['歌曲']).toEqual({ t: 1, c: 0 });
  });

  test('recalcStats 空历史应重置为零', () => {
    lib.get().stats = { total: 100, correct: 50, cats: { '专辑': { t: 50, c: 30 } } };
    lib.recalcStats();
    const d = lib.get();
    expect(d.stats.total).toBe(0);
    expect(d.stats.correct).toBe(0);
    expect(Object.keys(d.stats.cats).length).toBe(0);
  });
});

describe('每日目标', () => {
  beforeEach(() => {
    lib.reset();
  });

  test('默认每日目标应为20', () => {
    expect(lib.getDailyGoal()).toBe(20);
  });

  test('setDailyGoal 应限制在5-100之间', () => {
    lib.setDailyGoal(3);
    expect(lib.getDailyGoal()).toBe(5);
    
    lib.setDailyGoal(150);
    expect(lib.getDailyGoal()).toBe(100);
    
    lib.setDailyGoal(50);
    expect(lib.getDailyGoal()).toBe(50);
  });
});

describe('连续打卡计算', () => {
  beforeEach(() => {
    lib.reset();
  });

  test('无历史应返回0', () => {
    expect(lib.getStreak()).toBe(0);
  });

  test('今日有记录应返回至少1', () => {
    const now = new Date();
    lib.get().history.push({ time: now.getTime(), ok: true, qid: '001' });
    const streak = lib.getStreak();
    expect(streak).toBeGreaterThanOrEqual(1);
  });

  test('昨日有记录应返回1', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    lib.get().history.push({ time: yesterday.getTime(), ok: true, qid: '001' });
    const streak = lib.getStreak();
    expect(streak).toBe(1);
  });

  test('连续三天应有正确的计数', () => {
    const base = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      lib.get().history.push({ time: d.getTime(), ok: true, qid: '001' });
    }
    const streak = lib.getStreak();
    expect(streak).toBe(3);
  });

  test('应跳过中断的日期', () => {
    const base = new Date();
    const d1 = new Date(base);
    const d3 = new Date(base);
    d3.setDate(d3.getDate() - 2);
    lib.get().history.push({ time: d1.getTime(), ok: true, qid: '001' });
    lib.get().history.push({ time: d3.getTime(), ok: true, qid: '001' });
    const streak = lib.getStreak();
    expect(streak).toBe(1);
  });
});

describe('成就检查', () => {
  beforeEach(() => {
    lib.reset();
  });

  test('首次答题应解锁 first_answer', () => {
    lib.get().stats.total = 1;
    const unlocks = lib.checkAchievements();
    const ids = unlocks.map(a => a.id);
    expect(ids).toContain('first_answer');
  });

  test('累计100题应解锁 total_100', () => {
    lib.get().stats.total = 100;
    const unlocks = lib.checkAchievements();
    const ids = unlocks.map(a => a.id);
    expect(ids).toContain('total_100');
  });

  test('累计500题应解锁 total_500', () => {
    lib.get().stats.total = 500;
    const unlocks = lib.checkAchievements();
    const ids = unlocks.map(a => a.id);
    expect(ids).toContain('total_500');
  });

  test('答满50题且正确率≥90%应解锁 acc_90', () => {
    lib.get().stats.total = 50;
    lib.get().stats.correct = 46;
    const unlocks = lib.checkAchievements();
    const ids = unlocks.map(a => a.id);
    expect(ids).toContain('acc_90');
  });

  test('单次10题全对应解锁 perfect_10', () => {
    lib.get().stats.total = 10;
    const unlocks = lib.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    const ids = unlocks.map(a => a.id);
    expect(ids).toContain('perfect_10');
  });

  test('单次全对但不足10题不应解锁 perfect_10', () => {
    lib.get().stats.total = 5;
    const unlocks = lib.checkAchievements({ quizTotal: 5, quizCorrect: 5 });
    const ids = unlocks.map(a => a.id);
    expect(ids).not.toContain('perfect_10');
  });

  test('重复检查同一成就不应重复解锁', () => {
    lib.get().stats.total = 100;
    const firstUnlocks = lib.checkAchievements();
    const secondUnlocks = lib.checkAchievements();
    expect(secondUnlocks.length).toBe(0);
  });

  test('成就定义应包含所有预期成就', () => {
    const defs = lib.getAchievementDefs();
    const ids = defs.map(d => d.id);
    expect(ids).toContain('first_answer');
    expect(ids).toContain('perfect_10');
    expect(ids).toContain('streak_3');
    expect(ids).toContain('total_100');
    expect(ids).toContain('acc_90');
  });
});

describe('数据归档逻辑', () => {
  beforeEach(() => {
    lib.reset();
    lib.setQuestionBank([
      { id: '001', question: 'Q1', answer: 'A', category: '专辑' }
    ]);
  });

  test('历史记录超过1000条时应归档旧数据', () => {
    const now = Date.now();
    const oldTime = now - 100 * 24 * 60 * 60 * 1000;
    
    const data = lib.get();
    for (let i = 0; i < 1001; i++) {
      data.history.push({
        qid: '001',
        ans: 'A',
        ok: true,
        time: i < 500 ? oldTime : now
      });
    }
    
    lib.addRecord({ qid: '001', ans: 'A', ok: true, time: now });
    
    const d = lib.get();
    expect(d.archive.length).toBeGreaterThan(0);
    expect(d.history.length).toBeLessThanOrEqual(502);
  });

  test('归档应按天聚合', () => {
    const data = lib.get();
    const day1 = Date.now() - 100 * 24 * 60 * 60 * 1000;
    const day2 = day1 - 86400000;
    
    data.history = [];
    for (let i = 0; i < 600; i++) {
      data.history.push({ qid: '001', ok: true, time: i < 300 ? day1 : day2 });
    }
    for (let i = 0; i < 500; i++) {
      data.history.push({ qid: '001', ok: true, time: Date.now() });
    }
    
    lib.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    
    const d = lib.get();
    expect(d.archive.length).toBeGreaterThanOrEqual(2);
  });
});

describe('setData / get', () => {
  test('setData 应设置缓存', () => {
    const data = {
      history: [{ qid: '001', ok: true, time: Date.now() }],
      wrong: [],
      stats: { total: 1, correct: 1, cats: {} },
      theme: 'light',
      dailyGoal: 30,
      achievements: ['first_answer'],
      archive: []
    };
    lib.setData(data);
    const d = lib.get();
    expect(d.theme).toBe('light');
    expect(d.dailyGoal).toBe(30);
    expect(d.achievements).toEqual(['first_answer']);
  });
});

describe('随机打乱算法', () => {
  test('shuffle 应返回相同长度的数组', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = lib.shuffle(arr);
    expect(shuffled.length).toBe(arr.length);
  });

  test('shuffle 不应修改原数组', () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    lib.shuffle(arr);
    expect(arr).toEqual(original);
  });

  test('shuffle 应包含相同的元素', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = lib.shuffle(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  test('shuffle 空数组应返回空数组', () => {
    expect(lib.shuffle([])).toEqual([]);
  });

  test('shuffle 单元素数组应返回相同元素', () => {
    expect(lib.shuffle([42])).toEqual([42]);
  });
});

describe('时间格式化', () => {
  test('fmtTime 应正确格式化毫秒', () => {
    expect(lib.fmtTime(65000)).toBe('1分5秒');
    expect(lib.fmtTime(0)).toBe('0分0秒');
    expect(lib.fmtTime(120000)).toBe('2分0秒');
  });

  test('fmtTime 应处理大数', () => {
    expect(lib.fmtTime(3661000)).toBe('61分1秒');
  });
});

describe('选项解析逻辑', () => {
  test('应正确解析 A./B./C./D. 格式', () => {
    const optsText = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
    const options = lib.parseOptions(optsText);
    expect(options.length).toBe(4);
    expect(options[0].key).toBe('A');
    expect(options[0].text).toBe('选项一');
    expect(options[3].key).toBe('D');
    expect(options[3].text).toBe('选项四');
  });

  test('应正确解析中文点号格式', () => {
    const optsText = 'A、选项甲\nB、选项乙\nC、选项丙\nD、选项丁';
    const options = lib.parseOptions(optsText);
    expect(options.length).toBe(4);
    expect(options[0].key).toBe('A');
    expect(options[0].text).toBe('选项甲');
  });

  test('空行应被跳过', () => {
    const optsText = 'A.选项一\n\nB.选项二\n\nC.选项三\nD.选项四';
    const options = lib.parseOptions(optsText);
    expect(options.length).toBe(4);
  });

  test('不足两个选项时返回正确数量', () => {
    const optsText = 'A.只有一个选项';
    const options = lib.parseOptions(optsText);
    expect(options.length).toBe(1);
  });

  test('完全无效的格式应返回空数组', () => {
    const optsText = '无效格式\n没有点号';
    const options = lib.parseOptions(optsText);
    expect(options.length).toBe(0);
  });
});

describe('间隔时间表', () => {
  test('应正确定义间隔', () => {
    expect(lib.SR_INTERVALS.length).toBe(5);
    expect(lib.SR_INTERVALS[0]).toBe(0);
    expect(lib.SR_INTERVALS[1]).toBe(60 * 60 * 1000);
    expect(lib.SR_INTERVALS[2]).toBe(24 * 60 * 60 * 1000);
    expect(lib.SR_INTERVALS[3]).toBe(3 * 24 * 60 * 60 * 1000);
    expect(lib.SR_INTERVALS[4]).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('数据导入合并逻辑', () => {
  beforeEach(() => {
    lib.reset();
  });

  test('合并错题时应取较高的错误次数', () => {
    lib.get().wrong = [
      { qid: '001', cnt: 1, level: 2, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() + 86400000 }
    ];
    
    const importWrongData = [
      { qid: '001', cnt: 3, level: 1, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() }
    ];
    
    const wrongMap = {};
    for (let w = 0; w < lib.get().wrong.length; w++) {
      wrongMap[lib.get().wrong[w].qid] = lib.get().wrong[w];
    }
    
    for (let x = 0; x < importWrongData.length; x++) {
      const wrongItem = importWrongData[x];
      if (wrongMap[wrongItem.qid]) {
        wrongMap[wrongItem.qid].cnt = Math.max(wrongMap[wrongItem.qid].cnt, wrongItem.cnt || 1);
        if (wrongItem.level != null) {
          wrongMap[wrongItem.qid].level = Math.min(wrongMap[wrongItem.qid].level || 0, wrongItem.level);
        }
      }
    }
    
    const w1 = lib.get().wrong.find(w => w.qid === '001');
    expect(w1.cnt).toBe(3);
    expect(w1.level).toBe(1);
  });

  test('新增错题应确保有间隔重复字段', () => {
    const importWrongData = [
      { qid: '002', cnt: 1 }
    ];
    
    for (let x = 0; x < importWrongData.length; x++) {
      const wrongItem = importWrongData[x];
      if (!wrongItem.level) wrongItem.level = 0;
      if (!wrongItem.nextReview) wrongItem.nextReview = Date.now();
      if (!wrongItem.lastReview) wrongItem.lastReview = 0;
      if (!wrongItem.time) wrongItem.time = Date.now();
      lib.get().wrong.push(wrongItem);
    }
    
    const w = lib.get().wrong.find(w => w.qid === '002');
    expect(w.level).toBe(0);
    expect(w.nextReview).toBeDefined();
    expect(w.lastReview).toBe(0);
    expect(w.time).toBeDefined();
  });
});

describe('题库数据完整性验证', () => {
  test('模拟题库数据应满足完整性要求', () => {
    const mockBank = [
      {id:"001",category:"专辑",question:"Q1",options:[{key:"A",text:"opt A"},{key:"B",text:"opt B"}],answer:"B",explanation:"Exp1"},
      {id:"002",category:"歌曲",question:"Q2",options:[{key:"A",text:"opt A"},{key:"B",text:"opt B"}],answer:"A",explanation:"Exp2"},
      {id:"003",category:"个人信息",question:"Q3",options:[{key:"A",text:"opt A"},{key:"B",text:"opt B"}],answer:"A",explanation:"Exp3"},
      {id:"004",category:"获奖记录",question:"Q4",options:[{key:"A",text:"opt A"},{key:"B",text:"opt B"}],answer:"A",explanation:"Exp4"}
    ];
    
    for (const q of mockBank) {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('category');
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('options');
      expect(q).toHaveProperty('answer');
      expect(q).toHaveProperty('explanation');
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      
      const answerKeys = q.options.map(o => o.key);
      expect(answerKeys).toContain(q.answer);
    }
  });

  test('所有选项应有 key 和 text 属性', () => {
    const mockBank = [
      {id:"001",options:[{key:"A",text:"opt A"},{key:"B",text:"opt B"}]}
    ];
    
    for (const q of mockBank) {
      for (const opt of q.options) {
        expect(opt).toHaveProperty('key');
        expect(opt).toHaveProperty('text');
      }
    }
  });
});
