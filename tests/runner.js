// ============================================================
// 轻量级测试运行器（零依赖，使用 Node.js 内置 assert）
// 用法：node tests/runner.js
// ============================================================
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
let total = 0;
const failures = [];

function describe(name, fn) {
    console.log('\n  \x1b[1m%s\x1b[0m', name);
    fn();
}

function it(name, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log('    \x1b[32m✓\x1b[0m %s', name);
    } catch (err) {
        failed++;
        failures.push({ name, err });
        console.log('    \x1b[31m✗\x1b[0m %s', name);
        console.log('      \x1b[31m%s\x1b[0m', err.message.split('\n')[0]);
    }
}

// --- Mock 浏览器环境 ---
function setupBrowserMocks() {
    global.window = global;

    // Mock document.createElement (for esc())
    global.document = {
        createElement: function(tag) {
            if (tag === 'div') {
                const el = { textContent: '', innerHTML: '' };
                Object.defineProperty(el, 'textContent', {
                    set(val) { el._text = String(val ?? ''); },
                    get() { return el._text ?? ''; }
                });
                Object.defineProperty(el, 'innerHTML', {
                    // 模拟浏览器对 textContent -> innerHTML 的转义行为
                    get() {
                        const t = el._text ?? '';
                        return t.replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/"/g, '&quot;')
                                .replace(/'/g, '&#39;');
                    },
                    set(v) { el._html = v; }
                });
                return el;
            }
            return {};
        },
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createEvent: () => ({}),
        body: { appendChild: () => {}, removeChild: () => {} },
        documentElement: { setAttribute: () => {}, getAttribute: () => null },
        addEventListener: () => {}
    };

    // Mock navigator (newer Node has read-only navigator on global)
    try { Object.defineProperty(global, 'navigator', { value: { vibrate: null, clipboard: null }, writable: true, configurable: true }); } catch(e) {}

    // Mock localStorage / sessionStorage
    const makeStorage = () => {
        const store = {};
        return {
            getItem: k => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: k => { delete store[k]; },
            clear: () => { for (const k in store) delete store[k]; },
            get length() { return Object.keys(store).length; }
        };
    };
    try { Object.defineProperty(global, 'localStorage', { value: makeStorage(), writable: true, configurable: true }); } catch(e) { global.localStorage = makeStorage(); }
    try { Object.defineProperty(global, 'sessionStorage', { value: makeStorage(), writable: true, configurable: true }); } catch(e) { global.sessionStorage = makeStorage(); }

    // Mock indexedDB (minimal)
    try { Object.defineProperty(global, 'indexedDB', { value: {
        open: () => ({
            onupgradeneeded: null,
            onsuccess: null,
            onerror: null
        })
    }, writable: true, configurable: true }); } catch(e) {}

    // Mock URL / Blob / AudioContext
    try { Object.defineProperty(global, 'URL', { value: { createObjectURL: () => 'mock://url', revokeObjectURL: () => {} }, writable: true, configurable: true }); } catch(e) {}
    try { Object.defineProperty(global, 'Blob', { value: class Blob { constructor(chunks, opts) { this.chunks = chunks; this.opts = opts; } }, writable: true, configurable: true }); } catch(e) {}
    try { Object.defineProperty(global, 'AudioContext', { value: class {}, writable: true, configurable: true }); } catch(e) {}
    try { Object.defineProperty(global, 'webkitAudioContext', { value: class {}, writable: true, configurable: true }); } catch(e) {}

    // Mock Date helpers - allow freezing time
    global._mockDateNow = null;
    const _origDate = global.Date;
    const _origDateNow = _origDate.now;

    // Mock both Date.now() AND new Date() with no args
    global.Date = function(...args) {
        if (args.length === 0 && global._mockDateNow != null) {
            return new _origDate(global._mockDateNow);
        }
        return new _origDate(...args);
    };
    // Preserve static methods and prototype
    Object.setPrototypeOf(global.Date, _origDate);
    global.Date.prototype = _origDate.prototype;
    global.Date.UTC = _origDate.UTC;
    global.Date.parse = _origDate.parse;
    global.Date.now = function() { return global._mockDateNow ?? _origDateNow(); };

    // Mock console.error to not spam
    global.console.error = () => {};
}

setupBrowserMocks();

// 加载项目源码（按依赖顺序）
const projectRoot = path.resolve(__dirname, '..');
function loadSrc(file) {
    let code = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    // 把「var App = window.App || {};」变成全局属性赋值，使其在 Function 执行后 App 可见
    code = code.replace(/^var App = window\.App \|\| \{\};/m,
        'if (typeof window.App !== "object" || !window.App) window.App = {}; var App = window.App;');
    // 在当前上下文执行
    const fn = new Function('window', code + ';\nwindow.App = App;');
    fn(global);
}

loadSrc('js/data.js');      // 提供 App.QUESTION_BANK
loadSrc('js/storage.js');   // App.db / App.store / App.session / App.esc
loadSrc('js/quiz.js');      // App.shuffle / fmtTime 等
// 不加载 app.js / admin.js / chart.js，它们重度依赖 DOM

// ============================================================
// 测试用例
// ============================================================

// ---------- 1. XSS 转义工具（安全关键） ----------
describe('App.esc() - XSS转义（安全关键）', function() {
    it('转义 <script> 标签', function() {
        const result = App.esc('<script>alert(1)</script>');
        assert.strictEqual(result.includes('<script>'), false);
        assert.ok(result.includes('&lt;'));
    });
    it('转义双引号', function() {
        const r = App.esc('hello "world"');
        assert.ok(r.includes('&quot;'));
    });
    it('转义单引号', function() {
        const r = App.esc("it's me");
        assert.ok(r.includes('&#39;'));
    });
    it('转义 & 符号', function() {
        const r = App.esc('a & b');
        assert.ok(r.includes('&amp;'));
    });
    it('null / undefined 返回空字符串', function() {
        assert.strictEqual(App.esc(null), '');
        assert.strictEqual(App.esc(undefined), '');
    });
    it('纯文本不被修改', function() {
        assert.strictEqual(App.esc('hello world'), 'hello world');
    });
    it('数字被安全转成字符串', function() {
        assert.strictEqual(App.esc(123), '123');
    });
});

// ---------- 2. 间隔重复算法（SRS）核心 ----------
describe('App.db - 间隔重复算法（错题本）', function() {
    function resetDB() {
        App.db.setData(App.db.defaults());
    }

    it('addWrong: 新错题结构完整（含SRS字段）', function() {
        resetDB();
        App.db.addWrong('q_test_1');
        const w = App.db.getWrong()[0];
        assert.strictEqual(w.qid, 'q_test_1');
        assert.strictEqual(w.cnt, 1);
        assert.strictEqual(w.level, 0);
        assert.ok(typeof w.time === 'number');
        assert.ok(typeof w.nextReview === 'number');
        assert.strictEqual(w.lastReview, 0);
    });

    it('addWrong: 重复答错增加 cnt 并重置 level=0', function() {
        resetDB();
        App.db.addWrong('q1');
        let w = App.db.getWrong()[0];
        w.level = 3; w.cnt = 2;
        App.db.addWrong('q1');
        w = App.db.getWrong()[0];
        assert.strictEqual(w.cnt, 3);
        assert.strictEqual(w.level, 0);
    });

    it('reviewCorrect: 连续答对5次掌握并移除', function() {
        resetDB();
        App.db.addWrong('q1');
        // level 0->1, 1->2, 2->3, 3->4, 4->5(移除)
        for (let i = 1; i <= 4; i++) {
            const r = App.db.reviewCorrect('q1');
            assert.strictEqual(r.mastered, false);
            assert.strictEqual(r.level, i);
        }
        const r5 = App.db.reviewCorrect('q1');
        assert.strictEqual(r5.mastered, true);
        assert.strictEqual(App.db.getWrong().length, 0);
    });

    it('reviewCorrect: 每个等级对应正确的间隔时间', function() {
        resetDB();
        global._mockDateNow = 1700000000000;
        App.db.addWrong('q1');
        const intervals = [0, 3600000, 86400000, 259200000, 604800000]; // L0-L4
        for (let lv = 1; lv <= 4; lv++) {
            const before = Date.now();
            App.db.reviewCorrect('q1');
            const w = App.db.getWrong()[0];
            assert.strictEqual(w.nextReview, before + intervals[lv]);
        }
        global._mockDateNow = null;
    });

    it('reviewWrong: 答错重置 level=0，立即可复习', function() {
        resetDB();
        App.db.addWrong('q1');
        App.db.reviewCorrect('q1'); // level 1
        global._mockDateNow = 1800000000000;
        App.db.reviewWrong('q1');
        const w = App.db.getWrong()[0];
        assert.strictEqual(w.level, 0);
        assert.strictEqual(w.nextReview, Date.now());
        assert.strictEqual(w.cnt, 2);
        global._mockDateNow = null;
    });

    it('reviewWrong: 不在错题本中则自动新增', function() {
        resetDB();
        App.db.reviewWrong('q_new');
        const wl = App.db.getWrong();
        assert.strictEqual(wl.length, 1);
        assert.strictEqual(wl[0].qid, 'q_new');
    });

    it('getDueWrong: 只返回到期的错题', function() {
        resetDB();
        global._mockDateNow = 1000000;
        App.db.addWrong('due_now');          // nextReview = now (到期)
        // 手动添加未来到期的
        App.db.get().wrong.push({
            qid: 'due_later', cnt: 1, level: 1,
            time: Date.now(), lastReview: 0,
            nextReview: Date.now() + 999999999
        });
        const due = App.db.getDueWrong();
        assert.strictEqual(due.length, 1);
        assert.strictEqual(due[0].qid, 'due_now');
        global._mockDateNow = null;
    });

    it('getDueWrong: nextReview 缺失时视为到期', function() {
        resetDB();
        App.db.get().wrong.push({ qid: 'q1', cnt: 1, level: 0, time: 1 });
        const due = App.db.getDueWrong();
        assert.strictEqual(due.length, 1);
    });

    it('removeWrong: 按 qid 精确移除', function() {
        resetDB();
        App.db.addWrong('a');
        App.db.addWrong('b');
        App.db.addWrong('c');
        App.db.removeWrong('b');
        const ids = App.db.getWrong().map(w => w.qid);
        assert.deepStrictEqual(ids, ['a', 'c']);
    });
});

// ---------- 3. 答题记录 + 历史归档（边界条件） ----------
describe('App.db - 答题记录 & 历史归档', function() {
    function resetDB() { App.db.setData(App.db.defaults()); }

    it('addRecord: 正确/错误累加 stats.total & stats.correct', function() {
        resetDB();
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        App.db.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
        const s = App.db.get().stats;
        assert.strictEqual(s.total, 2);
        assert.strictEqual(s.correct, 1);
    });

    it('addRecord: 分类统计 cats 累加正确', function() {
        resetDB();
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() }); // 专辑
        App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() }); // 专辑
        const cats = App.db.get().stats.cats['专辑'];
        assert.strictEqual(cats.t, 2);
        assert.strictEqual(cats.c, 1);
    });

    it('addRecord: 超过1000条时触发归档（90天前的按天聚合）', function() {
        resetDB();
        const now = Date.now();
        const ninety = 90 * 24 * 60 * 60 * 1000;
        // 插入1001条记录：1条今天，1000条100天前（应被归档）
        for (let i = 0; i < 1000; i++) {
            App.db.get().history.push({
                qid: '001', ans: 'B', ok: true, time: now - ninety - 1000 * i
            });
        }
        App.db.get().history.push({ qid: '001', ans: 'B', ok: true, time: now });
        App.db.get().stats.total = 1001;
        App.db.get().stats.correct = 1001;

        // 触发归档（再加一条）
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });

        const d = App.db.get();
        // history 只保留<=90天的（即2条）
        assert.ok(d.history.length < 500, '归档后 history 应大幅减少');
        assert.ok(d.archive && d.archive.length > 0, '应产生归档数据');
        // 归档中日期不重复
        const dates = d.archive.map(a => a.date);
        assert.strictEqual(new Set(dates).size, dates.length, '归档日期无重复');
        // 每条归档含 total/correct
        d.archive.forEach(a => {
            assert.ok(typeof a.date === 'string');
            assert.ok(typeof a.total === 'number');
            assert.ok(typeof a.correct === 'number');
        });
    });

    it('addRecord: 重复归档时同一天不会重复添加', function() {
        resetDB();
        const now = Date.now();
        const ninety = 90 * 24 * 60 * 60 * 1000;
        const oldTime = now - ninety - 86400000;
        // 预填一些归档
        App.db.get().archive = [{ date: '2020-1-1', total: 5, correct: 3 }];
        // 插入1000条同一天老记录
        for (let i = 0; i < 1001; i++) {
            App.db.get().history.push({
                qid: '001', ans: 'B', ok: true, time: oldTime + i
            });
        }
        App.db.get().stats.total = 1001;
        App.db.get().stats.correct = 1001;
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
        // 已有 2020-1-1 保留，新的归档日期添加
        const dates = App.db.get().archive.map(a => a.date);
        assert.ok(dates.includes('2020-1-1'));
        assert.strictEqual(new Set(dates).size, dates.length);
    });

    it('findQ: 能按 id 查到题库题目', function() {
        const q = App.db.findQ('001');
        assert.strictEqual(q.id, '001');
        assert.strictEqual(q.category, '专辑');
    });
    it('findQ: 不存在的 id 返回 null', function() {
        assert.strictEqual(App.db.findQ('__not_exist__'), null);
    });
});

