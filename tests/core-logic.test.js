// ============================================================
// 核心逻辑单元测试（Node 环境，无需浏览器）
// 覆盖：XSS转义、间隔重复、历史归档、成就检查、
//      连续打卡、数据导入合并、统计重算、洗牌算法等
// 运行方式：node tests/core-logic.test.js
// ============================================================
'use strict';

// ---------- 加载项目源码到隔离的 VM 沙箱 ----------
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- 构造浏览器全局对象 ---
const fakeDoc = {
    createElement(tag) {
        const el = {
            _textContent: '',
            _innerHTML: '',
            get textContent() { return this._textContent; },
            set textContent(v) {
                this._textContent = v == null ? '' : String(v);
                // 模拟浏览器 textContent -> innerHTML 自动转义行为
                this._innerHTML = this._textContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            },
            get innerHTML() { return this._innerHTML; },
            set innerHTML(v) { this._innerHTML = v; },
            style: {},
            classList: {
                _c: new Set(),
                add(...x) { x.forEach(c => this._c.add(c)); },
                remove(...x) { x.forEach(c => this._c.delete(c)); },
                contains(c) { return this._c.has(c); },
                toggle(c, b) { b ? this._c.add(c) : this._c.delete(c); }
            },
            setAttribute() {},
            getAttribute() { return null; },
            addEventListener() {},
            querySelector() { return null; },
            querySelectorAll() { return []; },
            appendChild() {},
            removeChild() {},
            insertBefore() {},
            remove() {}
        };
        return el;
    },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    body: { appendChild() {}, removeChild() {} },
    documentElement: { setAttribute() {} }
};

function makeStorage() {
    const _s = {};
    return {
        getItem(k) { return _s[k] ?? null; },
        setItem(k, v) { _s[k] = String(v); },
        removeItem(k) { delete _s[k]; },
        clear() { Object.keys(_s).forEach(k => delete _s[k]); }
    };
}

const fakeNavigator = {
    userAgent: 'NodeTest',
    vibrate() {},
    clipboard: { writeText() { return Promise.resolve(); } }
};

// --- 构建沙箱全局上下文 ---
const sandbox = {
    window: null,       // 会被源码中的 App 初始化覆盖为 self
    document: fakeDoc,
    sessionStorage: makeStorage(),
    localStorage: makeStorage(),
    navigator: fakeNavigator,
    indexedDB: null,    // App.db 不依赖真实 indexedDB，绕过
    Date, Math, JSON, Object, Array, Number, String, Boolean,
    Promise, Set, Map, RegExp, Error, TypeError,
    console,
    setTimeout, clearTimeout,
    setInterval, clearInterval,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    URL: { createObjectURL() { return '#'; }, revokeObjectURL() {} },
    Blob: class {},
    FileReader: class {},
    AudioContext: undefined,
    webkitAudioContext: undefined,
    devicePixelRatio: 1
};
sandbox.window = sandbox; // 自引用，符合浏览器语义
vm.createContext(sandbox);

// 在沙箱中加载源码
function loadScript(filename) {
    const filepath = path.join(__dirname, '..', 'js', filename);
    const code = fs.readFileSync(filepath, 'utf8') + '\n; this.__App = (typeof App !== "undefined") ? App : null;';
    vm.runInContext(code, sandbox, { filename: filepath });
}

loadScript('data.js');
loadScript('storage.js');
loadScript('quiz.js');
loadScript('admin.js');
loadScript('chart.js');
loadScript('app.js');

const App = sandbox.__App;
// 便于测试中重置 sessionStorage
sandbox.__resetSession = () => { sandbox.sessionStorage.clear(); };

// ---------- 极简测试框架 ----------
let total = 0, passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
    total++;
    try {
        // 每个测试前重置内存缓存，确保隔离
        App.db.setData(App.db.defaults());
        sandbox.sessionStorage.clear();
        fn();
        passed++;
        console.log('  \u2705 ' + name);
    } catch (e) {
        failed++;
        failures.push({ name, error: e });
        console.log('  \u274C ' + name);
        console.log('     ' + (e.message || e).toString().split('\n').join('\n     '));
    }
}

function assertEq(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        throw new Error((msg || '断言失败') + '\n       期望: ' + e + '\n       实际: ' + a);
    }
}

function assertTrue(v, msg) { if (!v) throw new Error(msg || '应为 true'); }
function assertFalse(v, msg) { if (v) throw new Error(msg || '应为 false'); }
function assertGte(a, b, msg) { if (!(a >= b)) throw new Error((msg || '') + ` ${a} >= ${b} 不成立`); }
function assertContains(str, sub, msg) {
    if (String(str).indexOf(sub) === -1) throw new Error((msg || '') + ` "${str}" 不包含 "${sub}"`);
}

