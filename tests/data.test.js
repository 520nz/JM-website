import { describe, it, beforeAll, expect } from 'vitest';
import { loadApp } from './_common.js';

describe('data.js - 题库完整性与数据一致性', () => {
    let bank;

    beforeAll(() => {
        const App = loadApp({ storage: false, quiz: false, admin: false });
        bank = App.QUESTION_BANK;
    });

    it('题库不应为空', () => {
        expect(bank.length).toBeGreaterThan(0);
    });

    it('所有题目 id 应唯一', () => {
        const ids = bank.map(q => q.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('所有题目应包含必填字段', () => {
        for (const q of bank) {
            expect(q.id).toBeDefined();
            expect(q.category).toBeDefined();
            expect(typeof q.category).toBe('string');
            expect(q.question).toBeDefined();
            expect(typeof q.question).toBe('string');
            expect(q.options).toBeDefined();
            expect(Array.isArray(q.options)).toBe(true);
            expect(q.answer).toBeDefined();
            expect(q.explanation).toBeDefined();
        }
    });

    it('每题选项数应 >=2', () => {
        for (const q of bank) {
            expect(q.options.length).toBeGreaterThanOrEqual(2);
        }
    });

    it('答案应存在于选项中', () => {
        for (const q of bank) {
            const keys = q.options.map(o => o.key);
            expect(keys).toContain(q.answer);
        }
    });

    it('每个选项应包含 key 和 text 字段', () => {
        for (const q of bank) {
            for (const opt of q.options) {
                expect(opt.key).toBeDefined();
                expect(opt.text).toBeDefined();
            }
        }
    });

    it('所有分类应非空字符串', () => {
        const cats = new Set(bank.map(q => q.category));
        for (const c of cats) expect(c.length).toBeGreaterThan(0);
    });

    it('题目 id 应为字符串类型', () => {
        for (const q of bank) expect(typeof q.id).toBe('string');
    });

    it('题目 question 文本不应为空字符串', () => {
        for (const q of bank) {
            expect(q.question.trim().length).toBeGreaterThan(0);
        }
    });

    it('选项 text 不应为空', () => {
        for (const q of bank) {
            for (const opt of q.options) {
                expect(opt.text.trim().length).toBeGreaterThan(0);
            }
        }
    });

    it('App.DEFAULT_QUESTION_BANK 应与 QUESTION_BANK 分离', () => {
        const App = loadApp({ storage: false, quiz: false, admin: false });
        expect(App.DEFAULT_QUESTION_BANK).not.toBe(App.QUESTION_BANK);
        expect(App.DEFAULT_QUESTION_BANK.length).toBe(App.QUESTION_BANK.length);
    });
});
