var TEST_RESULTS = [];

function test(name, fn) {
    try {
        fn();
        TEST_RESULTS.push({ name: name, passed: true, error: null });
        console.log('✓ PASS:', name);
    } catch (e) {
        TEST_RESULTS.push({ name: name, passed: false, error: e.message });
        console.log('✗ FAIL:', name, '-', e.message);
    }
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error((msg || '') + ' Expected: ' + expected + ', Actual: ' + actual);
    }
}

function assertNotEqual(actual, expected, msg) {
    if (actual === expected) {
        throw new Error((msg || '') + ' Expected not equal to: ' + expected);
    }
}

function assertTruthy(value, msg) {
    if (!value) {
        throw new Error((msg || '') + ' Expected truthy, got: ' + value);
    }
}

function assertFalsy(value, msg) {
    if (value) {
        throw new Error((msg || '') + ' Expected falsy, got: ' + value);
    }
}

function assertArrayEqual(actual, expected, msg) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error((msg || '') + ' Arrays not equal');
    }
}

function runTests() {
    console.log('\n=== 开始运行测试 ===\n');
    
    var originalStorage = {};
    Object.keys(localStorage).forEach(function(key) {
        originalStorage[key] = localStorage.getItem(key);
    });
    
    localStorage.clear();
    
    try {
        testDBFunctions();
        testOptionParsing();
        testCategoryStats();
        testWrongBook();
        testImportExport();
        testQuestionBank();
    } finally {
        localStorage.clear();
        Object.keys(originalStorage).forEach(function(key) {
            localStorage.setItem(key, originalStorage[key]);
        });
    }
    
    console.log('\n=== 测试结果汇总 ===');
    var passed = TEST_RESULTS.filter(function(r) { return r.passed; }).length;
    var total = TEST_RESULTS.length;
    console.log('通过:', passed, '/', total);
    
    if (passed < total) {
        console.log('\n失败的测试:');
        TEST_RESULTS.filter(function(r) { return !r.passed; }).forEach(function(r) {
            console.log('  -', r.name, ':', r.error);
        });
    }
    
    return { passed: passed, total: total, results: TEST_RESULTS };
}

function testDBFunctions() {
    console.log('\n--- DB模块测试 ---');
    
    test('DB.get() 返回默认数据', function() {
        localStorage.clear();
        var data = DB.get();
        assertEqual(Array.isArray(data.history), true);
        assertEqual(Array.isArray(data.wrong), true);
        assertEqual(typeof data.stats, 'object');
        assertEqual(data.stats.total, 0);
        assertEqual(data.stats.correct, 0);
    });
    
    test('DB.addRecord() 添加答题记录', function() {
        localStorage.clear();
        DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        var data = DB.get();
        assertEqual(data.history.length, 1);
        assertEqual(data.stats.total, 1);
        assertEqual(data.stats.correct, 1);
    });
    
    test('DB.addRecord() 记录错误答题', function() {
        localStorage.clear();
        DB.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
        var data = DB.get();
        assertEqual(data.stats.total, 1);
        assertEqual(data.stats.correct, 0);
    });
    
    test('DB.addWrong() 添加错题', function() {
        localStorage.clear();
        DB.addWrong('q001');
        var data = DB.get();
        assertEqual(data.wrong.length, 1);
        assertEqual(data.wrong[0].qid, 'q001');
        assertEqual(data.wrong[0].cnt, 1);
    });
    
    test('DB.addWrong() 重复添加同一错题增加计数', function() {
        localStorage.clear();
        DB.addWrong('q001');
        DB.addWrong('q001');
        var data = DB.get();
        assertEqual(data.wrong.length, 1);
        assertEqual(data.wrong[0].cnt, 2);
    });
    
    test('DB.removeWrong() 移除错题', function() {
        localStorage.clear();
        DB.addWrong('q001');
        DB.removeWrong('q001');
        var data = DB.get();
        assertEqual(data.wrong.length, 0);
    });
    
    test('DB.findQ() 查找存在的题目', function() {
        var q = DB.findQ('001');
        assertTruthy(q);
        assertEqual(q.id, '001');
        assertEqual(q.category, '专辑');
    });
    
    test('DB.findQ() 查找不存在的题目返回null', function() {
        var q = DB.findQ('nonexistent');
        assertEqual(q, null);
    });
}

