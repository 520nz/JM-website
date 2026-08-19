// 项目源文件加载器 - 支持在 Node.js 中加载浏览器端 JS 代码

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_DIR = path.resolve(__dirname, '..', 'js');
let isFirstFile = true;

// 加载源文件并修正 window.App 引用
function loadSource(fileName) {
  const filePath = path.join(SRC_DIR, fileName);
  let code = fs.readFileSync(filePath, 'utf-8');

  // 第一个文件用 var 声明，后续文件用赋值（避免重复声明）
  if (isFirstFile) {
    code = code.replace(
      /var App = window\.App\s*\|\|\s*\{\};/g,
      'var App = global.App;'
    );
    isFirstFile = false;
  } else {
    code = code.replace(
      /var App = window\.App\s*\|\|\s*\{\};/g,
      'App = global.App;'
    );
  }
  code = code.replace(
    /window\.App/g,
    'global.App'
  );

  try {
    vm.runInThisContext(code, { filename: filePath });
  } catch (err) {
    console.error(`Error loading ${fileName}:`, err.message);
    throw err;
  }
}

// 按依赖顺序加载所有源文件
function loadAll() {
  isFirstFile = true;
  const order = ['data.js', 'storage.js', 'chart.js', 'quiz.js', 'app.js', 'admin.js'];
  order.forEach(f => loadSource(f));
  return global.App;
}

// 重置并重新加载
function reloadAll() {
  // 清理 App 命名空间
  global.App = {};
  global.window.App = global.App;
  return loadAll();
}

module.exports = { loadSource, loadAll, reloadAll };
