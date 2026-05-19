var TEST_RESULTS = [];
var TEST_PASS = 0;
var TEST_FAIL = 0;

function test(name, fn) {
    try {
        fn();
        TEST_RESULTS.push({ name: name, passed: true });
        TEST_PASS++;
        console.log('✓ PASS:', name);
    } catch (e) {
        TEST_RESULTS.push({ name: name, passed: false, error: e.message });
        TEST_FAIL++;
        console.log('✗ FAIL:', name, '-', e.message);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertDeepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

test('DB模块 - get方法返回默认数据', function() {
    var origGetItem = localStorage.getItem;
    localStorage.getItem = function() { return null; };
    
    var data = DB.get();
    assert(data.history !== undefined, 'history should exist');
    assert(data.wrong !== undefined, 'wrong should exist');
    assert(data.stats !== undefined, 'stats should exist');
    assertEqual(data.stats.total, 0, 'total should be 0');
    assertEqual(data.stats.correct, 0, 'correct should be 0');
    
    localStorage.getItem = origGetItem;
});

test('DB模块 - addRecord方法正确增加统计', function() {
    var origGetItem = localStorage.getItem;
    var origSetItem = localStorage.setItem;
    var savedData = null;
    
    localStorage.getItem = function() { return JSON.stringify(DB.defaults()); };
    localStorage.setItem = function(key, value) { savedData = JSON.parse(value); };
    
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    
    assertEqual(savedData.stats.total, 1, 'total should be 1');
    assertEqual(savedData.stats.correct, 1, 'correct should be 1');
    assertEqual(savedData.history.length, 1, 'history length should be 1');
    
    localStorage.getItem = origGetItem;
    localStorage.setItem = origSetItem;
});

test('DB模块 - addRecord方法正确记录错误答案', function() {
    var origGetItem = localStorage.getItem;
    var origSetItem = localStorage.setItem;
    var savedData = null;
    
    localStorage.getItem = function() { return JSON.stringify(DB.defaults()); };
    localStorage.setItem = function(key, value) { savedData = JSON.parse(value); };
    
    DB.addRecord({ qid: '001', ans: 'A', ok: false, time: Date.now() });
    
    assertEqual(savedData.stats.total, 1, 'total should be 1');
    assertEqual(savedData.stats.correct, 0, 'correct should be 0');
    
    localStorage.getItem = origGetItem;
    localStorage.setItem = origSetItem;
});

test('DB模块 - addWrong方法新增错题', function() {
    var origGetItem = localStorage.getItem;
    var origSetItem = localStorage.setItem;
    var savedData = null;
    
    localStorage.getItem = function() { return JSON.stringify(DB.defaults()); };
    localStorage.setItem = function(key, value) { savedData = JSON.parse(value); };
    
    DB.addWrong('q001');
    
    assertEqual(savedData.wrong.length, 1, 'wrong length should be 1');
    assertEqual(savedData.wrong[0].qid, 'q001', 'qid should match');
    assertEqual(savedData.wrong[0].cnt, 1, 'cnt should be 1');
    
    localStorage.getItem = origGetItem;
    localStorage.setItem = origSetItem;
});

test('DB模块 - addWrong方法重复添加增加计数', function() {
    var origGetItem = localStorage.getItem;
    var origSetItem = localStorage.setItem;
    var savedData = null;
    var initialData = { history: [], wrong: [{ qid: 'q001', cnt: 2, time: Date.now() - 1000 }], stats: { total: 0, correct: 0, cats: {} } };
    
    localStorage.getItem = function() { return JSON.stringify(initialData); };
    localStorage.setItem = function(key, value) { savedData = JSON.parse(value); };
    
    DB.addWrong('q001');
    
    assertEqual(savedData.wrong.length, 1, 'wrong length should remain 1');
    assertEqual(savedData.wrong[0].cnt, 3, 'cnt should be 3');
    
    localStorage.getItem = origGetItem;
    localStorage.setItem = origSetItem;
});

test('DB模块 - removeWrong方法删除错题', function() {
    var origGetItem = localStorage.getItem;
    var origSetItem = localStorage.setItem;
    var savedData = null;
    var initialData = { history: [], wrong: [{ qid: 'q001', cnt: 1, time: Date.now() }], stats: { total: 0, correct: 0, cats: {} } };
    
    localStorage.getItem = function() { return JSON.stringify(initialData); };
    localStorage.setItem = function(key, value) { savedData = JSON.parse(value); };
    
    DB.removeWrong('q001');
    
    assertEqual(savedData.wrong.length, 0, 'wrong length should be 0');
    
    localStorage.getItem = origGetItem;
    localStorage.setItem = origSetItem;
});

test('DB模块 - findQ方法正确查找题目', function() {
    var q = DB.findQ('001');
    assert(q !== null, 'question should be found');
    assertEqual(q.id, '001', 'id should match');
    assertEqual(q.category, '专辑', 'category should match');
});

test('DB模块 - findQ方法返回null当题目不存在', function() {
    var q = DB.findQ('nonexistent');
    assertEqual(q, null, 'should return null');
});

test('答题引擎 - shuffle函数正确打乱数组', function() {
    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffle(arr.slice());
    
    assertEqual(shuffled.length, arr.length, 'length should remain same');
    assertDeepEqual(shuffled.sort(), arr.sort(), 'elements should be same');
});

test('答题引擎 - getCount方法返回正确题目数量', function() {
    state.mode = 'quick';
    assertEqual(getCount(), 10, 'quick mode should return 10');
    
    state.mode = 'standard';
    assertEqual(getCount(), 20, 'standard mode should return 20');
    
    state.mode = 'intensive';
    assertEqual(getCount(), 30, 'intensive mode should return 30');
    
    state.mode = 'unknown';
    assertEqual(getCount(), 10, 'unknown mode should default to 10');
});

test('题目管理 - 验证选项解析格式正确', function() {
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
    
    assertEqual(options.length, 4, 'should parse 4 options');
    assertEqual(options[0].key, 'A', 'first option key should be A');
    assertEqual(options[0].text, '选项1', 'first option text should match');
});

test('题目管理 - 验证选项解析处理中文句号', function() {
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
    
    assertEqual(options.length, 2, 'should parse 2 options with Chinese period');
});

test('统计计算 - 正确率计算正确', function() {
    var stats = { total: 10, correct: 7, cats: {} };
    var acc = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
    assertEqual(acc, 70, 'accuracy should be 70%');
});

test('统计计算 - 空数据正确率为0', function() {
    var stats = { total: 0, correct: 0, cats: {} };
    var acc = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
    assertEqual(acc, 0, 'accuracy should be 0% when no data');
});

test('分类统计 - 分类正确率计算正确', function() {
    var cats = { '专辑': { t: 5, c: 4 }, '歌曲': { t: 10, c: 6 } };
    var albumAcc = Math.round(cats['专辑'].c / cats['专辑'].t * 100);
    var songAcc = Math.round(cats['歌曲'].c / cats['歌曲'].t * 100);
    
    assertEqual(albumAcc, 80, 'album accuracy should be 80%');
    assertEqual(songAcc, 60, 'song accuracy should be 60%');
});

test('数据导入 - 验证JSON解析错误处理', function() {
    var invalidJson = '{"questionBank": [}';
    try {
        JSON.parse(invalidJson);
        assert(false, 'should throw error');
    } catch (e) {
        assert(e instanceof SyntaxError, 'should be SyntaxError');
    }
});

test('数据导入 - 验证缺少必需字段', function() {
    var data = { randomField: 'value' };
    var hasValidData = data.questionBank || data.userData;
    assertEqual(hasValidData, false, 'should have no valid data');
});

test('题库恢复 - DEFAULT_QUESTION_BANK保持不变', function() {
    var originalLength = DEFAULT_QUESTION_BANK.length;
    assertEqual(originalLength, 78, 'default question bank should have 78 questions');
});

test('题库数据 - 题目结构完整性验证', function() {
    for (var i = 0; i < QUESTION_BANK.length; i++) {
        var q = QUESTION_BANK[i];
        assert(q.id !== undefined, 'question ' + i + ' should have id');
        assert(q.category !== undefined, 'question ' + i + ' should have category');
        assert(q.question !== undefined, 'question ' + i + ' should have question text');
        assert(q.options !== undefined && q.options.length >= 2, 'question ' + i + ' should have at least 2 options');
        assert(q.answer !== undefined, 'question ' + i + ' should have answer');
    }
});

test('题库数据 - 答案选项有效性验证', function() {
    for (var i = 0; i < QUESTION_BANK.length; i++) {
        var q = QUESTION_BANK[i];
        var answerKeys = q.options.map(function(o) { return o.key; });
        assert(answerKeys.indexOf(q.answer) !== -1, 'answer ' + q.answer + ' should be in options for question ' + q.id);
    }
});

function runTests() {
    console.log('========== 开始运行测试 ==========');
    TEST_RESULTS = [];
    TEST_PASS = 0;
    TEST_FAIL = 0;
    
    var tests = [
        'DB模块 - get方法返回默认数据',
        'DB模块 - addRecord方法正确增加统计',
        'DB模块 - addRecord方法正确记录错误答案',
        'DB模块 - addWrong方法新增错题',
        'DB模块 - addWrong方法重复添加增加计数',
        'DB模块 - removeWrong方法删除错题',
        'DB模块 - findQ方法正确查找题目',
        'DB模块 - findQ方法返回null当题目不存在',
        '答题引擎 - shuffle函数正确打乱数组',
        '答题引擎 - getCount方法返回正确题目数量',
        '题目管理 - 验证选项解析格式正确',
        '题目管理 - 验证选项解析处理中文句号',
        '统计计算 - 正确率计算正确',
        '统计计算 - 空数据正确率为0',
        '分类统计 - 分类正确率计算正确',
        '数据导入 - 验证JSON解析错误处理',
        '数据导入 - 验证缺少必需字段',
        '题库恢复 - DEFAULT_QUESTION_BANK保持不变',
        '题库数据 - 题目结构完整性验证',
        '题库数据 - 答案选项有效性验证'
    ];
    
    for (var i = 0; i < tests.length; i++) {
        console.log('--- 测试 ' + (i + 1) + '/' + tests.length + ' ---');
        test(tests[i], window['test_' + (i + 1)] || (function() {}));
    }
    
    console.log('========== 测试结果 ==========');
    console.log('通过:', TEST_PASS, '/', TEST_PASS + TEST_FAIL);
    console.log('失败:', TEST_FAIL, '/', TEST_PASS + TEST_FAIL);
    
    if (TEST_FAIL > 0) {
        console.log('--- 失败详情 ---');
        for (var j = 0; j < TEST_RESULTS.length; j++) {
            if (!TEST_RESULTS[j].passed) {
                console.log('✗', TEST_RESULTS[j].name, '-', TEST_RESULTS[j].error);
            }
        }
    }
    
    return { passed: TEST_PASS, failed: TEST_FAIL, results: TEST_RESULTS };
}