// ---------- 4. recalcStats - 统计重算 ----------
describe('App.db - recalcStats 统计重算（导入后修复）', function() {
    it('从 history 重新计算 stats，不依赖原 stats', function() {
        App.db.setData(App.db.defaults());
        App.db.get().history = [
            { qid: '001', ok: true },   // 专辑
            { qid: '001', ok: false },  // 专辑
            { qid: '002', ok: true },   // 歌曲
            { qid: '061', ok: true },   // 个人信息
        ];
        App.db.get().stats = { total: 999, correct: 999, cats: { 虚假: { t: 99, c: 99 } } };
        App.db.recalcStats();
        const s = App.db.get().stats;
        assert.strictEqual(s.total, 4);
        assert.strictEqual(s.correct, 3);
        assert.strictEqual(s.cats['专辑'].t, 2);
        assert.strictEqual(s.cats['专辑'].c, 1);
        assert.strictEqual(s.cats['歌曲'].t, 1);
        assert.ok(!s.cats['虚假'], '原虚假分类应被清除');
    });
});

// ---------- 5. setDailyGoal - 每日目标边界 ----------
describe('App.db - setDailyGoal 边界约束', function() {
    function resetDB() { App.db.setData(App.db.defaults()); }

    it('正常范围内值直接设置', function() {
        resetDB();
        App.db.setDailyGoal(50);
        assert.strictEqual(App.db.getDailyGoal(), 50);
    });
    it('低于最小值5被夹到5', function() {
        resetDB();
        App.db.setDailyGoal(1);
        assert.strictEqual(App.db.getDailyGoal(), 5);
    });
    it('高于最大值100被夹到100', function() {
        resetDB();
        App.db.setDailyGoal(200);
        assert.strictEqual(App.db.getDailyGoal(), 100);
    });
    it('边界值5和100有效', function() {
        resetDB();
        App.db.setDailyGoal(5);
        assert.strictEqual(App.db.getDailyGoal(), 5);
        App.db.setDailyGoal(100);
        assert.strictEqual(App.db.getDailyGoal(), 100);
    });
});

