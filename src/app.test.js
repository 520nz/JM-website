const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
    store: {},
    getItem: function(key) { return this.store[key] || null; },
    setItem: function(key, value) { this.store[key] = value; },
    removeItem: function(key) { delete this.store[key]; },
    clear: function() { this.store = {}; }
};

const app = require('./app');

beforeEach(() => {
    global.localStorage.clear();
    app.QUESTION_BANK = app.DEFAULT_QUESTION_BANK.slice();
});

describe('DB模块', () => {
    test('defaults 返回默认数据结构', () => {
        const defaults = app.DB.defaults();
        expect(defaults).toEqual({
            history: [],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} }
        });
    });

    test('get 返回默认数据当localStorage为空时', () => {
        const data = app.DB.get();
        expect(data).toEqual({
            history: [],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} }
        });
    });

    test('save 和 get 可以正确存储和读取数据', () => {
        const testData = { history: [{ qid: '001', ans: 'B', ok: true }], wrong: [], stats: { total: 1, correct: 1, cats: {} } };
        app.DB.save(testData);
        const retrieved = app.DB.get();
        expect(retrieved).toEqual(testData);
    });

    test('addRecord 添加答题记录并更新统计', () => {
        app.DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        const data = app.DB.get();
        expect(data.history.length).toBe(1);
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
        expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 1 });
    });

    test('addRecord 添加错题记录不影响正确统计', () => {
        app.DB.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
        const data = app.DB.get();
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(0);
        expect(data.stats.cats['专辑']).toEqual({ t: 1, c: 0 });
    });

    test('addWrong 添加错题到错题本', () => {
        app.DB.addWrong('001');
        const wrong = app.DB.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].qid).toBe('001');
        expect(wrong[0].cnt).toBe(1);
    });

    test('addWrong 重复添加同一错题增加计数', () => {
        app.DB.addWrong('001');
        app.DB.addWrong('001');
        const wrong = app.DB.getWrong();
        expect(wrong.length).toBe(1);
        expect(wrong[0].cnt).toBe(2);
    });

    test('removeWrong 从错题本移除错题', () => {
        app.DB.addWrong('001');
        app.DB.removeWrong('001');
        const wrong = app.DB.getWrong();
        expect(wrong.length).toBe(0);
    });

    test('findQ 能找到存在的题目', () => {
        const q = app.DB.findQ('001');
        expect(q).not.toBeNull();
        expect(q.id).toBe('001');
        expect(q.category).toBe('专辑');
    });

    test('findQ 返回null当题目不存在时', () => {
        const q = app.DB.findQ('nonexistent');
        expect(q).toBeNull();
    });
});

describe('核心逻辑', () => {
    test('selectMode 设置模式', () => {
        app.selectMode('standard');
        expect(app.state.mode).toBe('standard');
        app.selectMode('quick');
        expect(app.state.mode).toBe('quick');
    });

    test('getCount 返回正确的题目数量', () => {
        app.selectMode('quick');
        expect(app.getCount()).toBe(10);
        app.selectMode('standard');
        expect(app.getCount()).toBe(20);
        app.selectMode('intensive');
        expect(app.getCount()).toBe(30);
    });

    test('getCount 默认返回10当模式不存在时', () => {
        app.selectMode('unknown');
        expect(app.getCount()).toBe(10);
    });

    test('shuffle 打乱数组顺序', () => {
        const arr = [1, 2, 3, 4, 5];
        const shuffled = app.shuffle(arr);
        expect(shuffled.length).toBe(arr.length);
        expect(shuffled).toEqual(expect.arrayContaining(arr));
    });

    test('shuffle 不修改原数组', () => {
        const arr = [1, 2, 3, 4, 5];
        const original = [...arr];
        app.shuffle(arr);
        expect(arr).toEqual(original);
    });

    test('calculateAccuracy 计算正确率', () => {
        expect(app.calculateAccuracy(10, 5)).toBe(50);
        expect(app.calculateAccuracy(20, 18)).toBe(90);
        expect(app.calculateAccuracy(0, 0)).toBe(0);
        expect(app.calculateAccuracy(100, 0)).toBe(0);
        expect(app.calculateAccuracy(100, 100)).toBe(100);
    });

    test('fmtTime 格式化时间', () => {
        expect(app.fmtTime(0)).toBe('0分0秒');
        expect(app.fmtTime(5000)).toBe('0分5秒');
        expect(app.fmtTime(60000)).toBe('1分0秒');
        expect(app.fmtTime(65000)).toBe('1分5秒');
        expect(app.fmtTime(3600000)).toBe('60分0秒');
    });
});

