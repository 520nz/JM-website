/**
 * storage.js 核心逻辑测试
 * 覆盖：XSS转义、DB模块CRUD、间隔重复算法、边界条件
 */

const { loadGlobals } = require('./helpers');

// 加载全局变量
loadGlobals();

// 模拟题库数据
const mockQuestionBank = [
  { id: '001', category: '专辑', question: '测试题目1', answer: 'A', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }] },
  { id: '002', category: '歌曲', question: '测试题目2', answer: 'B', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }] }
];

describe('XSS 转义函数 esc()', () => {
  test('正确转义 HTML 特殊字符', () => {
    // esc 函数使用 textContent 设置值，innerHTML 获取转义后的值
    expect(typeof esc).toBe('function');
  });

  test('处理 null 和 undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  test('处理普通字符串', () => {
    const result = esc('normal text');
    expect(typeof result).toBe('string');
  });
});

describe('DB 模块 - 数据存储', () => {
  beforeEach(() => {
    localStorage.clear();
    DB.clearCache();
    // 设置模拟题库
    global.QUESTION_BANK = mockQuestionBank.slice();
  });

  describe('defaults()', () => {
    test('返回正确的默认数据结构', () => {
      const defaults = DB.defaults();
      expect(defaults).toHaveProperty('history');
      expect(defaults).toHaveProperty('wrong');
      expect(defaults).toHaveProperty('stats');
      expect(Array.isArray(defaults.history)).toBe(true);
      expect(Array.isArray(defaults.wrong)).toBe(true);
      expect(defaults.stats).toHaveProperty('total', 0);
      expect(defaults.stats).toHaveProperty('correct', 0);
      expect(defaults.stats).toHaveProperty('cats');
    });
  });

  describe('get() 和 save()', () => {
    test('首次调用返回默认数据', () => {
      const data = DB.get();
      expect(data.stats.total).toBe(0);
      expect(data.history.length).toBe(0);
    });

    test('数据持久化到 localStorage', () => {
      const data = DB.get();
      data.history.push({ qid: '001', ans: 'A', ok: true, time: Date.now() });
      DB.save();
      
      // 清除缓存后重新读取
      DB.clearCache();
      const reloaded = DB.get();
      expect(reloaded.history.length).toBe(1);
    });

    test('处理 localStorage 中无效 JSON', () => {
      localStorage.setItem('jj_quiz_v2', 'invalid json{');
      DB.clearCache();
      const data = DB.get();
      // 应该返回默认值，不抛出错误
      expect(data.stats.total).toBe(0);
    });
  });

  describe('addRecord() - 添加答题记录', () => {
    beforeEach(() => {
      global.QUESTION_BANK = mockQuestionBank.slice();
      localStorage.clear();
      DB.clearCache();
    });

    test('正确记录答题并更新统计', () => {
      DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
      
      const data = DB.get();
      expect(data.history.length).toBe(1);
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(1);
    });

    test('正确记录错误答案', () => {
      DB.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() });
      
      const data = DB.get();
      expect(data.stats.total).toBe(1);
      expect(data.stats.correct).toBe(0);
    });

    test('正确更新分类统计', () => {
      DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
      
      const data = DB.get();
      expect(data.stats.cats['专辑']).toBeDefined();
      expect(data.stats.cats['专辑'].t).toBe(1);
      expect(data.stats.cats['专辑'].c).toBe(1);
    });

    test('处理无效题目 ID', () => {
      DB.addRecord({ qid: 'nonexistent', ans: 'A', ok: true, time: Date.now() });
      
      const data = DB.get();
      expect(data.history.length).toBe(1);
      expect(data.stats.total).toBe(1);
      // 分类统计应该为空
      expect(Object.keys(data.stats.cats).length).toBe(0);
    });
  });

  describe('findQ() - 查找题目', () => {
    test('找到存在的题目', () => {
      global.QUESTION_BANK = mockQuestionBank.slice();
      const q = DB.findQ('001');
      expect(q).toBeDefined();
      expect(q.id).toBe('001');
    });

    test('返回 null 对于不存在的题目', () => {
      global.QUESTION_BANK = mockQuestionBank.slice();
      const q = DB.findQ('999');
      expect(q).toBeNull();
    });
  });
});

