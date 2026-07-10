// ============================================================
// storage.js - 数据存储层
// 优化点：内存缓存、XSS转义工具、间隔重复数据结构
// ============================================================

// --- XSS 转义工具 ---
function esc(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

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

// --- DB 模块（内存缓存优化） ---
var DB = (function() {
    var KEY = 'jj_quiz_v2';
    var _cache = null;  // 内存缓存

    function defaults() {
        return {
            history: [],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} }
        };
    }

    // 从 LocalStorage 读取（仅首次），后续从缓存读取
    function getData() {
        if (!_cache) {
            var raw = localStorage.getItem(KEY);
            try {
                _cache = raw ? JSON.parse(raw) : defaults();
            } catch (e) {
                _cache = defaults();
            }
        }
        return _cache;
    }

    // 写入 LocalStorage（从缓存序列化）
    function save() {
        localStorage.setItem(KEY, JSON.stringify(_cache));
    }

    // 查找题目
    function findQ(qid) {
        for (var i = 0; i < QUESTION_BANK.length; i++) {
            if (QUESTION_BANK[i].id === qid) return QUESTION_BANK[i];
        }
        return null;
    }

    // 添加答题记录
    function addRecord(rec) {
        var d = getData();
        d.history.push(rec);
        d.stats.total++;
        if (rec.ok) d.stats.correct++;
        var q = findQ(rec.qid);
        if (q) {
            if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
            d.stats.cats[q.category].t++;
            if (rec.ok) d.stats.cats[q.category].c++;
        }
        save();
    }

    // 添加错题（含间隔重复逻辑）
    function addWrong(qid) {
        var d = getData();
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
        save();
    }

    // 答对错题时提升等级
    function reviewCorrect(qid) {
        var d = getData();
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
                save();
                return;
            }
        }
    }

    // 答错错题时重置等级
    function reviewWrong(qid) {
        var d = getData();
        for (var i = 0; i < d.wrong.length; i++) {
            if (d.wrong[i].qid === qid) {
                var w = d.wrong[i];
                w.level = 0;
                w.cnt++;
                w.lastReview = Date.now();
                w.nextReview = Date.now();
                save();
                return;
            }
        }
        // 不在错题本中，新增
        addWrong(qid);
    }

    // 移除错题
    function removeWrong(qid) {
        var d = getData();
        d.wrong = d.wrong.filter(function(w) { return w.qid !== qid; });
        save();
    }

    // 获取错题列表
    function getWrong() {
        return getData().wrong;
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
        var d = getData();
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
        save();
    }

    // 直接设置数据（导入用）
    function setData(data) {
        _cache = data;
        save();
    }

    // 清除缓存（调试用）
    function clearCache() {
        _cache = null;
    }

    return {
        KEY: KEY,
        get: getData,
        save: save,
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
        clearCache: clearCache,
        defaults: defaults
    };
})();

// --- 题库存储（管理页面用） ---
var QuestionStore = (function() {
    var QKEY = 'jj_question_bank';

    function save() {
        localStorage.setItem(QKEY, JSON.stringify(QUESTION_BANK));
    }

    function load() {
        var saved = localStorage.getItem(QKEY);
        if (saved) {
            try {
                QUESTION_BANK = JSON.parse(saved);
                DEFAULT_QUESTION_BANK = QUESTION_BANK.slice();
            } catch (e) {}
        }
    }

    function reset() {
        // 恢复默认：需要重新加载原始数据
        localStorage.removeItem(QKEY);
        // 重新从 data.js 获取原始数据
        // 注意：DEFAULT_QUESTION_BANK 在 data.js 中已定义
        QUESTION_BANK = DEFAULT_QUESTION_BANK.slice();
    }

    return {
        save: save,
        load: load,
        reset: reset
    };
})();

// --- 会话存储（答题中断恢复） ---
var Session = (function() {
    var SKEY = 'jj_quiz_session';

    function saveSession(state) {
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

    function loadSession() {
        try {
            var raw = sessionStorage.getItem(SKEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function clearSession() {
        sessionStorage.removeItem(SKEY);
    }

    return {
        save: saveSession,
        load: loadSession,
        clear: clearSession
    };
})();