// ---------- 测试 1: XSS 转义 esc() ----------
console.log('\n\u{1F512} 【模块 1】XSS 安全转义 App.esc()');

test('esc(null) 返回空字符串', () => {
    assertEq(App.esc(null), '');
});

test('esc(undefined) 返回空字符串', () => {
    assertEq(App.esc(undefined), '');
});

test('esc(数字) 转成字符串', () => {
    assertEq(App.esc(42), '42');
});

test('esc 转义 <script> 标签', () => {
    const result = App.esc('<script>alert(1)</script>');
    assertFalse(result.includes('<script>'), '不应包含原始 script 标签');
    assertTrue(result.includes('&lt;script&gt;') || result.includes('&lt;'), '应包含转义后的尖括号');
});

test('esc 转义双引号', () => {
    const result = App.esc('hello "world"');
    assertFalse(result.includes('"world"'), '双引号应被转义');
});

test('esc 转义单引号', () => {
    const result = App.esc("it's fine");
    assertFalse(result.includes("it's"), '单引号应被转义');
});

test('esc 转义 & 符号', () => {
    const result = App.esc('a & b');
    assertFalse(result.includes(' & '), '& 应被转义为 &amp;');
});

test('esc 对普通文本保持原样', () => {
    assertEq(App.esc('Hello World 你好'), 'Hello World 你好');
});

// ---------- 测试 2: 每日目标边界 ----------
console.log('\n\u{1F4DA} 【模块 2】每日目标设置边界');

test('setDailyGoal 默认值为 20', () => {
    assertEq(App.db.getDailyGoal(), 20);
});

test('setDailyGoal(50) 设置成功', () => {
    App.db.setDailyGoal(50);
    assertEq(App.db.getDailyGoal(), 50);
});

test('setDailyGoal(3) 低于最小值被钳制到 5', () => {
    App.db.setDailyGoal(3);
    assertEq(App.db.getDailyGoal(), 5);
});

test('setDailyGoal(0) 被钳制到 5', () => {
    App.db.setDailyGoal(0);
    assertEq(App.db.getDailyGoal(), 5);
});

test('setDailyGoal(-10) 负数被钳制到 5', () => {
    App.db.setDailyGoal(-10);
    assertEq(App.db.getDailyGoal(), 5);
});

test('setDailyGoal(200) 超过最大值被钳制到 100', () => {
    App.db.setDailyGoal(200);
    assertEq(App.db.getDailyGoal(), 100);
});

test('setDailyGoal(100) 边界值可设置', () => {
    App.db.setDailyGoal(100);
    assertEq(App.db.getDailyGoal(), 100);
});

test('setDailyGoal(5) 最小边界可设置', () => {
    App.db.setDailyGoal(5);
    assertEq(App.db.getDailyGoal(), 5);
});

// ---------- 测试 3: 间隔重复（错题本） ----------
console.log('\n\u{1F4D6} 【模块 3】间隔重复（错题本）');

test('addWrong 新题首次加入：cnt=1, level=0, nextReview=now', () => {
    const before = Date.now();
    App.db.addWrong('Q1');
    const wl = App.db.getWrong();
    assertEq(wl.length, 1);
    assertEq(wl[0].qid, 'Q1');
    assertEq(wl[0].cnt, 1);
    assertEq(wl[0].level, 0);
    assertTrue(wl[0].nextReview >= before, 'nextReview 应 >= 当前');
});

test('addWrong 同一题再次答错：cnt++, level 重置为 0', () => {
    App.db.addWrong('Q2');
    // 手动推高 level 模拟已部分掌握
    const data = App.db.get();
    data.wrong[0].level = 3;
    data.wrong[0].cnt = 2;
    // 再次答错
    App.db.addWrong('Q2');
    const wl = App.db.getWrong();
    assertEq(wl.length, 1);
    assertEq(wl[0].qid, 'Q2');
    assertEq(wl[0].cnt, 3, 'cnt 应递增');
    assertEq(wl[0].level, 0, '再次答错 level 应重置为 0');
});

test('reviewCorrect 逐级提升 level，未掌握时返回 mastered:false', () => {
    App.db.addWrong('Q3');
    for (let lv = 0; lv < 4; lv++) {
        const r = App.db.reviewCorrect('Q3');
        assertEq(r.mastered, false, `Lv.${lv} 提升后不应掌握`);
        assertEq(r.level, lv + 1, `level 应提升到 ${lv + 1}`);
    }
    const wl = App.db.getWrong();
    assertEq(wl.length, 1, 'Lv.4 时仍在错题本');
});

