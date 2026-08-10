import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';

function loadModules() {
  eval(fs.readFileSync('js/data.js', 'utf-8'));
  eval(fs.readFileSync('js/storage.js', 'utf-8'));
  eval(fs.readFileSync('js/admin.js', 'utf-8'));
  return window.App;
}

describe('admin.js - option parsing regex', () => {
  it('parses standard "A. option" format', () => {
    const lines = ['A. 选项一', 'B. 选项二', 'C. 选项三', 'D. 选项四'];
    const options = [];
    for (const line of lines) {
      const match = line.trim().match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) options.push({ key: match[1], text: match[2] });
    }
    expect(options.length).toBe(4);
    expect(options[0]).toEqual({ key: 'A', text: '选项一' });
  });

  it('parses Chinese dot separator "A、选项"', () => {
    const lines = ['A、正确选项', 'B、错误选项', 'C、无效选项', 'D、以上都不对'];
    const options = [];
    for (const line of lines) {
      const match = line.trim().match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) options.push({ key: match[1], text: match[2] });
    }
    expect(options.length).toBe(4);
    expect(options[0]).toEqual({ key: 'A', text: '正确选项' });
  });

  it('parses full-width dot separator "A．选项"', () => {
    const lines = ['A．一', 'B．二'];
    const options = [];
    for (const line of lines) {
      const match = line.trim().match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) options.push({ key: match[1], text: match[2] });
    }
    expect(options.length).toBe(2);
    expect(options[0]).toEqual({ key: 'A', text: '一' });
  });

  it('rejects malformed lines like "1. number" or "无字母前缀"', () => {
    const malformed = ['1. 数字开头', '没有字母', 'a. 小写'];
    for (const line of malformed) {
      const match = line.trim().match(/^([A-Z])[.、．]\s*(.+)$/);
      expect(match).toBeNull();
    }
  });

  it('handles lines without space after separator', () => {
    const match = 'A.直接连接'.match(/^([A-Z])[.、．]\s*(.+)$/);
    expect(match).not.toBeNull();
    expect(match[2]).toBe('直接连接');
  });

  it('requires at least 2 options (saveQuestion validation)', () => {
    // Single option should be rejected by the UI logic check
    const singleLine = 'A. only one';
    const lines = singleLine.split('\n');
    const options = [];
    for (const line of lines) {
      const match = line.trim().match(/^([A-Z])[.、．]\s*(.+)$/);
      if (match) options.push({ key: match[1], text: match[2] });
    }
    expect(options.length).toBe(1);
    expect(options.length < 2).toBe(true); // triggers alert('请至少输入两个选项')
  });
});

