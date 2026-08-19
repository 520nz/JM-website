// 测试运行器入口
const path = require('path');
const fs = require('fs');

// 加载 mock 环境（必须第一个加载）
require('./mock');

console.log('='.repeat(60));
console.log('🧪 JJ 答题网站 - 自动化测试套件');
console.log('='.repeat(60));

// 加载源文件
try {
  require('./setup').loadAll();
  console.log('✅ 源文件加载成功\n');
} catch (err) {
  console.error('❌ 源文件加载失败:', err.message);
  process.exit(1);
}

// 加载所有测试文件
const testFiles = [
  'test_storage.js',
  'test_quiz.js',
  'test_admin.js',
  'test_app.js'
];

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
const allErrors = [];

// 捕获测试结果
const runner = require('./runner');

testFiles.forEach(file => {
  console.log(`\n📄 Running ${file}...`);
  try {
    // 重置 App 状态
    const App = global.App;
    App.db.setData({
      history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark', dailyGoal: 20, achievements: [], archive: []
    });

    const moduleStart = runner.results.passed + runner.results.failed;
    require('./' + file);
    const moduleEnd = runner.results.passed + runner.results.failed;
    const moduleTotal = moduleEnd - moduleStart;

    console.log(`  📊 ${file}: ${moduleTotal} 测试`);
  } catch (err) {
    console.error(`  ❌ ${file} 加载错误:`, err.message);
  }
});

console.log('\n' + '='.repeat(60));
console.log('📊 最终测试结果');
console.log('='.repeat(60));

const success = runner.summary();

process.exit(success ? 0 : 1);
