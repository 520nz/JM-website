/**
 * 测试辅助模块
 * 用于在 Node.js 环境中加载浏览器端的全局变量
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 模拟浏览器全局对象
function createBrowserContext() {
  const context = {
    window: {},
    document: {
      createElement: (tagName) => {
        const element = {
          tagName: tagName.toUpperCase(),
          textContent: '',
          innerHTML: '',
          classList: {
            classes: new Set(),
            add: function(cls) { this.classes.add(cls); },
            remove: function(cls) { this.classes.delete(cls); },
            contains: function(cls) { return this.classes.has(cls); }
          },
          querySelectorAll: () => [],
          querySelector: () => null,
          getElementById: () => null,
          addEventListener: () => {}
        };
        return element;
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      addEventListener: () => {}
    },
    localStorage: global.localStorage,
    sessionStorage: global.sessionStorage,
    console: console,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    clearTimeout: clearTimeout,
    Date: Date,
    Math: Math,
    JSON: JSON,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Error: Error,
    alert: (msg) => { console.log('[alert]', msg); }
  };
  
  // 设置 window 的自引用
  context.window = context;
  
  return context;
}

// 在上下文中执行 JavaScript 文件
function loadJSFile(filePath, context) {
  const code = fs.readFileSync(filePath, 'utf8');
  
  // 使用 vm 模块在上下文中执行代码
  vm.runInNewContext(code, context, {
    filename: path.basename(filePath),
    displayErrors: true
  });
  
  return context;
}

// 加载所有必要的全局变量（使用最小模拟数据）
function loadGlobals() {
  const context = createBrowserContext();
  
  // 加载 storage.js（它定义了 esc, SR_INTERVALS, DB, Session, QuestionStore）
  loadJSFile(path.join(__dirname, '../js/storage.js'), context);
  
  // 不加载完整的 data.js（78道题），而是使用最小模拟数据
  // 这样可以避免全局状态污染
  context.QUESTION_BANK = [
    { id: '001', category: '专辑', question: '测试题目1', answer: 'A', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }] },
    { id: '002', category: '歌曲', question: '测试题目2', answer: 'B', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }] }
  ];
  context.DEFAULT_QUESTION_BANK = context.QUESTION_BANK.slice();
  
  // 将上下文中的变量复制到 global
  const exportKeys = [
    'QUESTION_BANK', 'DEFAULT_QUESTION_BANK', 
    'esc', 'SR_INTERVALS', 'DB', 'Session', 'QuestionStore'
  ];
  
  exportKeys.forEach(key => {
    if (context[key] !== undefined) {
      global[key] = context[key];
    }
  });
  
  return context;
}

module.exports = {
  createBrowserContext,
  loadJSFile,
  loadGlobals
};