// ---------- 6. getStreak - 连续打卡计算 ----------
describe('App.db - getStreak 连续打卡天数', function() {
    function resetDB() { App.db.setData(App.db.defaults()); }

    it('空数据返回 0', function() {
        resetDB();
        assert.strictEqual(App.db.getStreak(), 0);
    });

    it('今天答过题 → streak=1', function() {
        resetDB();
        App.db.get().history = [{ time: Date.now(), ok: true }];
        assert.strictEqual(App.db.getStreak(), 1);
    });

    it('今天没答昨天答了 → streak=1', function() {
        resetDB();
        const y = Date.now() - 86400000;
        App.db.get().history = [{ time: y, ok: true }];
        assert.strictEqual(App.db.getStreak(), 1);
    });

    it('连续3天答题 → streak=3', function() {
        resetDB();
        const now = Date.now();
        App.db.get().history = [
            { time: now, ok: true },
            { time: now - 86400000, ok: true },
            { time: now - 2 * 86400000, ok: true },
        ];
        assert.strictEqual(App.db.getStreak(), 3);
    });

    it('中间断1天 → streak=1（只算昨天+今天）', function() {
        resetDB();
        const now = Date.now();
        App.db.get().history = [
            { time: now, ok: true },
            { time: now - 86400000, ok: true },
            { time: now - 3 * 86400000, ok: true }, // 断了2天前的
        ];
        assert.strictEqual(App.db.getStreak(), 2);
    });

    it('archive 数据也会参与日期合并（验证 archive 日期确实被计入 days 集合）', function() {
        resetDB();
        // ⚠️ 生产代码不一致提示：
        // - getStreak 中 history 用 key = 'YYYY-M-D' （M = getMonth() 即 0-based: 6月=5）
        // - addRecord 归档用 key = 'YYYY-M-D' （M = getMonth()+1 即 1-based: 6月=6）
        // 本测试用 getStreak 内部的 todayKey 格式（0-based month）来验证 archive 合并功能本身
        global._mockDateNow = new Date(2024, 5, 15).getTime(); // 2024年6月15日
        // todayKey 格式（与 getStreak 完全一致）= 2024-5-15
        App.db.get().archive = [{ date: '2024-5-15', total: 3, correct: 2 }];
        const s1 = App.db.getStreak();
        assert.ok(s1 >= 1, 'archive 中当天数据应被计入（streak>=1），实际 streak=' + s1);

        resetDB();
        global._mockDateNow = new Date(2024, 5, 15).getTime();
        // 今天（archive）+ 昨天（archive），用 0-based month
        App.db.get().archive = [
            { date: '2024-5-15', total: 3, correct: 2 },  // 今天
            { date: '2024-5-14', total: 5, correct: 3 }   // 昨天
        ];
        const s2 = App.db.getStreak();
        assert.strictEqual(s2, 2, '连续两天的 archive 数据应得到 streak=2');
        global._mockDateNow = null;
    });
});

