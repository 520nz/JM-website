// ============================================================
// storage.test.js - 核心数据层回归测试
// 覆盖高风险区域：XSS转义、间隔重复算法、历史归档、
// 统计重算、连续打卡边界、成就检查、每日目标clamp
// ============================================================
const assert = require('assert');
const { createTestContext } = require('./test-setup');

let ctx;
let App;

function beforeEach() {
  ctx = createTestContext();
  App = ctx.App;
}

// ---- 1. XSS 转义（安全关键） ----
function testEscBasic() {
  beforeEach();
  // 标签字符必须被转义
  assert.strictEqual(App.esc('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    '脚本标签应被完整转义');
  assert.strictEqual(App.esc('a&b'), 'a&amp;b', '& 应被转义');
  // textContent 写入后读取 innerHTML：引号不是 textContent 上下文中的 HTML 特殊字符，
  // 现代浏览器仅转义 & < > 三个字符，符合 XSS 防护需求。
  const out = App.esc('a<b>c"d\'e');
  assert.ok(!out.includes('<') && !out.includes('>') && !out.includes('&<'),
    '尖括号与&必须被转义。实际输出: ' + out);
}
function testEscNullish() {
  beforeEach();
  assert.strictEqual(App.esc(null), '', 'null 应返回空字符串');
  assert.strictEqual(App.esc(undefined), '', 'undefined 应返回空字符串');
  assert.strictEqual(App.esc(0), '0', '数字 0 应转成字符串 "0"');
  assert.strictEqual(App.esc(false), 'false', '布尔值应被正确字符串化');
}

// ---- 2. 间隔重复算法（错题等级升降） ----
function testAddWrongNew() {
  beforeEach();
  App.db.addWrong('q1');
  const w = App.db.getWrong();
  assert.strictEqual(w.length, 1);
  assert.strictEqual(w[0].qid, 'q1');
  assert.strictEqual(w[0].cnt, 1);
  assert.strictEqual(w[0].level, 0);
  assert.ok(typeof w[0].nextReview === 'number' && w[0].nextReview <= Date.now(),
    '新错题立即可复习');
}
function testAddWrongRepeatResetsLevel() {
  beforeEach();
  App.db.addWrong('q1');
  // 模拟提升到 Lv3
  App.db.reviewCorrect('q1'); // Lv1
  App.db.reviewCorrect('q1'); // Lv2
  App.db.reviewCorrect('q1'); // Lv3
  let w = App.db.getWrong()[0];
  assert.strictEqual(w.level, 3, '连续答对应升到 Lv3');
  // 再次答错：等级应重置为 0，cnt 递增
  App.db.addWrong('q1');
  w = App.db.getWrong()[0];
  assert.strictEqual(w.level, 0, '重复答错应重置等级为 0');
  assert.strictEqual(w.cnt, 2, '错误次数应递增');
  assert.ok(w.nextReview <= Date.now(), '重置后立即可复习');
}
function testReviewCorrectMasteryAtLv5() {
  beforeEach();
  App.db.addWrong('q1');
  let result;
  for (let i = 0; i < 5; i++) {
    result = App.db.reviewCorrect('q1');
  }
  assert.strictEqual(result.mastered, true, 'Lv5 后 mastered 应为 true');
  assert.strictEqual(result.qid, 'q1');
  assert.strictEqual(App.db.getWrong().length, 0, '掌握后错题本应清空');
}
function testReviewCorrectLevelIntervals() {
  beforeEach();
  App.db.addWrong('q1');
  const before = Date.now();
  const r1 = App.db.reviewCorrect('q1');
  assert.strictEqual(r1.level, 1);
  assert.strictEqual(r1.mastered, false);
  // Lv1 应为 1 小时间隔
  const w = App.db.getWrong()[0];
  const expected1h = before + 1 * 60 * 60 * 1000;
  assert.ok(Math.abs(w.nextReview - expected1h) < 1000,
    'Lv1 间隔应为 1 小时 (偏差: ' + (w.nextReview - expected1h) + 'ms)');
  App.db.reviewCorrect('q1');
  const w2 = App.db.getWrong()[0];
  assert.strictEqual(w2.level, 2);
  const expected1d = before + 1 * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(w2.nextReview - expected1d) < 2 * 1000,
    'Lv2 间隔应为 1 天');
}
function testReviewWrongNotFoundAddsIt() {
  beforeEach();
  App.db.reviewWrong('q99'); // 不在错题本中
  const w = App.db.getWrong();
  assert.strictEqual(w.length, 1);
  assert.strictEqual(w[0].qid, 'q99');
  assert.strictEqual(w[0].level, 0);
}
function testGetDueWrongFilter() {
  beforeEach();
  // 构造 3 道：1道到期、2道未到期
  const now = Date.now();
  const data = App.db.get();
  data.wrong = [
    { qid: 'due1', nextReview: now - 1000, level: 1, cnt: 1 },
    { qid: 'due2', nextReview: 0, level: 0, cnt: 1 },       // 缺失视为到期
    { qid: 'later', nextReview: now + 99999999, level: 2, cnt: 1 },
  ];
  const due = App.db.getDueWrong();
  assert.strictEqual(due.length, 2, '到期 + nextReview=0 的应返回');
  const ids = due.map(d => d.qid).sort().join(',');
  assert.strictEqual(ids, 'due1,due2', 'qid 集合应匹配');
}

// ---- 3. 答题记录 + 历史归档 ----
function testAddRecordUpdatesStats() {
  beforeEach();
  // mock findQ：构造一个 mock 题库
  App.QUESTION_BANK = [{ id: 'q1', category: '专辑' }, { id: 'q2', category: '歌曲' }];
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  App.db.addRecord({ qid: 'q2', ok: false, time: Date.now() });
  const s = App.db.get().stats;
  assert.strictEqual(s.total, 2);
  assert.strictEqual(s.correct, 1);
  assert.strictEqual(s.cats['专辑'].t, 1);
  assert.strictEqual(s.cats['专辑'].c, 1);
  assert.strictEqual(s.cats['歌曲'].t, 1);
  assert.strictEqual(s.cats['歌曲'].c, 0);
}
function testHistoryArchiveTriggeredAt1001() {
  beforeEach();
  App.QUESTION_BANK = [{ id: 'q1', category: '专辑' }];
  const data = App.db.get();
  // 填充 1001 条记录：1000 条 100 天前，1 条今天
  const old = Date.now() - 120 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < 1000; i++) {
    data.history.push({ qid: 'q1', ok: i % 2 === 0, time: old + i });
  }
  data.history.push({ qid: 'q1', ok: true, time: Date.now() });
  // 触发归档
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  const d = App.db.get();
  assert.ok(d.history.length < 1002,
    '归档后 history 长度应减少（当前: ' + d.history.length + ')');
  assert.ok(Array.isArray(d.archive) && d.archive.length > 0,
    'archive 中应存在按天聚合的记录');
  // 去重：重复调用不应重复归档同一天
  const beforeLen = d.archive.length;
  // 强制重新触发
  for (let i = 0; i < 10; i++) d.history.push({ qid: 'q1', ok: true, time: old + i });
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  assert.strictEqual(d.archive.length, beforeLen,
    '重复归档不应增加已有日期记录');
}

