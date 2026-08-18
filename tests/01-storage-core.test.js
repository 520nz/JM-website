/**
 * tests/01-storage-core.test.js
 * 覆盖优先级最高的共享核心逻辑：
 *  - XSS 转义 esc()         —— 安全 / 数据验证
 *  - addRecord() + 归档     —— 复杂边界（>1000条触发、90天cutoff、按天聚合、去重）
 *  - recalcStats()          —— 数据一致性
 *  - addWrong/reviewCorrect/reviewWrong —— 间隔重复状态机
 *  - getDueWrong()          —— 到期筛选
 *  - getDailyGoal/setDailyGoal —— 边界夹紧 (5-100)
 *  - findQ()                —— 题库查找
 *  - session save/load/clear —— 会话管理
 */
'use strict';

const assert = require('assert');
const { loadCore, test, suite, summary } = require('./setup');

const App = loadCore();
const reset = () => {
  App.db.setData(App.db.defaults());
  sessionStorage.clear();
};

// ============================================================
// 1. XSS 转义 esc() —— 安全关键，边界极端值
// ============================================================
suite('1. App.esc() —— XSS 转义（安全关键）', () => {
  test('null / undefined 返回空字符串', () => {
    assert.strictEqual(App.esc(null), '');
    assert.strictEqual(App.esc(undefined), '');
  });

  test('空字符串返回空字符串', () => {
    assert.strictEqual(App.esc(''), '');
  });

  test('纯文本不转义', () => {
    assert.strictEqual(App.esc('hello world'), 'hello world');
    assert.strictEqual(App.esc('林俊杰'), '林俊杰');
  });

  test('转义 5 种 XSS 关键字符', () => {
    const input = '<script>alert("XSS")&\'haha\'</script>';
    const out = App.esc(input);
    assert.ok(!out.includes('<'), '未转义 <');
    assert.ok(!out.includes('>'), '未转义 >');
    // 双引号要么不存在要么是实体
    if (out.includes('"')) assert.ok(out.includes('&quot;'), '未转义 "');
    // 单引号要么不存在要么是实体
    if (out.includes("'")) assert.ok(out.includes('&#39;'), "未转义 '");
    assert.ok(!out.includes('&<'), '未转义 &（应先转 & 再其他）');
  });

  test('数字类型被正确转为字符串', () => {
    assert.strictEqual(App.esc(123), '123');
    assert.strictEqual(App.esc(0), '0');
  });

  test('对象转字符串时不崩溃', () => {
    const r = App.esc({ foo: '<bar>' });
    assert.strictEqual(typeof r, 'string');
    assert.ok(r.length > 0);
  });
});

// ============================================================
// 2. findQ() —— 题库查找（所有模块共享使用）
// ============================================================
suite('2. App.db.findQ() —— 题库查找', () => {
  test('找到存在的题目', () => {
    const q = App.db.findQ('001');
    assert.ok(q, '应返回题目对象');
    assert.strictEqual(q.id, '001');
    assert.strictEqual(q.category, '专辑');
  });

  test('不存在的 ID 返回 null', () => {
    assert.strictEqual(App.db.findQ('not_exist_9999'), null);
  });

  test('空字符串 / null ID 返回 null', () => {
    assert.strictEqual(App.db.findQ(''), null);
    assert.strictEqual(App.db.findQ(null), null);
  });
});

// ============================================================
// 3. 每日目标 getDailyGoal / setDailyGoal —— 边界夹紧
// ============================================================
suite('3. 每日目标边界（夹紧 5-100）', { beforeEach: reset }, () => {
  test('默认值为 20', () => {
    assert.strictEqual(App.db.getDailyGoal(), 20);
  });

  test('设置正常值', () => {
    App.db.setDailyGoal(50);
    assert.strictEqual(App.db.getDailyGoal(), 50);
  });

  test('设置低于最小值 5 时被夹紧到 5', () => {
    App.db.setDailyGoal(1);
    assert.strictEqual(App.db.getDailyGoal(), 5);
    App.db.setDailyGoal(-10);
    assert.strictEqual(App.db.getDailyGoal(), 5);
    App.db.setDailyGoal(0);
    assert.strictEqual(App.db.getDailyGoal(), 5);
  });

  test('设置高于最大值 100 时被夹紧到 100', () => {
    App.db.setDailyGoal(500);
    assert.strictEqual(App.db.getDailyGoal(), 100);
    App.db.setDailyGoal(101);
    assert.strictEqual(App.db.getDailyGoal(), 100);
  });

  test('边界值 5 和 100 可以正常设置', () => {
    App.db.setDailyGoal(5);
    assert.strictEqual(App.db.getDailyGoal(), 5);
    App.db.setDailyGoal(100);
    assert.strictEqual(App.db.getDailyGoal(), 100);
  });
});

