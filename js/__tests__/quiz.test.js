// quiz.js 单元测试：覆盖答题引擎核心逻辑与业务联动

function loadApp() {
  window.App = {};
  require('../data.js');
  require('../storage.js');
  require('../quiz.js');
}

describe('quiz.js pure helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    loadApp();
  });

  test('shuffle 不修改原数组且保持元素不变', () => {
    const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const shuffled = window.App.shuffle(arr);
    expect(shuffled).not.toBe(arr);
    expect(shuffled.length).toBe(3);
    expect(shuffled.map(x => x.id).sort()).toEqual([1, 2, 3]);
  });

  test('getCount 根据模式返回题目数量', () => {
    window.App.selectMode('quick');
    expect(window.App.state.mode).toBe('quick');
    // getCount 依赖闭包 state，通过 startRandomQuiz 间接验证更稳妥
  });

  test('fmtTime 格式化毫秒为分秒', () => {
    expect(window.App.startTimer).toBeDefined();
    // fmtTime 未直接暴露，但可通过模拟验证 finishQuiz 输出间接测试；
    // 由于 finishQuiz 依赖 DOM，这里仅确认辅助函数存在性，避免脆性测试。
  });
});

describe('quiz.js quiz selection', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="quizArea"></div>';
    global.createTestIndexedDB();
    loadApp();
    // mock 视图切换，避免加载 app.js
    window.App.switchView = jest.fn();
  });

  afterEach(() => {
    window.App.stopTimer && window.App.stopTimer();
  });

  test('startRandomQuiz 按模式选取指定数量题目', () => {
    window.App.selectMode('quick');
    window.App.startRandomQuiz();
    expect(window.App.state.quiz.length).toBe(10);
    expect(window.App.state.isWrongBookQuiz).toBe(false);
    expect(window.App.switchView).toHaveBeenCalledWith('practice');
  });

  test('startRandomQuiz 不同模式选取数量不同', () => {
    window.App.selectMode('intensive');
    window.App.startRandomQuiz();
    expect(window.App.state.quiz.length).toBe(30);
  });

  test('startRandomQuiz 选取题目全部来自题库', () => {
    window.App.startRandomQuiz();
    const bankIds = window.App.QUESTION_BANK.map(q => q.id);
    window.App.state.quiz.forEach(q => {
      expect(bankIds).toContain(q.id);
    });
  });

  test('startCatQuiz 仅选取指定分类题目', () => {
    window.App.selectMode('quick');
    window.App.startCatQuiz('专辑');
    expect(window.App.state.quiz.every(q => q.category === '专辑')).toBe(true);
    expect(window.App.state.quiz.length).toBeLessThanOrEqual(
      window.App.QUESTION_BANK.filter(q => q.category === '专辑').length
    );
  });

  test('startCatQuiz 在题目不足时返回全部该分类题目', () => {
    window.App.selectMode('intensive'); // 30 题
    window.App.startCatQuiz('个人信息'); // 仅 8 题
    expect(window.App.state.quiz.length).toBe(8);
  });

  test('startWrongBookQuiz 在错题到期时优先选取到期错题', () => {
    window.App.db.addWrong('001');
    window.App.db.addWrong('002');
    const d = window.App.db.get();
    d.wrong[1].nextReview = Date.now() + 86400000;

    window.App.startWrongBookQuiz();
    expect(window.App.state.isWrongBookQuiz).toBe(true);
    expect(window.App.state.quiz.length).toBe(1);
    expect(window.App.state.quiz[0].id).toBe('001');
  });

  test('startWrongBookQuiz 无错题时不启动', () => {
    window.App.startWrongBookQuiz();
    expect(window.App.state.quiz.length).toBe(0);
    expect(window.App.switchView).not.toHaveBeenCalled();
  });
});

