var { DB, initQuestionBank, setQuestionBank, getQuestionBank, getDefaultQuestionBank } = require('../src/storage');

describe('DB Module', function () {
    beforeEach(function () {
        localStorage.clear();
        initQuestionBank([
            { id: '001', category: '专辑', question: '测试题1', options: [{ key: 'A', text: '选项A' }], answer: 'A', explanation: '解析' },
            { id: '002', category: '歌曲', question: '测试题2', options: [{ key: 'A', text: '选项A' }], answer: 'B', explanation: '解析' }
        ]);
    });

    it('should return default data when no data exists', function () {
        var data = DB.get();
        expect(data.history).toEqual([]);
        expect(data.wrong).toEqual([]);
        expect(data.stats).toEqual({ total: 0, correct: 0, cats: {} });
    });

    it('should save data to localStorage', function () {
        var testData = { history: [], wrong: [], stats: { total: 5, correct: 3, cats: {} } };
        DB.save(testData);
        var saved = localStorage.getItem(DB.KEY);
        expect(saved).toBe(JSON.stringify(testData));
    });

    it('should add record and update stats correctly for correct answer', function () {
        DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() });
        var data = DB.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
        expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
    });

    it('should add record and update stats correctly for wrong answer', function () {
        DB.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() });
        var data = DB.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(0);
        expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 0 });
    });

    it('should handle unknown question id in addRecord', function () {
        DB.addRecord({ qid: 'unknown', ans: 'A', ok: true, time: Date.now() });
        var data = DB.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
        expect(Object.keys(data.stats.cats).length).toBe(0);
    });

    it('should add wrong question', function () {
        DB.addWrong('001');
        var wrong = DB.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].qid).toBe('001');
        expect(wrong[0].cnt).toBe(1);
    });

    it('should increment count when adding existing wrong question', function () {
        DB.addWrong('001');
        DB.addWrong('001');
        var wrong = DB.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].cnt).toBe(2);
    });

    it('should remove wrong question', function () {
        DB.addWrong('001');
        DB.addWrong('002');
        DB.removeWrong('001');
        var wrong = DB.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].qid).toBe('002');
    });

    it('should find question by id', function () {
        var q = DB.findQ('001');
        expect(q).not.toBeNull();
        expect(q.id).toBe('001');
        expect(q.category).toBe('专辑');
    });

    it('should return null for non-existent question id', function () {
        var q = DB.findQ('999');
        expect(q).toBeNull();
    });

    it('should save and load question bank', function () {
        var bank = getQuestionBank();
        DB.saveQuestionBank();
        setQuestionBank([]);
        DB.loadQuestionBank();
        var loaded = getQuestionBank();
        expect(loaded.length).toBe(bank.length);
        expect(loaded[0].id).toBe('001');
    });

    it('should reset question bank to default', function () {
        var defaultBank = getDefaultQuestionBank();
        setQuestionBank([{ id: 'custom', category: '测试', question: '自定义', options: [], answer: 'A', explanation: '' }]);
        DB.saveQuestionBank();
        var count = DB.resetQuestionBank();
        expect(count).toBe(defaultBank.length);
        expect(getQuestionBank().length).toBe(defaultBank.length);
        expect(getQuestionBank()[0].id).toBe('001');
        expect(localStorage.getItem('jj_question_bank')).toBeNull();
    });
});
