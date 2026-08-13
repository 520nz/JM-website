import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  global.window.App = {};
  global.App = global.window.App;

  loadScript('js/data.js');
  loadScript('js/storage.js');

  // 绕过 init()，直接让 defaults 成为内存缓存
  App.db.setData(App.db.defaults());
});

// -----------------------------------------------------------------------
// esc — XSS 转义纯函数
// -----------------------------------------------------------------------
describe('esc — XSS 转义', () => {
  it('转义 <script> 标签', () => {
    const raw = '<script>alert(1)</script>';
    expect(App.esc(raw)).not.toContain('<script>');
    expect(App.esc(raw)).not.toContain('</script>');
  });

  it('转义 HTML 属性中的引号与尖括号', () => {
    const raw = '"><img src=x onerror=alert(1)>';
    const out = App.esc(raw);
    // esc 用 textContent 写入，尖括号会被实体化，不会作为标签执行
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).toContain('onerror'); // 纯文本内容被保留
  });

  it('null / undefined 输出空串', () => {
    expect(App.esc(null)).toBe('');
    expect(App.esc(undefined)).toBe('');
  });

  it('数字 / 布尔会被转为字符串', () => {
    expect(App.esc(0)).toBe('0');
    expect(App.esc(true)).toBe('true');
  });

  it('保留普通文本', () => {
    expect(App.esc('林俊杰')).toBe('林俊杰');
    expect(App.esc('2023-04-21')).toBe('2023-04-21');
  });
});

// -----------------------------------------------------------------------
// findQ — 按 id 查找题库题目
// -----------------------------------------------------------------------
describe('findQ', () => {
  it('返回存在的题目', () => {
    const q = App.db.findQ('001');
    expect(q).not.toBeNull();
    expect(q.category).toBe('专辑');
    expect(q.question).toContain('乐行者');
  });

  it('返回 null 对于不存在的 id', () => {
    expect(App.db.findQ('999')).toBeNull();
    expect(App.db.findQ('')).toBeNull();
  });
});

// -----------------------------------------------------------------------
// addRecord — 答题记录入库、stats 聚合、历史归档
// -----------------------------------------------------------------------
describe('addRecord', () => {
  it('累加 total / correct / cats', () => {
    App.db.addRecord({ qid: '001', ok: true, time: Date.now() });
    App.db.addRecord({ qid: '002', ok: false, time: Date.now() });
    const d = App.db.get();
    expect(d.stats.total).toBe(2);
    expect(d.stats.correct).toBe(1);
    expect(d.stats.cats['专辑'].t).toBe(1);
    expect(d.stats.cats['专辑'].c).toBe(1);
    expect(d.stats.cats['歌曲'].t).toBe(1);
    expect(d.stats.cats['歌曲'].c).toBe(0);
  });

  it('history 超过 1000 条时触发归档聚合', () => {
    const d = App.db.get();
    // 预填 1001 条旧记录（90 天前）+ 1 条新记录
    const oldTime = Date.now() - 100 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 1001; i++) {
      d.history.push({ qid: '001', ok: i % 2 === 0, time: oldTime + i * 1000 });
    }
    // 新增触发归档
    App.db.addRecord({ qid: '001', ok: true, time: Date.now() });

    const after = App.db.get();
    // 旧数据被聚合进 archive，history 只剩新数据
    expect(after.history.length).toBeLessThan(1000);
    expect(after.archive.length).toBeGreaterThan(0);
    // 归档条目包含 date / total / correct
    const first = after.archive[0];
    expect(first).toHaveProperty('date');
    expect(first).toHaveProperty('total');
    expect(first).toHaveProperty('correct');
  });

  it('重复归档同一天不会重复聚合（去重）', () => {
    const d = App.db.get();
    const oldTime = Date.now() - 100 * 24 * 60 * 60 * 1000;
    // 第一次触发归档
    for (let i = 0; i < 1001; i++) {
      d.history.push({ qid: '001', ok: true, time: oldTime + i * 1000 });
    }
    App.db.addRecord({ qid: '001', ok: true, time: Date.now() });
    const firstArchiveLen = App.db.get().archive.length;

    // 再触发一次 —— 同一天的归档应合并而不是追加
    const d2 = App.db.get();
    // 把 archive 里的日期回塞 history 模拟再次超阈值
    d2.history = d2.history.concat(
      d2.archive.flatMap((a) =>
        Array.from({ length: a.total }, () => ({
          qid: '001',
          ok: true,
          time: new Date(a.date).getTime() + Date.now() % 1000,
        }))
      )
    );
    while (d2.history.length < 1001) {
      d2.history.push({ qid: '001', ok: true, time: oldTime });
    }
    App.db.addRecord({ qid: '001', ok: true, time: Date.now() });
    // archive 长度不应翻倍增长（同一天只会聚合一次）
    expect(App.db.get().archive.length).toBeLessThanOrEqual(firstArchiveLen + 2);
  });
});

