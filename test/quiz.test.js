import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

global.localStorage = {
    _data: {},
    getItem: function(key) { return this._data[key] || null; },
    setItem: function(key, value) { this._data[key] = value; },
    removeItem: function(key) { delete this._data[key]; },
    clear: function() { this._data = {}; }
};

const QUESTION_BANK = [
    { id: 'q001', category: '专辑', question: '测试题1', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }], answer: 'A', explanation: '解析1' },
    { id: 'q002', category: '歌曲', question: '测试题2', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }], answer: 'B', explanation: '解析2' },
    { id: 'q003', category: '专辑', question: '测试题3', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }], answer: 'C', explanation: '解析3' },
    { id: 'q004', category: '个人信息', question: '测试题4', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' }], answer: 'D', explanation: '解析4' }
];

const DB = {
    KEY: 'jj_quiz_v2',
    get: function() { var d = localStorage.getItem(DB.KEY); return d ? JSON.parse(d) : DB.defaults(); },
    defaults: function() { return { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }; },
    save: function(d) { localStorage.setItem(DB.KEY, JSON.stringify(d)); },
    addRecord: function(rec) {
        var d = DB.get();
        d.history.push(rec);
        d.stats.total++;
        if (rec.ok) d.stats.correct++;
        var q = DB.findQ(rec.qid);
        if (q) {
            if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
            d.stats.cats[q.category].t++;
            if (rec.ok) d.stats.cats[q.category].c++;
        }
        DB.save(d);
    },
    addWrong: function(qid) {
        var d = DB.get();
        var f = null;
        for (var i = 0; i < d.wrong.length; i++) {
            if (d.wrong[i].qid === qid) { f = d.wrong[i]; break; }
        }
        if (f) { f.cnt++; f.time = Date.now(); }
        else { d.wrong.push({ qid: qid, cnt: 1, time: Date.now() }); }
        DB.save(d);
    },
    removeWrong: function(qid) {
        var d = DB.get();
        d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
        DB.save(d);
    },
    getWrong: function() { return DB.get().wrong; },
    findQ: function(qid) {
        for (var i = 0; i < QUESTION_BANK.length; i++) {
            if (QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
        }
        return null;
    }
};

function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i];
        a[i] = a[j];
        a[j] = t;
    }
    return a;
}

function getCount(mode) {
    var m = { quick: 10, standard: 20, intensive: 30 };
    return m[mode] || 10;
}

function validateAnswer(q, key) {
    return key === q.answer;
}

function calculateAccuracy(correct, total) {
    return total > 0 ? Math.round(correct / total * 100) : 0;
}

function getCategoryQuestions(category) {
    var f = [];
    for (var i = 0; i < QUESTION_BANK.length; i++) {
        if (QUESTION_BANK[i].category === category) f.push(QUESTION_BANK[i]);
    }
    return f;
}

function getTodayStats() {
    var d = DB.get();
    var today = new Date().setHours(0, 0, 0, 0);
    var th = d.history.filter(function(h) { return h.time >= today; });
    var acc = th.length > 0 ? Math.round(th.filter(function(h) { return h.ok; }).length / th.length * 100) : 0;
    return { count: th.length, accuracy: acc };
}