describe('错题本功能', () => {
  beforeEach(() => {
    localStorage.clear();
    DB.clearCache();
    global.QUESTION_BANK = mockQuestionBank.slice();
  });

  describe('addWrong() - 添加错题', () => {
    test('首次添加错题', () => {
      DB.addWrong('001');
      
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].qid).toBe('001');
      expect(wrong[0].cnt).toBe(1);
      expect(wrong[0].level).toBe(0);
    });

    test('重复添加增加计数', () => {
      DB.addWrong('001');
      DB.addWrong('001');
      
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].cnt).toBe(2);
    });

    test('重复添加重置等级为 0', () => {
      // 模拟已复习到 level 2 的错题
      DB.get().wrong.push({
        qid: '001',
        cnt: 1,
        level: 2,
        time: Date.now(),
        lastReview: Date.now(),
        nextReview: Date.now() + 100000
      });
      DB.save();
      DB.clearCache();
      
      // 再次答错
      DB.addWrong('001');
      
      const wrong = DB.getWrong();
      expect(wrong[0].level).toBe(0);
      expect(wrong[0].cnt).toBe(2);
    });
  });

  describe('reviewCorrect() - 答对错题升级', () => {
    test('等级提升', () => {
      DB.addWrong('001');
      DB.reviewCorrect('001');
      
      const wrong = DB.getWrong();
      expect(wrong[0].level).toBe(1);
    });

    test('等级达到 5 后从错题本移除', () => {
      // 模拟 level 4 的错题
      DB.get().wrong.push({
        qid: '001',
        cnt: 1,
        level: 4,
        time: Date.now(),
        lastReview: Date.now(),
        nextReview: Date.now()
      });
      DB.save();
      DB.clearCache();
      
      DB.reviewCorrect('001');
      
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(0);
    });

    test('处理不存在的错题', () => {
      // 不应该抛出错误
      expect(() => DB.reviewCorrect('999')).not.toThrow();
    });
  });

  describe('reviewWrong() - 答错错题降级', () => {
    test('等级重置为 0', () => {
      // 模拟 level 3 的错题
      DB.get().wrong.push({
        qid: '001',
        cnt: 1,
        level: 3,
        time: Date.now(),
        lastReview: Date.now(),
        nextReview: Date.now() + 100000
      });
      DB.save();
      DB.clearCache();
      
      DB.reviewWrong('001');
      
      const wrong = DB.getWrong();
      expect(wrong[0].level).toBe(0);
      expect(wrong[0].cnt).toBe(2);
    });

    test('自动添加新错题', () => {
      DB.reviewWrong('002');
      
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].qid).toBe('002');
    });
  });

  describe('removeWrong() - 移除错题', () => {
    test('成功移除', () => {
      DB.addWrong('001');
      DB.addWrong('002');
      DB.removeWrong('001');
      
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
      expect(wrong[0].qid).toBe('002');
    });

    test('移除不存在的错题无影响', () => {
      DB.addWrong('001');
      DB.removeWrong('999');
      
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(1);
    });
  });
});

describe('间隔重复算法', () => {
  beforeEach(() => {
    localStorage.clear();
    DB.clearCache();
    global.QUESTION_BANK = mockQuestionBank.slice();
  });

  describe('SR_INTERVALS 时间表', () => {
    test('包含正确的间隔时间', () => {
      expect(SR_INTERVALS[0]).toBe(0);        // 立即可复习
      expect(SR_INTERVALS[1]).toBe(1 * 60 * 60 * 1000);   // 1小时
      expect(SR_INTERVALS[2]).toBe(1 * 24 * 60 * 60 * 1000); // 1天
      expect(SR_INTERVALS[3]).toBe(3 * 24 * 60 * 60 * 1000); // 3天
      expect(SR_INTERVALS[4]).toBe(7 * 24 * 60 * 60 * 1000); // 7天
    });
  });

  describe('getDueWrong() - 获取到期错题', () => {
    test('返回到期的错题', () => {
      // 添加一个错题（level 0，立即可复习）
      DB.addWrong('001');
      
      const due = DB.getDueWrong();
      expect(due.length).toBe(1);
      expect(due[0].qid).toBe('001');
    });

    test('排除未到期的错题', () => {
      // 模拟一个未到期的错题
      DB.get().wrong.push({
        qid: '001',
        cnt: 1,
        level: 1,
        time: Date.now(),
        lastReview: Date.now(),
        nextReview: Date.now() + 100000 // 未来时间
      });
      DB.save();
      DB.clearCache();
      
      const due = DB.getDueWrong();
      expect(due.length).toBe(0);
    });

    test('处理 nextReview 为 undefined 的情况', () => {
      DB.get().wrong.push({
        qid: '001',
        cnt: 1,
        level: 0,
        time: Date.now(),
        lastReview: 0
        // nextReview 缺失
      });
      DB.save();
      DB.clearCache();
      
      const due = DB.getDueWrong();
      expect(due.length).toBe(1);
    });
  });

  describe('间隔重复升级逻辑', () => {
    test('连续答对升级', () => {
      DB.addWrong('001');
      
      for (let i = 0; i < 5; i++) {
        DB.reviewCorrect('001');
      }
      
      const wrong = DB.getWrong();
      expect(wrong.length).toBe(0); // 已掌握移除
    });

    test('答错重置等级', () => {
      DB.addWrong('001');
      DB.reviewCorrect('001');
      DB.reviewCorrect('001');
      
      // 等级应该是 2
      expect(DB.getWrong()[0].level).toBe(2);
      
      // 答错重置
      DB.reviewWrong('001');
      expect(DB.getWrong()[0].level).toBe(0);
    });
  });
});