// -----------------------------------------------------------------------
// 间隔重复（SR）状态机：addWrong / reviewCorrect / reviewWrong / getDueWrong
// -----------------------------------------------------------------------
describe('间隔重复状态机', () => {
  it('addWrong — 首次加入生成 level 0', () => {
    App.db.addWrong('001');
    const w = App.db.getWrong().find((x) => x.qid === '001');
    expect(w).toBeTruthy();
    expect(w.cnt).toBe(1);
    expect(w.level).toBe(0);
    expect(w.nextReview).toBeLessThanOrEqual(Date.now());
  });

  it('addWrong — 重复错误重置 level 为 0 并累加 cnt', () => {
    App.db.addWrong('001');
    App.db.reviewCorrect('001'); // Lv 1
    App.db.reviewCorrect('001'); // Lv 2
    App.db.addWrong('001'); // 再错
    const w = App.db.getWrong().find((x) => x.qid === '001');
    expect(w.level).toBe(0);
    expect(w.cnt).toBe(2);
  });

  it('reviewCorrect — level 1→4 逐级提升并设置下次复习时间', () => {
    App.db.addWrong('001');
    for (let lv = 1; lv <= 4; lv++) {
      const r = App.db.reviewCorrect('001');
      expect(r.mastered).toBe(false);
      expect(r.level).toBe(lv);
    }
    const w = App.db.getWrong().find((x) => x.qid === '001');
    // level 4 对应 7 天后
    expect(w.nextReview - w.lastReview).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 100);
  });

  it('reviewCorrect — level ≥ 5 时掌握并从错题本移除', () => {
    App.db.addWrong('001');
    // Lv 0→1→2→3→4→5
    let r;
    for (let i = 0; i < 5; i++) r = App.db.reviewCorrect('001');
    expect(r.mastered).toBe(true);
    expect(r.qid).toBe('001');
    expect(App.db.getWrong().find((x) => x.qid === '001')).toBeUndefined();
  });

  it('reviewWrong — 错题本中已有，重置 level / cnt', () => {
    App.db.addWrong('001');
    App.db.reviewCorrect('001'); // Lv 1
    App.db.reviewWrong('001');
    const w = App.db.getWrong().find((x) => x.qid === '001');
    expect(w.level).toBe(0);
    expect(w.cnt).toBe(2);
    expect(w.nextReview).toBeLessThanOrEqual(Date.now());
  });

  it('reviewWrong — 错题本中没有，自动新增', () => {
    App.db.reviewWrong('002');
    const w = App.db.getWrong().find((x) => x.qid === '002');
    expect(w).toBeTruthy();
    expect(w.cnt).toBe(1);
    expect(w.level).toBe(0);
  });

  it('reviewCorrect — 错题本中不存在，返回 mastered:false', () => {
    const r = App.db.reviewCorrect('999');
    expect(r.mastered).toBe(false);
  });

  it('getDueWrong — 只返回到期（nextReview <= now 或 null/0）的错题', () => {
    App.db.addWrong('001'); // nextReview = now → 到期
    // 造一个"未到期"
    const d = App.db.get();
    d.wrong.push({ qid: '002', cnt: 1, level: 1, time: Date.now(), lastReview: Date.now(), nextReview: Date.now() + 3600 * 1000 });

    const due = App.db.getDueWrong();
    const ids = due.map((x) => x.qid);
    expect(ids).toContain('001');
    expect(ids).not.toContain('002');
  });

  it('removeWrong — 直接移除错题', () => {
    App.db.addWrong('001');
    App.db.removeWrong('001');
    expect(App.db.getWrong().length).toBe(0);
  });
});