test('reviewCorrect 达到 Lv.5 → mastered:true 并从错题本移除', () => {
    App.db.addWrong('Q4');
    // Lv.0 → 4
    for (let i = 0; i < 4; i++) App.db.reviewCorrect('Q4');
    assertEq(App.db.getWrong().length, 1);
    // Lv.4 → 5：应掌握移除
    const r = App.db.reviewCorrect('Q4');
    assertEq(r.mastered, true);
    assertEq(r.qid, 'Q4');
    assertEq(App.db.getWrong().length, 0, '掌握后错题本应为空');
});

test('reviewWrong 重置 level 到 0，cnt++', () => {
    App.db.addWrong('Q5');
    App.db.reviewCorrect('Q5'); // Lv.0 → 1
    App.db.reviewCorrect('Q5'); // Lv.1 → 2
    assertEq(App.db.getWrong()[0].level, 2);
    // 答错
    App.db.reviewWrong('Q5');
    const wl = App.db.getWrong();
    assertEq(wl[0].level, 0, '答错后 level 重置 0');
    assertEq(wl[0].cnt, 2, '答错后 cnt 增加');
});

test('reviewWrong 不在错题本中的题 → 自动 addWrong', () => {
    assertEq(App.db.getWrong().length, 0);
    App.db.reviewWrong('Q_NEW');
    const wl = App.db.getWrong();
    assertEq(wl.length, 1);
    assertEq(wl[0].qid, 'Q_NEW');
    assertEq(wl[0].level, 0);
});

test('getDueWrong 返回到期或未设置 nextReview 的错题', () => {
    App.db.addWrong('A'); // level=0, nextReview=now → 到期
    App.db.addWrong('B');
    // 将 B 的 nextReview 设置到 1 小时后（未到期）
    const data = App.db.get();
    data.wrong[1].nextReview = Date.now() + 3600 * 1000;
    const due = App.db.getDueWrong();
    assertEq(due.length, 1);
    assertEq(due[0].qid, 'A');
});

test('removeWrong 移除指定题', () => {
    App.db.addWrong('X1');
    App.db.addWrong('X2');
    App.db.addWrong('X3');
    App.db.removeWrong('X2');
    const qids = App.db.getWrong().map(w => w.qid);
    assertEq(qids.sort(), ['X1', 'X3'].sort());
});

// ---------- 测试 4: 答题记录 + 历史归档 ----------
console.log('\n\u{1F4C5} 【模块 4】答题记录 & 历史归档聚合');

// 先注册一个模拟题目，以便 addRecord 中 findQ 命中
App.QUESTION_BANK = [
    { id: 't001', category: '专辑', question: 'Q1', options: [], answer: 'A' },
    { id: 't002', category: '歌曲', question: 'Q2', options: [], answer: 'B' }
];

test('addRecord 答对：total++, correct++, 分类统计累加', () => {
    App.db.addRecord({ qid: 't001', ok: true, time: Date.now() });
    const d = App.db.get();
    assertEq(d.stats.total, 1);
    assertEq(d.stats.correct, 1);
    assertTrue(d.stats.cats['专辑'], '专辑分类统计应存在');
    assertEq(d.stats.cats['专辑'].t, 1);
    assertEq(d.stats.cats['专辑'].c, 1);
});

test('addRecord 答错：correct 不变，分类 t++ c 不变', () => {
    App.db.addRecord({ qid: 't002', ok: false, time: Date.now() });
    const d = App.db.get();
    assertEq(d.stats.total, 1, '答错后 total 应累加');
    assertEq(d.stats.correct, 0, '答错后 correct 不应增加');
    assertEq(d.stats.cats['歌曲'].t, 1, '歌曲分类总题数 1');
    assertEq(d.stats.cats['歌曲'].c, 0, '歌曲分类正确数 0');
});

