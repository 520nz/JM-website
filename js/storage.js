// ============================================================
// storage.js - 数据存储层（IndexedDB + 内存缓存）
// 优化点：统一 App 命名空间、XSS转义工具、间隔重复数据结构
// 核心策略：内存缓存 + 异步写入（保持 DB.get() 同步语义）
// ============================================================

var App = window.App || {};

(function() {

// --- XSS 转义工具 ---
function esc(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}
App.esc = esc;

// --- 间隔重复：间隔时间表（毫秒） ---
// level 0: 立即可复习
// level 1: 1小时后
// level 2: 1天后
// level 3: 3天后
// level 4: 7天后
// level 5: 已掌握，从错题本移除
var SR_INTERVALS = [
    0,                        // level 0
    1 * 60 * 60 * 1000,       // level 1: 1小时
    1 * 24 * 60 * 60 * 1000,  // level 2: 1天
    3 * 24 * 60 * 60 * 1000,  // level 3: 3天
    7 * 24 * 60 * 60 * 1000,  // level 4: 7天
];

// --- IndexedDB 配置 ---
var DB_NAME = 'jj_quiz_db';
var DB_VERSION = 1;
var STORE_USER = 'userData';      // keyPath: 'id'，仅一条记录 id='main'
var STORE_BANK = 'questionBank';  // keyPath: 'id'，每道题一条记录
var USER_DATA_ID = 'main';

var _db = null;     // IndexedDB 连接（复用）
var _cache = null;  // 用户数据内存缓存

// --- IndexedDB 操作封装 ---
function openDB() {
    return new Promise(function(resolve, reject) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_USER)) {
                db.createObjectStore(STORE_USER, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_BANK)) {
                db.createObjectStore(STORE_BANK, { keyPath: 'id' });
            }
        };
        req.onsuccess = function(e) { resolve(e.target.result); };
        req.onerror = function(e) { reject(e.target.error); };
    });
}

// 获取（并复用）数据库连接
function getDB() {
    if (_db) return Promise.resolve(_db);
    return openDB().then(function(db) { _db = db; return db; });
}

// 单条写入
function idbPut(storeName, value) {
    return getDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(value);
            tx.oncomplete = function() { resolve(); };
            tx.onerror = function(e) { reject(e.target.error); };
        });
    });
}

// 单条读取
function idbGet(storeName, key) {
    return getDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readonly');
            var req = tx.objectStore(storeName).get(key);
            req.onsuccess = function() { resolve(req.result); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    });
}

// 读取全部
function idbGetAll(storeName) {
    return getDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readonly');
            var req = tx.objectStore(storeName).getAll();
            req.onsuccess = function() { resolve(req.result || []); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    });
}

// 清空并批量写入
function idbClearAndPutAll(storeName, values) {
    return getDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readwrite');
            var store = tx.objectStore(storeName);
            store.clear();
            for (var i = 0; i < values.length; i++) {
                store.put(values[i]);
            }
            tx.oncomplete = function() { resolve(); };
            tx.onerror = function(e) { reject(e.target.error); };
        });
    });
}

// ============================================================
// App.db 模块（替换原 DB，内存缓存 + 异步写入）
// ============================================================

function defaults() {
    return {
        history: [],
        wrong: [],
        stats: { total: 0, correct: 0, cats: {} },
        theme: 'dark',
        dailyGoal: 20,
        achievements: [],
        archive: []
    };
}

// 从 IndexedDB 加载用户数据到内存缓存，返回 Promise
function init() {
    return getDB().then(function() {
        return idbGet(STORE_USER, USER_DATA_ID);
    }).then(function(row) {
        _cache = (row && row.data) ? row.data : defaults();
        return _cache;
    });
}

// 同步返回内存缓存（API 与原 DB.get() 保持一致）
function get() {
    if (!_cache) _cache = defaults();
    return _cache;
}

// 异步写入 IndexedDB（fire-and-forget，错误仅记录）
function persist() {
    if (!_cache) return Promise.resolve();
    return idbPut(STORE_USER, { id: USER_DATA_ID, data: _cache }).catch(function(err) {
        console.error('[App.db] persist failed:', err);
    });
}

