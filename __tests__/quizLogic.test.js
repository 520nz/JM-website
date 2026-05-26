const quiz = require('../js/quiz');

describe('Quiz Logic', () => {
    beforeEach(() => {
        quiz.resetForTest();
    });

    describe('validateAnswer', () => {
        test('should return true for correct answer', () => {
            const question = { id: '001', answer: 'B' };
            expect(quiz.validateAnswer('B', question)).toBe(true);
        });

        test('should return false for wrong answer', () => {
            const question = { id: '001', answer: 'B' };
            expect(quiz.validateAnswer('A', question)).toBe(false);
        });

        test('should be case-sensitive', () => {
            const question = { id: '001', answer: 'B' };
            expect(quiz.validateAnswer('b', question)).toBe(false);
        });
    });

    describe('calculateAccuracy', () => {
        test('should calculate accuracy correctly', () => {
            expect(quiz.calculateAccuracy(5, 10)).toBe(50);
            expect(quiz.calculateAccuracy(3, 4)).toBe(75);
            expect(quiz.calculateAccuracy(0, 10)).toBe(0);
        });

        test('should handle division by zero', () => {
            expect(quiz.calculateAccuracy(0, 0)).toBe(0);
            expect(quiz.calculateAccuracy(5, 0)).toBe(0);
        });

        test('should round to nearest integer', () => {
            expect(quiz.calculateAccuracy(1, 3)).toBe(33);
            expect(quiz.calculateAccuracy(2, 3)).toBe(67);
            expect(quiz.calculateAccuracy(1, 6)).toBe(17);
        });
    });

    describe('shuffle', () => {
        test('should return an array of the same length', () => {
            const arr = [1, 2, 3, 4, 5];
            const shuffled = quiz.shuffle(arr);
            
            expect(shuffled.length).toBe(arr.length);
        });

        test('should contain the same elements', () => {
            const arr = [1, 2, 3, 4, 5];
            const shuffled = quiz.shuffle(arr);
            
            expect(shuffled.sort()).toEqual(arr.sort());
        });

        test('should not modify original array', () => {
            const arr = [1, 2, 3];
            const original = [...arr];
            
            quiz.shuffle(arr);
            
            expect(arr).toEqual(original);
        });

        test('should work with empty array', () => {
            expect(quiz.shuffle([])).toEqual([]);
        });

        test('should work with single element', () => {
            expect(quiz.shuffle([42])).toEqual([42]);
        });
    });

    describe('getTodayRecords', () => {
        test('should return today records', () => {
            const today = Date.now();
            quiz.DB.addRecord({ qid: '001', ans: 'B', ok: true, time: today });
            quiz.DB.addRecord({ qid: '005', ans: 'A', ok: false, time: today });
            
            const records = quiz.getTodayRecords();
            expect(records.length).toBe(2);
        });

        test('should filter out past records', () => {
            const yesterday = Date.now() - 24 * 60 * 60 * 1000;
            quiz.DB.addRecord({ qid: '001', ans: 'B', ok: true, time: yesterday });
            
            const records = quiz.getTodayRecords();
            expect(records.length).toBe(0);
        });
    });

    describe('getCategoryStats', () => {
        test('should return category stats', () => {
            quiz.DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
            quiz.DB.addRecord({ qid: '005', ans: 'A', ok: false, time: Date.now() });
            
            const stats = quiz.getCategoryStats();
            expect(stats['专辑']).toEqual({ t: 2, c: 1 });
        });

        test('should return empty object when no stats', () => {
            const stats = quiz.getCategoryStats();
            expect(stats).toEqual({});
        });
    });

    describe('state management', () => {
        test('should initialize state correctly', () => {
            expect(quiz.state.quiz).toEqual([]);
            expect(quiz.state.idx).toBe(0);
            expect(quiz.state.answered).toBe(false);
            expect(quiz.state.mode).toBe('quick');
            expect(quiz.state.correctCount).toBe(0);
            expect(quiz.state.startTime).toBe(0);
            expect(quiz.state.timer).toBe(null);
        });
    });
});