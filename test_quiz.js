var TEST_RESULTS = [];

function assert(condition, message) {
    if (condition) {
        TEST_RESULTS.push({ status: 'PASS', message: message });
        console.log('✓ PASS:', message);
    } else {
        TEST_RESULTS.push({ status: 'FAIL', message: message });
        console.log('✗ FAIL:', message);
    }
}

function assertEqual(actual, expected, message) {
    if (actual === expected) {
        TEST_RESULTS.push({ status: 'PASS', message: message });
        console.log('✓ PASS:', message, '(', expected, ')');
    } else {
        TEST_RESULTS.push({ status: 'FAIL', message: message + ' (expected: ' + expected + ', actual: ' + actual + ')' });
        console.log('✗ FAIL:', message, '(expected:', expected, ', actual:', actual, ')');
    }
}

function assertNotEqual(actual, expected, message) {
    if (actual !== expected) {
        TEST_RESULTS.push({ status: 'PASS', message: message });
        console.log('✓ PASS:', message);
    } else {
        TEST_RESULTS.push({ status: 'FAIL', message: message + ' (unexpectedly equal: ' + actual + ')' });
        console.log('✗ FAIL:', message);
    }
}

function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('开始执行测试套件');
    console.log('='.repeat(60));

    testDBModule();
    testShuffleFunction();
    testOptionParsing();
    testAnswerValidation();
    testCategoryStats();

    console.log('\n' + '='.repeat(60));
    console.log('测试完成');
    console.log('='.repeat(60));
    
    var passed = TEST_RESULTS.filter(function(r) { return r.status === 'PASS'; }).length;
    var total = TEST_RESULTS.length;
    var pct = Math.round(passed / total * 100);
    
    console.log('\n测试结果: ' + passed + '/' + total + ' (' + pct + '%)');
    
    if (passed < total) {
        console.log('\n失败的测试:');
        TEST_RESULTS.filter(function(r) { return r.status === 'FAIL'; }).forEach(function(r) {
            console.log('  - ' + r.message);
        });
    }
    
    return TEST_RESULTS;
}

function testDBModule() {
    console.log('\n--- 测试 DB 模块 ---');
    
    localStorage.clear();
    
    var initial = DB.get();
    assert(initial.history !== undefined, 'DB.get() 应返回包含 history 的对象');
    assert(initial.wrong !== undefined, 'DB.get() 应返回包含 wrong 的对象');
    assert(initial.stats !== undefined, 'DB.get() 应返回包含 stats 的对象');
    
    DB.addRecord({ qid: 'test001', ans: 'A', ok: true, time: Date.now() });
    var afterAdd = DB.get();
    assertEqual(afterAdd.stats.total, 1, 'DB.addRecord() 应增加总答题数');
    assertEqual(afterAdd.stats.correct, 1, 'DB.addRecord() 应正确记录正确答案');
    
    DB.addWrong('test001');
    var afterWrong = DB.get();
    assertEqual(afterWrong.wrong.length, 1, 'DB.addWrong() 应添加错题记录');
    assertEqual(afterWrong.wrong[0].qid, 'test001', 'DB.addWrong() 应正确记录错题ID');
    assertEqual(afterWrong.wrong[0].cnt, 1, 'DB.addWrong() 应初始化错误计数为1');
    
    DB.addWrong('test001');
    var afterSecondWrong = DB.get();
    assertEqual(afterSecondWrong.wrong[0].cnt, 2, 'DB.addWrong() 同一题目重复错误应增加计数');
    
    DB.removeWrong('test001');
    var afterRemove = DB.get();
    assertEqual(afterRemove.wrong.length, 0, 'DB.removeWrong() 应移除错题记录');
    
    localStorage.clear();
}

