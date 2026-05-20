var TEST_RESULTS = [];
var TEST_DB_KEY = 'jj_quiz_test';

function assert(condition, message) {
    if (!condition) {
        TEST_RESULTS.push({ type: 'FAIL', message: message });
        console.error('FAIL:', message);
    } else {
        TEST_RESULTS.push({ type: 'PASS', message: message });
        console.log('PASS:', message);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        TEST_RESULTS.push({ type: 'FAIL', message: message + ' (实际: ' + actual + ', 期望: ' + expected + ')' });
        console.error('FAIL:', message, '- 实际:', actual, '期望:', expected);
    } else {
        TEST_RESULTS.push({ type: 'PASS', message: message });
        console.log('PASS:', message);
    }
}

function assertDeepEqual(actual, expected, message) {
    var actualStr = JSON.stringify(actual);
    var expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        TEST_RESULTS.push({ type: 'FAIL', message: message + ' (实际: ' + actualStr + ', 期望: ' + expectedStr + ')' });
        console.error('FAIL:', message, '- 实际:', actualStr, '期望:', expectedStr);
    } else {
        TEST_RESULTS.push({ type: 'PASS', message: message });
        console.log('PASS:', message);
    }
}

function beforeEach() {
    localStorage.removeItem(DB.KEY);
    localStorage.removeItem('jj_question_bank');
}

function afterEach() {
    localStorage.removeItem(DB.KEY);
    localStorage.removeItem('jj_question_bank');
}

function runAllTests() {
    TEST_RESULTS = [];
    
    console.log('\n=== 开始运行测试 ===\n');
    
    testDBModule();
    testShuffleFunction();
    testQuestionManagement();
    
    console.log('\n=== 测试完成 ===');
    var passed = TEST_RESULTS.filter(function(r) { return r.type === 'PASS'; }).length;
    var failed = TEST_RESULTS.filter(function(r) { return r.type === 'FAIL'; }).length;
    console.log('通过:', passed, '失败:', failed);
    
    return { passed: passed, failed: failed, results: TEST_RESULTS };
}

function testDBModule() {
    console.log('\n--- DB模块测试 ---');
    beforeEach();
    
    var defaultData = DB.get();
    assertDeepEqual(defaultData, { history: [], wrong: [], stats: { total: 0, correct: 0, cats: {} } }, '初始数据应为默认值');
    
    var testQ = QUESTION_BANK[0];
    
    DB.addRecord({ qid: testQ.id, ans: 'A', ok: true, time: Date.now() });
    var data1 = DB.get();
    assertEqual(data1.stats.total, 1, '添加记录后总数应为1');
    assertEqual(data1.stats.correct, 1, '添加正确记录后正确数应为1');
    
    DB.addRecord({ qid: testQ.id, ans: 'B', ok: false, time: Date.now() });
    var data2 = DB.get();
    assertEqual(data2.stats.total, 2, '添加第二条记录后总数应为2');
    assertEqual(data2.stats.correct, 1, '添加错误记录后正确数仍应为1');
    
    DB.addWrong(testQ.id);
    var data3 = DB.get();
    assertEqual(data3.wrong.length, 1, '添加错题后错题数应为1');
    assertEqual(data3.wrong[0].qid, testQ.id, '错题ID应匹配');
    assertEqual(data3.wrong[0].cnt, 1, '错题计数应为1');
    
    DB.addWrong(testQ.id);
    var data4 = DB.get();
    assertEqual(data4.wrong.length, 1, '重复添加同一错题不应增加数量');
    assertEqual(data4.wrong[0].cnt, 2, '重复添加后计数应为2');
    
    DB.removeWrong(testQ.id);
    var data5 = DB.get();
    assertEqual(data5.wrong.length, 0, '移除错题后错题数应为0');
    
    var found = DB.findQ(testQ.id);
    assertEqual(found.id, testQ.id, '查找题目应返回正确结果');
    
    var notFound = DB.findQ('nonexistent');
    assertEqual(notFound, null, '查找不存在的题目应返回null');
    
    afterEach();
}