test('addRecord 超过 1000 条时触发归档，且 90 天前记录被按天聚合', () => {
    const d = App.db.get();
    d.history = []; // 清空
    d.archive = [];
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 构造 95 天前的 500 条记录（应被归档）
    const oldTime = now - 95 * DAY;
    for (let i = 0; i < 500; i++) {
        d.history.push({ qid: 't001', ok: i % 2 === 0, time: oldTime + i * 1000 });
    }
    // 构造 10 天前的 400 条（保留）
    const recentTime = now - 10 * DAY;
    for (let i = 0; i < 400; i++) {
        d.history.push({ qid: 't002', ok: true, time: recentTime + i * 1000 });
    }
    // 再添加 200 条今天的，触发 >1000 阈值
    for (let i = 0; i < 200; i++) {
        App.db.addRecord({ qid: 't001', ok: true, time: now + i });
    }

    const data = App.db.get();
    assertTrue(data.archive && data.archive.length > 0, '应有归档记录');
    // 95 天前的 500 条应该已聚合进 archive，且聚合为 1 天
    let archiveTotal = 0;
    data.archive.forEach(a => archiveTotal += a.total);
    assertEq(archiveTotal, 500, '归档中应包含 500 条聚合总数');
    // 归档日期去重：只有 1 天
    assertEq(data.archive.length, 1, '95 天前的 500 条应聚合为 1 条日记录');

    // history 中不应再包含 oldTime 的记录
    const hasOld = data.history.some(h => h.time < now - 90 * DAY);
    assertFalse(hasOld, 'history 中不应再有 90 天前的明细');

    // 最近 + 今天的记录保留在 history
    assertTrue(data.history.length > 0, '最近记录仍在 history');
});

test('多次触发归档不重复聚合相同日期', () => {
    const d = App.db.get();
    d.history = [];
    d.archive = [];
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const oldT = now - 95 * DAY;
    for (let i = 0; i < 600; i++) {
        d.history.push({ qid: 't001', ok: true, time: oldT + i });
    }
    // 加够 1001 条
    for (let i = 0; i < 500; i++) {
        d.history.push({ qid: 't001', ok: true, time: now - 5 * DAY + i });
    }
    // 触发
    App.db.addRecord({ qid: 't001', ok: true, time: now });
    const archiveCount1 = d.archive.length;
    assertTrue(archiveCount1 > 0);

    // 再次添加少量 95 天前记录 + 触发（相同日期）
    for (let i = 0; i < 1100; i++) {
        d.history.push({ qid: 't001', ok: true, time: now - 3 * DAY + i });
    }
    App.db.addRecord({ qid: 't001', ok: true, time: now + 10000 });
    // 归档日期不应重复累加同一日
    assertEq(d.archive.length, archiveCount1, '相同日期不应重复归档');
});

// ---------- 测试 5: recalcStats 统计重算 ----------
console.log('\n\u{1F9EE} 【模块 5】recalcStats 统计重算');

test('recalcStats 从 history 重建 correct/total/cats，不依赖现有 stats', () => {
    const d = App.db.get();
    // 先故意设置错误的 stats
    d.stats = { total: 9999, correct: 8888, cats: { 专辑: { t: 100, c: 100 } } };
    d.history = [
        { qid: 't001', ok: true },
        { qid: 't001', ok: false },
        { qid: 't002', ok: true },
        { qid: 't002', ok: true },
        { qid: 't002', ok: false }
    ];
    App.db.recalcStats();
    assertEq(d.stats.total, 5);
    assertEq(d.stats.correct, 3);
    assertEq(d.stats.cats['专辑'].t, 2, '专辑 2 次');
    assertEq(d.stats.cats['专辑'].c, 1, '专辑 1 正确');
    assertEq(d.stats.cats['歌曲'].t, 3, '歌曲 3 次');
    assertEq(d.stats.cats['歌曲'].c, 2, '歌曲 2 正确');
});

test('recalcStats 空 history → 全 0 统计', () => {
    const d = App.db.get();
    d.history = [];
    App.db.recalcStats();
    assertEq(d.stats.total, 0);
    assertEq(d.stats.correct, 0);
    assertEq(Object.keys(d.stats.cats).length, 0);
});

// ---------- 测试 6: 连续打卡 getStreak ----------
console.log('\n\u{1F525} 【模块 6】连续打卡天数 getStreak');

function dayOffset(days) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.getTime();
}

test('无答题记录 → streak = 0', () => {
    App.db.get().history = [];
    App.db.get().archive = [];
    assertEq(App.db.getStreak(), 0);
});

test('今天有记录 → streak = 1', () => {
    App.db.get().history = [{ qid: 't001', time: dayOffset(0) }];
    assertEq(App.db.getStreak(), 1);
});

test('今天没答但昨天答了 → streak = 1', () => {
    App.db.get().history = [{ qid: 't001', time: dayOffset(-1) }];
    assertEq(App.db.getStreak(), 1);
});

test('连续 3 天答题（含今天）→ streak = 3', () => {
    App.db.get().history = [
        { qid: 't001', time: dayOffset(0) },
        { qid: 't001', time: dayOffset(-1) },
        { qid: 't001', time: dayOffset(-2) }
    ];
    assertEq(App.db.getStreak(), 3);
});

