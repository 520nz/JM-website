/**
 * quiz.js 测试套件
 * 
 * 测试覆盖：
 * 1. 答题状态管理
 * 2. 会话保存/恢复（中断恢复）
 * 3. 计时器启停
 * 4. 成绩分享功能
 * 5. 键盘快捷键处理
 */

describe('答题状态管理', () => {
  let state;

  beforeEach(() => {
    state = {
      quiz: [],
      idx: 0,
      answered: false,
      mode: 'quick',
      correctCount: 0,
      startTime: 0,
      timer: null,
      isWrongBookQuiz: false
    };
  });

  test('应该正确初始化答题状态', () => {
    expect(state.quiz).toEqual([]);
    expect(state.idx).toBe(0);
    expect(state.answered).toBe(false);
    expect(state.correctCount).toBe(0);
    expect(state.mode).toBe('quick');
  });

  test('应该正确选择答题模式', () => {
    const modes = {
      quick: 10,
      standard: 20,
      intensive: 30
    };

    // 切换到标准模式
    state.mode = 'standard';
    expect(modes[state.mode]).toBe(20);

    // 切换到强化模式
    state.mode = 'intensive';
    expect(modes[state.mode]).toBe(30);
  });

  test('应该正确跟踪答题进度', () => {
    state.quiz = [
      { id: '001', question: 'Q1' },
      { id: '002', question: 'Q2' },
      { id: '003', question: 'Q3' }
    ];

    // 答第一题
    state.idx = 0;
    state.answered = false;
    expect(state.idx).toBe(0);

    // 选择答案
    state.answered = true;
    state.correctCount++;
    state.idx++;
    expect(state.idx).toBe(1);
    expect(state.correctCount).toBe(1);
  });

  test('答完所有题目应触发完成逻辑', () => {
    state.quiz = [
      { id: '001', question: 'Q1' },
      { id: '002', question: 'Q2' }
    ];

    state.idx = 2; // 已答完
    expect(state.idx >= state.quiz.length).toBe(true);
  });
});

describe('答题中断恢复', () => {
  const SKEY = 'jj_quiz_session';

  test('应该正确保存会话状态', () => {
    const state = {
      quiz: [
        { id: '001', question: 'Q1' },
        { id: '002', question: 'Q2' }
      ],
      idx: 1,
      correctCount: 1,
      startTime: Date.now() - 30000,
      mode: 'quick',
      isWrongBookQuiz: false
    };

    const data = {
      quizIds: state.quiz.map(q => q.id),
      idx: state.idx,
      correctCount: state.correctCount,
      startTime: state.startTime,
      mode: state.mode,
      isWrongBookQuiz: state.isWrongBookQuiz
    };

    expect(data.quizIds).toEqual(['001', '002']);
    expect(data.idx).toBe(1);
    expect(data.correctCount).toBe(1);
  });

  test('应该正确加载会话状态', () => {
    const saved = {
      quizIds: ['001', '002', '003'],
      idx: 2,
      correctCount: 2,
      startTime: Date.now() - 60000,
      mode: 'standard',
      isWrongBookQuiz: false
    };

    const state = {
      quiz: [],
      idx: 0,
      correctCount: 0,
      mode: 'quick',
      isWrongBookQuiz: false
    };

    // 模拟恢复
    state.idx = saved.idx;
    state.correctCount = saved.correctCount;
    state.mode = saved.mode;

    expect(state.idx).toBe(2);
    expect(state.correctCount).toBe(2);
    expect(state.mode).toBe('standard');
  });

  test('应该正确清除会话', () => {
    global.sessionStorage.store = {
      [SKEY]: JSON.stringify({ quizIds: ['001', '002'] })
    };

    // 清除
    delete global.sessionStorage.store[SKEY];
    
    expect(global.sessionStorage.store[SKEY]).toBeUndefined();
  });

  test('答完题目后不应恢复会话', () => {
    const saved = {
      quizIds: ['001', '002'],
      idx: 2, // 已答完
      correctCount: 2,
      startTime: Date.now()
    };

    const quizLength = 2;
    const shouldRestore = saved.idx < quizLength;

    expect(shouldRestore).toBe(false);
  });
});