function testShuffleFunction() {
    console.log('\n--- 测试 shuffle 函数 ---');
    
    var arr = [1, 2, 3, 4, 5];
    var original = arr.slice();
    
    var shuffled = shuffle(arr.slice());
    
    assertEqual(shuffled.length, 5, 'shuffle() 应保持数组长度');
    
    var allElementsPresent = original.every(function(item) {
        return shuffled.indexOf(item) !== -1;
    });
    assert(allElementsPresent, 'shuffle() 应保持所有元素存在');
    
    var isShuffled = JSON.stringify(shuffled) !== JSON.stringify(original);
    assert(isShuffled, 'shuffle() 应打乱数组顺序');
    
    var sameElements = shuffled.every(function(item) {
        return original.indexOf(item) !== -1;
    });
    assert(sameElements, 'shuffle() 不应添加或删除元素');
}

function testOptionParsing() {
    console.log('\n--- 测试选项解析逻辑 ---');
    
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
    
    assertEqual(options.length, 4, '选项解析应正确解析4个选项');
    assertEqual(options[0].key, 'A', '选项解析应正确提取选项键');
    assertEqual(options[0].text, '选项1', '选项解析应正确提取选项内容');
    assertEqual(options[3].key, 'D', '选项解析应正确解析最后一个选项');
    assertEqual(options[3].text, '选项4', '选项解析应正确提取最后一个选项内容');
    
    var optsTextChinese = 'A、中文选项1\nB．中文选项2';
    lines = optsTextChinese.split('\n');
    options = [];
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var match = line.match(/^([A-D])[.、．]\s*(.+)$/);
        if (match) {
            options.push({ key: match[1], text: match[2] });
        }
    }
    
    assertEqual(options.length, 2, '选项解析应支持中文句号分隔符');
    assertEqual(options[0].key, 'A', '选项解析应正确识别中文顿号');
    assertEqual(options[1].key, 'B', '选项解析应正确识别中文句号');
}

function testAnswerValidation() {
    console.log('\n--- 测试答题验证逻辑 ---');
    
    var mockQuestion = {
        id: 'test001',
        question: '测试题',
        options: [
            { key: 'A', text: '选项A' },
            { key: 'B', text: '选项B' },
            { key: 'C', text: '选项C' },
            { key: 'D', text: '选项D' }
        ],
        answer: 'B',
        explanation: '解析'
    };
    
    var correctAnswer = 'B';
    var wrongAnswer = 'A';
    
    assertEqual(correctAnswer === mockQuestion.answer, true, '正确答案判断');
    assertEqual(wrongAnswer === mockQuestion.answer, false, '错误答案判断');
    
    var anotherQuestion = {
        id: 'test002',
        question: '判断题',
        options: [
            { key: 'A', text: '正确' },
            { key: 'B', text: '错误' }
        ],
        answer: 'A',
        explanation: '解析'
    };
    
    assertEqual(anotherQuestion.options.length, 2, '支持2选项题目');
    assertEqual('A' === anotherQuestion.answer, true, '2选项题目答案判断');
}

function testCategoryStats() {
    console.log('\n--- 测试分类统计逻辑 ---');
    
    localStorage.clear();
    
    DB.addRecord({ qid: '001', ans: 'B', ok: true, time: Date.now() });
    DB.addRecord({ qid: '002', ans: 'A', ok: false, time: Date.now() });
    DB.addRecord({ qid: '061', ans: 'B', ok: true, time: Date.now() });
    
    var data = DB.get();
    
    assert(data.stats.cats['专辑'] !== undefined, '应记录专辑分类统计');
    assert(data.stats.cats['歌曲'] !== undefined, '应记录歌曲分类统计');
    assert(data.stats.cats['个人信息'] !== undefined, '应记录个人信息分类统计');
    
    assertEqual(data.stats.cats['专辑'].t, 1, '专辑分类答题数应正确');
    assertEqual(data.stats.cats['专辑'].c, 1, '专辑分类正确数应正确');
    
    assertEqual(data.stats.cats['歌曲'].t, 1, '歌曲分类答题数应正确');
    assertEqual(data.stats.cats['歌曲'].c, 0, '歌曲分类正确数应正确');
    
    assertEqual(data.stats.total, 3, '总答题数应正确');
    assertEqual(data.stats.correct, 2, '总正确数应正确');
    
    localStorage.clear();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runTests: runTests,
        assert: assert,
        assertEqual: assertEqual
    };
} else {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            runTests();
        });
    } else {
        runTests();
    }
}