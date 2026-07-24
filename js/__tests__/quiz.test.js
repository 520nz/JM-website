/**
 * app.js 错题本排序逻辑测试
 * 覆盖缺口：错题排序（最近/次数/到期）
 */

describe('app.js - 错题本排序', () => {
  function setupDOM() {
    document.body.innerHTML = `
      <div id="wrongBookList"></div>
      <button id="wrongBookBtn" style="display:none"></button>
    `;
  }

  function mockApp() {
    return {
      QUESTION_BANK: [
        { id: 'q1', question: '题目一', category: '专辑' },
        { id: 'q2', question: '题目二', category: '歌曲' },
        { id: 'q3', question: '题目三', category: '专辑' },
        { id: 'q4', question: '题目四', category: '获奖记录' }
      ],
      esc: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      db: {
        getWrong: jest.fn(),
        getDueWrong: jest.fn(() => []),
        findQ: function(qid) {
          return this.QUESTION_BANK.find(q => q.id === qid);
        }.bind(this),
        checkAchievements: jest.fn(() => [])
      },
      renderTrendChart: jest.fn(),
      showAchievementToast: jest.fn()
    };
  }

  beforeEach(() => {
    jest.resetModules();
    setupDOM();
    const base = {
      QUESTION_BANK: [
        { id: 'q1', question: '题目一', category: '专辑' },
        { id: 'q2', question: '题目二', category: '歌曲' },
        { id: 'q3', question: '题目三', category: '专辑' },
        { id: 'q4', question: '题目四', category: '获奖记录' }
      ],
      esc: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      renderTrendChart: jest.fn(),
      showAchievementToast: jest.fn(),
      session: { load: jest.fn(() => null), clear: jest.fn() },
      handleQuizKeydown: jest.fn()
    };
    global.App = base;
    require('../storage.js');
    // 覆盖 storage.js 中设置的 db 方法，使用我们自己的 mock
    global.App.db.getWrong = jest.fn();
    global.App.db.getDueWrong = jest.fn(() => []);
    global.App.db.checkAchievements = jest.fn(() => []);
    require('../app.js');
  });

  it('默认应按最近添加排序（时间降序）', () => {
    const now = Date.now();
    global.App.db.getWrong.mockReturnValue([
      { qid: 'q1', cnt: 1, level: 0, time: now - 10000, nextReview: now + 3600000 },
      { qid: 'q2', cnt: 3, level: 1, time: now - 5000, nextReview: now + 7200000 },
      { qid: 'q3', cnt: 2, level: 0, time: now - 1000, nextReview: now + 1800000 }
    ]);

    App.renderWrongBook();
    const html = document.getElementById('wrongBookList').innerHTML;
    // 最近添加的 q3 应在最前面
    const posQ3 = html.indexOf('题目三');
    const posQ2 = html.indexOf('题目二');
    const posQ1 = html.indexOf('题目一');
    expect(posQ3).toBeLessThan(posQ2);
    expect(posQ2).toBeLessThan(posQ1);
  });

  it('按错误次数排序应显示 cnt 最高的在前', () => {
    const now = Date.now();
    global.App.db.getWrong.mockReturnValue([
      { qid: 'q1', cnt: 1, level: 0, time: now - 1000, nextReview: now + 3600000 },
      { qid: 'q2', cnt: 5, level: 1, time: now - 5000, nextReview: now + 7200000 },
      { qid: 'q3', cnt: 2, level: 0, time: now - 10000, nextReview: now + 1800000 }
    ]);

    App.setWrongSort('count');
    const html = document.getElementById('wrongBookList').innerHTML;
    const posQ2 = html.indexOf('题目二');
    const posQ3 = html.indexOf('题目三');
    const posQ1 = html.indexOf('题目一');
    expect(posQ2).toBeLessThan(posQ3);
    expect(posQ3).toBeLessThan(posQ1);
  });

  it('按到期时间排序应显示 nextReview 最小的在前', () => {
    const now = Date.now();
    global.App.db.getWrong.mockReturnValue([
      { qid: 'q1', cnt: 1, level: 0, time: now - 1000, nextReview: now + 3600000 },
      { qid: 'q2', cnt: 1, level: 1, time: now - 5000, nextReview: now + 1800000 },
      { qid: 'q3', cnt: 1, level: 0, time: now - 10000, nextReview: now + 7200000 }
    ]);

    App.setWrongSort('due');
    const html = document.getElementById('wrongBookList').innerHTML;
    const posQ2 = html.indexOf('题目二');
    const posQ1 = html.indexOf('题目一');
    const posQ3 = html.indexOf('题目三');
    expect(posQ2).toBeLessThan(posQ1);
    expect(posQ1).toBeLessThan(posQ3);
  });

  it('应正确显示可复习状态', () => {
    const now = Date.now();
    global.App.db.getWrong.mockReturnValue([
      { qid: 'q1', cnt: 1, level: 0, time: now, nextReview: now - 1000 },
      { qid: 'q2', cnt: 1, level: 1, time: now, nextReview: now + 3600000 }
    ]);

    App.renderWrongBook();
    const html = document.getElementById('wrongBookList').innerHTML;
    expect(html).toContain('可复习');
    expect(html).toContain('1小时后');
  });

  it('应正确显示多天后的到期时间', () => {
    const now = Date.now();
    global.App.db.getWrong.mockReturnValue([
      { qid: 'q1', cnt: 1, level: 3, time: now, nextReview: now + 3 * 24 * 60 * 60 * 1000 }
    ]);

    App.renderWrongBook();
    const html = document.getElementById('wrongBookList').innerHTML;
    expect(html).toContain('3天后');
  });

  it('空错题本应显示提示信息', () => {
    global.App.db.getWrong.mockReturnValue([]);
    App.renderWrongBook();
    const html = document.getElementById('wrongBookList').innerHTML;
    expect(html).toContain('暂无错题记录');
  });
});

