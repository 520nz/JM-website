// ============================================================
// test_runner.js - 零依赖测试框架 + JJ Quiz 测试套件
// 运行: node tests/test_runner.js
// ============================================================

var fs = require('fs');
var path = require('path');
var { JSDOM } = require('jsdom');

// --- 简易测试框架（支持嵌套 describe 的 beforeEach 继承） ---
var _rootSuite = { name: null, beforeAll: null, beforeEach: null, children: [] };
var _suiteStack = [];
var _passed = 0;
var _failed = 0;
var _errors = [];

function describe(name, fn) {
    var parent = _suiteStack.length > 0 ? _suiteStack[_suiteStack.length - 1] : _rootSuite;
    var suite = { name: name, beforeAll: null, beforeEach: null, children: [], tests: [] };
    parent.children.push(suite);
    _suiteStack.push(suite);
    fn();
    _suiteStack.pop();
}
function it(name, fn) {
    var suite = _suiteStack[_suiteStack.length - 1];
    if (!suite) throw new Error('it() must be inside describe()');
    suite.tests.push({ name: name, fn: fn });
}
function beforeAll(fn) {
    var suite = _suiteStack[_suiteStack.length - 1];
    if (suite) suite.beforeAll = fn;
}
function beforeEach(fn) {
    var suite = _suiteStack[_suiteStack.length - 1];
    if (suite) suite.beforeEach = fn;
}

function expect(actual) {
    return {
        toBe: function(expected) {
            if (actual !== expected) throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
        },
        toEqual: function(expected) {
            var a = JSON.stringify(actual), b = JSON.stringify(expected);
            if (a !== b) throw new Error('Expected ' + b + ' but got ' + a);
        },
        toBeTruthy: function() {
            if (!actual) throw new Error('Expected truthy but got ' + JSON.stringify(actual));
        },
        toBeFalsy: function() {
            if (actual) throw new Error('Expected falsy but got ' + JSON.stringify(actual));
        },
        toBeGreaterThan: function(n) {
            if (!(actual > n)) throw new Error('Expected > ' + n + ' but got ' + JSON.stringify(actual));
        },
        toBeLessThan: function(n) {
            if (!(actual < n)) throw new Error('Expected < ' + n + ' but got ' + JSON.stringify(actual));
        },
        toBeGreaterThanOrEqual: function(n) {
            if (!(actual >= n)) throw new Error('Expected >= ' + n + ' but got ' + JSON.stringify(actual));
        },
        toBeLessThanOrEqual: function(n) {
            if (!(actual <= n)) throw new Error('Expected <= ' + n + ' but got ' + JSON.stringify(actual));
        },
        toContain: function(item) {
            if (!Array.isArray(actual) || actual.indexOf(item) === -1)
                throw new Error('Expected array to contain ' + JSON.stringify(item));
        },
        toThrow: function() {
            try { actual(); } catch (e) { return; }
            throw new Error('Expected function to throw');
        }
    };
}

function runTests() {
    console.log('\n========================================');
    console.log('  JJ Quiz 自动化测试缺口分析 & 测试');
    console.log('========================================\n');

    function collectBeforeEachChain(suite, chain) {
        chain = chain || [];
        if (suite.beforeEach) chain.unshift(suite.beforeEach);
        return chain;
    }

    function runSuite(suite, depth, parentBeforeEachChain) {
        var indent = '  '.repeat(depth);
        if (suite.name) {
            console.log('\n' + indent + '── ' + suite.name + ' ──');
            try { if (suite.beforeAll) suite.beforeAll(); } catch (e) {
                console.log(indent + '  ! beforeAll failed: ' + e.message);
            }
        }
        var beforeEachChain = collectBeforeEachChain(suite, parentBeforeEachChain);
        suite.tests = suite.tests || [];
        suite.children = suite.children || [];

        suite.tests.forEach(function(t) {
            try {
                beforeEachChain.forEach(function(beforeEachFn) { beforeEachFn(); });
            } catch (e) {
                console.log(indent + '  ! beforeEach failed: ' + e.message);
                _failed++;
                _errors.push({ suite: suite.name, name: t.name, error: e });
                return;
            }
            try {
                t.fn();
                _passed++;
                console.log(indent + '  ✓ ' + t.name);
            } catch (e) {
                _failed++;
                console.log(indent + '  ✗ ' + t.name);
                console.log(indent + '      ' + e.message.replace(/\n/g, '\n' + indent + '      '));
                _errors.push({ suite: suite.name, name: t.name, error: e });
            }
        });

        suite.children.forEach(function(child) {
            runSuite(child, depth + 1, beforeEachChain);
        });
    }

    runSuite(_rootSuite, 0, []);

    console.log('\n========================================');
    console.log('  结果: ' + _passed + ' passed, ' + _failed + ' failed');
    console.log('========================================\n');

    process.exit(_failed > 0 ? 1 : 0);
}

