import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';

function loadModules() {
  eval(fs.readFileSync('js/data.js', 'utf-8'));
  eval(fs.readFileSync('js/storage.js', 'utf-8'));
  return window.App;
}

function getFirstQuestion(app, category) {
  for (const q of app.QUESTION_BANK) {
    if (!category || q.category === category) return q;
  }
  return app.QUESTION_BANK[0];
}

describe('storage.js - findQ', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('returns question object when id exists', () => {
    const q = app.db.findQ('001');
    expect(q).toBeDefined();
    expect(q.question).toContain('乐行者');
    expect(q.category).toBe('专辑');
    expect(q.answer).toBe('B');
  });

  it('returns null when id does not exist', () => {
    expect(app.db.findQ('nonexistent-id')).toBeNull();
    expect(app.db.findQ('')).toBeNull();
  });

  it('handles QUESTION_BANK being empty', () => {
    const orig = app.QUESTION_BANK;
    app.QUESTION_BANK = [];
    expect(app.db.findQ('001')).toBeNull();
    app.QUESTION_BANK = orig;
  });
});

describe('storage.js - XSS esc', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('escapes HTML special characters', () => {
    expect(app.esc('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
    expect(app.esc('&amp;')).toBe('&amp;amp;');
    expect(app.esc('<>')).toBe('&lt;&gt;');
  });

  it('escapes scripts to prevent XSS', () => {
    const escaped = app.esc('<script>alert(1)</script>');
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  it('returns empty string for null/undefined', () => {
    expect(app.esc(null)).toBe('');
    expect(app.esc(undefined)).toBe('');
  });

  it('preserves plain text', () => {
    expect(app.esc('Hello World 你好')).toBe('Hello World 你好');
  });
});

describe('storage.js - defaults & get', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('defaults() returns expected data shape', () => {
    const d = app.db.defaults();
    expect(d).toEqual({
      history: [],
      wrong: [],
      stats: { total: 0, correct: 0, cats: {} },
      theme: 'dark',
      dailyGoal: 20,
      achievements: [],
      archive: [],
    });
  });

  it('get() returns defaults before any initialization', () => {
    const d = app.db.get();
    expect(d).toBeDefined();
    expect(d.history).toEqual([]);
    expect(d.stats.total).toBe(0);
  });
});

describe('storage.js - interval repetition (wrong book)', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('addWrong initializes entry with level 0, cnt 1', () => {
    app.db.addWrong('001');
    const wrong = app.db.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].qid).toBe('001');
    expect(wrong[0].cnt).toBe(1);
    expect(wrong[0].level).toBe(0);
    expect(wrong[0].nextReview).toBeGreaterThanOrEqual(Date.now() - 1000);
  });

  it('addWrong on existing resets level to 0 and increments cnt', () => {
    app.db.addWrong('001');
    app.db.addWrong('001');
    const wrong = app.db.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].cnt).toBe(2);
    expect(wrong[0].level).toBe(0);
  });

  it('reviewCorrect increments level and sets nextReview interval', () => {
    app.db.addWrong('001');
    const before = Date.now();
    const result = app.db.reviewCorrect('001');
    expect(result.mastered).toBe(false);
    expect(result.level).toBe(1);
    const wrong = app.db.getWrong();
    expect(wrong[0].level).toBe(1);
    // nextReview = now + SR_INTERVALS[1] = 1 hour
    expect(wrong[0].nextReview).toBeGreaterThanOrEqual(before + 3599999);
    expect(wrong[0].nextReview).toBeLessThanOrEqual(before + 3600001);
  });

  it('reviewCorrect 5 times masters the question (removes from wrong book)', () => {
    app.db.addWrong('001');
    for (let i = 0; i < 4; i++) {
      const r = app.db.reviewCorrect('001');
      expect(r.mastered).toBe(false);
    }
    const final = app.db.reviewCorrect('001');
    expect(final.mastered).toBe(true);
    expect(app.db.getWrong()).toEqual([]);
  });

  it('reviewCorrect on non-existent qid returns safe default', () => {
    const result = app.db.reviewCorrect('no-such-qid');
    expect(result.mastered).toBe(false);
    expect(result.qid).toBe('no-such-qid');
  });

  it('reviewWrong in wrong book resets level to 0 and increments cnt', () => {
    app.db.addWrong('001');
    app.db.reviewCorrect('001'); // level 1
    app.db.reviewCorrect('001'); // level 2
    app.db.reviewWrong('001');   // reset!
    const wrong = app.db.getWrong();
    expect(wrong[0].level).toBe(0);
    expect(wrong[0].cnt).toBe(2);
  });

  it('reviewWrong on non-existent qid auto-adds to wrong book', () => {
    app.db.reviewWrong('001');
    const wrong = app.db.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].qid).toBe('001');
  });

  it('removeWrong deletes the entry', () => {
    app.db.addWrong('001');
    app.db.addWrong('002');
    app.db.removeWrong('001');
    const wrong = app.db.getWrong();
    expect(wrong.length).toBe(1);
    expect(wrong[0].qid).toBe('002');
  });

  it('getDueWrong returns entries where nextReview <= now or nextReview is falsy', () => {
    app.db.addWrong('001');
    // addWrong sets nextReview = Date.now(), so it should be due
    const due = app.db.getDueWrong();
    expect(due.some(w => w.qid === '001')).toBe(true);
  });

  it('getDueWrong excludes entries with future nextReview', () => {
    app.db.addWrong('001');
    // Manually set nextReview far in the future
    const d = app.db.get();
    d.wrong[0].nextReview = Date.now() + 1000 * 60 * 60 * 24 * 7;
    app.db.setData(d);

    const due = app.db.getDueWrong();
    expect(due.some(w => w.qid === '001')).toBe(false);
  });
});