describe('题库管理', () => {
    test('getCategories 返回所有分类', () => {
        const cats = app.getCategories();
        expect(cats).toContain('专辑');
        expect(cats).toContain('歌曲');
        expect(cats).toContain('个人信息');
        expect(cats).toContain('获奖记录');
        expect(cats.length).toBe(4);
    });

    test('findQuestionById 找到题目', () => {
        const q = app.findQuestionById('001');
        expect(q).not.toBeNull();
        expect(q.id).toBe('001');
    });

    test('findQuestionById 返回null当题目不存在', () => {
        const q = app.findQuestionById('xyz');
        expect(q).toBeNull();
    });

    test('filterQuestionsByCategory 按分类筛选', () => {
        const filtered = app.filterQuestionsByCategory('专辑');
        expect(filtered.length).toBeGreaterThan(0);
        filtered.forEach(q => {
            expect(q.category).toBe('专辑');
        });
    });

    test('filterQuestionsByCategory 返回全部当分类为空', () => {
        const filtered = app.filterQuestionsByCategory('');
        expect(filtered.length).toBe(app.QUESTION_BANK.length);
    });

    test('searchQuestions 按关键词搜索', () => {
        const results = app.searchQuestions('江南');
        expect(results.length).toBeGreaterThan(0);
        results.forEach(q => {
            expect(q.question.toLowerCase()).toContain('江南');
        });
    });

    test('searchQuestions 返回全部当关键词为空', () => {
        const results = app.searchQuestions('');
        expect(results.length).toBe(app.QUESTION_BANK.length);
    });

    test('searchQuestions 返回空数组当无匹配', () => {
        const results = app.searchQuestions('xxxxxxxxxx');
        expect(results.length).toBe(0);
    });

    test('parseOptions 解析选项文本', () => {
        const optsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
        const options = app.parseOptions(optsText);
        expect(options.length).toBe(4);
        expect(options[0].key).toBe('A');
        expect(options[0].text).toBe('选项1');
        expect(options[3].key).toBe('D');
        expect(options[3].text).toBe('选项4');
    });

    test('parseOptions 处理不同的标点格式', () => {
        const optsText = 'A、选项1\nB．选项2\nC.选项3';
        const options = app.parseOptions(optsText);
        expect(options.length).toBe(3);
        expect(options[0].key).toBe('A');
        expect(options[1].key).toBe('B');
        expect(options[2].key).toBe('C');
    });

    test('parseOptions 忽略空行', () => {
        const optsText = 'A.选项1\n\nB.选项2\n\n\nC.选项3';
        const options = app.parseOptions(optsText);
        expect(options.length).toBe(3);
    });

    test('parseOptions 返回空数组当输入为空', () => {
        const options = app.parseOptions('');
        expect(options.length).toBe(0);
    });

    test('addQuestion 添加新题目', () => {
        const initialLength = app.QUESTION_BANK.length;
        const newId = app.addQuestion({
            category: '测试',
            question: '测试题目',
            options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }],
            answer: 'A',
            explanation: '测试解析'
        });
        expect(app.QUESTION_BANK.length).toBe(initialLength + 1);
        expect(newId).toMatch(/^q\d+$/);
        const added = app.findQuestionById(newId);
        expect(added.question).toBe('测试题目');
        expect(added.category).toBe('测试');
    });

    test('updateQuestion 更新现有题目', () => {
        const q = app.findQuestionById('001');
        const originalQuestion = q.question;
        const result = app.updateQuestion('001', {
            category: q.category,
            question: '修改后的题目',
            options: q.options,
            answer: q.answer,
            explanation: q.explanation
        });
        expect(result).toBe(true);
        const updated = app.findQuestionById('001');
        expect(updated.question).toBe('修改后的题目');
        expect(updated.question).not.toBe(originalQuestion);
    });

    test('updateQuestion 返回false当题目不存在', () => {
        const result = app.updateQuestion('nonexistent', {
            category: '测试',
            question: '测试',
            options: [],
            answer: 'A',
            explanation: ''
        });
        expect(result).toBe(false);
    });

    test('deleteQuestion 删除题目', () => {
        const initialLength = app.QUESTION_BANK.length;
        const result = app.deleteQuestion('001');
        expect(result).toBe(true);
        expect(app.QUESTION_BANK.length).toBe(initialLength - 1);
        expect(app.findQuestionById('001')).toBeNull();
    });

    test('deleteQuestion 返回false当题目不存在', () => {
        const initialLength = app.QUESTION_BANK.length;
        const result = app.deleteQuestion('nonexistent');
        expect(result).toBe(false);
        expect(app.QUESTION_BANK.length).toBe(initialLength);
    });

    test('saveQuestionBank 和 loadQuestionBank 持久化题库', () => {
        const testBank = [{ id: 'test1', category: '测试', question: '测试', options: [], answer: 'A', explanation: '' }];
        global.localStorage.setItem('jj_question_bank', JSON.stringify(testBank));
        app.loadQuestionBank();
        expect(app.QUESTION_BANK.length).toBe(1);
        expect(app.QUESTION_BANK[0].id).toBe('test1');
    });

    test('resetQuestionBank 恢复默认题库', () => {
        const defaultLength = app.DEFAULT_QUESTION_BANK.length;
        app.QUESTION_BANK = [{ id: 'test' }];
        app.resetQuestionBank();
        expect(app.QUESTION_BANK.length).toBe(defaultLength);
        expect(global.localStorage.getItem('jj_question_bank')).toBeNull();
    });
});

