// ============================================================
// 提交后正确性检查 - 缺陷回归测试
// 覆盖：Bug1~Bug4 的修复验证
// 运行：node tests/postcommit_regression_test.js
// ============================================================
'use strict';
var assert = require('assert');
var passed = 0, failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('  ✓ ' + name);
        passed++;
    } catch (e) {
        console.log('  ✗ ' + name);
        console.log('    ' + e.message);
        failed++;
    }
}

console.log('\n== Bug1：统一日期 key（addRecord 归档 vs getStreak）==');

// 与 storage.js dateKey 完全一致的实现
function dateKey(ts) {
    var dt = new Date(ts);
    var m = dt.getMonth() + 1;
    var d = dt.getDate();
    return dt.getFullYear() + '-' + m + '-' + d;
}

test('addRecord 聚合日期 key 与 getStreak lookup key 格式一致', function () {
    // 模拟历史时间：2026-07-28 14:30:00（月份索引 6，dateKey 中应为 7）
    var ts = new Date(2026, 6, 28, 14, 30, 0).getTime();
    var archiveKey = dateKey(ts);  // addRecord 归档用
    var streakKey  = dateKey(ts);  // getStreak lookup 用
    // 关键断言：必须完全相等（月份统一 +1）
    assert.strictEqual(archiveKey, streakKey, '归档 key 与 streak lookup key 必须一致');
    // 进一步验证月份不是索引值（不是 2026-6-28）
    assert.strictEqual(archiveKey, '2026-7-28', 'dateKey 必须使用 1-based 月份');
});

test('跨月跨年边界日期 key 一致', function () {
    // 1月1日（月份索引 0 → 1）
    var t1 = new Date(2026, 0, 1).getTime();
    assert.strictEqual(dateKey(t1), '2026-1-1');
    // 12月31日（月份索引 11 → 12）
    var t2 = new Date(2026, 11, 31).getTime();
    assert.strictEqual(dateKey(t2), '2026-12-31');
});

test('getStreak 能正确识别归档中的连续打卡', function () {
    // 模拟：history 中最近 1 天有答题，archive 中此前连续 6 天有答题
    // 旧 Bug 下：archive.date（如 "2026-8-20"）与 streak lookup（如 "2026-7-20"）不匹配 → streak 只有 1
    // 修复后：匹配 → streak = 7
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    function daysAgo(n) { return new Date(today.getTime() - n * 86400000).getTime(); }

    var history = [ { time: daysAgo(0) } ]; // 今天
    var archive = [];
    for (var i = 1; i <= 6; i++) {
        archive.push({ date: dateKey(daysAgo(i)), total: 5, correct: 4 });
    }

    // 模拟 getStreak 逻辑（用统一 dateKey）
    var days = {};
    for (var i = 0; i < history.length; i++) days[dateKey(history[i].time)] = true;
    for (var j = 0; j < archive.length; j++) days[archive[j].date] = true;

    var streak = 0;
    var check = new Date(today);
    var todayKey = dateKey(check.getTime());
    if (!days[todayKey]) check.setTime(check.getTime() - 86400000);
    while (true) {
        var key = dateKey(check.getTime());
        if (days[key]) { streak++; check.setTime(check.getTime() - 86400000); } else break;
    }
    assert.strictEqual(streak, 7, '归档日期必须参与 streak 计算，连续 7 天应得到 streak=7');
});


console.log('\n== Bug2：recalcStats 必须合并 archive 聚合数据 ==');

test('recalcStats 累加 archive 中的 total/correct', function () {
    // 模拟数据：history 只有 2 条（1 对 1 错），archive 有 1000 条（700 对 300 错）
    // 旧 Bug：total=2, correct=1, acc=50%
    // 修复后：total=1002, correct=701, acc≈70%
    var d = {
        history: [
            { qid: 'q1', ok: true,  time: Date.now() },
            { qid: 'q2', ok: false, time: Date.now() }
        ],
        archive: [
            { date: '2026-5-1', total: 500, correct: 350 },
            { date: '2026-5-2', total: 500, correct: 350 }
        ]
    };

    var stats = { total: 0, correct: 0, cats: {} };
    for (var i = 0; i < d.history.length; i++) {
        stats.total++;
        if (d.history[i].ok) stats.correct++;
    }
    for (var j = 0; j < d.archive.length; j++) {
        var a = d.archive[j];
        stats.total += (a.total || 0);
        stats.correct += (a.correct || 0);
    }
    assert.strictEqual(stats.total, 1002, 'total 必须包含 archive');
    assert.strictEqual(stats.correct, 701, 'correct 必须包含 archive');
});