describe('storage.js - addRecord & stats', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('addRecord increments total, correct, and category stats', () => {
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    app.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });

    const d = app.db.get();
    expect(d.stats.total).toBe(2);
    expect(d.stats.correct).toBe(1);
    expect(d.stats.cats['专辑'].t).toBe(2);
    expect(d.stats.cats['专辑'].c).toBe(1);
  });

  it('addRecord handles unknown qid gracefully (stats still increment)', () => {
    app.db.addRecord({ qid: 'unknown', ans: 'A', ok: true, time: Date.now() });
    const d = app.db.get();
    expect(d.stats.total).toBe(1);
    expect(d.stats.correct).toBe(1);
    // No category stats since question not found
    expect(Object.keys(d.stats.cats).length).toBe(0);
  });

  it('addRecord does NOT archive when history <= 1000', () => {
    const now = Date.now();
    for (let i = 0; i < 1000; i++) {
      app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now - i * 60000 });
    }
    const d = app.db.get();
    expect(d.history.length).toBe(1000);
    expect(d.archive).toEqual([]);
  });

  it('addRecord archives old records when history > 1000', () => {
    const now = Date.now();
    // cutoff = now - 90 days; old must be older than cutoff to be archived
    const old = now - 120 * 24 * 60 * 60 * 1000; // 120 days ago (> 90 day cutoff)
    for (let i = 0; i < 800; i++) {
      app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: old });
    }
    for (let i = 0; i < 300; i++) {
      app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
    }
    const d = app.db.get();
    expect(d.history.length).toBeLessThan(1000);
    expect(d.archive.length).toBeGreaterThan(0);
  });

  it('archive aggregates by day and avoids duplicate dates', () => {
    const now = Date.now();
    const old = now - 120 * 24 * 60 * 60 * 1000; // 120 days ago
    // Pre-create archive with a known date
    const d0 = app.db.get();
    const existingDate = new Date(old);
    const key = `${existingDate.getFullYear()}-${existingDate.getMonth() + 1}-${existingDate.getDate()}`;
    d0.archive = [{ date: key, total: 50, correct: 40 }];
    app.db.setData(d0);

    // Now trigger archive
    for (let i = 0; i < 800; i++) {
      app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: old });
    }
    for (let i = 0; i < 300; i++) {
      app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
    }
    const d = app.db.get();
    // Check no duplicate dates in archive
    const dates = d.archive.map(a => a.date);
    const unique = new Set(dates);
    expect(unique.size).toBe(dates.length);
  });
});

