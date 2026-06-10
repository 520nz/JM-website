/**
 * 存储管理模块
 * 使用LocalStorage进行数据持久化
 */

const DB_KEY = 'jj_quiz_v2';
const QUESTION_BANK_KEY = 'jj_question_bank';

/**
 * 获取默认数据结构
 */
function getDefaultData() {
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

/**
 * 获取用户数据
 */
function getUserData() {
  const data = localStorage.getItem(DB_KEY);
  if (!data) return getDefaultData();
  try {
    return JSON.parse(data);
  } catch (e) {
    return getDefaultData();
  }
}

/**
 * 保存用户数据
 */
function saveUserData(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

/**
 * 添加答题记录
 */
function addRecord(record, questionBank) {
  const data = getUserData();
  data.history.push(record);
  data.stats.total++;
  
  if (record.ok) {
    data.stats.correct++;
  }
  
  // 查找题目分类
  const q = findQuestionInBank(record.qid, questionBank);
  if (q) {
    if (!data.stats.cats[q.category]) {
      data.stats.cats[q.category] = { t: 0, c: 0 };
    }
    data.stats.cats[q.category].t++;
    if (record.ok) {
      data.stats.cats[q.category].c++;
    }
  }
  
  saveUserData(data);
}

/**
 * 添加错题记录
 */
function addWrong(qid) {
  const data = getUserData();
  
  // 查找是否已存在
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
    data.wrong.push({
      qid: qid,
      cnt: 1,
      time: Date.now()
    });
  }
  
  saveUserData(data);
}

/**
 * 移除错题记录
 */
function removeWrong(qid) {
  const data = getUserData();
  data.wrong = data.wrong.filter(w => w.qid !== qid);
  saveUserData(data);
}

/**
 * 获取错题列表
 */
function getWrongList() {
  return getUserData().wrong;
}

/**
 * 在题库中查找题目
 */
function findQuestionInBank(qid, questionBank) {
  for (let i = 0; i < questionBank.length; i++) {
    if (questionBank[i].id === qid) {
      return questionBank[i];
    }
  }
  return null;
}

/**
 * 保存题库到localStorage
 */
function saveQuestionBankToStorage(bank) {
  localStorage.setItem(QUESTION_BANK_KEY, JSON.stringify(bank));
}

/**
 * 从localStorage加载题库
 */
function loadQuestionBankFromStorage() {
  const saved = localStorage.getItem(QUESTION_BANK_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * 清除题库存储
 */
function clearQuestionBankStorage() {
  localStorage.removeItem(QUESTION_BANK_KEY);
}

/**
 * 获取今日答题记录
 */
function getTodayHistory() {
  const data = getUserData();
  const today = new Date().setHours(0, 0, 0, 0);
  return data.history.filter(h => h.time >= today);
}

/**
 * 计算今日统计
 */
function getTodayStats() {
  const todayHistory = getTodayHistory();
  const count = todayHistory.length;
  const correctCount = todayHistory.filter(h => h.ok).length;
  const accuracy = count > 0 ? Math.round(correctCount / count * 100) : 0;
  
  return {
    count,
    correctCount,
    accuracy
  };
}

/**
 * 获取总体统计
 */
function getTotalStats() {
  const data = getUserData();
  const total = data.stats.total;
  const correct = data.stats.correct;
  const accuracy = total > 0 ? Math.round(correct / total * 100) : 0;
  
  return {
    total,
    correct,
    wrong: data.wrong.length,
    accuracy
  };
}

/**
 * 获取分类统计
 */
function getCategoryStats() {
  const data = getUserData();
  return data.stats.cats;
}

module.exports = {
  DB_KEY,
  QUESTION_BANK_KEY,
  getDefaultData,
  getUserData,
  saveUserData,
  addRecord,
  addWrong,
  removeWrong,
  getWrongList,
  findQuestionInBank,
  saveQuestionBankToStorage,
  loadQuestionBankFromStorage,
  clearQuestionBankStorage,
  getTodayHistory,
  getTodayStats,
  getTotalStats,
  getCategoryStats
};