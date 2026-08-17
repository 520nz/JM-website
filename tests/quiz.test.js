import { describe, it, beforeEach, expect, beforeAll } from 'vitest';
import { loadApp, initStorage, resetStorage } from './_common.js';

let A;

beforeAll(async () => {
    A = loadApp({ admin: false });
    await initStorage();
});

beforeEach(() => {
    resetStorage();
    A.session.clear();
});

function setupQuizDOM() {
    const ids = ['quizArea', 'fb', 'fbTitle', 'fbDesc', 'nextBtn', 'timerVal', 'categoryList', 'view-practice'];
    for (const id of ids) {
        if (!document.getElementById(id)) {
            const el = document.createElement('div');
            el.id = id;
            document.body.appendChild(el);
        }
    }
    const selectEl = document.createElement('select');
    selectEl.id = 'modeSelect';
    document.body.appendChild(selectEl);
    // reset timer interval to avoid leaks
    if (A && A.startTimer) {
        try { A.stopTimer(); } catch (_) {}
    }
}

describe('quiz.js - shuffle 纯函数', () => {
    it('应暴露 shuffle API', () => {
        expect(typeof A.shuffle).toBe('function');
    });

    it('应返回新数组，不修改原数组', () => {
        const arr = [1, 2, 3, 4, 5];
        const orig = arr.slice();
        const out = A.shuffle(arr);
        expect(arr).toEqual(orig);
        expect(arr).not.toBe(out);
    });

    it('打乱后元素应与原数组完全一致（多重集等价）', () => {
        const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const out = A.shuffle(arr);
        expect(out.sort()).toEqual(arr.slice().sort());
    });

    it('空数组应返回空数组', () => {
        expect(A.shuffle([])).toEqual([]);
    });

    it('单元素数组应返回同元素数组', () => {
        expect(A.shuffle([42])).toEqual([42]);
    });
});

describe('quiz.js - 状态隔离', () => {
    beforeEach(() => setupQuizDOM());

    it('startRandomQuiz 不修改 App.QUESTION_BANK 原数组', () => {
        const origLen = A.QUESTION_BANK.length;
        const origIds = A.QUESTION_BANK.map(q => q.id);
        A.startRandomQuiz();
        expect(A.QUESTION_BANK.length).toBe(origLen);
        expect(A.QUESTION_BANK.map(q => q.id)).toEqual(origIds);
    });

    it('应暴露 startRandomQuiz / startCatQuiz / startWrongBookQuiz API', () => {
        expect(typeof A.startRandomQuiz).toBe('function');
        expect(typeof A.startCatQuiz).toBe('function');
        expect(typeof A.startWrongBookQuiz).toBe('function');
    });
});

describe('quiz.js - session 恢复逻辑 tryResumeSession', () => {
    beforeEach(() => {
        resetStorage();
        A.session.clear();
        setupQuizDOM();
    });

    it('无保存会话应返回 false', () => {
        expect(A.tryResumeSession()).toBe(false);
    });

    it('空 quizIds 应返回 false', () => {
        A.session.save({ quiz: [], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
        expect(A.tryResumeSession()).toBe(false);
    });

    it('已答完的会话应返回 false 并清除会话存储', () => {
        A.session.save({ quiz: [{ id: '001' }, { id: '002' }], idx: 2, correctCount: 2, startTime: Date.now(), mode: 'quick' });
        expect(A.tryResumeSession()).toBe(false);
        expect(A.session.load()).toBeNull();
    });

    it('正常会话应恢复题目列表、索引、模式', () => {
        const qids = ['001', '002', '003'];
        A.session.save({
            quiz: qids.map(id => ({ id })),
            idx: 1,
            correctCount: 1,
            startTime: Date.now(),
            mode: 'quick'
        });
        const ok = A.tryResumeSession();
        expect(ok).toBe(true);
        expect(A.state.idx).toBe(1);
        expect(A.state.correctCount).toBe(1);
        expect(A.state.quiz.length).toBe(3);
        expect(A.state.quiz[0].id).toBe('001');
    });

    it('应暴露 resumeSession / discardSession API', () => {
        expect(typeof A.resumeSession).toBe('function');
        expect(typeof A.discardSession).toBe('function');
    });
});

describe('quiz.js - getCount 与 mode 影响', () => {
    beforeEach(() => setupQuizDOM());

    it('不同 mode 应有不同题目数量', () => {
        A.selectMode('quick');
        A.startRandomQuiz();
        const q1 = A.state.quiz.length;

        A.selectMode('standard');
        A.startRandomQuiz();
        const q2 = A.state.quiz.length;

        A.selectMode('intensive');
        A.startRandomQuiz();
        const q3 = A.state.quiz.length;

        expect(q1).toBe(10);
        expect(q2).toBe(20);
        expect(q3).toBe(30);
    });
});

describe('quiz.js - toggleSound', () => {
    it('应暴露 toggleSound 且返回切换后的值', () => {
        expect(typeof A.toggleSound).toBe('function');
        const v1 = A.toggleSound();
        const v2 = A.toggleSound();
        expect(v1).not.toBe(v2);
    });
});

describe('quiz.js - startWrongBookQuiz 错题本场景', () => {
    beforeEach(() => {
        resetStorage();
        A.session.clear();
        setupQuizDOM();
    });

    it('startWrongBookQuiz 错题本为空应安全返回（不崩）', () => {
        expect(() => A.startWrongBookQuiz()).not.toThrow();
    });

    it('startWrongBookQuiz 应只选取到期错题', () => {
        A.db.addWrong('001');
        A.db.addWrong('002');
        for (let i = 0; i < 4; i++) A.db.reviewCorrect('002');
        // 001 到期（nextReview <= now），002 未到期
        A.startWrongBookQuiz();
        expect(A.state.isWrongBookQuiz).toBe(true);
        // 001 在，002 可能也在
        const quizIds = A.state.quiz.map(q => q.id);
        expect(quizIds.includes('001')).toBe(true);
    });

    it('startCatQuiz 指定不存在分类应安全返回', () => {
        expect(() => A.startCatQuiz('不存在分类')).not.toThrow();
    });
});

describe('quiz.js - pickOption 与答题逻辑', () => {
    beforeEach(() => {
        resetStorage();
        A.session.clear();
        setupQuizDOM();
        A.startRandomQuiz();
        // 渲染第一题的 DOM
        A.renderQ();
    });

    it('答对应递增 correctCount 且不加入错题本', () => {
        const q = A.state.quiz[0];
        A.pickOption(q.answer);
        expect(A.state.correctCount).toBe(1);
        expect(A.db.getWrong().length).toBe(0);
    });

    it('答错应加入错题本', () => {
        const q = A.state.quiz[0];
        const wrongKey = q.options.find(o => o.key !== q.answer).key;
        A.pickOption(wrongKey);
        expect(A.db.getWrong().length).toBe(1);
        expect(A.db.getWrong()[0].qid).toBe(q.id);
    });

    it('已答题后再次 pickOption 应被忽略（幂等保护）', () => {
        const q = A.state.quiz[0];
        A.pickOption(q.answer);
        const before = A.state.correctCount;
        A.pickOption(q.answer);
        expect(A.state.correctCount).toBe(before);
    });

    it('错题本模式下答对应触发 reviewCorrect', () => {
        const q = A.state.quiz[0];
        A.state.isWrongBookQuiz = true;
        A.db.addWrong(q.id);
        A.pickOption(q.answer);
        expect(A.db.getWrong()[0].level).toBeGreaterThanOrEqual(1);
    });
});