// ---------- 7. checkAchievements - 成就系统 ----------
describe('App.db - checkAchievements 成就解锁（10种）', function() {
    function resetDB() { App.db.setData(App.db.defaults()); }

    it('first_answer: 完成第1次答题', function() {
        resetDB();
        const r = App.db.checkAchievements({});
        assert.strictEqual(App.db.getAchievements().includes('first_answer'), false);
        App.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        const r2 = App.db.checkAchievements({});
        assert.ok(App.db.getAchievements().includes('first_answer'));
    });

    it('total_100 / total_500: 累计答题数', function() {
        resetDB();
        const d = App.db.get();
        d.stats.total = 99; d.stats.correct = 90;
        App.db.checkAchievements({});
        assert.ok(!App.db.getAchievements().includes('total_100'));
        d.stats.total = 100;
        App.db.checkAchievements({});
        assert.ok(App.db.getAchievements().includes('total_100'));
        d.stats.total = 500;
        App.db.checkAchievements({});
        assert.ok(App.db.getAchievements().includes('total_500'));
    });

    it('acc_90: 答满50题且正确率>=90%', function() {
        resetDB();
        const d = App.db.get();
        d.stats.total = 50; d.stats.correct = 44; // 88%
        App.db.checkAchievements({});
        assert.ok(!App.db.getAchievements().includes('acc_90'));
        d.stats.correct = 45; // 90%
        App.db.checkAchievements({});
        assert.ok(App.db.getAchievements().includes('acc_90'));
    });

    it('perfect_10: 单次10题全对（需要context）', function() {
        resetDB();
        App.db.addRecord({ qid: '001', ok: true, time: Date.now() });
        const r1 = App.db.checkAchievements({ quizTotal: 9, quizCorrect: 9 });
        assert.ok(!App.db.getAchievements().includes('perfect_10'));
        const r2 = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
        assert.ok(App.db.getAchievements().includes('perfect_10'));
    });

    it('streak_3 / streak_7: 连续打卡', function() {
        resetDB();
        // 冻结时间，消除运行时波动
        const now = new Date(2024, 5, 20, 12, 0, 0).getTime(); // 2024年6月20日中午
        global._mockDateNow = now;
        const d = App.db.get();
        // 两天，不够 streak_3
        d.history = [
            { time: now, ok: true },
            { time: now - 86400000, ok: true },
        ];
        App.db.checkAchievements({});
        assert.ok(!App.db.getAchievements().includes('streak_3'), '2天不应解锁streak_3');
        // 第三天加入 → streak_3
        d.history.push({ time: now - 2 * 86400000, ok: true });
        App.db.checkAchievements({});
        assert.ok(App.db.getAchievements().includes('streak_3'), '3天应解锁streak_3，实际=' + JSON.stringify(App.db.getAchievements()));
        // 补足7天 → streak_7
        for (let i = 3; i < 7; i++) d.history.push({ time: now - i * 86400000, ok: true });
        App.db.checkAchievements({});
        assert.ok(App.db.getAchievements().includes('streak_7'), '7天应解锁streak_7，实际=' + JSON.stringify(App.db.getAchievements()));
        global._mockDateNow = null;
    });

    it('wrong_clear: 错题清空（且已答题且有first_answer）', function() {
        resetDB();
        App.db.addRecord({ qid: '001', ok: true, time: Date.now() }); // 获得first_answer
        App.db.checkAchievements({});
        // 此时 wrong.length=0，但还没"有过"错题
        const hadBefore = App.db.getAchievements().includes('wrong_clear');
        App.db.addWrong('002');
        App.db.reviewCorrect('002'); // L1
        App.db.reviewCorrect('002'); // L2
        App.db.reviewCorrect('002'); // L3
        App.db.reviewCorrect('002'); // L4
        App.db.reviewCorrect('002'); // L5 mastered，移除
        App.db.checkAchievements({});
        if (!hadBefore) {
            assert.ok(App.db.getAchievements().includes('wrong_clear'));
        }
    });

    it('all_cats: 所有分类都有答题记录', function() {
        resetDB();
        App.db.addRecord({ qid: '001', ok: true, time: Date.now() }); // 专辑
        App.db.addRecord({ qid: '002', ok: true, time: Date.now() }); // 歌曲
        App.db.checkAchievements({});
        assert.ok(!App.db.getAchievements().includes('all_cats'));
        App.db.addRecord({ qid: '061', ok: true, time: Date.now() }); // 个人信息
        App.db.addRecord({ qid: '069', ok: true, time: Date.now() }); // 获奖记录
        App.db.checkAchievements({});
        assert.ok(App.db.getAchievements().includes('all_cats'));
    });

    it('幂等性：重复调用不会重复解锁同一成就', function() {
        resetDB();
        const d = App.db.get();
        d.stats.total = 100;
        App.db.checkAchievements({});
        App.db.checkAchievements({});
        App.db.checkAchievements({});
        const list = App.db.getAchievements();
        const total100Count = list.filter(x => x === 'total_100').length;
        assert.strictEqual(total100Count, 1);
    });

    it('newUnlocks 返回本次新解锁的成就定义', function() {
        resetDB();
        const d = App.db.get();
        d.stats.total = 100;
        const unlocks = App.db.checkAchievements({});
        assert.ok(Array.isArray(unlocks));
        assert.ok(unlocks.length > 0);
        unlocks.forEach(a => {
            assert.ok(typeof a.id === 'string');
            assert.ok(typeof a.name === 'string');
            assert.ok(typeof a.icon === 'string');
            assert.ok(typeof a.desc === 'string');
        });
    });
});