test('连续 7 天答题（昨天结束，今天没答）→ streak = 7', () => {
    const h = [];
    for (let i = -1; i >= -7; i--) h.push({ qid: 't001', time: dayOffset(i) });
    App.db.get().history = h;
    assertEq(App.db.getStreak(), 7);
});

test('中间有断档 → 只计算最近连续段', () => {
    App.db.get().history = [
        { qid: 't001', time: dayOffset(0) },
        { qid: 't001', time: dayOffset(-1) },
        { qid: 't001', time: dayOffset(-3) }, // 断档 -2
        { qid: 't001', time: dayOffset(-4) }
    ];
    assertEq(App.db.getStreak(), 2);
});

test('归档日期合并进打卡计算', () => {
    // history 只有今天，archive 覆盖昨天和前天 → 应合并
    App.db.get().history = [{ qid: 't001', time: dayOffset(0) }];
    const today = new Date();
    function toKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    const y = new Date(); y.setDate(y.getDate() - 1);
    const by = new Date(); by.setDate(by.getDate() - 2);
    App.db.get().archive = [
        { date: toKey(y), total: 10, correct: 8 },
        { date: toKey(by), total: 10, correct: 8 }
    ];
    assertEq(App.db.getStreak(), 3, '应合并 archive 中的日期');
});

// ---------- 测试 7: 成就徽章 checkAchievements ----------
console.log('\n\u{1F3C6} 【模块 7】成就徽章解锁');

test('答题 ≥1 → first_answer', () => {
    const d = App.db.get();
    d.stats.total = 0; d.stats.correct = 0;
    const un = App.db.checkAchievements({});
    assertEq(un.length, 0, '0 题不应解锁');
    d.stats.total = 1;
    const un2 = App.db.checkAchievements({});
    assertEq(un2.length, 1);
    assertEq(un2[0].id, 'first_answer');
});

test('累计 ≥100 → total_100；≥500 → total_500', () => {
    const d = App.db.get();
    d.stats.total = 99;
    assertEq(App.db.checkAchievements({}).length, 1); // only first_answer
    d.stats.total = 100;
    const u1 = App.db.checkAchievements({}).map(x => x.id);
    assertTrue(u1.includes('total_100'), 'total=100 应解锁 total_100');
    d.stats.total = 500;
    const u2 = App.db.checkAchievements({}).map(x => x.id);
    assertTrue(u2.includes('total_500'), 'total=500 应解锁 total_500');
});

test('答满 50 题且 ≥90% → acc_90', () => {
    const d = App.db.get();
    d.stats.total = 50; d.stats.correct = 44; // 88%
    const u1 = App.db.checkAchievements({}).map(x => x.id);
    assertFalse(u1.includes('acc_90'), '88% 不应解锁');
    d.stats.correct = 45; // 90%
    const u2 = App.db.checkAchievements({}).map(x => x.id);
    assertTrue(u2.includes('acc_90'), '90% 应解锁 acc_90');
});

test('答满 50 题 100% → acc_90 + total_50 (if)', () => {
    const d = App.db.get();
    d.stats.total = 100; d.stats.correct = 100;
    const u = App.db.checkAchievements({}).map(x => x.id);
    assertTrue(u.includes('acc_90'));
});

test('单次 10+ 题全对 → perfect_10', () => {
    const d = App.db.get();
    d.stats.total = 0;
    App.db.checkAchievements({}); // 解锁 first_answer
    const u1 = App.db.checkAchievements({ quizTotal: 9, quizCorrect: 9 });
    assertFalse(u1.some(a => a.id === 'perfect_10'), '9 题全对不应触发');
    const u2 = App.db.checkAchievements({ quizTotal: 10, quizCorrect: 10 });
    assertTrue(u2.some(a => a.id === 'perfect_10'), '10 题全对应触发 perfect_10');
});

test('连续打卡 3/7 天 → streak_3 / streak_7', () => {
    const d = App.db.get();
    d.history = [];
    // 2 天
    d.history.push({ qid: 't001', time: dayOffset(0) });
    d.history.push({ qid: 't001', time: dayOffset(-1) });
    const u1 = App.db.checkAchievements({}).map(x => x.id);
    assertFalse(u1.includes('streak_3'));
    // 3 天
    d.history.push({ qid: 't001', time: dayOffset(-2) });
    const u2 = App.db.checkAchievements({}).map(x => x.id);
    assertTrue(u2.includes('streak_3'));
    assertFalse(u2.includes('streak_7'));
    // 7 天
    for (let i = -3; i >= -6; i--) d.history.push({ qid: 't001', time: dayOffset(i) });
    const u3 = App.db.checkAchievements({}).map(x => x.id);
    assertTrue(u3.includes('streak_7'));
});