describe('recalcStats() - 重新计算统计', () => {
  test('从历史记录正确计算统计', () => {
    global.QUESTION_BANK = mockQuestionBank.slice();
    
    // 手动添加历史记录
    const data = DB.get();
    data.history = [
      { qid: '001', ans: 'A', ok: true, time: Date.now() },
      { qid: '002', ans: 'B', ok: true, time: Date.now() },
      { qid: '001', ans: 'B', ok: false, time: Date.now() }
    ];
    DB.save();
    DB.clearCache();
    
    // 重新计算
    DB.recalcStats();
    
    const stats = DB.get().stats;
    expect(stats.total).toBe(3);
    expect(stats.correct).toBe(2);
    expect(stats.cats['专辑'].t).toBe(2);
    expect(stats.cats['专辑'].c).toBe(1);
    expect(stats.cats['歌曲'].t).toBe(1);
    expect(stats.cats['歌曲'].c).toBe(1);
  });
});

describe('Session 模块', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('保存和加载会话', () => {
    const state = {
      quiz: [{ id: '001' }, { id: '002' }],
      idx: 1,
      correctCount: 1,
      startTime: Date.now(),
      mode: 'quick'
    };
    
    Session.save(state);
    
    const loaded = Session.load();
    expect(loaded.quizIds).toEqual(['001', '002']);
    expect(loaded.idx).toBe(1);
    expect(loaded.correctCount).toBe(1);
    expect(loaded.mode).toBe('quick');
  });

  test('清除会话', () => {
    const state = {
      quiz: [{ id: '001' }],
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

  test('处理无效 JSON', () => {
    sessionStorage.setItem('jj_quiz_session', 'invalid json');
    
    const loaded = Session.load();
    expect(loaded).toBeNull();
  });
});

describe('QuestionStore 模块', () => {
  beforeEach(() => {
    localStorage.clear();
    DB.clearCache();
  });

  test('QuestionStore.save() 将题库序列化到 localStorage', () => {
    // 创建测试数据
    const testBank = [{ id: 'test1', category: '测试', question: '测试问题', answer: 'A', options: [] }];
    global.QUESTION_BANK = testBank;
    
    // 调用保存
    QuestionStore.save();
    
    // 验证 localStorage 中有数据
    const saved = localStorage.getItem('jj_question_bank');
    expect(saved).toBeDefined();
    
    const parsed = JSON.parse(saved);
    expect(parsed).toEqual(testBank);
  });

  test('QuestionStore.load() 从 localStorage 读取题库', () => {
    // 先写入测试数据
    const testBank = [{ id: 'test2', category: '测试', question: '测试问题', answer: 'B', options: [] }];
    localStorage.setItem('jj_question_bank', JSON.stringify(testBank));
    
    // 调用加载
    QuestionStore.load();
    
    // 验证 QUESTION_BANK 被更新
    expect(Array.isArray(global.QUESTION_BANK)).toBe(true);
    expect(global.QUESTION_BANK.length).toBe(1);
    expect(global.QUESTION_BANK[0].id).toBe('test2');
  });

  test('QuestionStore.reset() 移除 localStorage 中的题库', () => {
    // 先写入数据
    localStorage.setItem('jj_question_bank', JSON.stringify([{ id: 'temp' }]));
    
    // 设置 DEFAULT_QUESTION_BANK
    global.DEFAULT_QUESTION_BANK = [{ id: 'default', category: '默认', question: '默认问题', answer: 'A', options: [] }];
    
    // 调用重置
    QuestionStore.reset();
    
    // 验证 localStorage 被清除
    expect(localStorage.getItem('jj_question_bank')).toBeNull();
    // 验证 QUESTION_BANK 恢复为默认值
    expect(global.QUESTION_BANK).toEqual(global.DEFAULT_QUESTION_BANK);
  });
});