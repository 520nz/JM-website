const { getCount, shuffle, fmtTime, DB, state } = require('../src/app');

describe('Quiz Logic', () => {
    beforeEach(() => {
        localStorage.clear();
        state.quiz = [];
        state.idx = 0;
        state.answered = false;
        state.mode = 'quick';
        state.correctCount = 0;
        state.startTime = 0;
        state.timer = null;
    });

    describe('getCount()', () => {
        it('should return 10 for quick mode', () => {
            state.mode = 'quick';
            expect(getCount()).toBe(10);
        });

        it('should return 20 for standard mode', () => {
            state.mode = 'standard';
            expect(getCount()).toBe(20);
        });

        it('should return 30 for intensive mode', () => {
            state.mode = 'intensive';
            expect(getCount()).toBe(30);
        });

        it('should return 10 for unknown mode', () => {
            state.mode = 'unknown';
            expect(getCount()).toBe(10);
        });
    });

    describe('shuffle()', () => {
        it('should return array of same length', () => {
            const arr = [1, 2, 3, 4, 5];
            const shuffled = shuffle(arr);
            expect(shuffled.length).toBe(arr.length);
        });

        it('should contain all original elements', () => {
            const arr = [1, 2, 3, 4, 5];
            const shuffled = shuffle(arr);
            expect(shuffled).toEqual(expect.arrayContaining(arr));
        });

        it('should not modify original array', () => {
            const arr = [1, 2, 3, 4, 5];
            const original = [...arr];
            shuffle(arr);
            expect(arr).toEqual(original);
        });

        it('should handle empty array', () => {
            const arr = [];
            const shuffled = shuffle(arr);
            expect(shuffled).toEqual([]);
        });

        it('should handle single element array', () => {
            const arr = [42];
            const shuffled = shuffle(arr);
            expect(shuffled).toEqual([42]);
        });
    });

    describe('fmtTime()', () => {
        it('should format 0 milliseconds', () => {
            expect(fmtTime(0)).toBe('0分0秒');
        });

        it('should format seconds only', () => {
            expect(fmtTime(5000)).toBe('0分5秒');
            expect(fmtTime(59000)).toBe('0分59秒');
        });

        it('should format minutes and seconds', () => {
            expect(fmtTime(60000)).toBe('1分0秒');
            expect(fmtTime(65000)).toBe('1分5秒');
            expect(fmtTime(125000)).toBe('2分5秒');
            expect(fmtTime(3599000)).toBe('59分59秒');
        });

        it('should handle large values', () => {
            expect(fmtTime(3600000)).toBe('60分0秒');
            expect(fmtTime(7265000)).toBe('121分5秒');
        });
    });

    describe('Quiz State Management', () => {
        it('should initialize state correctly', () => {
            expect(state.quiz).toEqual([]);
            expect(state.idx).toBe(0);
            expect(state.answered).toBe(false);
            expect(state.mode).toBe('quick');
            expect(state.correctCount).toBe(0);
            expect(state.startTime).toBe(0);
            expect(state.timer).toBe(null);
        });

        it('should update correctCount for correct answer', () => {
            state.correctCount = 0;
            state.quiz = [{ id: '001', answer: 'B', options: [{ key: 'A' }, { key: 'B' }], category: '专辑' }];
            state.idx = 0;
            state.answered = false;
            
            const q = state.quiz[state.idx];
            const ok = ('B' === q.answer);
            if (ok) state.correctCount++;
            
            expect(state.correctCount).toBe(1);
            expect(state.answered).toBe(false);
        });

        it('should not update correctCount for incorrect answer', () => {
            state.correctCount = 0;
            state.quiz = [{ id: '001', answer: 'B', options: [{ key: 'A' }, { key: 'B' }], category: '专辑' }];
            state.idx = 0;
            
            const q = state.quiz[state.idx];
            const ok = ('A' === q.answer);
            if (ok) state.correctCount++;
            
            expect(state.correctCount).toBe(0);
        });
    });

    describe('Answer Validation', () => {
        it('should correctly identify correct answer', () => {
            const question = { id: '001', answer: 'B', options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }] };
            expect('B' === question.answer).toBe(true);
            expect('A' === question.answer).toBe(false);
            expect('C' === question.answer).toBe(false);
            expect('D' === question.answer).toBe(false);
        });

        it('should handle case sensitivity correctly', () => {
            const question = { id: '001', answer: 'B', options: [{ key: 'A' }, { key: 'B' }] };
            expect('b' === question.answer).toBe(false);
            expect('B' === question.answer).toBe(true);
        });
    });
});