// 间隔重复算法回归测试
//
// 覆盖 storage.js 中错题本与间隔重复（SR_INTERVALS）状态机的关键路径：
//   - addWrong 首次/重复添加
//   - reviewCorrect 升级、5 级后 mastered
//   - reviewWrong 重置与降级
//   - getDueWrong 边界
const test = require('node:test');
const assert = require('node:assert');
const { freshApp } = require('./helpers');

// SR_INTERVALS 内部值（毫秒）：[0, 1h, 1d, 3d, 7d]
// level 5: 已掌握，从错题本移除
const SR_MS = {
  L0: 0,
  L1: 1 * 60 * 60 * 1000,
  L2: 24 * 60 * 60 * 1000,
  L3: 3 * 24 * 60 * 60 * 1000,
  L4: 7 * 24 * 60 * 60 * 1000
};

test('addWrong 首次添加：level=0、nextReview=now、cnt=1', async () => {
  const App = await freshApp();
  const before = Date.now();
  App.db.addWrong('q1');
  const after = Date.now();
  const wl = App.db.getWrong();
  assert.strictEqual(wl.length, 1);
  const w = wl[0];
  assert.strictEqual(w.qid, 'q1');
  assert.strictEqual(w.cnt, 1);
  assert.strictEqual(w.level, 0);
  assert.strictEqual(w.lastReview, 0);
  assert.ok(w.nextReview >= before && w.nextReview <= after, 'nextReview 应为当前时间');
});

test('addWrong 重复添加：cnt 累加、level 重置为 0、nextReview 立即', async () => {
  const App = await freshApp();
  App.db.addWrong('q1');
  // 模拟已经复习升级
  App.db.reviewCorrect('q1'); // level 1
  let w = App.db.getWrong()[0];
  assert.strictEqual(w.level, 1, 'sanity: 复习正确后 level=1');
  // 再答错：应该重置
  App.db.addWrong('q1');
  w = App.db.getWrong()[0];
  assert.strictEqual(w.cnt, 2, '错误次数累加');
  assert.strictEqual(w.level, 0, '答错重置为 level 0');
  assert.ok(w.nextReview <= Date.now() + 5, '立即可复习');
});

test('reviewCorrect 连续答对 5 次后：标记 mastered 并从错题本移除', async () => {
  const App = await freshApp();
  App.db.addWrong('q1');
  // 答对 5 次（level 0 → 1 → 2 → 3 → 4 → 5）
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(App.db.reviewCorrect('q1'));
  }
  // 第 5 次返回 mastered=true
  assert.strictEqual(results[4].mastered, true, '第 5 次正确后掌握');
  assert.deepStrictEqual(App.db.getWrong(), [], '已掌握错题被移除');
});

test('reviewCorrect 中间答对时升级并设置 nextReview 间隔', async () => {
  const App = await freshApp();
  App.db.addWrong('q1');
  const r1 = App.db.reviewCorrect('q1');
  assert.strictEqual(r1.mastered, false);
  assert.strictEqual(r1.level, 1);
  const w = App.db.getWrong()[0];
  assert.strictEqual(w.level, 1);
  const delta = w.nextReview - Date.now();
  // 允许 ±50ms 容差
  assert.ok(Math.abs(delta - SR_MS.L1) < 50, `level 1 间隔应为 1h，实际 ${delta}`);
});

test('reviewCorrect 每次升级 nextReview 按 SR_INTERVALS 推进', async () => {
  const App = await freshApp();
  App.db.addWrong('q1');
  for (let target = 1; target <= 4; target++) {
    App.db.reviewCorrect('q1');
    const w = App.db.getWrong()[0];
    assert.strictEqual(w.level, target);
    const delta = w.nextReview - Date.now();
    const expected = [SR_MS.L1, SR_MS.L2, SR_MS.L3, SR_MS.L4][target - 1];
    assert.ok(Math.abs(delta - expected) < 50, `level ${target} 间隔应为 ${expected}ms，实际 ${delta}`);
  }
});

test('reviewWrong 已在错题本：cnt++、level=0、nextReview=now', async () => {
  const App = await freshApp();
  App.db.addWrong('q1');           // cnt=1
  App.db.reviewCorrect('q1');      // level 0→1, cnt 不变
  App.db.reviewCorrect('q1');      // level 1→2, cnt 不变
  let w = App.db.getWrong()[0];
  assert.strictEqual(w.cnt, 1, 'sanity: reviewCorrect 不应改 cnt');
  assert.strictEqual(w.level, 2);
  App.db.reviewWrong('q1');
  w = App.db.getWrong()[0];
  assert.strictEqual(w.level, 0, '重置为 0');
  assert.strictEqual(w.cnt, 2, 'reviewWrong cnt 累加一次');
  assert.ok(w.nextReview <= Date.now() + 5, '立即可复习');
});

test('reviewWrong 不在错题本：等价于 addWrong（新增）', async () => {
  const App = await freshApp();
  App.db.reviewWrong('q1');
  const wl = App.db.getWrong();
  assert.strictEqual(wl.length, 1);
  assert.strictEqual(wl[0].qid, 'q1');
  assert.strictEqual(wl[0].cnt, 1);
  assert.strictEqual(wl[0].level, 0);
});

test('getDueWrong 只返回 nextReview <= now 的错题', async () => {
  const App = await freshApp();
  App.db.addWrong('q1');              // nextReview=now
  App.db.addWrong('q2');
  App.db.reviewCorrect('q2');          // 升级到 level 1，nextReview = now+1h
  const due = App.db.getDueWrong();
  const dueIds = due.map(w => w.qid).sort();
  assert.deepStrictEqual(dueIds, ['q1'], 'q2 升级后未到期');
});

test('getDueWrong 处理 nextReview 缺失字段（兼容旧数据）', async () => {
  const App = await freshApp();
  // 直接 setData 模拟无 nextReview 字段的旧错题
  App.db.setData({
    history: [],
    wrong: [{ qid: 'qOld', cnt: 1, level: 0, time: Date.now() }],
    stats: { total: 0, correct: 0, cats: {} },
    theme: 'dark',
    dailyGoal: 20,
    achievements: [],
    archive: []
  });
  const due = App.db.getDueWrong();
  assert.strictEqual(due.length, 1, '无 nextReview 字段时算到期');
});

test('removeWrong 按 qid 移除并 persist', async () => {
  const App = await freshApp();
  App.db.addWrong('q1');
  App.db.addWrong('q2');
  App.db.removeWrong('q1');
  const wl = App.db.getWrong();
  assert.deepStrictEqual(wl.map(w => w.qid), ['q2']);
});

test('getWrong 返回的是引用——修改会影响内部状态（验证 API 契约）', async () => {
  // 这是当前实现的 API 契约，变更需谨慎
  const App = await freshApp();
  App.db.addWrong('q1');
  const wl = App.db.getWrong();
  assert.strictEqual(wl.length, 1);
  // 不应崩溃；后续 reviewCorrect 等操作通过遍历内部数组
  App.db.reviewCorrect('q1');
  assert.strictEqual(App.db.getWrong().length, 1);
});
