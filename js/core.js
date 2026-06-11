/**
 * 林俊杰粉丝答题 - 核心逻辑模块
 * 
 * 设计原则：
 *  - 所有函数均为纯函数或依赖可注入的 store（便于在 Node 环境测试）
 *  - 无 DOM / 浏览器 API 依赖（除非显式传入）
 *  - 保持与 index.html 中同名函数的语义完全一致（回归测试基线）
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.QuizCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    'use strict';

    /* ============================================================
     *  1. 题目数量映射（模式 → 数量）
     * ============================================================ */
    var MODE_COUNT = { quick: 10, standard: 20, intensive: 30 };

    function getCount(mode) {
        return MODE_COUNT[mode] || 10;
    }

    /* ============================================================
     *  2. Fisher-Yates 洗牌算法
     *  不修改原数组，返回新数组。测试关键点：
     *    - 保持元素集合不变（只是重排）
     *    - 空数组 / 单元素数组的边界
     *    - 通过注入随机数产生器实现确定性测试
     * ============================================================ */
    function shuffle(arr, rng) {
        var random = rng || Math.random;
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(random() * (i + 1));
            var t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    }

    /* ============================================================
     *  3. 时间格式化
     * ============================================================ */
    function fmtTime(ms) {
        var sec = Math.floor(ms / 1000);
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return m + '分' + s + '秒';
    }

    /* ============================================================
     *  4. 选项文本解析（对应 saveQuestion 中的正则解析逻辑）
     *  输入形如："A.选项1\nB.选项2\nC.选项3\nD.选项4"
     *  也支持 "、" "．" 作为分隔符
     * ============================================================ */
    function parseOptions(optsText) {
        if (!optsText) return [];
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = (lines[i] || '').trim();
            if (!line) continue;
            var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        return options;
    }

    /* ============================================================
     *  5. DB 存储模块
     *     构造时注入底层 KV store（浏览器中为 localStorage，
     *     测试中为内存对象）。
     * ============================================================ */
    var DB_KEY = 'jj_quiz_v2';
    var QB_KEY = 'jj_question_bank';

    function createDB(store, questionBankRef) {
        var db = {
            KEY: DB_KEY,

            defaults: function () {
                return { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } };
            },

            get: function () {
                var raw = store.getItem(DB_KEY);
                if (raw) {
                    try {
                        var parsed = JSON.parse(raw);
                        if (!parsed.stats) parsed.stats = { total: 0, correct: 0, cats: {} };
                        if (!parsed.history) parsed.history = [];
                        if (!parsed.wrong) parsed.wrong = [];
                        if (!parsed.stats.cats) parsed.stats.cats = {};
                        return parsed;
                    } catch (e) {
                        // 损坏数据 → 退回默认值
                    }
                }
                var d = db.defaults();
                store.setItem(DB_KEY, JSON.stringify(d));
                return d;
            },

            save: function (data) {
                store.setItem(DB_KEY, JSON.stringify(data));
            },

            addRecord: function (rec) {
                var d = db.get();
                d.history.push(rec);
                d.stats.total += 1;
                if (rec.ok) d.stats.correct += 1;
                var q = db.findQ(rec.qid);
                if (q) {
                    if (!d.stats.cats[q.category]) d.stats.cats[q.category] = { t: 0, c: 0 };
                    d.stats.cats[q.category].t += 1;
                    if (rec.ok) d.stats.cats[q.category].c += 1;
                }
                db.save(d);
            },

            addWrong: function (qid) {
                var d = db.get();
                var found = null;
                for (var i = 0; i < d.wrong.length; i++) {
                    if (d.wrong[i].qid === qid) { found = d.wrong[i]; break; }
                }
                if (found) {
                    found.cnt += 1;
                    found.time = Date.now();
                } else {
                    d.wrong.push({ qid: qid, cnt: 1, time: Date.now() });
                }
                db.save(d);
            },

            removeWrong: function (qid) {
                var d = db.get();
                d.wrong = d.wrong.filter(function (w) { return w.qid !== qid; });
                db.save(d);
            },

            getWrong: function () {
                return db.get().wrong;
            },

            findQ: function (qid) {
                var qb = questionBankRef.getBank();
                for (var i = 0; i < qb.length; i++) {
                    if (qb[i].id === qid) return qb[i];
                }
                return null;
            },

            /* ---------- 题库持久化 ---------- */
            saveQuestionBank: function (bank) {
                store.setItem(QB_KEY, JSON.stringify(bank));
            },

            loadQuestionBank: function (defaultBank) {
                var saved = store.getItem(QB_KEY);
                if (saved) {
                    try { return JSON.parse(saved); } catch (e) {}
                }
                return defaultBank ? defaultBank.slice() : [];
            },

            resetQuestionBank: function (defaultBank) {
                store.removeItem(QB_KEY);
                return defaultBank ? defaultBank.slice() : [];
            }
        };
        return db;
    }

    /* ============================================================
     *  6. 统计计算
     * ============================================================ */
    function calcAccuracy(correct, total) {
        if (total <= 0) return 0;
        return Math.round(correct / total * 100);
    }

    function calcTodayRecords(history, todayStartMs) {
        var today = typeof todayStartMs === 'number'
            ? todayStartMs
            : new Date().setHours(0, 0, 0, 0);
        return (history || []).filter(function (h) { return h.time >= today; });
    }

    /* ============================================================
     *  7. 数据导入（importData 的核心纯逻辑）
     *     接收当前状态和导入数据，返回新状态。
     *     不操作 DOM / alert。
     * ============================================================ */
    function mergeImportedData(currentBank, currentUserData, imported) {
        var result = {
            bank: currentBank.slice(),
            userData: currentUserData
                ? JSON.parse(JSON.stringify(currentUserData))
                : { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } },
            addedCount: 0,
            updatedCount: 0
        };

        if (!result.userData.stats) result.userData.stats = { total: 0, correct: 0, cats: {} };
        if (!result.userData.stats.cats) result.userData.stats.cats = {};
        if (!result.userData.history) result.userData.history = [];
        if (!result.userData.wrong) result.userData.wrong = [];

        if (imported && imported.questionBank) {
            var existingIds = {};
            for (var i = 0; i < result.bank.length; i++) {
                existingIds[result.bank[i].id] = i;
            }
            for (var j = 0; j < imported.questionBank.length; j++) {
                var q = imported.questionBank[j];
                if (existingIds[q.id] !== undefined) {
                    result.bank[existingIds[q.id]] = q;
                    result.updatedCount += 1;
                } else {
                    result.bank.push(q);
                    existingIds[q.id] = result.bank.length - 1;
                    result.addedCount += 1;
                }
            }
        }

        if (imported && imported.userData) {
            var ud = imported.userData;
            if (ud.history) result.userData.history = result.userData.history.concat(ud.history);
            if (ud.wrong) {
                var wrongMap = {};
                for (var w = 0; w < result.userData.wrong.length; w++) {
                    wrongMap[result.userData.wrong[w].qid] = result.userData.wrong[w];
                }
                for (var x = 0; x < ud.wrong.length; x++) {
                    var wrongItem = ud.wrong[x];
                    if (wrongMap[wrongItem.qid]) {
                        wrongMap[wrongItem.qid].cnt += wrongItem.cnt;
                    } else {
                        result.userData.wrong.push(wrongItem);
                        wrongMap[wrongItem.qid] = wrongItem;
                    }
                }
            }
            if (ud.stats) {
                result.userData.stats.total += ud.stats.total || 0;
                result.userData.stats.correct += ud.stats.correct || 0;
                if (ud.stats.cats) {
                    for (var catName in ud.stats.cats) {
                        if (!result.userData.stats.cats[catName]) {
                            result.userData.stats.cats[catName] = { t: 0, c: 0 };
                        }
                        result.userData.stats.cats[catName].t += ud.stats.cats[catName].t || 0;
                        result.userData.stats.cats[catName].c += ud.stats.cats[catName].c || 0;
                    }
                }
            }
        }

        return result;
    }

    /* ============================================================
     *  8. 分类统计视图数据
     * ============================================================ */
    function buildCategoryStats(cats) {
        if (!cats) return [];
        var keys = Object.keys(cats);
        var rows = [];
        for (var i = 0; i < keys.length; i++) {
            var name = keys[i];
            var s = cats[name];
            var pct = s.t > 0 ? Math.round(s.c / s.t * 100) : 0;
            rows.push({ name: name, total: s.t, correct: s.c, pct: pct });
        }
        return rows;
    }

    return {
        getCount: getCount,
        shuffle: shuffle,
        fmtTime: fmtTime,
        parseOptions: parseOptions,
        createDB: createDB,
        calcAccuracy: calcAccuracy,
        calcTodayRecords: calcTodayRecords,
        mergeImportedData: mergeImportedData,
        buildCategoryStats: buildCategoryStats,
        // 暴露常量便于测试
        _DB_KEY: DB_KEY,
        _QB_KEY: QB_KEY,
        _MODE_COUNT: MODE_COUNT
    };
}));