// -----------------------------------------------------------------------
// recalcStats — 从 history 重建 stats（导入数据后的修复逻辑）
// -----------------------------------------------------------------------
describe('recalcStats', () => {
  it('用 history 覆盖 stats.total / correct / cats', () => {
    const d = App.db.get();
    // 先注入错误的 stats
    d.stats = { total: 9999, correct: 9998, cats: { 歌曲: { t: 500, c: 1 } } };
    // 再放 history
    d.history = [
      { qid: '001', ok: true, time: Date.now() }, // 专辑
      { qid: '002', ok: false, time: Date.now() }, // 歌曲
      { qid: '003', ok: true, time: Date.now() }, // 歌曲
    ];
    App.db.recalcStats();

    const after = App.db.get();
    expect(after.stats.total).toBe(3);
    expect(after.stats.correct).toBe(2);
    expect(after.stats.cats['专辑'].t).toBe(1);
    expect(after.stats.cats['专辑'].c).toBe(1);
    expect(after.stats.cats['歌曲'].t).toBe(2);
    expect(after.stats.cats['歌曲'].c).toBe(1);
  });
});

// -----------------------------------------------------------------------
// setDailyGoal — 边界 clamp（5-100）
// -----------------------------------------------------------------------
describe('setDailyGoal', () => {
  it('clamp 到最小 5', () => {
    App.db.setDailyGoal(1);
    expect(App.db.getDailyGoal()).toBe(5);
  });
  it('clamp 到最大 100', () => {
    App.db.setDailyGoal(500);
    expect(App.db.getDailyGoal()).toBe(100);
  });
  it('中间值直接接受', () => {
    App.db.setDailyGoal(25);
    expect(App.db.getDailyGoal()).toBe(25);
  });
  it('默认目标为 20', () => {
    // 新初始化的 defaults()
    expect(App.db.getDailyGoal()).toBe(20);
  });
});

// -----------------------------------------------------------------------
// getStreak — 连续打卡天数，合并 history 与 archive
// -----------------------------------------------------------------------
describe('getStreak', () => {
  it('空 history 返回 0', () => {
    expect(App.db.getStreak()).toBe(0);
  });

  it('今天答题 → streak 至少 1', () => {
    const d = App.db.get();
    d.history = [{ qid: '001', ok: true, time: Date.now() }];
    expect(App.db.getStreak()).toBeGreaterThanOrEqual(1);
  });

  it('昨天答题今天没答 → streak = 1（昨天）', () => {
    const d = App.db.get();
    const yesterday = Date.now() - 86400000;
    d.history = [{ qid: '001', ok: true, time: yesterday }];
    // 清除今天
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 只保留昨天那天
    expect(App.db.getStreak()).toBe(1);
  });

  it('两天没答题 → streak 为 0', () => {
    const d = App.db.get();
    const twoDaysAgo = Date.now() - 2 * 86400000;
    d.history = [{ qid: '001', ok: true, time: twoDaysAgo }];
    expect(App.db.getStreak()).toBe(0);
  });

  it('archive 日期也计入 streak', () => {
    const d = App.db.get();
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    d.archive = [
      {
        date: threeDaysAgo.getFullYear() + '-' + threeDaysAgo.getMonth() + '-' + threeDaysAgo.getDate(),
        total: 5,
        correct: 4,
      },
    ];
    // history 只有今天
    d.history = [{ qid: '001', ok: true, time: Date.now() }];
    // 连续日期：今天 + 3 天前 → 中间缺两天 → streak 应该只是 1（今天）
    // 但如果 archive 中的日期是"昨天"，应该连起来
    const yesterday = new Date(Date.now() - 86400000);
    d.archive = [
      {
        date: yesterday.getFullYear() + '-' + yesterday.getMonth() + '-' + yesterday.getDate(),
        total: 3,
        correct: 2,
      },
    ];
    expect(App.db.getStreak()).toBe(2);
  });
});

