/**
 * 答题引擎模块
 * 管理答题状态、计时器、题目顺序等
 */

/**
 * 创建答题状态
 */
function createQuizState(mode = 'quick') {
  return {
    quiz: [],
    idx: 0,
    answered: false,
    mode: mode,
    correctCount: 0,
    startTime: 0,
    timer: null
  };
}

/**
 * 获取题目数量
 */
function getQuestionCount(mode) {
  const counts = {
    quick: 10,
    standard: 20,
    intensive: 30
  };
  return counts[mode] || 10;
}

/**
 * Fisher-Yates 洗牌算法
 */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/**
 * 开始随机答题
 */
function startRandomQuiz(state, questionBank, mode) {
  state.mode = mode;
  state.quiz = shuffle(questionBank).slice(0, getQuestionCount(mode));
  state.idx = 0;
  state.correctCount = 0;
  state.startTime = Date.now();
  state.answered = false;
  return state;
}

/**
 * 开始分类答题
 */
function startCategoryQuiz(state, questionBank, category, mode) {
  const filtered = questionBank.filter(q => q.category === category);
  state.mode = mode;
  state.quiz = shuffle(filtered).slice(0, getQuestionCount(mode));
  state.idx = 0;
  state.correctCount = 0;
  state.startTime = Date.now();
  state.answered = false;
  return state;
}

/**
 * 开始错题复习
 */
function startWrongBookQuiz(state, questionBank, wrongList) {
  const qs = [];
  for (let i = 0; i < wrongList.length; i++) {
    const q = questionBank.find(item => item.id === wrongList[i].qid);
    if (q) qs.push(q);
  }
  
  if (qs.length === 0) return null;
  
  state.quiz = shuffle(qs);
  state.idx = 0;
  state.correctCount = 0;
  state.startTime = Date.now();
  state.answered = false;
  return state;
}

/**
 * 获取当前题目
 */
function getCurrentQuestion(state) {
  if (state.idx >= state.quiz.length) return null;
  return state.quiz[state.idx];
}

/**
 * 选择答案
 * @returns {Object} {ok: boolean, correctAnswer: string, explanation: string}
 */
function pickOption(state, key) {
  if (state.answered) return null;
  
  state.answered = true;
  const q = state.quiz[state.idx];
  const ok = key === q.answer;
  
  if (ok) {
    state.correctCount++;
  }
  
  return {
    ok: ok,
    userAnswer: key,
    correctAnswer: q.answer,
    explanation: q.explanation,
    questionId: q.id
  };
}

/**
 * 下一题
 */
function nextQuestion(state) {
  state.idx++;
  state.answered = false;
  return state;
}

/**
 * 检查是否答题完成
 */
function isQuizFinished(state) {
  return state.idx >= state.quiz.length;
}

/**
 * 获取答题进度
 */
function getProgress(state) {
  return {
    current: state.idx + 1,
    total: state.quiz.length,
    percentage: Math.round(state.idx / state.quiz.length * 100)
  };
}

/**
 * 计算用时
 */
function getElapsedTime(state) {
  const elapsed = Date.now() - state.startTime;
  const sec = Math.floor(elapsed / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return {
    milliseconds: elapsed,
    formatted: m + '分' + s + '秒',
    minutes: m,
    seconds: s
  };
}

/**
 * 格式化时间
 */
function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + '分' + s + '秒';
}

/**
 * 获取答题结果
 */
function getQuizResult(state) {
  const elapsed = getElapsedTime(state);
  const total = state.quiz.length;
  const correct = state.correctCount;
  const wrong = total - correct;
  const percentage = total > 0 ? Math.round(correct / total * 100) : 0;
  
  return {
    total,
    correct,
    wrong,
    percentage,
    elapsed: elapsed.formatted,
    elapsedMs: elapsed.milliseconds
  };
}

/**
 * 重置答题状态
 */
function resetQuizState(state) {
  state.quiz = [];
  state.idx = 0;
  state.answered = false;
  state.correctCount = 0;
  state.startTime = 0;
  state.timer = null;
  return state;
}

/**
 * 创建答题记录
 */
function createAnswerRecord(state, key, ok) {
  return {
    qid: state.quiz[state.idx].id,
    ans: key,
    ok: ok,
    time: Date.now()
  };
}

module.exports = {
  createQuizState,
  getQuestionCount,
  shuffle,
  startRandomQuiz,
  startCategoryQuiz,
  startWrongBookQuiz,
  getCurrentQuestion,
  pickOption,
  nextQuestion,
  isQuizFinished,
  getProgress,
  getElapsedTime,
  formatTime,
  getQuizResult,
  resetQuizState,
  createAnswerRecord
};