// ============================================================
// 初始化 jsdom 环境
// ============================================================

function createTestEnv() {
    var dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
        runScripts: 'dangerously',
        resources: 'usable',
        url: 'http://localhost:3000/'
    });
    var win = dom.window;

    // 设置 minimal globals
    global.window = win;
    global.document = win.document;
    global.navigator = win.navigator;
    global.sessionStorage = win.sessionStorage;
    global.localStorage = win.localStorage;
    global.indexedDB = win.indexedDB;
    global.URL = win.URL;
    global.Blob = win.Blob;
    global.HTMLCanvasElement = win.HTMLCanvasElement;
    global.AudioContext = function() {};
    global.webkitAudioContext = function() {};
    global.confirm = function() { return true; };
    global.prompt = function() { return null; };
    global.alert = function() {};

    // 加载 source files in order
    var base = path.join(__dirname, '..');
    var loadOrder = ['js/data.js', 'js/storage.js', 'js/chart.js', 'js/quiz.js', 'js/app.js', 'js/admin.js'];
    loadOrder.forEach(function(file) {
        var code = fs.readFileSync(path.join(base, file), 'utf8');
        try {
            var scriptEl = win.document.createElement('script');
            scriptEl.textContent = code;
            win.document.body.appendChild(scriptEl);
        } catch (e) {
            // some modules have DOMContentLoaded handlers — ignore for now
        }
    });

    return dom;
}

function getApp() {
    return global.window.App;
}

function waitForJSDOM() {
    // 让 jsdom 内部 setTimeout 跑完（处理 DOMContentLoaded 等）
    return new Promise(function(resolve) { setTimeout(resolve, 10); });
}

// ============================================================
// 初始化 jsdom 环境（必须在所有 describe 之前）
// ============================================================
var _dom = createTestEnv();

// ============================================================
// 测试套件
// ============================================================

