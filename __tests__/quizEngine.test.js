const { createQuizEngine } = require('../src/quizEngine');

describe('答题引擎模块', () => {
  let mockQuestionBank;
  let mockDB;
  let quizEngine;

  beforeEach(() => {
    // 模拟题库
    mockQuestionBank = {
      get: jest.fn(() => [
        { id: 'q1', category: '专辑', question: '问题1', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '解析1' },
        { id: 'q2', category: '歌曲', question: '问题2', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B', explanation: '解析2' },
        { id: 'q3', category: '专辑', question: '问题3', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '解析3' },
        { id: 'q4', category: '歌曲', question: '问题4', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B', explanation: '解析4' },
        { id: 'q5', category: '专辑', question: '问题5', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '解析5' }
      ]),
      filterByCategory: jest.fn((category) => {
        return mockQuestionBank.get().filter(q => q.category === category);
      })
    };

    // 模拟 DB
    mockDB = {
      addRecord: jest.fn(),
      addWrong: jest.fn(),
      getWrong: jest.fn(() => []),
      findQ: jest.fn((qid) => {
        return mockQuestionBank.get().find(q => q.id === qid);
      })
    };

    quizEngine = createQuizEngine(mockQuestionBank, mockDB);
  });

  test('应该正确选择答题模式', () => {
    quizEngine.selectMode('standard');
    expect(quizEngine.state.mode).toBe('standard');
  });

  test('应该正确获取不同模式的题目数量', () => {
    quizEngine.selectMode('quick');
    expect(quizEngine.getCount()).toBe(10);

    quizEngine.selectMode('standard');
    expect(quizEngine.getCount()).toBe(20);

    quizEngine.selectMode('intensive');
    expect(quizEngine.getCount()).toBe(30);

    quizEngine.selectMode('unknown');
    expect(quizEngine.getCount()).toBe(10); // 默认值
  });

  test('应该正确开始随机答题', () => {
    const state = quizEngine.startRandomQuiz();
    expect(state.quiz.length).toBeLessThanOrEqual(5); // 我们只有5道题目
    expect(state.idx).toBe(0);
    expect(state.correctCount).toBe(0);
    expect(state.answered).toBe(false);
  });

  test('应该正确开始分类答题', () => {
    const state = quizEngine.startCategoryQuiz('专辑');
    expect(state.quiz.length).toBe(3); // 有3道专辑题目
    expect(state.idx).toBe(0);
    expect(state.correctCount).toBe(0);
  });

  test('应该正确获取当前问题', () => {
    quizEngine.startRandomQuiz();
    const question = quizEngine.getCurrentQuestion();
    expect(question).not.toBeNull();
    expect(question.id).toBeDefined();
  });

  test('应该正确处理正确答案', () => {
    quizEngine.startRandomQuiz();
    const question = quizEngine.getCurrentQuestion();
    const result = quizEngine.pickOption(question.answer);
    
    expect(result.ok).toBe(true);
    expect(result.correctAnswer).toBe(question.answer);
    expect(quizEngine.state.correctCount).toBe(1);
    expect(mockDB.addRecord).toHaveBeenCalled();
    expect(mockDB.addWrong).not.toHaveBeenCalled();
  });

  test('应该正确处理错误答案', () => {
    quizEngine.startRandomQuiz();
    const question = quizEngine.getCurrentQuestion();
    const wrongAnswer = question.answer === 'A' ? 'B' : 'A';
    const result = quizEngine.pickOption(wrongAnswer);
    
    expect(result.ok).toBe(false);
    expect(result.correctAnswer).toBe(question.answer);
    expect(quizEngine.state.correctCount).toBe(0);
    expect(mockDB.addRecord).toHaveBeenCalled();
    expect(mockDB.addWrong).toHaveBeenCalled();
  });

  test('应该正确防止重复答题', () => {
    quizEngine.startRandomQuiz();
    const question = quizEngine.getCurrentQuestion();
    quizEngine.pickOption(question.answer);
    
    const secondResult = quizEngine.pickOption(question.answer);
    expect(secondResult).toBeNull();
  });

  test('应该正确前进到下一题', () => {
    quizEngine.startRandomQuiz();
    quizEngine.pickOption(quizEngine.getCurrentQuestion().answer);
    const nextQuestion = quizEngine.nextQuestion();
    
    expect(nextQuestion).not.toBeNull();
    expect(quizEngine.state.idx).toBe(1);
  });

  test('应该正确完成答题并返回结果', () => {
    quizEngine.selectMode('quick');
    quizEngine.startRandomQuiz();
    
    // 回答所有题目
    const totalQuestions = quizEngine.state.quiz.length;
    let correctAnswers = 0;
    for (let i = 0; i < totalQuestions; i++) {
      const q = quizEngine.getCurrentQuestion();
      quizEngine.pickOption(q.answer); // 全部答对
      correctAnswers++;
      if (i < totalQuestions - 1) {
        quizEngine.nextQuestion();
      }
    }
    
    const result = quizEngine.finishQuiz();
    expect(result.total).toBe(totalQuestions);
    expect(result.correct).toBe(correctAnswers);
    expect(result.pct).toBe(100);
  });

  test('应该正确返回答题进度', () => {
    quizEngine.startRandomQuiz();
    const progress = quizEngine.getProgress();
    
    expect(progress.current).toBe(1);
    expect(progress.total).toBeGreaterThan(0);
    expect(progress.pct).toBe(0); // 第一题，进度是0%
  });

  test('应该正确判断答题是否完成', () => {
    quizEngine.startRandomQuiz();
    expect(quizEngine.isFinished()).toBe(false);
    
    // 直接设置索引为最后一个位置
    quizEngine.state.idx = quizEngine.state.quiz.length;
    expect(quizEngine.isFinished()).toBe(true);
  });

  test('应该正确处理错题本为空的情况', () => {
    const result = quizEngine.startWrongBookQuiz();
    expect(result).toBeNull();
  });
});