describe('storage.js - streak calculation', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('returns 0 when no history at all', () => {
    expect(app.db.getStreak()).toBe(0);
  });

  it('returns 1 when answered today only', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: start + 3600000 });
    app.db.addRecord({ qid: '002', ans: 'B', ok: true, time: start + 7200000 });
    expect(app.db.getStreak()).toBe(1);
  });

  it('returns 1 when answered yesterday but not today', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: yesterday.getTime() });
    expect(app.db.getStreak()).toBe(1);
  });

  it('returns N for N consecutive days ending today', () => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
    }
    expect(app.db.getStreak()).toBe(5);
  });

  it('breaks streak when a day is skipped', () => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    // Today
    const t1 = new Date(base);
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: t1.getTime() });
    // Skip yesterday, go to day before yesterday
    const t3 = new Date(base);
    t3.setDate(base.getDate() - 2);
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: t3.getTime() });
    expect(app.db.getStreak()).toBe(1);
  });

  it('includes archive dates in streak', () => {
    const d0 = app.db.get();
    // Archive has 3 consecutive old dates
    const archiveDates = [];
    const today = new Date();
    for (let i = 1; i <= 3; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      archiveDates.push({
        date: `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`,
        total: 10, correct: 8,
      });
    }
    d0.archive = archiveDates;
    // Also answered today
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    expect(app.db.getStreak()).toBe(4);
  });
});

describe('storage.js - recalcStats', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('recalculates stats from history accurately', () => {
    const now = Date.now();
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
    app.db.addRecord({ qid: '002', ans: 'A', ok: false, time: now });
    app.db.addRecord({ qid: '005', ans: 'C', ok: true, time: now });

    // Corrupt stats
    const d = app.db.get();
    d.stats.total = 999;
    d.stats.correct = 500;
    d.stats.cats = {};
    app.db.setData(d);

    app.db.recalcStats();
    const fixed = app.db.get();
    expect(fixed.stats.total).toBe(3);
    expect(fixed.stats.correct).toBe(2); // T, F, T
    // 001 and 005 are 专辑, 002 is 歌曲
    expect(fixed.stats.cats['专辑'].t).toBe(2);
    expect(fixed.stats.cats['专辑'].c).toBe(2);
    expect(fixed.stats.cats['歌曲'].t).toBe(1);
    expect(fixed.stats.cats['歌曲'].c).toBe(0);
  });
});

describe('storage.js - daily goal', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('getDailyGoal returns default 20', () => {
    expect(app.db.getDailyGoal()).toBe(20);
  });

  it('setDailyGoal clamps values below 5 to 5', () => {
    app.db.setDailyGoal(1);
    expect(app.db.getDailyGoal()).toBe(5);
    app.db.setDailyGoal(4);
    expect(app.db.getDailyGoal()).toBe(5);
  });

  it('setDailyGoal clamps values above 100 to 100', () => {
    app.db.setDailyGoal(101);
    expect(app.db.getDailyGoal()).toBe(100);
    app.db.setDailyGoal(9999);
    expect(app.db.getDailyGoal()).toBe(100);
  });

  it('setDailyGoal accepts valid range 5-100', () => {
    app.db.setDailyGoal(25);
    expect(app.db.getDailyGoal()).toBe(25);
    app.db.setDailyGoal(100);
    expect(app.db.getDailyGoal()).toBe(100);
    app.db.setDailyGoal(5);
    expect(app.db.getDailyGoal()).toBe(5);
  });
});

