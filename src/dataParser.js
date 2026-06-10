/**
 * 数据解析模块
 * 包含选项解析、数据导入验证等核心逻辑
 */

/**
 * 解析选项文本
 * 支持格式：A.选项内容、A、选项内容、A．选项内容（全角点）
 * @param {string} optsText - 选项文本，每行一个选项
 * @returns {Array} 解析后的选项数组 [{key: 'A', text: '选项内容'}]
 */
function parseOptions(optsText) {
  if (!optsText || typeof optsText !== 'string') {
    return [];
  }
  
  const lines = optsText.split('\n');
  const options = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 支持多种格式：A.、A、、A．（全角）
    const match = line.match(/^([A-D])[.、．]\s*(.+)$/);
    if (match) {
      options.push({
        key: match[1],
        text: match[2]
      });
    }
  }
  
  return options;
}

/**
 * 验证选项格式
 * @param {string} optsText - 选项文本
 * @returns {Object} {valid: boolean, error: string, options: Array}
 */
function validateOptions(optsText) {
  if (!optsText || !optsText.trim()) {
    return {
      valid: false,
      error: '请填写题目和选项',
      options: []
    };
  }
  
  const options = parseOptions(optsText);
  
  if (options.length < 2) {
    return {
      valid: false,
      error: '请至少输入两个选项，格式：A.选项内容',
      options: []
    };
  }
  
  // 检查是否有重复的key
  const keys = options.map(o => o.key);
  const uniqueKeys = [...new Set(keys)];
  if (keys.length !== uniqueKeys.length) {
    return {
      valid: false,
      error: '选项编号不能重复',
      options: []
    };
  }
  
  return {
    valid: true,
    error: null,
    options: options
  };
}

/**
 * 验证题目数据结构
 * @param {Object} question - 题目对象
 * @returns {Object} {valid: boolean, error: string}
 */
function validateQuestion(question) {
  if (!question || typeof question !== 'object') {
    return { valid: false, error: '题目数据无效' };
  }
  
  // 必需字段
  const requiredFields = ['id', 'category', 'question', 'options', 'answer'];
  for (const field of requiredFields) {
    if (!question[field]) {
      return { valid: false, error: `缺少必需字段: ${field}` };
    }
  }
  
  // 验证选项
  if (!Array.isArray(question.options) || question.options.length < 2) {
    return { valid: false, error: '选项必须是至少2个元素的数组' };
  }
  
  // 验证选项格式
  for (const opt of question.options) {
    if (!opt.key || !opt.text) {
      return { valid: false, error: '选项格式无效，需要key和text字段' };
    }
    if (!['A', 'B', 'C', 'D'].includes(opt.key)) {
      return { valid: false, error: '选项key必须是A、B、C或D' };
    }
  }
  
  // 验证答案
  if (!['A', 'B', 'C', 'D'].includes(question.answer)) {
    return { valid: false, error: '答案必须是A、B、C或D' };
  }
  
  // 验证答案是否在选项中
  const answerInOptions = question.options.some(opt => opt.key === question.answer);
  if (!answerInOptions) {
    return { valid: false, error: '答案必须在选项中存在' };
  }
  
  return { valid: true, error: null };
}

/**
 * 解析导入的JSON数据
 * @param {string} jsonText - JSON文本
 * @returns {Object} {success: boolean, data: Object, error: string}
 */
