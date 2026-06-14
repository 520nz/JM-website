/**
 * 题库管理模块
 */

/**
 * 题库管理器
 */
const QuestionBankManager = {
  STORAGE_KEY: 'jj_question_bank',
  
  /**
   * 保存题库到本地存储
   * @param {Array} questionBank - 题库数组
   */
  save: function(questionBank) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(questionBank));
    } catch (e) {
      console.error('保存题库失败:', e);
    }
  },

  /**
   * 从本地存储加载题库
   * @param {Array} defaultBank - 默认题库
   * @returns {Array} 题库数组
   */
  load: function(defaultBank) {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('加载题库失败:', e);
    }
    return defaultBank ? defaultBank.slice() : [];
  },

  /**
   * 添加题目
   * @param {Array} questionBank - 题库数组
   * @param {Object} question - 新题目
   * @returns {Array} 更新后的题库
   */
  add: function(questionBank, question) {
    const bank = questionBank.slice();
    bank.push(question);
    return bank;
  },

  /**
   * 更新题目
   * @param {Array} questionBank - 题库数组
   * @param {string} qid - 题目ID
   * @param {Object} newData - 新数据
   * @returns {Array} 更新后的题库
   */
  update: function(questionBank, qid, newData) {
    return questionBank.map(function(q) {
      if (q.id === qid) {
        return Object.assign({}, q, newData);
      }
      return q;
    });
  },

  /**
   * 删除题目
   * @param {Array} questionBank - 题库数组
   * @param {string} qid - 题目ID
   * @returns {Array} 更新后的题库
   */
  delete: function(questionBank, qid) {
    return questionBank.filter(function(q) {
      return q.id !== qid;
    });
  },

  /**
   * 获取所有分类
   * @param {Array} questionBank - 题库数组
   * @returns {Array} 分类名称数组
   */
  getCategories: function(questionBank) {
    const cats = {};
    for (let i = 0; i < questionBank.length; i++) {
      cats[questionBank[i].category] = true;
    }
    return Object.keys(cats).sort();
  },

  /**
   * 按分类筛选题目
   * @param {Array} questionBank - 题库数组
   * @param {string} category - 分类名称
   * @returns {Array} 筛选后的题目
   */
  filterByCategory: function(questionBank, category) {
    if (!category) return questionBank.slice();
    return questionBank.filter(function(q) {
      return q.category === category;
    });
  },

  /**
   * 搜索题目
   * @param {Array} questionBank - 题库数组
   * @param {string} keyword - 搜索关键词
   * @returns {Array} 匹配的题目
   */
  search: function(questionBank, keyword) {
    if (!keyword) return questionBank.slice();
    const lower = keyword.toLowerCase();
    return questionBank.filter(function(q) {
      return q.question.toLowerCase().indexOf(lower) !== -1;
    });
  },

  /**
   * 重置为默认题库
   * @param {Array} defaultBank - 默认题库
   * @returns {Array} 默认题库副本
   */
  reset: function(defaultBank) {
    localStorage.removeItem(this.STORAGE_KEY);
    return defaultBank ? defaultBank.slice() : [];
  },

  /**
   * 导入题库数据
   * @param {Array} questionBank - 当前题库
   * @param {Array} importData - 导入的题目
   * @returns {Object} {bank, added, updated}
   */
  import: function(questionBank, importData) {
    const existingIds = {};
    for (let i = 0; i < questionBank.length; i++) {
      existingIds[questionBank[i].id] = true;
    }
    
    let added = 0;
    let updated = 0;
    const bank = questionBank.slice();
    
    for (let j = 0; j < importData.length; j++) {
      const q = importData[j];
      if (existingIds[q.id]) {
        // 更新已存在的题目
        for (let k = 0; k < bank.length; k++) {
          if (bank[k].id === q.id) {
            bank[k] = q;
            updated++;
            break;
          }
        }
      } else {
        // 添加新题目
        bank.push(q);
        added++;
      }
    }
    
    return { bank, added, updated };
  },

  /**
   * 导出题库数据
   * @param {Array} questionBank - 题库数组
   * @param {Object} userData - 用户数据（可选）
   * @returns {Object} 导出数据对象
   */
  export: function(questionBank, userData) {
    const data = {
      questionBank: questionBank,
      exportTime: new Date().toISOString()
    };
    if (userData) {
      data.userData = userData;
    }
    return data;
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QuestionBankManager };
}