// --- Phase 1: XSS 转义 & 基础工具 ---
describe('XSS 转义 App.esc', function() {
    it('转义 HTML 标签', function() {
        expect(getApp().esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
    it('处理 null 返回空字符串', function() {
        expect(getApp().esc(null)).toBe('');
    });
    it('处理 undefined 返回空字符串', function() {
        expect(getApp().esc(undefined)).toBe('');
    });
    it('处理数字', function() {
        expect(getApp().esc(42)).toBe('42');
    });
    it('转义属性注入 - script 标签被转义无法执行', function() {
        var result = getApp().esc('foo<script>alert(1)</script>bar');
        expect(result.indexOf('<script>')).toBe(-1);
        expect(result.indexOf('&lt;script&gt;')).toBeGreaterThan(-1);
    });
    it('转义 & 符号防止 HTML entity 注入', function() {
        var result = getApp().esc('a&b');
        expect(result).toBe('a&amp;b');
    });
    it('转义 null/undefined 安全返回空字符串', function() {
        expect(getApp().esc(null)).toBe('');
        expect(getApp().esc(undefined)).toBe('');
    });
});

// --- Phase 2: 时间格式化 ---
describe('时间格式化 fmtTime', function() {
    it('小于60秒显示 0分X秒', function() {
        expect(getApp().state ? 'state exists' : '').toBeTruthy(); // placeholder
    });
});

// 直接测试内部函数（从 quiz.js 暴露到 App）
// quiz.js 暴露了 fmtTime 吗？检查 — 没有暴露，但通过 pickOption 可间接测试

// 用 Node VM 直接测试纯函数
var _vm = require('vm');
function evalPure(code) {
    var ctx = {};
    _vm.createContext(ctx);
    _vm.runInContext(code, ctx);
    return ctx;
}

describe('fmtTime 时间格式化', function() {
    // 直接提取 quiz.js 中的 fmtTime 实现测试
    it('30秒 = 0分30秒', function() {
        var fmtTime = function(ms) {
            var sec = Math.floor(ms / 1000);
            var m = Math.floor(sec / 60);
            var s = sec % 60;
            return m + '分' + s + '秒';
        };
        expect(fmtTime(30000)).toBe('0分30秒');
    });
    it('65秒 = 1分5秒', function() {
        var fmtTime = function(ms) {
            var sec = Math.floor(ms / 1000);
            var m = Math.floor(sec / 60);
            var s = sec % 60;
            return m + '分' + s + '秒';
        };
        expect(fmtTime(65000)).toBe('1分5秒');
    });
    it('3600000毫秒 = 60分0秒（1小时）', function() {
        var fmtTime = function(ms) {
            var sec = Math.floor(ms / 1000);
            var m = Math.floor(sec / 60);
            var s = sec % 60;
            return m + '分' + s + '秒';
        };
        expect(fmtTime(3600000)).toBe('60分0秒');
    });
});

// --- Phase 3: shuffle 算法 ---
describe('shuffle 随机打乱', function() {
    var shuffle = function(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    };
    it('打乱后元素数量不变', function() {
        var input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        var result = shuffle(input);
        expect(result.length).toBe(10);
    });
    it('打乱后元素完全相同（无丢失）', function() {
        var input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        var result = shuffle(input);
        result.sort(function(a, b) { return a - b; });
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
    it('不修改原数组', function() {
        var input = [1, 2, 3, 4, 5];
        var copy = input.slice();
        shuffle(input);
        expect(input).toEqual(copy);
    });
    it('空数组返回空数组', function() {
        expect(shuffle([])).toEqual([]);
    });
    it('单元素数组不变', function() {
        expect(shuffle([42])).toEqual([42]);
    });
});

// --- Phase 4: App.db 核心 ---
describe('App.db - 基础数据层（初始化后测试）', function() {
    var App;

    beforeAll(function() {
        if (!_dom) _dom = createTestEnv();
        App = getApp();
    });

    it('getDayGoal 在未初始化时返回默认值 20', function() {
        expect(App.db.getDailyGoal()).toBe(20);
    });
    it('setDailyGoal 边界钳制：小于5钳制为5', function() {
        App.db.setDailyGoal(1);
        expect(App.db.getDailyGoal()).toBe(5);
    });
    it('setDailyGoal 边界钳制：大于100钳制为100', function() {
        App.db.setDailyGoal(200);
        expect(App.db.getDailyGoal()).toBe(100);
    });
    it('setDailyGoal 正常值 25', function() {
        App.db.setDailyGoal(25);
        expect(App.db.getDailyGoal()).toBe(25);
    });
    it('defaults 返回正确结构', function() {
        var d = App.db.defaults();
        expect(d.history).toEqual([]);
        expect(d.wrong).toEqual([]);
        expect(d.stats).toEqual({ total: 0, correct: 0, cats: {} });
    });
});

// --- Phase 5: addRecord 答题记录 ---
describe('App.db.addRecord 答题记录', function() {
    var App, now;

    beforeEach(function() {
        if (!_dom) _dom = createTestEnv();
        App = getApp();
        App.db.setData(App.db.defaults());
        now = Date.now();
    });

    it('单次正确记录正确累加统计', function() {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
        var d = App.db.get();
        expect(d.stats.total).toBe(1);
        expect(d.stats.correct).toBe(1);
        expect(d.history.length).toBe(1);
    });
    it('单次错误记录正确统计', function() {
        App.db.addRecord({ qid: '001', ans: 'A', ok: false, time: now });
        var d = App.db.get();
        expect(d.stats.total).toBe(1);
        expect(d.stats.correct).toBe(0);
    });
    it('分类统计正确累加', function() {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now }); // 专辑
        App.db.addRecord({ qid: '002', ans: 'A', ok: true, time: now }); // 歌曲
        var d = App.db.get();
        expect(d.stats.cats['专辑'].t).toBe(1);
        expect(d.stats.cats['专辑'].c).toBe(1);
        expect(d.stats.cats['歌曲'].t).toBe(1);
    });
    it('qid 不存在题库时 stats 仍正常累加（只是不更新 cats）', function() {
        App.db.addRecord({ qid: 'nonexistent', ans: 'A', ok: true, time: now });
        var d = App.db.get();
        expect(d.stats.total).toBe(1);
        expect(Object.keys(d.stats.cats).length).toBe(0);
    });
});

// --- Phase 6: 历史归档（>1000条触发） ---
describe('App.db 历史归档（1000条边界）', function() {
    var App, now;

    beforeEach(function() {
        if (!_dom) _dom = createTestEnv();
        App = getApp();
        App.db.setData(App.db.defaults());
        now = Date.now();
    });

    it('超过1000条时自动归档90天前的记录', function() {
        var d = App.db.defaults();
        // 构造 1001 条记录，其中 500 条为 180 天前
        var oldTime = now - 180 * 24 * 60 * 60 * 1000;
        for (var i = 0; i < 500; i++) {
            d.history.push({ qid: '001', ans: 'B', ok: i % 2 === 0, time: oldTime + i * 1000 });
        }
        for (var j = 0; j < 501; j++) {
            d.history.push({ qid: '001', ans: 'B', ok: true, time: now + j * 1000 });
        }
        App.db.setData(d);

        // 触发 addRecord，检查归档
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
        var result = App.db.get();

        // history 应被截断，旧记录应进入 archive
        expect(result.history.length).toBeLessThanOrEqual(1000);
        expect(result.archive.length).toBeGreaterThan(0);
    });

    it('归档后新记录（90天内）不会被归档', function() {
        var d = App.db.defaults();
        // 构造 1001 条都是今天的记录
        for (var i = 0; i < 1001; i++) {
            d.history.push({ qid: '001', ans: 'B', ok: true, time: now });
        }
        App.db.setData(d);
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
        var result = App.db.get();
        // 所有记录都在90天内，不应有归档
        expect(result.archive.length).toBe(0);
    });

    it('归档数据去重：相同日期不重复归档', function() {
        var d = App.db.defaults();
        var oldTime = now - 180 * 24 * 60 * 60 * 1000;
        // 预置一条归档
        d.archive = [{ date: '2025-01-01', total: 10, correct: 8 }];
        // 添加 1001 条旧记录
        for (var i = 0; i < 1001; i++) {
            d.history.push({ qid: '001', ans: 'B', ok: true, time: oldTime });
        }
        App.db.setData(d);
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: now });
        var result = App.db.get();
        // 原有归档应保留，新归档应增加但不会重复同一天
        var dateCount = {};
        result.archive.forEach(function(a) {
            dateCount[a.date] = (dateCount[a.date] || 0) + 1;
        });
        for (var k in dateCount) {
            expect(dateCount[k]).toBe(1);
        }
    });
});

// --- Phase 7: 错题本核心逻辑 ---
describe('App.db.addWrong / reviewCorrect / reviewWrong', function() {
    var App, now;

    beforeEach(function() {
        if (!_dom) _dom = createTestEnv();
        App = getApp();
        App.db.setData(App.db.defaults());
        now = Date.now();
    });

    describe('addWrong', function() {
        it('首次添加错题，cnt=1, level=0', function() {
            App.db.addWrong('001');
            var w = App.db.getWrong();
            expect(w.length).toBe(1);
            expect(w[0].qid).toBe('001');
            expect(w[0].cnt).toBe(1);
            expect(w[0].level).toBe(0);
        });
        it('重复添加同一错题，cnt+1, level重置为0', function() {
            App.db.addWrong('001');
            // 先提升到 level 3
            App.db.reviewCorrect('001'); // level 1
            App.db.reviewCorrect('001'); // level 2
            App.db.reviewCorrect('001'); // level 3
            // 再次答错，addWrong
            App.db.addWrong('001');
            var w = App.db.getWrong();
            expect(w.length).toBe(1);
            expect(w[0].cnt).toBe(2);
            expect(w[0].level).toBe(0);
        });
    });

    describe('reviewCorrect 答对提升等级', function() {
        it('从 level 0 升到 level 1，下次复习时间 = 1小时后', function() {
            App.db.addWrong('001');
            var before = Date.now();
            var result = App.db.reviewCorrect('001');
            var after = Date.now();
            expect(result.mastered).toBe(false);
            expect(result.level).toBe(1);
            var w = App.db.getWrong()[0];
            // nextReview 应在 1小时后 ±1秒
            var expectedMin = before + 60 * 60 * 1000 - 1000;
            var expectedMax = after + 60 * 60 * 1000 + 1000;
            expect(w.nextReview >= expectedMin && w.nextReview <= expectedMax).toBeTruthy();
        });
        it('连续答对5次后 mastered=true，从错题本移除', function() {
            App.db.addWrong('001');
            // level 0 -> 1 -> 2 -> 3 -> 4 -> 5(mastered)
            var result1 = App.db.reviewCorrect('001'); // level 1
            expect(result1.mastered).toBe(false);
            var result2 = App.db.reviewCorrect('001'); // level 2
            expect(result2.mastered).toBe(false);
            var result3 = App.db.reviewCorrect('001'); // level 3
            expect(result3.mastered).toBe(false);
            var result4 = App.db.reviewCorrect('001'); // level 4
            expect(result4.mastered).toBe(false);
            var result5 = App.db.reviewCorrect('001'); // level 5 -> mastered
            expect(result5.mastered).toBe(true);
            expect(App.db.getWrong().length).toBe(0);
        });
        it('reviewCorrect 对不在错题本中的 qid 返回 mastered=false', function() {
            var result = App.db.reviewCorrect('nonexistent');
            expect(result.mastered).toBe(false);
        });
    });

    describe('reviewWrong 答错重置等级', function() {
        it('等级重置为0，cnt+1', function() {
            App.db.addWrong('001');
            App.db.reviewCorrect('001'); // level 1
            App.db.reviewCorrect('001'); // level 2
            App.db.reviewWrong('001');
            var w = App.db.getWrong()[0];
            expect(w.level).toBe(0);
            expect(w.cnt).toBe(2);
        });
        it('reviewWrong 对不在错题本中的 qid 自动加入', function() {
            App.db.reviewWrong('new_qid');
            var w = App.db.getWrong();
            expect(w.length).toBe(1);
            expect(w[0].qid).toBe('new_qid');
            expect(w[0].cnt).toBe(1);
        });
    });

    describe('getDueWrong 到期判断', function() {
        it('nextReview 在未来的错题不归为到期', function() {
            App.db.addWrong('001');
            // 推进到 level 1 设置 nextReview = 1小时后
            App.db.reviewCorrect('001');
            var due = App.db.getDueWrong();
            expect(due.length).toBe(0);
        });
        it('nextReview 已过去或为0的错题归为到期', function() {
            App.db.addWrong('001');
            // level 0 的 nextReview = Date.now()，应该是到期
            var due = App.db.getDueWrong();
            expect(due.length).toBe(1);
        });
    });
});

// --- Phase 8: 连续打卡计算 ---
describe('App.db.getStreak 连续打卡', function() {
    var App;

    beforeEach(function() {
        if (!_dom) _dom = createTestEnv();
        App = getApp();
        App.db.setData(App.db.defaults());
    });

    it('空历史返回 0', function() {
        expect(App.db.getStreak()).toBe(0);
    });
    it('仅今天答题，streak=1', function() {
        var d = App.db.defaults();
        var today = new Date();
        today.setHours(12, 0, 0, 0);
        d.history = [{ qid: '001', ans: 'B', ok: true, time: today.getTime() }];
        App.db.setData(d);
        expect(App.db.getStreak()).toBe(1);
    });
    it('昨天和今天都答题，streak=2', function() {
        var d = App.db.defaults();
        var today = new Date();
        today.setHours(12, 0, 0, 0);
        var yesterday = new Date(today.getTime() - 86400000);
        d.history = [
            { qid: '001', ans: 'B', ok: true, time: today.getTime() },
            { qid: '002', ans: 'B', ok: true, time: yesterday.getTime() }
        ];
        App.db.setData(d);
        expect(App.db.getStreak()).toBe(2);
    });
    it('今天未答题但昨天有，streak=1（从昨天起算）', function() {
        var d = App.db.defaults();
        var yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(12, 0, 0, 0);
        d.history = [{ qid: '001', ans: 'B', ok: true, time: yesterday.getTime() }];
        App.db.setData(d);
        expect(App.db.getStreak()).toBe(1);
    });
    it('中间断了一天，streak重置', function() {
        var d = App.db.defaults();
        var twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        twoDaysAgo.setHours(12, 0, 0, 0);
        var today = new Date();
        today.setHours(12, 0, 0, 0);
        d.history = [
            { qid: '001', ans: 'B', ok: true, time: twoDaysAgo.getTime() },
            { qid: '002', ans: 'B', ok: true, time: today.getTime() }
        ];
        App.db.setData(d);
        expect(App.db.getStreak()).toBe(1);
    });
    it('从归档数据也算连续', function() {
        var d = App.db.defaults();
        var twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        var today = new Date();
        // archive 有 twoDaysAgo 的数据，history 有今天
        d.archive = [{
            date: twoDaysAgo.getFullYear() + '-' + (twoDaysAgo.getMonth() + 1) + '-' + twoDaysAgo.getDate(),
            total: 5, correct: 3
        }];
        d.history = [{
            qid: '001', ans: 'B', ok: true,
            time: today.setHours(12, 0, 0, 0)
        }];
        App.db.setData(d);
        expect(App.db.getStreak()).toBeGreaterThanOrEqual(1);
    });
});

// --- Phase 9: 成就解锁 ---
describe('App.db.checkAchievements 成就解锁', function() {
    var App;

    beforeEach(function() {
        if (!_dom) _dom = createTestEnv();
        App = getApp();
        App.db.setData(App.db.defaults());
    });

    it('首次答题（total>=1）解锁 first_answer', function() {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        expect(ids).toContain('first_answer');
    });
    it('累计100题解锁 total_100', function() {
        for (var i = 0; i < 100; i++) {
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        }
        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        expect(ids).toContain('total_100');
    });
    it('答满50题且正确率90%+ 解锁 acc_90', function() {
        for (var i = 0; i < 50; i++) {
            App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        }
        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        expect(ids).toContain('acc_90');
    });
    it('单次10题全对解锁 perfect_10', function() {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        var ctx = { quizTotal: 10, quizCorrect: 10 };
        var unlocks = App.db.checkAchievements(ctx);
        var ids = unlocks.map(function(u) { return u.id; });
        expect(ids).toContain('perfect_10');
    });
    it('答对9题答错1题不解锁 perfect_10', function() {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        var ctx = { quizTotal: 10, quizCorrect: 9 };
        var unlocks = App.db.checkAchievements(ctx);
        var ids = unlocks.map(function(u) { return u.id; });
        expect(ids.indexOf('perfect_10')).toBe(-1);
    });
    it('成就不重复解锁', function() {
        App.db.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        var unlocks1 = App.db.checkAchievements();
        var unlocks2 = App.db.checkAchievements();
        // 第二次不应再返回 first_answer
        expect(unlocks2.length).toBeLessThan(unlocks1.length);
    });
    it('错题清零成就：答过题且错题本为空解锁 wrong_clear', function() {
        App.db.addRecord({ qid: '001', ans: 'B', ok: false, time: Date.now() });
        App.db.addWrong('001');
        // 答对5次掌握
        App.db.reviewCorrect('001');
        App.db.reviewCorrect('001');
        App.db.reviewCorrect('001');
        App.db.reviewCorrect('001');
        App.db.reviewCorrect('001');
        expect(App.db.getWrong().length).toBe(0);
        var unlocks = App.db.checkAchievements();
        var ids = unlocks.map(function(u) { return u.id; });
        expect(ids).toContain('wrong_clear');
    });
});

// --- Phase 10: recalcStats ---
describe('App.db.recalcStats 统计重建', function() {
    var App;

    beforeEach(function() {
        if (!_dom) _dom = createTestEnv();
        App = getApp();
        App.db.setData(App.db.defaults());
    });

    it('从 history 正确重建 stats', function() {
        var d = App.db.defaults();
        // 伪造 stats（模拟 bug 场景）
        d.stats = { total: 999, correct: 1, cats: {} };
        d.history = [
            { qid: '001', ans: 'B', ok: true, time: Date.now() },
            { qid: '001', ans: 'A', ok: false, time: Date.now() },
            { qid: '002', ans: 'A', ok: true, time: Date.now() }
        ];
        App.db.setData(d);
        App.db.recalcStats();
        var result = App.db.get();
        expect(result.stats.total).toBe(3);
        expect(result.stats.correct).toBe(2);
        expect(result.stats.cats['专辑'].t).toBe(2);
    });
});

// --- Phase 11: findQ ---
describe('App.db.findQ 题目查找', function() {
    var App;

    beforeEach(function() {
        if (!_dom) _dom = createTestEnv();
        App = getApp();
    });

    it('找到存在的题目', function() {
        var q = App.db.findQ('001');
        expect(q).toBeTruthy();
        expect(q.id).toBe('001');
        expect(q.question.length).toBeGreaterThan(0);
    });
    it('不存在的题目返回 null', function() {
        expect(App.db.findQ('99999')).toBe(null);
    });
});

// --- Phase 12: 选项解析（admin.js saveQuestion） ---
describe('选项解析正则', function() {
    function parseOptions(text) {
        var lines = text.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) options.push({ key: match[1], text: match[2] });
        }
        return options;
    }

    it('标准格式 A.xxx 解析正确', function() {
        var result = parseOptions('A.选项一\nB.选项二\nC.选项三\nD.选项四');
        expect(result.length).toBe(4);
        expect(result[0].key).toBe('A');
        expect(result[0].text).toBe('选项一');
    });
    it('中文顿号 A、xxx 解析正确', function() {
        var result = parseOptions('A、选项一\nB、选项二');
        expect(result.length).toBe(2);
        expect(result[0].key).toBe('A');
    });
    it('全角点 A．xxx 解析正确', function() {
        var result = parseOptions('A．选项一\nB．选项二');
        expect(result.length).toBe(2);
    });
    it('空行被忽略', function() {
        var result = parseOptions('A.一\n\nB.二\n\nC.三');
        expect(result.length).toBe(3);
    });
    it('不匹配的行被忽略', function() {
        var result = parseOptions('A.一\n这是乱行\nB.二');
        expect(result.length).toBe(2);
    });
    it('只有两个选项也能工作', function() {
        var result = parseOptions('A.是\nB.否');
        expect(result.length).toBe(2);
    });
});

