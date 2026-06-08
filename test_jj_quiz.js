var TEST_RESULTS = [];
var TEST_COUNTER = 0;
var PASS_COUNT = 0;
var FAIL_COUNT = 0;

function test(name, fn) {
    TEST_COUNTER++;
    try {
        fn();
        PASS_COUNT++;
        TEST_RESULTS.push({name: name, pass: true, message: null});
        console.log('✓ PASS:', name);
    } catch (e) {
        FAIL_COUNT++;
        TEST_RESULTS.push({name: name, pass: false, message: e.message});
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
    var actualStr = JSON.stringify(actual);
    var expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`);
    }
}

function setupTestDB() {
    localStorage.removeItem('jj_quiz_v2');
    localStorage.removeItem('jj_question_bank');
}

function runTests() {
    console.log('\n=== 开始执行测试 ===');
    setupTestDB();

    test('DB.get() - 返回默认数据结构', function() {
        var data = DB.get();
        assert(data.hasOwnProperty('history'), '应有history属性');
        assert(data.hasOwnProperty('wrong'), '应有wrong属性');
        assert(data.hasOwnProperty('stats'), '应有stats属性');
        assert(Array.isArray(data.history), 'history应为数组');
        assert(Array.isArray(data.wrong), 'wrong应为数组');
        assert(typeof data.stats === 'object', 'stats应为对象');
    });

    test('DB.findQ() - 能正确查找题目', function() {
        var q = DB.findQ('001');
        assert(q !== null, '能找到题目');
        assertEqual(q.id, '001');
        assertEqual(q.category, '专辑');
    });

    test('DB.findQ() - 找不到不存在的题目返回null', function() {
        var q = DB.findQ('nonexistent');
        assertEqual(q, null);
    });

    test('DB.addRecord() - 添加答题记录', function() {
        setupTestDB();
        DB.addRecord({qid: '001', ans: 'B', ok: true, time: Date.now()});
        var data = DB.get();
        assertEqual(data.history.length, 1);
        assertEqual(data.stats.total, 1);
        assertEqual(data.stats.correct, 1);
    });

    test('DB.addRecord() - 正确记录分类统计', function() {
        setupTestDB();
        DB.addRecord({qid: '001', ans: 'B', ok: true, time: Date.now()});
        var data = DB.get();
        assert(data.stats.cats.hasOwnProperty('专辑'), '应有专辑分类统计');
        assertEqual(data.stats.cats['专辑'].t, 1);
        assertEqual(data.stats.cats['专辑'].c, 1);
    });

    test('DB.addWrong() - 添加错题记录', function() {
        setupTestDB();
        DB.addWrong('001');
        var data = DB.get();
        assertEqual(data.wrong.length, 1);
        assertEqual(data.wrong[0].qid, '001');
        assertEqual(data.wrong[0].cnt, 1);
    });

    test('DB.addWrong() - 重复添加同一错题增加计数', function() {
        setupTestDB();
        DB.addWrong('001');
        DB.addWrong('001');
        var data = DB.get();
        assertEqual(data.wrong.length, 1);
        assertEqual(data.wrong[0].cnt, 2);
    });

    test('DB.removeWrong() - 移除错题记录', function() {
        setupTestDB();
        DB.addWrong('001');
        DB.removeWrong('001');
        var data = DB.get();
        assertEqual(data.wrong.length, 0);
    });

    test('DB.getWrong() - 获取错题列表', function() {
        setupTestDB();
        DB.addWrong('001');
        DB.addWrong('002');
        var wrongs = DB.getWrong();
        assertEqual(wrongs.length, 2);
    });

    test('shuffle() - 数组随机排序后元素不变', function() {
        var arr = [1, 2, 3, 4, 5];
        var shuffled = shuffle(arr.slice());
        assertEqual(shuffled.length, 5);
        assertDeepEqual(shuffled.sort(), arr.sort());
    });

    test('shuffle() - 不修改原数组', function() {
        var arr = [1, 2, 3];
        var original = arr.slice();
        shuffle(arr);
        assertDeepEqual(arr, original);
    });

    test('saveQuestionBank() 和 loadQuestionBank() - 保存和加载题库', function() {
        var originalLength = QUESTION_BANK.length;
        var testBank = [{id: 'test001', category: '测试', question: '测试题', options: [{key: 'A', text: '选项A'}], answer: 'A', explanation: '测试解析'}];
        QUESTION_BANK = testBank;
        saveQuestionBank();
        
        QUESTION_BANK = [];
        loadQuestionBank();
        
        assertEqual(QUESTION_BANK.length, 1);
        assertEqual(QUESTION_BANK[0].id, 'test001');
        
        QUESTION_BANK = DEFAULT_QUESTION_BANK.slice();
        saveQuestionBank();
    });

    test('题库导入导出 - 导出数据格式正确', function() {
        var data = {
            questionBank: QUESTION_BANK.slice(0, 2),
            userData: DB.get(),
            exportTime: new Date().toISOString()
        };
        assert(data.hasOwnProperty('questionBank'), '应有questionBank');
        assert(data.hasOwnProperty('userData'), '应有userData');
        assert(data.hasOwnProperty('exportTime'), '应有exportTime');
    });

    test('getCount() - 根据模式返回正确题目数量', function() {
        state.mode = 'quick';
        assertEqual(getCount(), 10);
        
        state.mode = 'standard';
        assertEqual(getCount(), 20);
        
        state.mode = 'intensive';
        assertEqual(getCount(), 30);
        
        state.mode = 'unknown';
        assertEqual(getCount(), 10);
    });

    test('答题统计 - 正确率计算', function() {
        setupTestDB();
        DB.addRecord({qid: '001', ans: 'B', ok: true, time: Date.now()});
        DB.addRecord({qid: '002', ans: 'A', ok: false, time: Date.now()});
        DB.addRecord({qid: '003', ans: 'C', ok: true, time: Date.now()});
        
        var data = DB.get();
        assertEqual(data.stats.total, 3);
        assertEqual(data.stats.correct, 2);
        
        var acc = Math.round(data.stats.correct / data.stats.total * 100);
        assertEqual(acc, 67);
    });

    console.log('\n=== 测试完成 ===');
    console.log(`总计: ${TEST_COUNTER} 个测试`);
    console.log(`通过: ${PASS_COUNT} 个`);
    console.log(`失败: ${FAIL_COUNT} 个`);

    if (FAIL_COUNT === 0) {
        console.log('\n🎉 所有测试通过！');
    }

    return {
        total: TEST_COUNTER,
        pass: PASS_COUNT,
        fail: FAIL_COUNT,
        results: TEST_RESULTS
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        test,
        assert,
        assertEqual,
        assertDeepEqual,
        runTests
    };
}