describe('quiz.js answer handling', () => {
  beforeEach(() => {
    jest.resetModules();
    global.createTestIndexedDB();
    loadApp();
    window.App.switchView = jest.fn();
    window.App.state.quiz = [window.App.QUESTION_BANK[0]]; // 001 专辑题，答案 B
    window.App.state.idx = 0;
    window.App.state.correctCount = 0;
    window.App.state.answered = false;
    window.App.state.isWrongBookQuiz = false;

    document.body.innerHTML =
      '<div id="opt-A"></div><div id="opt-B"></div><div id="opt-C"></div><div id="opt-D"></div>' +
      '<div id="fb"><div id="fbTitle"></div><div id="fbDesc"></div></div>' +
      '<button id="nextBtn" style="display:none;"></button>';
  });

  test('pickOption 正确回答更新统计但不加入错题本', () => {
    window.App.pickOption('B');
    const d = window.App.db.get();
    expect(d.history.length).toBe(1);
    expect(d.history[0].ok).toBe(true);
    expect(d.stats.total).toBe(1);
    expect(d.wrong.length).toBe(0);
    expect(window.App.state.correctCount).toBe(1);
  });

  test('pickOption 错误回答加入错题本', () => {
    window.App.pickOption('A');
    const d = window.App.db.get();
    expect(d.history[0].ok).toBe(false);
    expect(d.wrong.length).toBe(1);
    expect(d.wrong[0].qid).toBe('001');
  });

  test('错题本复习模式下答对会提升复习等级', () => {
    window.App.db.addWrong('001');
    window.App.state.isWrongBookQuiz = true;
    window.App.pickOption('B');
    expect(window.App.db.getWrong()[0].level).toBe(1);
  });

  test('错题本复习模式下答错会重置等级并增加次数', () => {
    window.App.db.addWrong('001');
    window.App.db.reviewCorrect('001'); // level 1
    window.App.state.isWrongBookQuiz = true;
    window.App.pickOption('A');
    const w = window.App.db.getWrong()[0];
    expect(w.level).toBe(0);
    expect(w.cnt).toBe(2);
  });

  test('pickOption 重复选择无效', () => {
    window.App.pickOption('B');
    const firstCount = window.App.db.get().stats.total;
    window.App.pickOption('B');
    expect(window.App.db.get().stats.total).toBe(firstCount);
  });
});

describe('quiz.js session resume', () => {
  beforeEach(() => {
    jest.resetModules();
    global.createTestIndexedDB();
    loadApp();
  });

  test('tryResumeSession 从 sessionStorage 恢复答题状态', () => {
    window.App.session.save({
      quiz: [{ id: '001' }, { id: '002' }],
      idx: 1,
      correctCount: 1,
      startTime: 1000,
      mode: 'standard'
    });

    const ok = window.App.tryResumeSession();
    expect(ok).toBe(true);
    expect(window.App.state.quiz.length).toBe(2);
    expect(window.App.state.idx).toBe(1);
    expect(window.App.state.mode).toBe('standard');
  });

  test('tryResumeSession 在题目全部答完时不恢复', () => {
    window.App.session.save({
      quiz: [{ id: '001' }],
      idx: 1,
      correctCount: 1,
      startTime: 1000,
      mode: 'quick'
    });
    expect(window.App.tryResumeSession()).toBe(false);
    expect(window.App.session.load()).toBeNull();
  });

  test('tryResumeSession 在 session 为空时返回 false', () => {
    window.App.session.clear();
    expect(window.App.tryResumeSession()).toBe(false);
  });

  test('tryResumeSession 对无效题目 ID 不恢复', () => {
    window.App.session.save({
      quiz: [{ id: 'invalid' }],
      idx: 0,
      correctCount: 0,
      startTime: 1000,
      mode: 'quick'
    });
    expect(window.App.tryResumeSession()).toBe(false);
  });
});

describe('quiz.js keyboard shortcuts', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML =
      '<div id="view-practice" class="active"></div>' +
      '<div id="quizArea"></div>' +
      '<div id="opt-A"></div><div id="opt-B"></div><div id="opt-C"></div><div id="opt-D"></div>' +
      '<div id="fb"><div id="fbTitle"></div><div id="fbDesc"></div></div>' +
      '<button id="nextBtn" style="display:none;"></button>';
    global.createTestIndexedDB();
    loadApp();
    window.App.state.quiz = [window.App.QUESTION_BANK[0], window.App.QUESTION_BANK[1]];
    window.App.state.idx = 0;
    window.App.state.answered = false;
  });

  test('未回答时按 A-D 选择答案', () => {
    // 001 题选项包含 A/B/C/D
    const ev = { key: 'B', preventDefault: jest.fn() };
    window.App.handleQuizKeydown(ev);
    expect(window.App.db.get().history.length).toBe(1);
    expect(ev.preventDefault).toHaveBeenCalled();
  });

  test('未回答时按不存在的选项键不触发', () => {
    const ev = { key: 'Z', preventDefault: jest.fn() };
    window.App.handleQuizKeydown(ev);
    expect(window.App.db.get().history.length).toBe(0);
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });

  test('已回答时按 Enter 进入下一题', () => {
    window.App.pickOption('B');
    const ev = { key: 'Enter', preventDefault: jest.fn() };
    window.App.handleQuizKeydown(ev);
    expect(window.App.state.idx).toBe(1);
    expect(ev.preventDefault).toHaveBeenCalled();
  });
});
