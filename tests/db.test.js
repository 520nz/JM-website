/**
 * 数据库管理模块测试
 * 测试覆盖：数据存储、答题记录、错题管理、统计计算
 */

// 强制重新加载模块，确保独立的localStorage实例
jest.resetModules();

const localStorageMock = require('./__mocks__/localStorage.js');
global.localStorage = localStorageMock;

const DB = require('../src/db.js');

// Mock题库
const mockQuestionBank = [
    { id: '001', category: '专辑', question: '测试题目1', answer: 'A' },
    { id: '002', category: '歌曲', question: '测试题目2', answer: 'B' },
    { id: '003', category: '专辑', question: '测试题目3', answer: 'C' }
];

describe('DB模块', () => {
    // 在整个测试套件开始前清除
    beforeAll(() => {
        localStorageMock.clear();
    });

    // 在每个测试前清除
    beforeEach(() => {
        localStorageMock.clear();
    });

    afterEach(() => {
        localStorageMock.clear();
    });

    // 在整个测试套件结束后清除
    afterAll(() => {
        localStorageMock.clear();
    });

    describe('基础数据操作', () => {
        test('应该返回默认数据结构', () => {
            const data = DB.get();
            expect(data).toEqual({
                history: [],
                wrong: [],
                stats: {
                    total: 0,
                    correct: 0,
                    cats: {}
                }
            });
        });

        test('应该正确保存和读取数据', () => {
            const testData = {
                history: [{ qid: '001', ans: 'A', ok: true, time: Date.now() }],
                wrong: [],
                stats: { total: 1, correct: 1, cats: {} }
            };
            DB.save(testData);
            const loaded = DB.get();
            expect(loaded.history.length).toBe(1);
            expect(loaded.stats.total).toBe(1);
        });

        test('defaults()应该返回正确的默认结构', () => {
            const defaults = DB.defaults();
            expect(defaults.history).toEqual([]);
            expect(defaults.wrong).toEqual([]);
            expect(defaults.stats.total).toBe(0);
        });
    });

    describe('答题记录管理', () => {
        test('应该正确添加答题记录', () => {
            const rec = {
                qid: '001',
                ans: 'A',
                ok: true,
                time: Date.now()
            };
            DB.addRecord(rec, mockQuestionBank);

            const data = DB.get();
            expect(data.history.length).toBe(1);
            expect(data.stats.total).toBe(1);
            expect(data.stats.correct).toBe(1);
        });

        test('应该正确统计分类数据', () => {
            const rec1 = { qid: '001', ans: 'A', ok: true, time: Date.now() };
            const rec2 = { qid: '002', ans: 'B', ok: false, time: Date.now() };

            DB.addRecord(rec1, mockQuestionBank);
            DB.addRecord(rec2, mockQuestionBank);

            const data = DB.get();
            expect(data.stats.cats['专辑']).toBeDefined();
            expect(data.stats.cats['专辑'].t).toBe(1);
            expect(data.stats.cats['专辑'].c).toBe(1);
            expect(data.stats.cats['歌曲'].t).toBe(1);
            expect(data.stats.cats['歌曲'].c).toBe(0);
        });

        test('应该处理找不到题目的情况', () => {
            const rec = { qid: '999', ans: 'A', ok: true, time: Date.now() };
            DB.addRecord(rec, mockQuestionBank);

            const data = DB.get();
            expect(data.history.length).toBe(1);
            expect(data.stats.total).toBe(1);
            // 分类统计不应该增加
            expect(Object.keys(data.stats.cats).length).toBe(0);
        });
    });

    describe('错题管理', () => {
        test('应该正确添加新错题', () => {
            DB.addWrong('001');
            const wrongList = DB.getWrong();
            expect(wrongList.length).toBe(1);
            expect(wrongList[0].qid).toBe('001');
            expect(wrongList[0].cnt).toBe(1);
        });

        test('应该正确累加错题次数', () => {
            DB.addWrong('001');
            DB.addWrong('001');
            DB.addWrong('001');

            const wrongList = DB.getWrong();
            expect(wrongList.length).toBe(1);
            expect(wrongList[0].cnt).toBe(3);
        });

        test('应该正确移除错题', () => {
            DB.addWrong('001');
            DB.addWrong('002');
            DB.removeWrong('001');

            const wrongList = DB.getWrong();
            expect(wrongList.length).toBe(1);
            expect(wrongList[0].qid).toBe('002');
        });

        test('移除不存在的错题应该不报错', () => {
            DB.addWrong('001');
            DB.removeWrong('999'); // 不存在的ID

            const wrongList = DB.getWrong();
            expect(wrongList.length).toBe(1);
        });
    });

    describe('题目查找', () => {
        test('应该正确查找存在的题目', () => {
            const q = DB.findQ('001', mockQuestionBank);
            expect(q).toBeDefined();
            expect(q.id).toBe('001');
            expect(q.category).toBe('专辑');
        });

        test('查找不存在的题目应该返回null', () => {
            const q = DB.findQ('999', mockQuestionBank);
            expect(q).toBeNull();
        });
    });

    describe('统计计算', () => {
        beforeEach(() => {
            // 添加一些测试数据
            const today = new Date().setHours(0, 0, 0, 0);
            const yesterday = today - 24 * 60 * 60 * 1000;

            DB.addRecord({ qid: '001', ans: 'A', ok: true, time: today }, mockQuestionBank);
            DB.addRecord({ qid: '002', ans: 'B', ok: false, time: today }, mockQuestionBank);
            DB.addRecord({ qid: '003', ans: 'C', ok: true, time: yesterday }, mockQuestionBank);
        });

        test('应该正确计算今日统计', () => {
            const stats = DB.getTodayStats();
            expect(stats.count).toBe(2);
            expect(stats.correctCount).toBe(1);
            expect(stats.accuracy).toBe(50);
        });

        test('应该正确计算总体统计', () => {
            const stats = DB.getTotalStats();
            expect(stats.total).toBe(3);
            expect(stats.correct).toBe(2);
            expect(stats.accuracy).toBe(67);
        });

        test('空数据时统计应该返回零值', () => {
            localStorageMock.clear();
            const todayStats = DB.getTodayStats();
            expect(todayStats.count).toBe(0);
            expect(todayStats.accuracy).toBe(0);

            const totalStats = DB.getTotalStats();
            expect(totalStats.total).toBe(0);
            expect(totalStats.accuracy).toBe(0);
        });
    });

    describe('数据清理', () => {
        test('clear()应该清除所有数据', () => {
            DB.addRecord({ qid: '001', ans: 'A', ok: true, time: Date.now() }, mockQuestionBank);
            DB.addWrong('002');

            DB.clear();

            const data = DB.get();
            expect(data.history.length).toBe(0);
            expect(data.wrong.length).toBe(0);
            expect(data.stats.total).toBe(0);
        });
    });

    describe('边界条件测试', () => {
        beforeEach(() => {
            localStorageMock.clear();
        });

        test('应该处理大量答题记录', () => {
            for (let i = 0; i < 100; i++) {
                DB.addRecord({
                    qid: '001',
                    ans: 'A',
                    ok: i % 2 === 0,
                    time: Date.now() + i
                }, mockQuestionBank);
            }

            const data = DB.get();
            expect(data.history.length).toBe(100);
            expect(data.stats.total).toBe(100);
            expect(data.stats.correct).toBe(50);
        });

        test('应该处理大量错题记录', () => {
            for (let i = 0; i < 50; i++) {
                DB.addWrong('q' + i);
            }

            const wrongList = DB.getWrong();
            expect(wrongList.length).toBe(50);
        });

        test('应该处理损坏的localStorage数据', () => {
            localStorageMock.clear();
            localStorageMock.setItem(DB.KEY, 'invalid json string');
            const data = DB.get();
            expect(data).toEqual(DB.defaults());
        });
    });
});