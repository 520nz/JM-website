require('../js/data.js');
require('../js/storage.js');

describe('storage.js - XSS转义工具', () => {
    test('esc() 应转义 HTML 特殊字符', () => {
        const result = window.App.esc('<script>alert("xss")</script>');
        expect(result).toContain('&lt;script&gt;');
        expect(result).toContain('&lt;/script&gt;');
    });

    test('esc() 应转义尖括号', () => {
        expect(window.App.esc('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
    });

    test('esc() 应对 null 返回空字符串', () => {
        expect(window.App.esc(null)).toBe('');
    });

    test('esc() 应对 undefined 返回空字符串', () => {
        expect(window.App.esc(undefined)).toBe('');
    });

    test('esc() 应处理数字输入', () => {
        expect(window.App.esc(123)).toBe('123');
    });

    test('esc() 应处理普通文本', () => {
        expect(window.App.esc('Hello World')).toBe('Hello World');
    });

    test('esc() 应防止 XSS 攻击', () => {
        const malicious = '<img src=x onerror=alert(1)>';
        const result = window.App.esc(malicious);
        expect(result).not.toContain('<img');
        expect(result).not.toContain('>');
    });
});

describe('storage.js - 间隔重复算法', () => {
    beforeEach(() => {
        window.App.db.setData({ history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });
    });

    test('addWrong() 应添加新错题', () => {
        window.App.db.addWrong('q001');
        const wrong = window.App.db.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].qid).toBe('q001');
        expect(wrong[0].cnt).toBe(1);
        expect(wrong[0].level).toBe(0);
    });

    test('addWrong() 应增加已有错题的错误次数', () => {
        window.App.db.addWrong('q001');
        window.App.db.addWrong('q001');
        const wrong = window.App.db.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].cnt).toBe(2);
        expect(wrong[0].level).toBe(0);
    });

    test('addWrong() 应重置已有错题的等级', () => {
        window.App.db.addWrong('q001');
        window.App.db.get().wrong[0].level = 2;
        window.App.db.addWrong('q001');
        expect(window.App.db.getWrong()[0].level).toBe(0);
    });

    test('reviewCorrect() 应提升等级', () => {
        window.App.db.addWrong('q001');
        window.App.db.reviewCorrect('q001');
        expect(window.App.db.getWrong()[0].level).toBe(1);
    });

    test('reviewCorrect() 应在等级达到5时移除错题', () => {
        window.App.db.addWrong('q001');
        window.App.db.get().wrong[0].level = 4;
        window.App.db.reviewCorrect('q001');
        expect(window.App.db.getWrong().length).toBe(0);
    });

    test('reviewCorrect() 应设置正确的下一次复习时间', () => {
        window.App.db.addWrong('q001');
        const now = Date.now();
        window.App.db.reviewCorrect('q001');
        const wrong = window.App.db.getWrong()[0];
        expect(wrong.nextReview).toBeGreaterThanOrEqual(now + 60 * 60 * 1000);
    });

    test('reviewWrong() 应重置等级为0', () => {
        window.App.db.addWrong('q001');
        window.App.db.get().wrong[0].level = 3;
        window.App.db.reviewWrong('q001');
        expect(window.App.db.getWrong()[0].level).toBe(0);
    });

    test('reviewWrong() 应增加错误次数', () => {
        window.App.db.addWrong('q001');
        window.App.db.reviewWrong('q001');
        expect(window.App.db.getWrong()[0].cnt).toBe(2);
    });

    test('reviewWrong() 应对不在错题本的题目调用 addWrong', () => {
        window.App.db.reviewWrong('q001');
        expect(window.App.db.getWrong().length).toBe(1);
        expect(window.App.db.getWrong()[0].qid).toBe('q001');
    });

    test('getDueWrong() 应返回到期的错题', () => {
        const now = Date.now();
        window.App.db.addWrong('q001');
        window.App.db.get().wrong[0].nextReview = now - 1000;
        window.App.db.addWrong('q002');
        window.App.db.get().wrong[1].nextReview = now + 1000 * 60 * 60;
        const due = window.App.db.getDueWrong();
        expect(due.length).toBe(1);
        expect(due[0].qid).toBe('q001');
    });

    test('getDueWrong() 应返回没有 nextReview 的错题', () => {
        window.App.db.addWrong('q001');
        delete window.App.db.get().wrong[0].nextReview;
        const due = window.App.db.getDueWrong();
        expect(due.length).toBe(1);
        expect(due[0].qid).toBe('q001');
    });

    test('removeWrong() 应移除错题', () => {
        window.App.db.addWrong('q001');
        window.App.db.removeWrong('q001');
        expect(window.App.db.getWrong().length).toBe(0);
    });
});

describe('storage.js - 统计重算', () => {
    beforeEach(() => {
        window.App.db.setData({ history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });
    });

    test('recalcStats() 应正确计算总答题数和正确数', () => {
        window.App.db.setData({
            history: [
                { qid: '001', ok: true, time: Date.now() },
                { qid: '002', ok: false, time: Date.now() },
                { qid: '003', ok: true, time: Date.now() }
            ],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} }
        });
        window.App.db.recalcStats();
        const stats = window.App.db.get().stats;
        expect(stats.total).toBe(3);
        expect(stats.correct).toBe(2);
    });

    test('recalcStats() 应正确计算分类统计', () => {
        window.App.db.setData({
            history: [
                { qid: '001', ok: true, time: Date.now() },
                { qid: '005', ok: false, time: Date.now() },
                { qid: '002', ok: true, time: Date.now() }
            ],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} }
        });
        window.App.db.recalcStats();
        const cats = window.App.db.get().stats.cats;
        expect(cats['专辑']).toEqual({ t: 2, c: 1 });
        expect(cats['歌曲']).toEqual({ t: 1, c: 1 });
    });

    test('recalcStats() 应对空历史重置统计', () => {
        window.App.db.setData({
            history: [],
            wrong: [],
            stats: { total: 100, correct: 50, cats: { '专辑': { t: 50, c: 25 } } }
        });
        window.App.db.recalcStats();
        const stats = window.App.db.get().stats;
        expect(stats.total).toBe(0);
        expect(stats.correct).toBe(0);
        expect(Object.keys(stats.cats).length).toBe(0);
    });
});

describe('storage.js - session 管理', () => {
    test('session.save() 和 session.load() 应正确保存和加载数据', () => {
        const state = {
            quiz: [{ id: 'q001' }, { id: 'q002' }],
            idx: 1,
            correctCount: 5,
            startTime: Date.now(),
            mode: 'quick'
        };
        window.App.session.save(state);
        const loaded = window.App.session.load();
        expect(loaded.quizIds).toEqual(['q001', 'q002']);
        expect(loaded.idx).toBe(1);
        expect(loaded.correctCount).toBe(5);
        expect(loaded.mode).toBe('quick');
    });

    test('session.load() 应在无数据时返回 null', () => {
        sessionStorage.removeItem('jj_quiz_session');
        expect(window.App.session.load()).toBeNull();
    });

    test('session.clear() 应清除会话数据', () => {
        window.App.session.save({ quiz: [{ id: 'q001' }], idx: 0 });
        window.App.session.clear();
        expect(window.App.session.load()).toBeNull();
    });
});