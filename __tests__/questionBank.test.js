const quiz = require('../js/quiz');

describe('Question Bank Management', () => {
    beforeEach(() => {
        quiz.resetForTest();
    });

    test('saveQuestionBank() should store question bank to localStorage', () => {
        quiz.saveQuestionBank();
        
        const stored = localStorage.getItem('jj_question_bank');
        expect(stored).toBe(JSON.stringify(quiz.QUESTION_BANK));
    });

    test('loadQuestionBank() should load question bank from localStorage', () => {
        const testQuestions = [{ id: 'test001', category: '测试', question: '测试题', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], answer: 'A', explanation: '解释' }];
        localStorage.setItem('jj_question_bank', JSON.stringify(testQuestions));
        
        quiz.loadQuestionBank();
        
        expect(quiz.QUESTION_BANK.length).toBe(1);
        expect(quiz.QUESTION_BANK[0].id).toBe('test001');
    });

    test('loadQuestionBank() should handle invalid JSON gracefully', () => {
        localStorage.setItem('jj_question_bank', 'invalid json');
        
        quiz.loadQuestionBank();
        
        expect(quiz.QUESTION_BANK.length).toBeGreaterThan(0);
    });

    test('resetQuestionBank() should restore default question bank', () => {
        quiz.QUESTION_BANK.push({ id: 'new001', category: '新增', question: '新增题', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' });
        
        quiz.resetQuestionBank();
        
        expect(quiz.QUESTION_BANK.length).toBe(quiz.DEFAULT_QUESTION_BANK.length);
        expect(localStorage.getItem('jj_question_bank')).toBeNull();
    });

    test('mergeImportedData() should add new questions', () => {
        const originalLength = quiz.QUESTION_BANK.length;
        const importData = {
            questionBank: [{ id: 'new001', category: '新增', question: '新增题', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' }]
        };
        
        const result = quiz.mergeImportedData(importData);
        
        expect(result.addedCount).toBe(1);
        expect(result.updatedCount).toBe(0);
        expect(quiz.QUESTION_BANK.length).toBe(originalLength + 1);
    });

    test('mergeImportedData() should update existing questions', () => {
        const importData = {
            questionBank: [{ id: '001', category: '专辑', question: '修改后的问题', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '修改后的解释' }]
        };
        
        const result = quiz.mergeImportedData(importData);
        
        expect(result.addedCount).toBe(0);
        expect(result.updatedCount).toBe(1);
        expect(quiz.QUESTION_BANK.find(q => q.id === '001').question).toBe('修改后的问题');
    });

    test('mergeImportedData() should merge user history', () => {
        const importData = {
            userData: {
                history: [{ qid: '001', ans: 'A', ok: false, time: Date.now() }],
                stats: { total: 1, correct: 0, cats: {} }
            }
        };
        
        quiz.mergeImportedData(importData);
        
        const data = quiz.DB.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(0);
    });

    test('mergeImportedData() should merge wrong questions with count increment', () => {
        quiz.DB.addWrong('001');
        
        const importData = {
            userData: {
                wrong: [{ qid: '001', cnt: 2, time: Date.now() }]
            }
        };
        
        quiz.mergeImportedData(importData);
        
        const data = quiz.DB.get();
        expect(data.wrong.length).toBe(1);
        expect(data.wrong[0].cnt).toBe(3);
    });

    test('mergeImportedData() should merge category stats', () => {
        const importData = {
            userData: {
                stats: {
                    total: 10,
                    correct: 6,
                    cats: { '专辑': { t: 5, c: 3 }, '歌曲': { t: 5, c: 3 } }
                }
            }
        };
        
        quiz.mergeImportedData(importData);
        
        const data = quiz.DB.get();
        expect(data.stats.total).toBe(10);
        expect(data.stats.correct).toBe(6);
        expect(data.stats.cats['专辑']).toEqual({ t: 5, c: 3 });
        expect(data.stats.cats['歌曲']).toEqual({ t: 5, c: 3 });
    });

    test('mergeImportedData() should handle empty data gracefully', () => {
        const result = quiz.mergeImportedData({});
        
        expect(result.addedCount).toBe(0);
        expect(result.updatedCount).toBe(0);
    });
});