function parseImportData(jsonText) {
  if (!jsonText || typeof jsonText !== 'string') {
    return {
      success: false,
      data: null,
      error: '导入失败：文件内容为空'
    };
  }
  
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    return {
      success: false,
      data: null,
      error: '导入失败：文件格式不正确，请确保上传有效的JSON文件'
    };
  }
  
  // 验证数据结构
  if (!data.questionBank && !data.userData) {
    return {
      success: false,
      data: null,
      error: '导入失败：文件中未找到有效数据（questionBank 或 userData）'
    };
  }
  
  // 验证题库数据
  if (data.questionBank) {
    if (!Array.isArray(data.questionBank)) {
      return {
        success: false,
        data: null,
        error: '题库数据必须是数组格式'
      };
    }
    
    // 验证每道题目
    for (const q of data.questionBank) {
      const validation = validateQuestion(q);
      if (!validation.valid) {
        return {
          success: false,
          data: null,
          error: `题库验证失败: ${validation.error}`
        };
      }
    }
  }
  
  // 验证用户数据
  if (data.userData) {
    if (typeof data.userData !== 'object') {
      return {
        success: false,
        data: null,
        error: '用户数据必须是对象格式'
      };
    }
  }
  
  return {
    success: true,
    data: data,
    error: null
  };
}

/**
 * 合并题库数据
 * @param {Array} existingBank - 现有题库
 * @param {Array} newBank - 新导入的题库
 * @returns {Object} {bank: Array, addedCount: number, updatedCount: number}
 */
function mergeQuestionBank(existingBank, newBank) {
  const existingIds = {};
  for (let i = 0; i < existingBank.length; i++) {
    existingIds[existingBank[i].id] = true;
  }
  
  let addedCount = 0;
  let updatedCount = 0;
  const mergedBank = existingBank.slice();
  
  for (let j = 0; j < newBank.length; j++) {
    const q = newBank[j];
    if (existingIds[q.id]) {
      // 更新现有题目
      for (let k = 0; k < mergedBank.length; k++) {
        if (mergedBank[k].id === q.id) {
          mergedBank[k] = q;
          updatedCount++;
          break;
        }
      }
    } else {
      // 新增题目
      mergedBank.push(q);
      addedCount++;
    }
  }
  
  return {
    bank: mergedBank,
    addedCount,
    updatedCount
  };
}

/**
 * 合并用户数据
 * @param {Object} existingData - 现有用户数据
 * @param {Object} newData - 新导入的用户数据
 * @returns {Object} 合并后的用户数据
 */
function mergeUserData(existingData, newData) {
  const merged = existingData;
  
  // 合并历史记录
  if (newData.history) {
    merged.history = merged.history.concat(newData.history);
  }
  
  // 合并错题记录
  if (newData.wrong) {
    const wrongMap = {};
    for (let w = 0; w < merged.wrong.length; w++) {
      wrongMap[merged.wrong[w].qid] = merged.wrong[w];
    }
    
    for (let x = 0; x < newData.wrong.length; x++) {
      const wrongItem = newData.wrong[x];
      if (wrongMap[wrongItem.qid]) {
        wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
      } else {
        merged.wrong.push(wrongItem);
      }
    }
  }
  
  // 合并统计数据
  if (newData.stats) {
    if (!merged.stats) merged.stats = { total: 0, correct: 0, cats: {} };
    merged.stats.total += newData.stats.total || 0;
    merged.stats.correct += newData.stats.correct || 0;
    
    if (newData.stats.cats) {
      for (const catName in newData.stats.cats) {
        if (!merged.stats.cats[catName]) {
          merged.stats.cats[catName] = { t: 0, c: 0 };
        }
        merged.stats.cats[catName].t += newData.stats.cats[catName].t || 0;
        merged.stats.cats[catName].c += newData.stats.cats[catName].c || 0;
      }
    }
  }
  
  return merged;
}

/**
 * 生成导出数据
 * @param {Array} questionBank - 题库
 * @param {Object} userData - 用户数据
 * @returns {Object} 导出数据对象
 */
function generateExportData(questionBank, userData) {
  return {
    questionBank: questionBank,
    userData: userData,
    exportTime: new Date().toISOString()
  };
}

/**
 * 验证重置确认输入
 * @param {string} input - 用户输入
 * @returns {boolean} 是否有效
 */
function validateResetInput(input) {
  return input === '恢复默认';
}

module.exports = {
  parseOptions,
  validateOptions,
  validateQuestion,
  parseImportData,
  mergeQuestionBank,
  mergeUserData,
  generateExportData,
  validateResetInput
};