// ---- 4. 统计重算 ----
function testRecalcStatsFromHistory() {
  beforeEach();
  App.QUESTION_BANK = [{ id: 'q1', category: '专辑' }, { id: 'q2', category: '歌曲' }];
  const data = App.db.get();
  // 故意把 stats 设错
  data.stats = { total: 0, correct: 0, cats: {} };
  data.history = [
    { qid: 'q1', ok: true, time: Date.now() },
    { qid: 'q1', ok: false, time: Date.now() },
    { qid: 'q2', ok: true, time: Date.now() },
  ];
  App.db.recalcStats();
  const s = App.db.get().stats;
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.correct, 2);
  assert.strictEqual(s.cats['专辑'].t, 2);
  assert.strictEqual(s.cats['专辑'].c, 1);
  assert.strictEqual(s.cats['歌曲'].t, 1);
  assert.strictEqual(s.cats['歌曲'].c, 1);
}

// ---- 5. 每日目标 clamp 边界 ----
function testSetDailyGoalClamp() {
  beforeEach();
  App.db.setDailyGoal(0);
  assert.strictEqual(App.db.getDailyGoal(), 5, '低于 5 应 clamp 到 5');
  App.db.setDailyGoal(4);
  assert.strictEqual(App.db.getDailyGoal(), 5);
  App.db.setDailyGoal(999);
  assert.strictEqual(App.db.getDailyGoal(), 100, '高于 100 应 clamp 到 100');
  App.db.setDailyGoal(30);
  assert.strictEqual(App.db.getDailyGoal(), 30, '正常范围应保留');
  App.db.setDailyGoal(5);
  assert.strictEqual(App.db.getDailyGoal(), 5, '边界下限 5 应保留');
  App.db.setDailyGoal(100);
  assert.strictEqual(App.db.getDailyGoal(), 100, '边界上限 100 应保留');
}