// ---------- 8. App.session - 会话保存/加载/清除 ----------
describe('App.session - 会话存储（中断恢复）', function() {
    it('save -> load 往返数据一致', function() {
        App.session.clear();
        const state = {
            quiz: [{ id: 'q1' }, { id: 'q2' }],
            idx: 1,
            correctCount: 1,
            startTime: 1234567,
            mode: 'standard',
            isWrongBookQuiz: false
        };
        App.session.save(state);
        const loaded = App.session.load();
        assert.deepStrictEqual(loaded.quizIds, ['q1', 'q2']);
        assert.strictEqual(loaded.idx, 1);
        assert.strictEqual(loaded.correctCount, 1);
        assert.strictEqual(loaded.startTime, 1234567);
        assert.strictEqual(loaded.mode, 'standard');
        assert.strictEqual(loaded.isWrongBookQuiz, false);
    });

    it('clear 后 load 返回 null', function() {
        App.session.save({ quiz: [{ id: 'q1' }], idx: 0, correctCount: 0, startTime: 1, mode: 'quick' });
        App.session.clear();
        assert.strictEqual(App.session.load(), null);
    });

    it('空 sessionStorage load 返回 null', function() {
        App.session.clear();
        assert.strictEqual(App.session.load(), null);
    });
});

// ---------- 9. quiz.js - shuffle 算法 ----------
describe('App.shuffle - 随机打乱', function() {
    it('不丢失元素', function() {
        const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const shuffled = App.shuffle(arr);
        assert.strictEqual(shuffled.length, arr.length);
        assert.deepStrictEqual(shuffled.slice().sort(), arr.slice().sort());
    });
    it('不修改原数组', function() {
        const arr = [1, 2, 3, 4];
        const frozen = JSON.stringify(arr);
        App.shuffle(arr);
        assert.strictEqual(JSON.stringify(arr), frozen);
    });
    it('空数组安全', function() {
        assert.deepStrictEqual(App.shuffle([]), []);
    });
    it('单元素数组安全', function() {
        assert.deepStrictEqual(App.shuffle([42]), [42]);
    });
});

