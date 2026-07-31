// 成就徽章系统回归测试
//
// 覆盖 storage.js 中 checkAchievements 各种触发条件与解锁幂等性。
const test = require('node:test');
const assert = require('node:assert');
const { freshApp, daysAgo } = require('./helpers');

function unlockIds(arr) { return arr.map(a => a.id).sort(); }

test('first_answer：完成第 1 次答题后解锁', async () => {
  const App = await freshApp();
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  const unlocks = App.db.checkAchievements();
  // 错题本初始为空、total>0 且 first_answer 已被解锁 → wrong_clear 也会一并触发
  assert.ok(unlockIds(unlocks).includes('first_answer'));
  assert.ok(unlockIds(unlocks).includes('wrong_clear'));
  assert.ok(App.db.getAchievements().includes('first_answer'));
});

test('首次 checkAchievements 之后再次调用：幂等不重复解锁', async () => {
  const App = await freshApp();
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  const a1 = App.db.checkAchievements();
  const a2 = App.db.checkAchievements();
  const a3 = App.db.checkAchievements();
  assert.ok(a1.length >= 1);
  assert.strictEqual(a2.length, 0, '已解锁的不应再次返回');
  assert.strictEqual(a3.length, 0);
  assert.ok(App.db.getAchievements().includes('first_answer'));
});

test('total_100：累计 100 题时解锁（一次性跨越阈值）', async () => {
  const App = await freshApp();
  // 直接设 99 题 + 1 次 addRecord 触发
  const d = App.db.get();
  for (let i = 0; i < 99; i++) d.history.push({ qid: 'q1', ok: true, time: Date.now() });
  d.stats.total = 99; d.stats.correct = 99;
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  const unlocks = App.db.checkAchievements();
  assert.ok(unlockIds(unlocks).includes('total_100'));
  assert.ok(unlockIds(unlocks).includes('first_answer'));
});

test('total_500：累计 500 题时解锁', async () => {
  const App = await freshApp();
  const d = App.db.get();
  for (let i = 0; i < 500; i++) d.history.push({ qid: 'q1', ok: true, time: Date.now() });
  d.stats.total = 500; d.stats.correct = 500;
  const unlocks = App.db.checkAchievements();
  assert.ok(unlockIds(unlocks).includes('total_500'));
});

test('acc_90：>=50 题且正确率>=90% 解锁（边界 90%）', async () => {
  const App = await freshApp();
  const d = App.db.get();
  for (let i = 0; i < 50; i++) d.history.push({ qid: 'q1', ok: true, time: Date.now() });
  d.stats.total = 50; d.stats.correct = 45; // 90%
  const unlocks = App.db.checkAchievements();
  assert.ok(unlockIds(unlocks).includes('acc_90'));
});

test('acc_90：正确率 89.99% 不解锁', async () => {
  const App = await freshApp();
  const d = App.db.get();
  for (let i = 0; i < 50; i++) d.history.push({ qid: 'q1', ok: i < 44, time: Date.now() });
  d.stats.total = 50; d.stats.correct = 44; // 88%
  const unlocks = App.db.checkAchievements();
  assert.ok(!unlockIds(unlocks).includes('acc_90'));
});

test('acc_90：49 题且 100% 正确率不应解锁（要求 total >= 50）', async () => {
  const App = await freshApp();
  const d = App.db.get();
  for (let i = 0; i < 49; i++) d.history.push({ qid: 'q1', ok: true, time: Date.now() });
  d.stats.total = 49; d.stats.correct = 49;
  const unlocks = App.db.checkAchievements();
  assert.ok(!unlockIds(unlocks).includes('acc_90'));
});

test('perfect_10：context.quizTotal >= 10 且全部正确时解锁', async () => {
  const App = await freshApp();
  const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
  assert.ok(unlockIds(unlocks).includes('perfect_10'));
});

test('perfect_10：10 题对 9 题不应解锁', async () => {
  const App = await freshApp();
  const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 9 });
  assert.ok(!unlockIds(unlocks).includes('perfect_10'));
});

test('perfect_10：9 题全对不满足 >=10，不解锁', async () => {
  const App = await freshApp();
  const unlocks = App.db.checkAchievements({ quizTotal: 9, quizCorrect: 9 });
  assert.ok(!unlockIds(unlocks).includes('perfect_10'));
});

test('daily_50：单日答题 50 题时解锁', async () => {
  const App = await freshApp();
  const d = App.db.get();
  const startToday = new Date().setHours(0, 0, 0, 0);
  for (let i = 0; i < 50; i++) {
    d.history.push({ qid: 'q1', ok: true, time: startToday + i * 1000 });
  }
  d.stats.total = 50; d.stats.correct = 50;
  const unlocks = App.db.checkAchievements();
  assert.ok(unlockIds(unlocks).includes('daily_50'));
});

test('daily_50：49 题今天不满足 50', async () => {
  const App = await freshApp();
  const d = App.db.get();
  const startToday = new Date().setHours(0, 0, 0, 0);
  for (let i = 0; i < 49; i++) d.history.push({ qid: 'q1', ok: true, time: startToday + i * 1000 });
  d.stats.total = 49; d.stats.correct = 49;
  const unlocks = App.db.checkAchievements();
  assert.ok(!unlockIds(unlocks).includes('daily_50'));
});