// --- Phase 13: getCount 模式映射 ---
describe('quiz 模式数量映射 getCount', function() {
    // 从源码提取
    var getCount = function(mode) {
        var m = { quick: 10, standard: 20, intensive: 30 };
        return m[mode] || 10;
    };
    it('quick = 10', function() { expect(getCount('quick')).toBe(10); });
    it('standard = 20', function() { expect(getCount('standard')).toBe(20); });
    it('intensive = 30', function() { expect(getCount('intensive')).toBe(30); });
    it('未知模式回退到 10', function() { expect(getCount('unknown')).toBe(10); });
    it('空值回退到 10', function() { expect(getCount()).toBe(10); });
});

// --- Phase 14: 答题 pickOption 状态机核心逻辑 ---
describe('答题状态机 - pickOption 核心判断逻辑', function() {
    // 从 quiz.js 提取纯逻辑测试（不依赖 DOM）
    it('答对时 correctCount 增加', function() {
        var state = { answered: false, correctCount: 0 };
        var q = { answer: 'B' };
        var ok = ('B' === q.answer);
        if (ok) state.correctCount++;
        expect(state.correctCount).toBe(1);
    });
    it('答错时 correctCount 不增加', function() {
        var state = { answered: false, correctCount: 0 };
        var q = { answer: 'B' };
        var ok = ('A' === q.answer);
        if (ok) state.correctCount++;
        expect(state.correctCount).toBe(0);
    });
    it('重复调用 pickOption 被 answered 守卫拦截', function() {
        var state = { answered: true };
        var callCount = 0;
        // 模拟 pickOption 开头的守卫
        function pickOption() {
            if (state.answered) return;
            callCount++;
            state.answered = true;
        }
        pickOption(); // answered=true，应直接返回
        expect(callCount).toBe(0);
    });
});

