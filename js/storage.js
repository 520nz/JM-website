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
        theme: 'dark'
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
    persist();
}

// 添加错题（含间隔重复逻辑）
function addWrong(qid) {
    var d = get();
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

// 答对错题时提升等级
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
            } else {
                w.nextReview = Date.now() + SR_INTERVALS[w.level];
            }
            persist();
            return;
        }
    }
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
    defaults: defaults
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
            mode: state.mode
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