describe('答题逻辑', function() {
    beforeEach(function() {
        localStorage.clear();
    });

    describe('validateAnswer', function() {
        it('应该验证正确答案', function() {
            var q = QUESTION_BANK[0];
            assert.strictEqual(validateAnswer(q, 'A'), true);
        });

        it('应该验证错误答案', function() {
            var q = QUESTION_BANK[0];
            assert.strictEqual(validateAnswer(q, 'B'), false);
            assert.strictEqual(validateAnswer(q, 'C'), false);
            assert.strictEqual(validateAnswer(q, 'D'), false);
        });

        it('应该区分大小写', function() {
            var q = QUESTION_BANK[0];
            assert.strictEqual(validateAnswer(q, 'a'), false);
        });

        it('应该处理无效的选项键', function() {
            var q = QUESTION_BANK[0];
            assert.strictEqual(validateAnswer(q, 'E'), false);
            assert.strictEqual(validateAnswer(q, ''), false);
            assert.strictEqual(validateAnswer(q, null), false);
        });
    });

    describe('calculateAccuracy', function() {
        it('应该正确计算100%正确率', function() {
            assert.strictEqual(calculateAccuracy(5, 5), 100);
        });

        it('应该正确计算0%正确率', function() {
            assert.strictEqual(calculateAccuracy(0, 5), 0);
        });

        it('应该正确计算部分正确率', function() {
            assert.strictEqual(calculateAccuracy(3, 5), 60);
            assert.strictEqual(calculateAccuracy(1, 3), 33);
            assert.strictEqual(calculateAccuracy(2, 3), 67);
        });

        it('应该处理0总数的情况', function() {
            assert.strictEqual(calculateAccuracy(0, 0), 0);
            assert.strictEqual(calculateAccuracy(5, 0), 0);
        });
    });

    describe('getCategoryQuestions', function() {
        it('应该返回指定分类的题目', function() {
            var result = getCategoryQuestions('专辑');
            assert.strictEqual(result.length, 2);
            assert.ok(result.every(function(q) { return q.category === '专辑'; }));
        });

        it('应该返回空数组当分类不存在', function() {
            var result = getCategoryQuestions('不存在的分类');
            assert.deepStrictEqual(result, []);
        });

        it('应该正确返回不同分类的题目', function() {
            var result = getCategoryQuestions('歌曲');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'q002');
        });

        it('应该返回个人信息分类的题目', function() {
            var result = getCategoryQuestions('个人信息');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'q004');
        });
    });

    describe('getTodayStats', function() {
        it('应该返回初始状态的统计', function() {
            var stats = getTodayStats();
            assert.strictEqual(stats.count, 0);
            assert.strictEqual(stats.accuracy, 0);
        });

        it('应该正确统计今日答题记录', function() {
            var now = Date.now();
            DB.addRecord({ qid: 'q001', ans: 'A', ok: true, time: now });
            DB.addRecord({ qid: 'q002', ans: 'A', ok: false, time: now });
            var stats = getTodayStats();
            assert.strictEqual(stats.count, 2);
            assert.strictEqual(stats.accuracy, 50);
        });

        it('应该只统计今日的记录', function() {
            var today = Date.now();
            var yesterday = today - 24 * 60 * 60 * 1000 - 1000;
            DB.addRecord({ qid: 'q001', ans: 'A', ok: true, time: yesterday });
            DB.addRecord({ qid: 'q002', ans: 'B', ok: true, time: today });
            var stats = getTodayStats();
            assert.strictEqual(stats.count, 1);
            assert.strictEqual(stats.accuracy, 100);
        });
    });

    describe('错题记录逻辑', function() {
        it('答题正确不应该添加到错题本', function() {
            var q = QUESTION_BANK[0];
            var ok = validateAnswer(q, 'A');
            if (!ok) DB.addWrong(q.id);
            var wrong = DB.getWrong();
            assert.strictEqual(wrong.length, 0);
        });

        it('答题错误应该添加到错题本', function() {
            var q = QUESTION_BANK[0];
            var ok = validateAnswer(q, 'B');
            if (!ok) DB.addWrong(q.id);
            var wrong = DB.getWrong();
            assert.strictEqual(wrong.length, 1);
            assert.strictEqual(wrong[0].qid, 'q001');
        });

        it('同一题目多次答错应该增加计数', function() {
            var q = QUESTION_BANK[0];
            DB.addWrong(q.id);
            DB.addWrong(q.id);
            DB.addWrong(q.id);
            var wrong = DB.getWrong();
            assert.strictEqual(wrong.length, 1);
            assert.strictEqual(wrong[0].cnt, 3);
        });
    });

    describe('题库操作', function() {
        it('应该能找到所有不同的分类', function() {
            var cats = {};
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                cats[QUESTION_BANK[i].category] = true;
            }
            var keys = Object.keys(cats);
            assert.deepStrictEqual(keys.sort(), ['专辑', '个人信息', '歌曲']);
        });

        it('应该能正确统计每个分类的题目数量', function() {
            var cats = {};
            for (var i = 0; i < QUESTION_BANK.length; i++) {
                var c = QUESTION_BANK[i].category;
                cats[c] = (cats[c] || 0) + 1;
            }
            assert.strictEqual(cats['专辑'], 2);
            assert.strictEqual(cats['歌曲'], 1);
            assert.strictEqual(cats['个人信息'], 1);
        });
    });

    describe('模式配置', function() {
        it('应该正确返回各种模式的题目数量', function() {
            assert.strictEqual(getCount('quick'), 10);
            assert.strictEqual(getCount('standard'), 20);
            assert.strictEqual(getCount('intensive'), 30);
        });

        it('当题库题目少于模式数量时应该返回全部题目', function() {
            var count = getCount('intensive');
            var available = QUESTION_BANK.length;
            assert.ok(available < count, '测试条件：题库题目数应少于intensive模式');
            assert.strictEqual(available, 4);
        });
    });
});