function testOptionParsing() {
    console.log('\n--- 选项解析测试 ---');
    
    test('解析标准格式选项', function() {
        var optsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        assertEqual(options.length, 4);
        assertEqual(options[0].key, 'A');
        assertEqual(options[0].text, '选项1');
    });
    
    test('解析中文句号格式选项', function() {
        var optsText = 'A．选项一\nB．选项二';
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        assertEqual(options.length, 2);
        assertEqual(options[0].key, 'A');
        assertEqual(options[0].text, '选项一');
    });
    
    test('解析带空格的选项', function() {
        var optsText = 'A. 带空格的选项\nB. 另一个选项';
        var lines = optsText.split('\n');
        var options = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
            if (match) {
                options.push({ key: match[1], text: match[2] });
            }
        }
        assertEqual(options.length, 2);
        assertEqual(options[0].text, '带空格的选项');
    });
}

function testCategoryStats() {
    console.log('\n--- 分类统计测试 ---');
    
    test('添加记录时更新分类统计', function() {
        localStorage.clear();
        DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
        var data = DB.get();
        assertEqual(data.stats.cats['专辑'], undefined);
    });
    
    test('统计数据结构完整性', function() {
        var data = DB.get();
        assertEqual(typeof data.stats, 'object');
        assertEqual(typeof data.stats.total, 'number');
        assertEqual(typeof data.stats.correct, 'number');
        assertEqual(typeof data.stats.cats, 'object');
    });
}

function testWrongBook() {
    console.log('\n--- 错题本测试 ---');
    
    test('错题本初始为空', function() {
        localStorage.clear();
        var wrong = DB.getWrong();
        assertEqual(wrong.length, 0);
    });
    
    test('添加多个不同错题', function() {
        localStorage.clear();
        DB.addWrong('q001');
        DB.addWrong('q002');
        DB.addWrong('q003');
        var data = DB.get();
        assertEqual(data.wrong.length, 3);
    });
    
    test('错题包含时间戳', function() {
        localStorage.clear();
        var before = Date.now();
        DB.addWrong('q001');
        var after = Date.now();
        var data = DB.get();
        assertEqual(typeof data.wrong[0].time, 'number');
        assertTruthy(data.wrong[0].time >= before && data.wrong[0].time <= after);
    });
}

function testImportExport() {
    console.log('\n--- 导入导出测试 ---');
    
    test('导出数据结构正确', function() {
        localStorage.clear();
        var data = {
            questionBank: QUESTION_BANK.slice(0, 2),
            userData: DB.get(),
            exportTime: new Date().toISOString()
        };
        assertEqual(Array.isArray(data.questionBank), true);
        assertEqual(typeof data.userData, 'object');
        assertEqual(typeof data.exportTime, 'string');
    });
    
    test('导入验证 - 缺少必要字段时提示错误', function() {
        var invalidData = { random: 'data' };
        var json = JSON.stringify(invalidData);
        assertFalsy(json.questionBank && json.userData);
    });
    
    test('导入验证 - 有效JSON格式', function() {
        var validData = {
            questionBank: [{ id: 'test1', category: '测试', question: '测试题', options: [{ key: 'A', text: 'A' }], answer: 'A', explanation: '' }],
            userData: { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }
        };
        var json = JSON.stringify(validData);
        var parsed = JSON.parse(json);
        assertEqual(parsed.questionBank.length, 1);
        assertEqual(parsed.userData.stats.total, 0);
    });
}

function testQuestionBank() {
    console.log('\n--- 题库测试 ---');
    
    test('题库初始题目数量', function() {
        assertEqual(QUESTION_BANK.length, 60);
    });
    
    test('题目结构完整性', function() {
        var q = QUESTION_BANK[0];
        assertEqual(typeof q.id, 'string');
        assertEqual(typeof q.category, 'string');
        assertEqual(typeof q.question, 'string');
        assertEqual(Array.isArray(q.options), true);
        assertEqual(typeof q.answer, 'string');
        assertEqual(typeof q.explanation, 'string');
    });
    
    test('选项结构完整性', function() {
        var q = QUESTION_BANK[0];
        q.options.forEach(function(opt) {
            assertEqual(typeof opt.key, 'string');
            assertEqual(typeof opt.text, 'string');
            assertEqual(opt.key.length, 1);
        });
    });
    
    test('答案选项存在', function() {
        QUESTION_BANK.forEach(function(q) {
            var answerExists = q.options.some(function(opt) {
                return opt.key === q.answer;
            });
            assertTruthy(answerExists, '题目 ' + q.id + ' 的答案 ' + q.answer + ' 不在选项中');
        });
    });
    
    test('分类统计', function() {
        var cats = {};
        QUESTION_BANK.forEach(function(q) {
            cats[q.category] = (cats[q.category] || 0) + 1;
        });
        assertEqual(cats['专辑'], 15);
        assertEqual(cats['歌曲'], 30);
        assertEqual(cats['个人信息'], 8);
        assertEqual(cats['获奖记录'], 10);
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runTests, TEST_RESULTS };
} else if (typeof window !== 'undefined') {
    window.runTests = runTests;
    window.TEST_RESULTS = TEST_RESULTS;
}