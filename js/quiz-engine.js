/**
 * 答题引擎模块 - 处理答题逻辑
 * 核心功能：题目随机化、答案校验、进度追踪
 */

const QuizEngine = {
    /**
     * Fisher-Yates 洗牌算法
     * @param {Array} arr - 要打乱的数组
     * @returns {Array} 打乱后的新数组
     */
    shuffle: function(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    },

    /**
     * 获取答题数量
     * @param {string} mode - 模式 ('quick'|'standard'|'intensive')
     * @returns {number} 题目数量
     */
    getCount: function(mode) {
        const modes = {
            quick: 10,
            standard: 20,
            intensive: 30
        };
        return modes[mode] || 10;
    },

    /**
     * 开始随机练习
     * @param {Array} questionBank - 题库数组
     * @param {string} mode - 模式
     * @returns {Object} 答题状态
     */
    startRandomQuiz: function(questionBank, mode) {
        const count = QuizEngine.getCount(mode);
        const shuffled = QuizEngine.shuffle(questionBank);
        const quiz = shuffled.slice(0, Math.min(count, shuffled.length));

        return {
            quiz: quiz,
            idx: 0,
            correctCount: 0,
            startTime: Date.now(),
            mode: mode
        };
    },

    /**
     * 开始分类练习
     * @param {Array} questionBank - 题库数组
     * @param {string} category - 分类名称
     * @param {string} mode - 模式
     * @returns {Object} 答题状态
     */
    startCategoryQuiz: function(questionBank, category, mode) {
        const filtered = questionBank.filter(function(q) {
            return q.category === category;
        });
        const count = QuizEngine.getCount(mode);
        const shuffled = QuizEngine.shuffle(filtered);
        const quiz = shuffled.slice(0, Math.min(count, shuffled.length));

        return {
            quiz: quiz,
            idx: 0,
            correctCount: 0,
            startTime: Date.now(),
            mode: mode
        };
    },

    /**
     * 在题库中查找题目（内部使用）
     * @param {string} qid - 题目ID
     * @param {Array} questionBank - 题库数组
     * @returns {Object|null} 题目对象或null
     */
    _findQ: function(qid, questionBank) {
        for (let i = 0; i < questionBank.length; i++) {
            if (questionBank[i].id === qid) {
                return questionBank[i];
            }
        }
        return null;
    },

    /**
     * 开始错题练习
     * @param {Array} questionBank - 题库数组
     * @param {Array} wrongList - 错题列表
     * @returns {Object} 答题状态
     */
    startWrongBookQuiz: function(questionBank, wrongList) {
        const questions = [];
        for (let i = 0; i < wrongList.length; i++) {
            const q = QuizEngine._findQ(wrongList[i].qid, questionBank);
            if (q) {
                questions.push(q);
            }
        }

        const quiz = QuizEngine.shuffle(questions);

        return {
            quiz: quiz,
            idx: 0,
            correctCount: 0,
            startTime: Date.now(),
            mode: 'wrongbook'
        };
    },

    /**
     * 校验答案
     * @param {Object} question - 题目对象
     * @param {string} userAnswer - 用户答案
     * @returns {boolean} 是否正确
     */
    checkAnswer: function(question, userAnswer) {
        return userAnswer === question.answer;
    },

    /**
     * 提交答案并获取结果
     * @param {Object} state - 当前答题状态
     * @param {string} userAnswer - 用户答案
     * @returns {Object} 结果对象 {correct, feedback}
     */
    submitAnswer: function(state, userAnswer) {
        const question = state.quiz[state.idx];
        const isCorrect = QuizEngine.checkAnswer(question, userAnswer);

        if (isCorrect) {
            state.correctCount++;
        }

        return {
            correct: isCorrect,
            question: question,
            userAnswer: userAnswer,
            explanation: question.explanation
        };
    },

    /**
     * 下一题
     * @param {Object} state - 当前答题状态
     * @returns {boolean} 是否还有下一题
     */
    nextQuestion: function(state) {
        state.idx++;
        return state.idx < state.quiz.length;
    },

    /**
     * 计算答题用时
     * @param {Object} state - 答题状态
     * @returns {number} 用时毫秒数
     */
    getElapsedTime: function(state) {
        return Date.now() - state.startTime;
    },

    /**
     * 格式化时间显示
     * @param {number} ms - 毫秒数
     * @returns {string} 格式化后的时间字符串
     */
    formatTime: function(ms) {
        const sec = Math.floor(ms / 1000);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return m + '分' + s + '秒';
    },

    /**
     * 获取答题结果统计
     * @param {Object} state - 答题状态
     * @returns {Object} 统计结果
     */
    getQuizResult: function(state) {
        const total = state.quiz.length;
        const correct = state.correctCount;
        const wrong = total - correct;
        const percentage = total > 0 ? Math.round(correct / total * 100) : 0;
        const elapsed = QuizEngine.getElapsedTime(state);

        return {
            total: total,
            correct: correct,
            wrong: wrong,
            percentage: percentage,
            elapsed: elapsed,
            formattedTime: QuizEngine.formatTime(elapsed)
        };
    },

    /**
     * 获取当前题目
     * @param {Object} state - 答题状态
     * @returns {Object|null} 当前题目或null
     */
    getCurrentQuestion: function(state) {
        if (state.idx >= state.quiz.length) {
            return null;
        }
        return state.quiz[state.idx];
    },

    /**
     * 获取进度百分比
     * @param {Object} state - 答题状态
     * @returns {number} 进度百分比 (0-100)
     */
    getProgress: function(state) {
        if (state.quiz.length === 0) return 0;
        return Math.round(state.idx / state.quiz.length * 100);
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuizEngine;
}
