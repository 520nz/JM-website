import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helper.js';

describe('data.js - 题库数据完整性', () => {
  beforeEach(() => {
    loadScript('js/data.js');
  });

  it('题库不应为空', () => {
    expect(window.App.QUESTION_BANK.length).toBeGreaterThan(0);
  });

  it('所有题目 ID 应唯一', () => {
    const ids = window.App.QUESTION_BANK.map(q => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('每道题都应包含必要字段且类型正确', () => {
    for (const q of window.App.QUESTION_BANK) {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('category');
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('options');
      expect(q).toHaveProperty('answer');
      expect(q).toHaveProperty('explanation');
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('答案 key 必须存在于选项中', () => {
    for (const q of window.App.QUESTION_BANK) {
      const keys = q.options.map(o => o.key);
      expect(keys).toContain(q.answer);
    }
  });

  it('每个选项都应包含 key 与 text', () => {
    for (const q of window.App.QUESTION_BANK) {
      for (const o of q.options) {
        expect(o).toHaveProperty('key');
        expect(o).toHaveProperty('text');
        expect(o.key).toMatch(/^[A-Z]$/);
      }
    }
  });

  it('题目分类应属于预定义的有效分类', () => {
    const validCategories = ['专辑', '歌曲', '个人信息', '获奖记录'];
    for (const q of window.App.QUESTION_BANK) {
      expect(validCategories).toContain(q.category);
    }
  });
});
