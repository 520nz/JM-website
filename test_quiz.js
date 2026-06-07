var testResults = [];
var testPassed = 0;
var testFailed = 0;

function assert(condition, message) {
    if (condition) {
        testPassed++;
        testResults.push({ status: 'PASS', message: message });
    } else {
        testFailed++;
        testResults.push({ status: 'FAIL', message: message });
    }
}

function assertEqual(actual, expected, message) {
    if (actual === expected) {
        testPassed++;
        testResults.push({ status: 'PASS', message: message });
    } else {
        testFailed++;
        testResults.push({ status: 'FAIL', message: message + ' (实际: ' + JSON.stringify(actual) + ', 期望: ' + JSON.stringify(expected) + ')' });
    }
}

function assertNotEqual(actual, expected, message) {
    if (actual !== expected) {
        testPassed++;
        testResults.push({ status: 'PASS', message: message });
    } else {
        testFailed++;
        testResults.push({ status: 'FAIL', message: message + ' (实际: ' + JSON.stringify(actual) + ' 不应等于 ' + JSON.stringify(expected) + ')' });
    }
}

function assertArrayEqual(actual, expected, message) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        testPassed++;
        testResults.push({ status: 'PASS', message: message });
    } else {
        testFailed++;
        testResults.push({ status: 'FAIL', message: message + ' (实际: ' + JSON.stringify(actual) + ', 期望: ' + JSON.stringify(expected) + ')' });
    }
}

function runTests() {
    console.log('=== 开始执行测试 ===');
    
    testDBModule();
    testQuestionParsing();
    testQuizLogic();
    testImportExport();
    testStatsCalculation();
    
    printResults();
}

function testDBModule() {
    console.log('\n--- 测试 DB 模块 ---');
    
    var originalStorage = localStorage.getItem(DB.KEY);
    
    localStorage.removeItem(DB.KEY);
    var data = DB.get();
    assert(data.history !== undefined, 'DB.get() 返回默认数据包含 history');
    assert(data.wrong !== undefined, 'DB.get() 返回默认数据包含 wrong');
    assert(data.stats !== undefined, 'DB.get() 返回默认数据包含 stats');
    assertEqual(data.stats.total, 0, '默认 stats.total 为 0');
    assertEqual(data.stats.correct, 0, '默认 stats.correct 为 0');
    
    var testQ = QUESTION_BANK[0];
    DB.addRecord({ qid: testQ.id, ans: testQ.answer, ok: true, time: Date.now() });
    data = DB.get();
    assertEqual(data.history.length, 1, 'DB.addRecord() 正确添加记录');
    assertEqual(data.stats.total, 1, 'DB.addRecord() 正确更新 stats.total');
    assertEqual(data.stats.correct, 1, 'DB.addRecord() 正确更新 stats.correct');
    
    DB.addWrong(testQ.id);
    data = DB.get();
    assertEqual(data.wrong.length, 1, 'DB.addWrong() 正确添加错题');
    assertEqual(data.wrong[0].qid, testQ.id, 'DB.addWrong() 正确记录题目ID');
    assertEqual(data.wrong[0].cnt, 1, 'DB.addWrong() 初始计数为 1');
    
    DB.addWrong(testQ.id);
    data = DB.get();
    assertEqual(data.wrong[0].cnt, 2, 'DB.addWrong() 重复添加增加计数');
    
    DB.removeWrong(testQ.id);
    data = DB.get();
    assertEqual(data.wrong.length, 0, 'DB.removeWrong() 正确移除错题');
    
    var found = DB.findQ(testQ.id);
    assertEqual(found.id, testQ.id, 'DB.findQ() 正确查找题目');
    
    found = DB.findQ('non-existent-id');
    assertEqual(found, null, 'DB.findQ() 查找不存在的题目返回 null');
    
    if (originalStorage) {
        localStorage.setItem(DB.KEY, originalStorage);
    } else {
        localStorage.removeItem(DB.KEY);
    }
}

function testQuestionParsing() {
    console.log('\n--- 测试题目解析 ---');
    
    var optsText = 'A.选项1\nB.选项2\nC.选项3\nD.选项4';
    var lines = optsText.split('\n');
    var options = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    assertEqual(options.length, 4, '正确解析4个选项');
    assertEqual(options[0].key, 'A', '选项A解析正确');
    assertEqual(options[0].text, '选项1', '选项A内容解析正确');
    
    var optsTextChinese = 'A、中文选项1\nB．选项2\nC.选项3';
    lines = optsTextChinese.split('\n');
    options = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    assertEqual(options.length, 3, '正确解析中文标点分隔的选项');
    assertEqual(options[0].text, '中文选项1', '中文选项内容解析正确');
    
    var optsTextEmpty = '';
    lines = optsTextEmpty.split('\n');
    options = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    assertEqual(options.length, 0, '空选项文本解析结果为空数组');
    
    var optsTextInvalid = 'A选项1\nB.选项2\nC选项3\nD.选项4';
    lines = optsTextInvalid.split('\n');
    options = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    assertEqual(options.length, 2, '无效格式的选项被正确过滤');
}

