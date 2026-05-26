const quiz = require('../js/quiz');

describe('DB Module', () => {
    beforeEach(() => {
        quiz.resetForTest();
    });

    test('get() should return default data when localStorage is empty', () => {
        const result = quiz.DB.get();
        expect(result).toEqual({ history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } });
    });

    test('get() should return saved data from localStorage', () => {
        const testData = { history: [{ qid: '001', ans: 'A', ok: true, time: Date.now() }], wrong: [], stats: { total: 1, correct: 1, cats: {} } };
        localStorage.setItem('jj_quiz_v2', JSON.stringify(testData));
        
        const result = quiz.DB.get();
        expect(result.history.length).toBe(1);
        expect(result.stats.total).toBe(1);
        expect(result.stats.correct).toBe(1);
    });

    test('save() should store data to localStorage', () => {
        const testData = { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
        quiz.DB.save(testData);
        
        const stored = localStorage.getItem('jj_quiz_v2');
        expect(stored).toBe(JSON.stringify(testData));
    });

    test('addRecord() should increment stats for correct answer', () => {
        quiz.DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        
        const data = quiz.DB.get();
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
        expect(data.history.length).toBe(1);
    });

    test('addRecord() should increment stats for wrong answer', () => {
        quiz.DB.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
        
        const data = quiz.DB.get();
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(0);
    });

    test('addRecord() should update category stats', () => {
        quiz.DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        
        const data = quiz.DB.get();
        expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
    });

    test('addWrong() should add new wrong question', () => {
        quiz.DB.addWrong('001');
        
        const data = quiz.DB.get();
        expect(data.wrong.length).toBe(1);
        expect(data.wrong[0].qid).toBe('001');
        expect(data.wrong[0].cnt).toBe(1);
    });

    test('addWrong() should increment count for existing wrong question', () => {
        quiz.DB.addWrong('001');
        quiz.DB.addWrong('001');
        
        const data = quiz.DB.get();
        expect(data.wrong.length).toBe(1);
        expect(data.wrong[0].cnt).toBe(2);
    });

    test('removeWrong() should remove wrong question', () => {
        quiz.DB.addWrong('001');
        quiz.DB.removeWrong('001');
        
        const data = quiz.DB.get();
        expect(data.wrong.length).toBe(0);
    });

    test('getWrong() should return all wrong questions', () => {
        quiz.DB.addWrong('001');
        quiz.DB.addWrong('005');
        
        const wrong = quiz.DB.getWrong();
        expect(wrong.length).toBe(2);
        expect(wrong[0].qid).toBe('001');
        expect(wrong[1].qid).toBe('005');
    });

    test('findQ() should find question by id', () => {
        const q = quiz.DB.findQ('001');
        expect(q).not.toBeNull();
        expect(q.id).toBe('001');
        expect(q.question).toBe('林俊杰首张专辑《乐行者》发行于哪一天？');
    });

    test('findQ() should return null for non-existent id', () => {
        const q = quiz.DB.findQ('nonexistent');
        expect(q).toBeNull();
    });
});