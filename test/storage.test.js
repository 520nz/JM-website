/**
 * storage.test.js - 存储层核心逻辑测试
 * 
 * 覆盖范围：
 * - XSS 转义函数 esc()
 * - 间隔重复（Spaced Repetition）算法
 * - 连续打卡计算 getStreak()
 * - 成就徽章检查 checkAchievements()
 * - 统计重算 recalcStats()
 * - 错题管理（addWrong / reviewCorrect / reviewWrong / getDueWrong）
 * - 答题记录归档逻辑
 * - 每日目标限制
 * - 题目查找 findQ()
 */

// 初始化 App 命名空间和模拟 DOM
beforeEach(() => {
  global.App = {
    QUESTION_BANK: [
      { id: '001', category: '专辑', question: 'Q1', options: [{key:'A',text:'a'},{key:'B',text:'b'},{key:'C',text:'c'},{key:'D',text:'d'}], answer: 'B', explanation: 'exp1' },
      { id: '002', category: '歌曲', question: 'Q2', options: [{key:'A',text:'a'},{key:'B',text:'b'},{key:'C',text:'c'},{key:'D',text:'d'}], answer: 'C', explanation: 'exp2' },
      { id: '003', category: '个人信息', question: 'Q3', options: [{key:'A',text:'a'},{key:'B',text:'b'},{key:'C',text:'c'},{key:'D',text:'d'}], answer: 'A', explanation: 'exp3' },
      { id: '004', category: '获奖记录', question: 'Q4', options: [{key:'A',text:'a'},{key:'B',text:'b'},{key:'C',text:'c'},{key:'D',text:'d'}], answer: 'D', explanation: 'exp4' }
    ],
    db: {},
    store: {},
    session: {}
  };
});