// ============================================================
// 4. addRecord() + 历史数据归档
// ============================================================
suite('4. addRecord() —— 答题记录 + 历史归档（>1000条触发归档）', { beforeEach: reset }, () => {
  test('添加单条记录：stats.total/correct 正确累加，分类统计正确', () => {
    App.db.addRecord({ qid: '001', ok: true, time: Date.now() });
    const d = App.db.get();
    assert.strictEqual(d.stats.total, 1);
    assert.strictEqual(d.stats.correct, 1);
    assert.ok(d.stats.cats['专辑'], '专辑分类应被创建');
    assert.strictEqual(d.stats.cats['专辑'].t, 1);
    assert.strictEqual(d.stats.cats['专辑'].c, 1);
    assert.strictEqual(d.history.length, 1);
  });

  test('添加单条错误记录：correct 不累加', () => {
    App.db.addRecord({ qid: '001', ok: false, time: Date.now() });
    const d = App.db.get();
    assert.strictEqual(d.stats.total, 1);
    assert.strictEqual(d.stats.correct, 0);
    assert.strictEqual(d.stats.cats['专辑'].t, 1);
    assert.strictEqual(d.stats.cats['专辑'].c, 0);
  });

  test('不存在 qid 的记录：total 累加但分类不创建（防崩溃）', () => {
    App.db.addRecord({ qid: '__no_such__', ok: true, time: Date.now() });
    const d = App.db.get();
    assert.strictEqual(d.stats.total, 1);
    assert.strictEqual(d.stats.correct, 1);
    assert.strictEqual(Object.keys(d.stats.cats).length, 0);
  });

  test('归档：>1000 条时，90 天前的数据被按天聚合到 archive，且不重复归档同一天', () => {
    const d = App.db.get();
    const now = Date.now();
    const DAY = 86400000;

    // 构造 1501 条记录
    const t95a = now - 95 * DAY + 3600000;
    const t95b = now - 95 * DAY + 3600000 + 3 * 3600000;
    const t94 = now - 94 * DAY + 3600000;
    const t80 = now - 80 * DAY;
    const today = now;

    for (let i = 0; i < 200; i++) d.history.push({ qid: '001', ok: i < 150, time: t95a + i });
    for (let i = 0; i < 50; i++)  d.history.push({ qid: '002', ok: i < 25,  time: t95b + i });
    for (let i = 0; i < 300; i++) d.history.push({ qid: '003', ok: i < 200, time: t94 + i });
    for (let i = 0; i < 550; i++) d.history.push({ qid: '001', ok: true,       time: t80 + i });
    for (let i = 0; i < 401; i++) d.history.push({ qid: '001', ok: true,       time: today + i });

    assert.strictEqual(d.history.length, 1501);

    App.db.addRecord({ qid: '001', ok: true, time: today + 50000 });
    const d2 = App.db.get();

    const cutoff = now - 90 * DAY;
    for (const r of d2.history) {
      assert.ok(r.time >= cutoff, '归档后 history 不应有 90 天前的记录，发现 ts=' + r.time);
    }

    assert.ok(Array.isArray(d2.archive), 'archive 应存在');
    assert.strictEqual(d2.archive.length, 2, '应归档 2 天聚合');

    const ar95 = d2.archive.find(a => sameDayStr(a.date, t95a));
    assert.ok(ar95, '应包含 95 天前的归档');
    assert.strictEqual(ar95.total, 250, 'day A total=200+50');
    assert.strictEqual(ar95.correct, 150 + 25, 'day A correct=150+25');

    const ar94 = d2.archive.find(a => sameDayStr(a.date, t94));
    assert.ok(ar94, '应包含 94 天前的归档');
    assert.strictEqual(ar94.total, 300);
    assert.strictEqual(ar94.correct, 200);

    assert.ok(d2.history.length >= 550 + 401 + 1, '80天前+今天+新增保留');

    // --- 再触发一次：不重复归档 ---
    for (let i = 0; i < 1000; i++) {
      d2.history.push({ qid: '001', ok: true, time: today + 100000 + i });
    }
    App.db.addRecord({ qid: '001', ok: true, time: today + 9999999 });
    const d3 = App.db.get();
    const dup95 = d3.archive.filter(a => sameDayStr(a.date, t95a));
    assert.strictEqual(dup95.length, 1, '同一天不应重复归档');
    const dup94 = d3.archive.filter(a => sameDayStr(a.date, t94));
    assert.strictEqual(dup94.length, 1, '同一天不应重复归档');
  });
});

