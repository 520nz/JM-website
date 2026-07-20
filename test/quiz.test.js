require('../js/data.js');
require('../js/storage.js');
require('../js/quiz.js');

describe('quiz.js - 随机打乱算法', () => {
    test('shuffle() 应返回相同长度的数组', () => {
        const arr = [1, 2, 3, 4, 5];
        const shuffled = window.App.shuffle(arr);
        expect(shuffled.length).toBe(arr.length);
    });

    test('shuffle() 应包含所有原始元素', () => {
        const arr = [1, 2, 3, 4, 5];
        const shuffled = window.App.shuffle(arr);
        expect(shuffled.sort()).toEqual(arr.sort());
    });

    test('shuffle() 应不修改原数组', () => {
        const arr = [1, 2, 3, 4, 5];
        const original = [...arr];
        window.App.shuffle(arr);
        expect(arr).toEqual(original);
    });

    test('shuffle() 应对空数组返回空数组', () => {
        expect(window.App.shuffle([])).toEqual([]);
    });

    test('shuffle() 应对单元素数组返回相同数组', () => {
        expect(window.App.shuffle([42])).toEqual([42]);
    });
});

describe('quiz.js - 模式选择', () => {
    test('selectMode() 应设置模式', () => {
        window.App.selectMode('standard');
        expect(window.App.state.mode).toBe('standard');
    });
});

describe('quiz.js - 答题中断恢复', () => {
    beforeEach(() => {
        window.App.db.setData({ history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });
        window.App.state.quiz = [];
        window.App.state.idx = 0;
        window.App.state.correctCount = 0;
        sessionStorage.removeItem('jj_quiz_session');
    });

    test('tryResumeSession() 应在无保存会话时返回 false', () => {
        expect(window.App.tryResumeSession()).toBe(false);
    });

    test('tryResumeSession() 应在会话数据无效时返回 false', () => {
        window.App.session.save({ quizIds: [], idx: 0 });
        expect(window.App.tryResumeSession()).toBe(false);
    });

    test('tryResumeSession() 应正确恢复会话', () => {
        sessionStorage.setItem('jj_quiz_session', JSON.stringify({
            quizIds: ['001'],
            idx: 0,
            correctCount: 0,
            startTime: Date.now() - 1000,
            mode: 'quick'
        }));
        const result = window.App.tryResumeSession();
        expect(result).toBe(true);
        expect(window.App.state.quiz.length).toBe(1);
        expect(window.App.state.quiz[0].id).toBe('001');
        expect(window.App.state.idx).toBe(0);
    });

    test('tryResumeSession() 应在题库中找不到题目时返回 false', () => {
        window.App.session.save({
            quizIds: ['nonexistent'],
            idx: 0,
            correctCount: 0,
            startTime: Date.now(),
            mode: 'quick'
        });
        expect(window.App.tryResumeSession()).toBe(false);
    });

    test('tryResumeSession() 应在已完成时返回 false', () => {
        window.App.session.save({
            quizIds: ['001'],
            idx: 1,
            correctCount: 1,
            startTime: Date.now(),
            mode: 'quick'
        });
        expect(window.App.tryResumeSession()).toBe(false);
    });
});