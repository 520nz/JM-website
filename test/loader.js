import fs from 'fs';
import path from 'path';

/**
 * 加载并执行 JS 源文件，使其在 window.App 上暴露 API
 * @param {string} relPath - 相对项目根的路径
 */
export function loadSource(relPath) {
  const filePath = path.resolve(process.cwd(), relPath);
  const code = fs.readFileSync(filePath, 'utf-8');
  // 直接 eval 代码（jsdom 环境中 window 和 document 均可用）
  eval(code);
}

/**
 * 加载题库数据
 */
export function loadData() {
  loadSource('js/data.js');
}

/**
 * 加载 storage 模块（需先加载 data 以提供题库）
 */
export function loadStorage() {
  loadSource('js/storage.js');
}

/**
 * 加载 quiz 模块（需先加载 data 和 storage）
 */
export function loadQuiz() {
  loadSource('js/quiz.js');
}

/**
 * 加载 admin 模块（需先加载 data 和 storage）
 */
export function loadAdmin() {
  loadSource('js/admin.js');
}

/**
 * 加载 chart 模块
 */
export function loadChart() {
  loadSource('js/chart.js');
}
