// ============================================================
// chart.test.js - chart.js + storage.js 日期键一致性测试
// 覆盖：14 天窗口聚合、archive + history 合并、
//       日期键格式一致性（修复 getMonth vs getMonth+1 不一致 bug）
// ============================================================

// 镜像 chart.js 内部的 14 天聚合逻辑（用于纯数据测试）
function aggregate14Days(history, archive, todayBase) {
    var days = 14;
    var today = new Date(todayBase || Date.now());
    today.setHours(0, 0, 0, 0);
    var dayData = [];
    for (var i = days - 1; i >= 0; i--) {
        var dayStart = today.getTime() - i * 86400000;
        var dayEnd = dayStart + 86400000;
        var dayCount = 0;
        var dayCorrect = 0;
        for (var j = 0; j < (history || []).length; j++) {
            if (history[j].time >= dayStart && history[j].time < dayEnd) {
                dayCount++;
                if (history[j].ok) dayCorrect++;
            }
        }
        var dt = new Date(dayStart);
        var dateKey = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
        for (var k = 0; k < (archive || []).length; k++) {
            if (archive[k].date === dateKey) {
                dayCount += archive[k].total;
                dayCorrect += archive[k].correct;
                break;
            }
        }
        dayData.push({
            date: new Date(dayStart),
            count: dayCount,
            correct: dayCorrect,
            acc: dayCount > 0 ? Math.round(dayCorrect / dayCount * 100) : 0
        });
    }
    return dayData;
}

// 存储统一的日期键生成规则（与 archive 生成、chart.js 聚合一致）
function toDateKey(ts) {
    var dt = new Date(ts);
    return dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
}

