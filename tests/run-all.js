/**
 * tests/run-all.js
 * 统一运行所有测试套件（零依赖，Node 原生）。
 *
 * 使用方法：
 *   cd /workspace && node tests/run-all.js
 *
 * 退出码：0 全部通过，1 存在失败
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const FILES = [
  '01-storage-core.test.js',
  '02-streak-achievements.test.js',
  '03-quiz-utils.test.js',
  '04-admin-parse.test.js',
];

const NODE = process.execPath;
const TEST_DIR = __dirname;

console.log('='.repeat(60));
console.log('  自动化回归测试 · 林俊杰粉丝答题网站');
console.log('  Node:', process.version);
console.log('  套件数:', FILES.length);
console.log('='.repeat(60));

let passFiles = 0, failFiles = 0;
const details = [];
for (const f of FILES) {
  const full = path.join(TEST_DIR, f);
  process.stdout.write('\n\x1b[1m▶ 运行 ' + f + '\x1b[0m\n');
  const r = spawnSync(NODE, [full], { stdio: ['inherit', 'inherit', 'inherit'] });
  const ok = r.status === 0;
  details.push({ file: f, exitCode: r.status });
  if (ok) passFiles++; else failFiles++;
}

console.log('\n' + '='.repeat(60));
console.log('  总 结');
console.log('='.repeat(60));
for (const d of details) {
  const mark = d.exitCode === 0 ? '\x1b[32mPASS\x1b[0m' : `\x1b[31mFAIL(exit=${d.exitCode})\x1b[0m`;
  console.log('  ' + mark.padEnd(28, ' ') + '  ' + d.file);
}
console.log('  ' + '-'.repeat(56));
console.log(`  通过: ${passFiles}   失败: ${failFiles}   共: ${FILES.length} 套件`);
console.log('='.repeat(60));

process.exit(failFiles === 0 ? 0 : 1);
