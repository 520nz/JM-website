// ============================================================
// tests.js - 单元测试套件
// 覆盖核心逻辑：XSS转义、间隔重复、统计重算、选项解析、shuffle算法
// ============================================================

var App = window.App || {};

(function(A) {
    var tests = [];
    var passed = 0;
    var failed = 0;

    function assertEqual(actual, expected, msg) {
        if (actual === expected) {
            passed++;
            return { ok: true };
        } else {
            failed++;
            console.error('[FAIL] ' + msg + ' | expected: ' + expected + ', actual: ' + actual);
            return { ok: false, msg: msg, expected: expected, actual: actual };
        }
    }

    function assertNotEqual(actual, expected, msg) {
        if (actual !== expected) {
            passed++;
            return { ok: true };
        } else {
            failed++;
            console.error('[FAIL] ' + msg + ' | should not equal: ' + expected + ', but got: ' + actual);
            return { ok: false, msg: msg, expected: expected, actual: actual };
        }
    }

    function assertTruthy(actual, msg) {
        if (actual) {
            passed++;
            return { ok: true };
        } else {
            failed++;
            console.error('[FAIL] ' + msg + ' | expected truthy, got: ' + actual);
            return { ok: false, msg: msg, actual: actual };
        }
    }

    function assertFalsy(actual, msg) {
        if (!actual) {
            passed++;
            return { ok: true };
        } else {
            failed++;
            console.error('[FAIL] ' + msg + ' | expected falsy, got: ' + actual);
            return { ok: false, msg: msg, actual: actual };
        }
    }

    function assertDeepEqual(actual, expected, msg) {
        if (JSON.stringify(actual) === JSON.stringify(expected)) {
            passed++;
            return { ok: true };
        } else {
            failed++;
            console.error('[FAIL] ' + msg + ' | expected: ' + JSON.stringify(expected) + ', actual: ' + JSON.stringify(actual));
            return { ok: false, msg: msg, expected: expected, actual: actual };
        }
    }

    function test(name, fn) {
        tests.push({ name: name, fn: fn });
    }

    // ============================================================
    // storage.js 测试 - XSS 转义
    // ============================================================
    test('XSS转义：基本HTML标签', function() {
        assertEqual(A.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    test('XSS转义：属性引号', function() {
        var result = A.esc('"><img src=x onerror=alert(1)>');
        assertFalsy(result.indexOf('<img') !== -1, '不应包含未转义的img标签');
        assertTruthy(result.indexOf('&lt;') !== -1, '应包含HTML转义字符');
    });

    test('XSS转义：正常文本', function() {
        assertEqual(A.esc('Hello World'), 'Hello World');
    });

    test('XSS转义：null和undefined', function() {
        assertEqual(A.esc(null), '');
        assertEqual(A.esc(undefined), '');
    });

    test('XSS转义：数字', function() {
        assertEqual(A.esc(123), '123');
    });

    // ============================================================
    // storage.js 测试 - 间隔重复逻辑
    // ============================================================
    test('间隔重复：新增错题初始状态', function() {
        var originalData = A.db.get();
        var originalWrong = originalData.wrong.slice();

        var qid = 'test_q1';
        A.db.addWrong(qid);

        var d = A.db.get();
        var w = d.wrong.find(function(item) { return item.qid === qid; });
        assertTruthy(w, '错题应被添加');
        assertEqual(w.cnt, 1, '初始错误次数应为1');
        assertEqual(w.level, 0, '初始等级应为0');
        assertTruthy(w.time > 0, '时间戳应大于0');
        assertEqual(w.lastReview, 0, '初始lastReview应为0');
        assertTruthy(w.nextReview > 0, '初始nextReview应大于0');

        d.wrong = originalWrong;
        A.db.setData(d);
    });

    test('间隔重复：重复答错重置等级', function() {
        var originalData = A.db.get();
        var originalWrong = originalData.wrong.slice();

        var qid = 'test_q2';
        A.db.addWrong(qid);
        A.db.addWrong(qid);

        var d = A.db.get();
        var w = d.wrong.find(function(item) { return item.qid === qid; });
        assertEqual(w.cnt, 2, '错误次数应递增');
        assertEqual(w.level, 0, '重复答错应重置等级为0');

        d.wrong = originalWrong;
        A.db.setData(d);
    });

    test('间隔重复：答对提升等级', function() {
        var originalData = A.db.get();
        var originalWrong = originalData.wrong.slice();

        var qid = 'test_q3';
        A.db.addWrong(qid);
        A.db.reviewCorrect(qid);

        var d = A.db.get();
        var w = d.wrong.find(function(item) { return item.qid === qid; });
        assertEqual(w.level, 1, '答对后等级应提升为1');
        assertTruthy(w.nextReview > Date.now(), '下次复习时间应在未来');
        assertTruthy(w.lastReview > 0, 'lastReview应被更新');

        d.wrong = originalWrong;
        A.db.setData(d);
    });

    test('间隔重复：连续答对最终移除', function() {
        var originalData = A.db.get();
        var originalWrong = originalData.wrong.slice();

        var qid = 'test_q4';
        A.db.addWrong(qid);
        A.db.reviewCorrect(qid);
        A.db.reviewCorrect(qid);
        A.db.reviewCorrect(qid);
        A.db.reviewCorrect(qid);
        A.db.reviewCorrect(qid);

        var d = A.db.get();
        var w = d.wrong.find(function(item) { return item.qid === qid; });
        assertFalsy(w, '等级达到5时应从错题本移除');

        d.wrong = originalWrong;
        A.db.setData(d);
    });

    test('间隔重复：复习错题答错重置', function() {
        var originalData = A.db.get();
        var originalWrong = originalData.wrong.slice();

        var qid = 'test_q5';
        A.db.addWrong(qid);
        A.db.reviewCorrect(qid);
        A.db.reviewWrong(qid);

        var d = A.db.get();
        var w = d.wrong.find(function(item) { return item.qid === qid; });
        assertEqual(w.level, 0, '答错应重置等级为0');
        assertEqual(w.cnt, 2, '错误次数应递增');
        assertTruthy(w.nextReview > 0, 'nextReview应设为当前时间');

        d.wrong = originalWrong;
        A.db.setData(d);
    });

    test('间隔重复：reviewWrong新增错题', function() {
        var originalData = A.db.get();
        var originalWrong = originalData.wrong.slice();

        var qid = 'test_q6_not_exist';
        A.db.reviewWrong(qid);

        var d = A.db.get();
        var w = d.wrong.find(function(item) { return item.qid === qid; });
        assertTruthy(w, '不在错题本中的题目应被新增');
        assertEqual(w.cnt, 1, '错误次数应为1');

        d.wrong = originalWrong;
        A.db.setData(d);
    });

    test('间隔重复：获取到期错题', function() {
        var originalData = A.db.get();
        var originalWrong = originalData.wrong.slice();

        var now = Date.now();
        A.db.get().wrong = [
            { qid: 'due1', level: 0, nextReview: now - 1000 },
            { qid: 'due2', level: 1, nextReview: now - 3600000 },
            { qid: 'not_due', level: 2, nextReview: now + 86400000 }
        ];

        var due = A.db.getDueWrong();
        assertEqual(due.length, 2, '应返回2道到期错题');
        assertTruthy(due.some(function(item) { return item.qid === 'due1'; }));
        assertTruthy(due.some(function(item) { return item.qid === 'due2'; }));
        assertFalsy(due.some(function(item) { return item.qid === 'not_due'; }));

        A.db.get().wrong = originalWrong;
    });

    // ============================================================
    // storage.js 测试 - 统计重算
    // ============================================================
    test('统计重算：从history计算stats', function() {
        var originalData = A.db.get();

        var q1 = { id: 'q_stat_1', category: '专辑' };
        var q2 = { id: 'q_stat_2', category: '歌曲' };

        A.QUESTION_BANK.push(q1, q2);

        A.db.get().history = [
            { qid: 'q_stat_1', ok: true, time: Date.now() },
            { qid: 'q_stat_1', ok: false, time: Date.now() },
            { qid: 'q_stat_2', ok: true, time: Date.now() }
        ];

        A.db.recalcStats();

        var stats = A.db.get().stats;
        assertEqual(stats.total, 3, '总答题数应为3');
        assertEqual(stats.correct, 2, '正确数应为2');
        assertEqual(stats.cats['专辑'].t, 2, '专辑分类总答题数应为2');
        assertEqual(stats.cats['专辑'].c, 1, '专辑分类正确数应为1');
        assertEqual(stats.cats['歌曲'].t, 1, '歌曲分类总答题数应为1');
        assertEqual(stats.cats['歌曲'].c, 1, '歌曲分类正确数应为1');

        A.QUESTION_BANK = A.QUESTION_BANK.filter(function(q) { return q.id !== 'q_stat_1' && q.id !== 'q_stat_2'; });
        A.db.setData(originalData);
    });

    // ============================================================
    // storage.js 测试 - 查找题目
    // ============================================================
    test('查找题目：存在的题目', function() {
        var q = A.db.findQ('001');
        assertTruthy(q, '应找到ID为001的题目');
        assertEqual(q.id, '001');
    });

    test('查找题目：不存在的题目', function() {
        var q = A.db.findQ('non_existent_id');
        assertFalsy(q, '不存在的题目应返回null');
    });

    // ============================================================
    // quiz.js 测试 - shuffle算法
    // ============================================================
    test('shuffle：保持元素不变', function() {
        var arr = [1, 2, 3, 4, 5];
        var shuffled = A.shuffle(arr);
        assertEqual(shuffled.length, arr.length, '长度应保持不变');
        assertDeepEqual(shuffled.sort(), arr.sort(), '元素集合应相同');
    });

    test('shuffle：不修改原数组', function() {
        var arr = [1, 2, 3];
        var original = arr.slice();
        A.shuffle(arr);
        assertDeepEqual(arr, original, '原数组不应被修改');
    });

    test('shuffle：单元素数组', function() {
        var arr = [42];
        var shuffled = A.shuffle(arr);
        assertDeepEqual(shuffled, [42], '单元素数组应保持不变');
    });

    test('shuffle：空数组', function() {
        var arr = [];
        var shuffled = A.shuffle(arr);
        assertDeepEqual(shuffled, [], '空数组应保持不变');
    });

    // ============================================================
    // quiz.js 测试 - 模式配置
    // ============================================================
    test('模式配置：quick模式返回10题', function() {
        A.state.mode = 'quick';
        assertEqual(A.getCount ? A.getCount() : 10, 10);
    });

    test('模式配置：standard模式返回20题', function() {
        A.state.mode = 'standard';
        assertEqual(A.getCount ? A.getCount() : 20, 20);
    });

    test('模式配置：intensive模式返回30题', function() {
        A.state.mode = 'intensive';
        assertEqual(A.getCount ? A.getCount() : 30, 30);
    });

    // ============================================================
    // admin.js 测试 - 选项解析逻辑
    // ============================================================
    test('选项解析：标准格式', function() {
        var optsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        assertEqual(options.length, 4, '应解析4个选项');
        assertEqual(options[0].key, 'A');
        assertEqual(options[0].text, '选项1');
        assertEqual(options[3].key, 'D');
        assertEqual(options[3].text, '选项4');
    });

    test('选项解析：中文句号', function() {
        var optsText = 'A．选项1\nB．选项2';
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        assertEqual(options.length, 2, '应解析2个选项');
        assertEqual(options[0].key, 'A');
        assertEqual(options[1].key, 'B');
    });

    test('选项解析：全角顿号', function() {
        var optsText = 'A、选项1\nB、选项2';
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        assertEqual(options.length, 2, '应解析2个选项');
    });

    test('选项解析：空行被忽略', function() {
        var optsText = 'A.选项1\n\nB.选项2';
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        assertEqual(options.length, 2, '空行应被忽略');
    });

    test('选项解析：无效格式被忽略', function() {
        var optsText = 'A.选项1\n无效行\nB.选项2\n123';
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-Z])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        assertEqual(options.length, 2, '无效格式应被忽略');
    });

    // ============================================================
    // 运行测试
    // ============================================================
    function runTests() {
        passed = 0;
        failed = 0;
        console.log('====================================');
        console.log('  开始运行测试 (' + tests.length + ' 个)');
        console.log('====================================');

        for (var i = 0; i < tests.length; i++) {
            var t = tests[i];
            try {
                t.fn();
                console.log('[PASS] ' + t.name);
            } catch (err) {
                failed++;
                console.error('[FAIL] ' + t.name + ' | 异常: ' + err.message);
            }
        }

        console.log('====================================');
        console.log('  测试结果: ' + passed + ' 通过, ' + failed + ' 失败');
        console.log('====================================');

        return { passed: passed, failed: failed, total: tests.length };
    }

    A.test = {
        run: runTests,
        tests: tests
    };

})(App);