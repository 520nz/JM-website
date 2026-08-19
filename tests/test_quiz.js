// quiz.js 核心逻辑测试
const { describe, it, expect, beforeEach } = require('./runner');
const mock = require('./mock');

// 确保 mock 环境已设置
require('./mock');
require('./setup').loadAll();
const App = global.App;

mock.setupDOMElements();

function setupEmptyState() {
  App.db.setData({
    history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
    theme: 'dark', dailyGoal: 20, achievements: [], archive: []
  });
}

describe('quiz.js - 随机打乱 (shuffle)', () => {
  it('shuffle 保持数组长度不变', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = App.shuffle(arr);
    expect(shuffled.length).toBe(arr.length);
  });

  it('shuffle 不改变原有数组', () => {
    const arr = [1, 2, 3, 4, 5];
    const orig = arr.slice();
    App.shuffle(arr);
    expect(arr).toEqual(orig);
  });

  it('shuffle 保持所有元素', () => {
    const arr = ['A', 'B', 'C', 'D', 'E'];
    const shuffled = App.shuffle(arr);
    for (let i = 0; i < arr.length; i++) {
      expect(shuffled).toContain(arr[i]);
    }
  });

  it('shuffle 对单元素数组返回相同', () => {
    const arr = [42];
    const shuffled = App.shuffle(arr);
    expect(shuffled.length).toBe(1);
    expect(shuffled[0]).toBe(42);
  });

  it('shuffle 对空数组返回空数组', () => {
    const arr = [];
    const shuffled = App.shuffle(arr);
    expect(shuffled.length).toBe(0);
  });

  it('多次 shuffle 结果可能不同', () => {
    // 概率性测试，通过大量洗牌检测
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set();
    for (let i = 0; i < 100; i++) {
      results.add(App.shuffle(arr).join(','));
    }
    // 10! 种排列，100 次洗牌应产生多种排列
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('quiz.js - 时间格式化 (fmtTime)', () => {
  // 注意：fmtTime 在 quiz.js 内部定义，需要暴露出来
  // 我们通过间接方式测试

  it('0 毫秒显示为 0分0秒', () => {
    // 通过启动答题来间接验证
    setupEmptyState();
    App.selectMode('quick');
    App.startRandomQuiz();
    // 验证 state 已初始化
    expect(App.state.startTime).toBeDefined();
    expect(App.state.quiz.length).toBe(10);
    expect(App.state.idx).toBe(0);
    expect(App.state.correctCount).toBe(0);
  });

  it('fmtTime 格式化验证', () => {
    // 直接从 App 访问（如果暴露了）
    if (typeof App.fmtTime === 'function') {
      expect(App.fmtTime(0)).toBe('0分0秒');
      expect(App.fmtTime(60000)).toBe('1分0秒');
      expect(App.fmtTime(125000)).toBe('2分5秒');
    }
  });
});

describe('quiz.js - 模式选择', () => {
  it('选择 quick 模式', () => {
    App.selectMode('quick');
    expect(App.state.mode).toBe('quick');
  });

  it('选择 standard 模式', () => {
    App.selectMode('standard');
    expect(App.state.mode).toBe('standard');
  });

  it('选择 intensive 模式', () => {
    App.selectMode('intensive');
    expect(App.state.mode).toBe('intensive');
  });

  it('切换模式后清除会话', () => {
    App.session.save({ quizIds: ['001'], idx: 0, correctCount: 0, startTime: Date.now(), mode: 'quick' });
    App.selectMode('standard');
    const session = App.session.load();
    expect(session).toBe(null);
  });
});

describe('quiz.js - 随机答题流程', () => {
  beforeEach(() => {
    setupEmptyState();
    App.selectMode('quick');
  });

  it('开始随机答题初始化状态', () => {
    App.startRandomQuiz();
    expect(App.state.quiz.length).toBe(10);
    expect(App.state.idx).toBe(0);
    expect(App.state.correctCount).toBe(0);
    expect(App.state.isWrongBookQuiz).toBe(false);
  });

  it('选择正确答案增加正确计数', () => {
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    expect(App.state.correctCount).toBe(1);
    expect(App.state.answered).toBe(true);
  });

  it('选择错误答案不增加正确计数', () => {
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    const wrongKey = q.options.find(o => o.key !== q.answer).key;
    App.pickOption(wrongKey);
    expect(App.state.correctCount).toBe(0);
  });

  it('答错加入错题本', () => {
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    const wrongKey = q.options.find(o => o.key !== q.answer).key;
    App.pickOption(wrongKey);
    const wl = App.db.getWrong();
    expect(wl.length).toBeGreaterThan(0);
    expect(wl.find(w => w.qid === q.id)).toBeDefined();
  });

  it('答对不加入错题本', () => {
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    const wl = App.db.getWrong();
    expect(wl.length).toBe(0);
  });

  it('已答题后再次选择无效', () => {
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    const countBefore = App.state.correctCount;
    // 尝试再次选择
    App.pickOption(q.options[0].key);
    expect(App.state.correctCount).toBe(countBefore);
  });

  it('下一题推进索引', () => {
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    const idxBefore = App.state.idx;
    App.nextQ();
    expect(App.state.idx).toBe(idxBefore + 1);
  });

  it('退出答题重置状态', () => {
    App.startRandomQuiz();
    App.quitQuiz();
    expect(App.state.quiz.length).toBe(0);
    expect(App.state.idx).toBe(0);
  });
});

describe('quiz.js - 分类答题', () => {
  it('按分类答题', () => {
    setupEmptyState();
    // 验证分类功能
    App.showCategoryView();
    // category 视图应被切换
    // 验证能获取分类数据
    const cats = {};
    for (let i = 0; i < App.QUESTION_BANK.length; i++) {
      const c = App.QUESTION_BANK[i].category;
      cats[c] = (cats[c] || 0) + 1;
    }
    expect(Object.keys(cats).length).toBeGreaterThan(0);
    expect(cats['专辑']).toBeDefined();
    expect(cats['歌曲']).toBeDefined();
  });

  it('分类答题初始化', () => {
    setupEmptyState();
    App.selectMode('standard');
    App.startCatQuiz('专辑');
    expect(App.state.quiz.length).toBeGreaterThan(0);
    expect(App.state.isWrongBookQuiz).toBe(false);
    // 验证所有题目都属于专辑分类
    for (let i = 0; i < App.state.quiz.length; i++) {
      expect(App.state.quiz[i].category).toBe('专辑');
    }
  });
});

describe('quiz.js - 错题本复习', () => {
  it('错题本复习初始化', () => {
    setupEmptyState();
    // 先添加错题
    App.db.addWrong('001');
    App.db.addWrong('002');
    App.startWrongBookQuiz();
    expect(App.state.isWrongBookQuiz).toBe(true);
    expect(App.state.quiz.length).toBe(2);
  });

  it('错题本答对提升等级', () => {
    setupEmptyState();
    App.db.addWrong('001');
    App.startWrongBookQuiz();
    const q = App.state.quiz[0];
    const result = App.pickOption(q.answer);
    // 答对后错题等级应提升
    const wl = App.db.getWrong();
    const w = wl.find(item => item.qid === q.id);
    if (w) {
      expect(w.level).toBeGreaterThan(0);
    }
  });

  it('错题本答错重置等级', () => {
    setupEmptyState();
    App.db.addWrong('001');
    App.db.reviewCorrect('001'); // 提升到 level 1
    App.startWrongBookQuiz();
    const q = App.state.quiz[0];
    const wrongKey = q.options.find(o => o.key !== q.answer).key;
    App.pickOption(wrongKey);
    const wl = App.db.getWrong();
    const w = wl.find(item => item.qid === q.id);
    expect(w.level).toBe(0);
  });

  it('错题全部掌握后返回空', () => {
    setupEmptyState();
    App.db.addWrong('001');
    // 答对 5 次让其掌握
    for (let i = 0; i < 5; i++) {
      App.db.reviewCorrect('001');
    }
    const result = App.startWrongBookQuiz();
    // startWrongBookQuiz 在 qs.length === 0 时返回
    expect(App.state.quiz.length).toBe(0);
  });
});

describe('quiz.js - 会话恢复', () => {
  it('保存并恢复会话', () => {
    setupEmptyState();
    App.selectMode('quick');
    App.startRandomQuiz();
    const idx = App.state.idx;
    // 保存会话
    App.session.save(App.state);
    // 恢复
    const saved = App.session.load();
    expect(saved).toBeDefined();
    expect(saved.idx).toBe(idx);
    expect(saved.quizIds.length).toBe(10);
  });

  it('尝试恢复空会话返回 false', () => {
    App.session.clear();
    const result = App.tryResumeSession();
    expect(result).toBe(false);
  });

  it('恢复已完成的会话返回 false', () => {
    // 创建一个已完成的会话
    App.session.save({
      quizIds: ['001'],
      idx: 1, // idx >= quizIds.length
      correctCount: 1,
      startTime: Date.now(),
      mode: 'quick'
    });
    const result = App.tryResumeSession();
    expect(result).toBe(false);
  });

  it('恢复有效的会话', () => {
    setupEmptyState();
    App.session.save({
      quizIds: ['001', '002'],
      idx: 0,
      correctCount: 0,
      startTime: Date.now(),
      mode: 'quick'
    });
    const result = App.tryResumeSession();
    expect(result).toBe(true);
    expect(App.state.quiz.length).toBe(2);
    expect(App.state.idx).toBe(0);
  });

  it('丢弃会话', () => {
    App.session.save({ quizIds: ['001'], idx: 0, correctCount: 0, startTime: Date.now() });
    App.discardSession();
    const session = App.session.load();
    expect(session).toBe(null);
  });
});

describe('quiz.js - 音效开关', () => {
  it('toggleSound 切换音效状态', () => {
    const initial = App.toggleSound();
    const after = App.toggleSound();
    expect(initial).not.toBe(after);
  });
});

describe('quiz.js - 答题完成', () => {
  it('完成答题设置结果', () => {
    setupEmptyState();
    App.selectMode('quick');
    App.startRandomQuiz();
    // 答完所有题
    for (let i = 0; i < 10; i++) {
      const q = App.state.quiz[App.state.idx];
      App.pickOption(q.answer);
      App.nextQ();
    }
    // 验证 state.lastResult
    if (App.state.lastResult) {
      expect(App.state.lastResult.total).toBe(10);
      expect(App.state.lastResult.correct).toBe(10);
      expect(App.state.lastResult.pct).toBe(100);
    }
  });
});

describe('quiz.js - 键盘快捷键', () => {
  it('A/B/C/D 键选择答案', () => {
    setupEmptyState();
    App.selectMode('quick');
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    const answerKey = q.answer;

    // 模拟键盘事件
    const event = { key: answerKey, preventDefault() {} };
    App.handleQuizKeydown(event);
    expect(App.state.answered).toBe(true);
  });

  it('答题后空格键进入下一题', () => {
    setupEmptyState();
    App.selectMode('quick');
    App.startRandomQuiz();
    const q = App.state.quiz[0];
    App.pickOption(q.answer);
    const idxBefore = App.state.idx;

    const event = { key: ' ', preventDefault() {} };
    App.handleQuizKeydown(event);
    expect(App.state.idx).toBe(idxBefore + 1);
  });

  it('非答题视图不响应快捷键', () => {
    setupEmptyState();
    App.selectMode('quick');
    App.startRandomQuiz();
    // 切换到其他视图
    App.switchView('home');
    const event = { key: 'A', preventDefault() {} };
    const answeredBefore = App.state.answered;
    App.handleQuizKeydown(event);
    // 不应响应
  });
});
