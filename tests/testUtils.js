/**
 * 核心业务逻辑模块 - 可独立测试
 * 从 index.html 中提取的关键函数
 */

// 默认题库（用于测试）
const DEFAULT_QUESTIONS = [
  { id: '001', category: '专辑', question: '测试问题1', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], answer: 'A', explanation: '解释1' },
  { id: '002', category: '歌曲', question: '测试问题2', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], answer: 'B', explanation: '解释2' },
];

// 数据库管理对象
const DB = {
  KEY: 'jj_quiz_v2',

  get: function() {
    const data = localStorage.getItem(DB.KEY);
    if (!data) return DB.defaults();
    try {
      return JSON.parse(data);
    } catch (e) {
      // 数据损坏时返回默认值
      return DB.defaults();
    }
  },

  defaults: function() {
    return { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
  },

  save: function(data) {
    localStorage.setItem(DB.KEY, JSON.stringify(data));
  },

  addRecord: function(rec, questionBank) {
    const data = DB.get();
    data.history.push(rec);
    data.stats.total++;
    if (rec.ok) data.stats.correct++;

    const q = DB.findQ(rec.qid, questionBank);
    if (q) {
      if (!data.stats.cats[q.category]) data.stats.cats[q.category] = { t: 0, c: 0 };
      data.stats.cats[q.category].t++;
      if (rec.ok) data.stats.cats[q.category].c++;
    }
    DB.save(data);
  },

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

  removeWrong: function(qid) {
    const data = DB.get();
    data.wrong = data.wrong.filter(function(w) { return w.qid !== qid; });
    DB.save(data);
  },

  getWrong: function() {
    return DB.get().wrong;
  },

  findQ: function(qid, questionBank) {
    for (let i = 0; i < questionBank.length; i++) {
      if (questionBank[i].id === qid) return questionBank[i];
    }
    return null;
  }
};

// 题库管理函数
function parseOptions(optsText) {
  const lines = optsText.split('\n');
  const options = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
    if (match) {
      options.push({ key: match[1], text: match[2] });
    }
  }
  return options;
}

function saveQuestionToBank(questionBank, editData) {
  const { id, category, question, optsText, answer, explanation } = editData;

  if (!question || !optsText) {
    return { success: false, error: '请填写题目和选项' };
  }

  const options = parseOptions(optsText);

  if (options.length < 2) {
    return { success: false, error: '请至少输入两个选项，格式：A.选项内容' };
  }

  if (!id) {
    // 新增
    const newId = 'q' + Date.now();
    questionBank.push({
      id: newId,
      category: category,
      question: question,
      options: options,
      answer: answer,
      explanation: explanation
    });
    return { success: true, isNew: true, id: newId };
  } else {
    // 编辑
    for (let j = 0; j < questionBank.length; j++) {
      if (questionBank[j].id === id) {
        questionBank[j].category = category;
        questionBank[j].question = question;
        questionBank[j].options = options;
        questionBank[j].answer = answer;
        questionBank[j].explanation = explanation;
        break;
      }
    }
    return { success: true, isNew: false, id: id };
  }
}

function deleteQuestionFromBank(questionBank, qid) {
  const index = questionBank.findIndex(q => q.id === qid);
  if (index === -1) {
    return { success: false, error: '题目不存在' };
  }
  questionBank.splice(index, 1);
  return { success: true };
}

// 数据导入函数
function importDataFromJSON(questionBank, jsonData) {
  if (!jsonData || (!jsonData.questionBank && !jsonData.userData)) {
    return { success: false, error: '文件中未找到有效数据（questionBank 或 userData）' };
  }

  let addedCount = 0;
  let updatedCount = 0;

  if (jsonData.questionBank) {
    const existingIds = {};
    for (let i = 0; i < questionBank.length; i++) {
      existingIds[questionBank[i].id] = true;
    }
    for (let j = 0; j < jsonData.questionBank.length; j++) {
      const q = jsonData.questionBank[j];
      if (existingIds[q.id]) {
        for (let k = 0; k < questionBank.length; k++) {
          if (questionBank[k].id === q.id) {
            questionBank[k] = q;
            updatedCount++;
            break;
          }
        }
      } else {
        questionBank.push(q);
        addedCount++;
      }
    }
  }

  if (jsonData.userData) {
    const existingData = DB.get();
    if (jsonData.userData.history) {
      existingData.history = existingData.history.concat(jsonData.userData.history);
    }
    if (jsonData.userData.wrong) {
      const wrongMap = {};
      for (let w = 0; w < existingData.wrong.length; w++) {
        wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
      }
      for (let x = 0; x < jsonData.userData.wrong.length; x++) {
        const wrongItem = jsonData.userData.wrong[x];
        if (wrongMap[wrongItem.qid]) {
          wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
        } else {
          existingData.wrong.push(wrongItem);
        }
      }
    }
    if (jsonData.userData.stats) {
      if (!existingData.stats) existingData.stats = { total: 0, correct: 0, cats: {} };
      existingData.stats.total += jsonData.userData.stats.total || 0;
      existingData.stats.correct += jsonData.userData.stats.correct || 0;
      if (jsonData.userData.stats.cats) {
        for (const catName in jsonData.userData.stats.cats) {
          if (!existingData.stats.cats[catName]) {
            existingData.stats.cats[catName] = { t: 0, c: 0 };
          }
          existingData.stats.cats[catName].t += jsonData.userData.stats.cats[catName].t || 0;
          existingData.stats.cats[catName].c += jsonData.userData.stats.cats[catName].c || 0;
        }
      }
    }
    DB.save(existingData);
  }

  return {
    success: true,
    addedCount,
    updatedCount
  };
}

// 洗牌算法
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

// 导出模块
module.exports = {
  DB,
  DEFAULT_QUESTIONS,
  parseOptions,
  saveQuestionToBank,
  deleteQuestionFromBank,
  importDataFromJSON,
  shuffle
};