// ---- 6. 连续打卡计算（日期边界极多） ----
function testGetStreakZero() {
  beforeEach();
  assert.strictEqual(App.db.getStreak(), 0, '无记录时应为 0');
}
function testGetStreakTodayOnly() {
  beforeEach();
  const d = App.db.get();
  d.history.push({ time: Date.now(), ok: true, qid: 'q1' });
  assert.strictEqual(App.db.getStreak(), 1, '今天答过应为 1');
}
function testGetStreakYesterdayAndToday() {
  beforeEach();
  const d = App.db.get();
  const now = Date.now();
  const yesterday = now - 86400000;
  d.history.push({ time: now, ok: true });
  d.history.push({ time: yesterday, ok: true });
  assert.strictEqual(App.db.getStreak(), 2, '连续两天应为 2');
}
function testGetStreakGapBroken() {
  beforeEach();
  const d = App.db.get();
  // 3 天前 + 今天：中间断了
  d.history.push({ time: Date.now() - 3 * 86400000, ok: true });
  d.history.push({ time: Date.now(), ok: true });
  assert.strictEqual(App.db.getStreak(), 1, '断签后应从今天重新计为 1');
}
function testGetStreakNoTodayStartFromYesterday() {
  beforeEach();
  const d = App.db.get();
  // 只有昨天的记录，今天没答
  d.history.push({ time: Date.now() - 86400000, ok: true });
  d.history.push({ time: Date.now() - 2 * 86400000, ok: true });
  assert.strictEqual(App.db.getStreak(), 2,
    '今天没答但昨天有，应从昨天开始倒推计算');
}
function testGetStreakIncludesArchive() {
  beforeEach();
  const d = App.db.get();
  const now = new Date();
  const mk = (offset) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - offset);
    dt.setHours(0, 0, 0, 0);
    return dt;
  };
  // history 只有今天
  d.history.push({ time: Date.now() });
  // archive 补充昨天-前天
  const yesterday = mk(1);
  const dayBefore = mk(2);
  const yk = yesterday.getFullYear() + '-' + yesterday.getMonth() + '-' + yesterday.getDate();
  const dk = dayBefore.getFullYear() + '-' + dayBefore.getMonth() + '-' + dayBefore.getDate();
  d.archive = [{ date: yk, total: 1, correct: 1 }, { date: dk, total: 1, correct: 1 }];
  assert.strictEqual(App.db.getStreak(), 3, '归档日期也应计入连续打卡');
}