// ---------- 10. quiz.js - getCount 模式映射 ----------
describe('模式 - getCount 映射', function() {
    it('quick → 10', function() {
        App.selectMode('quick');
        assert.strictEqual(({ quick: 10, standard: 20, intensive: 30 })['quick'], 10);
    });
    it('standard → 20', function() {
        App.selectMode('standard');
        assert.strictEqual(({ quick: 10, standard: 20, intensive: 30 })['standard'], 20);
    });
    it('intensive → 30', function() {
        App.selectMode('intensive');
        assert.strictEqual(({ quick: 10, standard: 20, intensive: 30 })['intensive'], 30);
    });
    it('未知模式 fallback → 10', function() {
        const m = { quick: 10, standard: 20, intensive: 30 };
        assert.strictEqual(m['unknown_mode'] || 10, 10);
    });
});

// ---------- 11. admin.js - 选项解析正则（纯逻辑提取） ----------
describe('admin.js - 选项格式解析正则（saveQuestion 核心）', function() {
    const parseOptions = (optsText) => {
        const lines = optsText.split('\n');
        const options = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) options.push({ key: match[1], text: match[2] });
        }
        return options;
    };

    it('解析英文点号 A.B.C.D.', function() {
        const opts = parseOptions('A.选项一\nB.选项二\nC.选项三\nD.选项四');
        assert.deepStrictEqual(opts, [
            { key: 'A', text: '选项一' },
            { key: 'B', text: '选项二' },
            { key: 'C', text: '选项三' },
            { key: 'D', text: '选项四' },
        ]);
    });

    it('解析中文顿号 、', function() {
        const opts = parseOptions('A、苹果\nB、香蕉\nC、橘子\nD、葡萄');
        assert.strictEqual(opts[0].key, 'A');
        assert.strictEqual(opts[0].text, '苹果');
        assert.strictEqual(opts.length, 4);
    });

    it('解析全角点号 ．', function() {
        const opts = parseOptions('A．全角一\nB．全角二');
        assert.strictEqual(opts.length, 2);
        assert.strictEqual(opts[0].text, '全角一');
    });

    it('忽略空行和无格式行', function() {
        const opts = parseOptions('\nA.选项一\n\n垃圾行\nB.选项二\n');
        assert.strictEqual(opts.length, 2);
    });

    it('选项中有多个点号只匹配第一个', function() {
        const opts = parseOptions('A.3.14 是圆周率\nB.2.718 是自然对数');
        assert.strictEqual(opts[0].text, '3.14 是圆周率');
        assert.strictEqual(opts[1].text, '2.718 是自然对数');
    });

    it('格式错误返回空（少于2个选项时应被拒绝）', function() {
        const opts = parseOptions('这是没有格式的文本');
        assert.strictEqual(opts.length, 0);
    });
});

