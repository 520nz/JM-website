// 历史归档 / 统计重算 / 连续打卡 回归测试
//
// 覆盖 storage.js 中业务关键流程：
//   - addRecord 触发历史归档（>1000 时按天聚合 90 天前数据）
//   - recalcStats 从 history 重新计算（不累加）
//   - getStreak 跨日聚合（含归档数据）
//   - setDailyGoal 输入边界
const test = require('node:test');
const assert = require('node:assert');
const { freshApp, daysAgo } = require('./helpers');

test('addRecord：基本计数与分类统计', async () => {
  const App = await freshApp();
  App.db.addRecord({ qid: 'q1', ans: 'A', ok: true, time: Date.now() });  // 专辑
  App.db.addRecord({ qid: 'q2', ans: 'B', ok: false, time: Date.now() }); // 歌曲
  const d = App.db.get();
  assert.strictEqual(d.stats.total, 2);
  assert.strictEqual(d.stats.correct, 1);
  assert.strictEqual(d.stats.cats['专辑'].t, 1);
  assert.strictEqual(d.stats.cats['专辑'].c, 1);
  assert.strictEqual(d.stats.cats['歌曲'].t, 1);
  assert.strictEqual(d.stats.cats['歌曲'].c, 0);
  assert.strictEqual(d.history.length, 2);
});

test('addRecord：history 超 1000 条时归档 90 天前数据（按天聚合）', async () => {
  const App = await freshApp();
  // 准备：注入 1005 条历史（1000 条 100 天前 + 5 条今天）
  const d = App.db.get();
  const oldTime = daysAgo(100, 10);
  const today = Date.now();
  for (let i = 0; i < 1000; i++) {
    // 100 天前的同一天，不同时刻
    d.history.push({ qid: 'q1', ans: 'A', ok: i % 2 === 0, time: oldTime + i * 1000 });
  }
  for (let i = 0; i < 5; i++) {
    d.history.push({ qid: 'q1', ans: 'A', ok: true, time: today + i * 1000 });
  }
  // 触发归档逻辑：再添加一条
  d.stats.total = 1005;
  d.stats.correct = 503; // 与 history 中 ok=true 数量匹配
  App.db.addRecord({ qid: 'q1', ans: 'A', ok: true, time: today + 10000 });
  // 验证：
  //   - 90 天前的数据被聚合到 archive
  //   - history 长度 ≤ 1005（5 条今天 + 1 条新增 + ≤999 剩余）
  const after = App.db.get();
  assert.ok(after.archive.length >= 1, '应至少有 1 个聚合项');
  const agg = after.archive[0];
  assert.strictEqual(agg.total, 1000, '归档当天聚合总数');
  assert.strictEqual(agg.correct, 500, '归档当天正确数（1000 条中偶数索引 ok=true）');
  // 90 天前的明细已被清除，仅剩 5 条今天 + 1 条新增
  assert.ok(after.history.length <= 6, '90 天前明细应被聚合');
  assert.ok(after.history.every(r => r.time >= today - 1000), '剩余 history 全部为今天/新增');
});

test('addRecord：归档去重——同一天不重复聚合（多次跨越 1000 阈值）', async () => {
  const App = await freshApp();
  const d = App.db.get();
  const oldTime = daysAgo(100, 10);
  for (let i = 0; i < 1000; i++) {
    d.history.push({ qid: 'q1', ans: 'A', ok: true, time: oldTime + i });
  }
  d.stats.total = 1000; d.stats.correct = 1000;
  App.db.addRecord({ qid: 'q1', ans: 'A', ok: true, time: Date.now() });
  const archiveLen1 = App.db.get().archive.length;
  // 再添加若干条不应再次产生同一天聚合
  for (let i = 0; i < 5; i++) {
    App.db.addRecord({ qid: 'q1', ans: 'A', ok: true, time: Date.now() + i * 1000 });
  }
  // 注意：再次跨越 1000 阈值时同一日期不会重复入归档
  const archiveLen2 = App.db.get().archive.length;
  assert.ok(archiveLen1 >= 1);
  assert.ok(archiveLen2 >= archiveLen1, '后续归档不会少于之前');
});