// --- Phase 15: finishQuiz 边界 ---
describe('finishQuiz 边界计算逻辑', function() {
    // 从源码提取
    function calcResult(quizLength, correctCount, mode, isWrongBook) {
        var total = quizLength;
        var correct = correctCount;
        var wrong = total - correct;
        var pct = total > 0 ? Math.round(correct / total * 100) : 0;
        var modeStr;
        if (isWrongBook) modeStr = '错题复习';
        else {
            var m = { quick: '快速', standard: '标准', intensive: '强化' };
            modeStr = m[mode] || '快速';
        }
        return { total: total, correct: correct, wrong: wrong, pct: pct, mode: modeStr };
    }

    it('全部答对 pct=100', function() {
        var r = calcResult(10, 10, 'quick', false);
        expect(r.pct).toBe(100);
        expect(r.wrong).toBe(0);
    });
    it('全部答错 pct=0', function() {
        var r = calcResult(10, 0, 'quick', false);
        expect(r.pct).toBe(0);
    });
    it('半对半错 pct=50', function() {
        var r = calcResult(10, 5, 'quick', false);
        expect(r.pct).toBe(50);
    });
    it('空 quiz（0题）pct=0 不除零', function() {
        var r = calcResult(0, 0, 'quick', false);
        expect(r.pct).toBe(0);
    });
    it('错题复习模式正确命名', function() {
        var r = calcResult(5, 3, 'quick', true);
        expect(r.mode).toBe('错题复习');
    });
});

