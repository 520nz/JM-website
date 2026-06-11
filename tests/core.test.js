/**
 * 核心逻辑单元测试
 * 
 * 运行方式：node tests/core.test.js
 * 
 * 覆盖范围：
 *  - 工具函数（getCount / shuffle / fmtTime / parseOptions）
 *  - DB 存储语义（addRecord / addWrong / removeWrong / 数据损坏恢复）
 *  - 统计计算（正确率 / 今日记录 / 分类统计）
 *  - 数据导入合并（新增 / 更新 / 冲突处理）
 */

'use strict';

var assert = require('assert');
var path = require('path');
var QuizCore = require(path.join(__dirname, '..', 'js', 'core.js'));

/* ------------------------------------------------------------
 *  简易内存 Store（模拟 localStorage）
 * ------------------------------------------------------------ */
function createMemoryStore() {
    var data = {};
    return {
        getItem: function (k) { return data.hasOwnProperty(k) ? data[k] : null; },
        setItem: function (k, v) { data[k] = String(v); },
        removeItem: function (k) { delete data[k]; },
        clear: function () { data = {}; },
        _snapshot: function () { return JSON.parse(JSON.stringify(data)); }
    };
}

/* ------------------------------------------------------------
 *  轻量测试框架：避免外部依赖
 * ------------------------------------------------------------ */
var results = [];
function test(name, fn) {
    try {
        fn();
        results.push({ name: name, pass: true });
        process.stdout.write('  ✓ ' + name + '\n');
    } catch (e) {
        results.push({ name: name, pass: false, err: e });
        process.stdout.write('  ✗ ' + name + '\n');
        process.stdout.write('    ' + (e.stack || e.message) + '\n');
    }
}

function suite(name, fn) {
    process.stdout.write('\n' + name + '\n');
    fn();
}

/* ============================================================
 *  1. getCount
 * ============================================================ */
suite('getCount - 模式映射', function () {
    test('快速模式返回 10 题', function () {
        assert.strictEqual(QuizCore.getCount('quick'), 10);
    });
    test('标准模式返回 20 题', function () {
        assert.strictEqual(QuizCore.getCount('standard'), 20);
    });
    test('强化模式返回 30 题', function () {
        assert.strictEqual(QuizCore.getCount('intensive'), 30);
    });
    test('未知模式回退到 10 题（容错）', function () {
        assert.strictEqual(QuizCore.getCount('unknown'), 10);
        assert.strictEqual(QuizCore.getCount(undefined), 10);
    });
});

/* ============================================================
 *  2. shuffle - Fisher-Yates
 * ============================================================ */
suite('shuffle - Fisher-Yates 洗牌', function () {
    test('空数组返回空数组', function () {
        assert.deepStrictEqual(QuizCore.shuffle([]), []);
    });
    test('单元素数组保持不变', function () {
        assert.deepStrictEqual(QuizCore.shuffle([42]), [42]);
    });
    test('确定性随机源 → 确定性输出', function () {
        // 构造一个每次返回固定值的 rng，使输出可预测
        // 对于 [1,2,3,4]，i=3 时 random=0 → j=0; i=2 时 random=0 → j=0; ...
        // 这里用固定 rng = () => 0.5 测试一次：
        var fixed = function () { return 0.5; };
        var result = QuizCore.shuffle([1, 2, 3, 4, 5], fixed);
        assert.strictEqual(result.length, 5);
        // 元素集合不变（洗牌的核心保证）
        assert.deepStrictEqual(result.slice().sort(function (a, b) { return a - b; }), [1, 2, 3, 4, 5]);
    });
    test('不修改原数组', function () {
        var original = [1, 2, 3, 4, 5];
        var copy = original.slice();
        QuizCore.shuffle(original);
        assert.deepStrictEqual(original, copy);
    });
    test('1000 次随机洗牌后每个位置分布应接近均匀（烟雾测试）', function () {
        var items = ['a', 'b', 'c'];
        var counts = { a: 0, b: 0, c: 0 };
        for (var i = 0; i < 3000; i++) {
            var r = QuizCore.shuffle(items);
            counts[r[0]] += 1;
        }
        // 每个元素作为首元素的次数应在合理范围内
        assert.ok(counts.a > 800 && counts.a < 1200, 'a 的首位置次数异常: ' + counts.a);
        assert.ok(counts.b > 800 && counts.b < 1200, 'b 的首位置次数异常: ' + counts.b);
        assert.ok(counts.c > 800 && counts.c < 1200, 'c 的首位置次数异常: ' + counts.c);
    });
    test('对对象数组保持引用关系', function () {
        var arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
        var result = QuizCore.shuffle(arr, function () { return 0.1; });
        assert.strictEqual(result.length, 3);
        assert.strictEqual(result.filter(function (o) { return o.id === 1; }).length, 1);
        assert.strictEqual(result.filter(function (o) { return o.id === 2; }).length, 1);
        assert.strictEqual(result.filter(function (o) { return o.id === 3; }).length, 1);
    });
});

