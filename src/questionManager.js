// 题目管理模块

/**
 * 解析选项文本
 * @param {string} optsText - 选项文本，格式如 "A.选项1\nB.选项2"
 * @returns {Array} 选项数组
 */
function parseOptions(optsText) {
  var lines = optsText.split('\n');
  var options = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
    if (match) {
      options.push({ key: match[1], text: match[2] });
    }
  }
  return options;
}

/**
 * 从分类筛选题目
 * @param {Array} questions - 题目数组
 * @param {string} category - 分类名称
 * @returns {Array} 筛选后的题目
 */
function filterByCategory(questions, category) {
  if (!category) return questions;
  return questions.filter(function(q) { return q.category === category; });
}

/**
 * 搜索题目
 * @param {Array} questions - 题目数组
 * @param {string} search - 搜索关键词
 * @returns {Array} 筛选后的题目
 */
function searchQuestions(questions, search) {
  if (!search) return questions;
  var searchLower = search.toLowerCase();
  return questions.filter(function(q) {
    return q.question.toLowerCase().indexOf(searchLower) !== -1;
  });
}

/**
 * 获取所有分类
 * @param {Array} questions - 题目数组
 * @returns {Array} 分类名称数组，已排序
 */
function getCategories(questions) {
  var cats = {};
  for (var i = 0; i < questions.length; i++) {
    cats[questions[i].category] = true;
  }
  return Object.keys(cats).sort();
}

module.exports = {
  parseOptions,
  filterByCategory,
  searchQuestions,
  getCategories
};