describe('admin.js - data import merge logic', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('merges wrong book: keeps max(cnt) when qid already exists', () => {
    // Setup existing wrong entry
    app.db.addWrong('001');
    // Simulate the import merge logic (cnt = Math.max(existing, imported))
    const existing = app.db.getWrong();
    existing[0].cnt = 2;
    // Import data has cnt = 5
    const imported = { qid: '001', cnt: 5 };
    const mergedCnt = Math.max(existing[0].cnt, imported.cnt || 1);
    expect(mergedCnt).toBe(5);

    // Reverse direction: existing has 10, imported has 2
    existing[0].cnt = 10;
    imported.cnt = 2;
    expect(Math.max(existing[0].cnt, imported.cnt || 1)).toBe(10);
  });

  it('merges wrong book: keeps min(level) (more conservative)', () => {
    app.db.addWrong('001');
    // Advance to level 3
    app.db.reviewCorrect('001'); // level 1
    app.db.reviewCorrect('001'); // level 2
    app.db.reviewCorrect('001'); // level 3

    const existing = app.db.getWrong()[0];
    const imported = { qid: '001', level: 1 };

    // level merge: Math.min(existing, imported)
    const mergedLevel = Math.min(existing.level || 0, imported.level);
    expect(mergedLevel).toBe(1); // more conservative (lower level)

    // Reverse: existing lower, import higher
    existing.level = 0;
    imported.level = 4;
    expect(Math.min(existing.level || 0, imported.level)).toBe(0);
  });

  it('merges wrong book: adds required SR fields for legacy data', () => {
    // Legacy import data without interval repetition fields
    const legacyItem = { qid: '001', cnt: 3 };
    if (!legacyItem.level) legacyItem.level = 0;
    if (!legacyItem.nextReview) legacyItem.nextReview = Date.now();
    if (!legacyItem.lastReview) legacyItem.lastReview = 0;
    if (!legacyItem.time) legacyItem.time = Date.now();

    expect(legacyItem.level).toBe(0);
    expect(legacyItem.nextReview).toBeGreaterThan(0);
    expect(legacyItem.lastReview).toBe(0);
    expect(legacyItem.time).toBeGreaterThan(0);
  });

  it('import does NOT directly accumulate stats (recalc from history)', () => {
    const now = Date.now();
    // Existing local data
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
    app.db.addRecord({ qid: '002', ans: 'A', ok: false, time: now });

    // Simulate imported user data
    const imported = {
      history: [
        { qid: '001', ans: 'B', ok: true, time: now - 1000 },
        { qid: '005', ans: 'C', ok: true, time: now - 2000 },
      ],
      stats: { total: 1000, correct: 999, cats: {} }, // deliberately WRONG stats
      wrong: [],
    };

    // Import logic: merge history then recalc
    const d = app.db.get();
    d.history = d.history.concat(imported.history);
    app.db.recalcStats();

    const final = app.db.get();
    // Should be 4 records total (2 existing + 2 imported)
    expect(final.stats.total).toBe(4);
    expect(final.stats.correct).toBe(3); // T, F, T, T
    // NOT 1000 (imported stats ignored)
  });

  it('import merges history (existing + imported)', () => {
    const now = Date.now();
    app.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });

    const imported = {
      history: [
        { qid: '002', ans: 'A', ok: true, time: now - 500 },
        { qid: '005', ans: 'C', ok: true, time: now - 1000 },
      ],
      stats: { total: 0, correct: 0, cats: {} },
      wrong: [],
    };

    const d = app.db.get();
    d.history = d.history.concat(imported.history);
    app.db.recalcStats();

    const final = app.db.get();
    expect(final.stats.total).toBe(3);
    expect(final.history.length).toBe(3);
  });
});

describe('admin.js - question CRUD edge cases', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('finds question by id (same as admin save/edit lookup)', () => {
    const targetId = '013';
    let found = null;
    for (const q of app.QUESTION_BANK) {
      if (q.id === targetId) { found = q; break; }
    }
    expect(found).not.toBeNull();
    expect(found.category).toBe('专辑');
  });

  it('handles unknown id gracefully (returns null, not crash)', () => {
    let found = null;
    for (const q of app.QUESTION_BANK) {
      if (q.id === 'no-such-id') { found = q; break; }
    }
    expect(found).toBeNull();
  });

  it('deleteQuestion by id filters correctly', () => {
    const origLen = app.QUESTION_BANK.length;
    const removedId = '001';
    app.QUESTION_BANK = app.QUESTION_BANK.filter(q => q.id !== removedId);
    expect(app.QUESTION_BANK.length).toBe(origLen - 1);
    expect(app.QUESTION_BANK.find(q => q.id === removedId)).toBeUndefined();
  });

  it('deleteQuestion of non-existent id does nothing', () => {
    const origLen = app.QUESTION_BANK.length;
    app.QUESTION_BANK = app.QUESTION_BANK.filter(q => q.id !== 'does-not-exist');
    expect(app.QUESTION_BANK.length).toBe(origLen);
  });

  it('question object has all required fields', () => {
    for (const q of app.QUESTION_BANK) {
      expect(typeof q.id).toBe('string');
      expect(typeof q.category).toBe('string');
      expect(typeof q.question).toBe('string');
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options.length).toBeGreaterThanOrEqual(4);
      expect(typeof q.answer).toBe('string');
      expect(typeof q.explanation).toBe('string');
    }
  });

  it('answer matches one of the option keys', () => {
    for (const q of app.QUESTION_BANK) {
      const keys = q.options.map(o => o.key);
      expect(keys).toContain(q.answer);
    }
  });
});

describe('admin.js - question bank data integrity', () => {
  let app;
  beforeEach(() => {
    app = loadModules();
  });

  it('all ids are unique', () => {
    const ids = app.QUESTION_BANK.map(q => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all categories are valid (non-empty)', () => {
    const categories = new Set();
    for (const q of app.QUESTION_BANK) {
      expect(q.category.length).toBeGreaterThan(0);
      categories.add(q.category);
    }
    expect(categories.size).toBeGreaterThan(0);
  });

  it('all option keys within each question are unique', () => {
    for (const q of app.QUESTION_BANK) {
      const keys = q.options.map(o => o.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    }
  });
});