/* ============================================================
 *  3. fmtTime
 * ============================================================ */
suite('fmtTime - 时间格式化', function () {
    test('0 毫秒 → "0分0秒"', function () {
        assert.strictEqual(QuizCore.fmtTime(0), '0分0秒');
    });
    test('59 秒显示为 "0分59秒"', function () {
        assert.strictEqual(QuizCore.fmtTime(59000), '0分59秒');
    });
    test('1 分钟整', function () {
        assert.strictEqual(QuizCore.fmtTime(60000), '1分0秒');
    });
    test('2分30秒', function () {
        assert.strictEqual(QuizCore.fmtTime(150000), '2分30秒');
    });
    test('向下取整而非四舍五入', function () {
        assert.strictEqual(QuizCore.fmtTime(59999), '0分59秒');
    });
});

/* ============================================================
 *  4. parseOptions - 选项解析（核心数据验证）
 * ============================================================ */
suite('parseOptions - 选项文本解析', function () {
    test('标准格式 "A.xxx\\nB.xxx" 解析正确', function () {
        var input = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
        assert.deepStrictEqual(QuizCore.parseOptions(input), [
            { key: 'A', text: '选项1' },
            { key: 'B', text: '选项2' },
            { key: 'C', text: '选项3' },
            { key: 'D', text: '选项4' }
        ]);
    });
    test('支持中文顿号 "、" 作为分隔符', function () {
        var input = 'A、选项1\nB、选项2';
        assert.deepStrictEqual(QuizCore.parseOptions(input), [
            { key: 'A', text: '选项1' },
            { key: 'B', text: '选项2' }
        ]);
    });
    test('支持全角点 "．" 作为分隔符', function () {
        var input = 'A．选项1\nB．选项2';
        assert.deepStrictEqual(QuizCore.parseOptions(input), [
            { key: 'A', text: '选项1' },
            { key: 'B', text: '选项2' }
        ]);
    });
    test('跳过空行', function () {
        var input = 'A.选项1\n\nB.选项2\n   \nC.选项3';
        var result = QuizCore.parseOptions(input);
        assert.strictEqual(result.length, 3);
        assert.strictEqual(result[0].key, 'A');
        assert.strictEqual(result[2].key, 'C');
    });
    test('仅解析 A-D 的选项，忽略 E 及以上', function () {
        var input = 'A.选项1\nE.选项5\n1.其他';
        var result = QuizCore.parseOptions(input);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].key, 'A');
    });
    test('缺失分隔符的行被忽略（健壮性）', function () {
        var input = 'A选项1\nB.选项2';
        var result = QuizCore.parseOptions(input);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].key, 'B');
    });
    test('null / 空字符串返回空数组', function () {
        assert.deepStrictEqual(QuizCore.parseOptions(''), []);
        assert.deepStrictEqual(QuizCore.parseOptions(null), []);
    });
    test('选项内容可包含点号（正则仅限定开头）', function () {
        var input = 'A.林俊杰 2023.04.21 专辑';
        var result = QuizCore.parseOptions(input);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].text, '林俊杰 2023.04.21 专辑');
    });
});