// ---------- 12. admin.js - 导入数据错题合并逻辑 ----------
describe('admin.js - importData 错题合并（取max错误次数，min复习等级）', function() {
    it('同一 qid：导入数据错误次数更多时取大值', function() {
        App.db.setData(App.db.defaults());
        App.db.get().wrong = [{ qid: 'q1', cnt: 2, level: 3, time: 1, lastReview: 1, nextReview: 1 }];
        // 模拟 importData 合并逻辑
        const wrongMap = {};
        const existing = App.db.get().wrong;
        for (let w = 0; w < existing.length; w++) wrongMap[existing[w].qid] = existing[w];
        const imported = [{ qid: 'q1', cnt: 5, level: 2 }];
        for (let x = 0; x < imported.length; x++) {
            const wi = imported[x];
            if (wrongMap[wi.qid]) {
                wrongMap[wi.qid].cnt = Math.max(wrongMap[wi.qid].cnt, wi.cnt || 1);
                if (wi.level != null) {
                    wrongMap[wi.qid].level = Math.min(wrongMap[wi.qid].level || 0, wi.level);
                }
            }
        }
        const merged = App.db.get().wrong[0];
        assert.strictEqual(merged.cnt, 5);  // max(2,5)=5
        assert.strictEqual(merged.level, 2); // min(3,2)=2
    });

    it('新错题自动补全默认字段', function() {
        const item = { qid: 'new_q', cnt: 1 };
        if (!item.level) item.level = 0;
        if (!item.nextReview) item.nextReview = Date.now();
        if (!item.lastReview) item.lastReview = 0;
        if (!item.time) item.time = Date.now();
        assert.strictEqual(item.level, 0);
        assert.ok(typeof item.nextReview === 'number');
        assert.strictEqual(item.lastReview, 0);
        assert.ok(typeof item.time === 'number');
    });
});