// 查找题目（在 App.QUESTION_BANK 中）
function findQ(qid) {
    var bank = App.QUESTION_BANK || [];
    for (var i = 0; i < bank.length; i++) {
        if (bank[i].id === qid) return bank[i];
    }
    return null;
}

// 添加答题记录
function addRecord(rec) {
    var d = get();
    d.history.push(rec);
    d.stats.total++;
    if (rec.ok) d.stats.correct++;
    var q = findQ(rec.qid);
    if (q) {
        if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
        d.stats.cats[q.category].t++;
        if (rec.ok) d.stats.cats[q.category].c++;
    }
    // 历史数据归档：超过 1000 条时，把 90 天前的明细按天聚合
    if (d.history.length > 1000) {
        if (!d.archive) d.archive = [];
        var cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        var oldRecs = [];
        var newRecs = [];
        for (var i = 0; i < d.history.length; i++) {
            if (d.history[i].time < cutoff) oldRecs.push(d.history[i]);
            else newRecs.push(d.history[i]);
        }
        // 按天聚合
        var dayMap = {};
        for (var j = 0; j < oldRecs.length; j++) {
            var dt = new Date(oldRecs[j].time);
            var key = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
            if (!dayMap[key]) dayMap[key] = { date: key, total: 0, correct: 0 };
            dayMap[key].total++;
            if (oldRecs[j].ok) dayMap[key].correct++;
        }
        // 检查归档中是否已存在相同日期，避免重复归档
        var existingArchiveKeys = {};
        for (var a = 0; a < d.archive.length; a++) {
            existingArchiveKeys[d.archive[a].date] = true;
        }
        for (var k in dayMap) {
            if (!existingArchiveKeys[k]) {
                d.archive.push(dayMap[k]);
            }
        }
        d.history = newRecs;
    }
    persist();
}

// 添加错题（含间隔重复逻辑）
function addWrong(qid) {
    var d = get();
    d._everHadWrong = true; // 标记：曾有过错题（用于 wrong_clear 成就判断）
    var found = null;
    for (var i = 0; i < d.wrong.length; i++) {
        if (d.wrong[i].qid === qid) { found = d.wrong[i]; break; }
    }
    if (found) {
        found.cnt++;
        found.level = 0; // 答错重置等级
        found.lastReview = Date.now();
        found.nextReview = Date.now(); // 立即可复习
        found.time = found.time || Date.now();
    } else {
        d.wrong.push({
            qid: qid,
            cnt: 1,
            level: 0,
            time: Date.now(),
            lastReview: 0,
            nextReview: Date.now()
        });
    }
    persist();
}

// 答对错题时提升等级，返回是否已掌握
function reviewCorrect(qid) {
    var d = get();
    for (var i = 0; i < d.wrong.length; i++) {
        if (d.wrong[i].qid === qid) {
            var w = d.wrong[i];
            w.level++;
            w.lastReview = Date.now();
            if (w.level >= 5) {
                // 已掌握，从错题本移除
                d.wrong.splice(i, 1);
                persist();
                return { mastered: true, qid: qid };
            } else {
                w.nextReview = Date.now() + SR_INTERVALS[w.level];
                persist();
                return { mastered: false, level: w.level, qid: qid };
            }
        }
    }
    return { mastered: false, qid: qid };
}

// 答错错题时重置等级
function reviewWrong(qid) {
    var d = get();
    for (var i = 0; i < d.wrong.length; i++) {
        if (d.wrong[i].qid === qid) {
            var w = d.wrong[i];
            w.level = 0;
            w.cnt++;
            w.lastReview = Date.now();
            w.nextReview = Date.now();
            persist();
            return;
        }
    }
    // 不在错题本中，新增
    addWrong(qid);
}

// 移除错题
function removeWrong(qid) {
    var d = get();
    d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
    persist();
}

// 获取错题列表
function getWrong() {
    return get().wrong;
}