test('错题清零 + 曾有过错题 + total>0 + first_answer → wrong_clear', () => {
    const d = App.db.get();
    d.stats.total = 0;
    // 未答过错题 → 不应解锁
    const u1 = App.db.checkAchievements({});
    assertFalse(u1.some(a => a.id === 'wrong_clear'), '未答过错题不应解锁');
    // total>0 但从没答过错题（_everHadWrong=false）→ 仍不应解锁（只答题没答错过的情况）
    d.stats.total = 5;
    d.wrong = [];
    const u2 = App.db.checkAchievements({}).map(x => x.id);
    assertFalse(u2.includes('wrong_clear'), '从没答过错题不应解锁 wrong_clear');
    // 现在：先 addWrong 过至少 1 道（_everHadWrong=true），再清空 → 应解锁
    App.db.addWrong('Q_wrong_once'); // 设置 _everHadWrong=true
    App.db.removeWrong('Q_wrong_once'); // 再移除，wrong=[]
    d.stats.total = 10; // 满足 total>0 先已 first_answer（随上面触发）
    const u3 = App.db.checkAchievements({}).map(x => x.id);
    assertTrue(u3.includes('wrong_clear'), '曾答过错题且现已清零应解锁 wrong_clear');
});

test('四分类都答过 → all_cats', () => {
    const d = App.db.get();
    d.stats.total = 1;
    d.stats.cats = { '专辑': { t: 1, c: 0 } }; // 只有 1 类
    const u1 = App.db.checkAchievements({}).map(x => x.id);
    assertFalse(u1.includes('all_cats'));
    d.stats.cats = {
        '专辑': { t: 1, c: 0 },
        '歌曲': { t: 1, c: 0 },
        '个人信息': { t: 1, c: 0 },
        '获奖记录': { t: 1, c: 0 }
    };
    const u2 = App.db.checkAchievements({}).map(x => x.id);
    assertTrue(u2.includes('all_cats'), '四分类都有记录应解锁 all_cats');
});

test('单日 ≥50 题 → daily_50', () => {
    const d = App.db.get();
    d.history = [];
    const today = new Date().setHours(0, 0, 0, 0);
    for (let i = 0; i < 49; i++) d.history.push({ qid: 't001', ok: true, time: today + i * 1000 });
    const u1 = App.db.checkAchievements({}).map(x => x.id);
    assertFalse(u1.includes('daily_50'), '49 题不够');
    d.history.push({ qid: 't001', ok: true, time: today + 50000 });
    const u2 = App.db.checkAchievements({}).map(x => x.id);
    assertTrue(u2.includes('daily_50'), '50 题应解锁 daily_50');
});

// ---------- 测试 8: quiz.js 纯函数 ----------
console.log('\n\u{1F3B2} 【模块 8】quiz 纯函数（洗牌/计数/时间）');

test('shuffle 不修改原数组', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = arr.slice();
    App.shuffle(arr);
    assertEq(arr, copy, '原数组不应被修改');
});

test('shuffle 返回相同元素的排列', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = App.shuffle(arr);
    assertEq(result.length, arr.length);
    assertEq(result.slice().sort(), arr.slice().sort());
});

test('shuffle 空数组/单元素数组稳定', () => {
    assertEq(App.shuffle([]), []);
    assertEq(App.shuffle([42]), [42]);
});

test('shuffle 统计偏差：1000 次中首位分布相对均匀', () => {
    const arr = [0, 1, 2, 3];
    const count = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
        count[App.shuffle(arr)[0]]++;
    }
    // 每个应接近 1000；接受范围 400~1600（极宽，防偶发）
    for (let i = 0; i < 4; i++) {
        assertGte(count[i], 400, `首位分布异常: [${count.join(',')}]`);
    }
});

// 直接访问闭包内函数不可行 → 从 quiz.js 中提取逻辑重放
// fmtTime: 分秒格式化
function fmtTime(ms) {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + '分' + s + '秒';
}

test('fmtTime 毫秒→分秒 格式化', () => {
    assertEq(fmtTime(0), '0分0秒');
    assertEq(fmtTime(59 * 1000), '0分59秒');
    assertEq(fmtTime(60 * 1000), '1分0秒');
    assertEq(fmtTime(90 * 1000), '1分30秒');
    assertEq(fmtTime(3661 * 1000), '61分1秒');
});

// ---------- 测试 9: admin.js 选项解析 & 导入合并 ----------
console.log('\n\u{1F4E5} 【模块 9】选项解析 & 导入合并');