describe('答题生成', () => {
    test('generateQuiz 生成随机答题', () => {
        app.selectMode('quick');
        const quiz = app.generateQuiz();
        expect(quiz.length).toBe(10);
        quiz.forEach(q => {
            expect(q).toHaveProperty('id');
            expect(q).toHaveProperty('question');
            expect(q).toHaveProperty('options');
            expect(q).toHaveProperty('answer');
        });
    });

    test('generateQuiz 按分类生成答题', () => {
        app.selectMode('quick');
        const quiz = app.generateQuiz('quick', '专辑');
        expect(quiz.length).toBeLessThanOrEqual(10);
        quiz.forEach(q => {
            expect(q.category).toBe('专辑');
        });
    });

    test('generateQuiz 当分类题目少于要求数量时返回全部', () => {
        app.selectMode('intensive');
        const catQuestions = app.filterQuestionsByCategory('个人信息');
        const quiz = app.generateQuiz('intensive', '个人信息');
        expect(quiz.length).toBe(catQuestions.length);
    });
});

describe('边界条件', () => {
    test('DB.addRecord 当题目不存在时不更新分类统计', () => {
        app.DB.addRecord({ qid: 'nonexistent', ans: 'A', ok: true, time: Date.now() });
        const data = app.DB.get();
        expect(data.stats.total).toBe(1);
        expect(data.stats.correct).toBe(1);
        expect(Object.keys(data.stats.cats).length).toBe(0);
    });

    test('removeWrong 删除不存在的错题不报错', () => {
        expect(() => {
            app.DB.removeWrong('nonexistent');
        }).not.toThrow();
    });

    test('updateQuestion 更新不存在的题目不报错', () => {
        expect(() => {
            app.updateQuestion('nonexistent', {});
        }).not.toThrow();
    });

    test('deleteQuestion 删除不存在的题目不报错', () => {
        expect(() => {
            app.deleteQuestion('nonexistent');
        }).not.toThrow();
    });

    test('parseOptions 处理无效格式返回空数组', () => {
        const optsText = '无效格式\n没有A.B.C.D';
        const options = app.parseOptions(optsText);
        expect(options.length).toBe(0);
    });

    test('parseOptions 处理只有一个选项', () => {
        const optsText = 'A.只有一个选项';
        const options = app.parseOptions(optsText);
        expect(options.length).toBe(1);
        expect(options[0].key).toBe('A');
    });

    test('loadQuestionBank 处理损坏的JSON不报错', () => {
        global.localStorage.setItem('jj_question_bank', 'invalid json');
        expect(() => {
            app.loadQuestionBank();
        }).not.toThrow();
        expect(app.QUESTION_BANK.length).toBe(app.DEFAULT_QUESTION_BANK.length);
    });

    test('generateQuiz 当题库为空时返回空数组', () => {
        const originalBank = app.QUESTION_BANK;
        app.QUESTION_BANK = [];
        app.selectMode('quick');
        const quiz = app.generateQuiz();
        expect(quiz.length).toBe(0);
        app.QUESTION_BANK = originalBank;
    });

    test('calculateAccuracy 处理除以零', () => {
        expect(app.calculateAccuracy(0, 5)).toBe(0);
        expect(app.calculateAccuracy(0, 0)).toBe(0);
    });

    test('getCategories 处理空题库', () => {
        const originalBank = app.QUESTION_BANK;
        app.QUESTION_BANK = [];
        const cats = app.getCategories();
        expect(cats.length).toBe(0);
        app.QUESTION_BANK = originalBank;
    });

    test('filterQuestionsByCategory 处理不存在的分类', () => {
        const filtered = app.filterQuestionsByCategory('不存在的分类');
        expect(filtered.length).toBe(0);
    });
});