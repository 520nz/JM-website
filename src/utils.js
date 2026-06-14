/**
 * 工具函数模块
 */

/**
 * 数组随机打乱（Fisher-Yates算法）
 * @param {Array} arr - 要打乱的数组
 * @returns {Array} 打乱后的新数组
 */
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

/**
 * 格式化时间（毫秒转 分'秒"）
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化的时间字符串
 */
function fmtTime(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + '分' + s + '秒';
}

/**
 * 解析选项文本
 * @param {string} optsText - 选项文本（每行一个，格式：A.选项内容）
 * @returns {Array} 选项数组 [{key, text}, ...]
 */
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

/**
 * 验证题目数据格式
 * @param {Object} q - 题目对象
 * @returns {Object} {valid, errors}
 */
function validateQuestion(q) {
  const errors = [];
  
  if (!q.id || typeof q.id !== 'string') {
    errors.push('题目ID必须是非空字符串');
  }
  
  if (!q.category || typeof q.category !== 'string') {
    errors.push('分类必须是非空字符串');
  }
  
  if (!q.question || typeof q.question !== 'string') {
    errors.push('题目内容必须是非空字符串');
  }
  
  if (!Array.isArray(q.options) || q.options.length < 2) {
    errors.push('选项必须是至少包含2个元素的数组');
  } else {
    const keys = q.options.map(o => o.key);
    const validKeys = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < keys.length; i++) {
      if (!validKeys.includes(keys[i])) {
        errors.push('选项key必须是A/B/C/D之一');
        break;
      }
    }
  }
  
  if (!q.answer || !['A', 'B', 'C', 'D'].includes(q.answer)) {
    errors.push('答案必须是A/B/C/D之一');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * 获取模式对应的题目数量
 * @param {string} mode - 模式名称
 * @returns {number} 题目数量
 */
function getCountByMode(mode) {
  const modeMap = {
    quick: 10,
    standard: 20,
    intensive: 30
  };
  return modeMap[mode] || 10;
}

/**
 * 计算正确率
 * @param {number} correct - 正确数
 * @param {number} total - 总数
 * @returns {number} 正确率百分比
 */
function calculateAccuracy(correct, total) {
  if (total <= 0 || correct < 0) return 0;
  if (correct > total) return 100;
  return Math.round(correct / total * 100);
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    shuffle,
    fmtTime,
    parseOptions,
    validateQuestion,
    getCountByMode,
    calculateAccuracy
  };
}