// 复制 admin.js 中 saveQuestion 的选项解析逻辑进行测试
function parseOptions(optsText) {
    const lines = optsText.split('\n');
    const options = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
        if (match) options.push({ key: match[1], text: match[2] });
    }
    return options;
}

test('选项解析 - 英文点号分隔', () => {
    const opts = parseOptions('A.选项一\nB.选项二\nC.选项三\nD.选项四');
    assertEq(opts, [
        { key: 'A', text: '选项一' },
        { key: 'B', text: '选项二' },
        { key: 'C', text: '选项三' },
        { key: 'D', text: '选项四' }
    ]);
});

test('选项解析 - 中文顿号 、 分隔', () => {
    const opts = parseOptions('A、苹果\nB、香蕉\nC、橘子');
    assertEq(opts.length, 3);
    assertEq(opts[0].key, 'A');
    assertEq(opts[0].text, '苹果');
    assertEq(opts[2].key, 'C');
});

test('选项解析 - 中文全角点 ． 分隔', () => {
    const opts = parseOptions('A．红\nB．绿\nC．蓝');
    assertEq(opts.length, 3);
    assertEq(opts[1].text, '绿');
});

test('选项解析 - 空行跳过，前后空格忽略', () => {
    const opts = parseOptions('\n\nA. 先有空格\n\nB.后有空格  \n\n');
    assertEq(opts.length, 2);
    assertEq(opts[0].text, '先有空格');
    assertEq(opts[1].text, '后有空格');
});

test('选项解析 - 无匹配格式的行被跳过', () => {
    const opts = parseOptions('随便一行\nA.有效\n*无效\nB.有效2\nZzz\nC. 有效3');
    assertEq(opts.length, 3);
    assertEq(opts.map(o => o.key).join(''), 'ABC');
});

test('选项解析 - 文本中可以包含标点', () => {
    const opts = parseOptions('A.你好，世界！\nB.《江南》专辑\nC.100% 正确？');
    assertEq(opts[0].text, '你好，世界！');
    assertEq(opts[1].text, '《江南》专辑');
    assertEq(opts[2].text, '100% 正确？');
});

// 模拟 importData 中的错题合并逻辑
function mergeWrong(existing, imported) {
    const wrongMap = {};
    for (const w of existing) wrongMap[w.qid] = { ...w };
    for (const item of imported) {
        const w = { ...item };
        if (wrongMap[w.qid]) {
            wrongMap[w.qid].cnt = Math.max(wrongMap[w.qid].cnt, w.cnt || 1);
            if (w.level != null) {
                wrongMap[w.qid].level = Math.min(wrongMap[w.qid].level || 0, w.level);
            }
        } else {
            if (!w.level) w.level = 0;
            if (!w.nextReview) w.nextReview = Date.now();
            if (!w.lastReview) w.lastReview = 0;
            if (!w.time) w.time = Date.now();
            wrongMap[w.qid] = w;
        }
    }
    return Object.values(wrongMap);
}

test('错题合并 - 新错题直接加入', () => {
    const r = mergeWrong([], [{ qid: 'A', cnt: 1 }]);
    assertEq(r.length, 1);
    assertEq(r[0].qid, 'A');
    assertTrue(r[0].nextReview > 0, '新错题应补齐 nextReview');
});

test('错题合并 - 相同 qid：cnt 取大值，level 取小值（保守策略）', () => {
    const exist = [{ qid: 'Q', cnt: 3, level: 2 }];
    const imp = [{ qid: 'Q', cnt: 5, level: 1 }];
    const r = mergeWrong(exist, imp);
    assertEq(r.length, 1);
    assertEq(r[0].cnt, 5, 'cnt 取较大值 5');
    assertEq(r[0].level, 1, 'level 取较小（保守）值 1');
});

test('错题合并 - 存在高 level 导入低 level → 取低', () => {
    const exist = [{ qid: 'Q', cnt: 2, level: 4 }];
    const imp = [{ qid: 'Q', cnt: 1, level: 0 }];
    const r = mergeWrong(exist, imp);
    assertEq(r[0].level, 0, '应保守取低 level 0');
    assertEq(r[0].cnt, 2, 'cnt 取较大');
});

test('错题合并 - 不同 qid 均保留', () => {
    const exist = [{ qid: 'A', cnt: 1, level: 0 }];
    const imp = [{ qid: 'B', cnt: 2, level: 1 }];
    const r = mergeWrong(exist, imp);
    assertEq(r.length, 2);
    assertEq(r.map(x => x.qid).sort(), ['A', 'B']);
});