test('streak_3 / streak_7：连续天数阈值', async () => {
  const App = await freshApp();
  const d = App.db.get();
  for (let i = 0; i < 3; i++) d.history.push({ qid: 'q1', ok: true, time: daysAgo(i, 12) });
  d.stats.total = 3; d.stats.correct = 3;
  let unlocks = App.db.checkAchievements();
  assert.ok(unlockIds(unlocks).includes('streak_3'));
  assert.ok(!unlockIds(unlocks).includes('streak_7'));
  // 7 天
  for (let i = 3; i < 7; i++) d.history.push({ qid: 'q1', ok: true, time: daysAgo(i, 12) });
  unlocks = App.db.checkAchievements();
  assert.ok(unlockIds(unlocks).includes('streak_7'));
});

test('wrong_clear：错题本清空且曾经答过题时解锁（依赖 first_answer）', async () => {
  const App = await freshApp();
  // 制造一道错题再移除
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  App.db.addWrong('q1');
  assert.strictEqual(App.db.getWrong().length, 1);
  App.db.removeWrong('q1');
  assert.strictEqual(App.db.getWrong().length, 0);
  const unlocks = App.db.checkAchievements();
  assert.ok(unlockIds(unlocks).includes('wrong_clear'));
});

test('wrong_clear：错题本始终为空但没答过题（first_answer 未解锁）不触发', async () => {
  const App = await freshApp();
  const unlocks = App.db.checkAchievements();
  assert.ok(!unlockIds(unlocks).includes('wrong_clear'));
  assert.deepStrictEqual(App.db.getWrong(), []);
});

test('all_cats：所有四个分类都有答题记录时解锁', async () => {
  const App = await freshApp();
  const d = App.db.get();
  d.stats.cats = {
    '专辑': { t: 1, c: 1 },
    '歌曲': { t: 1, c: 1 },
    '个人信息': { t: 1, c: 1 },
    '获奖记录': { t: 1, c: 1 }
  };
  const unlocks = App.db.checkAchievements();
  assert.ok(unlockIds(unlocks).includes('all_cats'));
});

test('all_cats：缺少一个分类不触发', async () => {
  const App = await freshApp();
  const d = App.db.get();
  d.stats.cats = {
    '专辑': { t: 1, c: 1 },
    '歌曲': { t: 1, c: 1 },
    '个人信息': { t: 1, c: 1 }
    // 缺少"获奖记录"
  };
  const unlocks = App.db.checkAchievements();
  assert.ok(!unlockIds(unlocks).includes('all_cats'));
});

test('all_cats：分类有定义但 t=0 不算"答题过"', async () => {
  const App = await freshApp();
  const d = App.db.get();
  d.stats.cats = {
    '专辑': { t: 0, c: 0 },
    '歌曲': { t: 1, c: 1 },
    '个人信息': { t: 1, c: 1 },
    '获奖记录': { t: 1, c: 1 }
  };
  const unlocks = App.db.checkAchievements();
  assert.ok(!unlockIds(unlocks).includes('all_cats'));
});

test('getAchievementDefs 包含全部 10 个徽章', async () => {
  const App = await freshApp();
  const defs = App.db.getAchievementDefs();
  assert.strictEqual(defs.length, 10);
  const ids = defs.map(d => d.id).sort();
  assert.deepStrictEqual(ids, [
    'acc_90', 'all_cats', 'daily_50', 'first_answer', 'perfect_10',
    'streak_3', 'streak_7', 'total_100', 'total_500', 'wrong_clear'
  ]);
});

test('复杂场景：同时触发多个成就且只触发一次', async () => {
  const App = await freshApp();
  const d = App.db.get();
  // 准备：100 题全对 + 7 天连续 + 完美一轮 + 4 分类 + 50 题今天 + 错题清空
  const startToday = new Date().setHours(0, 0, 0, 0);
  for (let i = 0; i < 50; i++) d.history.push({ qid: 'q1', ok: true, time: startToday + i * 1000 });
  for (let i = 1; i < 50; i++) d.history.push({ qid: 'q1', ok: true, time: daysAgo(i > 6 ? 6 : i, 12) });
  d.stats.total = 100; d.stats.correct = 100;
  d.stats.cats = { '专辑': {t:25,c:25}, '歌曲': {t:25,c:25}, '个人信息': {t:25,c:25}, '获奖记录': {t:25,c:25} };
  App.db.addWrong('q1');
  App.db.removeWrong('q1');
  const unlocks = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
  const got = new Set(unlockIds(unlocks));
  // 期望解锁：first_answer, total_100, acc_90, perfect_10, daily_50, streak_3, streak_7, wrong_clear, all_cats
  // 不期望：total_500
  ['first_answer', 'total_100', 'acc_90', 'perfect_10', 'daily_50', 'streak_3', 'streak_7', 'wrong_clear', 'all_cats']
    .forEach(id => assert.ok(got.has(id), `应解锁 ${id}`));
  assert.ok(!got.has('total_500'), '不应触发 total_500');
});
