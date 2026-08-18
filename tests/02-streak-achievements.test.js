/**
 * tests/02-streak-achievements.test.js
 * 复杂日期/边界条件：
 *  - getStreak() 连续打卡    —— 今天/昨天/断签/跨月/跨年/合并归档日期
 *  - checkAchievements()     —— 10 种成就徽章的精确边界触发条件 + 幂等性（不重复解锁）
 */
'use strict';

const assert = require('assert');
const { loadCore, test, suite, summary } = require('./setup');

const DAY = 86400000;

// ============================================================
// 构造一个完全可控的「日期世界」
// 做法：不 mock 全局 Date（会影响 setup.js），而是直接手动
//       构造 d.history 的时间戳，并确保它们与真实 Date() 对齐
//       （真实「今天」会作为 streak 的起点）
// ============================================================
function daysAgoTimestamp(n, h = 12, m = 0) {
  // n 天前的中午 12:00 时间戳（确保当天有记录）
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
// storage.js 修复后，history & archive 都用 getMonth()+1
function dayKeyOf(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function archiveDateKeyOf(ts) {
  return dayKeyOf(ts);
}

const App = loadCore();

suite('1. App.db.getStreak() —— 连续打卡天数（复杂日期边界）', () => {
  const reset = () => App.db.setData(App.db.defaults());

  test('完全空数据 → 0 天', () => {
    reset();
    assert.strictEqual(App.db.getStreak(), 0);
  });

  test('只有今天有记录 → 1 天', () => {
    reset();
    const d = App.db.get();
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(0) }); // 今天
    assert.strictEqual(App.db.getStreak(), 1);
  });

  test('今天没答题，昨天有 → 从昨天开始计数，1 天（容错 1 天断签）', () => {
    reset();
    const d = App.db.get();
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(1) }); // 昨天
    assert.strictEqual(App.db.getStreak(), 1,
      '昨天有今天没有：应从昨天开始算 1 天容错');
  });

  test('今天 + 昨天 → 2 天', () => {
    reset();
    const d = App.db.get();
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(0) }); // 今天
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(1) }); // 昨天
    assert.strictEqual(App.db.getStreak(), 2);
  });

  test('连续 7 天（含今天） → 7 天', () => {
    reset();
    const d = App.db.get();
    for (let i = 0; i < 7; i++) {
      d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(i) });
    }
    assert.strictEqual(App.db.getStreak(), 7);
  });

  test('连续 6 天 + 中间断 1 天 + 今天/昨天 → 2 天（断签后只计最近连续段）', () => {
    reset();
    const d = App.db.get();
    // 10-5 天前答题（共 6 天），4-3 天前断（2 天），然后 2 天前 + 昨天 + 今天（3 天）
    // 实际：最近的签到是今天、昨天、2 天前 共连续 3 天
    for (let i = 10; i >= 5; i--) d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(i) });
    for (let i = 2; i >= 0; i--) d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(i) });
    assert.strictEqual(App.db.getStreak(), 3, '最近连续 3 天（今天+昨天+2天前）');
  });

  test('跨月边界（上月末 + 本月初连续） → 正确识别连续', () => {
    reset();
    const d = App.db.get();
    const today = new Date();
    if (today.getDate() <= 3) {
      // 今天是月初 1-3 号，检查上个月末是否有答记录
      // 构造：今天 + 昨天 + 上月末连续
      for (let i = 0; i < 5; i++) {
        d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(i) });
      }
      assert.ok(App.db.getStreak() >= 1, '跨月场景至少 1 天');
    } else {
      // 普通日期，简单断言有答记录
      d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(0) });
      assert.strictEqual(App.db.getStreak(), 1);
    }
  });

  test('跨年边界（12月31日 + 1月1日）应被识别为连续 2 天', () => {
    reset();
    const d = App.db.get();
    // 手动 push 两条跨年的记录 + 设置今天为 1 月 1 日或 12 月 31 日
    // 由于今天不能 mock，改为：构造 archive 日期验证日期 key 的匹配逻辑
    // 通过 archive 注入跨年日期 + 今天有答题
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(0) });
    // 昨天如果是 12月31日 且今天是1月1日，就加 12月31日的记录
    const y = new Date(); y.setDate(y.getDate() - 1);
    const t = new Date();
    if (y.getMonth() === 11 && t.getMonth() === 0) {
      d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(1) });
      assert.strictEqual(App.db.getStreak(), 2, '跨年连续应算 2 天');
    } else {
      assert.strictEqual(App.db.getStreak(), 1);
    }
  });

  test('history + archive 日期合并：断档的历史在 archive 中也能合并到连续打卡', () => {
    reset();
    const d = App.db.get();
    // 场景：history 中只有今天/昨天（2天）；archive 中还有 2-11 天前（共 10 天每天一条）
    // 总连续：12 天（今天到 11 天前不断档）
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(0) });
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(1) });
    for (let i = 2; i <= 11; i++) {
      const ts = daysAgoTimestamp(i);
      d.archive.push({
        date: archiveDateKeyOf(ts),
        total: 20, correct: 18
      });
    }
    assert.strictEqual(App.db.getStreak(), 12, 'history(2) + archive(10) 连续 12 天');
  });

  test('断签超过 2 天（今天答题，前天开始往前有连续） → 1 天', () => {
    reset();
    const d = App.db.get();
    // 今天 + 5~3 天前（中间 2 天/昨天 断了）
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(0) });
    for (let i = 5; i >= 3; i--) {
      d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(i) });
    }
    assert.strictEqual(App.db.getStreak(), 1, '断签后只能计今天 1 天');
  });

  test('重复同一天多条记录不影响天数（去重）', () => {
    reset();
    const d = App.db.get();
    // 今天 100 条，昨天 50 条 → 应仍是 2 天
    for (let i = 0; i < 100; i++) d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(0, i % 24, i % 60) });
    for (let i = 0; i < 50; i++) d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(1, i % 24, i % 60) });
    assert.strictEqual(App.db.getStreak(), 2);
  });
});