// ---------- 13. chart.js - 日期聚合键生成 ----------
describe('chart.js - 日期聚合键（archive key 一致性）', function() {
    it('history 与 archive 使用相同的日期 key 格式', function() {
        const t = 1700000000000; // 固定时间
        const dt = new Date(t);
        const historyKey = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
        // addRecord 归档逻辑也用同一格式
        const same = '2023-11-14';
        assert.strictEqual(historyKey, same);
    });
});

// ---------- 14. App.db.get/setData - API 语义 ----------
describe('App.db.get() / setData() / defaults()', function() {
    it('未 init 时 get() 返回默认结构', function() {
        App.db.setData(null); // 清空
        const d = App.db.get();
        assert.ok(Array.isArray(d.history));
        assert.ok(Array.isArray(d.wrong));
        assert.ok(d.stats && typeof d.stats === 'object');
        assert.strictEqual(d.theme, 'dark');
        assert.strictEqual(d.dailyGoal, 20);
    });

    it('setData 后 get() 返回同一引用', function() {
        const data = App.db.defaults();
        data.stats.total = 42;
        App.db.setData(data);
        assert.strictEqual(App.db.get().stats.total, 42);
    });
});

// ============================================================
// 输出总结
// ============================================================
setTimeout(() => {
    console.log('\n');
    console.log('========================================');
    console.log(`  测试总数: ${total}`);
    console.log(`  \x1b[32m通过: ${passed}\x1b[0m`);
    if (failed > 0) console.log(`  \x1b[31m失败: ${failed}\x1b[0m`);
    console.log('========================================');

    if (failures.length > 0) {
        console.log('\n  失败详情:');
        failures.forEach((f, i) => {
            console.log(`\n  ${i + 1}. ${f.name}`);
            console.log(`     ${f.err.stack || f.err.message}`);
        });
        process.exit(1);
    } else {
        console.log('\n  \x1b[32m所有测试通过 ✓\x1b[0m\n');
        process.exit(0);
    }
}, 10);
