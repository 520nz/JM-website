/**
 * DB模块单元测试
 * 测试覆盖：数据存取、答题记录、错题管理、统计功能
 */

// 测试用题库
const mockQuestionBank = [
    {
        id: '001',
        category: '专辑',
        question: '林俊杰首张专辑《乐行者》发行于哪一天？',
        options: [
            { key: 'A', text: '2003年4月1日' },
            { key: 'B', text: '2003年4月10日' },
            { key: 'C', text: '2003年5月1日' },
            { key: 'D', text: '2003年5月10日' }
        ],
        answer: 'B',
        explanation: '《乐行者》于2003年4月10日正式发行'
    },
    {
        id: '002',
        category: '歌曲',
        question: '《江南》的作曲人是谁？',
        options: [
            { key: 'A', text: '林俊杰' },
            { key: 'B', text: '张思尔' },
            { key: 'C', text: '李瑞洵' },
            { key: 'D', text: '方文山' }
        ],
        answer: 'A',
        explanation: '《江南》由林俊杰作曲'
    },
    {
        id: '003',
        category: '专辑',
        question: '《曹操》发行于哪一年？',
        options: [
            { key: 'A', text: '2004年' },
            { key: 'B', text: '2005年' },
            { key: 'C', text: '2006年' },
            { key: 'D', text: '2007年' }
        ],
        answer: 'C',
        explanation: '《曹操》于2006年发行'
    }
];

// 设置全局localStorage mock
const localStorageMock = {
    store: {},
    getItem: function(key) { return this.store[key] || null; },
    setItem: function(key, value) { this.store[key] = value; },
    removeItem: function(key) { delete this.store[key]; },
    clear: function() { this.store = {}; }
};

global.localStorage = localStorageMock;

// 在顶层加载DB模块
const DB = require('../js/db.js');

describe('DB模块', () => {
    // 每个测试前清除数据
    beforeEach(() => {
        localStorageMock.store = {};
    });

    test('defaults()应返回正确的默认数据结构', () => {
        const defaults = DB.defaults();

        expect(defaults).toHaveProperty('history');
        expect(defaults).toHaveProperty('wrong');
        expect(defaults).toHaveProperty('stats');
        expect(Array.isArray(defaults.history)).toBe(true);
        expect(Array.isArray(defaults.wrong)).toBe(true);
        expect(defaults.stats).toHaveProperty('total', 0);
        expect(defaults.stats).toHaveProperty('correct', 0);
        expect(defaults.stats).toHaveProperty('cats');
    });

    test('get()当localStorage为空时应返回默认数据', () => {
        const data = DB.get();
        expect(data).toEqual(DB.defaults());
    });

    test('save()应正确保存和读取数据', () => {
        const testData = {
            history: [{ qid: '001', ans: 'B', ok: true, time: Date.now() }],
            wrong: [],
            stats: { total: 1, correct: 1, cats: {} }
        };

        DB.save(testData);
        const retrieved = DB.get();

        expect(retrieved.history.length).toBe(1);
        expect(retrieved.history[0].qid).toBe('001');
        expect(retrieved.stats.total).toBe(1);
    });

    test('addRecord()应正确添加答题记录', () => {
        const record = {
            qid: '001',
            ans: 'B',
            ok: true,
            time: Date.now()
        };

        DB.addRecord(record, mockQuestionBank);
        const data = DB.get();

        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
    });

    test('addRecord()应正确更新分类统计', () => {
        const record = {
            qid: '001',
            ans: 'B',
            ok: true,
            time: Date.now()
        };

        DB.addRecord(record, mockQuestionBank);
        const data = DB.get();

        expect(data.stats.cats['专辑']).toBeDefined();
        expect(data.stats.cats['专辑'].t).toBe(1);
        expect(data.stats.cats['专辑'].c).toBe(1);
    });

    test('addRecord()错误答案应只增加总数不增加正确数', () => {
        const record = {
            qid: '001',
            ans: 'A',
            ok: false,
            time: Date.now()
        };

        DB.addRecord(record, mockQuestionBank);
        const data = DB.get();

        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(0);
        expect(data.stats.cats['专辑'].t).toBe(1);
        expect(data.stats.cats['专辑'].c).toBe(0);
    });

    test('addRecord()多个分类应分别统计', () => {
        DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() }, mockQuestionBank);
        DB.addRecord({ qid: '002', ans: 'A', ok: true, time: Date.now() }, mockQuestionBank);

        const data = DB.get();

        expect(data.stats.cats['专辑'].t).toBe(1);
        expect(data.stats.cats['歌曲'].t).toBe(1);
        expect(data.stats.total).toBe(2);
    });

    test('addWrong()应添加新的错题记录', () => {
        DB.addWrong('001');
        const wrongList = DB.getWrong();

        expect(wrongList.length).toBe(1);
        expect(wrongList[0].qid).toBe('001');
        expect(wrongList[0].cnt).toBe(1);
    });

    test('addWrong()重复错题应增加计数', () => {
        DB.addWrong('001');
        DB.addWrong('001');
        const wrongList = DB.getWrong();

        expect(wrongList.length).toBe(1);
        expect(wrongList[0].cnt).toBe(2);
    });

    test('addWrong()不同错题应分别记录', () => {
        DB.addWrong('001');
        DB.addWrong('002');
        const wrongList = DB.getWrong();

        expect(wrongList.length).toBe(2);
    });

    test('removeWrong()应正确移除错题', () => {
        DB.addWrong('001');
        DB.addWrong('002');
        DB.removeWrong('001');

        const wrongList = DB.getWrong();
        expect(wrongList.length).toBe(1);
        expect(wrongList[0].qid).toBe('002');
    });

    test('removeWrong()移除不存在的错题不应报错', () => {
        DB.addWrong('001');
        DB.removeWrong('999');

        const wrongList = DB.getWrong();
        expect(wrongList.length).toBe(1);
    });

    test('findQ()应正确查找存在的题目', () => {
        const q = DB.findQ('001', mockQuestionBank);
        expect(q).not.toBeNull();
        expect(q.id).toBe('001');
        expect(q.category).toBe('专辑');
    });

    test('findQ()查找不存在的题目应返回null', () => {
        const q = DB.findQ('999', mockQuestionBank);
        expect(q).toBeNull();
    });

    test('findQ()空题库应返回null', () => {
        const q = DB.findQ('001', []);
        expect(q).toBeNull();
    });

    test('saveQuestionBank()和loadQuestionBank()应正确保存和加载题库', () => {
        DB.saveQuestionBank(mockQuestionBank);
        const loaded = DB.loadQuestionBank();

        expect(loaded).not.toBeNull();
        expect(loaded.length).toBe(3);
        expect(loaded[0].id).toBe('001');
    });

    test('loadQuestionBank()加载空题库应返回null', () => {
        const loaded = DB.loadQuestionBank();
        expect(loaded).toBeNull();
    });

    test('clear()应清除所有数据', () => {
        DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() }, mockQuestionBank);
        DB.addWrong('002');
        DB.clear();

        const data = DB.get();
        expect(data).toEqual(DB.defaults());
    });
});