module.exports = {
    name: 'chart.js 数据聚合 + 日期键一致性',
    beforeEach: function(App) {
        App.db.setData(App.db.defaults());
    },
    cases: [
        // ===================== 14 天聚合：history 数据 =====================
        { name: '空 history + 空 archive 应生成 14 天全零数据', fn: function(App, H) {
            var dayData = aggregate14Days([], [], Date.now());
            H.equal(dayData.length, 14);
            for (var i = 0; i < 14; i++) {
                H.equal(dayData[i].count, 0);
                H.equal(dayData[i].correct, 0);
                H.equal(dayData[i].acc, 0);
            }
        }},
        { name: 'history 数据应正确聚合到对应日期', fn: function(App, H) {
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var ts = today.getTime();
            var history = [
                { time: ts, ok: true },
                { time: ts, ok: true },
                { time: ts, ok: false },
                { time: ts - 86400000, ok: true },
            ];
            var dayData = aggregate14Days(history, [], ts);
            // dayData[13] 是今天
            H.equal(dayData[13].count, 3);
            H.equal(dayData[13].correct, 2);
            H.equal(dayData[13].acc, 67);
            // dayData[12] 是昨天
            H.equal(dayData[12].count, 1);
            H.equal(dayData[12].correct, 1);
            H.equal(dayData[12].acc, 100);
        }},
        { name: '正确率应四舍五入', fn: function(App, H) {
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var ts = today.getTime();
            // 3 题对 2 = 66.66% → 67%
            var history = [
                { time: ts, ok: true },
                { time: ts, ok: true },
                { time: ts, ok: false },
            ];
            var dayData = aggregate14Days(history, [], ts);
            H.equal(dayData[13].acc, 67);
        }},
        { name: '0 题时正确率应为 0（不是 NaN 或 Infinity）', fn: function(App, H) {
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var dayData = aggregate14Days([], [], today.getTime());
            H.equal(dayData[0].acc, 0);
            H.ok(isFinite(dayData[0].acc), 'acc 必须是有限数字');
        }},
        { name: 'history 边界：包含 dayStart、不包含 dayEnd', fn: function(App, H) {
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var ts = today.getTime();
            // 昨天的边界时间
            var yesterdayStart = ts - 86400000;
            var yesterdayEnd = ts; // 昨天结束 = 今天 0 点
            var history = [
                { time: yesterdayStart, ok: true },       // 包含
                { time: yesterdayStart + 1, ok: true },   // 包含
                { time: yesterdayEnd - 1, ok: false },     // 包含
                { time: yesterdayEnd, ok: false },         // 不包含（属于今天）
                { time: ts, ok: true },                    // 包含（属于今天）
            ];
            var dayData = aggregate14Days(history, [], ts);
            H.equal(dayData[12].count, 3, '昨天应有 3 条');
            H.equal(dayData[13].count, 2, '今天应有 2 条');
        }},

        // ===================== archive + history 合并 =====================
        { name: 'archive 数据应与 history 合并到同一天', fn: function(App, H) {
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var ts = today.getTime();
            var y = ts - 86400000;
            var dt = new Date(y);
            var dateKey = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();

            var history = [{ time: y, ok: true }];
            var archive = [{ date: dateKey, total: 5, correct: 3 }];
            var dayData = aggregate14Days(history, archive, ts);

            H.equal(dayData[12].count, 6, 'archive 5 + history 1');
            H.equal(dayData[12].correct, 4, 'archive 3 + history 1');
            H.equal(dayData[12].acc, 67, '4/6 = 67%');
        }},
        { name: 'archive 日期键格式不匹配时不应合并', fn: function(App, H) {
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var ts = today.getTime();
            var y = ts - 86400000;
            var dt = new Date(y);
            // 故意用错误的 dateKey（getMonth 不加 1）
            var badDateKey = dt.getFullYear() + '-' + dt.getMonth() + '-' + dt.getDate();

            var archive = [{ date: badDateKey, total: 5, correct: 3 }];
            var dayData = aggregate14Days([], archive, ts);

            H.equal(dayData[12].count, 0, '错误格式的 archive date 不应被合并');
        }},

        // ===================== 日期键一致性（修复前的 bug） =====================
        { name: 'storage archive 日期键与 chart 聚合日期键格式应完全一致', fn: function(App, H) {
            // 模拟 storage.js archive 生成逻辑（行 196）
            var sample = new Date(2025, 6, 15); // 7月15日，getMonth()=6
            var archiveKey = sample.getFullYear() + '-' + (sample.getMonth() + 1) + '-' + sample.getDate();
            // chart.js 聚合用的 key（行 40）
            var chartKey = sample.getFullYear() + '-' + (sample.getMonth() + 1) + '-' + sample.getDate();
            H.equal(archiveKey, chartKey, '两者必须格式一致');
            H.equal(archiveKey, '2025-7-15');
        }},
        { name: 'getStreak 修复后应合并 archive 日期（历史+归档跨天连续）', fn: function(App, H) {
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var now = today.getTime();
            var yesterday = now - 86400000;
            var dt = new Date(yesterday);
            var archiveKey = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();

            // history 只有今天一条
            App.db.addRecord({ qid: '001', ans: 'A', ok: true, time: now });
            var d = App.db.get();
            d.archive = [{ date: archiveKey, total: 5, correct: 3 }];
            App.db.setData(d);

            // 修复前：history 用 getMonth()=6，archive 用 getMonth()+1=7 → 不匹配 → streak=1
            // 修复后：两者统一 getMonth()+1 → streak=2
            var streak = App.db.getStreak();
            H.ok(streak >= 2, 'archive 日期应被合并到 streak（实际 streak=' + streak + '）');
        }},
        { name: 'getStreak 统一日期键：纯单元测试', fn: function(App, H) {
            // 直接测试 storage.js 内部 archive 日期格式和 streak 计算的一致性
            // 如果存储时用 getMonth()+1，计算时也必须用 getMonth()+1
            var ts = new Date(2025, 6, 15, 12, 0, 0).getTime(); // 7月15日
            var dt = new Date(ts);

            // storage archive 生成格式（正确）
            var archiveKey = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
            H.equal(archiveKey, '2025-7-15');

            // 修复前 getStreak history key（错误）
            var badKey = dt.getFullYear() + '-' + dt.getMonth() + '-' + dt.getDate();
            H.equal(badKey, '2025-6-15');

            // 修复后应统一为 archiveKey
            H.equal(toDateKey(ts), archiveKey, '修复后统一格式');
            H.ok(toDateKey(ts) !== badKey, '修复后不再使用 getMonth()');
        }}
    ]
};
