/**
 * 核心业务逻辑模块
 * 包含数据导入、题目管理、统计计算、错题本管理等关键功能
 */

// 默认题库备份
let DEFAULT_QUESTION_BANK = [];

// 当前题库
let QUESTION_BANK = [];

/**
 * 数据库管理模块
 */
export const DB = {
  KEY: 'jj_quiz_v2',
  
  get() {
    const data = localStorage.getItem(this.KEY);
    if (!data) return this.defaults();
    try {
      return JSON.parse(data);
    } catch (e) {
      // 数据损坏时返回默认数据
      return this.defaults();
    }
  },
  
  defaults() {
    return {
      history: [],
      wrong: [],
      stats: { total: 0, correct: 0, cats: {} }
    };
  },
  
  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },
  
  addRecord(rec) {
    const data = this.get();
    data.history.push(rec);
    data.stats.total++;
    if (rec.ok) data.stats.correct++;
    
    const q = this.findQ(rec.qid);
    if (q) {
      if (!data.stats.cats[q.category]) {
        data.stats.cats[q.category] = { t: 0, c: 0 };
      }
      data.stats.cats[q.category].t++;
      if (rec.ok) data.stats.cats[q.category].c++;
    }
    
    this.save(data);
  },
  
  addWrong(qid) {
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
  
  removeWrong(qid) {
    const data = this.get();
    data.wrong = data.wrong.filter(w => w.qid !== qid);
    this.save(data);
  },
  
  getWrong() {
    return this.get().wrong;
  },
  
  findQ(qid) {
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      if (QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
    }
    return null;
  }
};

/**
 * 初始化题库
 */
export function initQuestionBank(defaultBank) {
  DEFAULT_QUESTION_BANK = defaultBank.slice();
  QUESTION_BANK = defaultBank.slice();
}

/**
 * 获取当前题库
 */
export function getQuestionBank() {
  return QUESTION_BANK;
}

/**
 * 设置题库(用于测试)
 */
export function setQuestionBank(bank) {
  QUESTION_BANK = bank.slice();
}

/**
 * 解析选项文本
 * @param {string} optsText - 选项文本,格式: "A.选项内容\nB.选项内容"
 * @returns {Array} - 解析后的选项数组
 */
export function parseOptions(optsText) {
  const lines = optsText.split('\n');
  const options = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 支持多种格式: A., A、, A．
    const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
    if (match) {
      options.push({ key: match[1], text: match[2] });
    }
  }
  
  return options;
}

/**
 * 保存题目到题库
 */
export function saveQuestion(id, category, question, optsText, answer, explanation) {
  if (!question || !optsText) {
    throw new Error('请填写题目和选项');
  }
  
  const options = parseOptions(optsText);
  
  if (options.length < 2) {
    throw new Error('请至少输入两个选项,格式:A.选项内容');
  }
  
  if (!id) {
    // 新增
    const newId = 'q' + Date.now();
    QUESTION_BANK.push({
      id: newId,
      category: category,
      question: question,
      options: options,
      answer: answer,
      explanation: explanation
    });
    return { action: 'add', id: newId };
  } else {
    // 编辑
    for (let j = 0; j < QUESTION_BANK.length; j++) {
      if (QUESTION_BANK[j].id === id) {
        QUESTION_BANK[j].category = category;
        QUESTION_BANK[j].question = question;
        QUESTION_BANK[j].options = options;
        QUESTION_BANK[j].answer = answer;
        QUESTION_BANK[j].explanation = explanation;
        return { action: 'update', id: id };
      }
    }
    return { action: 'not_found', id: id };
  }
}

/**
 * 删除题目
 */
export function deleteQuestion(qid) {
  QUESTION_BANK = QUESTION_BANK.filter(q => q.id !== qid);
}

/**
 * 导出数据
 */
export function exportData() {
  return {
    questionBank: QUESTION_BANK,
    userData: DB.get(),
    exportTime: new Date().toISOString()
  };
}

/**
 * 导入数据
 * @param {Object} data - 导入的数据对象
 * @returns {Object} - 导入结果统计
 */