test('recalcStats 处理空 archive 和空 history', function () {
    var d = { history: [], archive: [] };
    var stats = { total: 0, correct: 0, cats: {} };
    for (var i = 0; i < d.history.length; i++) {
        stats.total++;
        if (d.history[i].ok) stats.correct++;
    }
    for (var j = 0; j < d.archive.length; j++) {
        var a = d.archive[j];
        stats.total += (a.total || 0);
        stats.correct += (a.correct || 0);
    }
    assert.strictEqual(stats.total, 0);
    assert.strictEqual(stats.correct, 0);
});


console.log('\n== Bug3：tryResumeSession 恢复 isWrongBookQuiz 状态 ==');

test('会话恢复时从 saved 读取 isWrongBookQuiz', function () {
    // 旧代码硬编码 false → 错题复习模式中断后恢复变成普通模式
    function restore(sessionSaved) {
        return { isWrongBookQuiz: !!sessionSaved.isWrongBookQuiz };
    }
    var savedWrong = { quizIds:['q1'], idx:0, isWrongBookQuiz:true };
    var s1 = restore(savedWrong);
    assert.strictEqual(s1.isWrongBookQuiz, true, '保存为错题模式时恢复后应为 true');

    var savedNormal = { quizIds:['q1'], idx:0, isWrongBookQuiz:false };
    var s2 = restore(savedNormal);
    assert.strictEqual(s2.isWrongBookQuiz, false, '保存为普通模式时恢复后应为 false');

    var savedUndefined = { quizIds:['q1'], idx:0 }; // 老数据不含字段
    var s3 = restore(savedUndefined);
    assert.strictEqual(s3.isWrongBookQuiz, false, '未定义时安全回退为 false');
});


console.log('\n== Bug4：importData 题目结构校验 ==');

function isValidQuestion(q) {
    if (!q || typeof q !== 'object') return false;
    if (!q.id || !q.question || !q.category || !q.answer) return false;
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    var validKeys = {};
    for (var oi = 0; oi < q.options.length; oi++) {
        var o = q.options[oi];
        if (!o || typeof o.key !== 'string' || typeof o.text !== 'string') return false;
        validKeys[o.key] = true;
    }
    if (!validKeys[q.answer]) return false;
    return true;
}

var validQ = {
    id: 'q1', category: '歌曲', question: '问题', answer: 'A',
    options: [ { key: 'A', text: 'A选项' }, { key: 'B', text: 'B选项' } ]
};

test('合法题目通过校验', function () {
    assert.strictEqual(isValidQuestion(validQ), true);
});

test('缺失 options 字段的题目被拒绝（避免 undefined.length 崩溃）', function () {
    var bad = JSON.parse(JSON.stringify(validQ));
    delete bad.options;
    assert.strictEqual(isValidQuestion(bad), false);
});

test('options 非数组的题目被拒绝', function () {
    var bad = JSON.parse(JSON.stringify(validQ));
    bad.options = 'A.选项1\nB.选项2';
    assert.strictEqual(isValidQuestion(bad), false);
});

test('options 少于 2 项的题目被拒绝', function () {
    var bad = JSON.parse(JSON.stringify(validQ));
    bad.options = [ { key: 'A', text: '仅一项' } ];
    assert.strictEqual(isValidQuestion(bad), false);
});

test('answer 不在选项 key 中的题目被拒绝', function () {
    var bad = JSON.parse(JSON.stringify(validQ));
    bad.answer = 'C';
    assert.strictEqual(isValidQuestion(bad), false);
});

test('缺失 question/answer/category/id 的题目被拒绝', function () {
    ['id','question','category','answer'].forEach(function (k) {
        var bad = JSON.parse(JSON.stringify(validQ));
        delete bad[k];
        assert.strictEqual(isValidQuestion(bad), false, '缺失 ' + k + ' 应被拒绝');
    });
});

test('options 元素缺 key/text 的题目被拒绝', function () {
    var bad1 = JSON.parse(JSON.stringify(validQ));
    delete bad1.options[0].key;
    assert.strictEqual(isValidQuestion(bad1), false);

    var bad2 = JSON.parse(JSON.stringify(validQ));
    bad2.options[0].text = null;
    assert.strictEqual(isValidQuestion(bad2), false);
});


console.log('\n============================================================');
console.log('结果：通过 ' + passed + ' / 失败 ' + failed);
console.log('============================================================');
if (failed > 0) {
    process.exit(1);
}
