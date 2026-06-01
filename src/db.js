// 数据库存储模块
function createDB(localStorage, questionBank) {
  const DB = {
    KEY: 'jj_quiz_v2',
    
    get() {
      const d = localStorage.getItem(DB.KEY);
      return d ? JSON.parse(d) : DB.defaults();
    },
    
    defaults() {
      return { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
    },
    
    save(data) {
      localStorage.setItem(DB.KEY, JSON.stringify(data));
    },
    
    addRecord(record) {
      const d = DB.get();
      d.history.push(record);
      d.stats.total++;
      if (record.ok) d.stats.correct++;
      const q = DB.findQ(record.qid);
      if (q) {
        if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
        d.stats.cats[q.category].t++;
        if (record.ok) d.stats.cats[q.category].c++;
      }
      DB.save(d);
    },
    
    addWrong(qid) {
      const d = DB.get();
      let found = null;
      for (let i = 0; i < d.wrong.length; i++) {
        if (d.wrong[i].qid === qid) {
          found = d.wrong[i];
          break;
        }
      }
      if (found) {
        found.cnt++;
        found.time = Date.now();
      } else {
        d.wrong.push({ qid, cnt: 1, time: Date.now() });
      }
      DB.save(d);
    },
    
    removeWrong(qid) {
      const d = DB.get();
      d.wrong = d.wrong.filter(w => w.qid !== qid);
      DB.save(d);
    },
    
    getWrong() {
      return DB.get().wrong;
    },
    
    findQ(qid) {
      for (let i = 0; i < questionBank.length; i++) {
        if (questionBank[i].id === qid) return questionBank[i];
      }
      return null;
    }
  };
  
  return DB;
}

module.exports = { createDB };
