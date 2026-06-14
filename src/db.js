/**
 * 数据管理模块 - 负责本地存储的读写操作
 * 核心功能：答题记录、错题本、统计数据
 */

// 默认数据结构
function createDefaultData() {
  return {
    history: [],
    wrong: [],
    stats: {
      total: 0,
      correct: 0,
      cats: {}
    }
  };
}

// 存储键名
const STORAGE_KEY = 'jj_quiz_v2';

/**
 * 数据库管理对象
 */
const DB = {
  KEY: STORAGE_KEY,

  /**
   * 获取所有数据
   * @returns {Object} 数据对象
   */
  get: function() {
    try {
      const data = localStorage.getItem(this.KEY);
      return data ? JSON.parse(data) : createDefaultData();
    } catch (e) {
      return createDefaultData();
    }
  },

  /**
   * 保存数据
   * @param {Object} data - 要保存的数据
   */
  save: function(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      console.error('保存数据失败:', e);
    }
  },

  /**
   * 添加答题记录
   * @param {Object} rec - 答题记录 {qid, ans, ok, time}
   * @param {Array} questionBank - 题库数组
   */
  addRecord: function(rec, questionBank) {
    const data = this.get();
    data.history.push(rec);
    data.stats.total++;
    
    if (rec.ok) {
      data.stats.correct++;
    }
    
    // 更新分类统计
    const q = this.findQ(rec.qid, questionBank);
    if (q) {
      if (!data.stats.cats[q.category]) {
        data.stats.cats[q.category] = { t: 0, c: 0 };
      }
      data.stats.cats[q.category].t++;
      if (rec.ok) {
        data.stats.cats[q.category].c++;
      }
    }
    
    this.save(data);
  },

  /**
   * 添加错题
   * @param {string} qid - 题目ID
   */
  addWrong: function(qid) {
    const data = this.get();
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
    
    this.save(data);
  },

  /**
   * 移除错题
   * @param {string} qid - 题目ID
   */
  removeWrong: function(qid) {
    const data = this.get();
    data.wrong = data.wrong.filter(function(w) {
      return w.qid !== qid;
    });
    this.save(data);
  },

  /**
   * 获取错题列表
   * @returns {Array} 错题数组
   */
  getWrong: function() {
    return this.get().wrong;
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
    localStorage.removeItem(this.KEY);
  },

  /**
   * 获取今日答题数据
   * @returns {Object} {count, correctCount, accuracy}
   */
  getTodayStats: function() {
    const data = this.get();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayHistory = data.history.filter(function(h) {
      return h.time >= todayStart;
    });
    
    const count = todayHistory.length;
    const correctCount = todayHistory.filter(function(h) {
      return h.ok;
    }).length;
    const accuracy = count > 0 ? Math.round(correctCount / count * 100) : 0;
    
    return { count, correctCount, accuracy };
  },

  /**
   * 获取总体统计
   * @returns {Object} 统计数据
   */
  getOverallStats: function() {
    const data = this.get();
    const total = data.stats.total;
    const correct = data.stats.correct;
    const accuracy = total > 0 ? Math.round(correct / total * 100) : 0;
    
    return {
      total,
      correct,
      wrong: data.wrong.length,
      accuracy,
      cats: data.stats.cats
    };
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DB, createDefaultData, STORAGE_KEY };
}