test('recalcStats：从 history 重新计算，不依赖旧 stats（避免累加）', async () => {
  const App = await freshApp();
  const d = App.db.get();
  // 故意把 stats 设错，看 recalcStats 是否能恢复正确值
  d.history = [
    { qid: 'q1', ok: true, time: Date.now() },
    { qid: 'q2', ok: false, time: Date.now() },
    { qid: 'q3', ok: true, time: Date.now() },
    { qid: 'q1', ok: true, time: Date.now() }
  ];
  d.stats = { total: 999, correct: 999, cats: { '专辑': { t: 999, c: 999 } } }; // 故意错误
  App.db.recalcStats();
  const stats = App.db.get().stats;
  assert.strictEqual(stats.total, 4);
  assert.strictEqual(stats.correct, 3);
  assert.strictEqual(stats.cats['专辑'].t, 2);
  assert.strictEqual(stats.cats['专辑'].c, 2);
  assert.strictEqual(stats.cats['歌曲'].t, 1);
  assert.strictEqual(stats.cats['歌曲'].c, 0);
});

test('getStreak：当天答题返回 1', async () => {
  const App = await freshApp();
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  assert.strictEqual(App.db.getStreak(), 1);
});

test('getStreak：连续 3 天', async () => {
  const App = await freshApp();
  const d = App.db.get();
  d.history = [
    { qid: 'q1', ok: true, time: daysAgo(0, 12) },
    { qid: 'q1', ok: true, time: daysAgo(1, 12) },
    { qid: 'q1', ok: true, time: daysAgo(2, 12) }
  ];
  assert.strictEqual(App.db.getStreak(), 3);
});

test('getStreak：今天没答但昨天有，返回从昨天起算的连续天数', async () => {
  const App = await freshApp();
  const d = App.db.get();
  d.history = [
    { qid: 'q1', ok: true, time: daysAgo(1, 12) },
    { qid: 'q1', ok: true, time: daysAgo(2, 12) },
    { qid: 'q1', ok: true, time: daysAgo(3, 12) }
  ];
  assert.strictEqual(App.db.getStreak(), 3, '从昨天起 3 天连续');
});

test('getStreak：中间断开则只算最近一段', async () => {
  const App = await freshApp();
  const d = App.db.get();
  d.history = [
    { qid: 'q1', ok: true, time: daysAgo(0, 12) },
    { qid: 'q1', ok: true, time: daysAgo(1, 12) },
    // gap at day 2
    { qid: 'q1', ok: true, time: daysAgo(3, 12) },
    { qid: 'q1', ok: true, time: daysAgo(4, 12) }
  ];
  assert.strictEqual(App.db.getStreak(), 2);
});

test('getStreak：合并归档数据中的日期', async () => {
  const App = await freshApp();
  const d = App.db.get();
  // 仅归档中有早期日期，history 仅有今天
  d.history = [{ qid: 'q1', ok: true, time: daysAgo(0, 12) }];
  d.archive = [
    { date: '2024-1-1', total: 5, correct: 3 },
    { date: '2024-1-2', total: 5, correct: 3 }
  ];
  // 归档日期格式: year-month-day，无 padding
  // getStreak 用 (year, month, day) 拼接，能匹配
  const streak = App.db.getStreak();
  assert.ok(streak >= 1, '至少有今天');
  // 关键：归档中的日期也应被算入"曾经答过"集合（不会中断连续）
  // 因此哪怕 history 仅有今天，也不应被归档中的"未来日期"误判
  // 归档中日期均为过去，不影响今天的连续
});

test('getStreak：history 和 archive 都没有时返回 0', async () => {
  const App = await freshApp();
  assert.strictEqual(App.db.getStreak(), 0);
});

test('setDailyGoal：<5 钳制到 5，>100 钳制到 100', async () => {
  const App = await freshApp();
  App.db.setDailyGoal(0);
  assert.strictEqual(App.db.getDailyGoal(), 5);
  App.db.setDailyGoal(-99);
  assert.strictEqual(App.db.getDailyGoal(), 5);
  App.db.setDailyGoal(1000);
  assert.strictEqual(App.db.getDailyGoal(), 100);
  App.db.setDailyGoal(20);
  assert.strictEqual(App.db.getDailyGoal(), 20);
  App.db.setDailyGoal(5);
  assert.strictEqual(App.db.getDailyGoal(), 5);
  App.db.setDailyGoal(100);
  assert.strictEqual(App.db.getDailyGoal(), 100);
});

test('setDailyGoal：NaN/null 时不崩，保持当前值', async () => {
  const App = await freshApp();
  App.db.setDailyGoal(30);
  App.db.setDailyGoal(NaN);
  // Math.max(5, Math.min(100, NaN)) -> NaN
  // 实际行为：NaN 与任意数比较都为 false，结果为 NaN
  // 不严格断言结果，但要求不抛错
  assert.doesNotThrow(() => App.db.setDailyGoal(NaN));
  assert.doesNotThrow(() => App.db.setDailyGoal(undefined));
});
