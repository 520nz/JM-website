const { DB, QUESTION_BANK } = require('../src/app');

describe('DB Module', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('DB.defaults()', () => {
        it('should return default data structure', () => {
            const defaults = DB.defaults();
            expect(defaults).toEqual({
                history: [],
                wrong: [],
                stats: { total: 0, correct: 0, cats: {} }
            });
        });
    });

    describe('DB.get()', () => {
        it('should return defaults when localStorage is empty', () => {
            const data = DB.get();
            expect(data).toEqual(DB.defaults());
        });

        it('should return parsed data from localStorage', () => {
            const testData = { history: [{ qid: '001', ans: 'A', ok: true, time: Date.now() }], wrong: [], stats: { total: 1, correct: 1, cats: {} } };
            localStorage.setItem(DB.KEY, JSON.stringify(testData));
            const data = DB.get();
            expect(data.history.length).toBe(1);
            expect(data.stats.total).toBe(1);
            expect(data.stats.correct).toBe(1);
        });

        it('should return defaults when localStorage has invalid JSON', () => {
            localStorage.setItem(DB.KEY, 'invalid json');
            const data = DB.get();
            expect(data).toEqual(DB.defaults());
        });
    });

    describe('DB.save()', () => {
        it('should persist data to localStorage', () => {
            const testData = DB.defaults();
            testData.history.push({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            DB.save(testData);
            const saved = localStorage.getItem(DB.KEY);
            expect(saved).toBeTruthy();
            const parsed = JSON.parse(saved);
            expect(parsed.history.length).toBe(1);
        });
    });

    describe('DB.findQ()', () => {
        it('should find question by id', () => {
            const q = DB.findQ('001');
            expect(q).toBeTruthy();
            expect(q.id).toBe('001');
            expect(q.category).toBe('专辑');
        });

        it('should return null for non-existent id', () => {
            const q = DB.findQ('nonexistent');
            expect(q).toBeNull();
        });
    });

    describe('DB.addRecord()', () => {
        it('should add record to history', () => {
            DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            const data = DB.get();
            expect(data.history.length).toBe(1);
            expect(data.history[0].qid).toBe('001');
            expect(data.history[0].ok).toBe(true);
        });

        it('should update stats for correct answer', () => {
            DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            const data = DB.get();
            expect(data.stats.total).toBe(1);
            expect(data.stats.correct).toBe(1);
        });

        it('should update stats for incorrect answer', () => {
            DB.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
            const data = DB.get();
            expect(data.stats.total).toBe(1);
            expect(data.stats.correct).toBe(0);
        });

        it('should update category stats for correct answer', () => {
            DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            const data = DB.get();
            expect(data.stats.cats['专辑']).toBeDefined();
            expect(data.stats.cats['专辑'].t).toBe(1);
            expect(data.stats.cats['专辑'].c).toBe(1);
        });

        it('should update category stats for incorrect answer', () => {
            DB.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
            const data = DB.get();
            expect(data.stats.cats['专辑']).toBeDefined();
            expect(data.stats.cats['专辑'].t).toBe(1);
            expect(data.stats.cats['专辑'].c).toBe(0);
        });

        it('should increment category stats for multiple records', () => {
            DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            DB.addRecord({ qid: '005', ans: 'B', ok: true, time: Date.now() });
            const data = DB.get();
            expect(data.stats.cats['专辑'].t).toBe(2);
            expect(data.stats.cats['专辑'].c).toBe(2);
        });
    });

    describe('DB.addWrong()', () => {
        it('should add new wrong question', () => {
            DB.addWrong('001');
            const data = DB.get();
            expect(data.wrong.length).toBe(1);
            expect(data.wrong[0].qid).toBe('001');
            expect(data.wrong[0].cnt).toBe(1);
        });

        it('should increment count for existing wrong question', () => {
            DB.addWrong('001');
            DB.addWrong('001');
            const data = DB.get();
            expect(data.wrong.length).toBe(1);
            expect(data.wrong[0].cnt).toBe(2);
        });

        it('should update timestamp for existing wrong question', () => {
            const firstTime = Date.now();
            DB.addWrong('001');
            const firstData = DB.get();
            const firstTimestamp = firstData.wrong[0].time;
            
            setTimeout(() => {
                DB.addWrong('001');
                const secondData = DB.get();
                expect(secondData.wrong[0].time).toBeGreaterThan(firstTimestamp);
            }, 10);
        });
    });

    describe('DB.removeWrong()', () => {
        it('should remove existing wrong question', () => {
            DB.addWrong('001');
            DB.removeWrong('001');
            const data = DB.get();
            expect(data.wrong.length).toBe(0);
        });

        it('should do nothing for non-existent wrong question', () => {
            DB.removeWrong('nonexistent');
            const data = DB.get();
            expect(data.wrong.length).toBe(0);
        });
    });

    describe('DB.getWrong()', () => {
        it('should return empty array when no wrong questions', () => {
            const wrong = DB.getWrong();
            expect(wrong).toEqual([]);
        });

        it('should return wrong questions', () => {
            DB.addWrong('001');
            DB.addWrong('002');
            const wrong = DB.getWrong();
            expect(wrong.length).toBe(2);
            expect(wrong[0].qid).toBe('001');
            expect(wrong[1].qid).toBe('002');
        });
    });
});