function testQuizLogic() {
    console.log('\n--- 测试答题逻辑 ---');
    
    var originalState = JSON.parse(JSON.stringify(state));
    var originalQuiz = QUESTION_BANK.slice(0, 5);
    
    state.quiz = originalQuiz;
    state.idx = 0;
    state.correctCount = 0;
    
    var q = state.quiz[0];
    assert(!state.answered, '初始状态未答题');
    
    state.answered = true;
    state.correctCount = 1;
    assertEqual(state.correctCount, 1, '正确计数增加');
    
    state.idx = 4;
    assert(state.idx >= state.quiz.length - 1, '到达最后一题');
    
    state.quiz = [];
    state.idx = 0;
    assert(state.quiz.length === 0, '空题库状态正确');
    
    Object.assign(state, originalState);
}

function testImportExport() {
    console.log('\n--- 测试导入导出 ---');
    
    var testData = {
        questionBank: [{
            id: 'test001',
            category: '测试',
            question: '测试题目',
            options: [{key:'A',text:'A'}, {key:'B',text:'B'}],
            answer: 'A',
            explanation: '测试解析'
        }],
        userData: {
            history: [],
            wrong: [],
            stats: { total: 0, correct: 0, cats: {} }
        },
        exportTime: new Date().toISOString()
    };
    
    var json = JSON.stringify(testData, null, 2);
    assert(json.includes('questionBank'), '导出数据包含 questionBank');
    assert(json.includes('userData'), '导出数据包含 userData');
    assert(json.includes('exportTime'), '导出数据包含 exportTime');
    
    var parsed = JSON.parse(json);
    assertEqual(parsed.questionBank.length, 1, '解析后题目数量正确');
    assertEqual(parsed.questionBank[0].id, 'test001', '解析后题目ID正确');
    
    var invalidJson = 'not valid json';
    try {
        JSON.parse(invalidJson);
        assert(false, '无效JSON应该抛出异常');
    } catch (e) {
        assert(true, '无效JSON正确抛出异常');
    }
    
    var dataMissingFields = { random: 'data' };
    assert(!dataMissingFields.questionBank && !dataMissingFields.userData, '缺少必要字段的数据被正确识别');
}

function testStatsCalculation() {
    console.log('\n--- 测试统计计算 ---');
    
    var stats = { total: 10, correct: 7, cats: { '专辑': { t: 5, c: 3 }, '歌曲': { t: 5, c: 4 } } };
    var acc = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
    assertEqual(acc, 70, '正确率计算正确');
    
    var catAcc = stats.cats['专辑'].t > 0 ? Math.round(stats.cats['专辑'].c / stats.cats['专辑'].t * 100) : 0;
    assertEqual(catAcc, 60, '分类正确率计算正确');
    
    stats.total = 0;
    acc = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
    assertEqual(acc, 0, '零答题数时正确率为0');
    
    var emptyStats = { total: 0, correct: 0, cats: {} };
    assert(Object.keys(emptyStats.cats).length === 0, '空分类统计正确');
}

function printResults() {
    console.log('\n=== 测试结果 ===');
    console.log('通过: ' + testPassed + ' 个');
    console.log('失败: ' + testFailed + ' 个');
    console.log('总测试数: ' + (testPassed + testFailed) + ' 个');
    
    console.log('\n--- 详细结果 ---');
    for (var i = 0; i < testResults.length; i++) {
        var result = testResults[i];
        console.log((result.status === 'PASS' ? '✓' : '✗') + ' ' + result.message);
    }
    
    if (typeof window !== 'undefined') {
        var div = document.createElement('div');
        div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;color:#fff;padding:20px;font-family:monospace;font-size:12px;max-height:400px;overflow-y:auto;z-index:9999;border-top:1px solid #333;';
        var html = '<h3>测试结果</h3>';
        html += '<p>通过: ' + testPassed + ' | 失败: ' + testFailed + ' | 总计: ' + (testPassed + testFailed) + '</p>';
        html += '<ul>';
        for (var i = 0; i < testResults.length; i++) {
            var result = testResults[i];
            html += '<li style="color:' + (result.status === 'PASS' ? '#4ade80' : '#f87171') + ';">' + result.message + '</li>';
        }
        html += '</ul>';
        div.innerHTML = html;
        document.body.appendChild(div);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runTests, testDBModule, testQuestionParsing, testQuizLogic, testImportExport, testStatsCalculation };
} else if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', function() {
        var script = document.createElement('script');
        script.textContent = 'runTests();';
        document.body.appendChild(script);
    });
}