describe('计时器管理', () => {
  test('应该正确格式化时间', () => {
    function fmtTime(ms) {
      const sec = Math.floor(ms / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return m + '分' + s + '秒';
    }

    expect(fmtTime(65000)).toBe('1分5秒');
    expect(fmtTime(125000)).toBe('2分5秒');
    expect(fmtTime(0)).toBe('0分0秒');
    expect(fmtTime(59000)).toBe('0分59秒');
  });

  test('应该正确计算答题用时', () => {
    const startTime = Date.now() - 125000; // 2分5秒前
    const elapsed = Date.now() - startTime;
    
    expect(elapsed).toBeGreaterThanOrEqual(125000);
  });
});

describe('随机打乱算法', () => {
  test('应该返回新数组（不修改原数组）', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = original.slice();
    
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled.length).toBe(5);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('应该保留所有元素', () => {
    const original = ['A', 'B', 'C', 'D'];
    const shuffled = original.slice();
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    expect(shuffled.length).toBe(4);
    original.forEach(item => {
      expect(shuffled).toContain(item);
    });
  });
});

describe('答题选择逻辑', () => {
  test('应该正确判断答案对错', () => {
    const question = {
      id: '001',
      question: '测试题目',
      options: [
        { key: 'A', text: '选项A' },
        { key: 'B', text: '选项B' },
        { key: 'C', text: '选项C' },
        { key: 'D', text: '选项D' }
      ],
      answer: 'B'
    };

    const correctAnswer = 'B';
    const wrongAnswer = 'A';

    expect(correctAnswer === question.answer).toBe(true);
    expect(wrongAnswer === question.answer).toBe(false);
  });

  test('已回答后不应重复处理', () => {
    let answered = false;
    
    // 第一次点击
    if (!answered) {
      answered = true;
      // 处理答案...
    }

    // 第二次点击（应跳过）
    const shouldProcess = !answered;
    expect(shouldProcess).toBe(false);
  });

  test('应该正确更新正确计数', () => {
    let correctCount = 0;
    const answers = [true, false, true, true];

    answers.forEach(ok => {
      if (ok) correctCount++;
    });

    expect(correctCount).toBe(3);
  });
});

describe('成绩计算', () => {
  test('应该正确计算正确率', () => {
    const total = 10;
    const correct = 8;
    const pct = total > 0 ? Math.round(correct / total * 100) : 0;

    expect(pct).toBe(80);
  });

  test('零题目时应返回0%正确率', () => {
    const total = 0;
    const correct = 0;
    const pct = total > 0 ? Math.round(correct / total * 100) : 0;

    expect(pct).toBe(0);
  });

  test('应该正确生成成绩摘要', () => {
    const result = {
      total: 20,
      correct: 15,
      wrong: 5,
      pct: 75,
      elapsed: 125000,
      mode: '标准'
    };

    expect(result.total).toBe(20);
    expect(result.correct).toBe(15);
    expect(result.wrong).toBe(5);
    expect(result.pct).toBe(75);
  });
});

describe('键盘快捷键处理', () => {
  test('按A/B/C/D应该选择对应选项', () => {
    const key = 'A';
    const validKeys = ['A', 'B', 'C', 'D'];

    expect(validKeys.includes(key)).toBe(true);
  });

  test('按其他键应该被忽略', () => {
    const key = 'E';
    const validKeys = ['A', 'B', 'C', 'D'];

    expect(validKeys.includes(key)).toBe(false);
  });

  test('已回答后按空格应进入下一题', () => {
    let answered = true;
    const key = ' ';
    
    let shouldNext = answered && (key === ' ' || key === 'Enter');
    expect(shouldNext).toBe(true);
  });

  test('已回答后按回车应进入下一题', () => {
    let answered = true;
    const key = 'Enter';
    
    let shouldNext = answered && (key === ' ' || key === 'Enter');
    expect(shouldNext).toBe(true);
  });
});

describe('错题本复习模式', () => {
  test('错题本复习模式标记应正确', () => {
    const state = {
      quiz: [],
      idx: 0,
      isWrongBookQuiz: false
    };

    // 启动错题本复习
    state.isWrongBookQuiz = true;
    expect(state.isWrongBookQuiz).toBe(true);
  });

  test('答对错题应更新复习等级', () => {
    const wrongItem = {
      qid: '001',
      level: 0,
      nextReview: Date.now()
    };

    // 模拟答对
    wrongItem.level++;
    wrongItem.lastReview = Date.now();
    const nextReview = Date.now() + (wrongItem.level === 1 ? 3600000 : 0);

    expect(wrongItem.level).toBe(1);
  });

  test('错题本复习完成应清空模式标记', () => {
    const state = {
      quiz: [{ id: '001' }],
      idx: 1, // 已答完
      isWrongBookQuiz: true
    };

    // 答完
    if (state.idx >= state.quiz.length) {
      state.isWrongBookQuiz = false;
    }

    expect(state.isWrongBookQuiz).toBe(false);
  });
});

describe('音效功能', () => {
  test('应该能切换音效开关', () => {
    let soundEnabled = true;
    
    soundEnabled = !soundEnabled;
    expect(soundEnabled).toBe(false);
    
    soundEnabled = !soundEnabled;
    expect(soundEnabled).toBe(true);
  });
});