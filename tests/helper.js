import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 将指定 JS 文件加载到当前 jsdom 窗口上下文中。
 * 代码使用 IIFE + window.App 命名空间，需确保按依赖顺序加载。
 */
export function loadScript(relativePath) {
  const fullPath = resolve(__dirname, '..', relativePath);
  const code = readFileSync(fullPath, 'utf-8');
  // 使用 window.eval 确保代码在 jsdom 全局上下文中执行
  window.eval(code);
}

/**
 * 加载所有生产代码并按正确顺序初始化 App 命名空间。
 */
export function loadApp() {
  // 先加载数据与工具层
  loadScript('js/data.js');
  loadScript('js/storage.js');
  // 再加载业务层
  loadScript('js/quiz.js');
  loadScript('js/chart.js');
  loadScript('js/admin.js');
  loadScript('js/app.js');
  return window.App;
}

/**
 * 重置 App 内部缓存，避免测试间状态污染。
 */
export function resetAppState() {
  if (window.App && window.App.db) {
    window.App.db.setData(window.App.db.defaults());
  }
  if (window.App && window.App.session) {
    window.App.session.clear();
  }
  if (window.App && window.App.store && window.App.DEFAULT_QUESTION_BANK) {
    window.App.QUESTION_BANK = window.App.DEFAULT_QUESTION_BANK.slice();
  }
  if (window.App && window.App.state) {
    window.App.state.quiz = [];
    window.App.state.idx = 0;
    window.App.state.correctCount = 0;
    window.App.state.answered = false;
    window.App.state.isWrongBookQuiz = false;
  }
}
