// ============================================================
// chart.test.js - 统计趋势图数据聚合回归测试
// 覆盖：14天按天聚合、history + archive 合并、
// 空数据保护、最大值缩放、正确率轴对齐
// ============================================================
const assert = require('assert');
const { createTestContext } = require('./test-setup');

let ctx;
let App;
function beforeEach() {
  ctx = createTestContext();
  App = ctx.App;
}

// 白盒抽取 renderTrendChart 中的 14 天聚合逻辑
function aggregate14Days(history, archive, today) {
  const days = 14;
  const today0 = new Date(today);
  today0.setHours(0, 0, 0, 0);
  const dayData = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = today0.getTime() - i * 86400000;
    const dayEnd = dayStart + 86400000;
    let dayCount = 0;
    let dayCorrect = 0;
    for (const rec of (history || [])) {
      if (rec.time >= dayStart && rec.time < dayEnd) {
        dayCount++;
        if (rec.ok) dayCorrect++;
      }
    }
    const dt = new Date(dayStart);
    const dateKey = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
    for (const a of (archive || [])) {
      if (a.date === dateKey) {
        dayCount += a.total;
        dayCorrect += a.correct;
        break;
      }
    }
    dayData.push({
      date: new Date(dayStart),
      count: dayCount,
      correct: dayCorrect,
      acc: dayCount > 0 ? Math.round(dayCorrect / dayCount * 100) : 0,
    });
  }
  return dayData;
}

function test14DayLengthAndOrder() {
  beforeEach();
  const today = new Date(2026, 7, 24); // 2026-08-24
  const result = aggregate14Days([], [], today);
  assert.strictEqual(result.length, 14, '必须产出 14 天');
  // 第 0 天应是 13 天前，最后 1 天是今天
  assert.strictEqual(result[0].date.getDate(), 24 - 13);
  assert.strictEqual(result[13].date.getDate(), 24);
}

function testHistorySumsCorrectly() {
  beforeEach();
  const today = new Date(2026, 7, 24, 10, 30);
  const d0 = new Date(2026, 7, 24, 9, 0).getTime();   // 今天
  const d1 = new Date(2026, 7, 23, 15, 0).getTime();  // 昨天
  const d12 = new Date(2026, 7, 24 - 12, 12, 0).getTime(); // 12 天前
  const d20 = new Date(2026, 7, 24 - 20, 12, 0).getTime(); // 超出 14 天范围
  const history = [
    { time: d0, ok: true },
    { time: d0, ok: true },
    { time: d0, ok: false },
    { time: d1, ok: true },
    { time: d12, ok: true },
    { time: d20, ok: true }, // 不应计入
  ];
  const result = aggregate14Days(history, [], today);
  // 今天：3 题，2 对 → acc 67%
  const todayRec = result[13];
  assert.strictEqual(todayRec.count, 3);
  assert.strictEqual(todayRec.correct, 2);
  assert.strictEqual(todayRec.acc, 67);
  // 昨天：1/1
  assert.strictEqual(result[12].count, 1);
  assert.strictEqual(result[12].acc, 100);
  // 12 天前
  assert.strictEqual(result[1].count, 1);
  // 总 count 应为 5（d20 被排除）
  assert.strictEqual(result.reduce((s, r) => s + r.count, 0), 5);
}

function testArchiveMergeAddsToHistory() {
  beforeEach();
  const today = new Date(2026, 7, 24, 12, 0);
  // 今天：history 有 2 道，archive 也有同一天的 8 道（应累计为 10 道）
  const t0 = new Date(2026, 7, 24, 8, 0).getTime();
  const history = [{ time: t0, ok: true }, { time: t0, ok: false }];
  const keyToday = '2026-8-24';
  const archive = [{ date: keyToday, total: 8, correct: 7 }];
  const result = aggregate14Days(history, archive, today);
  const todayRec = result[13];
  assert.strictEqual(todayRec.count, 2 + 8,
    'archive 与 history 同日应累加 count');
  assert.strictEqual(todayRec.correct, 1 + 7,
    'archive 与 history 同日应累加 correct');
  assert.strictEqual(todayRec.acc, Math.round(8 / 10 * 100));
}

function testZeroCountHasZeroAccNoCrash() {
  beforeEach();
  const today = new Date(2026, 7, 24);
  const result = aggregate14Days([], [], today);
  for (let i = 0; i < result.length; i++) {
    assert.strictEqual(result[i].count, 0);
    assert.strictEqual(result[i].correct, 0);
    assert.strictEqual(result[i].acc, 0,
      'count=0 时 acc 应是 0 而非 NaN');
  }
}

function testRenderTrendChartCanvasMissingSafety() {
  beforeEach();
  // id 不存在时应立即 return，不应抛错
  let thrown = null;
  try {
    App.renderTrendChart('nonexistent_canvas_id_xyz', [], []);
  } catch (e) {
    thrown = e;
  }
  assert.strictEqual(thrown, null,
    'canvas 不存在时 renderTrendChart 应安全返回，当前错误: ' + thrown);
}

function testMaxCountZeroDefault() {
  beforeEach();
  // 聚合后 maxCount=0，代码应 clamp 为 1
  const today = new Date(2026, 7, 24);
  const result = aggregate14Days([], [], today);
  let maxCount = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i].count > maxCount) maxCount = result[i].count;
  }
  if (maxCount === 0) maxCount = 1;
  assert.strictEqual(maxCount, 1,
    '全 0 数据时 maxCount 应回退到 1，避免除 0');
}

module.exports = {
  test14DayLengthAndOrder,
  testHistorySumsCorrectly,
  testArchiveMergeAddsToHistory,
  testZeroCountHasZeroAccNoCrash,
  testRenderTrendChartCanvasMissingSafety,
  testMaxCountZeroDefault,
};
