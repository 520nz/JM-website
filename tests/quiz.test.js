/**
 * quiz.js 答题逻辑测试
 * 覆盖：答题判定、错题本更新、中断恢复、边界条件
 */

const { loadGlobals } = require('./helpers');

// 加载全局变量
loadGlobals();

// 模拟题库数据
const mockQuestionBank = [
  { 
    id: '001', 
    category: '专辑', 
    question: '测试题目1', 
    answer: 'A', 
    options: [
      { key: 'A', text: '选项A' }, 
      { key: 'B', text: '选项B' },
      { key: 'C', text: '选项C' },
      { key: 'D', text: '选项D' }
    ],
    explanation: '解释说明1'
  },
  { 
    id: '002', 
    category: '歌曲', 
    question: '测试题目2', 
    answer: 'B', 
    options: [
      { key: 'A', text: '选项A' }, 
      { key: 'B', text: '选项B' }
    ],
    explanation: '解释说明2'
  },
  { 
    id: '003', 
    category: '个人信息', 
    question: '测试题目3', 
    answer: 'C', 
    options: [
      { key: 'A', text: '选项A' }, 
      { key: 'B', text: '选项B' },
      { key: 'C', text: '选项C' }
    ],
    explanation: '解释说明3'
  }
];

describe('答题引擎逻辑', () => {
  beforeEach(() => {
    localStorage.clear();
    DB.clearCache();
    global.QUESTION_BANK = mockQuestionBank.slice();
    global.DEFAULT_QUESTION_BANK = mockQuestionBank.slice();
  });

  describe('shuffle() - 随机打乱数组', () => {
    // 提取 shuffle 函数进行测试
    const shuffle = (arr) => {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    };

    test('返回新数组，不修改原数组', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(arr).toEqual([1, 2, 3, 4, 5]);
      expect(shuffled).not.toBe(arr);
    });

    test('打乱后包含所有元素', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    test('处理空数组', () => {
      const arr = [];
      const shuffled = shuffle(arr);
      expect(shuffled).toEqual([]);
    });

    test('处理单元素数组', () => {
      const arr = [1];
      const shuffled = shuffle(arr);
      expect(shuffled).toEqual([1]);
    });
  });

  describe('答题判定逻辑', () => {
    test('正确答案判定', () => {
      const q = mockQuestionBank[0];
      const userAnswer = 'A';
      const isCorrect = userAnswer === q.answer;
      expect(isCorrect).toBe(true);
    });

    test('错误答案判定', () => {
      const q = mockQuestionBank[0];
      const userAnswer = 'B';
      const isCorrect = userAnswer === q.answer;
      expect(isCorrect).toBe(false);
    });

    test('答案区分大小写', () => {
      const q = mockQuestionBank[0];
      const userAnswer = 'a'; // 小写
      const isCorrect = userAnswer === q.answer;
      expect(isCorrect).toBe(false);
    });
  });

  describe('答题记录更新', () => {
    test('答对正确更新统计', () => {
      DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
      
      const stats = DB.get().stats;
      expect(stats.total).toBe(1);
      expect(stats.correct).toBe(1);
    });

    test('答错正确更新统计', () => {
      DB.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() });
      
      const stats = DB.get().stats;
      expect(stats.total).toBe(1);
      expect(stats.correct).toBe(0);
    });

    test('答错自动加入错题本', () => {
      DB.addWrong('001');
      
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].qid).toBe('001');
    });
  });

  describe('模式选择逻辑', () => {
    // 提取 getCount 逻辑进行测试
    const getCount = (mode) => {
      const m = { quick: 10, standard: 20, intensive: 30 };
      return m[mode] || 10;
    };

    test('quick 模式返回 10 题', () => {
      expect(getCount('quick')).toBe(10);
    });

    test('standard 模式返回 20 题', () => {
      expect(getCount('standard')).toBe(20);
    });

    test('intensive 模式返回 30 题', () => {
      expect(getCount('intensive')).toBe(30);
    });

    test('未知模式默认返回 10 题', () => {
      expect(getCount('unknown')).toBe(10);
      expect(getCount()).toBe(10);
    });
  });

  describe('分类答题逻辑', () => {
    test('按分类筛选题目', () => {
      const cat = '专辑';
      const filtered = global.QUESTION_BANK.filter(q => q.category === cat);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('001');
    });

    test('空分类返回空数组', () => {
      const cat = '不存在分类';
      const filtered = global.QUESTION_BANK.filter(q => q.category === cat);
      expect(filtered.length).toBe(0);
    });
  });

  describe('错题本复习逻辑', () => {
    test('错题本为空时不启动复习', () => {
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(0);
    });

    test('优先获取到期错题', () => {
      // 添加一个错题
      DB.addWrong('001');
      
      const due = DB.getDueWrong();
      expect(due.length).toBe(1);
      expect(due[0].qid).toBe('001');
    });

    test('错题本复习时答对升级等级', () => {
      DB.addWrong('001');
      DB.reviewCorrect('001');
      
      const wrong = DB.getWrong();
      expect(wrong[0].level).toBe(1);
    });

    test('错题本复习时答错重置等级', () => {
      DB.addWrong('001');
      DB.reviewCorrect('001');
      DB.reviewWrong('001');
      
      const wrong = DB.getWrong();
      expect(wrong[0].level).toBe(0);
    });
  });

  describe('计时器逻辑', () => {
    test('格式化时间', () => {
      // 提取 fmtTime 逻辑
      const fmtTime = (ms) => {
        var sec = Math.floor(ms / 1000);
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return m + '分' + s + '秒';
      };

      expect(fmtTime(0)).toBe('0分0秒');
      expect(fmtTime(1000)).toBe('0分1秒');
      expect(fmtTime(60000)).toBe('1分0秒');
      expect(fmtTime(90000)).toBe('1分30秒');
      expect(fmtTime(3661000)).toBe('61分1秒');
    });

    test('计算百分比', () => {
      const correct = 7;
      const total = 10;
      const pct = Math.round(correct / total * 100);
      expect(pct).toBe(70);
    });

    test('处理零总数', () => {
      const correct = 0;
      const total = 0;
      const pct = total > 0 ? Math.round(correct / total * 100) : 0;
      expect(pct).toBe(0);
    });
  });

  describe('中断恢复逻辑', () => {
    test('保存答题进度', () => {
      const state = {
        quiz: mockQuestionBank,
        idx: 1,
        correctCount: 1,
        startTime: Date.now(),
        mode: 'quick'
      };
      
      Session.save(state);
      
      const loaded = Session.load();
      expect(loaded.quizIds).toHaveLength(3);
      expect(loaded.idx).toBe(1);
      expect(loaded.correctCount).toBe(1);
    });

    test('恢复答题进度', () => {
      // 保存会话
      const state = {
        quiz: mockQuestionBank,
        idx: 1,
        correctCount: 1,
        startTime: Date.now() - 60000, // 1分钟前
        mode: 'standard'
      };
      Session.save(state);
      
      // 加载会话
      const loaded = Session.load();
      expect(loaded).not.toBeNull();
      expect(loaded.mode).toBe('standard');
    });

    test('清除会话后无法恢复', () => {
      const state = {
        quiz: mockQuestionBank,
        idx: 0,
        correctCount: 0,
        startTime: Date.now(),
        mode: 'quick'
      };
      Session.save(state);
      
      Session.clear();
      
      const loaded = Session.load();
      expect(loaded).toBeNull();
    });

    test('处理部分已答完的情况', () => {
      const state = {
        quiz: mockQuestionBank,
        idx: 3, // 已答完所有题
        correctCount: 2,
        startTime: Date.now(),
        mode: 'quick'
      };
      Session.save(state);
      
      const loaded = Session.load();
      expect(loaded.idx).toBe(3);
      // 业务逻辑应判断 idx >= quizIds.length 时不恢复
    });
  });
});