/* ============================================================
 *  5. DB 存储模块
 * ============================================================ */
suite('createDB - 存储语义', function () {
    test('首次 get 返回默认数据结构，并持久化到 store', function () {
        var store = createMemoryStore();
        var db = QuizCore.createDB(store, { getBank: function () { return []; } });
        var d = db.get();
        assert.deepStrictEqual(d.history, []);
        assert.deepStrictEqual(d.wrong, []);
        assert.strictEqual(d.stats.total, 0);
        assert.strictEqual(d.stats.correct, 0);
        // 持久化确认
        var raw = store.getItem(QuizCore._DB_KEY);
        assert.ok(raw, '应写入 store');
        var parsed = JSON.parse(raw);
        assert.strictEqual(parsed.stats.total, 0);
    });

    test('addRecord 正确累计 total / correct', function () {
        var store = createMemoryStore();
        var bank = [{ id: 'q1', category: '专辑' }, { id: 'q2', category: '歌曲' }];
        var db = QuizCore.createDB(store, { getBank: function () { return bank; } });
        db.addRecord({ qid: 'q1', ans: 'A', ok: true, time: Date.now() });
        db.addRecord({ qid: 'q1', ans: 'B', ok: false, time: Date.now() });
        db.addRecord({ qid: 'q2', ans: 'C', ok: true, time: Date.now() });
        var d = db.get();
        assert.strictEqual(d.stats.total, 3);
        assert.strictEqual(d.stats.correct, 2);
        assert.strictEqual(d.history.length, 3);
    });

    test('addRecord 对未知题目 id 不会崩溃（无分类统计）', function () {
        var store = createMemoryStore();
        var db = QuizCore.createDB(store, { getBank: function () { return []; } });
        db.addRecord({ qid: 'nonexistent', ans: 'A', ok: true, time: Date.now() });
        var d = db.get();
        assert.strictEqual(d.stats.total, 1);
        assert.strictEqual(d.stats.correct, 1);
        // 未知题目不产生分类统计
        assert.strictEqual(Object.keys(d.stats.cats).length, 0);
    });

    test('addRecord 正确累加分类统计（按 category 分组）', function () {
        var store = createMemoryStore();
        var bank = [{ id: 'q1', category: '专辑' }, { id: 'q2', category: '歌曲' }];
        var db = QuizCore.createDB(store, { getBank: function () { return bank; } });
        db.addRecord({ qid: 'q1', ans: 'A', ok: true, time: 1000 });
        db.addRecord({ qid: 'q1', ans: 'B', ok: false, time: 1001 });
        db.addRecord({ qid: 'q2', ans: 'C', ok: true, time: 1002 });
        var d = db.get();
        assert.strictEqual(d.stats.cats['专辑'].t, 2);
        assert.strictEqual(d.stats.cats['专辑'].c, 1);
        assert.strictEqual(d.stats.cats['歌曲'].t, 1);
        assert.strictEqual(d.stats.cats['歌曲'].c, 1);
    });

    test('addWrong 首次加入 cnt=1，再次加入 cnt 累加', function () {
        var store = createMemoryStore();
        var db = QuizCore.createDB(store, { getBank: function () { return []; } });
        db.addWrong('q1');
        db.addWrong('q1');
        db.addWrong('q2');
        var wrongs = db.getWrong();
        assert.strictEqual(wrongs.length, 2);
        var q1 = wrongs.filter(function (w) { return w.qid === 'q1'; })[0];
        var q2 = wrongs.filter(function (w) { return w.qid === 'q2'; })[0];
        assert.strictEqual(q1.cnt, 2);
        assert.strictEqual(q2.cnt, 1);
    });

    test('removeWrong 按 qid 删除，其他保留', function () {
        var store = createMemoryStore();
        var db = QuizCore.createDB(store, { getBank: function () { return []; } });
        db.addWrong('q1');
        db.addWrong('q2');
        db.removeWrong('q1');
        var wrongs = db.getWrong();
        assert.strictEqual(wrongs.length, 1);
        assert.strictEqual(wrongs[0].qid, 'q2');
    });

    test('removeWrong 对不存在的 qid 无副作用（空操作）', function () {
        var store = createMemoryStore();
        var db = QuizCore.createDB(store, { getBank: function () { return []; } });
        db.addWrong('q1');
        db.removeWrong('unknown');
        assert.strictEqual(db.getWrong().length, 1);
    });

    test('findQ 在题库中查找到正确条目', function () {
        var bank = [{ id: 'q1', category: '专辑', question: '题1' }, { id: 'q2', category: '歌曲', question: '题2' }];
        var db = QuizCore.createDB(createMemoryStore(), { getBank: function () { return bank; } });
        var q = db.findQ('q1');
        assert.strictEqual(q.id, 'q1');
        assert.strictEqual(q.category, '专辑');
        assert.strictEqual(db.findQ('q999'), null);
    });

    test('损坏的 JSON 数据回退为默认值（健壮性）', function () {
        var store = createMemoryStore();
        store.setItem(QuizCore._DB_KEY, '{not valid json');
        var db = QuizCore.createDB(store, { getBank: function () { return []; } });
        var d = db.get();
        // 损坏数据应被重置为默认结构
        assert.strictEqual(d.stats.total, 0);
        assert.deepStrictEqual(d.history, []);
    });

    test('save / get 往返：手动保存后能被读出', function () {
        var store = createMemoryStore();
        var db = QuizCore.createDB(store, { getBank: function () { return []; } });
        var custom = {
            history: [{ qid: 'x', ok: true, time: 123 }],
            wrong: [{ qid: 'x', cnt: 5, time: 456 }],
            stats: { total: 1, correct: 1, cats: { '测试': { t: 1, c: 1 } } }
        };
        db.save(custom);
        var d = db.get();
        assert.strictEqual(d.history.length, 1);
        assert.strictEqual(d.wrong[0].cnt, 5);
        assert.strictEqual(d.stats.cats['测试'].t, 1);
    });

    test('题库持久化：saveQuestionBank / loadQuestionBank 往返', function () {
        var store = createMemoryStore();
        var db = QuizCore.createDB(store, { getBank: function () { return []; } });
        var bank = [{ id: 'q1', category: '专辑' }];
        db.saveQuestionBank(bank);
        var loaded = db.loadQuestionBank([]);
        assert.strictEqual(loaded.length, 1);
        assert.strictEqual(loaded[0].id, 'q1');
    });

    test('loadQuestionBank 无存储时返回默认题库副本', function () {
        var store = createMemoryStore();
        var db = QuizCore.createDB(store, { getBank: function () { return []; } });
        var def = [{ id: 'default', category: '专辑' }];
        var loaded = db.loadQuestionBank(def);
        assert.strictEqual(loaded.length, 1);
        assert.strictEqual(loaded[0].id, 'default');
        // 返回的是副本，不是引用
        loaded.push({ id: 'new' });
        assert.strictEqual(def.length, 1);
    });

    test('resetQuestionBank 清除存储并返回默认题库副本', function () {
        var store = createMemoryStore();
        var db = QuizCore.createDB(store, { getBank: function () { return []; } });
        db.saveQuestionBank([{ id: 'custom' }]);
        var def = [{ id: 'default' }];
        var afterReset = db.resetQuestionBank(def);
        assert.strictEqual(afterReset.length, 1);
        assert.strictEqual(afterReset[0].id, 'default');
        assert.strictEqual(store.getItem(QuizCore._QB_KEY), null);
    });
});