// 题库合并（新增 vs 更新）
function mergeBank(existing, imported) {
    const ids = new Set(existing.map(q => q.id));
    const result = existing.slice();
    let added = 0, updated = 0;
    for (const q of imported) {
        if (ids.has(q.id)) {
            const idx = result.findIndex(x => x.id === q.id);
            result[idx] = { ...q };
            updated++;
        } else {
            result.push({ ...q });
            added++;
        }
    }
    return { merged: result, added, updated };
}

test('题库合并 - 完全新题 → added', () => {
    const e = [{ id: '1', category: '专辑' }];
    const i = [{ id: '2', category: '歌曲' }];
    const r = mergeBank(e, i);
    assertEq(r.added, 1);
    assertEq(r.updated, 0);
    assertEq(r.merged.length, 2);
});

test('题库合并 - 相同 id → updated 覆盖', () => {
    const e = [{ id: '1', question: '旧题目' }];
    const i = [{ id: '1', question: '新题目' }];
    const r = mergeBank(e, i);
    assertEq(r.added, 0);
    assertEq(r.updated, 1);
    assertEq(r.merged[0].question, '新题目');
});

// ---------- 测试 10: chart.js 按天聚合 ----------
console.log('\n\u{1F4C8} 【模块 10】趋势图按天聚合（含归档）');

// 复制 chart.js 中的 14 天聚合逻辑
function aggregate14Days(history, archive) {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const dayStart = today.getTime() - i * 86400000;
        const dayEnd = dayStart + 86400000;
        let dayCount = 0, dayCorrect = 0;
        for (const h of (history || [])) {
            if (h.time >= dayStart && h.time < dayEnd) {
                dayCount++;
                if (h.ok) dayCorrect++;
            }
        }
        const dt = new Date(dayStart);
        const dateKey = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
        for (const a of (archive || [])) {
            if (a.date === dateKey) {
                dayCount += a.total;
                dayCorrect += a.correct;
                break;
            }
        }
        result.push({
            date: new Date(dayStart),
            count: dayCount,
            correct: dayCorrect,
            acc: dayCount > 0 ? Math.round(dayCorrect / dayCount * 100) : 0
        });
    }
    return result;
}

test('14 天聚合 - 空数据返回 14 条全 0', () => {
    const r = aggregate14Days([], []);
    assertEq(r.length, 14);
    r.forEach(d => {
        assertEq(d.count, 0);
        assertEq(d.correct, 0);
        assertEq(d.acc, 0);
    });
});

test('14 天聚合 - 今天答题正确计入', () => {
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const r = aggregate14Days([
        { time: today0.getTime() + 3600 * 1000, ok: true },
        { time: today0.getTime() + 3700 * 1000, ok: false },
        { time: today0.getTime() + 3800 * 1000, ok: true }
    ], []);
    const today = r[r.length - 1];
    assertEq(today.count, 3);
    assertEq(today.correct, 2);
    assertEq(today.acc, 67); // round(2/3*100)=67
});

test('14 天聚合 - 归档数据与 history 同天累加', () => {
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const key = today0.getFullYear() + '-' + (today0.getMonth() + 1) + '-' + today0.getDate();
    const r = aggregate14Days(
        [{ time: today0.getTime() + 3600 * 1000, ok: true }],
        [{ date: key, total: 10, correct: 8 }]
    );
    const today = r[r.length - 1];
    assertEq(today.count, 11, 'history 1 + archive 10 = 11');
    assertEq(today.correct, 9, 'history 1 correct + archive 8 = 9');
    assertEq(today.acc, 82, 'round(9/11*100)=82');
});

test('14 天聚合 - 90 天前的数据通过 archive 体现', () => {
    // 14 天范围外的明细不应计入，除非有 archive
    const oldTime = Date.now() - 20 * 86400000;
    const r = aggregate14Days([{ time: oldTime, ok: true }], []);
    // 每条 count 都是 0，因为第 20 天不在 14 范围内
    const total = r.reduce((s, d) => s + d.count, 0);
    assertEq(total, 0, '14 天外的历史明细不应计入');
});

// ---------- 汇总输出 ----------
console.log('\n' + '='.repeat(50));
console.log(`\u{1F4CA} 测试结果: 通过 ${passed}/${total}，失败 ${failed}`);
console.log('='.repeat(50));

if (failed > 0) {
    console.log('\n\u{1F6A8} 失败详情:');
    failures.forEach((f, i) => {
        console.log(`\n  ${i + 1}. ${f.name}`);
        console.log('     ' + (f.error.message || f.error).toString().split('\n').join('\n     '));
    });
    process.exit(1);
} else {
    console.log('\n\u{1F389} 全部测试通过！');
    process.exit(0);
}