describe('边界条件和极端情况', () => {
  beforeEach(() => {
    localStorage.clear();
    DB.clearCache();
    global.QUESTION_BANK = mockQuestionBank.slice();
  });

  test('题目数量不足时的处理', () => {
    // 模拟分类只有 1 题的情况
    const cat = '个人信息';
    const filtered = global.QUESTION_BANK.filter(q => q.category === cat);
    const count = 10; // quick 模式需要 10 题
    const quiz = filtered.length < count ? filtered : filtered.slice(0, count);
    expect(quiz.length).toBe(1);
  });

  test('所有题目都答错的情况', () => {
    for (let i = 0; i < 5; i++) {
      DB.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() + i });
    }
    
    const stats = DB.get().stats;
    expect(stats.total).toBe(5);
    expect(stats.correct).toBe(0);
    expect(Math.round(stats.correct / stats.total * 100)).toBe(0);
  });

  test('所有题目都答对的情况', () => {
    for (let i = 0; i < 5; i++) {
      DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() + i });
    }
    
    const stats = DB.get().stats;
    expect(stats.total).toBe(5);
    expect(stats.correct).toBe(5);
    expect(Math.round(stats.correct / stats.total * 100)).toBe(100);
  });

  test('重复答同一题目的处理', () => {
    // 答对 3 次，答错 2 次
    DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
    DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() + 1000 });
    DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() + 2000 });
    DB.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() + 3000 });
    DB.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() + 4000 });
    
    const stats = DB.get().stats;
    expect(stats.total).toBe(5);
    expect(stats.correct).toBe(3);
    expect(DB.get().stats.cats['专辑'].t).toBe(5);
  });

  test('错题本达到最大等级后移除', () => {
    DB.addWrong('001');
    
    // 连续答对 5 次
    for (let i = 0; i < 5; i++) {
      DB.reviewCorrect('001');
    }
    
    expect(DB.getWrong().length).toBe(0);
  });

  test('同一错题反复答对答错', () => {
    DB.addWrong('001');
    
    // 答对升级
    DB.reviewCorrect('001');
    expect(DB.getWrong()[0].level).toBe(1);
    
    // 答错重置
    DB.reviewWrong('001');
    expect(DB.getWrong()[0].level).toBe(0);
    expect(DB.getWrong()[0].cnt).toBe(2);
    
    // 再次答对升级
    DB.reviewCorrect('001');
    expect(DB.getWrong()[0].level).toBe(1);
  });

  test('处理无效的 localStorage 数据', () => {
    localStorage.setItem('jj_quiz_v2', '{ invalid json }');
    DB.clearCache();
    
    // 应该返回默认值而不崩溃
    const data = DB.get();
    expect(data.stats.total).toBe(0);
  });

  test('处理 sessionStorage 无效数据', () => {
    sessionStorage.setItem('jj_quiz_session', 'not json');
    
    const loaded = Session.load();
    expect(loaded).toBeNull();
  });
});