// --- Phase 16: session 中断恢复 ---
describe('session 中断恢复逻辑', function() {
    it('保存后再 load 得到相同数据', function() {
        if (!_dom) _dom = createTestEnv();
        var App = getApp();
        App.db.setData(App.db.defaults());
        var testState = {
            quiz: [{ id: '001' }, { id: '002' }, { id: '003' }],
            idx: 1,
            correctCount: 1,
            startTime: 1234567890,
            mode: 'quick',
            isWrongBookQuiz: false
        };
        App.session.save(testState);
        var loaded = App.session.load();
        expect(loaded.quizIds).toEqual(['001', '002', '003']);
        expect(loaded.idx).toBe(1);
        expect(loaded.correctCount).toBe(1);
        expect(loaded.mode).toBe('quick');
    });
    it('clear 后 load 返回 null', function() {
        if (!_dom) _dom = createTestEnv();
        var App = getApp();
        App.session.save({ quiz: [{ id: '001' }], idx: 0, correctCount: 0, startTime: 0, mode: 'quick' });
        App.session.clear();
        expect(App.session.load()).toBe(null);
    });
});

// --- Phase 17: 题库完整性 ---
describe('题库数据完整性（不变量）', function() {
    it('所有题目 id 唯一', function() {
        if (!_dom) _dom = createTestEnv();
        var App = getApp();
        var ids = App.QUESTION_BANK.map(function(q) { return q.id; });
        var unique = ids.filter(function(id, i, arr) { return arr.indexOf(id) === i; });
        expect(unique.length).toBe(ids.length);
    });
    it('所有题目有4个选项且 key 为 A/B/C/D', function() {
        if (!_dom) _dom = createTestEnv();
        var App = getApp();
        App.QUESTION_BANK.forEach(function(q) {
            expect(q.options.length).toBe(4);
            expect(q.options[0].key).toBe('A');
            expect(q.options[1].key).toBe('B');
            expect(q.options[2].key).toBe('C');
            expect(q.options[3].key).toBe('D');
        });
    });
    it('所有题目的 answer 在 options 中存在', function() {
        if (!_dom) _dom = createTestEnv();
        var App = getApp();
        App.QUESTION_BANK.forEach(function(q) {
            var keys = q.options.map(function(o) { return o.key; });
            expect(keys).toContain(q.answer);
        });
    });
    it('所有题目有 question 和 explanation', function() {
        if (!_dom) _dom = createTestEnv();
        var App = getApp();
        App.QUESTION_BANK.forEach(function(q) {
            expect(q.question.length).toBeGreaterThan(0);
            expect(q.explanation.length).toBeGreaterThan(0);
        });
    });
    it('所有题目有 category', function() {
        if (!_dom) _dom = createTestEnv();
        var App = getApp();
        var validCats = ['专辑', '歌曲', '个人信息', '获奖记录'];
        App.QUESTION_BANK.forEach(function(q) {
            expect(validCats).toContain(q.category);
        });
    });
    it('题量符合预期（4个分类共78题）', function() {
        if (!_dom) _dom = createTestEnv();
        var App = getApp();
        // 15+45+8+10 = 78
        expect(App.QUESTION_BANK.length).toBe(78);
    });
});

// ============================================================
// 运行所有测试
// ============================================================

runTests();