// -----------------------------------------------------------------------
// checkAchievements — 10 个成就解锁条件
// -----------------------------------------------------------------------
describe('checkAchievements', () => {
  it('首答 → first_answer', () => {
    const d = App.db.get();
    d.stats.total = 1;
    d.stats.correct = 1;
    const u = App.db.checkAchievements();
    expect(u.map((x) => x.id)).toContain('first_answer');
  });

  it('累计 100 题 → total_100', () => {
    const d = App.db.get();
    d.stats.total = 100;
    d.stats.correct = 90;
    const u = App.db.checkAchievements();
    expect(u.map((x) => x.id)).toContain('total_100');
  });

  it('累计 500 题 → total_500', () => {
    const d = App.db.get();
    d.stats.total = 500;
    d.stats.correct = 450;
    const u = App.db.checkAchievements();
    expect(u.map((x) => x.id)).toContain('total_500');
  });

  it('50 题且正确率 ≥ 90% → acc_90', () => {
    const d = App.db.get();
    d.stats.total = 50;
    d.stats.correct = 45; // 90%
    const u = App.db.checkAchievements();
    expect(u.map((x) => x.id)).toContain('acc_90');

    d.stats.correct = 44; // 88%
    d.achievements = []; // 重置
    const u2 = App.db.checkAchievements();
    expect(u2.map((x) => x.id)).not.toContain('acc_90');
  });

  it('单次 10 题全对 → perfect_10（依赖 context）', () => {
    const u = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    expect(u.map((x) => x.id)).toContain('perfect_10');

    App.db.setData(App.db.defaults());
    const u2 = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 9 });
    expect(u2.map((x) => x.id)).not.toContain('perfect_10');
  });

  it('单日 50 题 → daily_50', () => {
    const d = App.db.get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.history = Array.from({ length: 50 }, () => ({ qid: '001', ok: true, time: today.getTime() + Math.random() * 3600000 }));
    d.stats.total = 50;
    d.stats.correct = 50;
    const u = App.db.checkAchievements();
    expect(u.map((x) => x.id)).toContain('daily_50');
  });

  it('连续 3 天 → streak_3', () => {
    const d = App.db.get();
    const base = Date.now();
    d.history = [0, 1, 2].map((i) => ({ qid: '001', ok: true, time: base - i * 86400000 }));
    d.stats.total = 3;
    const u = App.db.checkAchievements();
    expect(u.map((x) => x.id)).toContain('streak_3');
  });

  it('错题清零 → wrong_clear（有首答 + 错题本空）', () => {
    const d = App.db.get();
    d.stats.total = 20;
    d.achievements = ['first_answer'];
    d.wrong = [];
    const u = App.db.checkAchievements();
    expect(u.map((x) => x.id)).toContain('wrong_clear');
  });

  it('所有分类都有答题 → all_cats', () => {
    const d = App.db.get();
    d.stats.total = 20;
    d.stats.cats = {
      专辑: { t: 1, c: 1 },
      歌曲: { t: 1, c: 1 },
      个人信息: { t: 1, c: 1 },
      获奖记录: { t: 1, c: 1 },
    };
    const u = App.db.checkAchievements();
    expect(u.map((x) => x.id)).toContain('all_cats');

    // 缺一个分类
    d.stats.cats = { 专辑: { t: 1, c: 1 }, 歌曲: { t: 1, c: 1 }, 个人信息: { t: 1, c: 1 } };
    d.achievements = [];
    const u2 = App.db.checkAchievements();
    expect(u2.map((x) => x.id)).not.toContain('all_cats');
  });

  it('已解锁的成就不会重复返回', () => {
    const d = App.db.get();
    d.stats.total = 1;
    d.achievements = ['first_answer'];
    const u = App.db.checkAchievements();
    expect(u.map((x) => x.id)).not.toContain('first_answer');
  });
});

// -----------------------------------------------------------------------
// session — 答题中断保存 / 恢复
// -----------------------------------------------------------------------
describe('session', () => {
  it('save + load 回题目 ID 列表和位置', () => {
    const state = {
      quiz: [{ id: '001' }, { id: '002' }],
      idx: 1,
      correctCount: 1,
      startTime: 1000,
      mode: 'quick',
      isWrongBookQuiz: false,
    };
    App.session.save(state);
    const loaded = App.session.load();
    expect(loaded.quizIds).toEqual(['001', '002']);
    expect(loaded.idx).toBe(1);
    expect(loaded.correctCount).toBe(1);
    expect(loaded.mode).toBe('quick');
  });

  it('load 返回 null 当无保存', () => {
    App.session.clear();
    expect(App.session.load()).toBeNull();
  });

  it('clear 后 load 返回 null', () => {
    App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
    App.session.clear();
    expect(App.session.load()).toBeNull();
  });
});