function testShuffleFunction() {
    console.log('\n--- shuffle函数测试 ---');
    
    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffle(arr.slice());
    
    assertEqual(shuffled.length, arr.length, '打乱后数组长度应不变');
    
    var containsAll = arr.every(function(item) {
        return shuffled.indexOf(item) !== -1;
    });
    assert(containsAll, '打乱后应包含所有原元素');
    
    var sameOrder = shuffled.every(function(item, index) {
        return item === arr[index];
    });
    assert(!sameOrder, '打乱后顺序应不同');
}

function testQuestionManagement() {
    console.log('\n--- 题目管理测试 ---');
    beforeEach();
    
    var originalLength = QUESTION_BANK.length;
    
    var newQ = {
        id: 'test001',
        category: '测试',
        question: '测试题目？',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' }
        ],
        answer: 'A',
        explanation: '测试解析'
    };
    
    QUESTION_BANK.push(newQ);
    assertEqual(QUESTION_BANK.length, originalLength + 1, '新增题目后题库应增加');
    
    var found = QUESTION_BANK.find(function(q) { return q.id === 'test001'; });
    assertEqual(found.question, '测试题目？', '新增题目应正确添加');
    
    QUESTION_BANK = QUESTION_BANK.filter(function(q) { return q.id !== 'test001'; });
    assertEqual(QUESTION_BANK.length, originalLength, '删除题目后题库应恢复原长度');
    
    var notFound = QUESTION_BANK.find(function(q) { return q.id === 'test001'; });
    assertEqual(notFound, undefined, '删除后不应找到该题目');
    
    afterEach();
}

function testOptionsParsing() {
    console.log('\n--- 选项解析测试 ---');
    
    var optsText = 'A.选项一\nB.选项二\nC.选项三\nD.选项四';
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
    
    assertEqual(options.length, 4, '应正确解析4个选项');
    assertEqual(options[0].key, 'A', '第一个选项key应为A');
    assertEqual(options[0].text, '选项一', '第一个选项text应为选项一');
    assertEqual(options[3].key, 'D', '第四个选项key应为D');
    assertEqual(options[3].text, '选项四', '第四个选项text应为选项四');
    
    var emptyOpts = '';
    var emptyLines = emptyOpts.split('\n');
    var emptyOptions = [];
    for (var j = 0; j < emptyLines.length; j++) {
        var emptyLine = emptyLines[j].trim();
        if (!emptyLine) continue;
        var emptyMatch = emptyLine.match(/^([A-D])[.、．]\s*(.+)$/);
        if (emptyMatch) {
            emptyOptions.push({ key: emptyMatch[1], text: emptyMatch[2] });
        }
    }
    assertEqual(emptyOptions.length, 0, '空文本应解析为0个选项');
}

function testCategoryStats() {
    console.log('\n--- 分类统计测试 ---');
    beforeEach();
    
    var q1 = QUESTION_BANK.find(function(q) { return q.category === '专辑'; });
    var q2 = QUESTION_BANK.find(function(q) { return q.category === '歌曲'; });
    
    DB.addRecord({ qid: q1.id, ans: q1.answer, ok: true, time: Date.now() });
    DB.addRecord({ qid: q1.id, ans: 'B', ok: false, time: Date.now() });
    DB.addRecord({ qid: q2.id, ans: q2.answer, ok: true, time: Date.now() });
    
    var data = DB.get();
    
    assert(data.stats.cats['专辑'], '应存在专辑分类统计');
    assertEqual(data.stats.cats['专辑'].t, 2, '专辑分类答题数应为2');
    assertEqual(data.stats.cats['专辑'].c, 1, '专辑分类正确数应为1');
    
    assert(data.stats.cats['歌曲'], '应存在歌曲分类统计');
    assertEqual(data.stats.cats['歌曲'].t, 1, '歌曲分类答题数应为1');
    assertEqual(data.stats.cats['歌曲'].c, 1, '歌曲分类正确数应为1');
    
    afterEach();
}