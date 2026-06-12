/**
 * 数据存储模块 - 处理LocalStorage数据存取
 * 核心功能：答题记录存储、错题管理、统计数据
 */

const DB = {
    KEY: 'jj_quiz_v2',
    QUESTION_BANK_KEY: 'jj_question_bank',

    /**
     * 获取localStorage（支持测试环境）
     * @returns {Object} localStorage对象
     */
    _getStorage: function() {
        // 在Node.js测试环境中，使用global.localStorage
        // 在浏览器环境中，使用window.localStorage或localStorage
        if (typeof global !== 'undefined' && global.localStorage) {
            return global.localStorage;
        }
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
        return localStorage;
    },

    /**
     * 获取用户数据
     * @returns {Object} 用户数据对象
     */
    get: function() {
        try {
            const storage = DB._getStorage();
            const data = storage.getItem(DB.KEY);
            return data ? JSON.parse(data) : DB.defaults();
        } catch (e) {
            console.error('DB.get error:', e);
            return DB.defaults();
        }
    },

    /**
     * 默认数据结构
     * @returns {Object} 默认数据对象
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
     * 保存数据到LocalStorage
     * @param {Object} data - 要保存的数据
     */
    save: function(data) {
        try {
            const storage = DB._getStorage();
            storage.setItem(DB.KEY, JSON.stringify(data));
        } catch (e) {
            console.error('DB.save error:', e);
        }
    },

    /**
     * 添加答题记录
     * @param {Object} rec - 答题记录 {qid, ans, ok, time}
     * @param {Array} questionBank - 题库数组
     */
    addRecord: function(rec, questionBank) {
        const data = DB.get();
        data.history.push(rec);
        data.stats.total++;

        if (rec.ok) {
            data.stats.correct++;
        }

        const q = DB.findQ(rec.qid, questionBank);
        if (q) {
            if (!data.stats.cats[q.category]) {
                data.stats.cats[q.category] = { t: 0, c: 0 };
            }
            data.stats.cats[q.category].t++;
            if (rec.ok) {
                data.stats.cats[q.category].c++;
            }
        }

        DB.save(data);
    },

    /**
     * 添加错题
     * @param {string} qid - 题目ID
     */
    addWrong: function(qid) {
        const data = DB.get();
        let found = null;

        for (let i = 0; i < data.wrong.length; i++) {
            if (data.wrong[i].qid === qid) {
                found = data.wrong[i];
                break;
            }
        }

        if (found) {
            found.cnt++;
            found.time = Date.now();
        } else {
            data.wrong.push({ qid: qid, cnt: 1, time: Date.now() });
        }

        DB.save(data);
    },

    /**
     * 移除错题
     * @param {string} qid - 题目ID
     */
    removeWrong: function(qid) {
        const data = DB.get();
        data.wrong = data.wrong.filter(function(w) {
            return w.qid !== qid;
        });
        DB.save(data);
    },

    /**
     * 获取错题列表
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
        for (let i = 0; i < questionBank.length; i++) {
            if (questionBank[i].id === qid) {
                return questionBank[i];
            }
        }
        return null;
    },

    /**
     * 清除所有数据
     */
    clear: function() {
        const storage = DB._getStorage();
        storage.removeItem(DB.KEY);
    },

    /**
     * 保存题库
     * @param {Array} questionBank - 题库数组
     */
    saveQuestionBank: function(questionBank) {
        const storage = DB._getStorage();
        storage.setItem(DB.QUESTION_BANK_KEY, JSON.stringify(questionBank));
    },

    /**
     * 加载题库
     * @returns {Array} 题库数组
     */
    loadQuestionBank: function() {
        const storage = DB._getStorage();
        const saved = storage.getItem(DB.QUESTION_BANK_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return null;
            }
        }
        return null;
    }
};

// 导出模块（支持Node.js和浏览器环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DB;
}