// 获取到期的错题（间隔重复）
function getDueWrong() {
    var now = Date.now();
    var wl = getWrong();
    var due = [];
    for (var i = 0; i < wl.length; i++) {
        if (!wl[i].nextReview || wl[i].nextReview <= now) {
            due.push(wl[i]);
        }
    }
    return due;
}

// 重新计算统计（用于导入数据后修复）
function recalcStats() {
    var d = get();
    var stats = { total: 0, correct: 0, cats: {} };
    for (var i = 0; i < d.history.length; i++) {
        var rec = d.history[i];
        stats.total++;
        if (rec.ok) stats.correct++;
        var q = findQ(rec.qid);
        if (q) {
            if (!stats.cats[q.category]) stats.cats[q.category] = { t: 0, c: 0 };
            stats.cats[q.category].t++;
            if (rec.ok) stats.cats[q.category].c++;
        }
    }
    d.stats = stats;
    persist();
}

// 直接设置数据（导入用）
function setData(data) {
    _cache = data;
    persist();
}

// --- 每日目标 ---
function getDailyGoal() {
    return get().dailyGoal || 20;
}

function setDailyGoal(n) {
    var d = get();
    d.dailyGoal = Math.max(5, Math.min(100, n));
    persist();
}

// --- 连续打卡天数计算 ---
function getStreak() {
    var d = get();
    var days = {};
    for (var i = 0; i < (d.history || []).length; i++) {
        var dt = new Date(d.history[i].time);
        // 与归档 date 格式统一：月份从 1 开始（addRecord 归档中使用 Month+1）
        days[dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate()] = true;
    }
    // 合并归档数据中的日期
    for (var j = 0; j < (d.archive || []).length; j++) {
        days[d.archive[j].date] = true;
    }
    if (Object.keys(days).length === 0) return 0;
    var streak = 0;
    var check = new Date();
    check.setHours(0, 0, 0, 0);
    var todayKey = check.getFullYear() + '-' + (check.getMonth() + 1) + '-' + check.getDate();
    if (!days[todayKey]) check.setTime(check.getTime() - 86400000);
    while (true) {
        var key = check.getFullYear() + '-' + (check.getMonth() + 1) + '-' + check.getDate();
        if (days[key]) {
            streak++;
            check.setTime(check.getTime() - 86400000);
        } else {
            break;
        }
    }
    return streak;
}

// --- 成就徽章检查 ---
var ACHIEVEMENTS = [
    { id: 'first_answer', name: '初出茅庐', icon: '🌱', desc: '完成第1次答题' },
    { id: 'perfect_10', name: '十全十美', icon: '💯', desc: '单次10题全部答对' },
    { id: 'daily_50', name: '勤奋粉丝', icon: '🔥', desc: '单日答题50题' },
    { id: 'streak_3', name: '三日坚持', icon: '📅', desc: '连续答题3天' },
    { id: 'streak_7', name: '七日之约', icon: '🗓️', desc: '连续答题7天' },
    { id: 'total_100', name: '百题斩', icon: '⚔️', desc: '累计答题100题' },
    { id: 'total_500', name: '五百题王', icon: '👑', desc: '累计答题500题' },
    { id: 'acc_90', name: '资深JM', icon: '🎓', desc: '答满50题且正确率≥90%' },
    { id: 'wrong_clear', name: '错题清零', icon: '✨', desc: '错题本全部掌握' },
    { id: 'all_cats', name: '全能粉丝', icon: '🌈', desc: '所有分类都有答题记录' }
];

function getAchievements() {
    return get().achievements || [];
}