// ============================================================
// 5. recalcStats() —— 从 history 重算 stats 一致性
// ============================================================
suite('5. recalcStats() —— 统计重算（数据一致性 / 导入修复关键）', { beforeEach: reset }, () => {
  test('空 history → stats 归零 + cats 为空对象', () => {
    const d = App.db.get();
    d.stats = { total: 9999, correct: 9998, cats: { 专辑: { t: 99, c: 99 } } };
    d.history = [];
    App.db.recalcStats();
    const s = App.db.get().stats;
    assert.strictEqual(s.total, 0);
    assert.strictEqual(s.correct, 0);
    // 跨 vm 上下文对象无法用 deepStrictEqual，用 keys 长度判断空对象
    assert.strictEqual(Object.keys(s.cats).length, 0, 'cats 应为空对象（Object.keys 为空）');
  });

  test('混合答题记录 → total/correct/cats 正确重算', () => {
    const d = App.db.get();
    const now = Date.now();
    d.history = [
      { qid: '001', ok: true,  time: now },
      { qid: '001', ok: false, time: now + 1 },
      { qid: '002', ok: true,  time: now + 2 },
      { qid: '002', ok: true,  time: now + 3 },
      { qid: '061', ok: true,  time: now + 4 },
      { qid: '__no_q__', ok: true, time: now + 5 },
    ];
    d.stats = { total: 0, correct: 0, cats: {} };
    App.db.recalcStats();
    const s = App.db.get().stats;
    assert.strictEqual(s.total, 6);
    assert.strictEqual(s.correct, 5);
    assert.strictEqual(s.cats['专辑'].t, 2);
    assert.strictEqual(s.cats['专辑'].c, 1);
    assert.strictEqual(s.cats['歌曲'].t, 2);
    assert.strictEqual(s.cats['歌曲'].c, 2);
    assert.strictEqual(s.cats['个人信息'].t, 1);
    assert.strictEqual(s.cats['个人信息'].c, 1);
    assert.strictEqual(Object.keys(s.cats).length, 3);
  });
});

