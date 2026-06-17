var { shuffle, fmtTime, getModeCount, parseOptions, validateQuestion, calculateStats, getTodayRecords, calculateDailyAccuracy, mergeUserData } = require('../src/quiz');

describe('quiz Module', function () {
    describe('shuffle', function () {
        it('should return an array of the same length', function () {
            var arr = [1, 2, 3, 4, 5];
            var result = shuffle(arr);
            expect(result.length).toBe(arr.length);
        });

        it('should contain all original elements', function () {
            var arr = [1, 2, 3, 4, 5];
            var result = shuffle(arr);
            arr.forEach(function (item) {
                expect(result).toContain(item);
            });
        });

        it('should not modify original array', function () {
            var arr = [1, 2, 3];
            var original = arr.slice();
            shuffle(arr);
            expect(arr).toEqual(original);
        });
    });

    describe('fmtTime', function () {
        it('should format 0 milliseconds', function () {
            expect(fmtTime(0)).toBe('0分0秒');
        });

        it('should format seconds correctly', function () {
            expect(fmtTime(5000)).toBe('0分5秒');
            expect(fmtTime(60000)).toBe('1分0秒');
            expect(fmtTime(65000)).toBe('1分5秒');
            expect(fmtTime(3600000)).toBe('60分0秒');
        });
    });

    describe('getModeCount', function () {
        it('should return correct count for quick mode', function () {
            expect(getModeCount('quick')).toBe(10);
        });

        it('should return correct count for standard mode', function () {
            expect(getModeCount('standard')).toBe(20);
        });

        it('should return correct count for intensive mode', function () {
            expect(getModeCount('intensive')).toBe(30);
        });

        it('should return default count for unknown mode', function () {
            expect(getModeCount('unknown')).toBe(10);
        });
    });

    describe('parseOptions', function () {
        it('should parse options correctly', function () {
            var text = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
            var result = parseOptions(text);
            expect(result.length).toBe(4);
            expect(result[0]).toEqual({ key: 'A', text: '选项1' });
            expect(result[1]).toEqual({ key: 'B', text: '选项2' });
        });

        it('should handle different punctuation marks', function () {
            var text = 'A、选项1\nB．选项2\nC.选项3';
            var result = parseOptions(text);
            expect(result.length).toBe(3);
            expect(result[0].text).toBe('选项1');
            expect(result[1].text).toBe('选项2');
            expect(result[2].text).toBe('选项3');
        });

        it('should skip empty lines', function () {
            var text = 'A.选项1\n\nB.选项2';
            var result = parseOptions(text);
            expect(result.length).toBe(2);
        });

        it('should return empty array for invalid format', function () {
            var text = '选项1\n选项2';
            var result = parseOptions(text);
            expect(result.length).toBe(0);
        });
    });

    describe('validateQuestion', function () {
        it('should return true for valid question', function () {
            expect(validateQuestion('测试题', [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }])).toBe(true);
        });

        it('should return false for empty question', function () {
            expect(validateQuestion('', [{ key: 'A', text: '选项A' }])).toBe(false);
        });

        it('should return false for null options', function () {
            expect(validateQuestion('测试题', null)).toBe(false);
        });

        it('should return false for less than 2 options', function () {
            expect(validateQuestion('测试题', [{ key: 'A', text: '选项A' }])).toBe(false);
        });
    });

    describe('calculateStats', function () {
        it('should calculate stats correctly', function () {
            var quiz = [1, 2, 3, 4, 5];
            var startTime = Date.now() - 60000;
            var result = calculateStats(quiz, 3, startTime);
            expect(result.total).toBe(5);
            expect(result.correct).toBe(3);
            expect(result.wrong).toBe(2);
            expect(result.pct).toBe(60);
            expect(result.elapsed).toBeGreaterThanOrEqual(60000);
        });

        it('should handle empty quiz', function () {
            var result = calculateStats([], 0, Date.now());
            expect(result.total).toBe(0);
            expect(result.pct).toBe(0);
        });

        it('should handle all correct', function () {
            var quiz = [1, 2, 3];
            var result = calculateStats(quiz, 3, Date.now());
            expect(result.wrong).toBe(0);
            expect(result.pct).toBe(100);
        });

        it('should handle all wrong', function () {
            var quiz = [1, 2, 3];
            var result = calculateStats(quiz, 0, Date.now());
            expect(result.wrong).toBe(3);
            expect(result.pct).toBe(0);
        });
    });

    describe('getTodayRecords', function () {
        it('should filter records from today', function () {
            var now = Date.now();
            var todayStart = new Date().setHours(0, 0, 0, 0);
            var records = [
                { time: now, ok: true },
                { time: todayStart + 1000, ok: false },
                { time: todayStart - 1000, ok: true }
            ];
            var result = getTodayRecords(records);
            expect(result.length).toBe(2);
        });
    });

    describe('calculateDailyAccuracy', function () {
        it('should calculate accuracy correctly', function () {
            var records = [
                { ok: true },
                { ok: true },
                { ok: false }
            ];
            expect(calculateDailyAccuracy(records)).toBe(67);
        });

        it('should return 0 for empty records', function () {
            expect(calculateDailyAccuracy([])).toBe(0);
        });

        it('should return 100 for all correct', function () {
            var records = [{ ok: true }, { ok: true }];
            expect(calculateDailyAccuracy(records)).toBe(100);
        });

        it('should return 0 for all wrong', function () {
            var records = [{ ok: false }, { ok: false }];
            expect(calculateDailyAccuracy(records)).toBe(0);
        });
    });

    describe('mergeUserData', function () {
        it('should merge history', function () {
            var existing = { history: [{ id: 1 }], wrong: [], stats: {} };
            var newData = { history: [{ id: 2 }] };
            var result = mergeUserData(existing, newData);
            expect(result.history.length).toBe(2);
        });

        it('should merge wrong questions and increment counts', function () {
            var existing = { history: [], wrong: [{ qid: '001', cnt: 1 }], stats: {} };
            var newData = { wrong: [{ qid: '001', cnt: 2 }, { qid: '002', cnt: 1 }] };
            var result = mergeUserData(existing, newData);
            expect(result.wrong.length).toBe(2);
            var q001 = result.wrong.find(function (w) { return w.qid === '001'; });
            var q002 = result.wrong.find(function (w) { return w.qid === '002'; });
            expect(q001.cnt).toBe(3);
            expect(q002.cnt).toBe(1);
        });

        it('should merge stats', function () {
            var existing = { history: [], wrong: [], stats: { total: 5, correct: 3, cats: { '专辑': { t: 3, c: 2 } } } };
            var newData = { stats: { total: 10, correct: 7, cats: { '专辑': { t: 2, c: 2 }, '歌曲': { t: 5, c: 3 } } } };
            var result = mergeUserData(existing, newData);
            expect(result.stats.total).toBe(15);
            expect(result.stats.correct).toBe(10);
            expect(result.stats.cats['专辑']).toEqual({ t: 5, c: 4 });
            expect(result.stats.cats['歌曲']).toEqual({ t: 5, c: 3 });
        });

        it('should handle null newUserData', function () {
            var existing = { history: [], wrong: [], stats: {} };
            var result = mergeUserData(existing, null);
            expect(result).toBe(existing);
        });
    });
});