describe('间隔重复算法验证', () => {
  beforeEach(() => {
    localStorage.clear();
    DB.clearCache();
    global.QUESTION_BANK = mockQuestionBank.slice();
  });

  test('Level 0 立即可复习', () => {
    DB.addWrong('001');
    
    const wrong = DB.getWrong()[0];
    expect(wrong.level).toBe(0);
    expect(wrong.nextReview).toBeDefined();
    expect(wrong.nextReview).toBeLessThanOrEqual(Date.now());
  });

  test('Level 1 一小时后可复习', () => {
    DB.addWrong('001');
    DB.reviewCorrect('001');
    
    const wrong = DB.getWrong()[0];
    expect(wrong.level).toBe(1);
    
    const expectedNextReview = wrong.lastReview + SR_INTERVALS[1];
    expect(Math.abs(wrong.nextReview - expectedNextReview)).toBeLessThan(1000); // 允许 1 秒误差
  });

  test('Level 2 一天后可复习', () => {
    DB.addWrong('001');
    DB.reviewCorrect('001');
    DB.reviewCorrect('001');
    
    const wrong = DB.getWrong()[0];
    expect(wrong.level).toBe(2);
    
    const expectedNextReview = wrong.lastReview + SR_INTERVALS[2];
    expect(Math.abs(wrong.nextReview - expectedNextReview)).toBeLessThan(1000);
  });

  test('答错立即变为可复习状态', () => {
    // 模拟一个未到期的错题
    DB.get().wrong.push({
      qid: '001',
      cnt: 1,
      level: 3,
      time: Date.now(),
      lastReview: Date.now(),
      nextReview: Date.now() + 100000 // 未来
    });
    DB.save();
    DB.clearCache();
    
    // 答错
    DB.reviewWrong('001');
    
    const wrong = DB.getWrong()[0];
    expect(wrong.level).toBe(0);
    expect(wrong.nextReview).toBeLessThanOrEqual(Date.now());
  });

  test('间隔重复不影响错误计数', () => {
    DB.addWrong('001');
    DB.addWrong('001');
    DB.addWrong('001');
    
    expect(DB.getWrong()[0].cnt).toBe(3);
    
    // 答对升级不应改变计数
    DB.reviewCorrect('001');
    expect(DB.getWrong()[0].cnt).toBe(3);
    
    // 答错增加计数
    DB.reviewWrong('001');
    expect(DB.getWrong()[0].cnt).toBe(4);
  });
});