// ============================================================
// 6. 间隔重复（SRS）
// ============================================================
suite('6. 间隔重复算法（addWrong / reviewCorrect / reviewWrong / getDueWrong）', { beforeEach: reset }, () => {
  const now = Date.now();
  const HR = 3600000, DAY = 86400000;

  test('addWrong 首次新增错题：cnt=1, level=0, nextReview=立即', () => {
    App.db.addWrong('001');
    const w = App.db.getWrong()[0];
    assert.strictEqual(w.qid, '001');
    assert.strictEqual(w.cnt, 1);
    assert.strictEqual(w.level, 0);
    assert.ok(w.nextReview <= now + 1000, '立即可复习');
    assert.ok(w.time > 0);
  });

  test('addWrong 重复答错同一题：cnt++, level 重置为 0, nextReview 立即', () => {
    App.db.addWrong('001');
    let w = App.db.getWrong()[0];
    w.level = 3;
    w.nextReview = now + 99 * DAY;
    const origCnt = w.cnt;
    const origTime = w.time;
    App.db.addWrong('001');
    w = App.db.getWrong()[0];
    assert.strictEqual(w.cnt, origCnt + 1);
    assert.strictEqual(w.level, 0);
    assert.ok(w.nextReview <= now + 1000);
    assert.strictEqual(w.time, origTime);
  });

  test('reviewCorrect：等级依次提升，nextReview 对应 SR_INTERVALS', () => {
    App.db.addWrong('001');
    const intervals = [0, 1 * HR, 1 * DAY, 3 * DAY, 7 * DAY];
    for (let i = 1; i <= 4; i++) {
      const before = Date.now();
      const r = App.db.reviewCorrect('001');
      assert.strictEqual(r.mastered, false);
      assert.strictEqual(r.level, i);
      assert.strictEqual(r.qid, '001');
      const w = App.db.getWrong()[0];
      assert.strictEqual(w.level, i);
      const expect = before + intervals[i];
      assert.ok(Math.abs(w.nextReview - expect) < 100,
        `Lv${i} 间隔应 ${intervals[i]}ms，差 ${Math.abs(w.nextReview - expect)}ms`);
    }
    const r5 = App.db.reviewCorrect('001');
    assert.strictEqual(r5.mastered, true);
    assert.strictEqual(r5.qid, '001');
    assert.strictEqual(App.db.getWrong().length, 0);
  });

  test('reviewCorrect 对不存在的 qid：返回 {mastered:false, qid} 不崩溃', () => {
    const r = App.db.reviewCorrect('__no__');
    // 跨 vm 上下文对象，逐一断言属性而非 deepStrictEqual
    assert.strictEqual(r.mastered, false);
    assert.strictEqual(r.qid, '__no__');
    assert.strictEqual(Object.keys(r).length, 2, '返回对象仅含 mastered + qid 两键');
  });

  test('reviewWrong：等级→0，cnt++，nextReview 立即', () => {
    App.db.addWrong('001');
    App.db.reviewCorrect('001');
    App.db.reviewCorrect('001');
    App.db.reviewCorrect('001');
    App.db.reviewCorrect('001');
    let w = App.db.getWrong()[0];
    assert.strictEqual(w.level, 4);
    const before = Date.now();
    App.db.reviewWrong('001');
    w = App.db.getWrong()[0];
    assert.strictEqual(w.level, 0);
    assert.strictEqual(w.cnt, 2);
    assert.ok(w.nextReview <= before + 1000);
  });

  test('reviewWrong 对不存在的 qid：自动 addWrong 新增', () => {
    assert.strictEqual(App.db.getWrong().length, 0, 'beforeEach reset 后错题本应空');
    App.db.reviewWrong('002');
    const wl = App.db.getWrong();
    assert.strictEqual(wl.length, 1, '调用 reviewWrong(不存在) 应新增');
    assert.strictEqual(wl[0].qid, '002');
    assert.strictEqual(wl[0].level, 0);
    assert.strictEqual(wl[0].cnt, 1);
  });

  test('removeWrong / getWrong', () => {
    App.db.addWrong('001');
    App.db.addWrong('002');
    assert.strictEqual(App.db.getWrong().length, 2);
    App.db.removeWrong('001');
    const wl = App.db.getWrong();
    assert.strictEqual(wl.length, 1);
    assert.strictEqual(wl[0].qid, '002');
  });

  test('getDueWrong：只返回 nextReview<=now 或缺省的错题', () => {
    App.db.addWrong('001');
    App.db.addWrong('002');
    const w2 = App.db.getWrong().find(w => w.qid === '002');
    w2.nextReview = now + 99 * DAY;
    App.db.get().wrong.push({
      qid: '003', cnt: 1, level: 0, time: now, lastReview: 0,
      // 没有 nextReview
    });
    const due = App.db.getDueWrong();
    // sandbox 数组转主上下文数组后用 JSON 化比较（避免跨上下文原型不等）
    const dueIds = Array.from(due.map(w => w.qid)).sort();
    const expected = ['001', '003'];
    assert.strictEqual(JSON.stringify(dueIds), JSON.stringify(expected),
      '到期的应是 001(立即)+003(缺省)，002(远期) 不应出现。实际: ' + JSON.stringify(dueIds));
  });
});

// ============================================================
// 7. Session 会话管理
// ============================================================
suite('7. App.session —— 答题中断恢复会话', { beforeEach: reset }, () => {
  test('未保存时 load 返回 null', () => {
    assert.strictEqual(App.session.load(), null);
  });

  test('save 后 load 返回一致数据（序列化往返）', () => {
    const fakeState = {
      quiz: [{ id: '001' }, { id: '002' }, { id: '003' }],
      idx: 1,
      correctCount: 0,
      startTime: 1700000000000,
      mode: 'standard',
      isWrongBookQuiz: false,
    };
    App.session.save(fakeState);
    const loaded = App.session.load();
    assert.ok(loaded);
    assert.deepStrictEqual(loaded.quizIds, ['001', '002', '003']);
    assert.strictEqual(loaded.idx, 1);
    assert.strictEqual(loaded.correctCount, 0);
    assert.strictEqual(loaded.startTime, 1700000000000);
    assert.strictEqual(loaded.mode, 'standard');
    assert.strictEqual(loaded.isWrongBookQuiz, false);
  });

  test('clear 后 load 返回 null', () => {
    App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
    assert.notStrictEqual(App.session.load(), null);
    App.session.clear();
    assert.strictEqual(App.session.load(), null);
  });

  test('sessionStorage 损坏（非 JSON）时 load 返回 null，不崩溃', () => {
    sessionStorage.setItem('jj_quiz_session', '{{{{invalid json');
    assert.strictEqual(App.session.load(), null);
  });

  test('无 sessionStorage（兼容环境）时 save/load 不崩溃', () => {
    assert.doesNotThrow(() => {
      App.session.save({ quiz: [], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
    });
  });
});

// ============================================================
// helper
// ============================================================
function sameDayStr(dateKey, timestamp) {
  const dt = new Date(timestamp);
  const key = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
  return dateKey === key;
}

summary();