export function importData(data) {
  // 数据验证
  if (!data || typeof data !== 'object') {
    throw new Error('导入失败:数据格式不正确');
  }
  
  // JSON解析已在调用前完成,这里验证数据结构
  if (!data.questionBank && !data.userData) {
    throw new Error('导入失败:文件中未找到有效数据(questionBank 或 userData)');
  }
  
  let addedCount = 0;
  let updatedCount = 0;
  
  // 导入题库
  if (data.questionBank && Array.isArray(data.questionBank)) {
    const existingIds = {};
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      existingIds[QUESTION_BANK[i].id] = true;
    }
    
    for (let j = 0; j < data.questionBank.length; j++) {
      const q = data.questionBank[j];
      
      // 验证题目数据完整性
      if (!q.id || !q.question || !q.options || !q.answer) {
        continue; // 跳过不完整的题目
      }
      
      if (existingIds[q.id]) {
        // 更新现有题目
        for (let k = 0; k < QUESTION_BANK.length; k++) {
          if (QUESTION_BANK[k].id === q.id) {
            QUESTION_BANK[k] = q;
            updatedCount++;
            break;
          }
        }
      } else {
        // 新增题目
        QUESTION_BANK.push(q);
        addedCount++;
      }
    }
  }
  
  // 导入用户数据
  if (data.userData && typeof data.userData === 'object') {
    const existingData = DB.get();
    
    // 合并历史记录
    if (data.userData.history && Array.isArray(data.userData.history)) {
      existingData.history = existingData.history.concat(data.userData.history);
    }
    
    // 合并错题记录
    if (data.userData.wrong && Array.isArray(data.userData.wrong)) {
      const wrongMap = {};
      for (let w = 0; w < existingData.wrong.length; w++) {
        wrongMap[existingData.wrong[w].qid] = existingData.wrong[w];
      }
      
      for (let x = 0; x < data.userData.wrong.length; x++) {
        const wrongItem = data.userData.wrong[x];
        if (!wrongItem.qid || !wrongItem.cnt) continue;
        
        if (wrongMap[wrongItem.qid]) {
          wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
        } else {
          existingData.wrong.push(wrongItem);
        }
      }
    }
    
    // 合并统计数据
    if (data.userData.stats && typeof data.userData.stats === 'object') {
      if (!existingData.stats) {
        existingData.stats = { total: 0, correct: 0, cats: {} };
      }
      
      existingData.stats.total += data.userData.stats.total || 0;
      existingData.stats.correct += data.userData.stats.correct || 0;
      
      if (data.userData.stats.cats && typeof data.userData.stats.cats === 'object') {
        for (const catName in data.userData.stats.cats) {
          if (!existingData.stats.cats[catName]) {
            existingData.stats.cats[catName] = { t: 0, c: 0 };
          }
          existingData.stats.cats[catName].t += data.userData.stats.cats[catName].t || 0;
          existingData.stats.cats[catName].c += data.userData.stats.cats[catName].c || 0;
        }
      }
    }
    
    DB.save(existingData);
  }
  
  return {
    addedCount: addedCount,
    updatedCount: updatedCount,
    totalQuestions: QUESTION_BANK.length
  };
}

/**
 * 恢复默认题库
 */
export function resetQuestionBank() {
  QUESTION_BANK = DEFAULT_QUESTION_BANK.slice();
  localStorage.removeItem('jj_question_bank');
  return QUESTION_BANK.length;
}

/**
 * 统计分析
 */
export function calculateStats() {
  const data = DB.get();
  const total = data.stats.total;
  const correct = data.stats.correct;
  const accuracy = total > 0 ? Math.round(correct / total * 100) : 0;
  
  return {
    total,
    correct,
    accuracy,
    wrong: data.wrong.length,
    cats: data.stats.cats
  };
}

/**
 * 获取今日统计
 */
export function getTodayStats() {
  const data = DB.get();
  const today = new Date().setHours(0, 0, 0, 0);
  const todayHistory = data.history.filter(h => h.time >= today);
  
  const todayCount = todayHistory.length;
  const todayCorrect = todayHistory.filter(h => h.ok).length;
  const todayAccuracy = todayCount > 0 ? Math.round(todayCorrect / todayCount * 100) : 0;
  
  return {
    count: todayCount,
    correct: todayCorrect,
    accuracy: todayAccuracy
  };
}

/**
 * 工具函数:shuffle
 */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}