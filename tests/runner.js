// ============================================================
// runner.js - 简易测试运行器
// 收集所有 *.test.js 导出的函数并逐一执行，报告通过/失败
// 用法：node tests/runner.js
// ============================================================
const path = require('path');
const fs = require('fs');

const testDir = __dirname;
const testFiles = fs.readdirSync(testDir)
  .filter(f => f.endsWith('.test.js'))
  .sort();

const allSuites = {};
for (const f of testFiles) {
  const modName = f.replace(/\.test\.js$/, '');
  const mod = require(path.join(testDir, f));
  allSuites[modName] = mod;
}

let total = 0, passed = 0, failed = 0;
const failures = [];

for (const [suiteName, tests] of Object.entries(allSuites)) {
  const testNames = Object.keys(tests).filter(k => typeof tests[k] === 'function');
  if (testNames.length === 0) continue;
  console.log('\n\x1b[1m▶ ' + suiteName + '\x1b[0m (' + testNames.length + ')');
  for (const name of testNames) {
    total++;
    try {
      tests[name]();
      passed++;
      console.log('  \x1b[32m✓\x1b[0m ' + name);
    } catch (err) {
      failed++;
      failures.push({ suite: suiteName, name, err });
      console.log('  \x1b[31m✗\x1b[0m ' + name);
      const msg = (err && err.message) ? err.message : String(err);
      console.log('      \x1b[31m' + msg.split('\n')[0] + '\x1b[0m');
    }
  }
}

console.log('\n————————————————————————');
console.log(
  '总计 ' + total +
  '  通过 \x1b[32m' + passed + '\x1b[0m' +
  '  失败 \x1b[31m' + failed + '\x1b[0m'
);

if (failures.length > 0) {
  console.log('\n\x1b[1m失败详情\x1b[0m:');
  for (const f of failures) {
    console.log('\n  [' + f.suite + '] ' + f.name);
    if (f.err && f.err.stack) {
      // 只输出前 10 行堆栈，避免刷屏
      const lines = f.err.stack.split('\n').slice(0, 10);
      console.log('    ' + lines.join('\n    '));
    } else {
      console.log('    ' + String(f.err));
    }
  }
  process.exit(1);
} else {
  console.log('\n\x1b[32m所有测试通过 ✓\x1b[0m');
  process.exit(0);
}
