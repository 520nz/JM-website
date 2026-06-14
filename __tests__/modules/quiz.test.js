/**
 * 答题核心逻辑模块测试
 */

const { QuizManager } = require('../../src/quiz.js');

// 简单的打乱函数（用于测试）
function simpleShuffle(arr) {
  return arr.slice().reverse();
}

// 测试用题库
const mockQuestionBank = [
  { id: '001', category: '专辑', question: '题目1', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A' },
  { id: '002', category: '歌曲', question: '题目2', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B' },
  { id: '003', category: '专辑', question: '题目3', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A' },
  { id: '004', category: '个人信息', question: '题目4', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B' },
  { id: '005', category: '获奖记录', question: '题目5', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A' }
];

describe('QuizManager', () => {
  describe('createInitialState', () => {
    test('应创建正确的初始状态', () => {
      const state = QuizManager.createInitialState();
      
      expect(state.quiz).toEqual([]);
      expect(state.idx).toBe(0);
      expect(state.answered).toBe(false);
      expect(state.mode).toBe('quick');
      expect(state.correctCount).toBe(0);
      expect(state.startTime).toBe(0);
    });
  });

  describe('startRandomQuiz', () => {
    test('应正确开始随机答题', () => {
      const state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      
      expect(state.quiz.length).toBe(5); // 题库只有5题
      expect(state.idx).toBe(0);
      expect(state.answered).toBe(false);
      expect(state.correctCount).toBe(0);
      expect(state.startTime).toBeGreaterThan(0);
    });

    test('不同模式应限制不同题目数量', () => {
      const quickState = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      const standardState = QuizManager.startRandomQuiz(mockQuestionBank, 'standard', simpleShuffle);
      const intensiveState = QuizManager.startRandomQuiz(mockQuestionBank, 'intensive', simpleShuffle);
      
      expect(quickState.quiz.length).toBe(5); // 题库只有5题
      expect(standardState.quiz.length).toBe(5);
      expect(intensiveState.quiz.length).toBe(5);
    });

    test('无打乱函数时应使用原数组', () => {
      const state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', null);
      
      expect(state.quiz.length).toBe(5);
    });
  });

  describe('startCategoryQuiz', () => {
    test('应正确开始分类答题', () => {
      const state = QuizManager.startCategoryQuiz(mockQuestionBank, '专辑', 'quick', simpleShuffle);
      
      expect(state.quiz.length).toBe(2);
      expect(state.quiz.every(q => q.category === '专辑')).toBe(true);
    });

    test('不存在的分类应返回空答题', () => {
      const state = QuizManager.startCategoryQuiz(mockQuestionBank, '不存在的分类', 'quick', simpleShuffle);
      
      expect(state.quiz.length).toBe(0);
    });
  });

  describe('startWrongBookQuiz', () => {
    const wrongList = [{ qid: '001' }, { qid: '003' }];
    
    const findQ = (qid, bank) => bank.find(q => q.id === qid);

    test('应正确开始错题复习', () => {
      const state = QuizManager.startWrongBookQuiz(wrongList, mockQuestionBank, findQ, simpleShuffle);
      
      expect(state.quiz.length).toBe(2);
      expect(state.mode).toBe('wrongbook');
    });

    test('错题不存在时应跳过', () => {
      const wrongListWithInvalid = [{ qid: '001' }, { qid: '999' }];
      const state = QuizManager.startWrongBookQuiz(wrongListWithInvalid, mockQuestionBank, findQ, simpleShuffle);
      
      expect(state.quiz.length).toBe(1);
    });

    test('空错题本应返回空答题', () => {
      const state = QuizManager.startWrongBookQuiz([], mockQuestionBank, findQ, simpleShuffle);
      
      expect(state.quiz.length).toBe(0);
    });
  });

  describe('selectAnswer', () => {
    test('正确答案应返回isCorrect=true', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      const result = QuizManager.selectAnswer(state, state.quiz[0].answer);
      
      expect(result.isCorrect).toBe(true);
      expect(result.state.correctCount).toBe(1);
    });

    test('错误答案应返回isCorrect=false', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      const wrongAnswer = state.quiz[0].answer === 'A' ? 'B' : 'A';
      const result = QuizManager.selectAnswer(state, wrongAnswer);
      
      expect(result.isCorrect).toBe(false);
      expect(result.state.correctCount).toBe(0);
    });

    test('已回答后再次选择应无效果', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      const result1 = QuizManager.selectAnswer(state, state.quiz[0].answer);
      const result2 = QuizManager.selectAnswer(result1.state, 'B');
      
      expect(result2.isCorrect).toBe(false);
      expect(result2.state.correctCount).toBe(1); // 保持第一次的结果
    });

    test('应返回当前题目', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      const result = QuizManager.selectAnswer(state, 'A');
      
      expect(result.question).toBeDefined();
      expect(result.question.id).toBe(state.quiz[0].id);
    });
  });

  describe('nextQuestion', () => {
    test('应正确进入下一题', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      state = QuizManager.nextQuestion(state);
      
      expect(state.idx).toBe(1);
      expect(state.answered).toBe(false);
    });

    test('应保持其他状态', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      state = QuizManager.selectAnswer(state, 'A').state;
      state = QuizManager.nextQuestion(state);
      
      expect(state.correctCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isFinished', () => {
    test('未完成时应返回false', () => {
      const state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      
      expect(QuizManager.isFinished(state)).toBe(false);
    });

    test('完成后应返回true', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      state = Object.assign({}, state, { idx: state.quiz.length });
      
      expect(QuizManager.isFinished(state)).toBe(true);
    });
  });

  describe('getCurrentQuestion', () => {
    test('应返回当前题目', () => {
      const state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      const q = QuizManager.getCurrentQuestion(state);
      
      expect(q).toBe(state.quiz[0]);
    });

    test('答题完成后应返回null', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      state = Object.assign({}, state, { idx: state.quiz.length });
      const q = QuizManager.getCurrentQuestion(state);
      
      expect(q).toBeNull();
    });
  });

  describe('getProgress', () => {
    test('应正确返回进度信息', () => {
      const state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      const progress = QuizManager.getProgress(state);
      
      expect(progress.current).toBe(1);
      expect(progress.total).toBe(5);
      expect(progress.percentage).toBe(0);
    });

    test('进度应随idx增加', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      state = QuizManager.nextQuestion(state);
      state = QuizManager.nextQuestion(state);
      const progress = QuizManager.getProgress(state);
      
      expect(progress.current).toBe(3);
      expect(progress.percentage).toBe(40);
    });
  });

  describe('getResult', () => {
    test('应正确返回答题结果', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      
      // 模拟答题过程
      for (let i = 0; i < state.quiz.length; i++) {
        const q = state.quiz[i];
        const result = QuizManager.selectAnswer(state, q.answer); // 全对
        state = result.state;
        state = QuizManager.nextQuestion(state);
      }
      
      const result = QuizManager.getResult(state);
      
      expect(result.total).toBe(5);
      expect(result.correct).toBe(5);
      expect(result.wrong).toBe(0);
      expect(result.accuracy).toBe(100);
      expect(result.elapsed).toBeGreaterThanOrEqual(0);
    });

    test('部分正确应正确计算', () => {
      let state = QuizManager.startRandomQuiz(mockQuestionBank, 'quick', simpleShuffle);
      
      // 第一题答对
      let result = QuizManager.selectAnswer(state, state.quiz[0].answer);
      state = result.state;
      state = QuizManager.nextQuestion(state);
      
      // 第二题答错
      const wrongAns = state.quiz[1].answer === 'A' ? 'B' : 'A';
      result = QuizManager.selectAnswer(state, wrongAns);
      state = result.state;
      state = Object.assign({}, state, { idx: state.quiz.length }); // 跳到结束
      
      const finalResult = QuizManager.getResult(state);
      
      expect(finalResult.correct).toBe(1);
    });
  });

  describe('getCountByMode', () => {
    test('应返回正确的题目数量', () => {
      expect(QuizManager.getCountByMode('quick')).toBe(10);
      expect(QuizManager.getCountByMode('standard')).toBe(20);
      expect(QuizManager.getCountByMode('intensive')).toBe(30);
    });
  });
});