describe('storage.js - achievements', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('first_answer unlocks after first record', () => {
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    const unlocks = app.db.checkAchievements();
    expect(unlocks.some(a => a.id === 'first_answer')).toBe(true);
  });

  it('total_100 unlocks after 100 records', () => {
    const now = Date.now();
    for (let i = 0; i < 100; i++) {
      app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now - i });
    }
    const unlocks = app.db.checkAchievements();
    expect(unlocks.some(a => a.id === 'total_100')).toBe(true);
  });

  it('perfect_10 unlocks when all 10 quiz answers correct', () => {
    const unlocks = app.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    expect(unlocks.some(a => a.id === 'perfect_10')).toBe(true);
  });

  it('perfect_10 does NOT unlock when not all correct', () => {
    const unlocks = app.db.checkAchievements({ quizTotal: 10, quizCorrect: 9 });
    expect(unlocks.some(a => a.id === 'perfect_10')).toBe(false);
  });

  it('daily_50 unlocks after 50 answers today', () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    const startOfDay = now.getTime();
    for (let i = 0; i < 50; i++) {
      app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: startOfDay + i });
    }
    const unlocks = app.db.checkAchievements();
    expect(unlocks.some(a => a.id === 'daily_50')).toBe(true);
  });

  it('streak_3 / streak_7 unlock based on streak', () => {
    // Build 3-day streak
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 0; i < 3; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: d.getTime() });
    }
    const unlocks = app.db.checkAchievements();
    expect(unlocks.some(a => a.id === 'streak_3')).toBe(true);
    expect(unlocks.some(a => a.id === 'streak_7')).toBe(false);
  });

  it('acc_90 unlocks after 50 answers with >= 90% accuracy', () => {
    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      const ok = i < 45; // 90% correct
      app.db.addRecord({ qid: '001', ans: ok ? 'B' : 'A', ok: ok, time: now - i });
    }
    const unlocks = app.db.checkAchievements();
    expect(unlocks.some(a => a.id === 'acc_90')).toBe(true);
  });

  it('all_cats unlocks when all 4 categories have records', () => {
    const catQids = { '专辑': '001', '歌曲': '002', '个人信息': '061', '获奖记录': '069' };
    const now = Date.now();
    for (const [cat, qid] of Object.entries(catQids)) {
      app.db.addRecord({ qid, ans: 'B', ok: true, time: now });
    }
    const unlocks = app.db.checkAchievements();
    expect(unlocks.some(a => a.id === 'all_cats')).toBe(true);
  });

  it('wrong_clear unlocks when wrong book empty after first_answer', () => {
    app.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
    app.db.addWrong('001');
    // Need first_answer to unlock first
    app.db.checkAchievements();
    // Now clear wrong book
    app.db.removeWrong('001');
    const unlocks = app.db.checkAchievements();
    expect(unlocks.some(a => a.id === 'wrong_clear')).toBe(true);
  });

  it('achievements do not re-unlock on subsequent checks', () => {
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    const first = app.db.checkAchievements();
    const second = app.db.checkAchievements();
    // first_answer only returned once
    const firstIds = first.map(a => a.id);
    const secondIds = second.map(a => a.id);
    expect(firstIds).toContain('first_answer');
    expect(secondIds).not.toContain('first_answer');
  });
});

describe('storage.js - store module', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('store.reset restores default question bank', async () => {
    // Mutate bank
    const origLen = app.QUESTION_BANK.length;
    app.QUESTION_BANK.push({ id: 'extra', question: 'x', options: [], answer: 'A', explanation: '' });
    expect(app.QUESTION_BANK.length).toBe(origLen + 1);

    await app.store.reset();
    expect(app.QUESTION_BANK.length).toBe(origLen);
    // DEFAULT should still have original length
    expect(app.DEFAULT_QUESTION_BANK.length).toBe(origLen);
  });
});