/* ============================================================
 *  6. 统计计算
 * ============================================================ */
suite('统计计算', function () {
    test('calcAccuracy: 0 题返回 0', function () {
        assert.strictEqual(QuizCore.calcAccuracy(0, 0), 0);
    });
    test('calcAccuracy: 全对返回 100', function () {
        assert.strictEqual(QuizCore.calcAccuracy(5, 5), 100);
    });
    test('calcAccuracy: 50%', function () {
        assert.strictEqual(QuizCore.calcAccuracy(1, 2), 50);
    });
    test('calcAccuracy: 四舍五入（2/3 → 67）', function () {
        assert.strictEqual(QuizCore.calcAccuracy(2, 3), 67);
    });
    test('calcAccuracy: negative total 安全返回 0', function () {
        assert.strictEqual(QuizCore.calcAccuracy(0, -1), 0);
    });

    test('calcTodayRecords: 仅筛选今日之后的记录', function () {
        var today = new Date('2026-06-11T00:00:00').getTime();
        var history = [
            { time: today - 1, ok: true },   // 昨日
            { time: today, ok: true },       // 今日 0 点
            { time: today + 3600 * 1000, ok: false } // 今日1小时后
        ];
        var todayList = QuizCore.calcTodayRecords(history, today);
        assert.strictEqual(todayList.length, 2);
    });
    test('calcTodayRecords: 空历史 / null 返回空数组', function () {
        assert.deepStrictEqual(QuizCore.calcTodayRecords([], 0), []);
        assert.deepStrictEqual(QuizCore.calcTodayRecords(null, 0), []);
    });

    test('buildCategoryStats: 正确计算每个分类的正确率', function () {
        var cats = { '专辑': { t: 10, c: 7 }, '歌曲': { t: 5, c: 5 } };
        var rows = QuizCore.buildCategoryStats(cats);
        assert.strictEqual(rows.length, 2);
        var album = rows.filter(function (r) { return r.name === '专辑'; })[0];
        var song = rows.filter(function (r) { return r.name === '歌曲'; })[0];
        assert.strictEqual(album.pct, 70);
        assert.strictEqual(song.pct, 100);
    });
    test('buildCategoryStats: 0 题分类返回 0% 而不是 NaN', function () {
        var rows = QuizCore.buildCategoryStats({ '空分类': { t: 0, c: 0 } });
        assert.strictEqual(rows[0].pct, 0);
        assert.strictEqual(isNaN(rows[0].pct), false);
    });
    test('buildCategoryStats: null / 空对象安全', function () {
        assert.deepStrictEqual(QuizCore.buildCategoryStats(null), []);
        assert.deepStrictEqual(QuizCore.buildCategoryStats({}), []);
    });
});