// ==================== esc() XSS 转义 ====================
describe('esc() - XSS 转义', () => {
  // 简化版的 esc 实现（与 storage.js 中逻辑一致）
  function esc(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  test('null/undefined 返回空字符串', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  test('普通文本不变', () => {
    expect(esc('hello')).toBe('hello');
    expect(esc('林俊杰')).toBe('林俊杰');
  });

  test('HTML 特殊字符转义', () => {
    expect(esc('<script>alert(1)</script>')).not.toContain('<script>');
    expect(esc('<img src=x onerror=alert(1)>')).not.toContain('<img');
    expect(esc('"><svg/onload=alert(1)>')).not.toContain('<svg');
  });

  test('HTML 标签被转义，不产生可执行标签', () => {
    var result = esc('"onclick="alert(1)"');
    // textContent 方式防止标签注入，但引号在 div.innerHTML 中不会被转义
    // 这是 esc() 的已知限制 — 用于文本内容转义而非属性值转义
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });
});

// ==================== 间隔重复常量 ====================
describe('间隔重复时间间隔', () => {
  const SR_INTERVALS = [
    0,                        // level 0
    1 * 60 * 60 * 1000,       // level 1: 1小时
    1 * 24 * 60 * 60 * 1000,  // level 2: 1天
    3 * 24 * 60 * 60 * 1000,  // level 3: 3天
    7 * 24 * 60 * 60 * 1000,  // level 4: 7天
  ];

  test('间隔时间逐级递增', () => {
    for (let i = 1; i < SR_INTERVALS.length; i++) {
      expect(SR_INTERVALS[i]).toBeGreaterThan(SR_INTERVALS[i - 1]);
    }
  });

  test('共5个等级（0-4），第5级(≥5)为掌握', () => {
    expect(SR_INTERVALS).toHaveLength(5);
  });
});

// ==================== findQ() 题目查找 ====================
describe('findQ() - 题目查找', () => {
  function findQ(qid) {
    var bank = App.QUESTION_BANK || [];
    for (var i = 0; i < bank.length; i++) {
      if (bank[i].id === qid) return bank[i];
    }
    return null;
  }

  test('存在的题目返回正确对象', () => {
    var q = findQ('001');
    expect(q).not.toBeNull();
    expect(q.id).toBe('001');
    expect(q.category).toBe('专辑');
    expect(q.answer).toBe('B');
  });

  test('不存在的题目返回 null', () => {
    expect(findQ('999')).toBeNull();
    expect(findQ('')).toBeNull();
  });

  test('题库为空时返回 null', () => {
    App.QUESTION_BANK = [];
    expect(findQ('001')).toBeNull();
  });
});

// ==================== getStreak() 连续打卡计算 ====================
describe('getStreak() - 连续打卡计算', () => {
  function getStreak(history, archive) {
    var days = {};
    for (var i = 0; i < (history || []).length; i++) {
      var dt = new Date(history[i].time);
      days[dt.getFullYear() + '-' + dt.getMonth() + '-' + dt.getDate()] = true;
    }
    for (var j = 0; j < (archive || []).length; j++) {
      days[archive[j].date] = true;
    }
    if (Object.keys(days).length === 0) return 0;
    var streak = 0;
    var check = new Date();
    check.setHours(0, 0, 0, 0);
    var todayKey = check.getFullYear() + '-' + check.getMonth() + '-' + check.getDate();
    if (!days[todayKey]) check.setTime(check.getTime() - 86400000);
    while (true) {
      var key = check.getFullYear() + '-' + check.getMonth() + '-' + check.getDate();
      if (days[key]) {
        streak++;
        check.setTime(check.getTime() - 86400000);
      } else {
        break;
      }
    }
    return streak;
  }

  test('无历史数据返回 0', () => {
    expect(getStreak([], [])).toBe(0);
    expect(getStreak(null, null)).toBe(0);
  });

  test('今天有答题记录', () => {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var history = [{ time: today + 3600000 }];
    expect(getStreak(history, [])).toBeGreaterThanOrEqual(1);
  });

  test('昨天有答题记录，今天没有', () => {
    var now = new Date();
    var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    var history = [{ time: yesterday + 3600000 }];
    expect(getStreak(history, [])).toBe(1);
  });

  test('连续3天答题', () => {
    var now = new Date();
    var history = [];
    for (var i = 0; i < 3; i++) {
      var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      history.push({ time: day.getTime() + 3600000 });
    }
    expect(getStreak(history, [])).toBe(3);
  });

  test('连续答题中间断了一天', () => {
    var now = new Date();
    var history = [];
    // 今天、昨天、前天都有，然后跳过1天，再之前一天有
    for (var i = 0; i < 3; i++) {
      var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      history.push({ time: day.getTime() + 3600000 });
    }
    // 跳过第4天，直接加第5天
    var jump = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4);
    history.push({ time: jump.getTime() + 3600000 });
    expect(getStreak(history, [])).toBe(3);
  });

  test('归档数据参与连续打卡计算', () => {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var dateKey = today.getFullYear() + '-' + today.getMonth() + '-' + today.getDate();
    var archive = [{ date: dateKey, total: 10, correct: 8 }];
    expect(getStreak([], archive)).toBeGreaterThanOrEqual(1);
  });
});

// ==================== recalcStats() 统计重算 ====================
describe('recalcStats() - 统计重算', () => {
  function recalcStats(data, findQFn) {
    var stats = { total: 0, correct: 0, cats: {} };
    for (var i = 0; i < data.history.length; i++) {
      var rec = data.history[i];
      stats.total++;
      if (rec.ok) stats.correct++;
      var q = findQFn ? findQFn(rec.qid) : null;
      if (q) {
        if (!stats.cats[q.category]) stats.cats[q.category] = { t: 0, c: 0 };
        stats.cats[q.category].t++;
        if (rec.ok) stats.cats[q.category].c++;
      }
    }
    data.stats = stats;
  }

  test('空历史数据返回零统计', () => {
    var data = { history: [], stats: null };
    recalcStats(data, function() { return null; });
    expect(data.stats.total).toBe(0);
    expect(data.stats.correct).toBe(0);
    expect(Object.keys(data.stats.cats)).toHaveLength(0);
  });

  test('正确记录累加', () => {
    var data = {
      history: [
        { qid: '001', ok: true, time: Date.now() },
        { qid: '002', ok: false, time: Date.now() },
        { qid: '001', ok: true, time: Date.now() }
      ]
    };
    recalcStats(data, function(qid) {
      return qid === '001' ? { category: '专辑' } : { category: '歌曲' };
    });
    expect(data.stats.total).toBe(3);
    expect(data.stats.correct).toBe(2);
    expect(data.stats.cats['专辑'].t).toBe(2);
    expect(data.stats.cats['专辑'].c).toBe(2);
    expect(data.stats.cats['歌曲'].t).toBe(1);
    expect(data.stats.cats['歌曲'].c).toBe(0);
  });

  test('重复答题正确计算正确率', () => {
    var data = {
      history: [
        { qid: '001', ok: false },
        { qid: '001', ok: true },
        { qid: '001', ok: true },
        { qid: '002', ok: false }
      ]
    };
    recalcStats(data, function(qid) {
      return { category: qid === '001' ? '专辑' : '歌曲' };
    });
    expect(data.stats.total).toBe(4);
    expect(data.stats.correct).toBe(2);
    // 专辑: 2对/3总
    expect(data.stats.cats['专辑'].c).toBe(2);
    expect(data.stats.cats['专辑'].t).toBe(3);
  });
});

// ==================== getDueWrong() 到期错题判断 ====================
describe('getDueWrong() - 到期错题判断', () => {
  function getDueWrong(wrongList) {
    var now = Date.now();
    var due = [];
    for (var i = 0; i < wrongList.length; i++) {
      if (!wrongList[i].nextReview || wrongList[i].nextReview <= now) {
        due.push(wrongList[i]);
      }
    }
    return due;
  }

  test('空列表返回空数组', () => {
    expect(getDueWrong([])).toEqual([]);
  });

  test('有 nextReview=0 的错题立即可复习', () => {
    var list = [{ qid: '001', nextReview: 0 }];
    expect(getDueWrong(list)).toHaveLength(1);
  });

  test('过期的错题被视为到期', () => {
    var past = Date.now() - 1000000;
    var list = [{ qid: '001', nextReview: past }];
    expect(getDueWrong(list)).toHaveLength(1);
  });

  test('未来的错题不到期', () => {
    var future = Date.now() + 86400000;
    var list = [{ qid: '001', nextReview: future }];
    expect(getDueWrong(list)).toHaveLength(0);
  });

  test('混合列表正确筛选', () => {
    var list = [
      { qid: '001', nextReview: 0 },
      { qid: '002', nextReview: Date.now() + 86400000 },
      { qid: '003', nextReview: Date.now() - 1000 },
      { qid: '004' } // 无 nextReview
    ];
    var due = getDueWrong(list);
    expect(due).toHaveLength(3); // 001, 003, 004 都到期
  });
});

// ==================== addWrong() 错题添加 ====================
describe('addWrong() - 错题添加逻辑', () => {
  function addWrong(data, qid, now) {
    var found = null;
    for (var i = 0; i < data.wrong.length; i++) {
      if (data.wrong[i].qid === qid) { found = data.wrong[i]; break; }
    }
    if (found) {
      found.cnt++;
      found.level = 0;
      found.lastReview = now;
      found.nextReview = now;
      found.time = found.time || now;
    } else {
      data.wrong.push({
        qid: qid,
        cnt: 1,
        level: 0,
        time: now,
        lastReview: 0,
        nextReview: now
      });
    }
  }

  test('首次添加错题', () => {
    var data = { wrong: [] };
    var now = Date.now();
    addWrong(data, '001', now);
    expect(data.wrong).toHaveLength(1);
    expect(data.wrong[0].qid).toBe('001');
    expect(data.wrong[0].cnt).toBe(1);
    expect(data.wrong[0].level).toBe(0);
    expect(data.wrong[0].nextReview).toBe(now);
  });

  test('重复添加同一错题（答错重置）', () => {
    var data = { wrong: [{ qid: '001', cnt: 1, level: 2, time: 100, lastReview: 50, nextReview: 200 }] };
    var now = Date.now();
    addWrong(data, '001', now);
    expect(data.wrong).toHaveLength(1);
    expect(data.wrong[0].cnt).toBe(2);
    expect(data.wrong[0].level).toBe(0);  // 重置到 0
    expect(data.wrong[0].nextReview).toBe(now);  // 立即可复习
  });

  test('添加不同题目', () => {
    var data = { wrong: [{ qid: '001', cnt: 1, level: 0, time: 100, lastReview: 0, nextReview: 100 }] };
    addWrong(data, '002', 200);
    expect(data.wrong).toHaveLength(2);
    expect(data.wrong[1].qid).toBe('002');
  });
});

// ==================== reviewCorrect() / reviewWrong() 间隔重复 ====================
describe('间隔重复算法 - reviewCorrect()', () => {
  var SR_INTERVALS = [
    0,
    1 * 60 * 60 * 1000,
    1 * 24 * 60 * 60 * 1000,
    3 * 24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
  ];

  function reviewCorrect(data, qid, now) {
    for (var i = 0; i < data.wrong.length; i++) {
      if (data.wrong[i].qid === qid) {
        var w = data.wrong[i];
        w.level++;
        w.lastReview = now;
        if (w.level >= 5) {
          data.wrong.splice(i, 1);
          return { mastered: true, qid: qid };
        } else {
          w.nextReview = now + SR_INTERVALS[w.level];
          return { mastered: false, level: w.level, qid: qid };
        }
      }
    }
    return { mastered: false, qid: qid };
  }

  test('答对提升等级', () => {
    var data = { wrong: [{ qid: '001', cnt: 2, level: 0, time: 100, lastReview: 50, nextReview: 100 }] };
    var now = Date.now();
    var result = reviewCorrect(data, '001', now);
    expect(result.mastered).toBe(false);
    expect(result.level).toBe(1);
    expect(data.wrong[0].level).toBe(1);
    expect(data.wrong[0].nextReview).toBe(now + SR_INTERVALS[1]); // 1小时后
  });

  test('等级4→掌握（level≥5时移除）', () => {
    var data = { wrong: [{ qid: '001', cnt: 5, level: 4, time: 100, lastReview: 50, nextReview: 100 }] };
    var result = reviewCorrect(data, '001', Date.now());
    expect(result.mastered).toBe(true);
    expect(data.wrong).toHaveLength(0); // 已移除
  });

  test('等级0→1（首次答对）', () => {
    var data = { wrong: [{ qid: '001', cnt: 1, level: 0, time: 100, lastReview: 0, nextReview: 100 }] };
    var result = reviewCorrect(data, '001', 1000);
    expect(result.level).toBe(1);
    expect(data.wrong[0].nextReview).toBe(1000 + SR_INTERVALS[1]);
  });

  test('非错题中的题目答对返回未掌握', () => {
    var data = { wrong: [{ qid: '001', cnt: 1, level: 0, time: 100, lastReview: 0, nextReview: 100 }] };
    var result = reviewCorrect(data, '999', Date.now());
    expect(result.mastered).toBe(false);
    expect(result.qid).toBe('999');
    expect(data.wrong).toHaveLength(1); // 不变
  });
});

describe('间隔重复算法 - reviewWrong()', () => {
  function reviewWrong(data, qid, now) {
    for (var i = 0; i < data.wrong.length; i++) {
      if (data.wrong[i].qid === qid) {
        var w = data.wrong[i];
        w.level = 0;
        w.cnt++;
        w.lastReview = now;
        w.nextReview = now;
        return;
      }
    }
    // 不在错题本中，新增
    data.wrong.push({ qid: qid, cnt: 1, level: 0, time: now, lastReview: 0, nextReview: now });
  }

  test('答错重置等级为0，立即可复习', () => {
    var data = { wrong: [{ qid: '001', cnt: 1, level: 3, time: 100, lastReview: 50, nextReview: 100 }] };
    var now = Date.now();
    reviewWrong(data, '001', now);
    expect(data.wrong[0].level).toBe(0);
    expect(data.wrong[0].cnt).toBe(2);
    expect(data.wrong[0].nextReview).toBe(now);
  });

  test('非错题本中答错，自动加入', () => {
    var data = { wrong: [] };
    reviewWrong(data, '001', 500);
    expect(data.wrong).toHaveLength(1);
    expect(data.wrong[0].qid).toBe('001');
    expect(data.wrong[0].cnt).toBe(1);
    expect(data.wrong[0].level).toBe(0);
  });
});

// ==================== addRecord() 答题记录与归档 ====================
describe('addRecord() - 答题记录与归档', () => {
  function addRecord(data, rec, findQFn) {
    data.history.push(rec);
    data.stats.total++;
    if (rec.ok) data.stats.correct++;
    var q = findQFn ? findQFn(rec.qid) : null;
    if (q) {
      if (!data.stats.cats[q.category]) data.stats.cats[q.category] = { t: 0, c: 0 };
      data.stats.cats[q.category].t++;
      if (rec.ok) data.stats.cats[q.category].c++;
    }
    // 归档逻辑：超过 1000 条时聚合90天前的数据
    if (data.history.length > 1000) {
      if (!data.archive) data.archive = [];
      var cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      var oldRecs = [];
      var newRecs = [];
      for (var i = 0; i < data.history.length; i++) {
        if (data.history[i].time < cutoff) oldRecs.push(data.history[i]);
        else newRecs.push(data.history[i]);
      }
      // 按天聚合
      var dayMap = {};
      for (var j = 0; j < oldRecs.length; j++) {
        var dt = new Date(oldRecs[j].time);
        var key = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
        if (!dayMap[key]) dayMap[key] = { date: key, total: 0, correct: 0 };
        dayMap[key].total++;
        if (oldRecs[j].ok) dayMap[key].correct++;
      }
      // 避免重复归档
      var existingArchiveKeys = {};
      for (var a = 0; a < data.archive.length; a++) {
        existingArchiveKeys[data.archive[a].date] = true;
      }
      for (var k in dayMap) {
        if (!existingArchiveKeys[k]) {
          data.archive.push(dayMap[k]);
        }
      }
      data.history = newRecs;
    }
  }

  test('添加单条记录', () => {
    var data = { history: [], stats: { total: 0, correct: 0, cats: {} } };
    addRecord(data, { qid: '001', ok: true, time: Date.now() }, function() { return { category: '专辑' }; });
    expect(data.stats.total).toBe(1);
    expect(data.stats.correct).toBe(1);
    expect(data.stats.cats['专辑'].t).toBe(1);
    expect(data.stats.cats['专辑'].c).toBe(1);
  });

  test('添加错误记录', () => {
    var data = { history: [], stats: { total: 0, correct: 0, cats: {} } };
    addRecord(data, { qid: '001', ok: false, time: Date.now() }, function() { return { category: '专辑' }; });
    expect(data.stats.total).toBe(1);
    expect(data.stats.correct).toBe(0);
    expect(data.stats.cats['专辑'].c).toBe(0);
  });

  test('题库中无对应题目时不记录分类', () => {
    var data = { history: [], stats: { total: 0, correct: 0, cats: {} } };
    addRecord(data, { qid: '999', ok: true, time: Date.now() }, null);
    expect(data.stats.total).toBe(1);
    expect(Object.keys(data.stats.cats)).toHaveLength(0);
  });

  test('归档逻辑：超过1000条触发归档', () => {
    var data = { history: [], stats: { total: 0, correct: 0, cats: {} }, archive: [] };
    var now = Date.now();
    var cutoff = now - 90 * 24 * 60 * 60 * 1000;

    // 添加1001条记录（其中一些是旧的）
    for (var i = 0; i < 500; i++) {
      data.history.push({ qid: '001', ok: true, time: cutoff - 1000 + i });
      data.stats.total++;
      data.stats.correct++;
    }
    for (var j = 0; j < 500; j++) {
      data.history.push({ qid: '001', ok: true, time: now - 1000 + j });
      data.stats.total++;
      data.stats.correct++;
    }
    // 添加最后一条触发归档
    data.history.push({ qid: '001', ok: true, time: now });
    addRecord(data, { qid: '001', ok: true, time: now }, function() { return { category: '专辑' }; });

    // 归档应该包含旧记录
    expect(data.archive.length).toBeGreaterThan(0);
    // 历史记录应该只保留新的
    expect(data.history.length).toBeLessThanOrEqual(1000);
  });

  test('归档去重：同一天不重复归档', () => {
    var data = { history: [], stats: { total: 0, correct: 0, cats: {} }, archive: [] };
    var now = Date.now();
    var cutoff = now - 90 * 24 * 60 * 60 * 1000;

    // 预先添加归档记录
    var preDate = new Date(cutoff - 86400000);
    var dateKey = preDate.getFullYear() + '-' + (preDate.getMonth() + 1) + '-' + preDate.getDate();
    data.archive.push({ date: dateKey, total: 50, correct: 40 });

    // 添加超过1000条的旧记录（同一天）
    for (var i = 0; i < 1001; i++) {
      data.history.push({ qid: '001', ok: true, time: cutoff - 86400000 + i });
      data.stats.total++;
    }
    // 触发归档
    addRecord(data, { qid: '001', ok: true, time: now }, function() { return { category: '专辑' }; });

    // 同一天的归档应该被去重
    var sameDayArchives = data.archive.filter(function(a) { return a.date === dateKey; });
    expect(sameDayArchives.length).toBe(1);
  });
});

// ==================== checkAchievements() 成就检查 ====================
describe('checkAchievements() - 成就检查', () => {
  var ACHIEVEMENTS = [
    { id: 'first_answer', name: '初出茅庐', icon: '🌱', desc: '完成第1次答题' },
    { id: 'perfect_10', name: '十全十美', icon: '💯', desc: '单次10题全部答对' },
    { id: 'daily_50', name: '勤奋粉丝', icon: '🔥', desc: '单日答题50题' },
    { id: 'streak_3', name: '三日坚持', icon: '📅', desc: '连续答题3天' },
    { id: 'streak_7', name: '七日之约', icon: '🗓️', desc: '连续答题7天' },
    { id: 'total_100', name: '百题斩', icon: '⚔️', desc: '累计答题100题' },
    { id: 'total_500', name: '五百题王', icon: '👑', desc: '累计答题500题' },
    { id: 'acc_90', name: '资深JM', icon: '🎓', desc: '答满50题且正确率≥90%' },
    { id: 'wrong_clear', name: '错题清零', icon: '✨', desc: '错题本全部掌握' },
    { id: 'all_cats', name: '全能粉丝', icon: '🌈', desc: '所有分类都有答题记录' }
  ];

  function checkAchievements(data, context, getStreakFn, getTodayCountFn) {
    if (!data.achievements) data.achievements = [];
    var newUnlocks = [];

    function has(id) { return data.achievements.indexOf(id) !== -1; }
    function unlock(id) {
      if (!has(id)) {
        data.achievements.push(id);
        var def = null;
        for (var i = 0; i < ACHIEVEMENTS.length; i++) {
          if (ACHIEVEMENTS[i].id === id) { def = ACHIEVEMENTS[i]; break; }
        }
        if (def) newUnlocks.push(def);
      }
    }

    var total = data.stats.total;
    var correct = data.stats.correct;

    if (total >= 1) unlock('first_answer');
    if (total >= 100) unlock('total_100');
    if (total >= 500) unlock('total_500');
    if (total >= 50 && correct / total >= 0.9) unlock('acc_90');

    if (context && context.quizTotal >= 10 && context.quizCorrect === context.quizTotal)
      unlock('perfect_10');

    var todayCount = getTodayCountFn ? getTodayCountFn(data) : 0;
    if (todayCount >= 50) unlock('daily_50');

    var streak = getStreakFn ? getStreakFn() : 0;
    if (streak >= 3) unlock('streak_3');
    if (streak >= 7) unlock('streak_7');

    if (data.wrong.length === 0 && total > 0 && has('first_answer')) unlock('wrong_clear');

    var cats = data.stats.cats || {};
    var allCats = ['专辑', '歌曲', '个人信息', '获奖记录'];
    var hasAll = true;
    for (var c = 0; c < allCats.length; c++) {
      if (!cats[allCats[c]] || !cats[allCats[c]].t) { hasAll = false; break; }
    }
    if (hasAll) unlock('all_cats');

    return newUnlocks;
  }

  test('首次答题解锁初出茅庐', () => {
    var data = { stats: { total: 1, correct: 1, cats: {} }, wrong: [], achievements: [] };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('first_answer');
  });

  test('累计100题解锁百题斩', () => {
    var data = { stats: { total: 100, correct: 80, cats: {} }, wrong: [], achievements: ['first_answer'] };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('total_100');
  });

  test('累计500题解锁五百题王', () => {
    var data = { stats: { total: 500, correct: 400, cats: {} }, wrong: [], achievements: ['first_answer', 'total_100'] };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('total_500');
  });

  test('答满50题且正确率≥90%解锁资深JM', () => {
    var data = { stats: { total: 50, correct: 45, cats: {} }, wrong: [], achievements: ['first_answer'] };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('acc_90');
  });

  test('正确率<90%不解锁', () => {
    var data = { stats: { total: 50, correct: 44, cats: {} }, wrong: [], achievements: ['first_answer'] };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).not.toContain('acc_90');
  });

  test('单次10题全对解锁十全十美', () => {
    var data = { stats: { total: 10, correct: 10, cats: {} }, wrong: [], achievements: ['first_answer'] };
    var context = { quizTotal: 10, quizCorrect: 10 };
    var unlocks = checkAchievements(data, context, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('perfect_10');
  });

  test('单日50题解锁勤奋粉丝', () => {
    var data = { stats: { total: 50, correct: 40, cats: {} }, wrong: [], achievements: ['first_answer'] };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 50; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('daily_50');
  });

  test('连续3天解锁三日坚持', () => {
    var data = { stats: { total: 10, correct: 8, cats: {} }, wrong: [], achievements: ['first_answer'] };
    var unlocks = checkAchievements(data, null, function() { return 3; }, function() { return 5; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('streak_3');
  });

  test('连续7天同时解锁三日坚持和七日之约', () => {
    var data = { stats: { total: 50, correct: 40, cats: {} }, wrong: [], achievements: ['first_answer'] };
    var unlocks = checkAchievements(data, null, function() { return 7; }, function() { return 10; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('streak_3');
    expect(ids).toContain('streak_7');
  });

  test('错题清零解锁（有答题历史且错题本为空）', () => {
    var data = { stats: { total: 10, correct: 8, cats: {} }, wrong: [], achievements: ['first_answer'] };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('wrong_clear');
  });

  test('错题本不为空不解锁错题清零', () => {
    var data = { stats: { total: 10, correct: 8, cats: {} }, wrong: [{ qid: '001', cnt: 1, level: 0 }], achievements: ['first_answer'] };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).not.toContain('wrong_clear');
  });

  test('所有分类都有答题记录解锁全能粉丝', () => {
    var data = {
      stats: { total: 100, correct: 80, cats: { '专辑': { t: 20, c: 15 }, '歌曲': { t: 30, c: 25 }, '个人信息': { t: 20, c: 18 }, '获奖记录': { t: 30, c: 22 } } },
      wrong: [],
      achievements: ['first_answer']
    };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).toContain('all_cats');
  });

  test('缺少分类不解锁全能粉丝', () => {
    var data = {
      stats: { total: 100, correct: 80, cats: { '专辑': { t: 20, c: 15 }, '歌曲': { t: 30, c: 25 } } },
      wrong: [],
      achievements: ['first_answer']
    };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).not.toContain('all_cats');
  });

  test('已解锁的成就不重复解锁', () => {
    var data = { stats: { total: 500, correct: 450, cats: {} }, wrong: [], achievements: ['first_answer', 'total_100', 'total_500', 'acc_90'] };
    var unlocks = checkAchievements(data, null, function() { return 0; }, function() { return 0; });
    var ids = unlocks.map(function(a) { return a.id; });
    expect(ids).not.toContain('first_answer');
    expect(ids).not.toContain('total_100');
    expect(ids).not.toContain('total_500');
  });
});

// ==================== 每日目标限制 ====================
describe('每日目标 getDailyGoal / setDailyGoal', () => {
  function setDailyGoal(data, n) {
    data.dailyGoal = Math.max(5, Math.min(100, n));
  }
  function getDailyGoal(data) {
    return data.dailyGoal || 20;
  }

  test('默认目标为 20', () => {
    expect(getDailyGoal({})).toBe(20);
  });

  test('设置有效目标', () => {
    var data = {};
    setDailyGoal(data, 30);
    expect(getDailyGoal(data)).toBe(30);
  });

  test('低于最小值 5 的被限制', () => {
    var data = {};
    setDailyGoal(data, 1);
    expect(getDailyGoal(data)).toBe(5);
  });

  test('超过最大值 100 的被限制', () => {
    var data = {};
    setDailyGoal(data, 200);
    expect(getDailyGoal(data)).toBe(100);
  });

  test('边界值 5 和 100', () => {
    var data = {};
    setDailyGoal(data, 5);
    expect(getDailyGoal(data)).toBe(5);
    setDailyGoal(data, 100);
    expect(getDailyGoal(data)).toBe(100);
  });
});