function checkAchievements(context) {
    var d = get();
    if (!d.achievements) d.achievements = [];
    var newUnlocks = [];

    function has(id) { return d.achievements.indexOf(id) !== -1; }
    function unlock(id) {
        if (!has(id)) {
            d.achievements.push(id);
            var def = null;
            for (var i = 0; i < ACHIEVEMENTS.length; i++) {
                if (ACHIEVEMENTS[i].id === id) { def = ACHIEVEMENTS[i]; break; }
            }
            if (def) newUnlocks.push(def);
        }
    }

    var total = d.stats.total;
    var correct = d.stats.correct;

    if (total >= 1) unlock('first_answer');
    if (total >= 100) unlock('total_100');
    if (total >= 500) unlock('total_500');
    if (total >= 50 && correct / total >= 0.9) unlock('acc_90');

    // 完美一轮（context 传入本次答题成绩）
    if (context && context.quizTotal >= 10 && context.quizCorrect === context.quizTotal) unlock('perfect_10');

    // 单日50题
    var today = new Date().setHours(0, 0, 0, 0);
    var todayCount = 0;
    for (var i = 0; i < d.history.length; i++) {
        if (d.history[i].time >= today) todayCount++;
    }
    if (todayCount >= 50) unlock('daily_50');

    // 连续打卡
    var streak = getStreak();
    if (streak >= 3) unlock('streak_3');
    if (streak >= 7) unlock('streak_7');

    // 错题清零（曾有过错题且现在为空，且已答过至少 1 题）
    if (d.wrong.length === 0 && d._everHadWrong && total > 0 && has('first_answer')) unlock('wrong_clear');

    // 全分类
    var cats = d.stats.cats || {};
    var allCats = ['专辑', '歌曲', '个人信息', '获奖记录'];
    var hasAll = true;
    for (var c = 0; c < allCats.length; c++) {
        if (!cats[allCats[c]] || !cats[allCats[c]].t) { hasAll = false; break; }
    }
    if (hasAll) unlock('all_cats');

    if (newUnlocks.length > 0) persist();
    return newUnlocks;
}

function getAchievementDefs() {
    return ACHIEVEMENTS;
}

App.db = {
    init: init,
    get: get,
    addRecord: addRecord,
    addWrong: addWrong,
    reviewCorrect: reviewCorrect,
    reviewWrong: reviewWrong,
    removeWrong: removeWrong,
    getWrong: getWrong,
    getDueWrong: getDueWrong,
    findQ: findQ,
    recalcStats: recalcStats,
    setData: setData,
    defaults: defaults,
    getDailyGoal: getDailyGoal,
    setDailyGoal: setDailyGoal,
    getStreak: getStreak,
    getAchievements: getAchievements,
    checkAchievements: checkAchievements,
    getAchievementDefs: getAchievementDefs
};

// ============================================================
// App.store 模块（替换原 QuestionStore，题库存 IndexedDB）
// ============================================================

// 从 IndexedDB 加载题库到 App.QUESTION_BANK，返回 Promise
function storeInit() {
    return getDB().then(function() {
        return idbGetAll(STORE_BANK);
    }).then(function(rows) {
        if (rows && rows.length > 0) {
            App.QUESTION_BANK = rows;
            App.DEFAULT_QUESTION_BANK = App.QUESTION_BANK.slice();
        }
        // IndexedDB 中无题库时，保留 data.js 中的默认题库
    });
}

// 异步保存题库到 IndexedDB（每道题一条记录）
function storeSave() {
    return idbClearAndPutAll(STORE_BANK, App.QUESTION_BANK || []);
}

// 重置为默认题库
function storeReset() {
    App.QUESTION_BANK = App.DEFAULT_QUESTION_BANK.slice();
    return storeSave();
}

App.store = {
    init: storeInit,
    save: storeSave,
    reset: storeReset
};

// ============================================================
// App.session 模块（保持 sessionStorage，答题中断恢复）
// ============================================================
var SKEY = 'jj_quiz_session';

function sessionSave(state) {
    try {
        var data = {
            quizIds: state.quiz.map(function(q) { return q.id; }),
            idx: state.idx,
            correctCount: state.correctCount,
            startTime: state.startTime,
            mode: state.mode,
            isWrongBookQuiz: state.isWrongBookQuiz || false
        };
        sessionStorage.setItem(SKEY, JSON.stringify(data));
    } catch (e) {}
}

function sessionLoad() {
    try {
        var raw = sessionStorage.getItem(SKEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function sessionClear() {
    sessionStorage.removeItem(SKEY);
}

App.session = {
    save: sessionSave,
    load: sessionLoad,
    clear: sessionClear
};

})();