// ---- 7. 成就检查（10 项，边界条件多） ----
function testAchievementFirstAnswer() {
  beforeEach();
  App.QUESTION_BANK = [{ id: 'q1', category: '专辑' }];
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  const res = App.db.checkAchievements({});
  const ids = res.map(r => r.id);
  assert.ok(ids.includes('first_answer'), '答 1 题应解锁初出茅庐');
}
function testAchievementPerfect10() {
  beforeEach();
  App.QUESTION_BANK = [{ id: 'q1', category: '专辑' }];
  // 先答 1 题解锁 first_answer 以便 unlock 逻辑去重
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  App.db.checkAchievements({});
  // 再来一轮 10 道全对
  const res = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
  const ids = res.map(r => r.id);
  assert.ok(ids.includes('perfect_10'), '单轮 10 题全对应解锁十全十美');
}
function testAchievementPerfect10NotEnoughQuestions() {
  beforeEach();
  const res = App.db.checkAchievements({ quizTotal: 9, quizCorrect: 9 });
  assert.ok(!res.map(r => r.id).includes('perfect_10'),
    '题目不足 10 不应解锁十全十美');
}
function testAchievementAcc90() {
  beforeEach();
  App.QUESTION_BANK = [{ id: 'q1', category: '专辑' }];
  const d = App.db.get();
  d.stats.total = 0;
  d.stats.correct = 0;
  for (let i = 0; i < 50; i++) {
    App.db.addRecord({ qid: 'q1', ok: i < 45, time: Date.now() });
  }
  const s = App.db.get().stats;
  assert.strictEqual(s.total, 50);
  assert.strictEqual(s.correct, 45);
  const res = App.db.checkAchievements({});
  const ids = res.map(r => r.id);
  assert.ok(ids.includes('acc_90'), '50 题 90% 正确率应解锁资深JM');
}
function testAchievementWrongClear() {
  beforeEach();
  App.QUESTION_BANK = [{ id: 'q1', category: '专辑' }];
  // 先答错 + 解锁 first_answer + 明确加入错题本（addRecord 不调 addWrong）
  App.db.addRecord({ qid: 'q1', ok: false, time: Date.now() });
  App.db.addWrong('q1');
  App.db.checkAchievements({});
  assert.strictEqual(App.db.getWrong().length, 1);
  // 全部答到掌握
  for (let i = 0; i < 5; i++) App.db.reviewCorrect('q1');
  assert.strictEqual(App.db.getWrong().length, 0);
  const res = App.db.checkAchievements({});
  const ids = res.map(r => r.id);
  assert.ok(ids.includes('wrong_clear'), '错题清零应解锁错题清零徽章');
}
function testAchievementAllCats() {
  beforeEach();
  const cats = ['专辑', '歌曲', '个人信息', '获奖记录'];
  App.QUESTION_BANK = cats.map((c, i) => ({ id: 'q' + i, category: c }));
  for (let i = 0; i < cats.length; i++) {
    App.db.addRecord({ qid: 'q' + i, ok: true, time: Date.now() });
  }
  const res = App.db.checkAchievements({});
  const ids = res.map(r => r.id);
  assert.ok(ids.includes('all_cats'), '全分类答题应解锁全能粉丝');
}
function testAchievementIdempotent() {
  beforeEach();
  App.QUESTION_BANK = [{ id: 'q1', category: '专辑' }];
  App.db.addRecord({ qid: 'q1', ok: true, time: Date.now() });
  const r1 = App.db.checkAchievements({});
  const r2 = App.db.checkAchievements({});
  assert.ok(r1.length > 0, '首次应有解锁');
  assert.strictEqual(r2.length, 0, '重复调用不应重复解锁（幂等）');
}
function testAchievementStreak3() {
  beforeEach();
  const d = App.db.get();
  const now = Date.now();
  // 连续 3 天答题记录
  for (let i = 0; i < 3; i++) {
    d.history.push({ time: now - i * 86400000, ok: true });
  }
  const res = App.db.checkAchievements({});
  const ids = res.map(r => r.id);
  assert.ok(ids.includes('streak_3'), '连续 3 天应解锁三日坚持');
}
function testAchievementDaily50() {
  beforeEach();
  App.QUESTION_BANK = [{ id: 'q1', category: '专辑' }];
  const today = new Date().setHours(0, 0, 0, 0);
  for (let i = 0; i < 52; i++) {
    App.db.addRecord({ qid: 'q1', ok: true, time: today + i * 1000 });
  }
  const res = App.db.checkAchievements({});
  const ids = res.map(r => r.id);
  assert.ok(ids.includes('daily_50'), '单日 50+ 题应解锁勤奋粉丝');
}
function testAchievementTotalMilestones() {
  beforeEach();
  App.QUESTION_BANK = [{ id: 'q1', category: '专辑' }];
  const d = App.db.get();
  d.stats.total = 100;
  d.stats.correct = 80;
  const res = App.db.checkAchievements({});
  const ids = res.map(r => r.id);
  assert.ok(ids.includes('total_100'), '100 题应解锁百题斩');
  // 升级到 500
  d.stats.total = 500;
  d.stats.correct = 400;
  const res2 = App.db.checkAchievements({});
  assert.ok(res2.map(r => r.id).includes('total_500'), '500 题应解锁五百题王');
}

