// 数据库模块
// 注意：在浏览器环境中，我们会使用 localStorage
// 在测试环境中，我们需要模拟 localStorage

/**
 * 创建 DB 实例
 * @param {Object} options - 配置选项
 * @param {Array} options.questionBank - 题库数据
 * @param {Object} options.storage - localStorage 实现，默认 window.localStorage
 * @returns {Object} DB 实例
 */
function createDB(options) {
  const { questionBank, storage } = options;
  let QUESTION_BANK = questionBank || [];
  
  const DB = {
    KEY: 'jj_quiz_v2',
    
    get: function() {
      var d = storage.getItem(DB.KEY);
      return d ? JSON.parse(d) : DB.defaults();
    },
    
    defaults: function() {
      return { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
    },
    
    save: function(d) {
      storage.setItem(DB.KEY, JSON.stringify(d));
    },
    
    addRecord: function(rec) {
      var d = DB.get();
      d.history.push(rec);
      d.stats.total++;
      if (rec.ok) d.stats.correct++;
      var q = DB.findQ(rec.qid);
      if (q) {
        if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
        d.stats.cats[q.category].t++;
        if (rec.ok) d.stats.cats[q.category].c++;
      }
      DB.save(d);
    },
    
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
        d.wrong.push({ qid: qid, cnt: 1, time: Date.now() });
      }
      DB.save(d);
    },
    
    removeWrong: function(qid) {
      var d = DB.get();
      d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
      DB.save(d);
    },
    
    getWrong: function() {
      return DB.get().wrong;
    },
    
    findQ: function(qid) {
      for (var i = 0; i < QUESTION_BANK.length; i++) {
        if (QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
      }
      return null;
    },
    
    // 供测试使用的内部方法
    _setQuestionBank: function(qb) {
      QUESTION_BANK = qb;
    },
    
    _getQuestionBank: function() {
      return QUESTION_BANK;
    }
  };
  
  return DB;
}

module.exports = { createDB };
