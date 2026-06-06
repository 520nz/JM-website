/**
 * 数据库管理模块 - 核心业务逻辑
 * 负责用户答题历史、错题本、统计数据的存储和管理
 */

var DB = {
    KEY: 'jj_quiz_v2',

    /**
     * 获取所有用户数据
     * @returns {Object} 用户数据对象
     */
    get: function() {
        var d = localStorage.getItem(DB.KEY);
        if (!d) return DB.defaults();
        try {
            return JSON.parse(d);
        } catch (e) {
            return DB.defaults();
        }
    },

    /**
     * 默认数据结构
     * @returns {Object} 默认数据结构
     */
    defaults: function() {
        return {
            history: [],
            wrong: [],
            stats: {
                total: 0,
                correct: 0,
                cats: {}
            }
        };
    },

    /**
     * 保存数据到localStorage
     * @param {Object} d - 要保存的数据对象
     */
    save: function(d) {
        localStorage.setItem(DB.KEY, JSON.stringify(d));
    },

    /**
     * 添加答题记录
     * @param {Object} rec - 答题记录 {qid, ans, ok, time}
     * @param {Array} questionBank - 题库数组（用于查找分类）
     */
    addRecord: function(rec, questionBank) {
        var d = DB.get();
        d.history.push(rec);
        d.stats.total++;

        if (rec.ok) {
            d.stats.correct++;
        }

        var q = DB.findQ(rec.qid, questionBank);
        if (q) {
            if (!d.stats.cats[q.category]) {
                d.stats.cats[q.category] = { t: 0, c: 0 };
            }
            d.stats.cats[q.category].t++;
            if (rec.ok) {
                d.stats.cats[q.category].c++;
            }
        }

        DB.save(d);
    },

    /**
     * 添加错题记录
     * @param {string} qid - 题目ID
     */
    addWrong: function(qid) {
        var d = DB.get();
        var f = null;

        for (var i = 0; i < d.wrong.length; i++) {
            if (d.wrong[i].qid === qid) {
                f = d.wrong[i];
                break;
            }
        }

        if (f) {
            f.cnt++;
            f.time = Date.now();
        } else {
            d.wrong.push({
                qid: qid,
                cnt: 1,
                time: Date.now()
            });
        }

        DB.save(d);
    },

    /**
     * 移除错题记录
     * @param {string} qid - 题目ID
     */
    removeWrong: function(qid) {
        var d = DB.get();
        d.wrong = d.wrong.filter(function(w) {
            return w.qid !== qid;
        });
        DB.save(d);
    },

    /**
     * 获取所有错题
     * @returns {Array} 错题数组
     */
    getWrong: function() {
        return DB.get().wrong;
    },

    /**
     * 在题库中查找题目
     * @param {string} qid - 题目ID
     * @param {Array} questionBank - 题库数组
     * @returns {Object|null} 题目对象或null
     */
    findQ: function(qid, questionBank) {
        for (var i = 0; i < questionBank.length; i++) {
            if (questionBank[i].id === qid) {
                return questionBank[i];
            }
        }
        return null;
    },

    /**
     * 获取今日答题数据
     * @returns {Object} {count, correctCount, accuracy}
     */
    getTodayStats: function() {
        var d = DB.get();
        var today = new Date().setHours(0, 0, 0, 0);
        var th = d.history.filter(function(h) {
            return h.time >= today;
        });

        var count = th.length;
        var correctCount = th.filter(function(h) {
            return h.ok;
        }).length;
        var accuracy = count > 0 ? Math.round(correctCount / count * 100) : 0;

        return {
            count: count,
            correctCount: correctCount,
            accuracy: accuracy
        };
    },

    /**
     * 获取总体统计数据
     * @returns {Object} 统计数据
     */
    getTotalStats: function() {
        var d = DB.get();
        var acc = d.stats.total > 0 ?
            Math.round(d.stats.correct / d.stats.total * 100) : 0;

        return {
            total: d.stats.total,
            correct: d.stats.correct,
            accuracy: acc,
            wrongCount: d.wrong.length,
            cats: d.stats.cats
        };
    },

    /**
     * 清空所有数据
     */
    clear: function() {
        localStorage.removeItem(DB.KEY);
    }
};

module.exports = DB;