// ---- 8. 题目查找 ----
function testFindQExisting() {
  beforeEach();
  const q = App.db.findQ('001');
  assert.ok(q, '默认题库中应包含 id=001');
  assert.strictEqual(q.category, '专辑');
}
function testFindQMissing() {
  beforeEach();
  assert.strictEqual(App.db.findQ('nonexistent_xyz'), null);
}

// ---- 9. 错题移除 ----
function testRemoveWrong() {
  beforeEach();
  App.db.addWrong('q1');
  App.db.addWrong('q2');
  assert.strictEqual(App.db.getWrong().length, 2);
  App.db.removeWrong('q1');
  assert.strictEqual(App.db.getWrong().length, 1);
  assert.strictEqual(App.db.getWrong()[0].qid, 'q2');
}

// ---- 10. Session 模块 ----
function testSessionSaveLoadClear() {
  beforeEach();
  const mockState = {
    quiz: [{ id: '001' }, { id: '002' }],
    idx: 1,
    correctCount: 1,
    startTime: Date.now() - 60000,
    mode: 'quick',
    isWrongBookQuiz: false,
  };
  App.session.save(mockState);
  const loaded = App.session.load();
  assert.ok(loaded, 'session 应可加载');
  assert.strictEqual(loaded.idx, 1);
  assert.strictEqual(loaded.mode, 'quick');
  assert.strictEqual(loaded.quizIds.join(','), '001,002');
  App.session.clear();
  assert.strictEqual(App.session.load(), null, 'clear 后应返回 null');
}

module.exports = {
  testEscBasic, testEscNullish,
  testAddWrongNew, testAddWrongRepeatResetsLevel,
  testReviewCorrectMasteryAtLv5, testReviewCorrectLevelIntervals,
  testReviewWrongNotFoundAddsIt, testGetDueWrongFilter,
  testAddRecordUpdatesStats, testHistoryArchiveTriggeredAt1001,
  testRecalcStatsFromHistory,
  testSetDailyGoalClamp,
  testGetStreakZero, testGetStreakTodayOnly, testGetStreakYesterdayAndToday,
  testGetStreakGapBroken, testGetStreakNoTodayStartFromYesterday, testGetStreakIncludesArchive,
  testAchievementFirstAnswer, testAchievementPerfect10, testAchievementPerfect10NotEnoughQuestions,
  testAchievementAcc90, testAchievementWrongClear, testAchievementAllCats,
  testAchievementIdempotent, testAchievementStreak3, testAchievementDaily50,
  testAchievementTotalMilestones,
  testFindQExisting, testFindQMissing,
  testRemoveWrong,
  testSessionSaveLoadClear,
};