/* ============================================================
 *  7. 数据导入合并
 * ============================================================ */
suite('mergeImportedData - 数据导入合并（复杂数据处理）', function () {
    test('仅导入 questionBank：全新题目被添加', function () {
        var curBank = [{ id: 'e1', category: '专辑' }];
        var imported = {
            questionBank: [
                { id: 'n1', category: '歌曲' },
                { id: 'n2', category: '专辑' }
            ]
        };
        var r = QuizCore.mergeImportedData(curBank, null, imported);
        assert.strictEqual(r.bank.length, 3);
        assert.strictEqual(r.addedCount, 2);
        assert.strictEqual(r.updatedCount, 0);
    });

    test('仅导入 questionBank：同 id 题目被更新（不重复）', function () {
        var curBank = [{ id: 'q1', category: '专辑', question: '旧题目' }];
        var imported = {
            questionBank: [
                { id: 'q1', category: '专辑', question: '新题目' }
            ]
        };
        var r = QuizCore.mergeImportedData(curBank, null, imported);
        assert.strictEqual(r.bank.length, 1);
        assert.strictEqual(r.updatedCount, 1);
        assert.strictEqual(r.addedCount, 0);
        assert.strictEqual(r.bank[0].question, '新题目');
    });

    test('同时导入新增 + 更新', function () {
        var curBank = [
            { id: 'q1', category: '专辑' },
            { id: 'q2', category: '歌曲' }
        ];
        var imported = {
            questionBank: [
                { id: 'q1', category: '专辑', question: '更新' },
                { id: 'q3', category: '个人信息' }
            ]
        };
        var r = QuizCore.mergeImportedData(curBank, null, imported);
        assert.strictEqual(r.bank.length, 3);
        assert.strictEqual(r.updatedCount, 1);
        assert.strictEqual(r.addedCount, 1);
    });

    test('仅导入 userData：history 合并追加', function () {
        var cur = { history: [{ qid: 'a', ok: true }], wrong: [], stats: { total: 1, correct: 1, cats: {} } };
        var imported = {
            userData: {
                history: [{ qid: 'b', ok: false }, { qid: 'c', ok: true }],
                wrong: [],
                stats: { total: 2, correct: 1, cats: {} }
            }
        };
        var r = QuizCore.mergeImportedData([], cur, imported);
        assert.strictEqual(r.userData.history.length, 3);
        assert.strictEqual(r.userData.stats.total, 3);
        assert.strictEqual(r.userData.stats.correct, 2);
    });

    test('userData.wrong：相同 qid 合并 cnt，不同 qid 追加', function () {
        var cur = {
            history: [],
            wrong: [{ qid: 'x', cnt: 3, time: 100 }, { qid: 'y', cnt: 1, time: 200 }],
            stats: { total: 0, correct: 0, cats: {} }
        };
        var imported = {
            userData: {
                history: [],
                wrong: [{ qid: 'x', cnt: 2, time: 300 }, { qid: 'z', cnt: 4, time: 400 }],
                stats: { total: 0, correct: 0, cats: {} }
            }
        };
        var r = QuizCore.mergeImportedData([], cur, imported);
        assert.strictEqual(r.userData.wrong.length, 3);
        var x = r.userData.wrong.filter(function (w) { return w.qid === 'x'; })[0];
        assert.strictEqual(x.cnt, 5);  // 3 + 2
    });

    test('userData.stats.cats：分类统计累加', function () {
        var cur = {
            history: [], wrong: [],
            stats: { total: 0, correct: 0, cats: { '专辑': { t: 5, c: 3 }, '歌曲': { t: 4, c: 4 } } }
        };
        var imported = {
            userData: {
                history: [], wrong: [],
                stats: { total: 0, correct: 0, cats: { '专辑': { t: 3, c: 2 }, '新分类': { t: 2, c: 0 } } }
            }
        };
        var r = QuizCore.mergeImportedData([], cur, imported);
        assert.strictEqual(r.userData.stats.cats['专辑'].t, 8);
        assert.strictEqual(r.userData.stats.cats['专辑'].c, 5);
        assert.strictEqual(r.userData.stats.cats['歌曲'].t, 4);
        assert.strictEqual(r.userData.stats.cats['新分类'].t, 2);
    });

    test('空导入对象不改变当前状态', function () {
        var curBank = [{ id: 'q1', category: '专辑' }];
        var curUD = { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
        var r = QuizCore.mergeImportedData(curBank, curUD, {});
        assert.strictEqual(r.bank.length, 1);
        assert.strictEqual(r.addedCount, 0);
        assert.strictEqual(r.updatedCount, 0);
    });

    test('不修改输入参数（纯函数性质）', function () {
        var curBank = [{ id: 'q1', category: '专辑' }];
        var curUD = { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
        var imported = { questionBank: [{ id: 'new' }] };
        var bankSnapshot = JSON.stringify(curBank);
        var udSnapshot = JSON.stringify(curUD);
        QuizCore.mergeImportedData(curBank, curUD, imported);
        assert.strictEqual(JSON.stringify(curBank), bankSnapshot, 'curBank 不应被修改');
        assert.strictEqual(JSON.stringify(curUD), udSnapshot, 'curUD 不应被修改');
    });

    test('当前 userData 为 null 时，初始化为默认结构后再合并', function () {
        var imported = {
            userData: {
                history: [{ qid: 'a', ok: true }],
                wrong: [],
                stats: { total: 1, correct: 1, cats: {} }
            }
        };
        var r = QuizCore.mergeImportedData([], null, imported);
        assert.strictEqual(r.userData.history.length, 1);
        assert.strictEqual(r.userData.stats.total, 1);
    });
});

/* ============================================================
 *  8. 端到端集成场景：完整答题 → 统计 → 导出/导入
 * ============================================================ */
suite('端到端集成场景', function () {
    test('完整答题流程：10 题 8 对 2 错 → 统计正确', function () {
        var store = createMemoryStore();
        var bank = [];
        for (var i = 0; i < 10; i++) {
            bank.push({ id: 'q' + i, category: i % 2 === 0 ? '专辑' : '歌曲' });
        }
        var db = QuizCore.createDB(store, { getBank: function () { return bank; } });
        // 前 8 题答对，后 2 题答错
        for (var j = 0; j < 10; j++) {
            db.addRecord({ qid: 'q' + j, ans: 'A', ok: j < 8, time: Date.now() + j });
            if (j >= 8) db.addWrong('q' + j);
        }
        var d = db.get();
        assert.strictEqual(d.stats.total, 10);
        assert.strictEqual(d.stats.correct, 8);
        assert.strictEqual(QuizCore.calcAccuracy(d.stats.correct, d.stats.total), 80);
        assert.strictEqual(d.wrong.length, 2);
        // 分类：专辑类 5 题（q0,q2,q4,q6,q8），其中 q0,q2,q4,q6 对 → 4/5=80%
        assert.strictEqual(d.stats.cats['专辑'].t, 5);
        assert.strictEqual(d.stats.cats['专辑'].c, 4);
    });

    test('导出 JSON 后再导入另一个 store：数据完整恢复', function () {
        var store1 = createMemoryStore();
        var bank1 = [{ id: 'q1', category: '专辑' }];
        var db1 = QuizCore.createDB(store1, { getBank: function () { return bank1; } });
        db1.addRecord({ qid: 'q1', ans: 'A', ok: true, time: 1000 });
        var ud1 = db1.get();

        // 模拟导出
        var exported = { questionBank: bank1, userData: ud1 };
        var json = JSON.stringify(exported);

        // 模拟导入到另一个空 store
        var store2 = createMemoryStore();
        var db2 = QuizCore.createDB(store2, { getBank: function () { return []; } });
        var parsed = JSON.parse(json);
        var merged = QuizCore.mergeImportedData([], null, parsed);

        assert.strictEqual(merged.bank.length, 1);
        assert.strictEqual(merged.userData.stats.total, 1);
        assert.strictEqual(merged.userData.stats.correct, 1);
        db2.save(merged.userData);
        db2.saveQuestionBank(merged.bank);
        assert.strictEqual(db2.get().history.length, 1);
    });

    test('shuffle + getCount 联合：取前 N 个作为当前答题', function () {
        var bank = [];
        for (var i = 0; i < 50; i++) bank.push({ id: 'q' + i });
        var shuffled = QuizCore.shuffle(bank);
        var quiz = shuffled.slice(0, QuizCore.getCount('quick'));
        assert.strictEqual(quiz.length, 10);
        // 不重复
        var ids = quiz.map(function (q) { return q.id; });
        var unique = {};
        ids.forEach(function (id) { unique[id] = true; });
        assert.strictEqual(Object.keys(unique).length, 10);
    });
});

/* ============================================================
 *  汇总
 * ============================================================ */
var passed = results.filter(function (r) { return r.pass; }).length;
var failed = results.filter(function (r) { return !r.pass; }).length;
process.stdout.write('\n==============================\n');
process.stdout.write('  通过: ' + passed + '  失败: ' + failed + '\n');
process.stdout.write('==============================\n');

if (failed > 0) process.exit(1);
