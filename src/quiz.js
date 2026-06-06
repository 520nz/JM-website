/**
 * 答题逻辑模块 - 核心业务逻辑
 * 负责答题流程控制、计时、评分
 */

var Quiz = {
    /**
     * 答题状态
     */
    state: {
        quiz: [],
        idx: 0,
        answered: false,
        mode: 'quick',
        correctCount: 0,
        startTime: 0,
        timer: null
    },

    /**
     * 模式配置
     */
    MODES: {
        quick: 10,
        standard: 20,
        intensive: 30
    },

    /**
     * 获取当前模式题目数量
     * @returns {number} 题目数量
     */
    getCount: function() {
        return Quiz.MODES[Quiz.state.mode] || 10;
    },

    /**
     * 设置答题模式
     * @param {string} mode - 模式名称
     * @returns {boolean} 是否成功设置
     */
    setMode: function(mode) {
        if (Quiz.MODES[mode]) {
            Quiz.state.mode = mode;
            return true;
        }
        return false;
    },

    /**
     * 开始随机答题
     * @param {Array} questionBank - 题库数组
     * @param {string} category - 分类（可选）
     */
    startRandom: function(questionBank, category) {
        var pool = category ?
            questionBank.filter(function(q) { return q.category === category; }) :
            questionBank;

        Quiz.state.quiz = Quiz.shuffle(pool).slice(0, Quiz.getCount());
        Quiz.state.idx = 0;
        Quiz.state.correctCount = 0;
        Quiz.state.startTime = Date.now();
        Quiz.state.answered = false;
    },

    /**
     * 开始错题复习
     * @param {Array} wrongList - 错题ID列表
     * @param {Array} questionBank - 题库数组
     */
    startWrongBook: function(wrongList, questionBank) {
        var qs = [];
        for (var i = 0; i < wrongList.length; i++) {
            var q = Quiz.findQ(wrongList[i].qid, questionBank);
            if (q) qs.push(q);
        }

        if (qs.length === 0) return false;

        Quiz.state.quiz = Quiz.shuffle(qs);
        Quiz.state.idx = 0;
        Quiz.state.correctCount = 0;
        Quiz.state.startTime = Date.now();
        Quiz.state.answered = false;

        return true;
    },

    /**
     * 获取当前题目
     * @returns {Object|null} 当前题目对象
     */
    getCurrentQuestion: function() {
        if (Quiz.state.idx >= Quiz.state.quiz.length) {
            return null;
        }
        return Quiz.state.quiz[Quiz.state.idx];
    },

    /**
     * 选择答案
     * @param {string} key - 选择的答案键（A/B/C/D）
     * @returns {Object} {correct, answer, explanation}
     */
    pickAnswer: function(key) {
        if (Quiz.state.answered) {
            return null;
        }

        Quiz.state.answered = true;
        var q = Quiz.getCurrentQuestion();
        var correct = (key === q.answer);

        if (correct) {
            Quiz.state.correctCount++;
        }

        return {
            correct: correct,
            answer: q.answer,
            explanation: q.explanation,
            questionId: q.id,
            selectedKey: key
        };
    },

    /**
     * 下一题
     * @returns {boolean} 是否还有下一题
     */
    next: function() {
        Quiz.state.idx++;
        Quiz.state.answered = false;
        return Quiz.state.idx < Quiz.state.quiz.length;
    },

    /**
     * 获取答题进度
     * @returns {Object} {current, total, percentage}
     */
    getProgress: function() {
        return {
            current: Quiz.state.idx + 1,
            total: Quiz.state.quiz.length,
            percentage: Math.round((Quiz.state.idx + 1) / Quiz.state.quiz.length * 100)
        };
    },

    /**
     * 获取用时
     * @returns {Object} {milliseconds, formatted}
     */
    getElapsedTime: function() {
        var elapsed = Date.now() - Quiz.state.startTime;
        return {
            milliseconds: elapsed,
            formatted: Quiz.formatTime(elapsed)
        };
    },

    /**
     * 格式化时间
     * @param {number} ms - 毫秒数
     * @returns {string} 格式化的时间字符串
     */
    formatTime: function(ms) {
        var sec = Math.floor(ms / 1000);
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return m + '分' + s + '秒';
    },

    /**
     * 完成答题，获取结果
     * @returns {Object} 答题结果
     */
    finish: function() {
        var elapsed = Quiz.getElapsedTime();
        var total = Quiz.state.quiz.length;
        var correct = Quiz.state.correctCount;
        var wrong = total - correct;
        var percentage = total > 0 ? Math.round(correct / total * 100) : 0;

        return {
            total: total,
            correct: correct,
            wrong: wrong,
            percentage: percentage,
            time: elapsed.formatted,
            timeMs: elapsed.milliseconds
        };
    },

    /**
     * 是否已完成
     * @returns {boolean}
     */
    isFinished: function() {
        return Quiz.state.idx >= Quiz.state.quiz.length;
    },

    /**
     * 重置答题状态
     */
    reset: function() {
        Quiz.state.quiz = [];
        Quiz.state.idx = 0;
        Quiz.state.answered = false;
        Quiz.state.correctCount = 0;
        Quiz.state.startTime = 0;
    },

    /**
     * Fisher-Yates 洗牌算法
     * @param {Array} arr - 数组
     * @returns {Array} 洗牌后的数组
     */
    shuffle: function(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    },

    /**
     * 在题库中查找题目
     * @param {string} qid - 题目ID
     * @param {Array} questionBank - 题库数组
     * @returns {Object|null} 题目对象
     */
    findQ: function(qid, questionBank) {
        for (var i = 0; i < questionBank.length; i++) {
            if (questionBank[i].id === qid) {
                return questionBank[i];
            }
        }
        return null;
    }
};

module.exports = Quiz;