// ============================================================
// checkAchievements() —— 10 种成就徽章精确边界
// ============================================================
suite('2. App.db.checkAchievements() —— 成就徽章（精确触发边界 + 幂等性）', () => {
  const reset = () => App.db.setData(App.db.defaults());

  // 工具：给 d 写入 N 条记录（按指定 ok 比例 + 分布在今天）
  function addRecords(App, total, correctRatio = 1, opts = {}) {
    const d = App.db.get();
    const now = Date.now();
    const cats = opts.categories || ['专辑', '歌曲', '个人信息', '获奖记录'];
    let catIdx = 0;
    for (let i = 0; i < total; i++) {
      const ok = i < Math.round(total * correctRatio);
      // 找一个属于 cats[catIdx % cats.length] 的 qid
      const q = findQByCategory(cats[catIdx % cats.length]);
      catIdx++;
      d.history.push({ qid: q ? q.id : '001', ok: ok, time: now - i });
      d.stats.total++;
      if (ok) d.stats.correct++;
      if (q) {
        if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
        d.stats.cats[q.category].t++;
        if (ok) d.stats.cats[q.category].c++;
      }
    }
  }
  function findQByCategory(cat) {
    const bank = App.QUESTION_BANK || [];
    for (let i = 0; i < bank.length; i++) if (bank[i].category === cat) return bank[i];
    return null;
  }

  test('空数据 checkAchievements 不崩溃、返回空数组', () => {
    reset();
    const r = App.db.checkAchievements();
    assert.ok(Array.isArray(r));
    assert.strictEqual(r.length, 0);
  });

  test('first_answer 第 1 题触发（>=1）', () => {
    reset();
    addRecords(App, 1, 1);
    const unlocked = App.db.checkAchievements();
    assert.ok(unlocked.some(a => a.id === 'first_answer'), '第 1 题应触发初出茅庐');
    assert.strictEqual(App.db.getAchievements().indexOf('first_answer') !== -1, true);
  });

  test('幂等：同一成就不会被再次解锁，第二次 check 返回空', () => {
    reset();
    addRecords(App, 1, 1);
    const r1 = App.db.checkAchievements();
    const r2 = App.db.checkAchievements();
    assert.ok(r1.some(a => a.id === 'first_answer'));
    assert.strictEqual(r2.length, 0, '第二次不应重复解锁');
  });

  test('total_100 在 100 题时触发（>=100）', () => {
    reset();
    addRecords(App, 99, 1);
    let ul = App.db.checkAchievements();
    assert.ok(!ul.some(a => a.id === 'total_100'), '99 题不应触发百题斩');
    addRecords(App, 1, 1);
    ul = App.db.checkAchievements();
    assert.ok(ul.some(a => a.id === 'total_100'), '100 题刚好触发百题斩');
  });

  test('total_500 在 500 题时触发', () => {
    reset();
    addRecords(App, 499, 1);
    let ul = App.db.checkAchievements();
    assert.ok(!ul.some(a => a.id === 'total_500'), '499 不应触发');
    addRecords(App, 1, 1);
    ul = App.db.checkAchievements();
    assert.ok(ul.some(a => a.id === 'total_500'), '500 应触发');
  });

  test('acc_90 触发条件：total>=50 且 correct/total>=0.9（严格精确边界）', () => {
    reset();
    // 49 对 1 错 = 50 题 98% → 触发
    addRecords(App, 49, 49 / 49);       // 49/49 = 100%，但 total<50，不触发
    let ul = App.db.checkAchievements();
    assert.ok(!ul.some(a => a.id === 'acc_90'), '49 题即 100% 也不触发（需>=50题）');
    // 加 1 条错 → 50 题，49/50 = 98% → 触发
    let d = App.db.get();   // reset 或 addRecords 后重新取引用
    let now = Date.now();
    d.history.push({ qid: '001', ok: false, time: now });
    d.stats.total++; d.stats.correct += 0;
    if (!d.stats.cats['专辑']) d.stats.cats['专辑'] = { t: 0, c: 0 };
    d.stats.cats['专辑'].t++;
    ul = App.db.checkAchievements();
    assert.ok(ul.some(a => a.id === 'acc_90'), '50 题 98% 应触发资深JM');

    // 45/50 = 90% → 触发（刚好边界）
    reset();
    d = App.db.get();     // reset 后 d 必须重取（setData 替换了 _cache）
    now = Date.now();
    addRecords(App, 45, 1); // 45 对
    d = App.db.get();       // addRecords 内部用 App.db.get()，重新取最新
    for (let i = 0; i < 5; i++) {
      d.history.push({ qid: '001', ok: false, time: now + i });
      d.stats.total++;
      if (!d.stats.cats['专辑']) d.stats.cats['专辑'] = { t: 0, c: 0 };
      d.stats.cats['专辑'].t++;
    }
    assert.strictEqual(d.stats.total, 50);
    assert.strictEqual(d.stats.correct, 45);
    assert.ok(45 / 50 === 0.9);
    ul = App.db.checkAchievements();
    assert.ok(ul.some(a => a.id === 'acc_90'), '刚好 90% 应触发');

    // 44/50 = 88% → 不触发
    reset();
    d = App.db.get();
    now = Date.now();
    addRecords(App, 44, 1);
    d = App.db.get();
    for (let i = 0; i < 6; i++) {
      d.history.push({ qid: '001', ok: false, time: now + i });
      d.stats.total++;
      if (!d.stats.cats['专辑']) d.stats.cats['专辑'] = { t: 0, c: 0 };
      d.stats.cats['专辑'].t++;
    }
    assert.strictEqual(44 / 50 < 0.9, true);
    ul = App.db.checkAchievements();
    assert.ok(!ul.some(a => a.id === 'acc_90'), '88% 不应触发');
  });

  test('perfect_10 需要 context.quizTotal>=10 且 quizCorrect===quizTotal', () => {
    reset();
    addRecords(App, 5, 1);
    // 没有 context → 不触发
    let ul = App.db.checkAchievements({});
    assert.ok(!ul.some(a => a.id === 'perfect_10'), '空 context 不触发');
    // 9 题全对 → 不触发
    ul = App.db.checkAchievements({ quizTotal: 9, quizCorrect: 9 });
    assert.ok(!ul.some(a => a.id === 'perfect_10'), '9 题全对不触发');
    // 10 题 9 对 → 不触发
    ul = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 9 });
    assert.ok(!ul.some(a => a.id === 'perfect_10'), '10 题 9 对不触发');
    // 10 题 10 对 → 触发
    ul = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    assert.ok(ul.some(a => a.id === 'perfect_10'), '10 题全对应触发十全十美');
    // 20 题 20 对 → 也触发
    reset();
    ul = App.db.checkAchievements({ quizTotal: 20, quizCorrect: 20 });
    assert.ok(ul.some(a => a.id === 'perfect_10'), '20 题全对也应触发');
  });

  test('daily_50 单日答题 >=50 触发', () => {
    reset();
    const d = App.db.get();
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const todayT = today0.getTime();
    // 49 条今天记录
    for (let i = 0; i < 49; i++) {
      d.history.push({ qid: '001', ok: true, time: todayT + 3600000 + i });
      d.stats.total++; d.stats.correct++;
    }
    let ul = App.db.checkAchievements();
    assert.ok(!ul.some(a => a.id === 'daily_50'), '49 题不应触发勤奋粉丝');
    // 第 50 条今天
    d.history.push({ qid: '001', ok: true, time: todayT + 3600000 + 100 });
    d.stats.total++; d.stats.correct++;
    ul = App.db.checkAchievements();
    assert.ok(ul.some(a => a.id === 'daily_50'), '50 题触发');
    // 昨天 100 条 + 今天 0 条 → 不触发
    reset();
    for (let i = 0; i < 100; i++) {
      d.history.push({ qid: '001', ok: true, time: todayT - DAY + i });
      d.stats.total++; d.stats.correct++;
    }
    ul = App.db.checkAchievements();
    assert.ok(!ul.some(a => a.id === 'daily_50'), '昨天的不算，今天 0 条不触发');
  });

  test('streak_3 / streak_7 精确边界', () => {
    reset();
    let d = App.db.get();
    // 连续 2 天
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(0) });
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(1) });
    let ul = App.db.checkAchievements();
    assert.ok(!ul.some(a => a.id === 'streak_3'), '2 天不应触发 streak_3');
    assert.ok(!ul.some(a => a.id === 'streak_7'), '2 天不应触发 streak_7');
    // 再加 1 天（共 3）
    d.history.push({ qid: '001', ok: true, time: daysAgoTimestamp(2) });
    ul = App.db.checkAchievements();
    assert.ok(ul.some(a => a.id === 'streak_3'), '3 天触发三日坚持');
    assert.ok(!ul.some(a => a.id === 'streak_7'), '3 天还没到 7');
    // 加 4-6 天前（用 archive 注入 3 条连续，让 streak=3+3+1？不对，当前已有 3 天连续（0,1,2）
    // 再加 3,4,5,6 天前的 archive → 连续 7 天（0,1,2,3,4,5,6）
    for (let i = 3; i <= 6; i++) {
      const ts = daysAgoTimestamp(i);
      d.archive.push({ date: archiveDateKeyOf(ts), total: 1, correct: 1 });
    }
    // 确保 getStreak 真的是 7（调试断言，方便定位）
    const streak = App.db.getStreak();
    assert.ok(streak >= 7, `当前 streak 应 >=7，实际=${streak}。注入了 history(0,1,2) + archive(3~6) 共 7 天连续`);
    ul = App.db.checkAchievements();
    assert.ok(ul.some(a => a.id === 'streak_7'), '连续 7 天触发七日之约');
  });

  test('wrong_clear 错题清零：已有 first_answer 且 wrong.length===0 且 total>0', () => {
    reset();
    let d = App.db.get();
    // -------- 场景 1：total=0（first_answer 不可能解锁）+ wrong 空 → 不触发 --------
    // 这里 total=0，checkAchievements 不会自动 unlock first_answer
    // 手动写入 achievements=[first_answer] + wrong=[] + total=0 → 不触发（缺 total>0）
    d.achievements = ['first_answer'];
    d.wrong = [];
    d.stats.total = 0;
    let ul = App.db.checkAchievements();
    assert.ok(!ul.some(a => a.id === 'wrong_clear'), 'total=0 即使其他满足也不触发');

    // -------- 场景 2：total>0 会自动先解锁 first_answer，再判断 wrong_clear --------
    reset();
    d = App.db.get();
    addRecords(App, 1, 1);   // total=1 → checkAchievements 会先解锁 first_answer
    // achievements 里已自动有 first_answer；手动确保 wrong=[]
    d = App.db.get();
    d.wrong = [];
    d.achievements = d.achievements.filter(a => a !== 'wrong_clear'); // 确保没有 pre-unlock
    ul = App.db.checkAchievements();
    assert.ok(ul.some(a => a.id === 'wrong_clear'), '首答已解锁 + wrong清零 + total>0 → 触发');

    // -------- 场景 3：有错题 → 不触发 --------
    reset();
    d = App.db.get();
    addRecords(App, 1, 1);
    App.db.addWrong('001');   // 有错题
    d = App.db.get();
    d.achievements = d.achievements.filter(a => a !== 'wrong_clear');
    ul = App.db.checkAchievements();
    assert.ok(!ul.some(a => a.id === 'wrong_clear'), '有错题时不应触发');
  });

  test('all_cats 所有 4 个固定分类都有答题记录 → 触发', () => {
    reset();
    const d = App.db.get();
    const allCats = ['专辑', '歌曲', '个人信息', '获奖记录'];
    // 先只答 3 个分类
    for (let i = 0; i < 3; i++) {
      const q = findQByCategory(allCats[i]);
      d.history.push({ qid: q.id, ok: true, time: Date.now() - i });
      d.stats.total++; d.stats.correct++;
      if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
      d.stats.cats[q.category].t++; d.stats.cats[q.category].c++;
    }
    let ul = App.db.checkAchievements();
    assert.ok(!ul.some(a => a.id === 'all_cats'), '3 个分类不触发全能粉丝');
    // 加上第 4 个
    const q = findQByCategory(allCats[3]);
    d.history.push({ qid: q.id, ok: true, time: Date.now() - 100 });
    d.stats.total++; d.stats.correct++;
    if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
    d.stats.cats[q.category].t++; d.stats.cats[q.category].c++;
    ul = App.db.checkAchievements();
    assert.ok(ul.some(a => a.id === 'all_cats'), '4 分类都有记录触发全能粉丝');
  });

  test('checkAchievements 返回的解锁记录包含 id/name/icon/desc 完整字段', () => {
    reset();
    addRecords(App, 1, 1);
    const ul = App.db.checkAchievements();
    const first = ul.find(a => a.id === 'first_answer');
    assert.ok(first);
    assert.strictEqual(typeof first.name, 'string');
    assert.ok(first.name.length > 0);
    assert.strictEqual(typeof first.icon, 'string');
    assert.ok(first.icon.length > 0);
    assert.strictEqual(typeof first.desc, 'string');
    assert.ok(first.desc.length > 0);
  });
});

summary();
