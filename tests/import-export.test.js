const { DB, QUESTION_BANK, importDataInternal } = require('../src/app');

describe('Import/Export Logic', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('importDataInternal()', () => {
        it('should return error when no valid data', () => {
            const result = importDataInternal({});
            expect(result.success).toBe(false);
            expect(result.message).toBe('文件中未找到有效数据');
        });

        it('should import question bank with new questions', () => {
            const initialLength = QUESTION_BANK.length;
            const newQuestions = [{
                id: 'new001',
                category: '测试',
                question: '测试题目',
                options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }],
                answer: 'A',
                explanation: '测试解析'
            }];
            
            const result = importDataInternal({ questionBank: newQuestions });
            
            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(1);
            expect(result.updatedCount).toBe(0);
            expect(QUESTION_BANK.length).toBe(initialLength + 1);
            expect(QUESTION_BANK.find(q => q.id === 'new001')).toBeTruthy();
        });

        it('should update existing questions', () => {
            const existingQuestion = QUESTION_BANK.find(q => q.id === '001');
            const originalQuestion = existingQuestion.question;
            
            const result = importDataInternal({
                questionBank: [{
                    id: '001',
                    category: '专辑',
                    question: '修改后的测试题目',
                    options: existingQuestion.options,
                    answer: existingQuestion.answer,
                    explanation: existingQuestion.explanation
                }]
            });
            
            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(0);
            expect(result.updatedCount).toBe(1);
            expect(QUESTION_BANK.find(q => q.id === '001').question).toBe('修改后的测试题目');
            expect(QUESTION_BANK.find(q => q.id === '001').question).not.toBe(originalQuestion);
        });

        it('should import user data history', () => {
            const testHistory = [{ qid: '001', ans: 'B', ok: true, time: Date.now() }];
            
            const result = importDataInternal({ userData: { history: testHistory } });
            
            expect(result.success).toBe(true);
            const data = DB.get();
            expect(data.history.length).toBe(1);
            expect(data.history[0].qid).toBe('001');
        });

        it('should merge user data history', () => {
            DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            
            const testHistory = [{ qid: '002', ans: 'A', ok: false, time: Date.now() }];
            const result = importDataInternal({ userData: { history: testHistory } });
            
            expect(result.success).toBe(true);
            const data = DB.get();
            expect(data.history.length).toBe(2);
        });

        it('should import user data wrong questions', () => {
            const testWrong = [{ qid: '001', cnt: 2, time: Date.now() }];
            
            const result = importDataInternal({ userData: { wrong: testWrong } });
            
            expect(result.success).toBe(true);
            const data = DB.get();
            expect(data.wrong.length).toBe(1);
            expect(data.wrong[0].qid).toBe('001');
            expect(data.wrong[0].cnt).toBe(2);
        });

        it('should merge wrong questions counts', () => {
            DB.addWrong('001');
            
            const testWrong = [{ qid: '001', cnt: 3, time: Date.now() }];
            const result = importDataInternal({ userData: { wrong: testWrong } });
            
            expect(result.success).toBe(true);
            const data = DB.get();
            expect(data.wrong.length).toBe(1);
            expect(data.wrong[0].cnt).toBe(4);
        });

        it('should import user data stats', () => {
            const testStats = { total: 10, correct: 7, cats: { '专辑': { t: 5, c: 4 } } };
            
            const result = importDataInternal({ userData: { stats: testStats } });
            
            expect(result.success).toBe(true);
            const data = DB.get();
            expect(data.stats.total).toBe(10);
            expect(data.stats.correct).toBe(7);
            expect(data.stats.cats['专辑'].t).toBe(5);
            expect(data.stats.cats['专辑'].c).toBe(4);
        });

        it('should merge user data stats', () => {
            DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            
            const testStats = { total: 5, correct: 3, cats: { '歌曲': { t: 3, c: 2 } } };
            const result = importDataInternal({ userData: { stats: testStats } });
            
            expect(result.success).toBe(true);
            const data = DB.get();
            expect(data.stats.total).toBe(6);
            expect(data.stats.correct).toBe(4);
        });

        it('should merge category stats', () => {
            DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            
            const testStats = { cats: { '专辑': { t: 2, c: 1 } } };
            const result = importDataInternal({ userData: { stats: testStats } });
            
            expect(result.success).toBe(true);
            const data = DB.get();
            expect(data.stats.cats['专辑'].t).toBe(3);
            expect(data.stats.cats['专辑'].c).toBe(2);
        });

        it('should handle empty question bank array', () => {
            const result = importDataInternal({ questionBank: [] });
            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(0);
            expect(result.updatedCount).toBe(0);
        });

        it('should handle empty user data', () => {
            const result = importDataInternal({ userData: {} });
            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(0);
            expect(result.updatedCount).toBe(0);
        });
    });
});