describe('quiz.js - 答题引擎核心逻辑', () => {
  beforeEach(() => {
    jest.resetModules();
    global.App = {
      QUESTION_BANK: [
        { id: 'q1', question: 'Q1', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A', explanation: '因为A' },
        { id: 'q2', question: 'Q2', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'B', explanation: '因为B' }
      ],
      esc: (s) => String(s || ''),
      db: {
        addRecord: jest.fn(),
        addWrong: jest.fn(),
        reviewCorrect: jest.fn(() => ({ mastered: false, level: 1 })),
        reviewWrong: jest.fn(),
        checkAchievements: jest.fn(() => [])
      },
      session: { save: jest.fn(), clear: jest.fn() },
      switchView: jest.fn()
    };
    require('../quiz.js');
  });

  it('shuffle 应保持元素不变仅改变顺序', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = App.shuffle(arr);
    expect(shuffled.length).toBe(5);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(arr).toEqual([1, 2, 3, 4, 5]); // 原数组不应被修改
  });

  it('startRandomQuiz 应选取指定数量题目', () => {
    // 扩大题库
    global.App.QUESTION_BANK = [];
    for (let i = 0; i < 20; i++) {
      global.App.QUESTION_BANK.push({
        id: 'q' + i, question: 'Q' + i,
        options: [{ key: 'A', text: 'a' }], answer: 'A', explanation: ''
      });
    }
    document.body.innerHTML = '<div id="quizArea"></div>';
    App.selectMode('quick');
    App.startRandomQuiz();
    expect(App.state.quiz.length).toBe(10);
  });

  it('startCatQuiz 当分类题目不足时应返回全部', () => {
    global.App.QUESTION_BANK = [
      { id: 'q1', question: 'Q1', category: '专辑', options: [{ key: 'A', text: 'a' }], answer: 'A', explanation: '' }
    ];
    document.body.innerHTML = '<div id="quizArea"></div>';
    App.startCatQuiz('专辑');
    expect(App.state.quiz.length).toBe(1);
  });

  it('pickOption 答对应更新状态并记录', () => {
    global.App.QUESTION_BANK = [
      { id: 'q1', question: 'Q1', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A', explanation: '因为A' }
    ];
    App.state.quiz = global.App.QUESTION_BANK;
    App.state.idx = 0;
    App.state.correctCount = 0;
    App.state.answered = false;
    App.state.isWrongBookQuiz = false;

    // mock DOM
    document.body.innerHTML = `
      <div id="opt-A"></div>
      <div id="opt-B"></div>
      <div id="fb"></div>
      <div id="fbTitle"></div>
      <div id="fbDesc"></div>
      <button id="nextBtn" style="display:none"></button>
    `;

    App.pickOption('A');
    expect(App.state.correctCount).toBe(1);
    expect(global.App.db.addRecord).toHaveBeenCalled();
  });

  it('pickOption 在错题本模式下答对应调用 reviewCorrect', () => {
    global.App.QUESTION_BANK = [
      { id: 'q1', question: 'Q1', options: [{ key: 'A', text: 'a' }], answer: 'A', explanation: '因为A' }
    ];
    App.state.quiz = global.App.QUESTION_BANK;
    App.state.idx = 0;
    App.state.answered = false;
    App.state.isWrongBookQuiz = true;

    document.body.innerHTML = `
      <div id="opt-A"></div>
      <div id="fb"></div>
      <div id="fbTitle"></div>
      <div id="fbDesc"></div>
      <button id="nextBtn" style="display:none"></button>
    `;

    App.pickOption('A');
    expect(global.App.db.reviewCorrect).toHaveBeenCalledWith('q1');
  });

  it('pickOption 在错题本模式下答错应调用 reviewWrong', () => {
    global.App.QUESTION_BANK = [
      { id: 'q1', question: 'Q1', options: [{ key: 'A', text: 'a' }], answer: 'B', explanation: '因为B' }
    ];
    App.state.quiz = global.App.QUESTION_BANK;
    App.state.idx = 0;
    App.state.answered = false;
    App.state.isWrongBookQuiz = true;

    document.body.innerHTML = `
      <div id="opt-A"></div>
      <div id="opt-B"></div>
      <div id="fb"></div>
      <div id="fbTitle"></div>
      <div id="fbDesc"></div>
      <button id="nextBtn" style="display:none"></button>
    `;

    App.pickOption('A');
    expect(global.App.db.reviewWrong).toHaveBeenCalledWith('q1');
  });

  it('tryResumeSession 应正确恢复会话状态', () => {
    global.App.db.findQ = jest.fn((qid) => global.App.QUESTION_BANK.find(q => q.id === qid));
    global.App.session.load = jest.fn(() => ({
      quizIds: ['q1', 'q2'],
      idx: 1,
      correctCount: 1,
      startTime: Date.now() - 30000,
      mode: 'standard'
    }));
    const ok = App.tryResumeSession();
    expect(ok).toBe(true);
    expect(App.state.quiz.length).toBe(2);
    expect(App.state.idx).toBe(1);
    expect(App.state.mode).toBe('standard');
  });

  it('tryResumeSession 对已完成的会话应返回 false', () => {
    global.App.db.findQ = jest.fn((qid) => global.App.QUESTION_BANK.find(q => q.id === qid));
    global.App.session.load = jest.fn(() => ({
      quizIds: ['q1'],
      idx: 1,
      correctCount: 1,
      startTime: Date.now(),
      mode: 'quick'
    }));
    const ok = App.tryResumeSession();
    expect(ok).toBe(false);
  });
});
