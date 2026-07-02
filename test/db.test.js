import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

global.localStorage = {
    _data: {},
    getItem: function(key) { return this._data[key] || null; },
    setItem: function(key, value) { this._data[key] = value; },
    removeItem: function(key) { delete this._data[key]; },
    clear: function() { this._data = {}; }
};

const QUESTION_BANK = [
    { id: 'q001', category: '专辑', question: '测试题1', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '解析1' },
    { id: 'q002', category: '歌曲', question: '测试题2', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'B', explanation: '解析2' },
    { id: 'q003', category: '专辑', question: '测试题3', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], answer: 'A', explanation: '解析3' }
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

describe('DB 对象', function() {
    beforeEach(function() {
        localStorage.clear();
    });

    describe('get 和 defaults', function() {
        it('应该返回默认数据结构', function() {
            var data = DB.get();
            assert.deepStrictEqual(data.history, []);
            assert.deepStrictEqual(data.wrong, []);
            assert.deepStrictEqual(data.stats, { total: 0, correct: 0, cats: {} });
        });

        it('应该从 localStorage 读取数据', function() {
            localStorage.setItem('jj_quiz_v2', JSON.stringify({
                history: [{ qid: 'q001', ans: 'A', ok: true, time: 1234567890 }],
                wrong: [],
                stats: { total: 1, correct: 1, cats: {} }
            }));
            var data = DB.get();
            assert.strictEqual(data.history.length, 1);
            assert.strictEqual(data.stats.total, 1);
        });
    });

    describe('addRecord', function() {
        it('应该正确记录答题记录', function() {
            DB.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
            var data = DB.get();
            assert.strictEqual(data.history.length, 1);
            assert.strictEqual(data.stats.total, 1);
            assert.strictEqual(data.stats.correct, 1);
        });

        it('应该正确记录分类统计', function() {
            DB.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
            DB.addRecord({ qid: 'q002', ans: 'A', ok: false, time: Date.now() });
            var data = DB.get();
            assert.deepStrictEqual(data.stats.cats, {
                '专辑': { t: 1, c: 1 },
                '歌曲': { t: 1, c: 0 }
            });
        });

        it('应该正确统计错误答案', function() {
            DB.addRecord({ qid: 'q001', ans: 'B', ok: false, time: Date.now() });
            var data = DB.get();
            assert.strictEqual(data.stats.total, 1);
            assert.strictEqual(data.stats.correct, 0);
        });
    });

    describe('addWrong', function() {
        it('应该添加新的错题', function() {
            DB.addWrong('q001');
            var wrong = DB.getWrong();
            assert.strictEqual(wrong.length, 1);
            assert.strictEqual(wrong[0].qid, 'q001');
            assert.strictEqual(wrong[0].cnt, 1);
        });

        it('应该增加重复错题的计数', function() {
            DB.addWrong('q001');
            DB.addWrong('q001');
            var wrong = DB.getWrong();
            assert.strictEqual(wrong.length, 1);
            assert.strictEqual(wrong[0].cnt, 2);
        });

        it('应该正确记录多个不同的错题', function() {
            DB.addWrong('q001');
            DB.addWrong('q002');
            var wrong = DB.getWrong();
            assert.strictEqual(wrong.length, 2);
        });
    });

    describe('removeWrong', function() {
        it('应该移除指定的错题', function() {
            DB.addWrong('q001');
            DB.addWrong('q002');
            DB.removeWrong('q001');
            var wrong = DB.getWrong();
            assert.strictEqual(wrong.length, 1);
            assert.strictEqual(wrong[0].qid, 'q002');
        });

        it('移除不存在的错题应该不报错', function() {
            DB.addWrong('q001');
            DB.removeWrong('q003');
            var wrong = DB.getWrong();
            assert.strictEqual(wrong.length, 1);
        });
    });

    describe('findQ', function() {
        it('应该找到存在的题目', function() {
            var q = DB.findQ('q001');
            assert.notStrictEqual(q, null);
            assert.strictEqual(q.id, 'q001');
            assert.strictEqual(q.category, '专辑');
        });

        it('应该返回 null 当题目不存在', function() {
            var q = DB.findQ('nonexistent');
            assert.strictEqual(q, null);
        });
    });

    describe('数据持久化', function() {
        it('save 后数据应该可被 get 读取', function() {
            var data = DB.defaults();
            data.history.push({ qid: 'q001', ans: 'A', ok: true });
            DB.save(data);
            var loaded = DB.get();
            assert.strictEqual(loaded.history.length, 1);
        });

        it('localStorage 数据应该正确存储', function() {
            DB.addRecord({ qid: 'q001', ans: 'A', ok: true, time: Date.now() });
            var stored = localStorage.getItem('jj_quiz_v2');
            assert.notStrictEqual(stored, null);
            var parsed = JSON.parse(stored);
            assert.strictEqual(parsed.stats.total, 1);
        });
    });
});