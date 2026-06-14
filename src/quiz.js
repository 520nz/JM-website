/**
 * 答题核心逻辑模块
 */

/**
 * 答题状态管理
 */
const QuizManager = {
  /**
   * 创建初始状态
   * @returns {Object} 初始状态
   */
  createInitialState: function() {
    return {
      quiz: [],
      idx: 0,
      answered: false,
      mode: 'quick',
      correctCount: 0,
      startTime: 0,
      timer: null
    };
  },

  /**
   * 开始随机答题
   * @param {Array} questionBank - 题库数组
   * @param {string} mode - 模式
   * @param {Function} shuffleFn - 打乱函数
   * @returns {Object} 答题状态
   */
  startRandomQuiz: function(questionBank, mode, shuffleFn) {
    const count = this.getCountByMode(mode);
    const shuffled = shuffleFn ? shuffleFn(questionBank) : questionBank.slice();
    const quiz = shuffled.slice(0, count);
    
    return {
      quiz: quiz,
      idx: 0,
      answered: false,
      mode: mode,
      correctCount: 0,
      startTime: Date.now(),
      timer: null
    };
  },

  /**
   * 开始分类答题
   * @param {Array} questionBank - 题库数组
   * @param {string} category - 分类名称
   * @param {string} mode - 模式
   * @param {Function} shuffleFn - 打乱函数
   * @returns {Object} 答题状态
   */
  startCategoryQuiz: function(questionBank, category, mode, shuffleFn) {
    const filtered = questionBank.filter(function(q) {
      return q.category === category;
    });
    return this.startRandomQuiz(filtered, mode, shuffleFn);
  },

  /**
   * 开始错题复习
   * @param {Array} wrongList - 错题列表
   * @param {Array} questionBank - 题库数组
   * @param {Function} findQFn - 查找题目函数
   * @param {Function} shuffleFn - 打乱函数
   * @returns {Object} 答题状态
   */
  startWrongBookQuiz: function(wrongList, questionBank, findQFn, shuffleFn) {
    const questions = [];
    for (let i = 0; i < wrongList.length; i++) {
      const q = findQFn(wrongList[i].qid, questionBank);
      if (q) questions.push(q);
    }
    
    const shuffled = shuffleFn ? shuffleFn(questions) : questions;
    
    return {
      quiz: shuffled,
      idx: 0,
      answered: false,
      mode: 'wrongbook',
      correctCount: 0,
      startTime: Date.now(),
      timer: null
    };
  },

  /**
   * 选择答案
   * @param {Object} state - 当前状态
   * @param {string} key - 选择的选项key
   * @returns {Object} {state, isCorrect, question}
   */
  selectAnswer: function(state, key) {
    if (state.answered) {
      return { state: state, isCorrect: false, question: null };
    }
    
    const question = state.quiz[state.idx];
    const isCorrect = key === question.answer;
    
    const newState = Object.assign({}, state, {
      answered: true,
      correctCount: isCorrect ? state.correctCount + 1 : state.correctCount
    });
    
    return {
      state: newState,
      isCorrect: isCorrect,
      question: question
    };
  },

  /**
   * 下一题
   * @param {Object} state - 当前状态
   * @returns {Object} 新状态
   */
  nextQuestion: function(state) {
    return Object.assign({}, state, {
      idx: state.idx + 1,
      answered: false
    });
  },

  /**
   * 检查答题是否完成
   * @param {Object} state - 当前状态
   * @returns {boolean} 是否完成
   */
  isFinished: function(state) {
    return state.idx >= state.quiz.length;
  },

  /**
   * 获取当前题目
   * @param {Object} state - 当前状态
   * @returns {Object|null} 当前题目
   */
  getCurrentQuestion: function(state) {
    if (state.idx >= state.quiz.length) return null;
    return state.quiz[state.idx];
  },

  /**
   * 获取答题进度
   * @param {Object} state - 当前状态
   * @returns {Object} {current, total, percentage}
   */
  getProgress: function(state) {
    const total = state.quiz.length;
    const current = state.idx + 1;
    const percentage = total > 0 ? Math.round(state.idx / total * 100) : 0;
    return { current, total, percentage };
  },

  /**
   * 获取答题结果
   * @param {Object} state - 当前状态
   * @returns {Object} {total, correct, wrong, accuracy, elapsed}
   */
  getResult: function(state) {
    const total = state.quiz.length;
    const correct = state.correctCount;
    const wrong = total - correct;
    const accuracy = total > 0 ? Math.round(correct / total * 100) : 0;
    const elapsed = Date.now() - state.startTime;
    
    return { total, correct, wrong, accuracy, elapsed };
  },

  /**
   * 获取模式对应的题目数量
   * @param {string} mode - 模式名称
   * @returns {number} 题目数量
   */
  getCountByMode: function(mode) {
    const modeMap = {
      quick: 10,
      standard: 20,
      intensive: 30
    };
    return modeMap[mode] || 10;
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QuizManager };
}
